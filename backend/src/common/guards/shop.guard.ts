import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class ShopGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const allowedShopIds: string[] | null = request.allowedShopIds;

    // null means user has tenant-wide access to all shops
    if (!allowedShopIds) {
      return true;
    }

    const shopId =
      request.params?.shopId ||
      request.query?.shopId ||
      request.body?.shopId;

    if (shopId && !allowedShopIds.includes(shopId)) {
      throw new ForbiddenException('Bạn không được phân quyền quản lý Shop này');
    }

    return true;
  }
}
