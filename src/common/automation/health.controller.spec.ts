import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealthService: Record<string, ReturnType<typeof vi.fn>>;
  let mockDataSource: object;
  let mockRedis: object;

  beforeEach(() => {
    mockHealthService = {
      getSystemStats: vi.fn().mockReturnValue({
        uptime: 10,
        memory: { heapTotalMemoryMB: 1, heapUsedMemoryMB: 1, rssMB: 1 },
        cpuUsage: { user: 1, system: 1 },
      }),
      checkDatabase: vi.fn(),
      checkRedis: vi.fn(),
    };
    mockDataSource = {};
    mockRedis = {};

    controller = new HealthController(
      mockHealthService as unknown as HealthService,
      mockDataSource as never,
      mockRedis as never,
    );
  });

  it('returns UP status with system stats', () => {
    const result = controller.getHealth();

    expect(result.status).toBe('UP');
    expect(result.service).toBe('nest-starter');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    expect(result.system.uptime).toBe(10);
  });

  it('returns 200 when database and redis are up', async () => {
    mockHealthService.checkDatabase.mockResolvedValue({ status: 'UP' });
    mockHealthService.checkRedis.mockResolvedValue({ status: 'UP' });
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status } as never;

    await controller.getReadiness(res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'UP',
        checks: {
          database: { status: 'UP' },
          redis: { status: 'UP' },
        },
      }),
    );
  });

  it('returns 503 when any check is down', async () => {
    mockHealthService.checkDatabase.mockResolvedValue({ status: 'UP' });
    mockHealthService.checkRedis.mockResolvedValue({
      status: 'DOWN',
      message: 'down',
    });
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status } as never;

    await controller.getReadiness(res);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DOWN' }),
    );
  });
});
