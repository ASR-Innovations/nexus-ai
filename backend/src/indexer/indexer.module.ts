import { Module } from '@nestjs/common';
import { IndexerService } from './indexer.service';
import { SharedModule } from '../shared/shared.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [SharedModule, WebsocketModule],
  providers: [IndexerService],
  exports: [IndexerService],
})
export class IndexerModule {}