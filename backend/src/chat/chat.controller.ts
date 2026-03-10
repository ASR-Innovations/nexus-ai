import { Controller, Post, Body, UseGuards, Get, Param, Delete, UseInterceptors } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { WalletAuthGuard } from '../shared/guards/wallet-auth.guard';
import { ChatService } from './chat.service';
// import { YieldsService } from '../yields/yields.service';
// import { StrategyService } from '../strategy/strategy.service';
import { ChatMessageDto } from './chat.dto';
import { DeepSeekCacheInterceptor } from '../shared/interceptors/cache.interceptor';

@Controller('api/chat')
@UseGuards(ThrottlerGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    // private readonly yieldsService: YieldsService,
    // private readonly strategyService: StrategyService,
  ) {}

  @Post('message')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  @UseInterceptors(DeepSeekCacheInterceptor)
  @UseGuards(WalletAuthGuard)
  async sendMessage(@Body() chatMessageDto: ChatMessageDto) {
    try {
      // Process the message through ChatService which handles intent parsing
      const parseResult = await this.chatService.processMessage(
        chatMessageDto.message,
        chatMessageDto.userId
      );

      // If parsing was successful and we have intent params, compute strategies
      if (parseResult.success && parseResult.intentParams && parseResult.confidence >= 60) {
        // TODO: Re-enable when strategy service is fixed
        // const strategies = await this.strategyService.computeStrategies(parseResult.intentParams);
        // 
        // // Generate explanations for each strategy using ChatService
        // const strategiesWithExplanations = await Promise.all(
        //   strategies.map(async (strategy) => {
        //     const explanation = await this.chatService.explainStrategy(strategy);
        //     const riskAssessment = await this.chatService.assessRisk(strategy);
        //     
        //     return {
        //       ...strategy,
        //       explanation,
        //       riskAssessment,
        //     };
        //   })
        // );

        return {
          success: true,
          message: parseResult.message,
          intentParams: parseResult.intentParams,
          strategies: [], // Empty for now until strategy service is fixed
          confidence: parseResult.confidence,
          conversationId: parseResult.conversationId,
        };
      }

      // Return clarification question if confidence is low or parsing failed
      return {
        success: parseResult.success,
        confidence: parseResult.confidence,
        clarificationQuestion: parseResult.clarificationQuestion,
        conversationId: parseResult.conversationId,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to process message',
        confidence: 0,
      };
    }
  }

  @Get('memory/:userId')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  async getUserMemories(@Param('userId') userId: string) {
    try {
      const memories = await this.chatService.getAllMemories(userId);
      return {
        success: true,
        memories,
        count: memories.length,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve memories',
      };
    }
  }

  @Delete('memory/:memoryId')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @UseGuards(WalletAuthGuard)
  async deleteMemory(@Param('memoryId') memoryId: string) {
    try {
      const success = await this.chatService.deleteMemory(memoryId);
      return {
        success,
        message: success ? 'Memory deleted successfully' : 'Failed to delete memory',
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to delete memory',
      };
    }
  }

  @Delete('cache/:userId')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @UseGuards(WalletAuthGuard)
  async clearUserCache(@Param('userId') userId: string) {
    try {
      const clearedCount = await this.chatService.clearUserCache(userId);
      return {
        success: true,
        message: `Cleared ${clearedCount} cache entries`,
        clearedCount,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to clear cache',
      };
    }
  }
}