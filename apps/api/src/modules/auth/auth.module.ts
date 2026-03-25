import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { JwtStrategy } from './jwt.strategy';
import { TokenService } from '../../common/token.service';
import { JwtBlacklistService } from '../../common/jwt-blacklist.service';
import { PortalRedisService } from '../../common/portal-redis.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        const isProduction = config.get('NODE_ENV') === 'production';

        if (
          isProduction &&
          (!secret ||
            secret === 'change-me-in-production' ||
            secret === 'dev-secret-change-in-production')
        ) {
          throw new Error('JWT_SECRET must be set to a strong, unique value in production');
        }

        return {
          secret: secret || 'dev-secret-change-in-production',
          signOptions: {
            expiresIn: config.get('JWT_EXPIRATION', '15m'),
            algorithm: 'HS256',
          },
          verifyOptions: {
            algorithms: ['HS256'],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TwoFactorService,
    JwtStrategy,
    TokenService,
    JwtBlacklistService,
    PortalRedisService,
  ],
  exports: [
    AuthService,
    TwoFactorService,
    JwtModule,
    TokenService,
    JwtBlacklistService,
    PortalRedisService,
  ],
})
export class AuthModule {}
