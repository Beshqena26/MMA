// ════════════════════════════════════════════════════════════════
// Audit Module — Immutable structured event logging
// Every significant state change emits an audit event.
// MVP: logs to structured JSON. Production: append-only storage.
// ════════════════════════════════════════════════════════════════

import { Module, Injectable, Logger } from '@nestjs/common';
import { IAuditRecord, IBet, IRound, IRoomConfig } from '../common/interfaces';
import { BetStatus } from '../common/enums';

export interface AuditEvent {
  event: string;
  timestamp: number;
  data: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AUDIT');

  /** Emit a structured audit event */
  emit(event: string, data: Record<string, unknown>): void {
    const entry: AuditEvent = {
      event,
      timestamp: Date.now(),
      data,
    };
    // In production: write to append-only store (S3, Kafka, etc.)
    // MVP: structured log output (consumed by ELK/Datadog)
    this.logger.log(JSON.stringify(entry));
  }

  // ─── Convenience methods for common events ──────────────────

  roundCreated(round: IRound): void {
    this.emit('round.created', {
      roundId: round.roundId,
      roomId: round.roomId,
      sequenceNumber: round.sequenceNumber,
      serverSeedHash: round.serverSeedHash,
      crashPoint: '***REDACTED***', // Never log crash point before round ends
      cosmeticSeed: round.cosmeticSeed,
    });
  }

  roundBettingOpened(roundId: string, countdownMs: number): void {
    this.emit('round.betting_opened', { roundId, countdownMs });
  }

  betPlaced(bet: IBet): void {
    this.emit('bet.placed', {
      betId: bet.betId,
      roundId: bet.roundId,
      playerId: bet.playerId,
      amount: bet.amount,
      autoCashoutAt: bet.autoCashoutAt,
    });
  }

  betWalletLock(betId: string, txLockId: string, amount: number, latencyMs: number): void {
    this.emit('bet.wallet_lock', { betId, txLockId, amount, latencyMs });
  }

  roundStarted(roundId: string, totalBets: number, totalWagered: number, playerCount: number): void {
    this.emit('round.started', { roundId, totalBets, totalWagered, playerCount });
  }

  cashoutRequested(betId: string, clientTimestamp: number, serverTimestamp: number, currentMultiplier: number): void {
    this.emit('cashout.requested', { betId, clientTimestamp, serverTimestamp, currentMultiplier });
  }

  cashoutAccepted(betId: string, multiplier: number, payout: number, txSettleId: string, latencyMs: number): void {
    this.emit('cashout.accepted', { betId, multiplier, payout, txSettleId, latencyMs });
  }

  cashoutDenied(betId: string, crashPoint: number, clientTimestamp: number, marginMs: number): void {
    this.emit('cashout.denied', { betId, crashPoint, clientTimestamp, marginMs });
  }

  roundCrashed(round: IRound): void {
    this.emit('round.crashed', {
      roundId: round.roundId,
      crashPoint: round.crashPoint,
      elapsedMs: round.crashedAt && round.startedAt ? round.crashedAt - round.startedAt : 0,
      serverSeed: round.serverSeed,
    });
  }

  roundSettled(round: IRound): void {
    this.emit('round.settled', {
      roundId: round.roundId,
      totalWagered: round.totalWagered,
      totalPaidOut: round.totalPaidOut,
      houseProfit: round.houseProfit,
      settledAt: round.settledAt,
    });
  }

  betSettled(bet: IBet): void {
    this.emit('bet.settled', {
      betId: bet.betId,
      playerId: bet.playerId,
      outcome: bet.status,
      amount: bet.amount,
      payout: bet.payout ?? 0,
      cashoutMultiplier: bet.cashoutMultiplier,
    });
  }

  playerConnected(playerId: string, sessionId: string, ip: string): void {
    this.emit('player.connected', { playerId, sessionId, ip });
  }

  playerDisconnected(playerId: string, sessionId: string, durationS: number, hadActiveBet: boolean): void {
    this.emit('player.disconnected', { playerId, sessionId, durationS, hadActiveBet });
  }

  configUpdated(roomId: string, changes: Record<string, unknown>, adminUserId: string): void {
    this.emit('config.updated', { roomId, changes, adminUserId });
  }

  /** Build a full immutable audit record for a completed round */
  buildAuditRecord(round: IRound, bets: IBet[], config: IRoomConfig): IAuditRecord {
    return {
      roundId: round.roundId,
      roomId: round.roomId,
      sequenceNumber: round.sequenceNumber,
      serverSeed: round.serverSeed,
      serverSeedHash: round.serverSeedHash,
      nonce: round.nonce,
      houseEdge: round.houseEdge,
      crashPoint: round.crashPoint,
      speedConstant: round.speedConstant,
      bettingOpenedAt: round.bettingOpenedAt,
      startedAt: round.startedAt,
      crashedAt: round.crashedAt,
      settledAt: round.settledAt,
      bets: bets.map(b => ({
        betId: b.betId,
        playerId: b.playerId,
        amount: b.amount,
        autoCashoutAt: b.autoCashoutAt,
        status: b.status,
        cashoutMultiplier: b.cashoutMultiplier,
        payout: b.payout ?? 0,
        cashoutRequestedAt: b.cashoutRequestedAt,
        cashoutProcessedAt: b.cashoutProcessedAt,
        walletTxLockId: b.walletTxLockId,
        walletTxSettleId: b.walletTxSettleId,
      })),
      totals: {
        totalBets: round.totalBets,
        totalWagered: round.totalWagered,
        totalPaid: round.totalPaidOut,
        houseProfit: round.houseProfit,
      },
      configSnapshot: { ...config },
    };
  }
}

@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
