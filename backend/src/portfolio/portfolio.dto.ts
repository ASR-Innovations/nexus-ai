import { IsString, IsEthereumAddress } from 'class-validator';

export class GetPortfolioParamsDto {
  @IsString()
  @IsEthereumAddress()
  address!: string;
}

export interface Portfolio {
  totalValueUsd: number;
  balances: Balance[];
  yieldPositions: YieldPosition[];
  lastUpdated: number;
  isStale: boolean;
}

export interface Balance {
  asset: string;
  chain: string;
  amount: string;
  valueUsd: number;
}

export interface YieldPosition {
  intentId: number;
  protocol: string;
  chain: string;
  asset: string;
  depositedAmount: string;
  currentValue: string;
  apyBps: number;
  accruedValue: string;
  startedAt: number;
}