export interface BlockInfo {
  block_number: number;
  block_hash: string;
  timestamp: number;
  indexed_at: number;
}

export interface EventLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}