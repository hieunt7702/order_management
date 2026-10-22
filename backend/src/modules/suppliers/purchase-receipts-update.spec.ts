import { PurchaseReceiptsService } from './purchase-receipts.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Prisma } from '@prisma/client';

describe('PurchaseReceiptsService - Update Receipt & System Cost Synchronization', () => {
  let service: PurchaseReceiptsService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      purchaseReceipt: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      warehouse: {
        findFirst: jest.fn(),
      },
      supplier: {
        findFirst: jest.fn(),
      },
      inventoryBalance: {
        upsert: jest.fn(),
      },
      inventoryLedger: {
        create: jest.fn(),
      },
      purchaseReceiptItem: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      productVariant: {
        update: jest.fn(),
      },
      orderItem: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      order: {
        update: jest.fn(),
      },
      paymentAllocation: {
        delete: jest.fn(),
        update: jest.fn(),
      },
      supplierPayment: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };

    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    service = new PurchaseReceiptsService(mockPrisma as PrismaService, mockAudit as AuditService);
  });

  it('cập nhật đơn giá nhập hàng bị sai, tự động cập nhật ProductVariant.costPrice và đồng bộ OrderItem COGS', async () => {
    const tenantId = 'tenant-123';
    const userId = 'user-456';
    const receiptId = 'receipt-001';
    const variantId = 'variant-hao-hao';

    // Giả lập phiếu nhập cũ với đơn giá nhập bị sai: 50.000đ thay vì 15.000đ
    const existingReceipt = {
      id: receiptId,
      tenantId,
      receiptCode: 'PNK-20261022-001',
      warehouseId: 'wh-main',
      supplierId: 'supplier-acecook',
      totalItemsAmount: new Prisma.Decimal(5000000), // 100 gói * 50.000đ (sai)
      discountAmount: new Prisma.Decimal(0),
      taxAmount: new Prisma.Decimal(0),
      shippingFee: new Prisma.Decimal(0),
      shippingFeePayerType: 'PAID_TO_SUPPLIER',
      payableAmount: new Prisma.Decimal(5000000),
      paidAmount: new Prisma.Decimal(0),
      returnDeductionAmount: new Prisma.Decimal(0),
      remainingAmount: new Prisma.Decimal(5000000),
      receivingStatus: 'RECEIVED',
      items: [
        {
          id: 'item-1',
          variantId,
          productName: 'Mì Hảo Hảo Tôm Chua Cay',
          sku: 'SKU-HAOHAO',
          orderedQuantity: 100,
          receivedQuantity: 100,
          unitPrice: new Prisma.Decimal(50000), // Sai
          subtotal: new Prisma.Decimal(5000000),
        },
      ],
      paymentAllocations: [],
      purchaseReturns: [],
    };

    mockPrisma.purchaseReceipt.findFirst.mockResolvedValue(existingReceipt);
    mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-main', tenantId });
    mockPrisma.purchaseReceipt.update.mockImplementation(({ data }: any) => ({
      ...existingReceipt,
      ...data,
      items: [
        {
          id: 'item-new',
          variantId,
          unitPrice: data.totalItemsAmount ? new Prisma.Decimal(15000) : new Prisma.Decimal(50000),
        },
      ],
    }));

    // Giả lập có 1 đơn hàng chứa SKU này
    mockPrisma.orderItem.findMany.mockImplementation(({ where }: any) => {
      if (where.variantId === variantId) {
        return [{ id: 'order-item-1', orderId: 'order-100', quantity: 2 }];
      }
      if (where.orderId === 'order-100') {
        return [{ id: 'order-item-1', itemCogs: new Prisma.Decimal(30000) }];
      }
      return [];
    });

    // Thực hiện cập nhật: Sửa lại đơn giá đúng là 15.000đ
    const updateDto = {
      items: [
        {
          variantId,
          productName: 'Mì Hảo Hảo Tôm Chua Cay',
          sku: 'SKU-HAOHAO',
          orderedQuantity: 100,
          receivedQuantity: 100,
          disputedQuantity: 0,
          unitPrice: 15000, // Giá đúng
        },
      ],
      syncOrderCogs: true,
    };

    const result = await service.update(tenantId, receiptId, updateDto, userId);

    expect(result).toBeDefined();

    // 1. Kiểm tra cập nhật giá vốn ProductVariant.costPrice = 15.000đ
    expect(mockPrisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: variantId },
      data: { costPrice: new Prisma.Decimal(15000) },
    });

    // 2. Kiểm tra cập nhật OrderItem.itemCogs = 15.000 * 2 = 30.000đ
    expect(mockPrisma.orderItem.update).toHaveBeenCalledWith({
      where: { id: 'order-item-1' },
      data: { itemCogs: new Prisma.Decimal(30000) },
    });

    // 3. Kiểm tra tính lại cogsTotal của Order = 30.000đ
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-100' },
      data: { cogsTotal: new Prisma.Decimal(30000) },
    });

    // 4. Kiểm tra cập nhật phiếu nhập: totalItemsAmount = 1.500.000đ, payableAmount = 1.500.000đ
    expect(mockPrisma.purchaseReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: receiptId },
        data: expect.objectContaining({
          totalItemsAmount: new Prisma.Decimal(1500000),
          payableAmount: new Prisma.Decimal(1500000),
          remainingAmount: new Prisma.Decimal(1500000),
        }),
      }),
    );

    // 5. Kiểm tra ghi log kiểm toán Audit
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PURCHASE_RECEIPT_UPDATED',
        entityId: receiptId,
      }),
    );
  });
});
