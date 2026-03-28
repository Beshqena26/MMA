// ════════════════════════════════════════════════════════════════
// WebSocket Gateway — Real-time game communication
// Handles client connections, event routing, and broadcasts.
// This is the bridge between the game engine and the browser.
// ════════════════════════════════════════════════════════════════

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { v7 as uuidv7 } from 'uuid';
import {
  ServerEvent, ClientEvent, ErrorCode, RoundPhase,
} from '../common/enums';
import {
  IRound, IPlayerSession,
  WsPlaceBetPayload, WsCashoutPayload, WsJoinRoomPayload, WsTimeSyncPayload,
} from '../common/interfaces';
import { RoundEngine } from '../rounds/round-engine.service';
import { BetService } from '../bets/bet.service';
import { CashoutService } from '../cashout/cashout.service';
import { AuditService } from '../audit/audit.module';

/** Extended WebSocket with session metadata */
interface GameSocket extends WebSocket {
  sessionId: string;
  playerId: string;
  roomId: string;
  _connectedAt?: number;
  _lastHeartbeat?: number;
}

@WebSocketGateway({ path: '/ws' })
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  /** Active sessions: sessionId → GameSocket */
  private sessions: Map<string, GameSocket> = new Map();

  /** Room membership: roomId → Set<sessionId> */
  private rooms: Map<string, Set<string>> = new Map();

  /** Player lookup: playerId → sessionId */
  private playerSessions: Map<string, string> = new Map();

  constructor(
    private roundEngine: RoundEngine,
    private betService: BetService,
    private cashoutService: CashoutService,
    private audit: AuditService,
  ) {}

  // ─── Lifecycle ──────────────────────────────────────────────

  onModuleInit(): void {
    // Register round engine callbacks for broadcasting
    this.roundEngine.registerCallbacks({
      onBettingOpen: (roomId, round) => this.broadcastBettingOpen(roomId, round),
      onRoundStart: (roomId, round) => this.broadcastRoundStart(roomId, round),
      onMultiplierTick: (roomId, multiplier, serverTime) =>
        this.broadcastToRoom(roomId, ServerEvent.MULTIPLIER_TICK, { multiplier, serverTime }),
      onRoundCrashed: (roomId, round) => this.broadcastRoundCrashed(roomId, round),
      onRoundSettled: (roomId, round) => this.broadcastRoundResults(roomId, round),
    });
  }

  afterInit(): void {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: WebSocket): void {
    this.logger.debug('New WebSocket connection');
  }

  handleDisconnect(client: WebSocket): void {
    const socket = client as GameSocket;
    if (socket.sessionId) {
      this.sessions.delete(socket.sessionId);
      this.playerSessions.delete(socket.playerId);

      // Remove from room
      const roomMembers = this.rooms.get(socket.roomId);
      if (roomMembers) {
        roomMembers.delete(socket.sessionId);
      }

      const duration = socket._connectedAt
        ? (Date.now() - socket._connectedAt) / 1000
        : 0;
      const bet = this.roundEngine.getPlayerBet(socket.roomId, socket.playerId);

      this.audit.playerDisconnected(
        socket.playerId,
        socket.sessionId,
        Math.round(duration),
        bet?.status === 'ACTIVE',
      );

      this.logger.log(`Player ${socket.playerId} disconnected from ${socket.roomId}`);
    }
  }

  // ─── Client Events ──────────────────────────────────────────

  @SubscribeMessage(ClientEvent.JOIN_ROOM)
  async handleJoinRoom(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() payload: WsJoinRoomPayload,
  ): Promise<void> {
    const socket = client as GameSocket;

    // TODO: Validate JWT token from payload.token
    // For MVP: extract player ID from token (mock: use token as ID)
    const playerId = payload.token; // Production: JWT decode

    // Setup session
    socket.sessionId = uuidv7();
    socket.playerId = playerId;
    socket.roomId = payload.roomId;
    socket._connectedAt = Date.now();

    // Handle reconnect: if player already has a session, take it over
    const existingSessionId = this.playerSessions.get(playerId);
    if (existingSessionId) {
      const oldSocket = this.sessions.get(existingSessionId);
      if (oldSocket) {
        this.sessions.delete(existingSessionId);
        try { oldSocket.close(); } catch {}
      }
    }

    // Register session
    this.sessions.set(socket.sessionId, socket);
    this.playerSessions.set(playerId, socket.sessionId);

    // Join room
    if (!this.rooms.has(payload.roomId)) {
      this.rooms.set(payload.roomId, new Set());
    }
    this.rooms.get(payload.roomId)!.add(socket.sessionId);

    this.audit.playerConnected(playerId, socket.sessionId, '0.0.0.0');

    // Send full room state snapshot
    this.sendRoomState(socket);

    this.logger.log(`Player ${playerId} joined room ${payload.roomId}`);
  }

  @SubscribeMessage(ClientEvent.PLACE_BET)
  async handlePlaceBet(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() payload: WsPlaceBetPayload,
  ): Promise<void> {
    const socket = client as GameSocket;
    const result = await this.betService.placeBet(
      socket.roomId,
      socket.playerId,
      payload,
    );

    if (result.success && result.bet) {
      // Confirm to player
      this.send(socket, ServerEvent.BET_ACCEPTED, {
        betId: result.bet.betId,
        amount: result.bet.amount,
        requestId: payload.requestId,
      });

      // Broadcast to room
      this.broadcastToRoom(socket.roomId, ServerEvent.LIVE_BET, {
        playerName: socket.playerId.slice(0, 8), // Truncated for privacy
        amount: result.bet.amount,
      });
    } else {
      this.send(socket, ServerEvent.BET_REJECTED, {
        code: result.error!.code,
        message: result.error!.message,
        requestId: payload.requestId,
      });
    }
  }

  @SubscribeMessage(ClientEvent.CASHOUT)
  async handleCashout(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() payload: WsCashoutPayload,
  ): Promise<void> {
    const socket = client as GameSocket;
    const result = await this.cashoutService.processCashout(
      socket.roomId,
      socket.playerId,
      payload,
    );

    if (result.success) {
      // Confirm to player
      this.send(socket, ServerEvent.CASHOUT_ACCEPTED, {
        betId: payload.betId,
        cashoutMultiplier: result.multiplier,
        payout: result.payout,
        newBalance: result.newBalance,
      });

      // Broadcast to room
      this.broadcastToRoom(socket.roomId, ServerEvent.LIVE_CASHOUT, {
        playerName: socket.playerId.slice(0, 8),
        multiplier: result.multiplier,
        payout: result.payout,
      });
    } else {
      this.send(socket, ServerEvent.CASHOUT_DENIED, {
        betId: payload.betId,
        code: result.error!.code,
        message: result.error!.message,
      });
    }
  }

  @SubscribeMessage(ClientEvent.TIME_SYNC_REQUEST)
  handleTimeSync(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() payload: WsTimeSyncPayload,
  ): void {
    this.send(client as GameSocket, ServerEvent.TIME_SYNC_RESPONSE, {
      clientTimestamp: payload.clientTimestamp,
      serverTimestamp: Date.now(),
      requestId: payload.requestId,
    });
  }

  @SubscribeMessage(ClientEvent.HEARTBEAT)
  handleHeartbeat(@ConnectedSocket() client: WebSocket): void {
    // Update last heartbeat timestamp
    const socket = client as GameSocket;
    if (socket.sessionId) {
      socket._lastHeartbeat = Date.now();
    }
  }

  // ─── Broadcast Helpers ──────────────────────────────────────

  private broadcastBettingOpen(roomId: string, round: IRound): void {
    this.broadcastToRoom(roomId, ServerEvent.ROUND_BETTING_OPEN, {
      roundId: round.roundId,
      sequenceNumber: round.sequenceNumber,
      serverSeedHash: round.serverSeedHash,
      cosmeticSeed: round.cosmeticSeed,
      bettingWindowMs: round.bettingOpenedAt
        ? this.roundEngine.getRoundState(roomId)?.config.bettingWindowMs
        : 4000,
    });
  }

  private broadcastRoundStart(roomId: string, round: IRound): void {
    this.broadcastToRoom(roomId, ServerEvent.ROUND_START, {
      roundId: round.roundId,
      startedAt: round.startedAt,
      totalBets: round.totalBets,
      totalWagered: round.totalWagered,
    });
  }

  private broadcastRoundCrashed(roomId: string, round: IRound): void {
    this.broadcastToRoom(roomId, ServerEvent.ROUND_CRASHED, {
      roundId: round.roundId,
      crashPoint: round.crashPoint,
      crashedAt: round.crashedAt,
      serverSeed: round.serverSeed,        // REVEALED after crash
      serverSeedHash: round.serverSeedHash,
    });
  }

  private broadcastRoundResults(roomId: string, round: IRound): void {
    const state = this.roundEngine.getRoundState(roomId);
    if (!state) return;

    // Send personalized results to each player
    for (const [playerId, bet] of state.bets) {
      const sessionId = this.playerSessions.get(playerId);
      if (!sessionId) continue;
      const socket = this.sessions.get(sessionId);
      if (!socket) continue;

      this.send(socket, ServerEvent.ROUND_RESULT, {
        roundId: round.roundId,
        betId: bet.betId,
        outcome: bet.status === 'CASHED_OUT' ? 'WON' : 'BUSTED',
        betAmount: bet.amount,
        cashoutMultiplier: bet.cashoutMultiplier,
        payout: bet.payout ?? 0,
        profit: (bet.payout ?? 0) - bet.amount,
      });
    }
  }

  /** Send the full room state snapshot (used on connect and reconnect) */
  private sendRoomState(socket: GameSocket): void {
    const state = this.roundEngine.getRoundState(socket.roomId);
    const bet = state?.bets.get(socket.playerId);

    this.send(socket, ServerEvent.ROOM_STATE, {
      roomId: socket.roomId,
      currentRound: state ? {
        roundId: state.round.roundId,
        sequenceNumber: state.round.sequenceNumber,
        phase: state.round.phase,
        serverSeedHash: state.round.serverSeedHash,
        cosmeticSeed: state.round.cosmeticSeed,
        startedAt: state.round.startedAt,
        currentMultiplier: state.round.phase === RoundPhase.RUNNING
          ? this.roundEngine.getCurrentMultiplier(socket.roomId)
          : null,
        totalBets: state.round.totalBets,
        totalWagered: state.round.totalWagered,
      } : null,
      playerBet: bet ? {
        betId: bet.betId,
        amount: bet.amount,
        status: bet.status,
        cashoutMultiplier: bet.cashoutMultiplier,
        payout: bet.payout,
      } : null,
      config: {
        minBet: state?.config.minBet,
        maxBet: state?.config.maxBet,
        bettingWindowMs: state?.config.bettingWindowMs,
        autoCashoutEnabled: state?.config.autoCashoutEnabled,
      },
      serverTime: Date.now(),
    });
  }

  // ─── Transport ──────────────────────────────────────────────

  /** Send a typed event to a single client */
  private send(socket: GameSocket, event: ServerEvent, data: Record<string, unknown>): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ event, data }));
      // Production: use MessagePack binary encoding
    }
  }

  /** Broadcast a typed event to all clients in a room */
  private broadcastToRoom(roomId: string, event: ServerEvent, data: Record<string, unknown>): void {
    const members = this.rooms.get(roomId);
    if (!members) return;

    const message = JSON.stringify({ event, data });
    // Production: pre-encode once with MessagePack, send binary to all

    for (const sessionId of members) {
      const socket = this.sessions.get(sessionId);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }

  /** Get the number of connected players in a room */
  getRoomPlayerCount(roomId: string): number {
    return this.rooms.get(roomId)?.size ?? 0;
  }
}
