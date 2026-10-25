import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  ITokenProvider,
  ITokenPayload,
  ITokenResult,
} from '../interfaces/ISecurity.interface.js';

@Injectable()
export class JwtTokenProvider implements ITokenProvider {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private get secret(): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    return secret;
  }

  async generateTokens(payload: ITokenPayload): Promise<ITokenResult> {
    const jti = randomUUID();
    const expiresInSeconds = 3600 * 24;

    const accessToken = await this.jwtService.signAsync(
      {
        sub: payload.userId,
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        permissions: payload.permissions,
        sessionId: payload.sessionId,
        jti,
      },
      { secret: this.secret, expiresIn: expiresInSeconds },
    );

    const refreshJti = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: payload.userId,
        userId: payload.userId,
        sessionId: payload.sessionId,
        type: 'refresh',
        jti: refreshJti,
      },
      { secret: this.secret, expiresIn: 3600 * 24 * 7 },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds,
    };
  }

  async verifyAccessToken(token: string): Promise<ITokenPayload | null> {
    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: this.secret,
      });
      return {
        userId: decoded.userId || decoded.sub,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions || [],
        sessionId: decoded.sessionId,
      };
    } catch {
      return null;
    }
  }

  async verifyRefreshToken(token: string): Promise<ITokenPayload | null> {
    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: this.secret,
      });
      if (decoded.type !== 'refresh') return null;
      return {
        userId: decoded.userId || decoded.sub,
        email: decoded.email || '',
        role: decoded.role || '',
        permissions: [],
        sessionId: decoded.sessionId,
      };
    } catch {
      return null;
    }
  }

  async getJti(token: string): Promise<string | null> {
    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: this.secret,
      });
      return decoded.jti ?? null;
    } catch {
      return null;
    }
  }
}
