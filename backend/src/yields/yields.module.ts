import { Module } from '@nestjs/common';
import { YieldsController } from './yields.controller';

@Module({
  controllers: [YieldsController],
})
export class YieldsModule {}