import { describe, it, expect } from 'vitest';
import { ResponseFormatter } from './response-formatter.js';

describe('ResponseFormatter', () => {
  describe('formatSuccess', () => {
    it('wraps a plain object', () => {
      const result = ResponseFormatter.formatSuccess({ id: '1' });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Operation executed successfully');
      expect(result.data).toEqual({ id: '1' });
      expect(new Date(result.timeStamp).toISOString()).toBe(result.timeStamp);
    });

    it('wraps a plain array into items', () => {
      const result = ResponseFormatter.formatSuccess([1, 2, 3]);

      expect(result.data).toEqual([1, 2, 3]);
      expect(result.items).toEqual([1, 2, 3]);
    });

    it('extracts items from a raw envelope', () => {
      const result = ResponseFormatter.formatSuccess({
        items: [{ id: 'a' }],
        totalItems: 1,
      });

      expect(result.items).toEqual([{ id: 'a' }]);
    });

    it('extracts items from data.items', () => {
      const result = ResponseFormatter.formatSuccess({
        data: { items: [{ id: 'b' }] },
      });

      expect(result.items).toEqual([{ id: 'b' }]);
    });

    it('keeps envelope status and message', () => {
      const result = ResponseFormatter.formatSuccess({
        success: true,
        statusCode: 201,
        message: 'Created',
        data: { id: 'x' },
      });

      expect(result.statusCode).toBe(201);
      expect(result.message).toBe('Created');
      expect(result.data).toEqual({ id: 'x' });
    });

    it('falls back when data is null', () => {
      const result = ResponseFormatter.formatSuccess(null);

      expect(result.data).toBeNull();
      expect(result.items).toBeUndefined();
    });

    it('maps nested data to data field', () => {
      const result = ResponseFormatter.formatSuccess({
        data: { nested: true },
      });

      expect(result.data).toEqual({ nested: true });
    });

    it('keeps pagination alias', () => {
      const result = ResponseFormatter.formatSuccess({
        pagination: { page: 2 },
      });

      expect(result.paginationInfo).toEqual({ page: 2 });
    });

    it('uses paginationInfo when present', () => {
      const result = ResponseFormatter.formatSuccess({
        paginationInfo: { page: 3 },
        pagination: { page: 1 },
      });

      expect(result.paginationInfo).toEqual({ page: 3 });
    });
  });

  describe('formatError', () => {
    it('formats a generic Error', () => {
      const result = ResponseFormatter.formatError(new Error('boom'));

      expect(result).toEqual({
        success: false,
        statusCode: 500,
        message: 'boom',
        timestamp: expect.any(String),
      });
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('extracts graphql errors array', () => {
      const result = ResponseFormatter.formatError({
        errors: [{ message: 'bad input' }, { message: 'other' }],
      });

      expect(result.message).toBe('bad input, other');
    });

    it('reads http exception response', () => {
      const result = ResponseFormatter.formatError({
        response: { message: 'Not found', statusCode: 404, error: 'NF' },
      });

      expect(result.statusCode).toBe(404);
      expect(result.message).toBe('Not found');
      expect(result).not.toHaveProperty('error');
    });

    it('reads status field', () => {
      const result = ResponseFormatter.formatError({ status: 403 });

      expect(result.statusCode).toBe(403);
    });

    it('reads statusCode field', () => {
      const result = ResponseFormatter.formatError({ statusCode: 401 });

      expect(result.statusCode).toBe(401);
    });

    it('merges an array response message into one line', () => {
      const result = ResponseFormatter.formatError({
        response: { message: ['first', 'second'], statusCode: 400 },
      });

      expect(result.message).toBe('first, second');
    });

    it('falls back for empty input', () => {
      const result = ResponseFormatter.formatError(undefined);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('An unexpected error occurred');
    });
  });
});
