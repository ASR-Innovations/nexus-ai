import { Injectable, OnModuleInit } from '@nestjs/common';
import { ContractService } from './contract.service';

/**
 * @deprecated Use ContractService instead. This provider is kept for backward compatibility.
 */
@Injectable()
export class ContractProvider implements OnModuleInit {
  constructor(private contractService: ContractService) {}

  async onModuleInit() {
    await this.contractService.onModuleInit();
  }

  getProvider() {
    return this.contractService.getProvider();
  }

  getIntentVaultContract() {
    return this.contractService.getIntentVaultContract();
  }

  getAgentRegistryContract() {
    return this.contractService.getAgentRegistryContract();
  }

  getExecutionManagerContract() {
    return this.contractService.getExecutionManagerContract();
  }

  async getCurrentBlock(): Promise<number> {
    return this.contractService.getCurrentBlock();
  }

  async getGasPrice(): Promise<bigint> {
    return this.contractService.getGasPrice();
  }
}