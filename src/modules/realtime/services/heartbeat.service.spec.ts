import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MockInstance } from 'vitest';
import type { Server } from 'socket.io';
import { HeartbeatService } from './heartbeat.service.js';
import type { IConnectionStore } from '../stores/interfaces/IConnectionStore.interface.js';
import { HEARTBEAT, REALTIME_ENV } from '../constants/realtime.constants.js';

describe('HeartbeatService', () => {
  let store: IConnectionStore;
  let config: ConfigService;
  let get: MockInstance;
  let metrics: { recordReapedConnections: MockInstance };
  let service: HeartbeatService;
  let warnLog: MockInstance;

  function setEnv(values: Record<string, string | undefined>): void {
    get.mockImplementation((name: string) => values[name]);
  }

  beforeEach(() => {
    get = vi.fn();
    config = { get } as unknown as ConfigService;
    metrics = {
      recordReapedConnections: vi.fn(),
    };
    store = {
      addSocket: vi.fn().mockResolvedValue(undefined),
      removeSocket: vi.fn().mockResolvedValue(null),
      getUserSockets: vi.fn().mockResolvedValue([]),
      getUserIdBySocketId: vi.fn().mockResolvedValue(null),
      isUserOnline: vi.fn().mockResolvedValue(false),
      touchHeartbeat: vi.fn().mockResolvedValue(undefined),
      findInactiveSockets: vi.fn().mockResolvedValue([]),
      getAllConnectedUsersCount: vi.fn().mockResolvedValue(0),
      getUserLastSeen: vi.fn().mockResolvedValue(null),
    };
    warnLog = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    service = new HeartbeatService(store, config, metrics as any);
  });

  afterEach(() => {
    service.stopWatchdog();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor env parsing', () => {
    it('uses the defaults when the env vars are absent or invalid', async () => {
      setEnv({
        [REALTIME_ENV.HEARTBEAT_STALE_MS]: undefined,
        [REALTIME_ENV.HEARTBEAT_SWEEP_MS]: 'not-a-number',
      });

      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      service.bindServer({} as Server);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), HEARTBEAT.SWEEP_INTERVAL_MS);
      await expect(service.cleanStaleConnections()).resolves.toBe(0);
      expect(store.findInactiveSockets).toHaveBeenCalledWith(HEARTBEAT.STALE_MS);
    });

    it('clamps the sweep interval down to the stale threshold', () => {
      setEnv({
        [REALTIME_ENV.HEARTBEAT_STALE_MS]: '20000',
        [REALTIME_ENV.HEARTBEAT_SWEEP_MS]: '90000',
      });
      service = new HeartbeatService(store, config, metrics as any);

      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      service.bindServer({} as Server);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 20_000);
    });

    it('uses valid env values verbatim', async () => {
      setEnv({
        [REALTIME_ENV.HEARTBEAT_STALE_MS]: '45000',
        [REALTIME_ENV.HEARTBEAT_SWEEP_MS]: '10000',
      });
      service = new HeartbeatService(store, config, metrics as any);

      await service.cleanStaleConnections();
      expect(store.findInactiveSockets).toHaveBeenCalledWith(45_000);
    });

    it('falls back to the default sweep interval when only it is invalid', () => {
      setEnv({
        [REALTIME_ENV.HEARTBEAT_STALE_MS]: '20000',
        [REALTIME_ENV.HEARTBEAT_SWEEP_MS]: 'abc',
      });
      service = new HeartbeatService(store, config, metrics as any);

      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      service.bindServer({} as Server);

      // min(default 30_000, stale 20_000) — still clamped.
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 20_000);
    });
  });

  describe('watchdog lifecycle', () => {
    it('bindServer stores the server and starts the watchdog', () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      const server = {} as Server;

      service.bindServer(server);

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), HEARTBEAT.SWEEP_INTERVAL_MS);
    });

    it('startWatchdog does not create a second timer', () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      service.startWatchdog();
      service.startWatchdog();

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('sweeps on every interval tick', () => {
      vi.useFakeTimers();
      service.bindServer({} as Server);

      vi.advanceTimersByTime(HEARTBEAT.SWEEP_INTERVAL_MS);

      expect(store.findInactiveSockets).toHaveBeenCalledWith(HEARTBEAT.STALE_MS);
    });

    it('stopWatchdog clears the timer once and is idempotent', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
      service.bindServer({} as Server);

      service.stopWatchdog();
      service.stopWatchdog();

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('stopWatchdog is a no-op when the watchdog never started', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

      service.stopWatchdog();

      expect(clearIntervalSpy).not.toHaveBeenCalled();
    });

    it('onModuleDestroy stops the watchdog', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
      service.bindServer({} as Server);

      service.onModuleDestroy();

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanStaleConnections', () => {
    it('returns 0 and disconnects nothing when no socket is stale', async () => {
      const server = {} as Server;
      service.bindServer(server);

      await expect(service.cleanStaleConnections()).resolves.toBe(0);
      expect(store.removeSocket).not.toHaveBeenCalled();
      expect(warnLog).not.toHaveBeenCalled();
    });

    it('removes stale sockets and disconnects those the server still knows', async () => {
      const disconnect = vi.fn();
      const sockets = new Map<string, { disconnect: (close: boolean) => void }>();
      sockets.set('s1', { disconnect });
      const server = { sockets: { sockets } } as unknown as Server;
      service.bindServer(server);
      vi.mocked(store.findInactiveSockets).mockResolvedValue(['s1', 'ghost']);

      await expect(service.cleanStaleConnections()).resolves.toBe(2);
      expect(store.removeSocket).toHaveBeenCalledWith('s1');
      expect(store.removeSocket).toHaveBeenCalledWith('ghost');
      expect(disconnect).toHaveBeenCalledWith(true);
      expect(warnLog).toHaveBeenCalled();
    });

    it('removes stale sockets even when no server is bound', async () => {
      vi.mocked(store.findInactiveSockets).mockResolvedValue(['s1']);

      await expect(service.cleanStaleConnections()).resolves.toBe(1);
      expect(store.removeSocket).toHaveBeenCalledWith('s1');
    });

    it('tolerates a server whose socket map lacks the stale id', async () => {
      const server = {
        sockets: { sockets: new Map<string, { disconnect: () => void }>() },
      } as unknown as Server;
      service.bindServer(server);
      vi.mocked(store.findInactiveSockets).mockResolvedValue(['ghost']);

      await expect(service.cleanStaleConnections()).resolves.toBe(1);
      expect(store.removeSocket).toHaveBeenCalledWith('ghost');
    });
  });
});
