// ════════════════════════════════════════════════════════════════
// Wallet Module — Fund management abstraction
// MVP: In-memory mock wallet. Production: swap to real wallet gRPC client.
// Every operation is idempotent via txId.
// ════════════════════════════════════════════════════════════════

import { Module, Injectable, Logger } from '@nestjs/common';
import { IWalletService } from '../common/interfaces';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class MockWalletService implements IWalletService {
  private readonly logger = new Logger(MockWalletService.name);

  /** In-memory balances. Production: replaced by wallet service calls. */
  private balances: Map<string, number> = new Map();

  /** Track processed txIds for idempotency */
  private processedTxIds: Set<string> = new Set();

  /** Initialize a player with a default balance (mock only) */
  initPlayer(playerId: string, balance: number = 1000.00): void {
    if (!this.balances.has(playerId)) {
      this.balances.set(playerId, balance);
    }
  }

  async getBalance(playerId: string): Promise<number> {
    this.initPlayer(playerId);
    return this.balances.get(playerId) ?? 0;
  }

  /**
   * Lock (reserve) funds for a bet.
   * Deducts from available balance. Funds are held until settle or consume.
   */
  async lockFunds(
    playerId: string,
    amount: number,
    txId: string,
  ): Promise<{ txLockId: string }> {
    // Idempotency: if already processed, return success
    if (this.processedTxIds.has(txId)) {
      return { txLockId: `lock_${txId}` };
    }

    this.initPlayer(playerId);
    const balance = this.balances.get(playerId)!;

    if (balance < amount) {
      throw new Error(`Insufficient balance: ${balance} < ${amount}`);
    }

    this.balances.set(playerId, balance - amount);
    this.processedTxIds.add(txId);

    const txLockId = `lock_${txId}`;
    this.logger.debug(`Locked ${amount} for ${playerId}. New balance: ${balance - amount}`);
    return { txLockId };
  }

  /**
   * Settle a winning bet: release the lock and credit the payout.
   * The payout amount includes the original bet (player gets bet + profit).
   */
  async settlePayout(
    playerId: string,
    payoutAmount: number,
    txLockId: string,
    txId: string,
  ): Promise<{ txSettleId: string; newBalance: number }> {
    if (this.processedTxIds.has(txId)) {
      return { txSettleId: `settle_${txId}`, newBalance: this.balances.get(playerId) ?? 0 };
    }

    this.initPlayer(playerId);
    const balance = this.balances.get(playerId)!;
    const newBalance = Math.round((balance + payoutAmount) * 100) / 100;
    this.balances.set(playerId, newBalance);
    this.processedTxIds.add(txId);

    this.logger.debug(`Settled payout ${payoutAmount} for ${playerId}. New balance: ${newBalance}`);
    return { txSettleId: `settle_${txId}`, newBalance };
  }

  /**
   * Consume a lock for a busted bet: the locked funds are forfeited.
   * No balance change (funds were already deducted during lock).
   */
  async consumeLock(
    playerId: string,
    txLockId: string,
    txId: string,
  ): Promise<{ txSettleId: string; newBalance: number }> {
    if (this.processedTxIds.has(txId)) {
      return { txSettleId: `consume_${txId}`, newBalance: this.balances.get(playerId) ?? 0 };
    }

    this.processedTxIds.add(txId);
    const newBalance = this.balances.get(playerId) ?? 0;

    this.logger.debug(`Consumed lock ${txLockId} for ${playerId}. Balance unchanged: ${newBalance}`);
    return { txSettleId: `consume_${txId}`, newBalance };
  }
}

@Module({
  providers: [
    {
      provide: 'WALLET_SERVICE',
      useClass: MockWalletService,
    },
  ],
  exports: ['WALLET_SERVICE'],
})
export class WalletModule {}
