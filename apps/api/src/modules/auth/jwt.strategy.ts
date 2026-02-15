import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

function extractJwtFromCookieOrHeader(req: Request): string | null {
  // Prefer cookie-based auth, fallback to Authorization header
  if (req.cookies?.access_token) {
    return req.cookies.access_token;
  }
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(ConfigService) config: ConfigService) {
    super({
      jwtFromRequest: extractJwtFromCookieOrHeader,
      secretOrKey: config.get('JWT_SECRET', 'dev-secret-change-in-production'),
      algorithms: ['HS256'],
    });
  }

  validate(payload: { sub: string; email: string; businessId: string; role: string }) {
    return {
      sub: payload.sub,
      staffId: payload.sub,
      email: payload.email,
      businessId: payload.businessId,
      role: payload.role,
    };
  }
}
