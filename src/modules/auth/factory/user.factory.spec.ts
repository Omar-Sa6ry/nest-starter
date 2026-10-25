import { describe, it, expect } from 'vitest';
import { UserFactory } from './user.factory.js';
import { Role } from '../../../common/constant/enum.constant.js';

describe('UserFactory', () => {
  const factory = new UserFactory();

  it('creates a user with default role', () => {
    const user = factory.createUser(
      '  USER@Example.COM ',
      'hash',
      'Test',
      'User',
    );

    expect(user.email).toBe('user@example.com');
    expect(user.passwordHash).toBe('hash');
    expect(user.firstName).toBe('Test');
    expect(user.lastName).toBe('User');
    expect(user.role).toBe(Role.USER);
    expect(user.isActive).toBe(true);
    expect(user.phoneNumber).toBe('');
    expect(user.id).toBeTruthy();
  });

  it('creates a user with optional fields', () => {
    const user = factory.createUser(
      'admin@example.com',
      'hash2',
      'Ad',
      'Min',
      Role.ADMIN,
      ' 01234567890 ',
      'https://example.com/img.png',
    );

    expect(user.role).toBe(Role.ADMIN);
    expect(user.phoneNumber).toBe('01234567890');
    expect(user.imageUrl).toBe('https://example.com/img.png');
  });
});
