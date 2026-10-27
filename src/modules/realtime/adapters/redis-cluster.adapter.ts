import { Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { RedisClientType } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

export function createRealtimeClusterAdapter(
  createClient: () => Promise<RedisClientType>,
  logger: Logger,
): (server: Server) => Promise<() => Promise<void>> {
  return async (server: Server): Promise<() => Promise<void>> => {
    const pubClient = await createClient();
    const subClient = pubClient.duplicate();

    await Promise.all([
      pubClient.connect().catch((error: unknown) => {
        throw new Error(`realtime pub client failed to connect: ${describe(error)}`);
      }),
      subClient.connect().catch((error: unknown) => {
        throw new Error(`realtime sub client failed to connect: ${describe(error)}`);
      }),
    ]);

    server.adapter(createAdapter(pubClient, subClient));
    logger.log('Realtime cluster adapter attached (Redis pub/sub)');

    return async (): Promise<void> => {
      await Promise.allSettled([pubClient.quit(), subClient.quit()]);
    };
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
