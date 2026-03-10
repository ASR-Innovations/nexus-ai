import { Module } from '@nestjs/common';
import { MemoryController } from './memory.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [MemoryController],
})
export class MemoryModule {}