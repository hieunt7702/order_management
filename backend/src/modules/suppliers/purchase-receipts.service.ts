import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreatePurchaseReceiptDto,
  UpdatePurchaseReceiptDto,
  PurchaseReceiptFilterDto,
} from './dto/purchase-receipt.dto';
import { Prisma, InventoryMovementType } from '@prisma/client';

@Injectable()
export class PurchaseReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateReceiptCode(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PNK-${y}${m}${d}-${rand}`;
  }

  async create(tenantId: string, userId: string, dto: CreatePurchaseReceiptDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Phiếu nhập phải có ít nhất 1 sản phẩm');
    }

    // Kiểm tra NCC và Kho
    const [supplier, warehouse] = await Promise.all([
      this.prisma.supplier.findFirst({ where: { id: dto.supplierId, tenantId } }),
      this.prisma.warehouse.findFirst({ where: { id: dto.warehouseId, tenantId } }),
    ]);

    if (!supplier) throw new NotFoundException('Không tìm thấy nhà cung cấp');
    if (!warehouse) throw new NotFoundException('Không tìm thấy kho nhập hàng');

    const receiptCode = dto.receiptCode?.trim().toUpperCase() || this.generateReceiptCode();

    const existingCode = await this.prisma.purchaseReceipt.findUnique({
      where: { tenantId_receiptCode: { tenantId, receiptCode } },
    });
    if (existingCode) {
      throw new ConflictException(`Mã phiếu nhập '${receiptCode}' đã tồn tại trong workspace`);
    }

    // 1. Tính toán giá trị hàng thực nhận (totalItemsAmount)
    let totalItemsAmount = 0;
    const itemsData = dto.items.map((it) => {
      const subtotal = (it.receivedQuantity || 0) * (it.unitPrice || 0);
      totalItemsAmount += subtotal;
      return {
        tenantId,
        variantId: it.variantId,
        productName: it.productName.trim(),
        variationName: it.variationName?.trim() || null,
        sku: it.sku.trim(),
        orderedQuantity: it.orderedQuantity || 1,
        receivedQuantity: it.receivedQuantity !== undefined ? it.receivedQuantity : it.orderedQuantity,
        disputedQuantity: it.disputedQuantity || 0,
        unitPrice: new Prisma.Decimal(it.unitPrice || 0),
        subtotal: new Prisma.Decimal(subtotal),
        note: it.note?.trim() || null,
      };
    });

    const discountAmount = dto.discountAmount || 0;
    const taxAmount = dto.taxAmount || 0;
    const shippingFee = dto.shippingFee || 0;
    const isShippingPaidToSupplier =
      dto.shippingFeePayerType === 'PAID_TO_SUPPLIER' || !dto.shippingFeePayerType;

    // 2. Tính toán công nợ phải trả (payableAmount)
    // Nếu phí vận chuyển trả cho NCC -> cộng vào nợ; nếu trả riêng bên vận chuyển -> không cộng vào nợ NCC
    const payableAmount =
      totalItemsAmount -
      discountAmount +
      taxAmount +
      (isShippingPaidToSupplier ? shippingFee : 0);

    // Xác định trạng thái nhận hàng
    const totalOrdered = itemsData.reduce((acc, it) => acc + it.orderedQuantity, 0);
    const totalReceived = itemsData.reduce((acc, it) => acc + it.receivedQuantity, 0);

    let receivingStatus: 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'PENDING_RECEIVE' = 'RECEIVED';
    if (totalReceived === 0) {
      receivingStatus = 'PENDING_RECEIVE';
    } else if (totalReceived < totalOrdered) {
      receivingStatus = 'PARTIALLY_RECEIVED';
    }

    // 3. Thực thi Transaction đảm bảo Bất biến Sổ cái Kho & Công nợ
    return this.prisma.$transaction(async (tx) => {
      // A. Tạo phiếu nhập PurchaseReceipt
      const receipt = await tx.purchaseReceipt.create({
        data: {
          tenantId,
          supplierId: dto.supplierId,
          shopId: dto.shopId || null,
          warehouseId: dto.warehouseId,
          receiptCode,
          receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : new Date(),
          paymentDueDate: dto.paymentDueDate ? new Date(dto.paymentDueDate) : null,
          totalItemsAmount: new Prisma.Decimal(totalItemsAmount),
          discountAmount: new Prisma.Decimal(discountAmount),
          taxAmount: new Prisma.Decimal(taxAmount),
          shippingFee: new Prisma.Decimal(shippingFee),
          shippingFeePayerType: dto.shippingFeePayerType || 'PAID_TO_SUPPLIER',
          payableAmount: new Prisma.Decimal(payableAmount),
          paidAmount: new Prisma.Decimal(0),
          returnDeductionAmount: new Prisma.Decimal(0),
          remainingAmount: new Prisma.Decimal(payableAmount),
          receivingStatus,
          paymentStatus: 'UNPAID',
          dueStatus: 'NOT_DUE',
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
          shop: true,
        },
      });

      // B. Cộng tồn kho onHand và ghi bút toán Sổ cái InventoryLedger bất biến
      for (const item of itemsData) {
        if (item.receivedQuantity > 0) {
          // Upsert InventoryBalance
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
              onHand: item.receivedQuantity,
              reserved: 0,
            },
            update: {
              onHand: { increment: item.receivedQuantity },
            },
          });

          // Ghi InventoryLedger (RECEIVE)
          await tx.inventoryLedger.create({
            data: {
              tenantId,
              warehouseId: dto.warehouseId,
              variantId: item.variantId,
              movementType: InventoryMovementType.RECEIVE,
              deltaOnHand: item.receivedQuantity,
              deltaReserved: 0,
              referenceType: 'PURCHASE_RECEIPT',
              referenceId: receipt.id,
              performedByUserId: userId,
              note: `Nhập kho theo phiếu ${receiptCode} từ NCC ${supplier.name}`,
            },
          });
        }
      }

      // C. Xử lý thanh toán ngay (Immediate Payment) nếu có
      if (dto.immediatePayment && dto.immediatePaymentAmount && dto.immediatePaymentAmount > 0) {
        const payAmount = Math.min(dto.immediatePaymentAmount, payableAmount);
        const advancePortion = Math.max(0, dto.immediatePaymentAmount - payableAmount);

        const paymentCode = `PC-${receiptCode.replace('PNK-', '')}`;

        const payment = await tx.supplierPayment.create({
          data: {
            tenantId,
            supplierId: dto.supplierId,
            paymentCode,
            amount: new Prisma.Decimal(dto.immediatePaymentAmount),
            paymentDate: new Date(),
            payerName: dto.immediatePayerName?.trim() || 'Người tạo phiếu',
            payerUserId: userId,
            fundSource: dto.immediateFundSource || 'CASH_FUND',
            paymentMethod: dto.immediatePaymentMethod || 'BANK_TRANSFER',
            referenceCode: receiptCode,
            paymentType: 'PAYMENT',
            allocatedAmount: new Prisma.Decimal(payAmount),
            advanceAmount: new Prisma.Decimal(advancePortion),
            isReimbursementNeeded: dto.immediateFundSource === 'PERSONAL_FUND',
            reimbursementStatus:
              dto.immediateFundSource === 'PERSONAL_FUND'
                ? 'PENDING_REIMBURSEMENT'
                : 'NOT_APPLICABLE',
            note: `Thanh toán ngay khi nhập hàng phiếu ${receiptCode}`,
            createdById: userId,
          },
        });

        // Tạo allocation
        await tx.paymentAllocation.create({
          data: {
            tenantId,
            paymentId: payment.id,
            receiptId: receipt.id,
            allocatedAmount: new Prisma.Decimal(payAmount),
            note: 'Thanh toán ngay lúc nhận hàng',
          },
        });

        const newRemaining = Math.max(0, payableAmount - payAmount);
        const newPaymentStatus =
          newRemaining === 0 ? 'PAID' : payAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

        await tx.purchaseReceipt.update({
          where: { id: receipt.id },
          data: {
            paidAmount: new Prisma.Decimal(payAmount),
            remainingAmount: new Prisma.Decimal(newRemaining),
            paymentStatus: newPaymentStatus,
          },
        });
      }

      return receipt;
    });
  }

  async findAll(tenantId: string, filter: PurchaseReceiptFilterDto = {}) {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filter.limit) || 25));
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseReceiptWhereInput = {
      tenantId,
      ...(filter.supplierId && { supplierId: filter.supplierId }),
      ...(filter.shopId && { shopId: filter.shopId }),
      ...(filter.warehouseId && { warehouseId: filter.warehouseId }),
      ...(filter.paymentStatus && { paymentStatus: filter.paymentStatus }),
      ...(filter.receivingStatus && { receivingStatus: filter.receivingStatus }),
      ...(filter.search && {
        OR: [
          { receiptCode: { contains: filter.search, mode: 'insensitive' } },
          { supplier: { name: { contains: filter.search, mode: 'insensitive' } } },
          { supplier: { code: { contains: filter.search, mode: 'insensitive' } } },
          { note: { contains: filter.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, receipts] = await Promise.all([
      this.prisma.purchaseReceipt.count({ where }),
      this.prisma.purchaseReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { receiptDate: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, code: true, phone: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          shop: { select: { id: true, name: true, code: true } },
          items: true,
          paymentAllocations: {
            include: {
              payment: {
                select: {
                  id: true,
                  paymentCode: true,
                  paymentDate: true,
                  payerName: true,
                  fundSource: true,
                  paymentMethod: true,
                  referenceCode: true,
                },
              },
            },
          },
          purchaseReturns: {
            where: { status: 'CONFIRMED' },
            select: { id: true, returnCode: true, debtOffsetAmount: true, returnDate: true },
          },
        },
      }),
    ]);

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const items = receipts.map((r) => {
      let calculatedDueStatus: 'NOT_DUE' | 'DUE_SOON' | 'OVERDUE' = 'NOT_DUE';
      if (r.paymentDueDate && Number(r.remainingAmount) > 0) {
        const dueDate = new Date(r.paymentDueDate);
        if (dueDate < now) {
          calculatedDueStatus = 'OVERDUE';
        } else if (dueDate <= sevenDaysLater) {
          calculatedDueStatus = 'DUE_SOON';
        }
      }

      return {
        ...r,
        dueStatus: calculatedDueStatus,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(tenantId: string, id: string) {
    const receipt = await this.prisma.purchaseReceipt.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        warehouse: true,
        shop: true,
        items: {
          include: {
            variant: {
              select: { id: true, sku: true, barcode: true, name: true, unit: true },
            },
          },
        },
        paymentAllocations: {
          orderBy: { createdAt: 'desc' },
          include: {
            payment: true,
          },
        },
        purchaseReturns: {
          orderBy: { returnDate: 'desc' },
          include: {
            items: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Không tìm thấy phiếu nhập hàng');
    }

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    let calculatedDueStatus: 'NOT_DUE' | 'DUE_SOON' | 'OVERDUE' = 'NOT_DUE';

    if (receipt.paymentDueDate && Number(receipt.remainingAmount) > 0) {
      const dueDate = new Date(receipt.paymentDueDate);
      if (dueDate < now) {
        calculatedDueStatus = 'OVERDUE';
      } else if (dueDate <= sevenDaysLater) {
        calculatedDueStatus = 'DUE_SOON';
      }
    }

    return {
      ...receipt,
      dueStatus: calculatedDueStatus,
    };
  }

  async update(tenantId: string, id: string, dto: UpdatePurchaseReceiptDto) {
    await this.findOne(tenantId, id);

    return this.prisma.purchaseReceipt.update({
      where: { id },
      data: {
        ...(dto.paymentDueDate !== undefined && {
          paymentDueDate: dto.paymentDueDate ? new Date(dto.paymentDueDate) : null,
        }),
        ...(dto.note !== undefined && { note: dto.note?.trim() || null }),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const receipt = await this.findOne(tenantId, id);

    if (Number(receipt.paidAmount) > 0) {
      throw new BadRequestException(
        'Không thể xóa phiếu nhập đã có giao dịch thanh toán. Vui lòng hủy các phiếu chi liên quan trước.'
      );
    }

    if (receipt.purchaseReturns.length > 0) {
      throw new BadRequestException(
        'Không thể xóa phiếu nhập đã phát sinh phiếu trả hàng nhà cung cấp.'
      );
    }

    // Hoàn trả lại tồn kho đã cộng khi nhập
    return this.prisma.$transaction(async (tx) => {
      for (const item of receipt.items) {
        if (item.receivedQuantity > 0) {
          await tx.inventoryBalance.update({
            where: {
              tenantId_warehouseId_variantId: {
                tenantId,
                warehouseId: receipt.warehouseId,
                variantId: item.variantId,
              },
            },
            data: {
              onHand: { decrement: item.receivedQuantity },
            },
          });

          await tx.inventoryLedger.create({
            data: {
              tenantId,
              warehouseId: receipt.warehouseId,
              variantId: item.variantId,
              movementType: InventoryMovementType.ADJUST,
              deltaOnHand: -item.receivedQuantity,
              deltaReserved: 0,
              referenceType: 'CANCEL_PURCHASE_RECEIPT',
              referenceId: receipt.id,
              note: `Hủy phiếu nhập ${receipt.receiptCode}`,
            },
          });
        }
      }

      await tx.purchaseReceipt.delete({ where: { id } });
      return { success: true, message: 'Đã xóa phiếu nhập và hoàn lại tồn kho thành công' };
    });
  }
}
