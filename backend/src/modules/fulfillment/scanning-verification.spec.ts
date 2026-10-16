import { FulfillmentService } from './fulfillment.service';
import { ScanResult, PackageStatus, PlatformOrderStatus, FulfillmentStatus } from '@prisma/client';

describe('Scenarios 9, 10, 11, 12, 13: Fulfillment Scanning & Dispatch Verification Tests', () => {
  let fulfillmentService: FulfillmentService;
  let mockPrisma: any;
  let mockInventoryService: any;
  let mockAuditService: any;

  beforeEach(() => {
    mockPrisma = {
      package: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      order: {
        update: jest.fn(),
      },
      scanEvent: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    mockInventoryService = {
      dispatchStockForPackage: jest.fn(),
    };

    mockAuditService = {
      log: jest.fn(),
    };

    fulfillmentService = new FulfillmentService(
      mockPrisma,
      mockInventoryService,
      mockAuditService,
    );
  });

  describe('Scenario 11: Mã khớp nhiều đối tượng bị từ chối rõ ràng (AMBIGUOUS_CODE)', () => {
    it('khi một tracking code hoặc barcode khớp với 2 packages trong cùng tenant, phải trả AMBIGUOUS_CODE', async () => {
      mockPrisma.package.findMany.mockResolvedValue([
        {
          id: 'pkg-1',
          packageCode: 'PKG-001',
          trackingCode: 'DUPLICATE_CODE',
          carrierName: 'SPX',
          status: PackageStatus.READY,
          order: { externalOrderId: 'ORD-1', shop: { name: 'Shop 1' } },
        },
        {
          id: 'pkg-2',
          packageCode: 'PKG-002',
          trackingCode: 'DUPLICATE_CODE',
          carrierName: 'SPX',
          status: PackageStatus.READY,
          order: { externalOrderId: 'ORD-2', shop: { name: 'Shop 2' } },
        },
      ]);

      const res = await fulfillmentService.verifyDispatch('tenant-1', 'user-1', {
        code: 'DUPLICATE_CODE',
      });

      expect(res.result).toBe(ScanResult.AMBIGUOUS_CODE);
      expect((res as any).candidates.length).toBe(2);
      expect(mockInventoryService.dispatchStockForPackage).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 10: Scan lặp không trừ kho lần 2 (ALREADY_VERIFIED)', () => {
    it('khi kiện hàng đã ở trạng thái DISPATCHED, trả về ALREADY_VERIFIED và không gọi trừ tồn', async () => {
      mockPrisma.package.findMany.mockResolvedValue([
        {
          id: 'pkg-1',
          packageCode: 'PKG-001',
          trackingCode: 'TRACK-123',
          status: PackageStatus.DISPATCHED,
          verifiedAt: new Date(),
          verifiedByUserId: 'user-1',
          order: {
            id: 'ord-1',
            externalOrderId: 'ORD-1',
            shopId: 'shop-1',
            shop: { defaultWarehouseId: 'wh-1' },
          },
        },
      ]);

      const res = await fulfillmentService.verifyDispatch('tenant-1', 'user-1', {
        code: 'TRACK-123',
      });

      expect(res.result).toBe(ScanResult.ALREADY_VERIFIED);
      expect(mockInventoryService.dispatchStockForPackage).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 12: Đơn đã hủy không được xuất (INVALID_ORDER_STATUS)', () => {
    it('từ chối xuất kho nếu đơn hàng trên sàn có trạng thái CANCELLED', async () => {
      mockPrisma.package.findMany.mockResolvedValue([
        {
          id: 'pkg-1',
          packageCode: 'PKG-001',
          trackingCode: 'TRACK-CANCELLED',
          status: PackageStatus.READY,
          order: {
            id: 'ord-1',
            externalOrderId: 'ORD-CANCELLED',
            platformStatus: PlatformOrderStatus.CANCELLED,
            fulfillmentStatus: FulfillmentStatus.RESERVED,
            shopId: 'shop-1',
            shop: { defaultWarehouseId: 'wh-1' },
          },
          packageItems: [],
        },
      ]);

      const res = await fulfillmentService.verifyDispatch('tenant-1', 'user-1', {
        code: 'TRACK-CANCELLED',
      });

      expect(res.result).toBe(ScanResult.INVALID_ORDER_STATUS);
      expect(mockInventoryService.dispatchStockForPackage).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 9 & 13: Scan đúng tạo xác minh và kiểm tra multi-package verification', () => {
    it('đơn 2 kiện: sau khi quét kiện 1, trạng thái đơn là PARTIALLY_VERIFIED', async () => {
      const mockPkg1 = {
        id: 'pkg-1',
        packageCode: 'PKG-001',
        trackingCode: 'TRACK-MULTI-1',
        status: PackageStatus.READY,
        order: {
          id: 'ord-multi',
          externalOrderId: 'ORD-MULTI-100',
          platformStatus: PlatformOrderStatus.READY_TO_SHIP,
          fulfillmentStatus: FulfillmentStatus.RESERVED,
          shopId: 'shop-1',
          shop: { defaultWarehouseId: 'wh-1' },
          packages: [
            { id: 'pkg-1', status: PackageStatus.READY },
            { id: 'pkg-2', status: PackageStatus.READY },
          ],
        },
        packageItems: [
          {
            quantity: 1,
            orderItem: { variantId: 'var-1' },
          },
        ],
      };

      mockPrisma.package.findMany.mockResolvedValue([mockPkg1]);
      mockPrisma.package.updateMany.mockResolvedValue({ count: 1 });
      // 1 package remaining unverified
      mockPrisma.package.count.mockResolvedValue(1);

      const res = await fulfillmentService.verifyDispatch('tenant-1', 'user-1', {
        code: 'TRACK-MULTI-1',
      });

      expect(res.result).toBe(ScanResult.VERIFIED);
      expect((res as any).order.verificationStatus).toBe('PARTIALLY_VERIFIED');
      expect((res as any).order.verifiedPackages).toBe(1);
      expect((res as any).order.totalPackages).toBe(2);
      expect(mockInventoryService.dispatchStockForPackage).toHaveBeenCalledTimes(1);
    });

    it('đơn 2 kiện: sau khi quét đủ kiện 2, trạng thái đơn hoàn tất VERIFIED', async () => {
      const mockPkg2 = {
        id: 'pkg-2',
        packageCode: 'PKG-002',
        trackingCode: 'TRACK-MULTI-2',
        status: PackageStatus.READY,
        order: {
          id: 'ord-multi',
          externalOrderId: 'ORD-MULTI-100',
          platformStatus: PlatformOrderStatus.READY_TO_SHIP,
          fulfillmentStatus: FulfillmentStatus.RESERVED,
          shopId: 'shop-1',
          shop: { defaultWarehouseId: 'wh-1' },
          packages: [
            { id: 'pkg-1', status: PackageStatus.DISPATCHED },
            { id: 'pkg-2', status: PackageStatus.READY },
          ],
        },
        packageItems: [
          {
            quantity: 1,
            orderItem: { variantId: 'var-2' },
          },
        ],
      };

      mockPrisma.package.findMany.mockResolvedValue([mockPkg2]);
      mockPrisma.package.updateMany.mockResolvedValue({ count: 1 });
      // 0 package remaining unverified
      mockPrisma.package.count.mockResolvedValue(0);

      const res = await fulfillmentService.verifyDispatch('tenant-1', 'user-1', {
        code: 'TRACK-MULTI-2',
      });

      expect(res.result).toBe(ScanResult.VERIFIED);
      expect((res as any).order.verificationStatus).toBe('VERIFIED');
      expect((res as any).order.verifiedPackages).toBe(2);
      expect((res as any).order.totalPackages).toBe(2);
      expect(mockInventoryService.dispatchStockForPackage).toHaveBeenCalledTimes(1);
    });
  });
});
