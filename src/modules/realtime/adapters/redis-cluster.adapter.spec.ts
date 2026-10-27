import { describe, it, expect, beforeEach, afterEach, vi, type Mock, type MockInstance } from 'vitest';
import { Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { RedisClientType } from 'redis';
import { createRealtimeClusterAdapter } from './redis-cluster.adapter.js';

interface RedisClientFixture {
  client: RedisClientType;
  connect: Mock<() => Promise<void>>;
  duplicate: Mock<() => RedisClientType>;
  quit: Mock<() => Promise<void>>;
}

describe('createRealtimeClusterAdapter', () => {
  let pub: RedisClientFixture;
  let sub: RedisClientFixture;
  let createClient: Mock<() => Promise<RedisClientType>>;
  let server: Server;
  let loggerLogSpy: MockInstance;

  function createClientFixture(): RedisClientFixture {
    const connect = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const quit = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const duplicate = vi.fn<() => RedisClientType>();
    const client = { connect, duplicate, quit } as unknown as RedisClientType;
    return { client, connect, duplicate, quit };
  }

  beforeEach(() => {
    pub = createClientFixture();
    sub = createClientFixture();
    pub.duplicate.mockReturnValue(sub.client);
    createClient = vi.fn<() => Promise<RedisClientType>>().mockResolvedValue(pub.client);
    server = { adapter: vi.fn() } as unknown as Server;
    loggerLogSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects both clients, mounts the adapter and returns a disposer', async () => {
    const disposer = await createRealtimeClusterAdapter(
      createClient,
      new Logger('test'),
    )(server);

    expect(pub.connect).toHaveBeenCalledTimes(1);
    expect(sub.connect).toHaveBeenCalledTimes(1);
    expect(server.adapter).toHaveBeenCalledWith(expect.anything());
    expect(loggerLogSpy).toHaveBeenCalledWith(
      'Realtime cluster adapter attached (Redis pub/sub)',
    );
    expect(disposer).toEqual(expect.any(Function));
  });

  it('closes both clients through the returned disposer', async () => {
    const disposer = await createRealtimeClusterAdapter(
      createClient,
      new Logger('test'),
    )(server);

    await disposer();

    expect(pub.quit).toHaveBeenCalledTimes(1);
    expect(sub.quit).toHaveBeenCalledTimes(1);
  });

  it('swallows a failing quit so shutdown never rejects', async () => {
    const disposer = await createRealtimeClusterAdapter(
      createClient,
      new Logger('test'),
    )(server);
    pub.quit.mockRejectedValue(new Error('pub already closed'));

    await expect(disposer()).resolves.toBeUndefined();
    expect(sub.quit).toHaveBeenCalledTimes(1);
  });

  it('rejects with a descriptive error when the pub client cannot connect', async () => {
    pub.connect.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      createRealtimeClusterAdapter(createClient, new Logger('test'))(server),
    ).rejects.toThrow('realtime pub client failed to connect: ECONNREFUSED');
  });

  it('rejects with a descriptive error when the sub client cannot connect', async () => {
    sub.connect.mockRejectedValue(new Error('NOAUTH'));

    await expect(
      createRealtimeClusterAdapter(createClient, new Logger('test'))(server),
    ).rejects.toThrow('realtime sub client failed to connect: NOAUTH');
  });

  it('describes a non-Error connect failure by string conversion', async () => {
    pub.connect.mockRejectedValue('raw connect failure');

    await expect(
      createRealtimeClusterAdapter(createClient, new Logger('test'))(server),
    ).rejects.toThrow(
      'realtime pub client failed to connect: raw connect failure',
    );
  });
});
