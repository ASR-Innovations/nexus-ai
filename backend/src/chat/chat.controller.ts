import { Controller, Post, Body, UseGuards, Get, Param, Delete, UseInterceptors } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { WalletAuthGuard } from '../shared/guards/wallet-auth.guard';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './chat.dto';
import { DeepSeekCacheInterceptor } from '../shared/interceptors/cache.interceptor';
import { randomUUID } from 'crypto';

@Controller('chat')
@SkipThrottle() // Disable rate limiting for chat endpoints in development
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
  ) {}

  @Post('message')
  @UseInterceptors(DeepSeekCacheInterceptor)
  @UseGuards(WalletAuthGuard)
  async sendMessage(@Body() chatMessageDto: ChatMessageDto) {
    const conversationId = chatMessageDto.conversationId || randomUUID();

    try {
      const parseResult = await this.chatService.processMessage(
        chatMessageDto.message,
        chatMessageDto.userId
      );

      if (parseResult.success && parseResult.intentParams && parseResult.confidence >= 60) {
        return {
          success: true,
          message: parseResult.message || `I understand you want to ${parseResult.intentParams.action} ${parseResult.intentParams.amount} ${parseResult.intentParams.asset}. Let me find the best strategies for you.`,
          intentParams: parseResult.intentParams,
          strategies: parseResult.strategies || [],
          confidence: parseResult.confidence,
          conversationId,
        };
      }

      return {
        success: parseResult.success,
        message: parseResult.clarificationQuestion || parseResult.message || 'Could you provide more details about what you want to do?',
        confidence: parseResult.confidence,
        clarificationQuestion: parseResult.clarificationQuestion,
        conversationId,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to process message. Please try again.',
        error: 'Failed to process message',
        confidence: 0,
        conversationId,
      };
    }
  }

  @Get('memory/:userId')
  // @Throttle({ default: { limit: 20, ttl: 60000 } }) // REMOVED: Rate limiting disabled
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
  // @Throttle({ default: { limit: 10, ttl: 60000 } }) // REMOVED: Rate limiting disabled
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
  // @Throttle({ default: { limit: 5, ttl: 60000 } }) // REMOVED: Rate limiting disabled
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