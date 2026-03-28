// ════════════════════════════════════════════════════════════════
// Cashout Service — Manual cashout processing
// Validates that the crash has not yet occurred, then delegates
// to the round engine for payout computation.
// ════════════════════════════════════════════════════════════════

import { Module, Injectable, Inject, Logger } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { IWalletService, WsCashoutPayload } from '../common/interfaces';
import { RoundPhase, BetStatus, ErrorCode } from '../common/enums';
import { RoundEngine } from '../rounds/round-engine.service';
import { AuditService } from '../audit/audit.module';
import { RoundsModule } from '../rounds/rounds.module';
import { AuditModule } from '../audit/audit.module';
import { WalletModule } from '../wallet/wallet.module';

export interface CashoutResult {
  success: boolean;
  multiplier?: number;
  payout?: number;
  newBalance?: number;
  error?: { code: ErrorCode; message: string };
}

@Injectable()
export class CashoutService {
  private readonly logger = new Logger(CashoutService.name);

  constructor(
    private roundEngine: RoundEngine,
    private audit: AuditService,
    @Inject('WALLET_SERVICE') private wallet: IWalletService,
  ) {}

  /**
   * Process a manual cashout request.
   *
   * Critical flow:
   * 1. Validate round is RUNNING
   * 2. Validate player has an ACTIVE bet
   * 3. Compute current multiplier at SERVER receive time (not client time)
   * 4. Check multiplier < crash point (server-authoritative)
   * 5. Compute payout, cap at max_win
   * 6. Credit wallet (settle payout)
   * 7. Update bet status
   *
   * The client_timestamp in the payload is logged for audit but NOT used
   * for cashout timing. The SERVER receive time is authoritative.
   */
  async processCashout(
    roomId: string,
    playerId: string,
    payload: WsCashoutPayload,
  ): Promise<CashoutResult> {
    const serverReceiveTime = Date.now();

    const state = this.roundEngine.getRoundState(roomId);

    // 1. Phase check
    if (!state || state.round.phase !== RoundPhase.RUNNING) {
      return {
        success: false,
        error: { code: ErrorCode.INVALID_PHASE, message: 'Round is not running' },
      };
    }

    // 2. Bet check
    const bet = this.roundEngine.getPlayerBet(roomId, playerId);
    if (!bet) {
      return {
        success: false,
        error: { code: ErrorCode.NO_ACTIVE_BET, message: 'No active bet found' },
      };
    }
    if (bet.status === BetStatus.CASHED_OUT) {
      return {
        success: false,
        error: { code: ErrorCode.ALREADY_CASHED_OUT, message: 'Already cashed out' },
      };
    }
    if (bet.status !== BetStatus.ACTIVE) {
      return {
        success: false,
        error: { code: ErrorCode.NO_ACTIVE_BET, message: 'Bet is not active' },
      };
    }

    // 3. Log cashout request for audit
    const currentMultiplier = this.roundEngine.getCurrentMultiplier(roomId);
    this.audit.cashoutRequested(
      bet.betId,
      payload.clientTimestamp,
      serverReceiveTime,
      currentMultiplier,
    );

    // 4. Execute cashout via round engine (checks crash point)
    const result = this.roundEngine.executeCashout(roomId, playerId);

    if (!result.success) {
      // Crash happened before cashout — the critical race condition
      const marginMs = state.round.crashedAt
        ? serverReceiveTime - state.round.crashedAt
        : 0;

      this.audit.cashoutDenied(
        bet.betId,
        state.round.crashPoint,
        payload.clientTimestamp,
        marginMs,
      );

      return {
        success: false,
        error: {
          code: ErrorCode.CRASH_BEFORE_CASHOUT,
          message: `Crash at ${state.round.crashPoint}x occurred before cashout`,
        },
      };
    }

    // 5. Credit wallet
    const walletStart = Date.now();
    const txId = uuidv7();

    try {
      const walletResult = await this.wallet.settlePayout(
        playerId,
        result.payout!,
        bet.walletTxLockId!,
        txId,
      );

      bet.walletTxSettleId = walletResult.txSettleId;

      this.audit.cashoutAccepted(
        bet.betId,
        result.multiplier!,
        result.payout!,
        walletResult.txSettleId,
        Date.now() - walletStart,
      );

      return {
        success: true,
        multiplier: result.multiplier,
        payout: result.payout,
        newBalance: walletResult.newBalance,
      };
    } catch (err: any) {
      // Wallet failure AFTER cashout was logically accepted
      // The bet is already marked CASHED_OUT in the round engine.
      // Queue for retry. The player sees the win; wallet catches up.
      this.logger.error(`Wallet settle failed for ${playerId}: ${err.message}. Queuing retry.`);

      // TODO: Production — add to retry queue
      return {
        success: true, // Player sees the win
        multiplier: result.multiplier,
        payout: result.payout,
        newBalance: undefined, // Balance unknown until wallet settles
      };
    }
  }
}

@Module({
  imports: [RoundsModule, AuditModule, WalletModule],
  providers: [CashoutService],
  exports: [CashoutService],
})
export class CashoutModule {}
