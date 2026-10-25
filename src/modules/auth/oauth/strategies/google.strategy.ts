import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { GoogleUserData } from '../interfaces/google.interface.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID') || 'missing';
    const clientSecret =
      configService.get<string>('GOOGLE_CLIENT_SECRET') || 'missing';
    const callbackURL =
      configService.get<string>('GOOGLE_CALLBACK_URL') ||
      configService.get<string>('GOOGLE_CALLBACK') ||
      'http://localhost:3000/auth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      proxy: true,
      passReqToCallback: true,
    });
  }

  async validate(
    _req: unknown,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<GoogleUserData> {
    const { id, displayName, emails, name, photos } = profile;
    return {
      googleId: id,
      email: emails?.[0]?.value || '',
      phone: undefined,
      firstName: name?.givenName || displayName?.split(' ')[0] || '',
      lastName:
        name?.familyName || displayName?.split(' ').slice(1).join(' ') || '',
      imageUrl: photos?.[0]?.value,
    };
  }
}
