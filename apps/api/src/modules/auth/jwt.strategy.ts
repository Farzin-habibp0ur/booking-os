import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { JwtBlacklistService } from '../../common/jwt-blacklist.service';

function extractJwtFromCookieOrHeader(req: Request): string | null {
  // Prefer cookie-based auth, fallback to Authorization header
  if (req.cookies?.access_token) {
    return req.cookies.access_token;
  }
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(ConfigService) config: ConfigService,
    private prisma: PrismaService,
    private blacklist: JwtBlacklistService,
  ) {
    // C3 fix: Fail hard if JWT_SECRET is not configured — no insecure fallback
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET environment variable must be configured');
    super({
      jwtFromRequest: extractJwtFromCookieOrHeader,
      secretOrKey: secret,
      algorithms: ['HS256'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: {
      sub: string;
      email: string;
      businessId: string;
      role: string;
      viewAs?: boolean;
      viewAsSessionId?: string;
      originalBusinessId?: string;
      originalRole?: string;
    },
  ) {
    // H1: Check if token is blacklisted
    const token = extractJwtFromCookieOrHeader(req);
    if (token && this.blacklist.isBlacklisted(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // H2: Verify staff still exists and is active
    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true },
    });
    if (!staff || !staff.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // View-as session validation
    if (payload.viewAs && payload.viewAsSessionId) {
      const session = await this.prisma.viewAsSession.findUnique({
        where: { id: payload.viewAsSessionId },
      });
      if (!session || session.endedAt || session.expiresAt < new Date()) {
        throw new UnauthorizedException('View-as session expired');
      }
    }

    const user: Record<string, any> = {
      sub: payload.sub,
      staffId: payload.sub,
      email: payload.email,
      businessId: payload.businessId,
      role: payload.role,
    };

    if (payload.viewAs) {
      user.viewAs = true;
      user.viewAsSessionId = payload.viewAsSessionId;
      user.originalBusinessId = payload.originalBusinessId;
      user.originalRole = payload.originalRole;
    }

    return user;
  }
}
