// ════════════════════════════════════════════════════════════════
// Round Engine — Core Game Loop
// Manages the round state machine: IDLE → BETTING → RUNNING → CRASHED → SETTLING → SETTLED
// This is the heart of STANDIT. All game-critical logic lives here.
// The round engine has NO knowledge of visuals or animations.
// ════════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { IRound, IRoomConfig, IMultiplierEngine } from '../common/interfaces';
import { RoundPhase, BetStatus } from '../common/enums';
import { FairnessService } from '../fairness/fairness.module';
import { AuditService } from '../audit/audit.module';
import { GameConfigService } from '../config/config.module';

// ─── Multiplier Engine ─────────────────────────────────────────

@Injectable()
export class MultiplierEngine implements IMultiplierEngine {
  /**
   * multiplier(t) = e^(speed × t)
   * where t is milliseconds elapsed, speed is the speed constant.
   * Result is floored to 2 decimal places.
   */
  getMultiplier(elapsedMs: number, speedConstant: number): number {
    const raw = Math.exp(speedConstant * elapsedMs);
    return Math.floor(raw * 100) / 100;
  }

  /**
   * Inverse: compute elapsed ms for a target multiplier.
   * Used to determine when the crash should fire.
   */
  getElapsedForMultiplier(multiplier: number, speedConstant: number): number {
    return Math.log(multiplier) / speedConstant;
  }
}

// ─── Round State Container ──────────────────────────────────────

export interface RoundState {
  round: IRound;
  config: IRoomConfig;
  bets: Map<string, import('../common/interfaces').IBet>; // playerId → Bet
  tickInterval: ReturnType<typeof setInterval> | null;
  crashTimeout: ReturnType<typeof setTimeout> | null;
}

// ─── Round Engine Service ───────────────────────────────────────

@Injectable()
export class RoundEngine {
  private readonly logger = new Logger(RoundEngine.name);

  /** Active round states per room */
  private activeRounds: Map<string, RoundState> = new Map();

  /** Sequence counters per room */
  private sequenceCounters: Map<string, number> = new Map();

  /** Callbacks for event broadcasting (set by the gateway) */
  private onBettingOpen?: (roomId: string, round: IRound) => void;
  private onRoundStart?: (roomId: string, round: IRound) => void;
  private onMultiplierTick?: (roomId: string, multiplier: number, serverTime: number) => void;
  private onRoundCrashed?: (roomId: string, round: IRound) => void;
  private onRoundSettled?: (roomId: string, round: IRound) => void;

  constructor(
    private fairness: FairnessService,
    private audit: AuditService,
    private configService: GameConfigService,
    private multiplierEngine: MultiplierEngine,
  ) {}

  // ─── Event Registration ──────────────────────────────────────

  registerCallbacks(callbacks: {
    onBettingOpen: (roomId: string, round: IRound) => void;
    onRoundStart: (roomId: string, round: IRound) => void;
    onMultiplierTick: (roomId: string, multiplier: number, serverTime: number) => void;
    onRoundCrashed: (roomId: string, round: IRound) => void;
    onRoundSettled: (roomId: string, round: IRound) => void;
  }): void {
    this.onBettingOpen = callbacks.onBettingOpen;
    this.onRoundStart = callbacks.onRoundStart;
    this.onMultiplierTick = callbacks.onMultiplierTick;
    this.onRoundCrashed = callbacks.onRoundCrashed;
    this.onRoundSettled = callbacks.onRoundSettled;
  }

  // ─── Round Lifecycle ─────────────────────────────────────────

  /**
   * Start a new round cycle for a room.
   * Creates the round, opens betting, and schedules the round start.
   */
  startNewRound(roomId: string): IRound {
    const config = this.configService.getRoomConfig(roomId);

    // Generate seeds and crash point
    const serverSeed = this.fairness.generateSeed();
    const serverSeedHash = this.fairness.hashSeed(serverSeed);
    const crashPoint = this.fairness.computeCrashPoint(serverSeed, config.houseEdge);
    const cosmeticSeed = this.fairness.generateCosmeticSeed();

    // Increment sequence
    const seq = (this.sequenceCounters.get(roomId) ?? 0) + 1;
    this.sequenceCounters.set(roomId, seq);

    const round: IRound = {
      roundId: uuidv7(),
      roomId,
      sequenceNumber: seq,
      phase: RoundPhase.BETTING,
      serverSeed,
      serverSeedHash,
      nonce: seq,
      crashPoint,
      speedConstant: config.speedConstant,
      houseEdge: config.houseEdge,
      cosmeticSeed,
      bettingOpenedAt: Date.now(),
      startedAt: null,
      crashedAt: null,
      settledAt: null,
      totalBets: 0,
      totalWagered: 0,
      totalPaidOut: 0,
      houseProfit: 0,
    };

    const state: RoundState = {
      round,
      config,
      bets: new Map(),
      tickInterval: null,
      crashTimeout: null,
    };

    this.activeRounds.set(roomId, state);
    this.audit.roundCreated(round);
    this.audit.roundBettingOpened(round.roundId, config.bettingWindowMs);

    // Notify: betting is open
    this.onBettingOpen?.(roomId, round);

    // Schedule: close betting and start the round
    setTimeout(() => this.closeAndStart(roomId), config.bettingWindowMs);

    this.logger.log(`Round ${seq} created for room ${roomId}. Crash: ${crashPoint}x (hidden)`);
    return round;
  }

  /**
   * Close betting window and start the multiplier.
   */
  private closeAndStart(roomId: string): void {
    const state = this.activeRounds.get(roomId);
    if (!state || state.round.phase !== RoundPhase.BETTING) return;

    const { round, config } = state;
    round.phase = RoundPhase.RUNNING;
    round.startedAt = Date.now();

    // Activate all placed bets
    for (const bet of state.bets.values()) {
      if (bet.status === BetStatus.PLACED) {
        bet.status = BetStatus.ACTIVE;
      }
    }

    round.totalBets = state.bets.size;
    round.totalWagered = Array.from(state.bets.values()).reduce((sum, b) => sum + b.amount, 0);

    this.audit.roundStarted(round.roundId, round.totalBets, round.totalWagered, state.bets.size);
    this.onRoundStart?.(roomId, round);

    // Start multiplier tick broadcast
    state.tickInterval = setInterval(() => {
      this.broadcastTick(roomId);
    }, config.multiplierTickRateMs);

    // Schedule crash
    const crashElapsedMs = this.multiplierEngine.getElapsedForMultiplier(
      round.crashPoint,
      round.speedConstant,
    );

    state.crashTimeout = setTimeout(() => {
      this.crashRound(roomId);
    }, crashElapsedMs);

    this.logger.log(`Round ${round.sequenceNumber} started. Crash in ${Math.round(crashElapsedMs)}ms at ${round.crashPoint}x`);
  }

  /**
   * Broadcast the current multiplier to all clients.
   */
  private broadcastTick(roomId: string): void {
    const state = this.activeRounds.get(roomId);
    if (!state || state.round.phase !== RoundPhase.RUNNING || !state.round.startedAt) return;

    const elapsed = Date.now() - state.round.startedAt;
    const multiplier = this.multiplierEngine.getMultiplier(elapsed, state.round.speedConstant);

    // Check for auto-cashouts
    this.processAutoCashouts(roomId, multiplier);

    this.onMultiplierTick?.(roomId, multiplier, Date.now());
  }

  /**
   * Process auto-cashout bets that have reached their target multiplier.
   */
  private processAutoCashouts(roomId: string, currentMultiplier: number): void {
    const state = this.activeRounds.get(roomId);
    if (!state) return;

    for (const bet of state.bets.values()) {
      if (
        bet.status === BetStatus.ACTIVE &&
        bet.autoCashoutAt !== null &&
        currentMultiplier >= bet.autoCashoutAt
      ) {
        // Auto-cashout triggered (zero latency, server-side)
        this.executeCashout(roomId, bet.playerId, bet.autoCashoutAt);
      }
    }
  }

  /**
   * Crash the round. This is the authoritative end of the round.
   */
  private crashRound(roomId: string): void {
    const state = this.activeRounds.get(roomId);
    if (!state || state.round.phase !== RoundPhase.RUNNING) return;

    const { round } = state;
    round.phase = RoundPhase.CRASHED;
    round.crashedAt = Date.now();

    // Stop tick broadcast
    if (state.tickInterval) clearInterval(state.tickInterval);
    state.tickInterval = null;
    if (state.crashTimeout) clearTimeout(state.crashTimeout);
    state.crashTimeout = null;

    // Mark all remaining active bets as BUSTED
    for (const bet of state.bets.values()) {
      if (bet.status === BetStatus.ACTIVE) {
        bet.status = BetStatus.BUSTED;
        bet.payout = 0;
        bet.settledAt = Date.now();
      }
    }

    this.audit.roundCrashed(round);
    this.onRoundCrashed?.(roomId, round);

    // Begin settlement
    this.settleRound(roomId);
  }

  /**
   * Settle all bets and compute final totals.
   */
  private async settleRound(roomId: string): Promise<void> {
    const state = this.activeRounds.get(roomId);
    if (!state) return;

    const { round, config } = state;
    round.phase = RoundPhase.SETTLING;

    // Calculate totals
    let totalPaidOut = 0;
    for (const bet of state.bets.values()) {
      totalPaidOut += bet.payout ?? 0;
      this.audit.betSettled(bet);
    }

    round.totalPaidOut = Math.round(totalPaidOut * 100) / 100;
    round.houseProfit = Math.round((round.totalWagered - round.totalPaidOut) * 100) / 100;
    round.settledAt = Date.now();
    round.phase = RoundPhase.SETTLED;

    this.audit.roundSettled(round);
    this.onRoundSettled?.(roomId, round);

    this.logger.log(
      `Round ${round.sequenceNumber} settled. Wagered: ${round.totalWagered}, ` +
      `Paid: ${round.totalPaidOut}, Profit: ${round.houseProfit}`,
    );

    // Schedule next round after idle period
    setTimeout(() => {
      this.startNewRound(roomId);
    }, config.idleBetweenRoundsMs);
  }

  // ─── Public Accessors ──────────────────────────────────────────

  /** Get the current round state for a room */
  getRoundState(roomId: string): RoundState | undefined {
    return this.activeRounds.get(roomId);
  }

  /** Get current multiplier for a running round */
  getCurrentMultiplier(roomId: string): number {
    const state = this.activeRounds.get(roomId);
    if (!state || !state.round.startedAt || state.round.phase !== RoundPhase.RUNNING) return 1.00;
    const elapsed = Date.now() - state.round.startedAt;
    return this.multiplierEngine.getMultiplier(elapsed, state.round.speedConstant);
  }

  /** Register a bet in the current round (called by BetService) */
  addBet(roomId: string, bet: import('../common/interfaces').IBet): void {
    const state = this.activeRounds.get(roomId);
    if (!state) throw new Error('No active round');
    state.bets.set(bet.playerId, bet);
  }

  /** Get a player's bet in the current round */
  getPlayerBet(roomId: string, playerId: string): import('../common/interfaces').IBet | undefined {
    return this.activeRounds.get(roomId)?.bets.get(playerId);
  }

  /**
   * Execute a cashout for a player. Returns success or failure.
   * Called by CashoutService (manual) or processAutoCashouts (auto).
   */
  executeCashout(roomId: string, playerId: string, atMultiplier?: number): {
    success: boolean;
    multiplier?: number;
    payout?: number;
    error?: string;
  } {
    const state = this.activeRounds.get(roomId);
    if (!state || state.round.phase !== RoundPhase.RUNNING) {
      return { success: false, error: 'Round not running' };
    }

    const bet = state.bets.get(playerId);
    if (!bet || bet.status !== BetStatus.ACTIVE) {
      return { success: false, error: 'No active bet' };
    }

    // Determine cashout multiplier
    const multiplier = atMultiplier ?? this.getCurrentMultiplier(roomId);

    // Check: has the crash already happened?
    if (multiplier >= state.round.crashPoint) {
      return { success: false, error: 'Crash occurred before cashout' };
    }

    // Compute payout
    let payout = Math.round(bet.amount * multiplier * 100) / 100;

    // Cap at max_win
    if (payout > state.config.maxWin) {
      payout = state.config.maxWin;
    }

    // Update bet
    bet.status = BetStatus.CASHED_OUT;
    bet.cashoutMultiplier = multiplier;
    bet.payout = payout;
    bet.cashoutProcessedAt = Date.now();
    bet.settledAt = Date.now();

    this.logger.log(`Player ${playerId} cashed out at ${multiplier}x for ${payout}`);

    return { success: true, multiplier, payout };
  }

  /** Clean up a room's round state (for shutdown) */
  cleanup(roomId: string): void {
    const state = this.activeRounds.get(roomId);
    if (state) {
      if (state.tickInterval) clearInterval(state.tickInterval);
      if (state.crashTimeout) clearTimeout(state.crashTimeout);
      this.activeRounds.delete(roomId);
    }
  }
}
