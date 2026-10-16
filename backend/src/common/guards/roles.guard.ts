import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<MembershipRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.membershipRole as MembershipRole;

    if (!userRole) {
      throw new ForbiddenException('Không xác định được vai trò trong Tenant');
    }

    if (userRole === MembershipRole.OWNER) {
      return true; // OWNER has superuser rights within tenant
    }

    if (userRole === MembershipRole.ADMIN && !requiredRoles.includes(MembershipRole.OWNER)) {
      return true; // ADMIN has full ops rights unless exclusively OWNER
    }

    const hasRole = requiredRoles.includes(userRole);
    if (!hasRole) {
      throw new ForbiddenException(
        `Quyền hạn của bạn (${userRole}) không đủ để thực hiện thao tác này. Yêu cầu: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
