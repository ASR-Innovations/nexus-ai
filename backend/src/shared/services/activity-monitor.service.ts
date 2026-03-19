/**
 * Activity Monitoring Service
 * Detects suspicious activity patterns and automatically freezes operations
 */

import { Injectable, Logger } from '@nestjs/common';

export interface ActivityEvent {
  id: string;
  address: string;
  type: 'transfer' | 'bridge' | 'swap' | 'stake' | 'execution';
  amount?: string;
  timestamp: Date;
  metadata?: any;
}

export interface SuspiciousPattern {
  type: 'high_frequency' | 'large_amount' | 'unusual_destination' | 'rapid_succession' | 'blacklisted';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  threshold?: number;
  actual?: number;
}

export interface ActivityAnalysis {
  suspicious: boolean;
  patterns: SuspiciousPattern[];
  riskScore: number;
  recommendation: 'allow' | 'review' | 'freeze';
}

export interface FrozenAccount {
  address: string;
  reason: string;
  frozenAt: Date;
  frozenBy: string;
  patterns: SuspiciousPattern[];
}

@Injectable()
export class ActivityMonitorService {
  private readonly logger = new Logger(ActivityMonitorService.name);

  // Activity tracking
  private activityHistory: Map<string, ActivityEvent[]> = new Map();
  
  // Frozen accounts
  private frozenAccounts: Map<string, FrozenAccount> = new Map();
  
  // Blacklisted addresses
  private blacklist: Set<string> = new Set();

  // Detection thresholds
  private readonly HIGH_FREQUENCY_THRESHOLD = 10; // transactions per minute
  private readonly LARGE_AMOUNT_THRESHOLD = BigInt('100000000000000000000'); // 100 tokens
  private readonly RAPID_SUCCESSION_WINDOW = 60000; // 1 minute
  private readonly MAX_RISK_SCORE = 100;

  // ============================================================================
  // Activity Recording
  // ============================================================================

  recordActivity(event: ActivityEvent): void {
    const address = event.address.toLowerCase();
    
    if (!this.activityHistory.has(address)) {
      this.activityHistory.set(address, []);
    }

    const history = this.activityHistory.get(address)!;
    history.push(event);

    // Keep only last 1000 events per address
    if (history.length > 1000) {
      history.shift();
    }

    this.logger.debug('Activity recorded', {
      address,
      type: event.type,
      amount: event.amount,
    });
  }

  // ============================================================================
  // Suspicious Activity Detection
  // ============================================================================

  analyzeActivity(address: string, newEvent?: ActivityEvent): ActivityAnalysis {
    const patterns: SuspiciousPattern[] = [];
    let riskScore = 0;

    // Check if account is blacklisted
    if (this.isBlacklisted(address)) {
      patterns.push({
        type: 'blacklisted',
        severity: 'critical',
        description: 'Address is on blacklist',
      });
      riskScore += 100;
    }

    // Get activity history
    const history = this.activityHistory.get(address.toLowerCase()) || [];

    // Check high frequency
    const highFrequency = this.detectHighFrequency(history);
    if (highFrequency) {
      patterns.push(highFrequency);
      riskScore += 30;
    }

    // Check large amounts
    if (newEvent?.amount) {
      const largeAmount = this.detectLargeAmount(newEvent.amount);
      if (largeAmount) {
        patterns.push(largeAmount);
        riskScore += 40;
      }
    }

    // Check rapid succession
    const rapidSuccession = this.detectRapidSuccession(history);
    if (rapidSuccession) {
      patterns.push(rapidSuccession);
      riskScore += 25;
    }

    // Check unusual destinations
    if (newEvent?.metadata?.destination) {
      const unusualDest = this.detectUnusualDestination(newEvent.metadata.destination);
      if (unusualDest) {
        patterns.push(unusualDest);
        riskScore += 20;
      }
    }

    // Determine recommendation
    let recommendation: 'allow' | 'review' | 'freeze' = 'allow';
    if (riskScore >= 80) {
      recommendation = 'freeze';
    } else if (riskScore >= 50) {
      recommendation = 'review';
    }

    return {
      suspicious: patterns.length > 0,
      patterns,
      riskScore: Math.min(riskScore, this.MAX_RISK_SCORE),
      recommendation,
    };
  }

  private detectHighFrequency(history: ActivityEvent[]): SuspiciousPattern | null {
    const oneMinuteAgo = Date.now() - 60000;
    const recentEvents = history.filter(e => e.timestamp.getTime() > oneMinuteAgo);

    if (recentEvents.length > this.HIGH_FREQUENCY_THRESHOLD) {
      return {
        type: 'high_frequency',
        severity: 'high',
        description: 'Unusually high transaction frequency detected',
        threshold: this.HIGH_FREQUENCY_THRESHOLD,
        actual: recentEvents.length,
      };
    }

    return null;
  }

  private detectLargeAmount(amount: string): SuspiciousPattern | null {
    const amountBigInt = BigInt(amount);

    if (amountBigInt > this.LARGE_AMOUNT_THRESHOLD) {
      return {
        type: 'large_amount',
        severity: 'high',
        description: 'Large transaction amount detected',
        threshold: Number(this.LARGE_AMOUNT_THRESHOLD),
        actual: Number(amountBigInt),
      };
    }

    return null;
  }

  private detectRapidSuccession(history: ActivityEvent[]): SuspiciousPattern | null {
    if (history.length < 3) {
      return null;
    }

    const recent = history.slice(-3);
    const timeSpan = recent[2].timestamp.getTime() - recent[0].timestamp.getTime();

    if (timeSpan < this.RAPID_SUCCESSION_WINDOW) {
      return {
        type: 'rapid_succession',
        severity: 'medium',
        description: 'Multiple transactions in rapid succession',
        threshold: this.RAPID_SUCCESSION_WINDOW,
        actual: timeSpan,
      };
    }

    return null;
  }

  private detectUnusualDestination(destination: string): SuspiciousPattern | null {
    // Check if destination is blacklisted
    if (this.isBlacklisted(destination)) {
      return {
        type: 'unusual_destination',
        severity: 'critical',
        description: 'Transaction to blacklisted address',
      };
    }

    return null;
  }

  // ============================================================================
  // Account Freezing
  // ============================================================================

  freezeAccount(address: string, reason: string, frozenBy: string, patterns: SuspiciousPattern[]): void {
    const frozen: FrozenAccount = {
      address: address.toLowerCase(),
      reason,
      frozenAt: new Date(),
      frozenBy,
      patterns,
    };

    this.frozenAccounts.set(address.toLowerCase(), frozen);

    this.logger.warn('Account frozen', {
      address,
      reason,
      frozenBy,
      patternCount: patterns.length,
    });
  }

  unfreezeAccount(address: string): void {
    this.frozenAccounts.delete(address.toLowerCase());
    this.logger.log('Account unfrozen', { address });
  }

  isFrozen(address: string): boolean {
    return this.frozenAccounts.has(address.toLowerCase());
  }

  getFrozenAccount(address: string): FrozenAccount | undefined {
    return this.frozenAccounts.get(address.toLowerCase());
  }

  listFrozenAccounts(): FrozenAccount[] {
    return Array.from(this.frozenAccounts.values());
  }

  // ============================================================================
  // Blacklist Management
  // ============================================================================

  addToBlacklist(address: string): void {
    this.blacklist.add(address.toLowerCase());
    this.logger.log('Address added to blacklist', { address });
  }

  removeFromBlacklist(address: string): void {
    this.blacklist.delete(address.toLowerCase());
    this.logger.log('Address removed from blacklist', { address });
  }

  isBlacklisted(address: string): boolean {
    return this.blacklist.has(address.toLowerCase());
  }

  getBlacklist(): string[] {
    return Array.from(this.blacklist);
  }

  // ============================================================================
  // Automatic Monitoring
  // ============================================================================

  async monitorAndFreeze(address: string, event: ActivityEvent): Promise<{
    allowed: boolean;
    frozen: boolean;
    analysis: ActivityAnalysis;
  }> {
    // Check if already frozen
    if (this.isFrozen(address)) {
      return {
        allowed: false,
        frozen: true,
        analysis: {
          suspicious: true,
          patterns: [],
          riskScore: 100,
          recommendation: 'freeze',
        },
      };
    }

    // Record the activity
    this.recordActivity(event);

    // Analyze for suspicious patterns
    const analysis = this.analyzeActivity(address, event);

    // Auto-freeze if recommendation is freeze
    if (analysis.recommendation === 'freeze') {
      this.freezeAccount(
        address,
        'Automatic freeze due to suspicious activity',
        'system',
        analysis.patterns
      );

      return {
        allowed: false,
        frozen: true,
        analysis,
      };
    }

    return {
      allowed: analysis.recommendation === 'allow',
      frozen: false,
      analysis,
    };
  }

  // ============================================================================
  // Activity History
  // ============================================================================

  getActivityHistory(address: string, limit?: number): ActivityEvent[] {
    const history = this.activityHistory.get(address.toLowerCase()) || [];
    
    if (limit) {
      return history.slice(-limit);
    }

    return history;
  }

  clearActivityHistory(address: string): void {
    this.activityHistory.delete(address.toLowerCase());
    this.logger.log('Activity history cleared', { address });
  }

  // ============================================================================
  // Statistics and Reporting
  // ============================================================================

  getStatistics(): {
    totalAddresses: number;
    totalEvents: number;
    frozenAccounts: number;
    blacklistedAddresses: number;
    suspiciousActivityCount: number;
  } {
    let totalEvents = 0;
    let suspiciousActivityCount = 0;

    for (const [address, history] of this.activityHistory.entries()) {
      totalEvents += history.length;

      const analysis = this.analyzeActivity(address);
      if (analysis.suspicious) {
        suspiciousActivityCount++;
      }
    }

    return {
      totalAddresses: this.activityHistory.size,
      totalEvents,
      frozenAccounts: this.frozenAccounts.size,
      blacklistedAddresses: this.blacklist.size,
      suspiciousActivityCount,
    };
  }

  getSuspiciousAddresses(): Array<{
    address: string;
    analysis: ActivityAnalysis;
  }> {
    const suspicious: Array<{ address: string; analysis: ActivityAnalysis }> = [];

    for (const [address] of this.activityHistory.entries()) {
      const analysis = this.analyzeActivity(address);
      if (analysis.suspicious) {
        suspicious.push({ address, analysis });
      }
    }

    return suspicious.sort((a, b) => b.analysis.riskScore - a.analysis.riskScore);
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  updateThresholds(config: {
    highFrequency?: number;
    largeAmount?: string;
    rapidSuccessionWindow?: number;
  }): void {
    if (config.highFrequency !== undefined) {
      (this as any).HIGH_FREQUENCY_THRESHOLD = config.highFrequency;
    }

    if (config.largeAmount !== undefined) {
      (this as any).LARGE_AMOUNT_THRESHOLD = BigInt(config.largeAmount);
    }

    if (config.rapidSuccessionWindow !== undefined) {
      (this as any).RAPID_SUCCESSION_WINDOW = config.rapidSuccessionWindow;
    }

    this.logger.log('Detection thresholds updated', config);
  }

  getThresholds(): {
    highFrequency: number;
    largeAmount: string;
    rapidSuccessionWindow: number;
  } {
    return {
      highFrequency: this.HIGH_FREQUENCY_THRESHOLD,
      largeAmount: this.LARGE_AMOUNT_THRESHOLD.toString(),
      rapidSuccessionWindow: this.RAPID_SUCCESSION_WINDOW,
    };
  }
}
