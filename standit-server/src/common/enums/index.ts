// ════════════════════════════════════════════════════════════════
// STANDIT — Core Enums
// All game-wide enumerations in one place
// ════════════════════════════════════════════════════════════════

export enum RoundPhase {
  IDLE = 'IDLE',
  BETTING = 'BETTING',
  RUNNING = 'RUNNING',
  CRASHED = 'CRASHED',
  SETTLING = 'SETTLING',
  SETTLED = 'SETTLED',
}

export enum BetStatus {
  PLACED = 'PLACED',       // Bet accepted, funds locked, waiting for round start
  ACTIVE = 'ACTIVE',       // Round is running, bet is live
  CASHED_OUT = 'CASHED_OUT', // Player cashed out before crash
  BUSTED = 'BUSTED',       // Round crashed before cashout
  CANCELLED = 'CANCELLED', // Bet cancelled (edge case: round aborted)
}

export enum RoomStatus {
  OPEN = 'OPEN',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED',
  MAINTENANCE = 'MAINTENANCE',
}

/** WebSocket server → client event types */
export enum ServerEvent {
  ROOM_STATE = 'room:state',
  ROUND_BETTING_OPEN = 'round:betting_open',
  BET_ACCEPTED = 'bet:accepted',
  BET_REJECTED = 'bet:rejected',
  ROUND_START = 'round:start',
  MULTIPLIER_TICK = 'round:tick',
  CASHOUT_ACCEPTED = 'cashout:accepted',
  CASHOUT_DENIED = 'cashout:denied',
  ROUND_CRASHED = 'round:crashed',
  ROUND_RESULT = 'round:result',
  LIVE_BET = 'live:bet',
  LIVE_CASHOUT = 'live:cashout',
  TIME_SYNC_RESPONSE = 'time:sync_response',
  ERROR = 'error',
}

/** WebSocket client → server event types */
export enum ClientEvent {
  JOIN_ROOM = 'room:join',
  PLACE_BET = 'bet:place',
  CASHOUT = 'cashout:request',
  TIME_SYNC_REQUEST = 'time:sync_request',
  HEARTBEAT = 'heartbeat',
  LEAVE_ROOM = 'room:leave',
}

/** Standardized error codes */
export enum ErrorCode {
  INVALID_PHASE = 1001,
  INSUFFICIENT_BALANCE = 1002,
  BET_BELOW_MIN = 1003,
  BET_ABOVE_MAX = 1004,
  DUPLICATE_BET = 1005,
  ROUND_FULL = 1006,
  CRASH_BEFORE_CASHOUT = 1007,
  NO_ACTIVE_BET = 1008,
  ALREADY_CASHED_OUT = 1009,
  PAYOUT_EXCEEDS_MAX = 1010,
  WALLET_UNAVAILABLE = 1011,
  AUTH_EXPIRED = 1012,
  ROOM_NOT_FOUND = 1013,
  RATE_LIMITED = 1014,
  INTERNAL_ERROR = 1015,
}
