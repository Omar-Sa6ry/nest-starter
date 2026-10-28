import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { Profile } from 'passport-google-oauth20';
import { GoogleStrategy } from './google.strategy.js';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  // Builds a fully-typed passport-google-oauth20 Profile. The strategy only
  // reads id/displayName/emails/name/photos, but the Profile type requires
  // provider/profileUrl/_raw/_json as well.
  const buildProfile = (
    overrides: Partial<Profile> & Pick<Profile, 'id' | 'displayName'>,
  ): Profile => ({
    provider: 'google',
    profileUrl: 'https://example.com/profile',
    _raw: '',
    _json: {
      iss: 'accounts.google.com',
      aud: 'test-client-id',
      sub: overrides.id,
      iat: 0,
      exp: 0,
    },
    ...overrides,
  });

  beforeEach(() => {
    const mockConfigService = {
      get: (key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') return 'test-client-id';
        if (key === 'GOOGLE_CLIENT_SECRET') return 'test-client-secret';
        if (key === 'GOOGLE_CALLBACK_URL' || key === 'GOOGLE_CALLBACK')
          return 'http://localhost/callback';
        return null;
      },
    } as unknown as ConfigService;

    strategy = new GoogleStrategy(mockConfigService);
  });

  describe('validate', () => {
    it('should correctly parse profile data with full names', async () => {
      const mockProfile: Profile = buildProfile({
        id: 'google-1',
        displayName: 'John Doe',
        emails: [{ value: 'john@example.com', verified: true }],
        name: {
          givenName: 'John',
          familyName: 'Doe',
        },
      });

      const result = await strategy.validate(null, 'access', 'refresh', mockProfile);

      expect(result).toEqual({
        googleId: 'google-1',
        email: 'john@example.com',
        phone: undefined,
        firstName: 'John',
        lastName: 'Doe',
        imageUrl: undefined,
      });
    });

    it('should fallback to splitting displayName if name object is missing', async () => {
      const mockProfile: Profile = buildProfile({
        id: 'google-2',
        displayName: 'Jane Mary Watson',
        emails: [{ value: 'jane@example.com', verified: true }],
      });

      const result = await strategy.validate(null, 'access', 'refresh', mockProfile);

      expect(result.firstName).toBe('Jane');
      expect(result.lastName).toBe('Mary Watson');
    });

    it('should return empty strings if emails are missing', async () => {
      const mockProfile: Profile = buildProfile({
        id: 'google-3',
        displayName: 'NoEmail User',
        emails: [],
      });

      const result = await strategy.validate(null, 'access', 'refresh', mockProfile);
      expect(result.email).toBe('');
    });
  });
});
