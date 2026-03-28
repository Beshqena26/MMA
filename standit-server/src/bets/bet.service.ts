// ════════════════════════════════════════════════════════════════
// Bet Service — Bet placement, validation, and wallet locking
// ════════════════════════════════════════════════════════════════

import { Module, Injectable, Inject, Logger } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { IBet, IWalletService, WsPlaceBetPayload } from '../common/interfaces';
import { RoundPhase, BetStatus, ErrorCode } from '../common/enums';
import { RoundEngine } from '../rounds/round-engine.service';
import { AuditService } from '../audit/audit.module';
import { RoundsModule } from '../rounds/rounds.module';
import { AuditModule } from '../audit/audit.module';
import { WalletModule } from '../wallet/wallet.module';

export interface BetResult {
  success: boolean;
  bet?: IBet;
  error?: { code: ErrorCode; message: string };
}

@Injectable()
export class BetService {
  private readonly logger = new Logger(BetService.name);

  constructor(
    private roundEngine: RoundEngine,
    private audit: AuditService,
    @Inject('WALLET_SERVICE') private wallet: IWalletService,
  ) {}

  /**
   * Place a bet for a player in the current round.
   *
   * Validation order:
   * 1. Round must be in BETTING phase
   * 2. Player must not already have a bet this round
   * 3. Amount must be within min/max range
   * 4. Round must not be full
   * 5. Wallet must have sufficient balance (lock funds)
   *
   * On success: creates Bet entity, locks funds, registers with round engine.
   */
  async placeBet(
    roomId: string,
    playerId: string,
    payload: WsPlaceBetPayload,
  ): Promise<BetResult> {
    const state = this.roundEngine.getRoundState(roomId);

    // 1. Phase check
    if (!state || state.round.phase !== RoundPhase.BETTING) {
      return {
        success: false,
        error: { code: ErrorCode.INVALID_PHASE, message: 'Betting window is not open' },
      };
    }

    // 2. Duplicate check
    const existingBet = this.roundEngine.getPlayerBet(roomId, playerId);
    if (existingBet) {
      return {
        success: false,
        error: { code: ErrorCode.DUPLICATE_BET, message: 'Already placed a bet this round' },
      };
    }

    // 3. Amount validation
    const { config } = state;
    if (payload.amount < config.minBet) {
      return {
        success: false,
        error: { code: ErrorCode.BET_BELOW_MIN, message: `Minimum bet is ${config.minBet}` },
      };
    }
    if (payload.amount > config.maxBet) {
      return {
        success: false,
        error: { code: ErrorCode.BET_ABOVE_MAX, message: `Maximum bet is ${config.maxBet}` },
      };
    }

    // 4. Capacity check
    if (state.bets.size >= config.maxPlayersPerRound) {
      return {
        success: false,
        error: { code: ErrorCode.ROUND_FULL, message: 'Round is full' },
      };
    }

    // 5. Auto-cashout validation
    let autoCashoutAt = payload.autoCashoutAt ?? null;
    if (autoCashoutAt !== null) {
      if (!config.autoCashoutEnabled) {
        autoCashoutAt = null; // Silently ignore if feature disabled
      } else if (autoCashoutAt < config.autoCashoutMin) {
        autoCashoutAt = config.autoCashoutMin;
      } else if (autoCashoutAt > config.autoCashoutMax) {
        autoCashoutAt = config.autoCashoutMax;
      }
    }

    // 6. Lock funds in wallet
    const txId = uuidv7();
    const lockStart = Date.now();
    let txLockId: string;

    try {
      const lockResult = await this.wallet.lockFunds(playerId, payload.amount, txId);
      txLockId = lockResult.txLockId;
    } catch (err: any) {
      this.logger.warn(`Wallet lock failed for ${playerId}: ${err.message}`);

      if (err.message?.includes('Insufficient')) {
        return {
          success: false,
          error: { code: ErrorCode.INSUFFICIENT_BALANCE, message: err.message },
        };
      }
      return {
        success: false,
        error: { code: ErrorCode.WALLET_UNAVAILABLE, message: 'Wallet service unavailable' },
      };
    }

    const lockLatency = Date.now() - lockStart;

    // 7. Create bet entity
    const bet: IBet = {
      betId: uuidv7(),
      roundId: state.round.roundId,
      playerId,
      amount: payload.amount,
      currency: 'USD',
      autoCashoutAt,
      status: BetStatus.PLACED,
      cashoutMultiplier: null,
      payout: null,
      cashoutRequestedAt: null,
      cashoutProcessedAt: null,
      walletTxLockId: txLockId,
      walletTxSettleId: null,
      placedAt: Date.now(),
      settledAt: null,
    };

    // 8. Register with round engine
    this.roundEngine.addBet(roomId, bet);

    // 9. Audit
    this.audit.betPlaced(bet);
    this.audit.betWalletLock(bet.betId, txLockId, payload.amount, lockLatency);

    this.logger.log(`Bet placed: ${playerId} bet ${payload.amount} on round ${state.round.sequenceNumber}`);
    return { success: true, bet };
  }
}

@Module({
  imports: [RoundsModule, AuditModule, WalletModule],
  providers: [BetService],
  exports: [BetService],
})
export class BetsModule {}
