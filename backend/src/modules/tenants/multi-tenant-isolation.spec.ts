import { TenantGuard } from '../../common/guards/tenant.guard';
import { ShopGuard } from '../../common/guards/shop.guard';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('Scenarios 1 & 2: Multi-Tenant & Shop Isolation Tests', () => {
  let tenantGuard: TenantGuard;
  let shopGuard: ShopGuard;
  let mockPrisma: any;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    mockPrisma = {
      membership: {
        findFirst: jest.fn(),
      },
    };
    tenantGuard = new TenantGuard(reflector, mockPrisma);
    shopGuard = new ShopGuard();
  });

  describe('Scenario 1: Tenant A không thể truy cập dữ liệu Tenant B kể cả đoán ID', () => {
    it('phải chặn khi User không có membership trong Tenant B (kể cả truyền X-Tenant-Id của Tenant B)', async () => {
      // User belongs to Tenant A, but tries to access Tenant B
      const mockExecutionContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-tenant-id': 'tenant-b-uuid' },
            user: { id: 'user-tenant-a', email: 'user@a.com' },
          }),
        }),
      } as any;

      // Prisma returns null because user does not have membership in Tenant B
      mockPrisma.membership.findFirst.mockResolvedValue(null);

      await expect(tenantGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('phải từ chối nếu request chưa xác thực danh tính user', async () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
            user: null,
          }),
        }),
      } as any;

      await expect(tenantGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Scenario 2: User bị giới hạn shop không thể thao tác shop khác', () => {
    it('phải chặn khi user có danh sách allowedShopIds nhưng cố truy cập shop khác', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            allowedShopIds: ['shop-1-uuid', 'shop-2-uuid'],
            params: { shopId: 'shop-3-uuid' },
          }),
        }),
      } as any;

      expect(() => shopGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('phải cho phép khi user truy cập shop nằm trong allowedShopIds', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            allowedShopIds: ['shop-1-uuid', 'shop-2-uuid'],
            params: { shopId: 'shop-1-uuid' },
          }),
        }),
      } as any;

      expect(shopGuard.canActivate(mockContext)).toBe(true);
    });

    it('phải cho phép khi user có quyền toàn tenant (allowedShopIds là null)', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            allowedShopIds: null,
            params: { shopId: 'any-shop-uuid' },
          }),
        }),
      } as any;

      expect(shopGuard.canActivate(mockContext)).toBe(true);
    });
  });
});
