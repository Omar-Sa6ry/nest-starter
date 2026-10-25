import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';

describe('MetricsController', () => {
  let controller: MetricsController;
  let mockMetrics: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    mockMetrics = {
      getContentType: vi.fn().mockReturnValue('text/plain'),
      getMetrics: vi.fn().mockResolvedValue('# HELP http_requests_total 1'),
    };
    controller = new MetricsController(
      mockMetrics as unknown as MetricsService,
    );
  });

  it('streams prometheus metrics with the right content type', async () => {
    const set = vi.fn();
    const end = vi.fn();
    const res = { set, end } as never;

    await controller.getMetrics(res);

    expect(set).toHaveBeenCalledWith('Content-Type', 'text/plain');
    expect(end).toHaveBeenCalledWith('# HELP http_requests_total 1');
  });
});
