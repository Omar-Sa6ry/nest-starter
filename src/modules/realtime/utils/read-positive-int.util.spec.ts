import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { readPositiveInt } from './read-positive-int.util.js';

describe('readPositiveInt', () => {
  let get: ReturnType<typeof vi.fn>;
  let config: ConfigService;

  beforeEach(() => {
    get = vi.fn();
    config = { get } as unknown as ConfigService;
  });

  it('returns the parsed value for a valid positive integer', () => {
    get.mockReturnValue('42');

    expect(readPositiveInt(config, 'SOME_MAX', 7)).toBe(42);
    expect(get).toHaveBeenCalledWith('SOME_MAX');
  });

  it('falls back when the value is not a number', () => {
    get.mockReturnValue('abc');

    expect(readPositiveInt(config, 'SOME_MAX', 7)).toBe(7);
  });

  it('falls back when the value is an empty string', () => {
    get.mockReturnValue('');

    expect(readPositiveInt(config, 'SOME_MAX', 7)).toBe(7);
  });

  it('falls back when the variable is absent', () => {
    get.mockReturnValue(undefined);

    expect(readPositiveInt(config, 'SOME_MAX', 7)).toBe(7);
  });

  it('falls back when the value is zero', () => {
    get.mockReturnValue('0');

    expect(readPositiveInt(config, 'SOME_MAX', 7)).toBe(7);
  });

  it('falls back when the value is negative', () => {
    get.mockReturnValue('-5');

    expect(readPositiveInt(config, 'SOME_MAX', 7)).toBe(7);
  });

  it('truncates decimals instead of rejecting them', () => {
    get.mockReturnValue('12.7');

    expect(readPositiveInt(config, 'SOME_MAX', 7)).toBe(12);
  });

  it('tolerates surrounding whitespace', () => {
    get.mockReturnValue(' 42 ');

    expect(readPositiveInt(config, 'SOME_MAX', 7)).toBe(42);
  });
});
