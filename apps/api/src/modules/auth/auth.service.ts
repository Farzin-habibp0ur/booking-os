import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  private getRefreshSecret(): string {
    return this.config.get<string>('JWT_REFRESH_SECRET')
      || this.config.get<string>('JWT_SECRET')
      || 'dev-secret-change-in-production';
  }

  async login(email: string, password: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { email },
      include: { business: true },
    });

    if (!staff || !staff.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, staff.passwordHash);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: staff.id,
      email: staff.email,
      businessId: staff.businessId,
      role: staff.role,
    };

    return {
      accessToken: this.jwt.sign(payload),
      refreshToken: this.jwt.sign(payload, {
        secret: this.getRefreshSecret(),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
      }),
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        businessId: staff.businessId,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.getRefreshSecret(),
      });
      const staff = await this.prisma.staff.findUnique({
        where: { id: payload.sub },
      });
      if (!staff || !staff.isActive) {
        throw new UnauthorizedException();
      }
      const newPayload = {
        sub: staff.id,
        email: staff.email,
        businessId: staff.businessId,
        role: staff.role,
      };
      return {
        accessToken: this.jwt.sign(newPayload),
        refreshToken: this.jwt.sign(newPayload, {
          secret: this.getRefreshSecret(),
          expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
        }),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getMe(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: { business: true },
    });
    if (!staff) throw new UnauthorizedException();
    return {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      locale: staff.locale,
      businessId: staff.businessId,
      business: {
        id: staff.business.id,
        name: staff.business.name,
        slug: staff.business.slug,
        verticalPack: staff.business.verticalPack,
        defaultLocale: staff.business.defaultLocale,
      },
    };
  }
}
