import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateSupplierTransferDto,
  SupplierTransferFilterDto,
} from './dto/supplier-transfer.dto';
import { Prisma, PurchasePaymentStatus } from '@prisma/client';

@Injectable()
export class SupplierTransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async generateUniqueTransferCode(tenantId: string): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const base = `CKNCC-${y}${m}${d}`;

    for (let i = 0; i < 100; i++) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `${base}-${rand}`;
      const exists = await this.prisma.supplierTransfer.findUnique({
        where: { tenantId_transferCode: { tenantId, transferCode: code } },
      });
      if (!exists) return code;
    }
    return `${base}-${Date.now().toString().slice(-4)}`;
  }

  async create(tenantId: string, userId: string, dto: CreateSupplierTransferDto) {
    if (dto.fromSupplierId === dto.toSupplierId) {
      throw new BadRequestException('Nhà cung cấp chuyển (A) và nhà cung cấp nhận (B) không được trùng nhau');
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('Số tiền chuyển phải lớn hơn 0');
    }

    const [fromSupplier, toSupplier] = await Promise.all([
      this.prisma.supplier.findFirst({ where: { id: dto.fromSupplierId, tenantId } }),
      this.prisma.supplier.findFirst({ where: { id: dto.toSupplierId, tenantId } }),
    ]);

    if (!fromSupplier) {
      throw new NotFoundException('Không tìm thấy nhà cung cấp chuyển tiền (NCC A)');
    }
    if (!toSupplier) {
      throw new NotFoundException('Không tìm thấy nhà cung cấp nhận tiền (NCC B)');
    }

    let transferCode = dto.transferCode?.trim().toUpperCase();
    if (!transferCode) {
      transferCode = await this.generateUniqueTransferCode(tenantId);
    } else {
      const existing = await this.prisma.supplierTransfer.findUnique({
        where: { tenantId_transferCode: { tenantId, transferCode } },
      });
      if (existing) {
        transferCode = await this.generateUniqueTransferCode(tenantId);
      }
    }

    const allocations = dto.allocations || [];
    let allocatedTotal = 0;
    for (const alloc of allocations) {
      if (alloc.amount <= 0) {
        throw new BadRequestException('Số tiền phân bổ phải lớn hơn 0');
      }
      allocatedTotal += alloc.amount;
    }

    if (allocatedTotal > dto.amount) {
      throw new BadRequestException(
        `Tổng số tiền phân bổ (${allocatedTotal.toLocaleString('vi-VN')}đ) không được vượt quá số tiền chuyển (${dto.amount.toLocaleString('vi-VN')}đ)`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo bản ghi SupplierTransfer
      const transfer = await tx.supplierTransfer.create({
        data: {
          tenantId,
          transferCode,
          fromSupplierId: dto.fromSupplierId,
          toSupplierId: dto.toSupplierId,
          amount: new Prisma.Decimal(dto.amount),
          transferDate: dto.transferDate ? new Date(dto.transferDate) : new Date(),
          payerName: dto.payerName.trim(),
          referenceCode: dto.referenceCode?.trim() || null,
          voucherImage: dto.voucherImage?.trim() || null,
          note: dto.note?.trim() || null,
          createdById: userId,
        },
        include: {
          fromSupplier: { select: { id: true, code: true, name: true, phone: true } },
          toSupplier: { select: { id: true, code: true, name: true, phone: true } },
        },
      });

      // 2. Nếu có phân bổ phiếu nhập của NCC B, xử lý phân bổ và giảm công nợ phiếu
      if (allocations.length > 0) {
        for (const alloc of allocations) {
          const receipt = await tx.purchaseReceipt.findFirst({
            where: { id: alloc.receiptId, tenantId, supplierId: dto.toSupplierId },
          });

          if (!receipt) {
            throw new NotFoundException(
              `Không tìm thấy phiếu nhập '${alloc.receiptId}' của nhà cung cấp nhận '${toSupplier.name}'`,
            );
          }

          await tx.supplierTransferAllocation.create({
            data: {
              tenantId,
              transferId: transfer.id,
              receiptId: alloc.receiptId,
              allocatedAmount: new Prisma.Decimal(alloc.amount),
              note: alloc.note?.trim() || null,
            },
          });

          // Cập nhật số tiền đã trả và còn nợ trên phiếu nhập
          const currentPaid = Number(receipt.paidAmount);
          const currentPayable = Number(receipt.payableAmount);
          const currentReturnDeduction = Number(receipt.returnDeductionAmount);

          const newPaid = currentPaid + alloc.amount;
          const newRemaining = Math.max(0, currentPayable - newPaid - currentReturnDeduction);

          let newStatus: PurchasePaymentStatus = PurchasePaymentStatus.PARTIALLY_PAID;
          if (newRemaining <= 0) {
            newStatus = PurchasePaymentStatus.PAID;
          } else if (newPaid <= 0) {
            newStatus = PurchasePaymentStatus.UNPAID;
          }

          await tx.purchaseReceipt.update({
            where: { id: alloc.receiptId },
            data: {
              paidAmount: new Prisma.Decimal(newPaid),
              remainingAmount: new Prisma.Decimal(newRemaining),
              paymentStatus: newStatus,
            },
          });
        }
      }

      // 3. Ghi Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'SUPPLIER_TRANSFER_CREATE',
          entityType: 'SupplierTransfer',
          entityId: transfer.id,
          newValues: {
            transferCode,
            fromSupplierId: dto.fromSupplierId,
            fromSupplierName: fromSupplier.name,
            toSupplierId: dto.toSupplierId,
            toSupplierName: toSupplier.name,
            amount: dto.amount,
            allocatedTotal,
            note: dto.note,
          },
        },
      });

      return transfer;
    });
  }

  async findAll(tenantId: string, filter: SupplierTransferFilterDto = {}) {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierTransferWhereInput = {
      tenantId,
      ...(filter.fromSupplierId && { fromSupplierId: filter.fromSupplierId }),
      ...(filter.toSupplierId && { toSupplierId: filter.toSupplierId }),
      ...(filter.supplierId && {
        OR: [
          { fromSupplierId: filter.supplierId },
          { toSupplierId: filter.supplierId },
        ],
      }),
      ...(filter.startDate || filter.endDate
        ? {
            transferDate: {
              ...(filter.startDate && { gte: new Date(filter.startDate) }),
              ...(filter.endDate && { lte: new Date(filter.endDate) }),
            },
          }
        : {}),
      ...(filter.search && {
        OR: [
          { transferCode: { contains: filter.search, mode: 'insensitive' } },
          { note: { contains: filter.search, mode: 'insensitive' } },
          { payerName: { contains: filter.search, mode: 'insensitive' } },
          { referenceCode: { contains: filter.search, mode: 'insensitive' } },
          { fromSupplier: { name: { contains: filter.search, mode: 'insensitive' } } },
          { fromSupplier: { code: { contains: filter.search, mode: 'insensitive' } } },
          { toSupplier: { name: { contains: filter.search, mode: 'insensitive' } } },
          { toSupplier: { code: { contains: filter.search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.supplierTransfer.count({ where }),
      this.prisma.supplierTransfer.findMany({
        where,
        orderBy: { transferDate: 'desc' },
        skip,
        take: limit,
        include: {
          fromSupplier: {
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
          toSupplier: {
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
          allocations: {
            include: {
              receipt: {
                select: {
                  id: true,
                  receiptCode: true,
                  payableAmount: true,
                  paidAmount: true,
                  remainingAmount: true,
                  paymentStatus: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const formattedData = data.map((t) => ({
      ...t,
      amount: Number(t.amount),
      allocations: t.allocations.map((a) => ({
        ...a,
        allocatedAmount: Number(a.allocatedAmount),
        receipt: {
          ...a.receipt,
          payableAmount: Number(a.receipt.payableAmount),
          paidAmount: Number(a.receipt.paidAmount),
          remainingAmount: Number(a.receipt.remainingAmount),
        },
      })),
    }));

    return {
      data: formattedData,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const t = await this.prisma.supplierTransfer.findFirst({
      where: { id, tenantId },
      include: {
        fromSupplier: true,
        toSupplier: true,
        allocations: {
          include: {
            receipt: true,
          },
        },
      },
    });

    if (!t) {
      throw new NotFoundException('Không tìm thấy giao dịch chuyển tiền giữa 2 nhà cung cấp');
    }

    return {
      ...t,
      amount: Number(t.amount),
      allocations: t.allocations.map((a) => ({
        ...a,
        allocatedAmount: Number(a.allocatedAmount),
        receipt: {
          ...a.receipt,
          totalItemsAmount: Number(a.receipt.totalItemsAmount),
          discountAmount: Number(a.receipt.discountAmount),
          taxAmount: Number(a.receipt.taxAmount),
          shippingFee: Number(a.receipt.shippingFee),
          payableAmount: Number(a.receipt.payableAmount),
          paidAmount: Number(a.receipt.paidAmount),
          remainingAmount: Number(a.receipt.remainingAmount),
        },
      })),
    };
  }

  async delete(tenantId: string, id: string, userId?: string) {
    const transfer = await this.prisma.supplierTransfer.findFirst({
      where: { id, tenantId },
      include: {
        allocations: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException('Không tìm thấy giao dịch chuyển tiền');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Hoàn tác phân bổ phiếu nhập nếu có
      for (const alloc of transfer.allocations) {
        const receipt = await tx.purchaseReceipt.findFirst({
          where: { id: alloc.receiptId, tenantId },
        });

        if (receipt) {
          const currentPaid = Number(receipt.paidAmount);
          const currentPayable = Number(receipt.payableAmount);
          const currentReturnDeduction = Number(receipt.returnDeductionAmount);

          const newPaid = Math.max(0, currentPaid - Number(alloc.allocatedAmount));
          const newRemaining = Math.max(0, currentPayable - newPaid - currentReturnDeduction);

          let newStatus: PurchasePaymentStatus = PurchasePaymentStatus.PARTIALLY_PAID;
          if (newRemaining <= 0) {
            newStatus = PurchasePaymentStatus.PAID;
          } else if (newPaid <= 0) {
            newStatus = PurchasePaymentStatus.UNPAID;
          }

          await tx.purchaseReceipt.update({
            where: { id: alloc.receiptId },
            data: {
              paidAmount: new Prisma.Decimal(newPaid),
              remainingAmount: new Prisma.Decimal(newRemaining),
              paymentStatus: newStatus,
            },
          });
        }
      }

      // 2. Xóa allocations & transfer
      await tx.supplierTransferAllocation.deleteMany({
        where: { transferId: id, tenantId },
      });

      await tx.supplierTransfer.delete({
        where: { id },
      });

      // 3. Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'SUPPLIER_TRANSFER_DELETE',
          entityType: 'SupplierTransfer',
          entityId: id,
          oldValues: {
            transferCode: transfer.transferCode,
            fromSupplierId: transfer.fromSupplierId,
            toSupplierId: transfer.toSupplierId,
            amount: Number(transfer.amount),
          },
        },
      });
    });

    return { success: true, message: 'Đã hủy giao dịch chuyển tiền giữa 2 nhà cung cấp thành công' };
  }
}
