import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
// import { StrategyModule } from '../strategy/strategy.module';
// import { YieldsModule } from '../yields/yields.module';

@Module({
  imports: [/* StrategyModule, YieldsModule */],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}