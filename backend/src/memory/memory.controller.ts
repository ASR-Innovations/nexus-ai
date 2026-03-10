import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { WalletAuthGuard } from '../shared/guards/wallet-auth.guard';
import { ChatService } from '../chat/chat.service';

@Controller('api/memory')
@UseGuards(ThrottlerGuard)
export class MemoryController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':userId')
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

  @Delete(':memoryId')
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
}