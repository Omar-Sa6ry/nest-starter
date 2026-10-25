import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisAdapter } from './redis.adapter.js';
import { RedisService } from '@bts-soft/core';

describe('RedisAdapter', () => {
  let adapter: RedisAdapter;
  let mockRedisService: RedisService;

  beforeEach(() => {
    mockRedisService = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
    } as any;

    adapter = new RedisAdapter(mockRedisService);
  });

  describe('set', () => {
    it('calls redis.set with correct parameters', async () => {
      await adapter.set('test-key', { foo: 'bar' }, 3600);

      expect(mockRedisService.set).toHaveBeenCalledWith('test-key', { foo: 'bar' }, 3600);
    });

    it('handles string values', async () => {
      await adapter.set('string-key', 'simple-value', 60);

      expect(mockRedisService.set).toHaveBeenCalledWith('string-key', 'simple-value', 60);
    });

    it('handles numeric values', async () => {
      await adapter.set('numeric-key', 42, 120);

      expect(mockRedisService.set).toHaveBeenCalledWith('numeric-key', 42, 120);
    });
  });

  describe('get', () => {
    it('returns value when key exists', async () => {
      mockRedisService.get.mockResolvedValue({ foo: 'bar' });

      const result = await adapter.get<{ foo: string }>('test-key');

      expect(result).toEqual({ foo: 'bar' });
      expect(mockRedisService.get).toHaveBeenCalledWith('test-key');
    });

    it('returns null when key does not exist', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await adapter.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('returns null when key expired', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await adapter.get('expired-key');

      expect(result).toBeNull();
    });
  });

  describe('del', () => {
    it('deletes key from redis', async () => {
      await adapter.del('test-key');

      expect(mockRedisService.del).toHaveBeenCalledWith('test-key');
    });

    it('handles multiple deletions', async () => {
      await adapter.del('key1');
      await adapter.del('key2');

      expect(mockRedisService.del).toHaveBeenCalledTimes(2);
      expect(mockRedisService.del).toHaveBeenCalledWith('key1');
      expect(mockRedisService.del).toHaveBeenCalledWith('key2');
    });
  });
});