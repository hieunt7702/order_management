import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateSupplierPaymentDto,
  SupplierPaymentFilterDto,
} from './dto/supplier-payment.dto';
import {
  Prisma,
  SupplierPaymentType,
  FundSourceType,
  ReimbursementStatus,
  PurchasePaymentStatus,
  CashAccountType,
  CashCategoryType,
  CashTransactionType,
  CashTransactionStatus,
} from '@prisma/client';

@Injectable()
export class SupplierPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateUniquePaymentCode(tenantId: string, type: SupplierPaymentType): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = type === SupplierPaymentType.REFUND_RECEIVED ? 'PT' : 'PC';
    const base = `${prefix}-${y}${m}${d}`;
    for (let i = 0; i < 100; i++) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `${base}-${rand}`;
      const exists = await this.prisma.supplierPayment.findUnique({
        where: { tenantId_paymentCode: { tenantId, paymentCode: code } },
      });
      if (!exists) return code;
    }
    return `${base}-${Date.now().toString().slice(-4)}`;
  }

  async create(tenantId: string, userId: string, dto: CreateSupplierPaymentDto) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, tenantId },
    });

    if (!supplier) {
      throw new NotFoundException('Không tìm thấy nhà cung cấp');
    }

    const paymentType = dto.paymentType || SupplierPaymentType.PAYMENT;
    let paymentCode = dto.paymentCode?.trim().toUpperCase();
    if (!paymentCode) {
      paymentCode = await this.generateUniquePaymentCode(tenantId, paymentType);
    } else {
      const existingCode = await this.prisma.supplierPayment.findUnique({
        where: { tenantId_paymentCode: { tenantId, paymentCode } },
      });
      if (existingCode) {
        paymentCode = await this.generateUniquePaymentCode(tenantId, paymentType);
      }
    }

    const isPersonalFund = dto.fundSource === FundSourceType.PERSONAL_FUND;
    const isReimbursementNeeded =
      dto.isReimbursementNeeded !== undefined ? dto.isReimbursementNeeded : isPersonalFund;
    const reimbursementStatus = isReimbursementNeeded
      ? ReimbursementStatus.PENDING_REIMBURSEMENT
      : ReimbursementStatus.NOT_APPLICABLE;

    const allocations = dto.allocations || [];
    let allocatedTotal = 0;

    for (const alloc of allocations) {
      if (alloc.amount < 0) {
        throw new BadRequestException('Số tiền phân bổ không được âm');
      }
      allocatedTotal += alloc.amount;
    }

    if (allocatedTotal > dto.amount && paymentType !== SupplierPaymentType.REFUND_RECEIVED) {
      throw new BadRequestException(
        `Tổng số tiền phân bổ (${allocatedTotal.toLocaleString(
          'vi-VN',
        )}đ) không được vượt quá số tiền chi (${dto.amount.toLocaleString('vi-VN')}đ)`,
      );
    }

    let advanceAmount = 0;
    if (paymentType === SupplierPaymentType.ADVANCE_DEPOSIT) {
      advanceAmount = dto.amount;
    } else if (allocations.length > 0) {
      advanceAmount = Math.max(0, dto.amount - allocatedTotal);
    } else {
      // Thanh toán nợ chung không qua phiếu nhập (ví dụ: trả nợ đầu kỳ)
      const sup = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, tenantId },
        include: {
          purchaseReceipts: { select: { payableAmount: true } },
          purchaseReturns: { where: { status: 'CONFIRMED' }, select: { debtOffsetAmount: true } },
          supplierPayments: { where: { paymentType: { in: ['PAYMENT', 'ADVANCE_DEPOSIT'] } }, select: { amount: true } },
        },
      });
      if (sup) {
        const opening = Number(sup.openingDebt || 0);
        const purchases = sup.purchaseReceipts.reduce((sum, r) => sum + Number(r.payableAmount || 0), 0);
        const returns = sup.purchaseReturns.reduce((sum, r) => sum + Number(r.debtOffsetAmount || 0), 0);
        const paid = sup.supplierPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const currentDebt = Math.max(0, opening + purchases - returns - paid);
        advanceAmount = Math.max(0, dto.amount - currentDebt);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo phiếu chi / giao dịch thanh toán
      const payment = await tx.supplierPayment.create({
        data: {
          tenantId,
          supplierId: dto.supplierId,
          paymentCode,
          amount: new Prisma.Decimal(dto.amount),
          allocatedAmount: new Prisma.Decimal(allocatedTotal),
          advanceAmount: new Prisma.Decimal(advanceAmount),
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          payerName: dto.payerName.trim(),
          payerUserId: userId,
          fundSource: dto.fundSource,
          paymentMethod: dto.paymentMethod || (dto.fundSource === FundSourceType.CASH_FUND ? 'CASH' : 'BANK_TRANSFER'),
          referenceCode: dto.referenceCode?.trim() || null,
          voucherImage: dto.voucherImage?.trim() || null,
          paymentType,
          isReimbursementNeeded,
          reimbursementStatus,
          note: dto.note?.trim() || null,
          createdById: userId,
        },
      });

      // 2. Xử lý phân bổ tiền cho các phiếu nhập
      if (allocations.length > 0) {
        for (const alloc of allocations) {
          if (alloc.amount <= 0) continue;

          const receipt = await tx.purchaseReceipt.findFirst({
            where: { id: alloc.receiptId, tenantId, supplierId: dto.supplierId },
          });

          if (!receipt) {
            throw new NotFoundException(
              `Không tìm thấy phiếu nhập '${alloc.receiptId}' của nhà cung cấp này`,
            );
          }

          // Tạo bản ghi phân bổ
          await tx.paymentAllocation.create({
            data: {
              tenantId,
              paymentId: payment.id,
              receiptId: alloc.receiptId,
              allocatedAmount: new Prisma.Decimal(alloc.amount),
              note: alloc.note?.trim() || null,
            },
          });

          // Cập nhật số tiền đã trả và trạng thái trên phiếu nhập
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

      // 3. Tự động ghi nhận vào Sổ thu chi (CashTransaction) để đồng bộ dữ liệu tài chính
      let fromAccountId: string | null = null;
      let toAccountId: string | null = null;

      if (dto.fundSource === FundSourceType.CASH_FUND) {
        const cashAcc = await tx.cashAccount.findFirst({
          where: { tenantId, type: CashAccountType.CASH, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (cashAcc) fromAccountId = cashAcc.id;
      } else if (dto.fundSource === FundSourceType.BANK_ACCOUNT) {
        const bankAcc = await tx.cashAccount.findFirst({
          where: { tenantId, type: CashAccountType.BANK, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (bankAcc) fromAccountId = bankAcc.id;
      }

      const isRefund = paymentType === SupplierPaymentType.REFUND_RECEIVED;
      const targetCategoryCode = isRefund ? 'THU_NCC_HOAN_TIEN' : 'CHI_NHAP_HANG';
      const targetCategoryType = isRefund ? CashCategoryType.INCOME : CashCategoryType.EXPENSE;

      let category = await tx.cashCategory.findFirst({
        where: { tenantId, code: targetCategoryCode },
      });
      if (!category) {
        category = await tx.cashCategory.findFirst({
          where: { tenantId, type: targetCategoryType },
        });
      }
      if (!category) {
        category = await tx.cashCategory.create({
          data: {
            tenantId,
            code: targetCategoryCode,
            name: isRefund ? 'Nhà cung cấp hoàn tiền' : 'Thanh toán nhập hàng',
            type: targetCategoryType,
            isSystemDefault: true,
          },
        });
      }

      if (isRefund) {
        toAccountId = fromAccountId;
        fromAccountId = null;
      }

      const txAmount = new Prisma.Decimal(dto.amount);
      await tx.cashTransaction.create({
        data: {
          tenantId,
          transactionCode: paymentCode,
          type: isRefund ? CashTransactionType.INCOME : CashTransactionType.EXPENSE,
          categoryId: category.id,
          fromAccountId,
          toAccountId,
          amount: txAmount,
          transactionDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          paymentMethod:
            dto.paymentMethod ||
            (dto.fundSource === FundSourceType.CASH_FUND ? 'CASH' : 'BANK_TRANSFER'),
          status: CashTransactionStatus.CONFIRMED,
          counterpartyName: supplier.name,
          performedByName: dto.payerName?.trim() || null,
          referenceCode: dto.referenceCode?.trim() || paymentCode,
          voucherImage: dto.voucherImage?.trim() || null,
          note: dto.note?.trim() || `Thanh toán nợ nhà cung cấp ${supplier.name}`,
          relatedEntityType: 'SUPPLIER_PAYMENT',
          relatedEntityId: payment.id,
          createdById: userId,
          confirmedById: userId,
          confirmedAt: new Date(),
        },
      });

      // Cập nhật số dư tài khoản tiền nếu không phải tiền cá nhân chi hộ
      if (fromAccountId) {
        await tx.cashAccount.update({
          where: { id: fromAccountId },
          data: { currentBalance: { decrement: txAmount } },
        });
      }
      if (toAccountId) {
        await tx.cashAccount.update({
          where: { id: toAccountId },
          data: { currentBalance: { increment: txAmount } },
        });
      }

      return payment;
    });
  }

  async findAll(tenantId: string, filter: SupplierPaymentFilterDto = {}) {
    const where: Prisma.SupplierPaymentWhereInput = {
      tenantId,
      ...(filter.supplierId && { supplierId: filter.supplierId }),
      ...(filter.fundSource && { fundSource: filter.fundSource }),
      ...(filter.payerName && {
        payerName: { contains: filter.payerName.trim(), mode: 'insensitive' },
      }),
      ...(filter.search && {
        OR: [
          { paymentCode: { contains: filter.search.trim(), mode: 'insensitive' } },
          { payerName: { contains: filter.search.trim(), mode: 'insensitive' } },
          { referenceCode: { contains: filter.search.trim(), mode: 'insensitive' } },
          { note: { contains: filter.search.trim(), mode: 'insensitive' } },
        ],
      }),
    };

    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 25));
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.supplierPayment.count({ where }),
      this.prisma.supplierPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: 'desc' },
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

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const payment = await this.prisma.supplierPayment.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        allocations: {
          include: {
            receipt: {
              select: {
                id: true,
                receiptCode: true,
                receiptDate: true,
                payableAmount: true,
                paidAmount: true,
                remainingAmount: true,
                paymentStatus: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Không tìm thấy phiếu thanh toán');
    }

    return payment;
  }

  async markReimbursed(tenantId: string, id: string, note?: string) {
    const payment = await this.findOne(tenantId, id);

    if (!payment.isReimbursementNeeded) {
      throw new BadRequestException('Giao dịch này không có yêu cầu hoàn trả tiền cá nhân');
    }

    return this.prisma.supplierPayment.update({
      where: { id },
      data: {
        reimbursementStatus: ReimbursementStatus.REIMBURSED,
        ...(note && { note: payment.note ? `${payment.note} | ${note}` : note }),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const payment = await this.prisma.supplierPayment.findFirst({
      where: { id, tenantId },
      include: { allocations: true },
    });

    if (!payment) {
      throw new NotFoundException('Không tìm thấy phiếu thanh toán');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Hoàn lại số tiền đã phân bổ trên các phiếu nhập
      for (const alloc of payment.allocations) {
        const receipt = await tx.purchaseReceipt.findUnique({
          where: { id: alloc.receiptId },
        });

        if (receipt) {
          const currentPaid = Number(receipt.paidAmount);
          const currentPayable = Number(receipt.payableAmount);
          const currentReturnDeduction = Number(receipt.returnDeductionAmount);
          const allocAmount = Number(alloc.allocatedAmount);

          const newPaid = Math.max(0, currentPaid - allocAmount);
          const newRemaining = Math.max(0, currentPayable - newPaid - currentReturnDeduction);

          let newStatus: PurchasePaymentStatus = PurchasePaymentStatus.UNPAID;
          if (newRemaining <= 0) {
            newStatus = PurchasePaymentStatus.PAID;
          } else if (newPaid > 0) {
            newStatus = PurchasePaymentStatus.PARTIALLY_PAID;
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

      // 2. Xóa các phân bổ
      await tx.paymentAllocation.deleteMany({
        where: { paymentId: id },
      });

      // 3. Khôi phục số dư và xóa CashTransaction tương ứng nếu có
      const relatedTx = await tx.cashTransaction.findFirst({
        where: { tenantId, relatedEntityType: 'SUPPLIER_PAYMENT', relatedEntityId: id },
      });
      if (relatedTx) {
        if (relatedTx.fromAccountId) {
          await tx.cashAccount.update({
            where: { id: relatedTx.fromAccountId },
            data: { currentBalance: { increment: relatedTx.amount } },
          });
        }
        if (relatedTx.toAccountId) {
          await tx.cashAccount.update({
            where: { id: relatedTx.toAccountId },
            data: { currentBalance: { decrement: relatedTx.amount } },
          });
        }
        await tx.cashTransaction.delete({
          where: { id: relatedTx.id },
        });
      }

      // 4. Xóa phiếu chi
      await tx.supplierPayment.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Đã hủy phiếu chi và khôi phục lại công nợ các phiếu nhập liên quan',
      };
    });
  }
}
