import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Chưa xác thực danh tính');
    }

    // Never trust tenantId from body or query! Only allow optional header x-tenant-id or token preferredTenantId
    const requestedTenantId =
      (request.headers['x-tenant-id'] as string) || user.preferredTenantId;

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        tenant: { status: 'ACTIVE' },
        ...(requestedTenantId ? { tenantId: requestedTenantId } : {}),
      },
      include: {
        tenant: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
        shopMemberships: {
          select: {
            shopId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership) {
      throw new ForbiddenException(
        requestedTenantId
          ? 'Bạn không có quyền truy cập vào Workspace/Tenant này'
          : 'Tài khoản chưa được kích hoạt trong bất kỳ Workspace nào',
      );
    }

    request.tenantId = membership.tenantId;
    request.tenant = membership.tenant;
    request.membership = membership;
    request.membershipRole = membership.role;
    request.allowedShopIds =
      membership.shopMemberships && membership.shopMemberships.length > 0
        ? membership.shopMemberships.map((sm) => sm.shopId)
        : null; // null means all shops in tenant are accessible

    return true;
  }
}
