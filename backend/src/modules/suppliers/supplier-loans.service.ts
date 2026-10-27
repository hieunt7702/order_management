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
  CreateSupplierLoanDto,
  CreateSupplierLoanRepaymentDto,
  SupplierLoanFilterDto,
} from './dto/supplier-loan.dto';
import {
  Prisma,
  SupplierLoanType,
  SupplierLoanStatus,
  CashAccountType,
  CashCategoryType,
  CashTransactionType,
  CashTransactionStatus,
} from '@prisma/client';

@Injectable()
export class SupplierLoansService {
  private readonly logger = new Logger(SupplierLoansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async generateUniqueLoanCode(tenantId: string, type: SupplierLoanType): Promise<string> {
    const prefix = type === SupplierLoanType.BORROWED_FROM_SUPPLIER ? 'VAY' : 'CHV';
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const base = `${prefix}-${y}${m}${d}`;
    for (let i = 0; i < 100; i++) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `${base}-${rand}`;
      const exists = await this.prisma.supplierLoan.findUnique({
        where: { tenantId_loanCode: { tenantId, loanCode: code } },
      });
      if (!exists) return code;
    }
    return `${base}-${Date.now().toString().slice(-4)}`;
  }

  async generateUniqueRepaymentCode(tenantId: string): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const base = `TRV-${y}${m}${d}`;
    for (let i = 0; i < 100; i++) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `${base}-${rand}`;
      const exists = await this.prisma.supplierLoanRepayment.findUnique({
        where: { tenantId_repaymentCode: { tenantId, repaymentCode: code } },
      });
      if (!exists) return code;
    }
    return `${base}-${Date.now().toString().slice(-4)}`;
  }

  async create(tenantId: string, userId: string, dto: CreateSupplierLoanDto) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Số tiền vay/cho vay phải lớn hơn 0');
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, tenantId },
    });
    if (!supplier) {
      throw new NotFoundException('Không tìm thấy nhà cung cấp');
    }

    const type = dto.type || SupplierLoanType.BORROWED_FROM_SUPPLIER;
    let loanCode = dto.loanCode?.trim().toUpperCase();
    if (!loanCode) {
      loanCode = await this.generateUniqueLoanCode(tenantId, type);
    } else {
      const existing = await this.prisma.supplierLoan.findUnique({
        where: { tenantId_loanCode: { tenantId, loanCode } },
      });
      if (existing) {
        loanCode = await this.generateUniqueLoanCode(tenantId, type);
      }
    }

    const loan = await this.prisma.$transaction(async (tx) => {
      // 1. Tạo khoản vay
      const createdLoan = await tx.supplierLoan.create({
        data: {
          tenantId,
          supplierId: dto.supplierId,
          loanCode,
          type,
          amount: new Prisma.Decimal(dto.amount),
          repaidAmount: new Prisma.Decimal(0),
          remainingAmount: new Prisma.Decimal(dto.amount),
          interestRate: new Prisma.Decimal(dto.interestRate || 0),
          loanDate: dto.loanDate ? new Date(dto.loanDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: SupplierLoanStatus.ACTIVE,
          fundAccountId: dto.fundAccountId || null,
          paymentMethod: dto.paymentMethod || 'BANK_TRANSFER',
          referenceCode: dto.referenceCode?.trim() || null,
          note: dto.note?.trim() || null,
          createdById: userId,
        },
      });

      // 2. Tự động ghi nhận giao dịch dòng tiền (CashTransaction) nếu chọn tài khoản tiền
      let targetAccountId = dto.fundAccountId || null;
      if (!targetAccountId && dto.fundSource) {
        const accType =
          dto.fundSource === 'BANK_ACCOUNT' ? CashAccountType.BANK : CashAccountType.CASH;
        const defaultAcc = await tx.cashAccount.findFirst({
          where: { tenantId, type: accType, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (defaultAcc) targetAccountId = defaultAcc.id;
      }

      if (targetAccountId) {
        const isBorrow = type === SupplierLoanType.BORROWED_FROM_SUPPLIER;
        const categoryCode = isBorrow ? 'VAY_VON_NCC' : 'CHO_NCC_VAY';
        const categoryType = isBorrow ? CashCategoryType.CAPITAL : CashCategoryType.EXPENSE;

        let category = await tx.cashCategory.findFirst({
          where: { tenantId, code: categoryCode },
        });
        if (!category) {
          category = await tx.cashCategory.create({
            data: {
              tenantId,
              code: categoryCode,
              name: isBorrow ? 'Vay vốn nhà cung cấp' : 'Cho nhà cung cấp vay vốn',
              type: categoryType,
              isSystemDefault: true,
            },
          });
        }

        const txAmount = new Prisma.Decimal(dto.amount);
        await tx.cashTransaction.create({
          data: {
            tenantId,
            transactionCode: loanCode,
            type: isBorrow ? CashTransactionType.CAPITAL_IN : CashTransactionType.EXPENSE,
            categoryId: category.id,
            fromAccountId: isBorrow ? null : targetAccountId,
            toAccountId: isBorrow ? targetAccountId : null,
            amount: txAmount,
            transactionDate: dto.loanDate ? new Date(dto.loanDate) : new Date(),
            paymentMethod: dto.paymentMethod || 'BANK_TRANSFER',
            status: CashTransactionStatus.CONFIRMED,
            counterpartyName: supplier.name,
            performedByName: 'Hệ thống',
            referenceCode: dto.referenceCode?.trim() || loanCode,
            note: isBorrow
              ? `Nhận tiền vay vốn từ NCC ${supplier.name} (Hợp đồng: ${loanCode})`
              : `Giải ngân cho NCC ${supplier.name} vay vốn (Hợp đồng: ${loanCode})`,
            relatedEntityType: 'SUPPLIER_LOAN',
            relatedEntityId: createdLoan.id,
            createdById: userId,
            confirmedById: userId,
            confirmedAt: new Date(),
          },
        });

        // Cập nhật số dư tài khoản tiền
        if (isBorrow) {
          await tx.cashAccount.update({
            where: { id: targetAccountId },
            data: { currentBalance: { increment: txAmount } },
          });
        } else {
          await tx.cashAccount.update({
            where: { id: targetAccountId },
            data: { currentBalance: { decrement: txAmount } },
          });
        }
      }

      return createdLoan;
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'SUPPLIER_LOAN_CREATED',
      entityType: 'SupplierLoan',
      entityId: loan.id,
      newValues: {
        loanCode,
        type,
        supplierId: dto.supplierId,
        supplierName: supplier?.name,
        amount: dto.amount,
        interestRate: dto.interestRate,
        loanDate: dto.loanDate,
        dueDate: dto.dueDate,
        note: dto.note || undefined,
      },
    });

    return loan;
  }

  async repay(tenantId: string, userId: string, dto: CreateSupplierLoanRepaymentDto) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Số tiền trả nợ phải lớn hơn 0');
    }

    const loan = await this.prisma.supplierLoan.findFirst({
      where: { id: dto.loanId, tenantId },
      include: { supplier: true },
    });
    if (!loan) {
      throw new NotFoundException('Không tìm thấy khoản vay');
    }

    if (loan.status === SupplierLoanStatus.SETTLED) {
      throw new BadRequestException('Khoản vay này đã được tất toán hoàn toàn');
    }

    const remaining = Number(loan.remainingAmount);
    if (dto.amount > remaining) {
      throw new BadRequestException(
        `Số tiền thanh toán (${dto.amount.toLocaleString(
          'vi-VN',
        )}đ) vượt quá dư nợ còn lại (${remaining.toLocaleString('vi-VN')}đ)`,
      );
    }

    let repaymentCode = dto.repaymentCode?.trim().toUpperCase();
    if (!repaymentCode) {
      repaymentCode = await this.generateUniqueRepaymentCode(tenantId);
    } else {
      const existing = await this.prisma.supplierLoanRepayment.findUnique({
        where: { tenantId_repaymentCode: { tenantId, repaymentCode } },
      });
      if (existing) {
        repaymentCode = await this.generateUniqueRepaymentCode(tenantId);
      }
    }

    const currentLoan = loan;
    const repayment = await this.prisma.$transaction(async (tx) => {
      const isBorrow = currentLoan.type === SupplierLoanType.BORROWED_FROM_SUPPLIER;
      const repayAmount = new Prisma.Decimal(dto.amount);
      const newRepaidTotal = Prisma.Decimal.add(loan.repaidAmount, repayAmount);
      const newRemaining = Prisma.Decimal.sub(loan.remainingAmount, repayAmount);
      const newStatus =
        Number(newRemaining) <= 0
          ? SupplierLoanStatus.SETTLED
          : SupplierLoanStatus.PARTIALLY_REPAID;

      // 1. Tạo bản ghi trả nợ
      const repayment = await tx.supplierLoanRepayment.create({
        data: {
          tenantId,
          loanId: dto.loanId,
          repaymentCode,
          amount: repayAmount,
          repaymentDate: dto.repaymentDate ? new Date(dto.repaymentDate) : new Date(),
          payerName: dto.payerName?.trim() || null,
          fromAccountId: isBorrow ? dto.accountId || null : null,
          toAccountId: !isBorrow ? dto.accountId || null : null,
          paymentMethod: dto.paymentMethod || 'BANK_TRANSFER',
          referenceCode: dto.referenceCode?.trim() || null,
          note: dto.note?.trim() || null,
          createdById: userId,
        },
      });

      // 2. Cập nhật khoản vay
      await tx.supplierLoan.update({
        where: { id: dto.loanId },
        data: {
          repaidAmount: newRepaidTotal,
          remainingAmount: newRemaining,
          status: newStatus,
        },
      });

      // 3. Cập nhật dòng tiền Sổ quỹ
      let targetAccountId = dto.accountId || null;
      if (!targetAccountId && dto.fundSource) {
        const accType =
          dto.fundSource === 'BANK_ACCOUNT' ? CashAccountType.BANK : CashAccountType.CASH;
        const defaultAcc = await tx.cashAccount.findFirst({
          where: { tenantId, type: accType, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (defaultAcc) targetAccountId = defaultAcc.id;
      }

      if (targetAccountId) {
        const categoryCode = isBorrow ? 'TRA_NO_VAY_NCC' : 'THU_HOI_NO_VAY_NCC';
        const categoryType = isBorrow ? CashCategoryType.EXPENSE : CashCategoryType.INCOME;

        let category = await tx.cashCategory.findFirst({
          where: { tenantId, code: categoryCode },
        });
        if (!category) {
          category = await tx.cashCategory.create({
            data: {
              tenantId,
              code: categoryCode,
              name: isBorrow ? 'Trả nợ vay nhà cung cấp' : 'Thu hồi nợ cho NCC vay',
              type: categoryType,
              isSystemDefault: true,
            },
          });
        }

        await tx.cashTransaction.create({
          data: {
            tenantId,
            transactionCode: repaymentCode,
            type: isBorrow ? CashTransactionType.EXPENSE : CashTransactionType.INCOME,
            categoryId: category.id,
            fromAccountId: isBorrow ? targetAccountId : null,
            toAccountId: isBorrow ? null : targetAccountId,
            amount: repayAmount,
            transactionDate: dto.repaymentDate ? new Date(dto.repaymentDate) : new Date(),
            paymentMethod: dto.paymentMethod || 'BANK_TRANSFER',
            status: CashTransactionStatus.CONFIRMED,
            counterpartyName: loan.supplier.name,
            performedByName: dto.payerName?.trim() || null,
            referenceCode: dto.referenceCode?.trim() || repaymentCode,
            note: isBorrow
              ? `Trả nợ vay cho NCC ${loan.supplier.name} (Hợp đồng: ${loan.loanCode})`
              : `Thu hồi nợ vay từ NCC ${loan.supplier.name} (Hợp đồng: ${loan.loanCode})`,
            relatedEntityType: 'SUPPLIER_LOAN_REPAYMENT',
            relatedEntityId: repayment.id,
            createdById: userId,
            confirmedById: userId,
            confirmedAt: new Date(),
          },
        });

        if (isBorrow) {
          await tx.cashAccount.update({
            where: { id: targetAccountId },
            data: { currentBalance: { decrement: repayAmount } },
          });
        } else {
          await tx.cashAccount.update({
            where: { id: targetAccountId },
            data: { currentBalance: { increment: repayAmount } },
          });
        }
      }

      return repayment;
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'SUPPLIER_LOAN_REPAID',
      entityType: 'SupplierLoan',
      entityId: currentLoan.id,
      newValues: {
        loanCode: currentLoan.loanCode,
        repaymentCode,
        amount: dto.amount,
        remainingAmount: Number(currentLoan.remainingAmount) - dto.amount,
        repaymentDate: dto.repaymentDate,
        note: dto.note || undefined,
      },
    });

    return repayment;
  }

  async findAll(tenantId: string, filter: SupplierLoanFilterDto = {}) {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filter.limit) || 25));
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierLoanWhereInput = {
      tenantId,
      ...(filter.supplierId && { supplierId: filter.supplierId }),
      ...(filter.type && { type: filter.type }),
      ...(filter.status && { status: filter.status }),
      ...(filter.search && {
        OR: [
          { loanCode: { contains: filter.search.trim(), mode: 'insensitive' } },
          { referenceCode: { contains: filter.search.trim(), mode: 'insensitive' } },
          { supplier: { name: { contains: filter.search.trim(), mode: 'insensitive' } } },
          { supplier: { code: { contains: filter.search.trim(), mode: 'insensitive' } } },
          { note: { contains: filter.search.trim(), mode: 'insensitive' } },
        ],
      }),
    };

    const [total, items, allLoansForSummary] = await Promise.all([
      this.prisma.supplierLoan.count({ where }),
      this.prisma.supplierLoan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { loanDate: 'desc' },
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
          repayments: {
            orderBy: { repaymentDate: 'desc' },
          },
        },
      }),
      this.prisma.supplierLoan.findMany({
        where: { tenantId },
        select: {
          type: true,
          amount: true,
          remainingAmount: true,
          status: true,
        },
      }),
    ]);

    // KPI Summary
    let totalBorrowed = 0;
    let totalRemainingDebt = 0;
    let totalLent = 0;
    let totalRemainingReceivable = 0;

    for (const l of allLoansForSummary) {
      if (l.status !== SupplierLoanStatus.CANCELLED) {
        if (l.type === SupplierLoanType.BORROWED_FROM_SUPPLIER) {
          totalBorrowed += Number(l.amount);
          totalRemainingDebt += Number(l.remainingAmount);
        } else if (l.type === SupplierLoanType.LENT_TO_SUPPLIER) {
          totalLent += Number(l.amount);
          totalRemainingReceivable += Number(l.remainingAmount);
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
        totalBorrowed,
        totalRemainingDebt,
        totalLent,
        totalRemainingReceivable,
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const loan = await this.prisma.supplierLoan.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        repayments: {
          orderBy: { repaymentDate: 'desc' },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException('Không tìm thấy khoản vay');
    }

    return loan;
  }

  async delete(tenantId: string, id: string, userId?: string) {
    const loan = await this.prisma.supplierLoan.findFirst({
      where: { id, tenantId },
      include: {
        repayments: true,
        supplier: true,
      },
    });

    if (!loan) {
      throw new NotFoundException('Không tìm thấy khoản vay');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Hoàn tác số dư dòng tiền và xóa CashTransaction của các đợt trả nợ liên quan
      for (const rep of loan.repayments) {
        const repTx = await tx.cashTransaction.findFirst({
          where: {
            tenantId,
            relatedEntityType: 'SUPPLIER_LOAN_REPAYMENT',
            relatedEntityId: rep.id,
          },
        });

        if (repTx) {
          if (repTx.fromAccountId) {
            await tx.cashAccount.update({
              where: { id: repTx.fromAccountId },
              data: { currentBalance: { increment: repTx.amount } },
            });
          }
          if (repTx.toAccountId) {
            await tx.cashAccount.update({
              where: { id: repTx.toAccountId },
              data: { currentBalance: { decrement: repTx.amount } },
            });
          }
          await tx.cashTransaction.delete({ where: { id: repTx.id } });
        }
      }

      // Xóa các đợt trả nợ
      await tx.supplierLoanRepayment.deleteMany({
        where: { loanId: id, tenantId },
      });

      // 2. Hoàn tác số dư dòng tiền và xóa CashTransaction ban đầu của khoản vay
      const loanTx = await tx.cashTransaction.findFirst({
        where: {
          tenantId,
          relatedEntityType: 'SUPPLIER_LOAN',
          relatedEntityId: id,
        },
      });

      if (loanTx) {
        if (loanTx.fromAccountId) {
          await tx.cashAccount.update({
            where: { id: loanTx.fromAccountId },
            data: { currentBalance: { increment: loanTx.amount } },
          });
        }
        if (loanTx.toAccountId) {
          await tx.cashAccount.update({
            where: { id: loanTx.toAccountId },
            data: { currentBalance: { decrement: loanTx.amount } },
          });
        }
        await tx.cashTransaction.delete({ where: { id: loanTx.id } });
      }

      // 3. Xóa bản ghi khoản vay
      await tx.supplierLoan.delete({
        where: { id },
      });

      // 4. Audit Log
      await this.auditService.log({
        tenantId,
        userId: userId || 'SYSTEM',
        action: 'SUPPLIER_LOAN_CANCELLED',
        entityType: 'SupplierLoan',
        entityId: id,
        oldValues: {
          loanCode: loan.loanCode,
          type: loan.type,
          supplierId: loan.supplierId,
          supplierName: loan.supplier?.name,
          amount: Number(loan.amount),
          repaidAmount: Number(loan.repaidAmount),
          remainingAmount: Number(loan.remainingAmount),
          loanDate: loan.loanDate,
        },
      });
    });

    return { success: true, message: 'Đã hoàn tác và hủy khoản vay thành công' };
  }

  async deleteRepayment(tenantId: string, repaymentId: string, userId?: string) {
    const repayment = await this.prisma.supplierLoanRepayment.findFirst({
      where: { id: repaymentId, tenantId },
      include: { loan: true },
    });

    if (!repayment) {
      throw new NotFoundException('Không tìm thấy đợt trả nợ');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Revert CashTransaction
      const repTx = await tx.cashTransaction.findFirst({
        where: {
          tenantId,
          relatedEntityType: 'SUPPLIER_LOAN_REPAYMENT',
          relatedEntityId: repaymentId,
        },
      });

      if (repTx) {
        if (repTx.fromAccountId) {
          await tx.cashAccount.update({
            where: { id: repTx.fromAccountId },
            data: { currentBalance: { increment: repTx.amount } },
          });
        }
        if (repTx.toAccountId) {
          await tx.cashAccount.update({
            where: { id: repTx.toAccountId },
            data: { currentBalance: { decrement: repTx.amount } },
          });
        }
        await tx.cashTransaction.delete({ where: { id: repTx.id } });
      }

      // 2. Khôi phục remainingAmount và repaidAmount của loan
      const newRepaidTotal = Prisma.Decimal.sub(repayment.loan.repaidAmount, repayment.amount);
      const newRemaining = Prisma.Decimal.add(repayment.loan.remainingAmount, repayment.amount);
      const newStatus =
        Number(newRepaidTotal) <= 0
          ? SupplierLoanStatus.ACTIVE
          : SupplierLoanStatus.PARTIALLY_REPAID;

      await tx.supplierLoan.update({
        where: { id: repayment.loanId },
        data: {
          repaidAmount: newRepaidTotal,
          remainingAmount: newRemaining,
          status: newStatus,
        },
      });

      // 3. Xóa repayment
      await tx.supplierLoanRepayment.delete({
        where: { id: repaymentId },
      });

      // 4. Audit Log
      await this.auditService.log({
        tenantId,
        userId: userId || 'SYSTEM',
        action: 'SUPPLIER_LOAN_REPAYMENT_CANCELLED',
        entityType: 'SupplierLoanRepayment',
        entityId: repaymentId,
        oldValues: {
          repaymentCode: repayment.repaymentCode,
          amount: Number(repayment.amount),
          loanId: repayment.loanId,
        },
      });
    });

    return { success: true, message: 'Đã hoàn tác đợt trả nợ thành công' };
  }
}
