import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const ALLOW_ANY_ROLE_KEY = 'allowAnyRole';
export const AllowAnyRole = () => SetMetadata(ALLOW_ANY_ROLE_KEY, true);

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets);

    // Specific roles required — enforce (takes priority over AllowAnyRole)
    if (requiredRoles && requiredRoles.length > 0) {
      const { user } = context.switchToHttp().getRequest();
      return requiredRoles.includes(user?.role);
    }

    const allowAnyRole = this.reflector.getAllAndOverride<boolean>(ALLOW_ANY_ROLE_KEY, targets);

    // Explicitly marked as accessible to any authenticated user
    if (allowAnyRole) {
      return true;
    }

    // No role declaration — deny by default to prevent accidental exposure
    const handler = context.getHandler().name;
    const controller = context.getClass().name;
    this.logger.warn(`${controller}.${handler} has no @Roles() or @AllowAnyRole() — access denied`);
    throw new ForbiddenException('This endpoint requires explicit role declaration');
  }
}
