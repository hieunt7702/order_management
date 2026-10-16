import { InventoryService } from './inventory.service';
import { OrdersService } from '../orders/orders.service';
import { PlatformOrderStatus, FulfillmentStatus } from '@prisma/client';

describe('Scenarios 14, 15, 16, 17, 18: Inventory Lifecycle, Ledger Invariants & Cancellations', () => {
  let inventoryService: InventoryService;
  let ordersService: OrdersService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockAudit = { log: jest.fn() };
    mockPrisma = {
      inventoryBalance: {
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      inventoryLedger: {
        create: jest.fn(),
        aggregate: jest.fn(),
      },
      order: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    inventoryService = new InventoryService(mockPrisma, mockAudit);
    ordersService = new OrdersService(mockPrisma, inventoryService, mockAudit);
  });

  describe('Scenario 14: Hủy trước xuất giải phóng giữ hàng', () => {
    it('đơn hàng đang ở RESERVED khi bị hủy sẽ giải phóng reservation (giảm reserved, deltaReserved âm trong ledger)', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord-reserved',
        platformStatus: PlatformOrderStatus.READY_TO_SHIP,
        fulfillmentStatus: FulfillmentStatus.RESERVED,
        shop: { defaultWarehouseId: 'wh-1' },
        orderItems: [
          { variantId: 'var-1', quantity: 3 },
        ],
      });

      mockPrisma.inventoryBalance.findUnique.mockResolvedValue({
        id: 'bal-1',
        onHand: 10,
        reserved: 3,
      });

      await ordersService.cancelOrder('tenant-1', 'ord-reserved', 'user-1', {
        reason: 'Khách đổi ý',
      });

      // Released stock
      expect(mockPrisma.inventoryBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reserved: 0 },
        }),
      );

      // Recorded RELEASE in ledger
      expect(mockPrisma.inventoryLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'RELEASE',
            deltaOnHand: 0,
            deltaReserved: -3,
          }),
        }),
      );

      // Order status updated
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platformStatus: PlatformOrderStatus.CANCELLED,
            fulfillmentStatus: FulfillmentStatus.CANCELLED_RESTOCKED,
          }),
        }),
      );
    });
  });

  describe('Scenario 15: Hủy sau xuất KHÔNG tự động cộng tồn', () => {
    it('đơn hàng đã DISPATCHED khi bị hủy chỉ đổi platformStatus sang CANCELLED, KHÔNG gọi tăng tồn', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord-dispatched',
        platformStatus: PlatformOrderStatus.READY_TO_SHIP,
        fulfillmentStatus: FulfillmentStatus.DISPATCHED,
        shop: { defaultWarehouseId: 'wh-1' },
        orderItems: [
          { variantId: 'var-1', quantity: 2 },
        ],
      });

      await ordersService.cancelOrder('tenant-1', 'ord-dispatched', 'user-1', {
        reason: 'Hủy khi bưu tá đang đi giao',
      });

      // DOES NOT call balance update to restore stock!
      expect(mockPrisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(mockPrisma.inventoryLedger.create).not.toHaveBeenCalled();

      // Updates platformStatus to CANCELLED only
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platformStatus: PlatformOrderStatus.CANCELLED,
          }),
        }),
      );
    });
  });

  describe('Scenario 16: Nhận hàng hoàn thực tế mới tăng tồn và ghi ledger', () => {
    it('khi kho xác nhận thực nhận hàng hoàn (receiveReturn), mới tăng tồn onHand và ghi bút toán RETURN_RECEIVE', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord-return-incoming',
        platformStatus: PlatformOrderStatus.CANCELLED,
        fulfillmentStatus: FulfillmentStatus.DISPATCHED,
        shop: { defaultWarehouseId: 'wh-1' },
        orderItems: [
          { variantId: 'var-1', quantity: 2 },
        ],
      });

      await ordersService.receiveReturn('tenant-1', 'ord-return-incoming', 'user-1', {
        note: 'Kiểm tra bao bì nguyên vẹn',
      });

      // Upsert balance with increment
      expect(mockPrisma.inventoryBalance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { onHand: { increment: 2 } },
        }),
      );

      // Ledger recorded as RETURN_RECEIVE
      expect(mockPrisma.inventoryLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'RETURN_RECEIVE',
            deltaOnHand: 2,
            deltaReserved: 0,
          }),
        }),
      );

      // Order updated to RETURN_RECEIVED
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fulfillmentStatus: FulfillmentStatus.RETURN_RECEIVED,
          }),
        }),
      );
    });
  });

  describe('Scenario 17: Transaction rollback khi gặp lỗi giữa chừng', () => {
    it('nếu một SKU trong đơn không đủ tồn khi giữ hàng, toàn bộ reservation bị rollback', async () => {
      mockPrisma.inventoryBalance.findUnique
        .mockResolvedValueOnce({ id: 'b-1', onHand: 10, reserved: 2 }) // Available: 8, required: 1 -> OK
        .mockResolvedValueOnce({ id: 'b-2', onHand: 5, reserved: 5 }); // Available: 0, required: 1 -> FAIL

      const result = await inventoryService.reserveStockForOrder(
        mockPrisma,
        'tenant-1',
        'wh-1',
        [
          { variantId: 'var-1', quantity: 1 },
          { variantId: 'var-2', quantity: 1 },
        ],
        'ord-123',
      );

      expect(result.success).toBe(false);
      expect(result.errorSku).toBe('var-2');
    });
  });
});
