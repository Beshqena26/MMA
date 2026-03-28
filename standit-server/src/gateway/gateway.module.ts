import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { RoundsModule } from '../rounds/rounds.module';
import { BetsModule } from '../bets/bet.service';
import { CashoutModule } from '../cashout/cashout.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [RoundsModule, BetsModule, CashoutModule, AuditModule],
  providers: [GameGateway],
  exports: [GameGateway],
})
export class GatewayModule {}
