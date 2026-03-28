// ════════════════════════════════════════════════════════════════
// REST Controllers — Stateless HTTP endpoints
// Rooms, round history, fairness verification, admin config
// ════════════════════════════════════════════════════════════════

import { Controller, Get, Put, Post, Param, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { RoundEngine } from '../rounds/round-engine.service';
import { FairnessService } from '../fairness/fairness.module';
import { GameConfigService } from '../config/config.module';
import { AuditService } from '../audit/audit.module';
import { IRoomConfig } from '../common/interfaces';

// ─── Rooms Controller ─────────────────────────────────────────

@Controller('api/v1/rooms')
export class RoomsController {
  constructor(
    private roundEngine: RoundEngine,
    private configService: GameConfigService,
  ) {}

  @Get()
  listRooms() {
    // MVP: single room
    const config = this.configService.getRoomConfig('room_default');
    const state = this.roundEngine.getRoundState('room_default');
    return [{
      roomId: 'room_default',
      name: 'Main Arena',
      status: 'OPEN',
      playerCount: 0, // TODO: wire to gateway
      currentPhase: state?.round.phase ?? 'IDLE',
      config: {
        minBet: config.minBet,
        maxBet: config.maxBet,
      },
    }];
  }

  @Get(':roomId')
  getRoom(@Param('roomId') roomId: string) {
    const config = this.configService.getRoomConfig(roomId);
    const state = this.roundEngine.getRoundState(roomId);
    return {
      roomId,
      status: 'OPEN',
      config,
      currentRound: state ? {
        roundId: state.round.roundId,
        sequenceNumber: state.round.sequenceNumber,
        phase: state.round.phase,
      } : null,
    };
  }

  @Get(':roomId/history')
  getRoundHistory(
    @Param('roomId') roomId: string,
    @Query('limit') limit: string = '20',
  ) {
    // TODO: Query from database
    // MVP: return empty — history accumulates as rounds are played
    return {
      roomId,
      rounds: [],
      total: 0,
      limit: parseInt(limit),
    };
  }
}

// ─── Rounds Controller ────────────────────────────────────────

@Controller('api/v1/rounds')
export class RoundsController {
  constructor(private roundEngine: RoundEngine) {}

  @Get(':roundId')
  getRound(@Param('roundId') roundId: string) {
    // TODO: Query from database for completed rounds
    // For active round: check in-memory state
    return { roundId, message: 'Round lookup — implement with DB' };
  }

  @Get(':roundId/verify')
  verifyRound(@Param('roundId') roundId: string) {
    // TODO: Lookup seeds from database
    return { roundId, message: 'Verification — implement with DB' };
  }
}

// ─── Fairness Controller ──────────────────────────────────────

@Controller('api/v1/fairness')
export class FairnessController {
  constructor(private fairnessService: FairnessService) {}

  @Get('algorithm')
  getAlgorithm() {
    return {
      name: 'STANDIT Provably Fair',
      version: '1.0',
      algorithm: 'HMAC-SHA256',
      description: [
        '1. Server generates a random 32-byte seed before each round.',
        '2. SHA-256(server_seed) is published as a commitment before betting opens.',
        '3. HMAC-SHA256(server_seed, "standit") produces the hash for crash point derivation.',
        '4. First 13 hex characters of the HMAC are parsed as an integer.',
        '5. crash_point = max(1.00, floor(100 * E / (E - H)) / 100)',
        '   where E = parsed_int / 2^52, H = house_edge',
        '6. After the round, the server_seed is revealed.',
        '7. Anyone can verify: SHA-256(revealed_seed) === published_hash',
        '   AND compute the crash_point matches the actual result.',
      ],
      houseEdge: '1% (configurable per room)',
    };
  }

  @Post('verify')
  verifyResult(@Body() body: { serverSeed: string; seedHash: string; houseEdge: number }) {
    const result = this.fairnessService.verifyCrashPoint(
      body.serverSeed,
      body.seedHash,
      body.houseEdge,
    );
    return {
      hashValid: result.valid,
      computedCrashPoint: result.crashPoint,
      serverSeed: body.serverSeed,
      expectedHash: body.seedHash,
      computedHash: this.fairnessService.hashSeed(body.serverSeed),
    };
  }
}

// ─── Admin Controller ─────────────────────────────────────────

@Controller('api/v1/admin')
export class AdminController {
  constructor(
    private configService: GameConfigService,
    private audit: AuditService,
  ) {}

  // TODO: Add admin auth guard

  @Get('rooms')
  listRooms() {
    return [{
      roomId: 'room_default',
      config: this.configService.getRoomConfig('room_default'),
    }];
  }

  @Put('rooms/:roomId/config')
  updateConfig(
    @Param('roomId') roomId: string,
    @Body() body: Partial<IRoomConfig>,
  ) {
    try {
      const updated = this.configService.updateRoomConfig(roomId, body);
      this.audit.configUpdated(roomId, body as Record<string, unknown>, 'admin_api');
      return { roomId, config: updated, appliedAt: 'next_round' };
    } catch (err: any) {
      throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('rooms/:roomId/pause')
  pauseRoom(@Param('roomId') roomId: string) {
    // TODO: Implement room pause (stop new rounds after current completes)
    return { roomId, status: 'PAUSED' };
  }

  @Post('rooms/:roomId/resume')
  resumeRoom(@Param('roomId') roomId: string) {
    // TODO: Implement room resume
    return { roomId, status: 'OPEN' };
  }
}
