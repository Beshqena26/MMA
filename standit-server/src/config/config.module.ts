// ════════════════════════════════════════════════════════════════
// Config Module — Operator-tunable settings
// Loaded from environment + database. Hot-reloadable between rounds.
// ════════════════════════════════════════════════════════════════

import { Module, Injectable } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { IRoomConfig } from '../common/interfaces';

/** Default room configuration — sensible production defaults */
export const DEFAULT_ROOM_CONFIG: IRoomConfig = {
  minBet: 0.10,
  maxBet: 1000.00,
  maxWin: 50000.00,
  houseEdge: 0.01,
  speedConstant: 0.00006,
  bettingWindowMs: 4000,
  idleBetweenRoundsMs: 2000,
  autoCashoutEnabled: false,
  autoCashoutMin: 1.01,
  autoCashoutMax: 1000.00,
  maxPlayersPerRound: 500,
  multiplierTickRateMs: 100,
};

@Injectable()
export class GameConfigService {
  private roomConfigs: Map<string, IRoomConfig> = new Map();

  constructor(private configService: ConfigService) {}

  /** Get config for a room, falling back to defaults */
  getRoomConfig(roomId: string): IRoomConfig {
    return this.roomConfigs.get(roomId) ?? { ...DEFAULT_ROOM_CONFIG };
  }

  /** Update room config (applied at next round). Returns validated config. */
  updateRoomConfig(roomId: string, partial: Partial<IRoomConfig>): IRoomConfig {
    const current = this.getRoomConfig(roomId);
    const updated = { ...current, ...partial };
    this.validateConfig(updated);
    this.roomConfigs.set(roomId, updated);
    return updated;
  }

  /** Validate config ranges. Throws on invalid values. */
  private validateConfig(config: IRoomConfig): void {
    if (config.minBet <= 0) throw new Error('minBet must be positive');
    if (config.maxBet <= config.minBet) throw new Error('maxBet must exceed minBet');
    if (config.maxWin < config.maxBet * 2) throw new Error('maxWin must be >= maxBet * 2');
    if (config.houseEdge < 0.005 || config.houseEdge > 0.05) throw new Error('houseEdge must be 0.005–0.05');
    if (config.speedConstant < 0.00003 || config.speedConstant > 0.00012) throw new Error('speedConstant out of range');
    if (config.bettingWindowMs < 2000 || config.bettingWindowMs > 10000) throw new Error('bettingWindowMs out of range');
    if (config.multiplierTickRateMs < 50 || config.multiplierTickRateMs > 200) throw new Error('tickRate out of range');
  }

  /** Server-level config from environment */
  getServerPort(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  getDatabaseUrl(): string {
    return this.configService.get<string>('DATABASE_URL', 'postgres://localhost:5432/standit');
  }
}

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  providers: [GameConfigService],
  exports: [GameConfigService],
})
export class GameConfigModule {}
