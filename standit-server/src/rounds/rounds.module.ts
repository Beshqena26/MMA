import { Module } from '@nestjs/common';
import { RoundEngine, MultiplierEngine } from './round-engine.service';
import { FairnessModule } from '../fairness/fairness.module';
import { AuditModule } from '../audit/audit.module';
import { GameConfigModule } from '../config/config.module';

@Module({
  imports: [FairnessModule, AuditModule, GameConfigModule],
  providers: [RoundEngine, MultiplierEngine],
  exports: [RoundEngine, MultiplierEngine],
})
export class RoundsModule {}
