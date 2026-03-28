// ════════════════════════════════════════════════════════════════
// STANDIT — Root Application Module
// Wires all domain modules together. This is the composition root.
// ════════════════════════════════════════════════════════════════

import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { GameConfigModule, GameConfigService } from './config/config.module';
import { FairnessModule } from './fairness/fairness.module';
import { WalletModule } from './wallet/wallet.module';
import { AuditModule } from './audit/audit.module';
import { RoundsModule } from './rounds/rounds.module';
import { BetsModule } from './bets/bet.service';
import { CashoutModule } from './cashout/cashout.service';
import { GatewayModule } from './gateway/gateway.module';
import { RoomsModule } from './rooms/rooms.module';
import { HealthController } from './health/health.controller';
import { RoundEngine } from './rounds/round-engine.service';

@Module({
  imports: [
    GameConfigModule,
    FairnessModule,
    WalletModule,
    AuditModule,
    RoundsModule,
    BetsModule,
    CashoutModule,
    GatewayModule,
    RoomsModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(private roundEngine: RoundEngine) {}

  onModuleInit(): void {
    // Start the default room's round loop
    this.logger.log('Starting default room round loop...');
    setTimeout(() => {
      this.roundEngine.startNewRound('room_default');
      this.logger.log('STANDIT game server is running. First round started.');
    }, 1000); // Small delay to ensure gateway is ready
  }
}
