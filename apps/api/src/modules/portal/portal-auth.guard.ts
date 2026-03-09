import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class PortalGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const token = authHeader.slice(7);

    try {
      const payload = this.jwt.verify(token);

      if (payload.type !== 'portal') {
        throw new UnauthorizedException('Invalid token type');
      }

      if (!payload.customerId || !payload.businessId) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // Attach to request
      request.portalUser = {
        customerId: payload.customerId,
        businessId: payload.businessId,
      };

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
