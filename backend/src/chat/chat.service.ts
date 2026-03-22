import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CacheService, CacheKeys } from '../shared/cache.service';
import { RequestDeduplicationService } from '../shared/services/request-deduplication.service';
import { createHash } from 'crypto';
import { z } from 'zod';
import { IntentParams, ParseResult, RiskAssessment, Strategy } from '../shared/types';
import { StrategyService } from '../strategy/strategy.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private openai: OpenAI;
  private deepseekReasoner: OpenAI;
  private mem0Client: any; // TODO: Add proper typing when mem0ai package is available

  // Zod schema for IntentParams validation (without deadline - we add it after validation)
  private readonly intentParamsSchema = z.object({
    action: z.enum(['yield', 'swap', 'stake', 'lend', 'transfer', 'bridge']),
    asset: z.string().min(1),
    amount: z.string().min(1),
    riskTolerance: z.enum(['low', 'medium', 'high']),
    minYieldBps: z.number().min(0).max(10000).optional(),
    maxLockDays: z.number().min(0).optional(),
  });

  // Zod schema for RiskAssessment validation
  private readonly riskAssessmentSchema = z.object({
    riskScore: z.number().min(0).max(100),
    riskFactors: z.array(z.string()),
    mitigations: z.array(z.string()),
    confidence: z.number().min(0).max(100),
  });

  // DeepSeek function calling tool definition for intent parsing
  private readonly intentParsingTool = {
    type: "function" as const,
    function: {
      name: "parse_intent",
      description: "Parse user's financial intent into structured parameters",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["yield", "swap", "stake", "lend", "transfer", "bridge"],
            description: "The type of financial action the user wants to perform"
          },
          asset: { 
            type: "string",
            description: "The asset symbol (e.g., DOT, USDC, ETH)"
          },
          amount: { 
            type: "string",
            description: "The amount to invest/trade as a string. Extract the EXACT number from the user's message (e.g., '100 DOT' → '100', '50 USDC' → '50'). NEVER use '0' unless the user explicitly says zero."
          },
          riskTolerance: { 
            type: "string", 
            enum: ["low", "medium", "high"],
            description: "User's risk tolerance level"
          },
          minYieldBps: { 
            type: "number",
            description: "Minimum yield in basis points (optional)"
          },
          maxLockDays: { 
            type: "number",
            description: "Maximum lock period in days (optional)"
          },
          confidence: { 
            type: "number", 
            minimum: 0, 
            maximum: 100,
            description: "Confidence level in the parsing (0-100). Set < 60 if any required information is missing or unclear."
          }
        },
        required: ["action", "asset", "amount", "riskTolerance", "confidence"]
      }
    }
  };

  constructor(
    private configService: ConfigService,
    private cacheService: CacheService,
    private requestDeduplicationService: RequestDeduplicationService,
    private strategyService: StrategyService,
  ) {
    // Get API key and log for debugging
    const deepseekApiKey = this.configService.get('DEEPSEEK_API_KEY');
    this.logger.log(`Initializing ChatService with DeepSeek API key: ${deepseekApiKey ? `${deepseekApiKey.substring(0, 10)}...` : 'NOT SET'}`);
    
    if (!deepseekApiKey || deepseekApiKey === 'your_deepseek_api_key_here') {
      this.logger.error('DEEPSEEK_API_KEY is not properly configured in environment variables');
    }

    // Initialize DeepSeek API client for chat
    this.openai = new OpenAI({
      apiKey: deepseekApiKey,
      baseURL: 'https://api.deepseek.com',
    });

    // Initialize DeepSeek API client for reasoning (risk assessment)
    this.deepseekReasoner = new OpenAI({
      apiKey: deepseekApiKey,
      baseURL: 'https://api.deepseek.com',
    });

    this.logger.log('DeepSeek API clients initialized');

    // Initialize Mem0 client
    try {
      // Note: Using require for dynamic import since mem0ai might not have proper ES module support
      const Mem0 = require('mem0ai');
      this.mem0Client = new Mem0({
        apiKey: this.configService.get('MEM0_API_KEY'),
      });
      this.logger.log('Mem0 client initialized successfully');
    } catch (error) {
      this.logger.warn('Failed to initialize Mem0 client:', error);
      this.mem0Client = null;
    }
  }

  async processMessage(message: string, userId: string) {
    try {
      // Check rate limiting
      const rateLimitKey = CacheKeys.rateLimitChat(userId);
      const rateLimit = await this.cacheService.checkRateLimit(rateLimitKey, 30, 60);
      
      if (!rateLimit.allowed) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please wait before sending another message.',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        };
      }

      // Check cache for similar queries
      const queryHash = this.createQueryHash(message, userId);
      const cacheKey = CacheKeys.deepSeekQuery(queryHash);
      
      const cachedResponse = await this.cacheService.get(cacheKey);
      if (cachedResponse) {
        this.logger.debug(`Using cached response for query hash: ${queryHash}`);
        return cachedResponse;
      }

      // Parse the user's intent
      const parseResult = await this.parseIntent(message, userId);
      
      if (!parseResult.success) {
        const response = {
          success: false,
          confidence: parseResult.confidence,
          clarificationQuestion: parseResult.clarificationQuestion,
          message: 'I need more information to help you.',
          queryHash,
        };

        // Cache the response
        await this.cacheService.set(cacheKey, response, { ttl: 60 });
        return response;
      }

      // Store user preferences in memory
      if (parseResult.intentParams) {
        await this.storeRiskPreferences(
          userId, 
          parseResult.intentParams.riskTolerance, 
          `User requested ${parseResult.intentParams.action} for ${parseResult.intentParams.asset}`
        );
      }

      // Compute strategies based on parsed intent
      let strategies: Strategy[] = [];
      if (parseResult.intentParams) {
        try {
          const strategyResult = await this.strategyService.computeStrategies(parseResult.intentParams);
          strategies = strategyResult.strategies;
          
          this.logger.log(`Generated ${strategies.length} strategies for user ${userId}`);
          
          // Generate explanations and risk assessments for each strategy (non-blocking, with fallbacks)
          for (const strategy of strategies) {
            try {
              // Generate AI explanation with timeout
              strategy.explanation = await Promise.race([
                this.explainStrategy(strategy),
                new Promise<string>((_, reject) => 
                  setTimeout(() => reject(new Error('Explanation timeout')), 5000)
                )
              ]).catch(() => {
                // Fallback explanation
                return `This strategy uses ${strategy.protocol} on ${strategy.chain} to earn approximately ${(strategy.estimatedApyBps / 100).toFixed(2)}% APY with ${strategy.riskLevel} risk.`;
              });
              
              // Generate AI risk assessment with timeout
              strategy.riskAssessment = await Promise.race([
                this.assessRisk(strategy),
                new Promise<RiskAssessment>((_, reject) => 
                  setTimeout(() => reject(new Error('Risk assessment timeout')), 5000)
                )
              ]).catch(() => {
                // Fallback risk assessment
                const fallbackScore = this.calculateFallbackRiskScore(strategy);
                return {
                  overallScore: fallbackScore,
                  factors: [
                    { name: 'Protocol Risk', score: fallbackScore, reason: 'Based on protocol maturity' },
                    { name: 'Lock Period Risk', score: Math.min(strategy.lockDays * 2, 100), reason: `${strategy.lockDays} day lock` }
                  ],
                  recommendations: ['Monitor protocol developments', 'Consider position sizing'],
                  warnings: this.generateRiskWarnings(fallbackScore, ['Protocol Risk']),
                  confidence: 50
                };
              });
            } catch (error) {
              this.logger.warn(`Failed to generate AI content for strategy ${strategy.protocol}:`, error);
              // Strategy will use fallback values set above
            }
          }

        } catch (error) {
          this.logger.error('Failed to compute strategies:', error);
          strategies = [];
        }
      }

      const response = {
        success: true,
        confidence: parseResult.confidence,
        intentParams: parseResult.intentParams,
        strategies,
        message: strategies.length > 0
          ? this.buildSuccessMessage(parseResult.intentParams?.action, parseResult.intentParams?.amount, parseResult.intentParams?.asset, strategies.length)
          : `I understand you want to ${parseResult.intentParams?.action} ${parseResult.intentParams?.amount} ${parseResult.intentParams?.asset}, but I couldn't find any options. Try adjusting your requirements.`,
        queryHash,
      };

      // Cache the response
      await this.cacheService.set(cacheKey, response, { ttl: 60 });

      return response;
    } catch (error) {
      this.logger.error('Chat processing error:', error);
      return {
        success: false,
        error: 'Failed to process message',
      };
    }
  }

  async parseIntent(message: string, userId: string): Promise<ParseResult> {
    try {
      // Check if DeepSeek API key is configured
      const apiKey = this.configService.get('DEEPSEEK_API_KEY');
      if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
        this.logger.error('DEEPSEEK_API_KEY is not configured or is using default value');
        return {
          success: false,
          confidence: 0,
          clarificationQuestion: 'AI service is not configured. Please contact support.',
        };
      }

      // 1. Retrieve user memories from Mem0 before parsing
      const memories = await this.searchMemories(userId, message, 5);
      
      // 2. Inject memories into DeepSeek system prompt
      const memoryContext = memories.length > 0 
        ? `\n\nUser Context from Previous Conversations:\n${memories.map(m => `- ${m.content || m.text || JSON.stringify(m)}`).join('\n')}`
        : '';

      const systemPrompt = `You are a DeFi AI assistant for the Polkadot ecosystem. Parse user messages into structured financial intents.

CRITICAL AMOUNT PARSING RULE:
When you see a number followed by an asset name (like "100 DOT" or "50 USDC"), you MUST extract that exact number as the amount string.
Example: "I want to earn yield on 100 DOT" → amount MUST be "100", NOT "0"
Example: "stake 50 USDC" → amount MUST be "50", NOT "0"

Key Guidelines:
- Extract the financial action (yield, swap, stake, lend, transfer, bridge)
- Identify the asset symbol (DOT, USDC, ETH, etc.)
- Parse the amount EXACTLY as the number that appears before the asset name
- NEVER use "0" as amount when a number is present in the message
- If truly no amount is mentioned, set confidence < 60
- Determine risk tolerance from context (conservative=low, balanced=medium, aggressive=high)

Amount Parsing Examples:
- "I want to earn yield on 100 DOT" → amount: "100"
- "earn yield on 50 USDC" → amount: "50"
- "stake 1000 tokens" → amount: "1000"
- "swap 25 ETH" → amount: "25"
- "I want to earn yield on 10 PAS" → amount: "10"
- "I want to stake DOT" (no number) → amount: "0", confidence: 50

Risk Tolerance Mapping:
- "safe", "conservative", "low risk" → low
- "balanced", "moderate", "medium risk" → medium
- "aggressive", "high yield", "high risk" → high

Asset Mapping:
- "DOT", "Polkadot" → DOT
- "PAS", "Paseo", "Paseo token" → PAS
- "USDC", "USD Coin" → USDC
- "ETH", "Ethereum" → ETH
- If NO asset is mentioned at all, default to "PAS" (this is the Paseo testnet, PAS is the native token)

Network Context:
- This app runs on Polkadot Hub Testnet (Paseo). PAS is the native testnet token.
- When no asset is specified, ALWAYS default to PAS, never DOT.
- When no amount is specified, set amount: "0" and confidence: 45 so a clarification is triggered.${memoryContext}`;

      // 3. Call DeepSeek with function calling (with deduplication)
      const deduplicationKey = `deepseek:parse:${this.createQueryHash(message, userId, systemPrompt)}`;
      
      this.logger.log(`Calling DeepSeek API for message: "${message}"`);
      
      const response = await this.requestDeduplicationService.deduplicate(
        deduplicationKey,
        async () => {
          return await this.openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message }
            ],
            tools: [this.intentParsingTool],
            tool_choice: 'required', // Force the model to use the tool
            temperature: 0.1,
          });
        },
        { ttl: 60 } // 60 seconds TTL for deduplication
      );

      this.logger.debug('DeepSeek response received');
      this.logger.debug('Response structure:', JSON.stringify({
        model: response.model,
        finishReason: response.choices[0]?.finish_reason,
        hasToolCalls: !!response.choices[0]?.message?.tool_calls,
        toolCallsCount: response.choices[0]?.message?.tool_calls?.length || 0,
      }, null, 2));

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.function.name !== 'parse_intent') {
        this.logger.error('No valid tool call received from DeepSeek');
        this.logger.error('Full message:', JSON.stringify(response.choices[0]?.message, null, 2));
        return {
          success: false,
          confidence: 0,
          clarificationQuestion: 'AI service did not return a valid response. Please try rephrasing your message.',
        };
      }

      this.logger.debug(`Tool call received: ${toolCall.function.name}`);
      
      const parsedArgs = JSON.parse(toolCall.function.arguments);
      this.logger.log('Parsed intent arguments:', JSON.stringify(parsedArgs, null, 2));
      
      const confidence = parsedArgs.confidence || 0;
      
      // CRITICAL: Check if amount is "0" but message contains a number
      if (parsedArgs.amount === "0" || parsedArgs.amount === 0) {
        const numberMatch = message.match(/\b(\d+)\s*(DOT|USDC|ETH|USD|tokens?)\b/i);
        if (numberMatch) {
          this.logger.warn(`DeepSeek returned amount="0" but message contains number: ${numberMatch[1]}`);
          this.logger.warn(`Overriding amount to: ${numberMatch[1]}`);
          parsedArgs.amount = numberMatch[1];
        }
      }
      
      // 4. Validate response against IntentParams schema (without deadline and confidence)
      const validationResult = this.intentParamsSchema.safeParse(parsedArgs);
      
      if (!validationResult.success) {
        this.logger.warn('Intent parsing validation failed');
        this.logger.warn('Validation errors:', JSON.stringify(validationResult.error.errors, null, 2));
        this.logger.warn('Parsed args that failed validation:', JSON.stringify(parsedArgs, null, 2));
        return {
          success: false,
          confidence: 0,
          clarificationQuestion: 'I had trouble understanding your request. Could you please provide more details about what you want to do, which asset, and how much?',
        };
      }

      // Add deadline after validation (it's not part of the AI response)
      const intentParams: IntentParams = {
        ...validationResult.data,
        deadline: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // Default 24 hours from now
      };

      this.logger.log('Intent parsed successfully:', JSON.stringify({
        action: intentParams.action,
        asset: intentParams.asset,
        amount: intentParams.amount,
        riskTolerance: intentParams.riskTolerance,
        confidence: confidence,
      }));

      // 5. Return clarification question if confidence < 60
      if (confidence < 60) {
        const clarificationQuestion = this.generateClarificationQuestion(intentParams);
        this.logger.log(`Low confidence (${confidence}), requesting clarification`);
        return {
          success: false,
          confidence: 40, // Low confidence when clarification needed
          clarificationQuestion,
        };
      }

      // 6. Store conversation in Mem0 after parsing
      await this.addMemory(userId, `User request: "${message}" → Parsed intent: ${intentParams.action} ${intentParams.amount} ${intentParams.asset} with ${intentParams.riskTolerance} risk tolerance`, {
        action: intentParams.action,
        asset: intentParams.asset,
        amount: intentParams.amount,
        riskTolerance: intentParams.riskTolerance,
        confidence: 80, // Default confidence
      });

      return {
        success: true,
        confidence: 80, // Default confidence when parsing succeeds
        intentParams,
      };

    } catch (error) {
      this.logger.error('Intent parsing error:', error);
      if (error instanceof Error) {
        this.logger.error('Error stack:', error.stack);
      }
      return {
        success: false,
        confidence: 0,
        clarificationQuestion: 'I encountered an error processing your request. Please try rephrasing your message.',
      };
    }
  }

  /**
   * Generate clarification question based on missing or ambiguous information
   */
  private generateClarificationQuestion(intentParams: Partial<IntentParams>): string {
    const missing: string[] = [];
    
    if (!intentParams.action || intentParams.action === undefined) {
      missing.push('what you want to do (earn yield, swap tokens, stake, etc.)');
    }
    
    if (!intentParams.asset) {
      missing.push('which asset you want to use');
    }
    
    if (!intentParams.amount) {
      missing.push('how much you want to invest');
    }
    
    if (!intentParams.riskTolerance) {
      missing.push('your risk tolerance (low, medium, or high)');
    }

    if (missing.length > 0) {
      return `I need more information to help you. Please clarify: ${missing.join(', ')}.`;
    }

    // If all fields are present but confidence is low, ask for confirmation
    return `I think you want to ${intentParams.action} ${intentParams.amount} ${intentParams.asset} with ${intentParams.riskTolerance} risk tolerance. Is this correct?`;
  }

  async explainStrategy(strategy: any): Promise<string> {
    // Create cache key for strategy explanation
    const strategyHash = this.createQueryHash(JSON.stringify(strategy));
    const cacheKey = CacheKeys.deepSeekQuery(`explain:${strategyHash}`);
    
    // Use cache wrapper
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          const systemPrompt = `You are a DeFi expert explaining yield strategies to users. Provide clear, human-readable explanations that help users understand:

1. What the strategy does
2. How it generates yield
3. Key risks and trade-offs
4. Why it's suitable for their risk tolerance

Keep explanations concise but informative. Use simple language and avoid excessive technical jargon.`;

          const userPrompt = `Explain this DeFi strategy:

Protocol: ${strategy.protocol}
Chain: ${strategy.chain}
Estimated APY: ${(strategy.estimatedApyBps / 100).toFixed(2)}%
Risk Level: ${strategy.riskLevel}
Lock Period: ${strategy.lockDays} days
Net APY: ${(strategy.netApyBps / 100).toFixed(2)}%

Risk Assessment:
- Overall Risk Score: ${strategy.riskScore}/100
- Risk Factors: ${strategy.riskAssessment?.factors?.map((f: any) => f.name).join(', ') || 'Standard DeFi risks'}

Please provide a clear explanation of how this strategy works, its benefits, and considerations for the user.`;

          const deduplicationKey = `deepseek:explain:${strategyHash}`;
          
          const response = await this.requestDeduplicationService.deduplicate(
            deduplicationKey,
            async () => {
              return await this.openai.chat.completions.create({
                model: 'deepseek-chat',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                max_tokens: 500,
              });
            },
            { ttl: 60 } // 60 seconds TTL for deduplication
          );

          const explanation = response.choices[0]?.message?.content?.trim();
          
          if (!explanation) {
            throw new Error('No explanation received from DeepSeek');
          }

          this.logger.debug('Generated strategy explanation');
          return explanation;

        } catch (error) {
          this.logger.error('Strategy explanation error:', error);
          // Fallback explanation
          return `This strategy involves using ${strategy.protocol} on ${strategy.chain} to earn approximately ${(strategy.estimatedApyBps / 100).toFixed(2)}% APY. The strategy has a ${strategy.riskLevel} risk level with a ${strategy.lockDays}-day lock period. After accounting for gas costs, the net APY is ${(strategy.netApyBps / 100).toFixed(2)}%.`;
        }
      },
      { ttl: 300 } // Cache for 5 minutes
    );
  }

  async assessRisk(strategy: any): Promise<RiskAssessment> {
    // Create cache key for risk assessment
    const strategyHash = this.createQueryHash(JSON.stringify(strategy));
    const cacheKey = CacheKeys.deepSeekRisk(strategyHash);
    
    // Use cache wrapper
    return await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          // Build prompt including protocol details
          const prompt = `Analyze the risk of this DeFi strategy and provide a comprehensive risk assessment:

Protocol: ${strategy.protocol}
Chain: ${strategy.chain}
TVL: $${strategy.tvlUsd?.toLocaleString() || 'Unknown'}
Audit Status: ${strategy.auditStatus || 'Unknown'}
Lock Period: ${strategy.lockDays} days
Historical APY Volatility: ${strategy.apyVolatility || 'Moderate'}
Estimated APY: ${(strategy.estimatedApyBps / 100).toFixed(2)}%

Please analyze the following risk factors:
1. Smart contract risk (based on audit status and protocol maturity)
2. Liquidity risk (based on TVL and market conditions)
3. Lock-up risk (based on lock period and market volatility)
4. Protocol-specific risks (impermanent loss, slashing, etc.)
5. Market risk (price volatility, correlation risks)

Provide your assessment in the following JSON format:
{
  "riskScore": <number 0-100>,
  "riskFactors": ["factor1", "factor2", ...],
  "mitigations": ["mitigation1", "mitigation2", ...],
  "confidence": <number 0-100>
}

Consider:
- riskScore: 0-30 = Low risk, 31-60 = Medium risk, 61-100 = High risk
- riskFactors: Specific risks identified for this strategy
- mitigations: Ways to reduce or manage the identified risks
- confidence: How confident you are in this assessment (0-100)`;

          // Use deepseek-reasoner model for risk assessment (with deduplication)
          const deduplicationKey = `deepseek:risk:${strategyHash}`;
          
          const response = await this.requestDeduplicationService.deduplicate(
            deduplicationKey,
            async () => {
              return await this.deepseekReasoner.chat.completions.create({
                model: 'deepseek-reasoner',
                messages: [
                  { role: 'user', content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 1000,
              });
            },
            { ttl: 60 } // 60 seconds TTL for deduplication
          );

          const content = response.choices[0]?.message?.content?.trim();
          
          if (!content) {
            throw new Error('No response received from DeepSeek reasoner');
          }

          // Extract JSON from the response (it might be wrapped in markdown or other text)
          let jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            // Try to find JSON-like structure
            jsonMatch = content.match(/{\s*"riskScore"[\s\S]*}/);
          }

          if (!jsonMatch) {
            throw new Error('No valid JSON found in DeepSeek response');
          }

          const parsedResponse = JSON.parse(jsonMatch[0]);
          
          // Validate response against RiskAssessment schema
          const validationResult = this.riskAssessmentSchema.safeParse(parsedResponse);
          
          if (!validationResult.success) {
            this.logger.warn('Risk assessment validation failed:', validationResult.error);
            throw new Error('Invalid risk assessment format from DeepSeek');
          }

          const riskAssessment: RiskAssessment = {
            overallScore: validationResult.data.riskScore,
            factors: validationResult.data.riskFactors.map(factor => ({
              name: factor,
              score: validationResult.data.riskScore, // Use overall score for individual factors
              reason: `Risk factor identified by AI analysis`,
            })),
            recommendations: validationResult.data.mitigations,
            warnings: this.generateRiskWarnings(validationResult.data.riskScore, validationResult.data.riskFactors),
            confidence: validationResult.data.confidence,
          };

          this.logger.debug('Generated risk assessment with deepseek-reasoner');
          return riskAssessment;

        } catch (error) {
          this.logger.error('Risk assessment error:', error);
          
          // Fallback risk assessment based on strategy properties
          const fallbackRiskScore = this.calculateFallbackRiskScore(strategy);
          
          return {
            overallScore: fallbackRiskScore,
            factors: [
              {
                name: 'Protocol Risk',
                score: fallbackRiskScore,
                reason: 'Based on audit status and protocol maturity',
              },
              {
                name: 'Lock Period Risk',
                score: Math.min(strategy.lockDays * 2, 100),
                reason: `${strategy.lockDays} day lock period`,
              }
            ],
            recommendations: [
              'Monitor protocol developments',
              'Consider position sizing based on risk tolerance',
              'Stay informed about market conditions',
            ],
            warnings: this.generateRiskWarnings(fallbackRiskScore, ['Protocol Risk', 'Lock Period Risk']),
            confidence: 50, // Lower confidence for fallback
          };
        }
      },
      { ttl: 300 } // Cache for 5 minutes
    );
  }

  /**
   * Calculate fallback risk score when AI assessment fails
   */
  private calculateFallbackRiskScore(strategy: any): number {
    let riskScore = 0;
    
    // Audit status risk
    switch (strategy.auditStatus) {
      case 'audited':
        riskScore += 10;
        break;
      case 'partial':
        riskScore += 30;
        break;
      case 'unaudited':
      default:
        riskScore += 60;
        break;
    }
    
    // Lock period risk
    if (strategy.lockDays === 0) {
      riskScore += 5;
    } else if (strategy.lockDays < 7) {
      riskScore += 15;
    } else if (strategy.lockDays < 28) {
      riskScore += 30;
    } else {
      riskScore += 50;
    }
    
    // TVL risk
    const tvl = strategy.tvlUsd || 0;
    if (tvl > 100_000_000) {
      riskScore += 5;
    } else if (tvl > 10_000_000) {
      riskScore += 15;
    } else if (tvl > 1_000_000) {
      riskScore += 30;
    } else {
      riskScore += 60;
    }
    
    return Math.min(riskScore / 3, 100); // Average and cap at 100
  }

  /**
   * Generate risk warnings based on risk score and factors
   */
  private generateRiskWarnings(riskScore: number, riskFactors: string[]): string[] {
    const warnings: string[] = [];
    
    if (riskScore > 70) {
      warnings.push('⚠️ HIGH RISK: This strategy carries significant risk. Only invest what you can afford to lose.');
    } else if (riskScore > 40) {
      warnings.push('⚠️ MEDIUM RISK: This strategy has moderate risk. Consider your risk tolerance carefully.');
    }
    
    if (riskFactors.some((f: string) => f.toLowerCase().includes('audit'))) {
      warnings.push('🔍 Smart contract audit status may affect security level.');
    }
    
    if (riskFactors.some((f: string) => f.toLowerCase().includes('lock'))) {
      warnings.push('🔒 Funds will be locked and cannot be withdrawn early.');
    }
    
    if (riskFactors.some((f: string) => f.toLowerCase().includes('liquidity'))) {
      warnings.push('💧 Liquidity conditions may affect your ability to exit positions.');
    }
    
    return warnings;
  }

  /**
   * Create a hash for caching purposes
   */
  private createQueryHash(...inputs: string[]): string {
    const combined = inputs.join('|');
    return createHash('sha256').update(combined).digest('hex').substring(0, 16);
  }

  /**
   * Store risk preferences from conversations
   */
  async storeRiskPreferences(userId: string, riskTolerance: string, context: string): Promise<boolean> {
    const content = `User prefers ${riskTolerance} risk tolerance. Context: ${context}`;
    return await this.addMemory(userId, content, {
      type: 'risk_preference',
      riskTolerance,
      category: 'preferences',
    });
  }

  private buildSuccessMessage(action?: string, amount?: string, asset?: string, count?: number): string {
    const n = count ?? 0;
    const a = amount ?? '';
    const tok = asset ?? '';
    switch (action) {
      case 'swap':
        return `Here is the best route to swap ${a} ${tok} on Polkadot Hub.`;
      case 'bridge':
        return `Found ${n} bridge route${n !== 1 ? 's' : ''} to transfer ${a} ${tok} cross-chain.`;
      case 'transfer':
        return `Ready to transfer ${a} ${tok} on Polkadot Hub.`;
      case 'stake':
        return `Found ${n} staking option${n !== 1 ? 's' : ''} for ${a} ${tok}.`;
      case 'lend':
        return `Found ${n} lending option${n !== 1 ? 's' : ''} for ${a} ${tok}.`;
      default:
        return `Found ${n} yield strateg${n !== 1 ? 'ies' : 'y'} for ${a} ${tok}.`;
    }
  }

  /**
   * Store asset preferences and protocol usage
   */
  async storeAssetPreferences(userId: string, asset: string, protocol: string, action: string): Promise<boolean> {
    const content = `User used ${protocol} for ${action} with ${asset}`;
    return await this.addMemory(userId, content, {
      type: 'asset_preference',
      asset,
      protocol,
      action,
      category: 'usage_history',
    });
  }

  /**
   * Store position tracking information
   */
  async storePositionTracking(userId: string, intentId: string, strategy: any): Promise<boolean> {
    const content = `User opened position ${intentId} using ${strategy.protocol} on ${strategy.chain} for ${strategy.estimatedApyBps / 100}% APY`;
    return await this.addMemory(userId, content, {
      type: 'position_tracking',
      intentId,
      protocol: strategy.protocol,
      chain: strategy.chain,
      apyBps: strategy.estimatedApyBps,
      category: 'positions',
    });
  }

  /**
   * Store execution outcomes in memory
   */
  async storeExecutionOutcome(userId: string, intentId: string, outcome: 'success' | 'failed', details: string): Promise<boolean> {
    const content = `Execution ${intentId} ${outcome}. Details: ${details}`;
    return await this.addMemory(userId, content, {
      type: 'execution_outcome',
      intentId,
      outcome,
      category: 'execution_history',
    });
  }

  /**
   * Handle Mem0 API failures gracefully - wrapper for all memory operations
   */
  private async safeMemoryOperation<T>(operation: () => Promise<T>, fallbackValue: T, operationName: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.warn(`Mem0 ${operationName} failed, continuing without memory:`, error);
      return fallbackValue;
    }
  }

  /**
   * Enhanced addMemory with graceful failure handling
   */
  async addMemory(userId: string, content: string, metadata: Record<string, any> = {}): Promise<boolean> {
    return await this.safeMemoryOperation(
      async () => {
        if (!this.mem0Client) {
          this.logger.warn('Mem0 client not available, skipping memory storage');
          return false;
        }

        await this.mem0Client.add({
          messages: [{ role: 'user', content }],
          user_id: userId.toLowerCase(),
          agent_id: 'nexus-ai-v1',
          metadata: {
            ...metadata,
            timestamp: Date.now(),
            source: 'chat',
          },
        });
        
        this.logger.debug(`Added memory for user ${userId}`);
        return true;
      },
      false,
      'addMemory'
    );
  }

  /**
   * Enhanced searchMemories with graceful failure handling
   */
  async searchMemories(userId: string, query: string, limit: number = 5): Promise<any[]> {
    return await this.safeMemoryOperation(
      async () => {
        if (!this.mem0Client) {
          this.logger.warn('Mem0 client not available, returning empty memories');
          return [];
        }

        const response = await this.mem0Client.search({
          query,
          user_id: userId.toLowerCase(),
          agent_id: 'nexus-ai-v1',
          limit,
        });
        
        this.logger.debug(`Retrieved ${response.length} memories for user ${userId}`);
        return response || [];
      },
      [],
      'searchMemories'
    );
  }

  /**
   * Get all memories for a user
   */
  async getAllMemories(userId: string): Promise<any[]> {
    if (!this.mem0Client) {
      this.logger.warn('Mem0 client not available, returning empty memories');
      return [];
    }

    try {
      const response = await this.mem0Client.getAll({
        user_id: userId.toLowerCase(),
        agent_id: 'nexus-ai-v1',
      });
      
      return response || [];
    } catch (error) {
      this.logger.error('Failed to get all memories from Mem0:', error);
      return [];
    }
  }

  /**
   * Delete a specific memory
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    if (!this.mem0Client) {
      this.logger.warn('Mem0 client not available, cannot delete memory');
      return false;
    }

    try {
      await this.mem0Client.delete(memoryId);
      this.logger.debug(`Deleted memory ${memoryId}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to delete memory from Mem0:', error);
      return false;
    }
  }

  /**
   * Clear cached responses for a user (useful for testing or user request)
   */
  async clearUserCache(userId: string): Promise<number> {
    const patterns = [
      `deepseek:query:*`,
      `memory:${userId.toLowerCase()}*`,
    ];
    
    let totalCleared = 0;
    for (const pattern of patterns) {
      const cleared = await this.cacheService.clearPattern(pattern);
      totalCleared += cleared;
    }
    
    this.logger.log(`Cleared ${totalCleared} cache entries for user ${userId}`);
    return totalCleared;
  }
}