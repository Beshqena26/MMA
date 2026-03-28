import { Module } from '@nestjs/common';
import { RoomsController, RoundsController, FairnessController, AdminController } from './rooms.controller';
import { RoundsModule } from '../rounds/rounds.module';
import { FairnessModule } from '../fairness/fairness.module';
import { GameConfigModule } from '../config/config.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [RoundsModule, FairnessModule, GameConfigModule, AuditModule],
  controllers: [RoomsController, RoundsController, FairnessController, AdminController],
})
export class RoomsModule {}
