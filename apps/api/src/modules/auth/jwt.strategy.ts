import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(ConfigService) config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET', 'dev-secret-change-in-production'),
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
