import { describe, it, expect } from 'vitest';
import { BcryptPasswordHasher } from './bcrypt-password.hasher.js';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();

  it('hashes a password', async () => {
    const hash = await hasher.hash('secret123');

    expect(hash).not.toBe('secret123');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('compares matching passwords', async () => {
    const hash = await hasher.hash('secret123');

    expect(await hasher.compare('secret123', hash)).toBe(true);
  });

  it('rejects mismatching passwords', async () => {
    const hash = await hasher.hash('secret123');

    expect(await hasher.compare('wrong', hash)).toBe(false);
  });
});
