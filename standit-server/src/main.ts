// ════════════════════════════════════════════════════════════════
// STANDIT — Server Entry Point
// ════════════════════════════════════════════════════════════════

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const port = process.env.PORT ?? 3000;

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // Use raw WebSocket adapter (not Socket.IO) for binary protocol support
  app.useWebSocketAdapter(new WsAdapter(app));

  // CORS for frontend dev server
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  await app.listen(port);
  logger.log(`STANDIT game server listening on port ${port}`);
  logger.log(`Health check: http://localhost:${port}/health`);
  logger.log(`WebSocket:    ws://localhost:${port}/ws`);
  logger.log(`Rooms API:    http://localhost:${port}/api/v1/rooms`);
  logger.log(`Fairness:     http://localhost:${port}/api/v1/fairness/algorithm`);
}

bootstrap();
