import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierFilterDto,
} from './dto/supplier.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateSupplierDto) {
    const existing = await this.prisma.supplier.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: dto.code.trim().toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Mã nhà cung cấp '${dto.code}' đã tồn tại trong workspace`);
    }

    return this.prisma.supplier.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        address: dto.address?.trim() || null,
        bankName: dto.bankName?.trim() || null,
        bankAccount: dto.bankAccount?.trim() || null,
        bankBeneficiary: dto.bankBeneficiary?.trim() || null,
        openingDebt: new Prisma.Decimal(dto.openingDebt || 0),
        status: dto.status || 'ACTIVE',
        note: dto.note?.trim() || null,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateSupplierDto) {
    await this.findOne(tenantId, id);

    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
        ...(dto.address !== undefined && { address: dto.address?.trim() || null }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName?.trim() || null }),
        ...(dto.bankAccount !== undefined && { bankAccount: dto.bankAccount?.trim() || null }),
        ...(dto.bankBeneficiary !== undefined && { bankBeneficiary: dto.bankBeneficiary?.trim() || null }),
        ...(dto.openingDebt !== undefined && { openingDebt: new Prisma.Decimal(dto.openingDebt) }),
        ...(dto.status && { status: dto.status }),
        ...(dto.note !== undefined && { note: dto.note?.trim() || null }),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const supplier = await this.findOne(tenantId, id);

    // Kiểm tra ràng buộc phiếu nhập & thanh toán
    const receiptCount = await this.prisma.purchaseReceipt.count({
      where: { tenantId, supplierId: id },
    });
    const paymentCount = await this.prisma.supplierPayment.count({
      where: { tenantId, supplierId: id },
    });

    if (receiptCount > 0 || paymentCount > 0) {
      // Soft-deactivate if historical data exists
      await this.prisma.supplier.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });
      return {
        success: true,
        message: 'Nhà cung cấp đã có lịch sử giao dịch/phiếu nhập nên đã được chuyển sang trạng thái Ngừng hoạt động (INACTIVE) để bảo toàn số liệu công nợ.',
      };
    }

    await this.prisma.supplier.delete({ where: { id } });
    return { success: true, message: 'Đã xóa nhà cung cấp thành công' };
  }

  async findAll(tenantId: string, filter: SupplierFilterDto = {}) {
    const where: Prisma.SupplierWhereInput = {
      tenantId,
      ...(filter.status && { status: filter.status }),
      ...(filter.search && {
        OR: [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { code: { contains: filter.search, mode: 'insensitive' } },
          { phone: { contains: filter.search, mode: 'insensitive' } },
        ],
      }),
    };

    const suppliers = await this.prisma.supplier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        purchaseReceipts: {
          select: {
            id: true,
            payableAmount: true,
            paidAmount: true,
            returnDeductionAmount: true,
            remainingAmount: true,
            paymentStatus: true,
            dueStatus: true,
          },
        },
        supplierPayments: {
          select: {
            id: true,
            amount: true,
            allocatedAmount: true,
            advanceAmount: true,
            paymentType: true,
          },
        },
        purchaseReturns: {
          select: {
            id: true,
            totalReturnAmount: true,
            debtOffsetAmount: true,
            status: true,
          },
        },
      },
    });

    // Tính toán công nợ chuẩn kế toán cho từng NCC
    return suppliers.map((s) => {
      const openingDebt = Number(s.openingDebt || 0);

      const totalPurchases = s.purchaseReceipts.reduce(
        (sum, r) => sum + Number(r.payableAmount || 0),
        0
      );

      const totalReceiptsRemaining = s.purchaseReceipts.reduce(
        (sum, r) => sum + Number(r.remainingAmount || 0),
        0
      );

      const totalReturns = s.purchaseReturns
        .filter((ret) => ret.status === 'CONFIRMED')
        .reduce((sum, ret) => sum + Number(ret.debtOffsetAmount || 0), 0);

      const totalPaid = s.supplierPayments
        .filter((p) => p.paymentType === 'PAYMENT' || p.paymentType === 'ADVANCE_DEPOSIT')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const totalRefunded = s.supplierPayments
        .filter((p) => p.paymentType === 'REFUND_RECEIVED')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const advanceAmountHeld = s.supplierPayments.reduce(
        (sum, p) => sum + Number(p.advanceAmount || 0),
        0
      );

      // Công thức chuẩn kế toán:
      // Số dư cuối kỳ = Nợ đầu kỳ + Phát sinh phải trả - Giảm trừ công nợ - Tiền đã trả + Tiền NCC hoàn lại
      const closingDebt =
        openingDebt + totalPurchases - totalReturns - totalPaid + totalRefunded;

      return {
        id: s.id,
        code: s.code,
        name: s.name,
        phone: s.phone,
        email: s.email,
        address: s.address,
        bankName: s.bankName,
        bankAccount: s.bankAccount,
        bankBeneficiary: s.bankBeneficiary,
        status: s.status,
        note: s.note,
        openingDebt,
        totalPurchases,
        totalReturns,
        totalPaid,
        totalRefunded,
        advanceAmountHeld,
        totalReceiptsRemaining,
        closingDebt, // > 0: Shop nợ NCC; < 0: NCC giữ tiền ứng trước/dư của shop; = 0: Cân bằng
        receiptCount: s.purchaseReceipts.length,
        createdAt: s.createdAt,
      };
    });
  }

  async findOne(tenantId: string, id: string) {
    const s = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
      include: {
        purchaseReceipts: {
          orderBy: { receiptDate: 'desc' },
          include: {
            shop: { select: { id: true, name: true, code: true } },
            warehouse: { select: { id: true, name: true, code: true } },
          },
        },
        supplierPayments: {
          orderBy: { paymentDate: 'desc' },
          include: {
            allocations: {
              include: {
                receipt: { select: { id: true, receiptCode: true, payableAmount: true } },
              },
            },
          },
        },
        purchaseReturns: {
          orderBy: { returnDate: 'desc' },
        },
      },
    });

    if (!s) {
      throw new NotFoundException('Không tìm thấy nhà cung cấp');
    }

    const openingDebt = Number(s.openingDebt || 0);

    const totalPurchases = s.purchaseReceipts.reduce(
      (sum, r) => sum + Number(r.payableAmount || 0),
      0
    );

    const totalReceiptsRemaining = s.purchaseReceipts.reduce(
      (sum, r) => sum + Number(r.remainingAmount || 0),
      0
    );

    const totalReturns = s.purchaseReturns
      .filter((ret) => ret.status === 'CONFIRMED')
      .reduce((sum, ret) => sum + Number(ret.debtOffsetAmount || 0), 0);

    const totalPaid = s.supplierPayments
      .filter((p) => p.paymentType === 'PAYMENT' || p.paymentType === 'ADVANCE_DEPOSIT')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const totalRefunded = s.supplierPayments
      .filter((p) => p.paymentType === 'REFUND_RECEIVED')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const advanceAmountHeld = s.supplierPayments.reduce(
      (sum, p) => sum + Number(p.advanceAmount || 0),
      0
    );

    const closingDebt =
      openingDebt + totalPurchases - totalReturns - totalPaid + totalRefunded;

    return {
      ...s,
      openingDebt,
      totalPurchases,
      totalReturns,
      totalPaid,
      totalRefunded,
      advanceAmountHeld,
      totalReceiptsRemaining,
      closingDebt,
    };
  }

  // Bảng sao kê đối soát thời gian thực (Chronological Ledger Statement)
  async getStatement(
    tenantId: string,
    supplierId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const supplier = await this.findOne(tenantId, supplierId);

    // Gộp tất cả giao dịch: Phiếu nhập (+), Phiếu chi (-), Trả hàng (-), Hoàn tiền (+)
    const events: Array<{
      date: Date;
      type: 'OPENING' | 'RECEIPT' | 'PAYMENT' | 'RETURN' | 'REFUND';
      code: string;
      description: string;
      increaseDebt: number; // Phát sinh nợ (+)
      decreaseDebt: number; // Giảm nợ (-)
      payerOrCreator?: string;
      fundSource?: string;
      referenceId: string;
    }> = [];

    // Nợ đầu kỳ
    if (supplier.openingDebt !== 0) {
      events.push({
        date: supplier.createdAt,
        type: 'OPENING',
        code: 'SO-DU-DAU-KY',
        description: 'Số dư nợ đầu kỳ thiết lập ban đầu',
        increaseDebt: supplier.openingDebt > 0 ? supplier.openingDebt : 0,
        decreaseDebt: supplier.openingDebt < 0 ? Math.abs(supplier.openingDebt) : 0,
        referenceId: supplier.id,
      });
    }

    // Phiếu nhập hàng
    supplier.purchaseReceipts.forEach((r: any) => {
      events.push({
        date: r.receiptDate,
        type: 'RECEIPT',
        code: r.receiptCode,
        description: `Nhập kho theo phiếu ${r.receiptCode} (Kho: ${r.warehouse?.name || 'N/A'})`,
        increaseDebt: Number(r.payableAmount || 0),
        decreaseDebt: 0,
        referenceId: r.id,
      });
    });

    // Phiếu chi / Thanh toán
    supplier.supplierPayments.forEach((p: any) => {
      if (p.paymentType === 'REFUND_RECEIVED') {
        events.push({
          date: p.paymentDate,
          type: 'REFUND',
          code: p.paymentCode,
          description: `Nhà cung cấp hoàn lại tiền (Người nhận: ${p.payerName})`,
          increaseDebt: Number(p.amount || 0),
          decreaseDebt: 0,
          payerOrCreator: p.payerName,
          fundSource: p.fundSource,
          referenceId: p.id,
        });
      } else {
        events.push({
          date: p.paymentDate,
          type: 'PAYMENT',
          code: p.paymentCode,
          description: `Thanh toán chi tiền cho NCC (${p.payerName} chi từ ${p.fundSource})`,
          increaseDebt: 0,
          decreaseDebt: Number(p.amount || 0),
          payerOrCreator: p.payerName,
          fundSource: p.fundSource,
          referenceId: p.id,
        });
      }
    });

    // Phiếu trả hàng
    supplier.purchaseReturns.forEach((ret: any) => {
      if (ret.status === 'CONFIRMED') {
        events.push({
          date: ret.returnDate,
          type: 'RETURN',
          code: ret.returnCode,
          description: `Trả hàng cho NCC được xác nhận giảm trừ nợ: ${ret.reason || 'Trả hàng lỗi'}`,
          increaseDebt: 0,
          decreaseDebt: Number(ret.debtOffsetAmount || 0),
          referenceId: ret.id,
        });
      }
    });

    // Sắp xếp theo ngày tăng dần và tính số dư luỹ kế
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const statementWithRunningBalance = events.map((ev) => {
      runningBalance += ev.increaseDebt - ev.decreaseDebt;
      return {
        ...ev,
        runningBalance,
      };
    });

    let filteredTransactions = statementWithRunningBalance;
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      filteredTransactions = filteredTransactions.filter(
        (t) => new Date(t.date).getTime() >= startMs,
      );
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime();
      filteredTransactions = filteredTransactions.filter(
        (t) => new Date(t.date).getTime() <= endMs,
      );
    }

    return {
      supplier: {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        phone: supplier.phone,
        closingDebt: supplier.closingDebt,
        advanceAmountHeld: supplier.advanceAmountHeld,
      },
      transactions: filteredTransactions,
    };
  }

  // Báo cáo tổng hợp công nợ & cảnh báo hạn nợ
  async getDebtReports(tenantId: string) {
    const suppliers = await this.findAll(tenantId);

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Lấy tất cả phiếu nhập còn nợ
    const pendingReceipts = await this.prisma.purchaseReceipt.findMany({
      where: {
        tenantId,
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        remainingAmount: { gt: 0 },
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        shop: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { paymentDueDate: 'asc' },
    });

    let totalPayable = 0;
    let overduePayable = 0;
    let dueSoonPayable = 0;
    let totalAdvanceHeld = 0;

    suppliers.forEach((s) => {
      if (s.closingDebt > 0) totalPayable += s.closingDebt;
      totalAdvanceHeld += s.advanceAmountHeld;
    });

    const categorizedReceipts = pendingReceipts.map((r) => {
      const remaining = Number(r.remainingAmount || 0);
      let calculatedDueStatus: 'NOT_DUE' | 'DUE_SOON' | 'OVERDUE' = 'NOT_DUE';
      let overdueDays = 0;

      if (r.paymentDueDate) {
        const dueDate = new Date(r.paymentDueDate);
        if (dueDate < now) {
          calculatedDueStatus = 'OVERDUE';
          overduePayable += remaining;
          overdueDays = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        } else if (dueDate <= sevenDaysLater) {
          calculatedDueStatus = 'DUE_SOON';
          dueSoonPayable += remaining;
        }
      }

      return {
        ...r,
        remainingAmount: remaining,
        calculatedDueStatus,
        overdueDays,
      };
    });

    // Thống kê người thanh toán & các khoản cần hoàn trả chi hộ
    const personalFundPayments = await this.prisma.supplierPayment.findMany({
      where: {
        tenantId,
        fundSource: 'PERSONAL_FUND',
      },
      orderBy: { paymentDate: 'desc' },
      include: {
        supplier: { select: { name: true, code: true } },
      },
    });

    const pendingReimbursements = personalFundPayments
      .filter((p) => p.isReimbursementNeeded && p.reimbursementStatus === 'PENDING_REIMBURSEMENT')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // Thống kê tổng chi theo người thanh toán
    const paymentsByPayer: Record<string, { count: number; totalAmount: number; personalPaid: number }> = {};
    const allPayments = await this.prisma.supplierPayment.findMany({
      where: { tenantId },
    });

    allPayments.forEach((p) => {
      const payer = p.payerName || 'Khác';
      if (!paymentsByPayer[payer]) {
        paymentsByPayer[payer] = { count: 0, totalAmount: 0, personalPaid: 0 };
      }
      paymentsByPayer[payer].count += 1;
      paymentsByPayer[payer].totalAmount += Number(p.amount || 0);
      if (p.fundSource === 'PERSONAL_FUND') {
        paymentsByPayer[payer].personalPaid += Number(p.amount || 0);
      }
    });

    const overdueList = categorizedReceipts
      .filter((r) => r.calculatedDueStatus === 'OVERDUE')
      .map((r) => ({
        receiptId: r.id,
        receiptCode: r.receiptCode,
        supplierId: r.supplierId,
        supplierName: r.supplier?.name || '',
        payableAmount: Number(r.payableAmount || 0),
        remainingAmount: r.remainingAmount,
        paymentDueDate: r.paymentDueDate ? r.paymentDueDate.toISOString() : '',
        overdueDays: r.overdueDays,
      }));

    const dueSoonList = categorizedReceipts
      .filter((r) => r.calculatedDueStatus === 'DUE_SOON')
      .map((r) => ({
        receiptId: r.id,
        receiptCode: r.receiptCode,
        supplierId: r.supplierId,
        supplierName: r.supplier?.name || '',
        remainingAmount: r.remainingAmount,
        paymentDueDate: r.paymentDueDate ? r.paymentDueDate.toISOString() : '',
      }));

    const reimbursementNeeds = personalFundPayments
      .filter((p) => p.isReimbursementNeeded && p.reimbursementStatus === 'PENDING_REIMBURSEMENT')
      .map((p) => ({
        paymentId: p.id,
        paymentCode: p.paymentCode,
        payerName: p.payerName || 'Cá nhân',
        amount: Number(p.amount || 0),
        paymentDate: p.paymentDate ? p.paymentDate.toISOString() : '',
        supplierName: p.supplier?.name || '',
      }));

    const summary = {
      totalSuppliers: suppliers.length,
      totalDebtPayable: totalPayable,
      totalAdvanceHeld: totalAdvanceHeld,
      totalOverdueDebt: overduePayable,
      totalDueSoonDebt: dueSoonPayable,
      pendingReimbursementCount: reimbursementNeeds.length,
      totalPendingReimbursement: pendingReimbursements,
    };

    return {
      summary,
      overdueList,
      dueSoonList,
      reimbursementNeeds,
      // Backward compatibility fields:
      kpis: {
        totalPayable,
        overduePayable,
        dueSoonPayable,
        totalAdvanceHeld,
        pendingReimbursements,
        supplierCount: suppliers.length,
      },
      overdueReceipts: categorizedReceipts.filter((r) => r.calculatedDueStatus === 'OVERDUE'),
      dueSoonReceipts: categorizedReceipts.filter((r) => r.calculatedDueStatus === 'DUE_SOON'),
      pendingReceipts: categorizedReceipts,
      paymentsByPayer: Object.entries(paymentsByPayer).map(([payer, data]) => ({
        payer,
        ...data,
      })),
      personalFundPayments,
    };
  }
}
