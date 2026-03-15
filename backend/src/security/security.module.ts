import { Module } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [SecurityController],
})
export class SecurityModule {}