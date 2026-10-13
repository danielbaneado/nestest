import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { IN_MEMORY_USERS_BY_USERNAME } from '../in-memory-users.js';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      // No roles required, allow access
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const username = request.headers['x-user'] as string;
    if (!username) {
      throw new ForbiddenException('Missing x-user header');
    }
    const user = IN_MEMORY_USERS_BY_USERNAME.get(username);
    if (!user) {
      throw new ForbiddenException('Invalid user');
    }
    // Attach user to request for use in controllers via CurrentUser decorator
    request.user = { username: user.username, role: user.role };
    // Check if the user's role is in the allowed roles
    return requiredRoles.includes(user.role);
  }
}
