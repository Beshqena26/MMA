// ════════════════════════════════════════════════════════════════
// STANDIT — Core Interfaces
// Domain contracts that define the shape of data across modules.
// No implementation details — only structure.
// ════════════════════════════════════════════════════════════════

import { RoundPhase, BetStatus, RoomStatus } from '../enums';

// ─── Room Configuration (Operator-Controlled) ───────────────

export interface IRoomConfig {
  minBet: number;
  maxBet: number;
  maxWin: number;
  houseEdge: number;             // e.g., 0.01 = 1%
  speedConstant: number;         // Multiplier curve speed (e.g., 0.00006)
  bettingWindowMs: number;       // Betting phase duration
  idleBetweenRoundsMs: number;   // Pause after settlement
  autoCashoutEnabled: boolean;
  autoCashoutMin: number;        // Minimum auto-cashout multiplier
  autoCashoutMax: number;
  maxPlayersPerRound: number;
  multiplierTickRateMs: number;  // Broadcast interval
}

// ─── Room ────────────────────────────────────────────────────

export interface IRoom {
  roomId: string;
  name: string;
  status: RoomStatus;
  config: IRoomConfig;
  currentRoundId: string | null;
  playerCount: number;
}

// ─── Round ───────────────────────────────────────────────────

export interface IRound {
  roundId: string;
  roomId: string;
  sequenceNumber: number;
  phase: RoundPhase;
  serverSeed: string;
  serverSeedHash: string;
  nonce: number;
  crashPoint: number;
  speedConstant: number;
  houseEdge: number;
  cosmeticSeed: number;
  bettingOpenedAt: number | null; // Unix ms
  startedAt: number | null;
  crashedAt: number | null;
  settledAt: number | null;
  totalBets: number;
  totalWagered: number;
  totalPaidOut: number;
  houseProfit: number;
}

// ─── Bet ─────────────────────────────────────────────────────

export interface IBet {
  betId: string;
  roundId: string;
  playerId: string;
  amount: number;
  currency: string;
  autoCashoutAt: number | null;
  status: BetStatus;
  cashoutMultiplier: number | null;
  payout: number | null;
  cashoutRequestedAt: number | null;
  cashoutProcessedAt: number | null;
  walletTxLockId: string | null;
  walletTxSettleId: string | null;
  placedAt: number;
  settledAt: number | null;
}

// ─── Player Session ──────────────────────────────────────────

export interface IPlayerSession {
  sessionId: string;
  playerId: string;
  roomId: string;
  connectedAt: number;
  lastHeartbeat: number;
  timeOffsetMs: number;
  activeBetId: string | null;
}

// ─── Wallet Service Interface ────────────────────────────────

export interface IWalletService {
  getBalance(playerId: string): Promise<number>;
  lockFunds(playerId: string, amount: number, txId: string): Promise<{ txLockId: string }>;
  settlePayout(playerId: string, amount: number, txLockId: string, txId: string): Promise<{ txSettleId: string; newBalance: number }>;
  consumeLock(playerId: string, txLockId: string, txId: string): Promise<{ txSettleId: string; newBalance: number }>;
}

// ─── Fairness Service Interface ──────────────────────────────

export interface IFairnessService {
  generateSeed(): string;
  hashSeed(seed: string): string;
  computeCrashPoint(seed: string, houseEdge: number): number;
  verifyCrashPoint(serverSeed: string, seedHash: string, houseEdge: number): { valid: boolean; crashPoint: number };
  generateCosmeticSeed(): number;
}

// ─── Audit Service Interface ─────────────────────────────────

export interface IAuditRecord {
  roundId: string;
  roomId: string;
  sequenceNumber: number;
  serverSeed: string;
  serverSeedHash: string;
  nonce: number;
  houseEdge: number;
  crashPoint: number;
  speedConstant: number;
  bettingOpenedAt: number | null;
  startedAt: number | null;
  crashedAt: number | null;
  settledAt: number | null;
  bets: IAuditBetRecord[];
  totals: {
    totalBets: number;
    totalWagered: number;
    totalPaid: number;
    houseProfit: number;
  };
  configSnapshot: IRoomConfig;
}

export interface IAuditBetRecord {
  betId: string;
  playerId: string;
  amount: number;
  autoCashoutAt: number | null;
  status: BetStatus;
  cashoutMultiplier: number | null;
  payout: number;
  cashoutRequestedAt: number | null;
  cashoutProcessedAt: number | null;
  walletTxLockId: string | null;
  walletTxSettleId: string | null;
}

// ─── WebSocket Payload Interfaces ────────────────────────────

export interface WsPlaceBetPayload {
  amount: number;
  autoCashoutAt?: number | null;
  requestId: string;
}

export interface WsCashoutPayload {
  betId: string;
  clientTimestamp: number;
}

export interface WsJoinRoomPayload {
  roomId: string;
  token: string;
}

export interface WsTimeSyncPayload {
  clientTimestamp: number;
  requestId: string;
}

// ─── Multiplier Computation ──────────────────────────────────

export interface IMultiplierEngine {
  /** Compute multiplier at elapsed milliseconds from round start */
  getMultiplier(elapsedMs: number, speedConstant: number): number;
  /** Compute elapsed ms required to reach a given multiplier */
  getElapsedForMultiplier(multiplier: number, speedConstant: number): number;
}
