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
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      order: {
        update: jest.fn(),
        findMany: jest.fn(),
      },
      warehouse: {
        findFirst: jest.fn(),
      },
      packageItem: {
        create: jest.fn(),
      },
      scanEvent: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    mockInventoryService = {
      dispatchStockForPackage: jest.fn(),
      revertDispatchStockForPackage: jest.fn(),
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

    it('kể cả khi kiện hàng đã xuất trước (DISPATCHED) nhưng sau đó đơn bị CANCELLED, tự động hủy xác nhận đi đơn, hoàn tồn kho, trả về autoRestocked = true', async () => {
      mockPrisma.package.findMany.mockResolvedValue([
        {
          id: 'pkg-1',
          packageCode: 'PKG-001',
          trackingCode: 'TRACK-CANCELLED-DISPATCHED',
          status: PackageStatus.DISPATCHED,
          order: {
            id: 'ord-1',
            externalOrderId: 'ORD-CANCELLED-DISPATCHED',
            platformStatus: PlatformOrderStatus.CANCELLED,
            fulfillmentStatus: FulfillmentStatus.CANCELLED_RESTOCKED,
            shopId: 'shop-1',
            shop: { defaultWarehouseId: 'wh-1' },
          },
          packageItems: [
            {
              quantity: 2,
              orderItem: { variantId: 'var-1' },
            },
          ],
        },
      ]);

      const res = await fulfillmentService.verifyDispatch('tenant-1', 'user-1', {
        code: 'TRACK-CANCELLED-DISPATCHED',
      });

      expect(res.result).toBe(ScanResult.INVALID_ORDER_STATUS);
      expect((res as any).isCancelled).toBe(true);
      expect((res as any).wasDispatched).toBe(true);
      expect((res as any).autoRestocked).toBe(true);
      expect(res.message).toContain('ĐÃ BỊ HỦY trên sàn Shopee');
      expect(mockInventoryService.dispatchStockForPackage).not.toHaveBeenCalled();
      expect(mockInventoryService.revertDispatchStockForPackage).toHaveBeenCalledWith(
        expect.anything(),
        'tenant-1',
        'wh-1',
        [{ variantId: 'var-1', quantity: 2 }],
        'ord-1',
        'pkg-1',
        'user-1',
        expect.anything(),
      );
      expect(mockPrisma.package.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pkg-1' },
          data: expect.objectContaining({ status: PackageStatus.CANCELLED }),
        }),
      );
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

  describe('Đặc thù đối soát mã vận đơn Shopee (Tracking Code Reconciliation)', () => {
    it('quét mã vận đơn thành công khi mã vận đơn được lưu trên Order dù Package trackingCode bị null', async () => {
      const mockPkg = {
        id: 'pkg-null-track',
        packageCode: 'PKG-ORDER-123',
        trackingCode: null, // Package chưa đồng bộ trackingCode
        status: PackageStatus.READY,
        order: {
          id: 'ord-123',
          externalOrderId: 'ORD-EXT-123',
          trackingCode: 'SPXVN066144212957', // Có mã vận đơn trên Order
          platformStatus: PlatformOrderStatus.READY_TO_SHIP,
          fulfillmentStatus: FulfillmentStatus.RESERVED,
          shopId: 'shop-1',
          shop: { defaultWarehouseId: 'wh-1' },
          packages: [{ id: 'pkg-null-track', status: PackageStatus.READY }],
          orderItems: [{ id: 'oi-1', variantId: 'var-1', quantity: 1 }],
        },
        packageItems: [
          {
            quantity: 1,
            orderItem: { variantId: 'var-1' },
          },
        ],
      };

      mockPrisma.package.findMany.mockResolvedValue([mockPkg]);
      mockPrisma.package.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.package.count.mockResolvedValue(0);

      const res = await fulfillmentService.verifyDispatch('tenant-1', 'user-1', {
        code: 'SPXVN066144212957',
      });

      expect(res.result).toBe(ScanResult.VERIFIED);
      expect((res as any).package.trackingCode).toBe('SPXVN066144212957');
      expect(mockInventoryService.dispatchStockForPackage).toHaveBeenCalledTimes(1);
    });

    it('quét thành công và tự động tạo package khi đơn hàng trong DB chưa có bản ghi package', async () => {
      // package.findMany returns empty
      mockPrisma.package.findMany.mockResolvedValue([]);

      const mockOrderInDb = {
        id: 'ord-no-pkg',
        externalOrderId: 'ORD-NOPKG-999',
        trackingCode: 'SPXVN999888777',
        shippingCarrier: 'SPX Express',
        platformStatus: PlatformOrderStatus.READY_TO_SHIP,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        shopId: 'shop-1',
        shop: { defaultWarehouseId: 'wh-1' },
        packages: [],
        orderItems: [{ id: 'oi-1', variantId: 'var-1', quantity: 2 }],
      };

      // order.findMany returns the order
      mockPrisma.order.findMany.mockResolvedValue([mockOrderInDb]);

      const createdPkg = {
        id: 'pkg-created-on-the-fly',
        packageCode: 'SPXVN999888777',
        trackingCode: 'SPXVN999888777',
        carrierName: 'SPX Express',
        status: PackageStatus.READY,
        order: mockOrderInDb,
        packageItems: [
          {
            quantity: 2,
            orderItem: { variantId: 'var-1' },
          },
        ],
      };

      mockPrisma.package.create.mockResolvedValue(createdPkg);
      mockPrisma.package.findUnique.mockResolvedValue(createdPkg);
      mockPrisma.package.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.package.count.mockResolvedValue(0);

      const res = await fulfillmentService.verifyDispatch('tenant-1', 'user-1', {
        code: 'SPXVN999888777',
      });

      expect(res.result).toBe(ScanResult.VERIFIED);
      expect((res as any).package.packageCode).toBe('SPXVN999888777');
      expect(mockPrisma.package.create).toHaveBeenCalled();
    });

    it('tự động fallback về kho khả dụng của Tenant khi Shop chưa cấu hình defaultWarehouseId', async () => {
      const mockPkg = {
        id: 'pkg-no-shop-wh',
        packageCode: 'PKG-NO-WH',
        trackingCode: 'SPXVN-NO-WH',
        status: PackageStatus.READY,
        order: {
          id: 'ord-no-wh',
          externalOrderId: 'ORD-NO-WH',
          trackingCode: 'SPXVN-NO-WH',
          platformStatus: PlatformOrderStatus.READY_TO_SHIP,
          fulfillmentStatus: FulfillmentStatus.RESERVED,
          shopId: 'shop-1',
          shop: { defaultWarehouseId: null }, // Shop chưa cấu hình kho
          packages: [{ id: 'pkg-no-shop-wh', status: PackageStatus.READY }],
          orderItems: [{ id: 'oi-1', variantId: 'var-1', quantity: 1 }],
        },
        packageItems: [
          {
            quantity: 1,
            orderItem: { variantId: 'var-1' },
          },
        ],
      };

      mockPrisma.package.findMany.mockResolvedValue([mockPkg]);
      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-fallback-tenant-active' });
      mockPrisma.package.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.package.count.mockResolvedValue(0);

      const res = await fulfillmentService.verifyDispatch('tenant-1', 'user-1', {
        code: 'SPXVN-NO-WH',
      });

      expect(res.result).toBe(ScanResult.VERIFIED);
      expect(mockInventoryService.dispatchStockForPackage).toHaveBeenCalledWith(
        expect.anything(),
        'tenant-1',
        'wh-fallback-tenant-active',
        expect.anything(),
        'ord-no-wh',
        'pkg-no-shop-wh',
        'user-1',
      );
    });
  });
});

