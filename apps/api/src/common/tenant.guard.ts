import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    // businessId is set by the JWT strategy on the user object
    const user = request.user;
    if (!user?.businessId) {
      return false;
    }
    // Attach businessId to the request for easy access
    request.businessId = user.businessId;
    return true;
  }
}
