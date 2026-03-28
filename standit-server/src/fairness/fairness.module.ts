// ════════════════════════════════════════════════════════════════
// Fairness Module — Provably Fair RNG
// Generates server seeds, computes crash points via HMAC-SHA256.
// This module is the ONLY place crash points are computed.
// The crash point NEVER leaves this module until the round ends.
// ════════════════════════════════════════════════════════════════

import { Module, Injectable } from '@nestjs/common';
import { createHmac, randomBytes, createHash } from 'crypto';
import { IFairnessService } from '../common/interfaces';

@Injectable()
export class FairnessService implements IFairnessService {
  /**
   * Generate a cryptographically secure random seed.
   * 32 bytes = 64 hex characters.
   */
  generateSeed(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Hash a seed with SHA-256. This hash is published BEFORE the round
   * as a commitment. After the round, the seed is revealed and anyone
   * can verify: SHA-256(revealed_seed) === published_hash.
   */
  hashSeed(seed: string): string {
    return createHash('sha256').update(seed).digest('hex');
  }

  /**
   * Compute the crash point from a server seed and house edge.
   *
   * Algorithm:
   * 1. HMAC-SHA256(seed, "standit") → 64 hex chars
   * 2. Take first 13 hex chars → parse as integer
   * 3. Derive crash point: max(1.00, floor(100 * E / (E - H)) / 100)
   *    where E = parsed_int / (2^52), H = house_edge
   *
   * This produces a distribution where:
   * - ~1% of rounds crash at 1.00x (instant crash)
   * - 50% crash before ~2.00x
   * - 10% survive past ~10.0x
   * - 1% survive past ~100.0x
   */
  computeCrashPoint(seed: string, houseEdge: number): number {
    const hmac = createHmac('sha256', seed).update('standit').digest('hex');

    // Take first 13 hex characters (52 bits of entropy)
    const hexSlice = hmac.slice(0, 13);
    const intValue = parseInt(hexSlice, 16);

    // E is a value in [0, 1)
    const E = intValue / Math.pow(2, 52);

    // Instant crash ~houseEdge% of the time
    if (E < houseEdge) {
      return 1.00;
    }

    // Crash point formula
    const crashPoint = Math.floor((100 * E) / (E - houseEdge)) / 100;

    // Safety: clamp to minimum 1.00
    return Math.max(1.00, crashPoint);
  }

  /**
   * Verify a crash point given the revealed seed and expected hash.
   * This is what the player's verification tool calls.
   */
  verifyCrashPoint(
    serverSeed: string,
    expectedHash: string,
    houseEdge: number,
  ): { valid: boolean; crashPoint: number } {
    const computedHash = this.hashSeed(serverSeed);
    const hashValid = computedHash === expectedHash;
    const crashPoint = this.computeCrashPoint(serverSeed, houseEdge);

    return {
      valid: hashValid,
      crashPoint,
    };
  }

  /**
   * Generate a cosmetic seed for client-side animation randomization.
   * This seed is independent of the game seed and has no gameplay effect.
   */
  generateCosmeticSeed(): number {
    return randomBytes(4).readUInt32BE(0);
  }
}

@Module({
  providers: [FairnessService],
  exports: [FairnessService],
})
export class FairnessModule {}
