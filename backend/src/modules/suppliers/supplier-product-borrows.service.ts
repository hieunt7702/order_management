import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateSupplierProductBorrowDto,
  ReturnSupplierProductBorrowDto,
  ConvertBorrowToPurchaseDto,
  SupplierProductBorrowFilterDto,
} from './dto/supplier-product-borrow.dto';
import {
  Prisma,
  ProductBorrowType,
  ProductBorrowStatus,
  InventoryMovementType,
  PurchaseReceivingStatus,
  PurchasePaymentStatus,
} from '@prisma/client';

@Injectable()
export class SupplierProductBorrowsService {
  private readonly logger = new Logger(SupplierProductBorrowsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async generateUniqueBorrowCode(tenantId: string, type: ProductBorrowType): Promise<string> {
    const prefix = type === ProductBorrowType.BORROW_FROM_SUPPLIER ? 'PMH' : 'PXH';
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const base = `${prefix}-${y}${m}${d}`;
    for (let i = 0; i < 100; i++) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `${base}-${rand}`;
      const exists = await this.prisma.supplierProductBorrow.findUnique({
        where: { tenantId_borrowCode: { tenantId, borrowCode: code } },
      });
      if (!exists) return code;
    }
    return `${base}-${Date.now().toString().slice(-4)}`;
  }

  async generateUniqueReceiptCode(tenantId: string): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `PNK-${y}${m}${d}`;
    for (let i = 0; i < 100; i++) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `${prefix}-${rand}`;
      const exists = await this.prisma.purchaseReceipt.findUnique({
        where: { tenantId_receiptCode: { tenantId, receiptCode: code } },
      });
      if (!exists) return code;
    }
    return `${prefix}-${Date.now().toString().slice(-4)}`;
  }

  async create(tenantId: string, userId: string, dto: CreateSupplierProductBorrowDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Phiếu mượn phải có ít nhất 1 sản phẩm');
    }

    const [supplier, warehouse] = await Promise.all([
      this.prisma.supplier.findFirst({ where: { id: dto.supplierId, tenantId } }),
      this.prisma.warehouse.findFirst({ where: { id: dto.warehouseId, tenantId } }),
    ]);

    if (!supplier) throw new NotFoundException('Không tìm thấy nhà cung cấp');
    if (!warehouse) throw new NotFoundException('Không tìm thấy kho hàng');

    const type = dto.type || ProductBorrowType.BORROW_FROM_SUPPLIER;
    let borrowCode = dto.borrowCode?.trim().toUpperCase();
    if (!borrowCode) {
      borrowCode = await this.generateUniqueBorrowCode(tenantId, type);
    } else {
      const existing = await this.prisma.supplierProductBorrow.findUnique({
        where: { tenantId_borrowCode: { tenantId, borrowCode } },
      });
      if (existing) {
        borrowCode = await this.generateUniqueBorrowCode(tenantId, type);
      }
    }

    // Tính toán tổng số lượng và giá trị ước tính
    let totalQuantity = 0;
    let estimatedTotalAmount = 0;

    const itemsData = dto.items.map((it) => {
      const qty = Math.max(1, Number(it.borrowQuantity) || 1);
      const price = Math.max(0, Number(it.unitPrice) || 0);
      const subtotal = qty * price;
      totalQuantity += qty;
      estimatedTotalAmount += subtotal;

      return {
        tenantId,
        variantId: it.variantId,
        sku: it.sku.trim(),
        productName: it.productName.trim(),
        variationName: it.variationName?.trim() || null,
        borrowQuantity: qty,
        returnedQuantity: 0,
        purchasedQuantity: 0,
        remainingQuantity: qty,
        unitPrice: new Prisma.Decimal(price),
        subtotal: new Prisma.Decimal(subtotal),
        note: it.note?.trim() || null,
      };
    });

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Tạo phiếu mượn hàng
      const borrow = await tx.supplierProductBorrow.create({
        data: {
          tenantId,
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          borrowCode,
          type,
          borrowDate: dto.borrowDate ? new Date(dto.borrowDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          totalQuantity,
          returnedQuantity: 0,
          purchasedQuantity: 0,
          remainingQuantity: totalQuantity,
          estimatedTotalAmount: new Prisma.Decimal(estimatedTotalAmount),
          status: ProductBorrowStatus.BORROWED,
          note: dto.note?.trim() || null,
          createdById: userId,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: true,
          supplier: true,
          warehouse: true,
        },
      });

      // Lấy tên người thao tác
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      const performerName = user?.name || user?.email || 'Hệ thống';

      // 2. Cập nhật tồn kho và ghi sổ cái InventoryLedger
      for (const item of itemsData) {
        if (type === ProductBorrowType.BORROW_FROM_SUPPLIER) {
          // Shop mượn hàng từ NCC -> Cộng tồn kho onHand để bán/xuất đơn
          const curBalance = await tx.inventoryBalance.findUnique({
            where: {
              tenantId_warehouseId_variantId: {
                tenantId,
                warehouseId: dto.warehouseId,
                variantId: item.variantId,
              },
            },
          });
          const beforeOnHand = curBalance?.onHand || 0;
          const afterOnHand = beforeOnHand + item.borrowQuantity;

          await tx.inventoryBalance.upsert({
            where: {
              tenantId_warehouseId_variantId: {
                tenantId,
                warehouseId: dto.warehouseId,
                variantId: item.variantId,
              },
            },
            create: {
              tenantId,
              warehouseId: dto.warehouseId,
              variantId: item.variantId,
              onHand: item.borrowQuantity,
              reserved: 0,
            },
            update: {
              onHand: { increment: item.borrowQuantity },
            },
          });

          await tx.inventoryLedger.create({
            data: {
              tenantId,
              warehouseId: dto.warehouseId,
              variantId: item.variantId,
              movementType: InventoryMovementType.BORROW_RECEIVE,
              deltaOnHand: item.borrowQuantity,
              deltaReserved: 0,
              beforeOnHand,
              afterOnHand,
              voucherCode: borrowCode,
              performerName,
              referenceType: 'PRODUCT_BORROW',
              referenceId: borrow.id,
              performedByUserId: userId,
              note: `Nhập mượn hàng theo phiếu ${borrowCode} từ NCC ${supplier.name}`,
            },
          });
        } else {
          // Shop cho NCC mượn hàng -> Trừ tồn kho onHand
          const curBalance = await tx.inventoryBalance.findUnique({
            where: {
              tenantId_warehouseId_variantId: {
                tenantId,
                warehouseId: dto.warehouseId,
                variantId: item.variantId,
              },
            },
          });

          const available = (curBalance?.onHand || 0) - (curBalance?.reserved || 0);
          if (available < item.borrowQuantity) {
            throw new BadRequestException(
              `SKU ${item.sku} không đủ tồn khả dụng (Còn ${available}, yêu cầu xuất ${item.borrowQuantity})`,
            );
          }

          const beforeOnHand = curBalance?.onHand || 0;
          const afterOnHand = beforeOnHand - item.borrowQuantity;

          await tx.inventoryBalance.update({
            where: {
              tenantId_warehouseId_variantId: {
                tenantId,
                warehouseId: dto.warehouseId,
                variantId: item.variantId,
              },
            },
            data: {
              onHand: { decrement: item.borrowQuantity },
            },
          });

          await tx.inventoryLedger.create({
            data: {
              tenantId,
              warehouseId: dto.warehouseId,
              variantId: item.variantId,
              movementType: InventoryMovementType.BORROW_RETURN,
              deltaOnHand: -item.borrowQuantity,
              deltaReserved: 0,
              beforeOnHand,
              afterOnHand,
              voucherCode: borrowCode,
              performerName,
              referenceType: 'PRODUCT_BORROW',
              referenceId: borrow.id,
              performedByUserId: userId,
              note: `Xuất cho NCC ${supplier.name} mượn theo phiếu ${borrowCode}`,
            },
          });
        }
      }

      return borrow;
    });

    // 3. Ghi vết Audit Trail
    const isBorrow = type === ProductBorrowType.BORROW_FROM_SUPPLIER;
    await this.auditService.log({
      tenantId,
      userId,
      action: isBorrow ? 'PRODUCT_BORROW_CREATED' : 'PRODUCT_LEND_CREATED',
      entityType: 'SupplierProductBorrow',
      entityId: result.id,
      newValues: {
        borrowCode,
        type,
        supplierId: dto.supplierId,
        supplierName: supplier.name,
        warehouseId: dto.warehouseId,
        warehouseName: warehouse.name,
        totalQuantity,
        estimatedTotalAmount,
        note: dto.note || undefined,
        itemCount: itemsData.length,
        items: itemsData.map((i) => ({ sku: i.sku, productName: i.productName, qty: i.borrowQuantity, price: i.unitPrice })),
      },
    });

    return result;
  }

  async returnItems(tenantId: string, userId: string, dto: ReturnSupplierProductBorrowDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 sản phẩm cần trả');
    }

    const borrow = await this.prisma.supplierProductBorrow.findFirst({
      where: { id: dto.borrowId, tenantId },
      include: { items: true, supplier: true },
    });
    if (!borrow) {
      throw new NotFoundException('Không tìm thấy phiếu mượn hàng');
    }

    if (
      borrow.status === ProductBorrowStatus.RETURNED ||
      borrow.status === ProductBorrowStatus.CONVERTED_TO_PURCHASE
    ) {
      throw new BadRequestException('Phiếu mượn này đã được hoàn tất trước đó');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let returnedThisTimeTotal = 0;

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      const performerName = user?.name || user?.email || 'Hệ thống';

      for (const ret of dto.items) {
        const item = borrow.items.find((it) => it.id === ret.itemId);
        if (!item) {
          throw new NotFoundException(`Sản phẩm với ID ${ret.itemId} không thuộc phiếu mượn này`);
        }

        if (ret.returnQuantity > item.remainingQuantity) {
          throw new BadRequestException(
            `Số lượng trả cho SKU ${item.sku} (${ret.returnQuantity}) vượt quá số lượng còn mượn (${item.remainingQuantity})`,
          );
        }

        const newReturned = item.returnedQuantity + ret.returnQuantity;
        const newRemaining = item.remainingQuantity - ret.returnQuantity;
        returnedThisTimeTotal += ret.returnQuantity;

        // Cập nhật item
        await tx.supplierProductBorrowItem.update({
          where: { id: item.id },
          data: {
            returnedQuantity: newReturned,
            remainingQuantity: newRemaining,
          },
        });

        // Điều chỉnh tồn kho:
        if (borrow.type === ProductBorrowType.BORROW_FROM_SUPPLIER) {
          // Shop mượn NCC -> Nay trả lại cho NCC -> Trừ onHand
          const curBalance = await tx.inventoryBalance.findUnique({
            where: {
              tenantId_warehouseId_variantId: {
                tenantId,
                warehouseId: borrow.warehouseId,
                variantId: item.variantId,
              },
            },
          });
          const beforeOnHand = curBalance?.onHand || 0;
          const afterOnHand = beforeOnHand - ret.returnQuantity;

          await tx.inventoryBalance.update({
            where: {
              tenantId_warehouseId_variantId: {
                tenantId,
                warehouseId: borrow.warehouseId,
                variantId: item.variantId,
              },
            },
            data: {
              onHand: { decrement: ret.returnQuantity },
            },
          });

          await tx.inventoryLedger.create({
            data: {
              tenantId,
              warehouseId: borrow.warehouseId,
              variantId: item.variantId,
              movementType: InventoryMovementType.BORROW_RETURN,
              deltaOnHand: -ret.returnQuantity,
              deltaReserved: 0,
              beforeOnHand,
              afterOnHand,
              voucherCode: borrow.borrowCode,
              performerName,
              referenceType: 'PRODUCT_BORROW_RETURN',
              referenceId: borrow.id,
              performedByUserId: userId,
              note: `Xuất trả hàng mượn theo phiếu ${borrow.borrowCode} cho NCC ${borrow.supplier.name}`,
            },
          });
        } else {
          // Shop cho NCC mượn -> Nay NCC trả lại hàng cho shop -> Cộng onHand
          const curBalance = await tx.inventoryBalance.findUnique({
            where: {
              tenantId_warehouseId_variantId: {
                tenantId,
                warehouseId: borrow.warehouseId,
                variantId: item.variantId,
              },
            },
          });
          const beforeOnHand = curBalance?.onHand || 0;
          const afterOnHand = beforeOnHand + ret.returnQuantity;

          await tx.inventoryBalance.update({
            where: {
              tenantId_warehouseId_variantId: {
                tenantId,
                warehouseId: borrow.warehouseId,
                variantId: item.variantId,
              },
            },
            data: {
              onHand: { increment: ret.returnQuantity },
            },
          });

          await tx.inventoryLedger.create({
            data: {
              tenantId,
              warehouseId: borrow.warehouseId,
              variantId: item.variantId,
              movementType: InventoryMovementType.BORROW_RECEIVE,
              deltaOnHand: ret.returnQuantity,
              deltaReserved: 0,
              beforeOnHand,
              afterOnHand,
              voucherCode: borrow.borrowCode,
              performerName,
              referenceType: 'PRODUCT_BORROW_RETURN',
              referenceId: borrow.id,
              performedByUserId: userId,
              note: `Nhận lại hàng cho NCC ${borrow.supplier.name} mượn theo phiếu ${borrow.borrowCode}`,
            },
          });
        }
      }

      // Cập nhật borrow header
      const newBorrowReturned = borrow.returnedQuantity + returnedThisTimeTotal;
      const newBorrowRemaining = borrow.remainingQuantity - returnedThisTimeTotal;
      const newStatus =
        newBorrowRemaining <= 0
          ? ProductBorrowStatus.RETURNED
          : ProductBorrowStatus.PARTIALLY_RETURNED;

      const updated = await tx.supplierProductBorrow.update({
        where: { id: borrow.id },
        data: {
          returnedQuantity: newBorrowReturned,
          remainingQuantity: newBorrowRemaining,
          status: newStatus,
        },
        include: { items: true },
      });

      return {
        updated,
        returnedThisTimeTotal,
        newBorrowRemaining,
        newBorrowReturned,
        newStatus,
      };
    });

    // Ghi vết Audit Trail
    await this.auditService.log({
      tenantId,
      userId,
      action: 'PRODUCT_BORROW_RETURNED',
      entityType: 'SupplierProductBorrow',
      entityId: borrow.id,
      oldValues: {
        borrowCode: borrow.borrowCode,
        status: borrow.status,
        remainingQuantity: borrow.remainingQuantity,
        returnedQuantity: borrow.returnedQuantity,
      },
      newValues: {
        borrowCode: borrow.borrowCode,
        status: result.newStatus,
        returnedThisTime: result.returnedThisTimeTotal,
        remainingQuantity: result.newBorrowRemaining,
        returnedQuantity: result.newBorrowReturned,
        returnedItems: dto.items.map((r) => {
          const it = borrow.items.find((item) => item.id === r.itemId);
          return { sku: it?.sku, productName: it?.productName, returnQuantity: r.returnQuantity };
        }),
      },
    });

    return result.updated;
  }

  async convertToPurchase(tenantId: string, userId: string, dto: ConvertBorrowToPurchaseDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 sản phẩm cần chuyển sang mua hàng');
    }

    const borrow = await this.prisma.supplierProductBorrow.findFirst({
      where: { id: dto.borrowId, tenantId },
      include: { items: true, supplier: true, warehouse: true },
    });
    if (!borrow) {
      throw new NotFoundException('Không tìm thấy phiếu mượn hàng');
    }

    if (borrow.type !== ProductBorrowType.BORROW_FROM_SUPPLIER) {
      throw new BadRequestException('Chỉ có thể chuyển sang mua hàng với các phiếu shop mượn hàng từ NCC');
    }

    let receiptCode = dto.receiptCode?.trim().toUpperCase();
    if (!receiptCode) {
      receiptCode = await this.generateUniqueReceiptCode(tenantId);
    } else {
      const existing = await this.prisma.purchaseReceipt.findUnique({
        where: { tenantId_receiptCode: { tenantId, receiptCode } },
      });
      if (existing) {
        receiptCode = await this.generateUniqueReceiptCode(tenantId);
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let totalItemsAmount = 0;
      let convertedThisTimeTotal = 0;
      const receiptItemsData = [];

      for (const conv of dto.items) {
        const item = borrow.items.find((it) => it.id === conv.itemId);
        if (!item) {
          throw new NotFoundException(`Sản phẩm với ID ${conv.itemId} không thuộc phiếu mượn này`);
        }

        if (conv.purchaseQuantity > item.remainingQuantity) {
          throw new BadRequestException(
            `Số lượng mua đứt cho SKU ${item.sku} (${conv.purchaseQuantity}) vượt quá số lượng còn mượn (${item.remainingQuantity})`,
          );
        }

        const subtotal = conv.purchaseQuantity * conv.unitPrice;
        totalItemsAmount += subtotal;
        convertedThisTimeTotal += conv.purchaseQuantity;

        receiptItemsData.push({
          tenantId,
          variantId: item.variantId,
          productName: item.productName,
          variationName: item.variationName,
          sku: item.sku,
          orderedQuantity: conv.purchaseQuantity,
          receivedQuantity: conv.purchaseQuantity,
          disputedQuantity: 0,
          unitPrice: new Prisma.Decimal(conv.unitPrice),
          subtotal: new Prisma.Decimal(subtotal),
          note: `Mua đứt từ phiếu mượn ${borrow.borrowCode}`,
        });

        // Cập nhật item trong phiếu mượn
        await tx.supplierProductBorrowItem.update({
          where: { id: item.id },
          data: {
            purchasedQuantity: item.purchasedQuantity + conv.purchaseQuantity,
            remainingQuantity: item.remainingQuantity - conv.purchaseQuantity,
          },
        });
      }

      // 1. Tạo Phiếu Nhập Kho Mua Hàng chính thức (PurchaseReceipt)
      // LƯU Ý BẤT BIẾN KHO: Không cộng onHand lần 2 vì hàng đã ở trong kho từ lúc mượn!
      const receipt = await tx.purchaseReceipt.create({
        data: {
          tenantId,
          shopId: dto.shopId || null,
          warehouseId: borrow.warehouseId,
          supplierId: borrow.supplierId,
          receiptCode,
          receiptDate: new Date(),
          paymentDueDate: dto.paymentDueDate ? new Date(dto.paymentDueDate) : null,
          totalItemsAmount: new Prisma.Decimal(totalItemsAmount),
          discountAmount: new Prisma.Decimal(0),
          taxAmount: new Prisma.Decimal(0),
          shippingFee: new Prisma.Decimal(0),
          payableAmount: new Prisma.Decimal(totalItemsAmount),
          paidAmount: new Prisma.Decimal(0),
          returnDeductionAmount: new Prisma.Decimal(0),
          remainingAmount: new Prisma.Decimal(totalItemsAmount),
          receivingStatus: PurchaseReceivingStatus.RECEIVED,
          paymentStatus: PurchasePaymentStatus.UNPAID,
          note: dto.note?.trim() || `Chuyển thành mua hàng từ phiếu mượn ${borrow.borrowCode}`,
          createdById: userId,
          items: {
            create: receiptItemsData,
          },
        },
      });

      // 2. Cập nhật phiếu mượn
      const newBorrowPurchased = borrow.purchasedQuantity + convertedThisTimeTotal;
      const newBorrowRemaining = borrow.remainingQuantity - convertedThisTimeTotal;
      const newStatus =
        newBorrowRemaining <= 0
          ? ProductBorrowStatus.CONVERTED_TO_PURCHASE
          : ProductBorrowStatus.PARTIALLY_RETURNED;

      const updatedBorrow = await tx.supplierProductBorrow.update({
        where: { id: borrow.id },
        data: {
          purchasedQuantity: newBorrowPurchased,
          remainingQuantity: newBorrowRemaining,
          status: newStatus,
        },
        include: { items: true },
      });

      return {
        borrow: updatedBorrow,
        purchaseReceipt: receipt,
        convertedThisTimeTotal,
        totalItemsAmount,
      };
    });

    // 3. Ghi vết Audit Trail
    await this.auditService.log({
      tenantId,
      userId,
      action: 'PRODUCT_BORROW_CONVERTED',
      entityType: 'SupplierProductBorrow',
      entityId: borrow.id,
      oldValues: {
        borrowCode: borrow.borrowCode,
        remainingQuantity: borrow.remainingQuantity,
        purchasedQuantity: borrow.purchasedQuantity,
      },
      newValues: {
        borrowCode: borrow.borrowCode,
        receiptCode: result.purchaseReceipt.receiptCode,
        receiptId: result.purchaseReceipt.id,
        convertedThisTime: result.convertedThisTimeTotal,
        totalItemsAmount: result.totalItemsAmount,
        remainingQuantity: result.borrow.remainingQuantity,
        purchasedQuantity: result.borrow.purchasedQuantity,
        purchasedItems: dto.items.map((c) => {
          const it = borrow.items.find((item) => item.id === c.itemId);
          return { sku: it?.sku, productName: it?.productName, purchaseQuantity: c.purchaseQuantity, unitPrice: c.unitPrice };
        }),
      },
    });

    return {
      borrow: result.borrow,
      purchaseReceipt: result.purchaseReceipt,
    };
  }

  async findAll(tenantId: string, filter: SupplierProductBorrowFilterDto = {}) {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filter.limit) || 25));
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierProductBorrowWhereInput = {
      tenantId,
      ...(filter.supplierId && { supplierId: filter.supplierId }),
      ...(filter.warehouseId && { warehouseId: filter.warehouseId }),
      ...(filter.type && { type: filter.type }),
      ...(filter.status && { status: filter.status }),
      ...(filter.search && {
        OR: [
          { borrowCode: { contains: filter.search.trim(), mode: 'insensitive' } },
          { supplier: { name: { contains: filter.search.trim(), mode: 'insensitive' } } },
          { supplier: { code: { contains: filter.search.trim(), mode: 'insensitive' } } },
          { note: { contains: filter.search.trim(), mode: 'insensitive' } },
          {
            items: {
              some: {
                OR: [
                  { sku: { contains: filter.search.trim(), mode: 'insensitive' } },
                  { productName: { contains: filter.search.trim(), mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      }),
    };

    const [total, items, allForSummary] = await Promise.all([
      this.prisma.supplierProductBorrow.count({ where }),
      this.prisma.supplierProductBorrow.findMany({
        where,
        skip,
        take: limit,
        orderBy: { borrowDate: 'desc' },
        include: {
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
              phone: true,
              bankName: true,
              bankAccount: true,
              bankBeneficiary: true,
            },
          },
          warehouse: {
            select: { id: true, code: true, name: true },
          },
          items: true,
        },
      }),
      this.prisma.supplierProductBorrow.findMany({
        where: { tenantId },
        select: {
          type: true,
          totalQuantity: true,
          remainingQuantity: true,
          estimatedTotalAmount: true,
          status: true,
          dueDate: true,
        },
      }),
    ]);

    const now = new Date();
    let totalBorrowedRemaining = 0;
    let totalEstimatedBorrowedValue = 0;
    let totalLentRemaining = 0;
    let overdueCount = 0;

    for (const b of allForSummary) {
      if (b.status !== ProductBorrowStatus.CANCELLED) {
        if (b.type === ProductBorrowType.BORROW_FROM_SUPPLIER) {
          totalBorrowedRemaining += b.remainingQuantity;
          totalEstimatedBorrowedValue += Number(b.estimatedTotalAmount || 0);
        } else if (b.type === ProductBorrowType.LEND_TO_SUPPLIER) {
          totalLentRemaining += b.remainingQuantity;
        }

        if (
          b.dueDate &&
          b.dueDate < now &&
          b.remainingQuantity > 0 &&
          b.status !== ProductBorrowStatus.RETURNED &&
          b.status !== ProductBorrowStatus.CONVERTED_TO_PURCHASE
        ) {
          overdueCount++;
        }
      }
    }

    return {
      items,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalBorrowedRemaining,
        totalEstimatedBorrowedValue,
        totalLentRemaining,
        overdueCount,
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const borrow = await this.prisma.supplierProductBorrow.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        warehouse: true,
        items: {
          include: {
            variant: {
              select: { id: true, sku: true, name: true, unit: true, costPrice: true },
            },
          },
        },
      },
    });

    if (!borrow) {
      throw new NotFoundException('Không tìm thấy phiếu mượn hàng');
    }

    const [ledgers, auditLogs] = await Promise.all([
      this.prisma.inventoryLedger.findMany({
        where: {
          tenantId,
          referenceId: id,
        },
        include: {
          variant: {
            select: { id: true, sku: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.findMany({
        where: {
          tenantId,
          entityId: id,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      ...borrow,
      ledgers,
      auditLogs,
    };
  }
}
