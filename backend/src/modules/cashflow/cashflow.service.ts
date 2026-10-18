import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateCashAccountDto,
  UpdateCashAccountDto,
  CreateCashCategoryDto,
  UpdateCashCategoryDto,
  CreateCashTransactionDto,
  CreateInternalTransferDto,
  CashflowFilterDto,
} from './dto/cashflow.dto';
import {
  Prisma,
  CashAccountType,
  CashCategoryType,
  CashTransactionType,
  CashTransactionStatus,
  OrderReconciliationStatus,
  PlatformOrderStatus,
} from '@prisma/client';

@Injectable()
export class CashflowService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------
  // 1. SYSTEM DEFAULTS INITIALIZATION
  // -------------------------------------------------------------
  async ensureDefaults(tenantId: string) {
    // 1.1 Khởi tạo Danh mục Thu / Chi mặc định theo đặc tả
    const defaultCategories: Array<{
      code: string;
      name: string;
      type: CashCategoryType;
      description: string;
    }> = [
      // Thu
      {
        code: 'THU_BAN_HANG',
        name: 'Tiền bán hàng trực tiếp',
        type: CashCategoryType.INCOME,
        description: 'Khách chuyển khoản hoặc trả tiền mặt trực tiếp',
      },
      {
        code: 'THU_SHOPEE_QUYET_TOAN',
        name: 'Tiền Shopee quyết toán',
        type: CashCategoryType.INCOME,
        description: 'Tiền sàn Shopee ghi nhận vào số dư của shop',
      },
      {
        code: 'THU_NCC_HOAN_TIEN',
        name: 'Nhà cung cấp hoàn tiền',
        type: CashCategoryType.INCOME,
        description: 'Hoàn tiền hàng trả lại, tiền trả dư cho nhà cung cấp',
      },
      {
        code: 'THU_KHAC',
        name: 'Thu khác',
        type: CashCategoryType.INCOME,
        description: 'Khoản thu ngoài các nhóm trên',
      },
      // Chi
      {
        code: 'CHI_NHAP_HANG',
        name: 'Thanh toán nhập hàng',
        type: CashCategoryType.EXPENSE,
        description: 'Trả tiền theo một hoặc nhiều phiếu nhập kho',
      },
      {
        code: 'CHI_DAT_COC_NCC',
        name: 'Đặt cọc nhà cung cấp',
        type: CashCategoryType.EXPENSE,
        description: 'Chuyển tiền cọc trước khi nhận hàng từ nhà cung cấp',
      },
      {
        code: 'CHI_VAT_TU_DONG_GOI',
        name: 'Vật tư đóng gói',
        type: CashCategoryType.EXPENSE,
        description: 'Xốp, băng dính, thùng carton, túi đóng hàng...',
      },
      {
        code: 'CHI_GIAY_MUC_IN',
        name: 'Giấy in và mực in',
        type: CashCategoryType.EXPENSE,
        description: 'Giấy in vận đơn A6/A7, mực máy in nhiệt',
      },
      {
        code: 'CHI_DUNG_CU_THIET_BI',
        name: 'Dụng cụ, thiết bị',
        type: CashCategoryType.EXPENSE,
        description: 'Máy quét barcode, máy in, cân điện tử, dao cắt...',
      },
      {
        code: 'CHI_VAN_CHUYEN_NGOAI',
        name: 'Vận chuyển ngoài sàn',
        type: CashCategoryType.EXPENSE,
        description: 'Phí thuê xe ba gác, gửi hàng xe khách, bốc xếp...',
      },
      {
        code: 'CHI_VAN_HANH',
        name: 'Vận hành',
        type: CashCategoryType.EXPENSE,
        description: 'Điện nước, thuê kho bãi, nhân công, chi phí phần mềm...',
      },
      {
        code: 'CHI_HOAN_TIEN_KHACH',
        name: 'Hoàn tiền khách',
        type: CashCategoryType.EXPENSE,
        description: 'Khoản shop trực tiếp bồi hoàn trả lại cho khách mua',
      },
      {
        code: 'CHI_KHAC',
        name: 'Chi khác',
        type: CashCategoryType.EXPENSE,
        description: 'Chi phí phát sinh khác (bắt buộc ghi rõ nội dung)',
      },
      // Nghiệp vụ riêng biệt (không tính trùng doanh thu / chi phí hoạt động)
      {
        code: 'CHUYEN_TIEN_NOI_BO',
        name: 'Chuyển tiền giữa các tài khoản',
        type: CashCategoryType.INTERNAL_TRANSFER,
        description: 'Chuyển tiền giữa quỹ tiền mặt, ngân hàng hoặc rút tiền sàn',
      },
      {
        code: 'GOP_RUT_VON',
        name: 'Chủ shop góp/rút tiền',
        type: CashCategoryType.CAPITAL,
        description: 'Góp vốn kinh doanh hoặc rút vốn lợi nhuận',
      },
      {
        code: 'HOAN_TIEN_UNG_HO',
        name: 'Hoàn tiền nhân viên ứng hộ',
        type: CashCategoryType.REIMBURSEMENT,
        description: 'Hoàn lại tiền nhân viên/chủ shop đã chi hộ trước đó',
      },
    ];

    const categoryCount = await this.prisma.cashCategory.count({
      where: { tenantId },
    });

    if (categoryCount === 0) {
      await this.prisma.cashCategory.createMany({
        data: defaultCategories.map((c) => ({
          tenantId,
          code: c.code,
          name: c.name,
          type: c.type,
          description: c.description,
          isSystemDefault: true,
          isActive: true,
        })),
        skipDuplicates: true,
      });
    }

    // 1.2 Khởi tạo Tài khoản tiền mặc định
    const accountCount = await this.prisma.cashAccount.count({
      where: { tenantId },
    });

    if (accountCount === 0) {
      await this.prisma.cashAccount.createMany({
        data: [
          {
            tenantId,
            code: 'TM_KHO',
            name: 'Quỹ tiền mặt tại kho',
            type: CashAccountType.CASH,
            initialBalance: new Prisma.Decimal(0),
            currentBalance: new Prisma.Decimal(0),
            currency: 'VND',
            isActive: true,
            note: 'Quỹ tiền mặt phục vụ chi tiêu hàng ngày tại kho',
          },
          {
            tenantId,
            code: 'TK_MBBANK',
            name: 'Tài khoản MB Bank chính',
            type: CashAccountType.BANK,
            bankName: 'MB Bank',
            accountNumber: '88889999',
            initialBalance: new Prisma.Decimal(0),
            currentBalance: new Prisma.Decimal(0),
            currency: 'VND',
            isActive: true,
            note: 'Tài khoản ngân hàng kinh doanh',
          },
          {
            tenantId,
            code: 'VI_SHOPEE',
            name: 'Số dư sàn Shopee',
            type: CashAccountType.PLATFORM_WALLET,
            initialBalance: new Prisma.Decimal(0),
            currentBalance: new Prisma.Decimal(0),
            currency: 'VND',
            isActive: true,
            note: 'Số dư ví sàn Shopee chờ rút về tài khoản ngân hàng',
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  // -------------------------------------------------------------
  // 2. CASH ACCOUNTS MANAGEMENT
  // -------------------------------------------------------------
  async getAccounts(tenantId: string) {
    await this.ensureDefaults(tenantId);
    return this.prisma.cashAccount.findMany({
      where: { tenantId },
      include: {
        shop: { select: { id: true, name: true } },
        _count: {
          select: {
            outflowTransactions: true,
            inflowTransactions: true,
          },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async getAccountById(tenantId: string, id: string) {
    const account = await this.prisma.cashAccount.findFirst({
      where: { id, tenantId },
      include: {
        shop: { select: { id: true, name: true } },
      },
    });
    if (!account) {
      throw new NotFoundException('Không tìm thấy tài khoản tiền');
    }
    return account;
  }

  async createAccount(tenantId: string, dto: CreateCashAccountDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.cashAccount.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (existing) {
      throw new ConflictException(`Mã tài khoản '${code}' đã tồn tại`);
    }

    const initBal = dto.initialBalance || 0;
    return this.prisma.cashAccount.create({
      data: {
        tenantId,
        code,
        name: dto.name.trim(),
        type: dto.type,
        shopId: dto.shopId || null,
        accountNumber: dto.accountNumber?.trim() || null,
        bankName: dto.bankName?.trim() || null,
        initialBalance: new Prisma.Decimal(initBal),
        currentBalance: new Prisma.Decimal(initBal),
        note: dto.note?.trim() || null,
      },
    });
  }

  async updateAccount(tenantId: string, id: string, dto: UpdateCashAccountDto) {
    await this.getAccountById(tenantId, id);
    return this.prisma.cashAccount.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.accountNumber !== undefined && {
          accountNumber: dto.accountNumber?.trim() || null,
        }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName?.trim() || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.note !== undefined && { note: dto.note?.trim() || null }),
      },
    });
  }

  // -------------------------------------------------------------
  // 3. CASH CATEGORIES MANAGEMENT
  // -------------------------------------------------------------
  async getCategories(tenantId: string, type?: CashCategoryType) {
    await this.ensureDefaults(tenantId);
    return this.prisma.cashCategory.findMany({
      where: {
        tenantId,
        ...(type && { type }),
      },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(tenantId: string, dto: CreateCashCategoryDto) {
    let baseCode = dto.code?.trim().toUpperCase();
    if (!baseCode) {
      const prefix = dto.type === CashCategoryType.EXPENSE ? 'CHI' : 'THU';
      const cleanName = (dto.name || 'MUC')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .toUpperCase();
      baseCode = `${prefix}_${cleanName}`.slice(0, 30);
    }

    let finalCode = baseCode;
    let counter = 1;
    while (
      await this.prisma.cashCategory.findUnique({
        where: { tenantId_code: { tenantId, code: finalCode } },
      })
    ) {
      finalCode = `${baseCode.slice(0, 25)}_${counter}`;
      counter++;
    }

    return this.prisma.cashCategory.create({
      data: {
        tenantId,
        code: finalCode,
        name: dto.name.trim(),
        type: dto.type,
        description: dto.description?.trim() || null,
        isSystemDefault: false,
        isActive: true,
      },
    });
  }

  async updateCategory(tenantId: string, id: string, dto: UpdateCashCategoryDto) {
    const cat = await this.prisma.cashCategory.findFirst({
      where: { id, tenantId },
    });
    if (!cat) {
      throw new NotFoundException('Không tìm thấy khoản mục thu chi');
    }

    return this.prisma.cashCategory.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim() || null,
        }),
      },
    });
  }

  async deleteCategory(tenantId: string, id: string) {
    const cat = await this.prisma.cashCategory.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { transactions: true } } },
    });
    if (!cat) {
      throw new NotFoundException('Không tìm thấy khoản mục thu chi');
    }
    if (cat.isSystemDefault) {
      throw new BadRequestException('Không thể xóa khoản mục mặc định của hệ thống');
    }
    if (cat._count.transactions > 0) {
      throw new BadRequestException(
        'Khoản mục này đã có giao dịch phát sinh. Bạn không thể xóa để bảo toàn lịch sử sổ sách, vui lòng đổi trạng thái sang "Ngừng sử dụng".',
      );
    }

    return this.prisma.cashCategory.delete({ where: { id } });
  }

  // -------------------------------------------------------------
  // 4. CASH TRANSACTIONS MANAGEMENT
  // -------------------------------------------------------------
  async generateUniqueTransactionCode(tenantId: string, type: CashTransactionType): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');

    let prefix = 'PC';
    switch (type) {
      case CashTransactionType.INCOME:
        prefix = 'PT';
        break;
      case CashTransactionType.EXPENSE:
        prefix = 'PC';
        break;
      case CashTransactionType.INTERNAL_TRANSFER:
        prefix = 'CK';
        break;
      case CashTransactionType.CAPITAL_IN:
        prefix = 'GV';
        break;
      case CashTransactionType.CAPITAL_OUT:
        prefix = 'RV';
        break;
      case CashTransactionType.REIMBURSEMENT:
        prefix = 'PH';
        break;
    }
    const base = `${prefix}-${y}${m}${d}`;
    for (let i = 0; i < 100; i++) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `${base}-${rand}`;
      const exists = await this.prisma.cashTransaction.findUnique({
        where: { tenantId_transactionCode: { tenantId, transactionCode: code } },
      });
      if (!exists) return code;
    }
    return `${base}-${Date.now().toString().slice(-4)}`;
  }

  async checkDuplicateWarning(
    tenantId: string,
    params: {
      amount: number;
      transactionDate?: string;
      counterpartyName?: string;
      referenceCode?: string;
    },
  ) {
    const warnings: string[] = [];

    // Kiểm tra trùng mã tham chiếu / mã giao dịch ngân hàng
    if (params.referenceCode?.trim()) {
      const matchRef = await this.prisma.cashTransaction.findFirst({
        where: {
          tenantId,
          referenceCode: params.referenceCode.trim(),
          status: { not: CashTransactionStatus.CANCELLED },
        },
        select: { transactionCode: true, amount: true, transactionDate: true },
      });
      if (matchRef) {
        warnings.push(
          `Cảnh báo trùng mã giao dịch: Đã có phiếu ${matchRef.transactionCode} (${Number(
            matchRef.amount,
          ).toLocaleString('vi-VN')}đ) sử dụng mã này.`,
        );
      }
    }

    // Kiểm tra trùng cùng ngày, cùng số tiền, cùng đối tượng
    if (params.amount > 0 && params.counterpartyName?.trim()) {
      const targetDate = params.transactionDate ? new Date(params.transactionDate) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const matchDuplicate = await this.prisma.cashTransaction.findFirst({
        where: {
          tenantId,
          amount: new Prisma.Decimal(params.amount),
          counterpartyName: params.counterpartyName.trim(),
          transactionDate: { gte: startOfDay, lte: endOfDay },
          status: { not: CashTransactionStatus.CANCELLED },
        },
        select: { transactionCode: true, transactionDate: true },
      });

      if (matchDuplicate) {
        warnings.push(
          `Phát hiện giao dịch tương tự trong ngày: Phiếu ${matchDuplicate.transactionCode} cùng số tiền ${params.amount.toLocaleString(
            'vi-VN',
          )}đ và đối tượng '${params.counterpartyName.trim()}'. Vui lòng kiểm tra để tránh nhập đúp.`,
        );
      }
    }

    return {
      hasWarning: warnings.length > 0,
      warnings,
    };
  }

  async createTransaction(tenantId: string, userId: string, dto: CreateCashTransactionDto) {
    await this.ensureDefaults(tenantId);

    // Xác thực danh mục
    const category = await this.prisma.cashCategory.findFirst({
      where: { id: dto.categoryId, tenantId },
    });
    if (!category) {
      throw new NotFoundException('Không tìm thấy khoản mục thu chi');
    }

    // Xác thực tài khoản tiền theo hướng giao dịch
    let fromAccount: any = null;
    let toAccount: any = null;

    if (dto.fromAccountId) {
      fromAccount = await this.prisma.cashAccount.findFirst({
        where: { id: dto.fromAccountId, tenantId },
      });
      if (!fromAccount) throw new NotFoundException('Không tìm thấy tài khoản nguồn (chi)');
    }

    if (dto.toAccountId) {
      toAccount = await this.prisma.cashAccount.findFirst({
        where: { id: dto.toAccountId, tenantId },
      });
      if (!toAccount) throw new NotFoundException('Không tìm thấy tài khoản đích (thu)');
    }

    const txStatus = dto.status || CashTransactionStatus.CONFIRMED;
    const txCode = await this.generateUniqueTransactionCode(tenantId, dto.type);
    const txDate = dto.transactionDate ? new Date(dto.transactionDate) : new Date();
    const amountDec = new Prisma.Decimal(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo bản ghi giao dịch
      const transaction = await tx.cashTransaction.create({
        data: {
          tenantId,
          shopId: dto.shopId || null,
          isCommonExpense: dto.isCommonExpense || false,
          transactionCode: txCode,
          type: dto.type,
          categoryId: dto.categoryId,
          fromAccountId: dto.fromAccountId || null,
          toAccountId: dto.toAccountId || null,
          amount: amountDec,
          transactionDate: txDate,
          paymentMethod: dto.paymentMethod || 'BANK_TRANSFER',
          status: txStatus,
          counterpartyName: dto.counterpartyName?.trim() || null,
          performedByName: dto.performedByName?.trim() || null,
          referenceCode: dto.referenceCode?.trim() || null,
          voucherImage: dto.voucherImage?.trim() || null,
          note: dto.note?.trim() || null,
          relatedEntityType: dto.relatedEntityType || null,
          relatedEntityId: dto.relatedEntityId || null,
          createdById: userId,
          confirmedById: txStatus === CashTransactionStatus.CONFIRMED ? userId : null,
          confirmedAt: txStatus === CashTransactionStatus.CONFIRMED ? new Date() : null,
        },
        include: {
          category: true,
          fromAccount: true,
          toAccount: true,
          shop: true,
        },
      });

      // 2. Chỉ giao dịch đã xác nhận (CONFIRMED) mới cập nhật số dư tiền
      if (txStatus === CashTransactionStatus.CONFIRMED) {
        if (dto.fromAccountId) {
          await tx.cashAccount.update({
            where: { id: dto.fromAccountId },
            data: { currentBalance: { decrement: amountDec } },
          });
        }
        if (dto.toAccountId) {
          await tx.cashAccount.update({
            where: { id: dto.toAccountId },
            data: { currentBalance: { increment: amountDec } },
          });
        }

        // 3. Phân bổ thanh toán phiếu nhập kho (PurchaseReceipts) nếu có
        if (dto.allocations && dto.allocations.length > 0) {
          for (const alloc of dto.allocations) {
            const receipt = await tx.purchaseReceipt.findFirst({
              where: { id: alloc.receiptId, tenantId },
            });
            if (receipt) {
              const currentPaid = Number(receipt.paidAmount || 0);
              const payable = Number(receipt.payableAmount || 0);
              const returnDeduction = Number(receipt.returnDeductionAmount || 0);

              const newPaid = currentPaid + alloc.amount;
              const newRemaining = Math.max(0, payable - returnDeduction - newPaid);
              const newStatus = newRemaining <= 0 ? 'PAID' : 'PARTIALLY_PAID';

              await tx.purchaseReceipt.update({
                where: { id: receipt.id },
                data: {
                  paidAmount: new Prisma.Decimal(newPaid),
                  remainingAmount: new Prisma.Decimal(newRemaining),
                  paymentStatus: newStatus,
                },
              });
            }
          }
        }
      }

      return transaction;
    });
  }

  async confirmTransaction(tenantId: string, userId: string, id: string) {
    const existing = await this.prisma.cashTransaction.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy giao dịch');
    }
    if (existing.status !== CashTransactionStatus.DRAFT) {
      throw new BadRequestException('Chỉ giao dịch ở trạng thái "Lưu nháp" mới có thể xác nhận');
    }

    return this.prisma.$transaction(async (tx) => {
      // Cập nhật số dư tài khoản
      if (existing.fromAccountId) {
        await tx.cashAccount.update({
          where: { id: existing.fromAccountId },
          data: { currentBalance: { decrement: existing.amount } },
        });
      }
      if (existing.toAccountId) {
        await tx.cashAccount.update({
          where: { id: existing.toAccountId },
          data: { currentBalance: { increment: existing.amount } },
        });
      }

      return tx.cashTransaction.update({
        where: { id },
        data: {
          status: CashTransactionStatus.CONFIRMED,
          confirmedById: userId,
          confirmedAt: new Date(),
        },
        include: {
          category: true,
          fromAccount: true,
          toAccount: true,
          shop: true,
        },
      });
    });
  }

  async cancelTransaction(tenantId: string, userId: string, id: string, reason?: string) {
    const existing = await this.prisma.cashTransaction.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy giao dịch');
    }
    if (existing.status === CashTransactionStatus.CANCELLED) {
      throw new BadRequestException('Giao dịch này đã bị hủy trước đó');
    }

    return this.prisma.$transaction(async (tx) => {
      // Đảo ngược số dư nếu trước đó đã CONFIRMED
      if (existing.status === CashTransactionStatus.CONFIRMED) {
        if (existing.fromAccountId) {
          await tx.cashAccount.update({
            where: { id: existing.fromAccountId },
            data: { currentBalance: { increment: existing.amount } },
          });
        }
        if (existing.toAccountId) {
          await tx.cashAccount.update({
            where: { id: existing.toAccountId },
            data: { currentBalance: { decrement: existing.amount } },
          });
        }
      }

      const appendNote = `[ĐÃ HỦY ${new Date().toLocaleDateString('vi-VN')}]: ${reason || 'Người dùng hủy giao dịch'}`;
      const newNote = existing.note ? `${existing.note} | ${appendNote}` : appendNote;

      return tx.cashTransaction.update({
        where: { id },
        data: {
          status: CashTransactionStatus.CANCELLED,
          note: newNote,
        },
      });
    });
  }

  async getTransactions(tenantId: string, filter: CashflowFilterDto) {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.CashTransactionWhereInput = {
      tenantId,
      ...(filter.type && { type: filter.type as CashTransactionType }),
      ...(filter.categoryId && { categoryId: filter.categoryId }),
      ...(filter.status && { status: filter.status as CashTransactionStatus }),
      ...(filter.shopId && { shopId: filter.shopId }),
      ...(filter.accountId && {
        OR: [{ fromAccountId: filter.accountId }, { toAccountId: filter.accountId }],
      }),
      ...(filter.startDate || filter.endDate
        ? {
            transactionDate: {
              ...(filter.startDate && { gte: new Date(filter.startDate) }),
              ...(filter.endDate && { lte: new Date(filter.endDate) }),
            },
          }
        : {}),
      ...(filter.search?.trim()
        ? {
            OR: [
              { transactionCode: { contains: filter.search.trim(), mode: 'insensitive' } },
              { referenceCode: { contains: filter.search.trim(), mode: 'insensitive' } },
              { counterpartyName: { contains: filter.search.trim(), mode: 'insensitive' } },
              { performedByName: { contains: filter.search.trim(), mode: 'insensitive' } },
              { note: { contains: filter.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.cashTransaction.count({ where }),
      this.prisma.cashTransaction.findMany({
        where,
        include: {
          category: true,
          fromAccount: true,
          toAccount: true,
          shop: { select: { id: true, name: true } },
        },
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // -------------------------------------------------------------
  // 5. INTERNAL TRANSFERS (CHUYỂN TIỀN NỘI BỘ & RÚT TIỀN SÀN)
  // -------------------------------------------------------------
  async createInternalTransfer(tenantId: string, userId: string, dto: CreateInternalTransferDto) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Tài khoản nguồn và tài khoản đích không được trùng nhau');
    }

    const [fromAccount, toAccount] = await Promise.all([
      this.prisma.cashAccount.findFirst({ where: { id: dto.fromAccountId, tenantId } }),
      this.prisma.cashAccount.findFirst({ where: { id: dto.toAccountId, tenantId } }),
    ]);

    if (!fromAccount || !toAccount) {
      throw new NotFoundException('Không tìm thấy một trong hai tài khoản thanh toán');
    }

    // Lấy hoặc khởi tạo danh mục chuyển tiền nội bộ
    let transferCat = await this.prisma.cashCategory.findFirst({
      where: { tenantId, type: CashCategoryType.INTERNAL_TRANSFER },
    });
    if (!transferCat) {
      await this.ensureDefaults(tenantId);
      transferCat = await this.prisma.cashCategory.findFirst({
        where: { tenantId, type: CashCategoryType.INTERNAL_TRANSFER },
      });
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const transferCode = `CKNB-${y}${m}${d}-${rand}`;

    const transferDate = dto.transferDate ? new Date(dto.transferDate) : new Date();
    const amountDec = new Prisma.Decimal(dto.amount);
    const feeDec = new Prisma.Decimal(dto.feeAmount || 0);
    const netReceived = amountDec.sub(feeDec);

    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo phiếu chi từ tài khoản nguồn
      const fromTx = await tx.cashTransaction.create({
        data: {
          tenantId,
          transactionCode: `PC-${transferCode}`,
          type: CashTransactionType.INTERNAL_TRANSFER,
          categoryId: transferCat!.id,
          fromAccountId: dto.fromAccountId,
          amount: amountDec,
          transactionDate: transferDate,
          paymentMethod: 'INTERNAL_TRANSFER',
          status: CashTransactionStatus.CONFIRMED,
          counterpartyName: `Nội bộ: ${toAccount.name}`,
          referenceCode: dto.referenceCode?.trim() || null,
          note: `Chuyển sang ${toAccount.name}: ${dto.note || ''}`,
          createdById: userId,
          confirmedById: userId,
          confirmedAt: new Date(),
        },
      });

      // 2. Tạo phiếu thu vào tài khoản đích
      const toTx = await tx.cashTransaction.create({
        data: {
          tenantId,
          transactionCode: `PT-${transferCode}`,
          type: CashTransactionType.INTERNAL_TRANSFER,
          categoryId: transferCat!.id,
          toAccountId: dto.toAccountId,
          amount: netReceived,
          transactionDate: transferDate,
          paymentMethod: 'INTERNAL_TRANSFER',
          status: CashTransactionStatus.CONFIRMED,
          counterpartyName: `Nội bộ: ${fromAccount.name}`,
          referenceCode: dto.referenceCode?.trim() || null,
          note: `Nhận từ ${fromAccount.name}: ${dto.note || ''}${
            dto.feeAmount ? ` (Phí: ${dto.feeAmount.toLocaleString('vi-VN')}đ)` : ''
          }`,
          createdById: userId,
          confirmedById: userId,
          confirmedAt: new Date(),
        },
      });

      // 3. Tạo bản ghi CashTransfer liên kết 2 vế
      const transfer = await tx.cashTransfer.create({
        data: {
          tenantId,
          transferCode,
          fromAccountId: dto.fromAccountId,
          toAccountId: dto.toAccountId,
          amount: amountDec,
          feeAmount: feeDec,
          transferDate,
          status: CashTransactionStatus.CONFIRMED,
          referenceCode: dto.referenceCode?.trim() || null,
          note: dto.note?.trim() || null,
          createdById: userId,
          fromTransactionId: fromTx.id,
          toTransactionId: toTx.id,
        },
        include: {
          fromAccount: true,
          toAccount: true,
          fromTransaction: true,
          toTransaction: true,
        },
      });

      // 4. Cập nhật số dư hai tài khoản tức thời
      await tx.cashAccount.update({
        where: { id: dto.fromAccountId },
        data: { currentBalance: { decrement: amountDec } },
      });

      await tx.cashAccount.update({
        where: { id: dto.toAccountId },
        data: { currentBalance: { increment: netReceived } },
      });

      return transfer;
    });
  }

  // -------------------------------------------------------------
  // 6. TỔNG QUAN TIỀN & BÁO CÁO DÒNG TIỀN (OVERVIEW STATS)
  // -------------------------------------------------------------
  async getOverview(
    tenantId: string,
    filter?: { shopId?: string; startDate?: string; endDate?: string },
  ) {
    await this.ensureDefaults(tenantId);

    // 1. Số dư tất cả tài khoản
    const accounts = await this.prisma.cashAccount.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(filter?.shopId && {
          OR: [{ shopId: filter.shopId }, { shopId: null }],
        }),
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    let totalCash = 0;
    let totalBank = 0;
    let totalPlatformWallet = 0;
    let totalNetBalance = 0;

    for (const acc of accounts) {
      const bal = Number(acc.currentBalance || 0);
      totalNetBalance += bal;
      if (acc.type === CashAccountType.CASH) totalCash += bal;
      else if (acc.type === CashAccountType.BANK) totalBank += bal;
      else if (acc.type === CashAccountType.PLATFORM_WALLET) totalPlatformWallet += bal;
    }

    // 2. Thu / Chi trong kỳ (chỉ tính giao dịch CONFIRMED hoạt động kinh doanh)
    const dateRange: Prisma.DateTimeFilter = {
      ...(filter?.startDate && { gte: new Date(filter.startDate) }),
      ...(filter?.endDate && { lte: new Date(filter.endDate) }),
    };

    const hasDate = Boolean(filter?.startDate || filter?.endDate);

    const txWhere: Prisma.CashTransactionWhereInput = {
      tenantId,
      status: CashTransactionStatus.CONFIRMED,
      ...(hasDate && { transactionDate: dateRange }),
      ...(filter?.shopId && {
        OR: [{ shopId: filter.shopId }, { isCommonExpense: true }],
      }),
    };

    const periodTransactions = await this.prisma.cashTransaction.findMany({
      where: txWhere,
      select: { type: true, amount: true },
    });

    let periodIncome = 0;
    let periodExpense = 0;
    let periodCapitalIn = 0;
    let periodCapitalOut = 0;

    for (const tx of periodTransactions) {
      const amt = Number(tx.amount || 0);
      if (tx.type === CashTransactionType.INCOME) periodIncome += amt;
      else if (tx.type === CashTransactionType.EXPENSE) periodExpense += amt;
      else if (tx.type === CashTransactionType.CAPITAL_IN) periodCapitalIn += amt;
      else if (tx.type === CashTransactionType.CAPITAL_OUT) periodCapitalOut += amt;
      // INTERNAL_TRANSFER và REIMBURSEMENT không làm sai lệch dòng tiền kinh doanh
    }

    const netOperatingCashflow = periodIncome - periodExpense;

    // 3. Tiền sàn chờ đối soát / chưa quyết toán
    // Lấy từ OrderReconciliationRecord có trạng thái NO_DATA hoặc UNMATCHED (chỉ các đơn KHÔNG BỊ HỦY)
    const pendingReconciliations = await this.prisma.orderReconciliationRecord.aggregate({
      where: {
        tenantId,
        ...(filter?.shopId && { shopId: filter.shopId }),
        order: {
          platformStatus: {
            notIn: [PlatformOrderStatus.CANCELLED, PlatformOrderStatus.IN_CANCEL],
          },
        },
        reconciliationStatus: {
          in: [
            OrderReconciliationStatus.NO_DATA,
            OrderReconciliationStatus.UNMATCHED,
            OrderReconciliationStatus.NEEDS_CHECK,
          ],
        },
      },
      _sum: {
        estimatedPayout: true,
        settledPayout: true,
      },
      _count: {
        id: true,
      },
    });

    // 4. Công nợ nhà cung cấp còn phải trả (Bao gồm nợ đầu kỳ, phiếu nhập, trừ trả hàng và các khoản đã thanh toán)
    const suppliers = await this.prisma.supplier.findMany({
      where: { tenantId },
      include: {
        purchaseReceipts: {
          select: { payableAmount: true, remainingAmount: true },
        },
        purchaseReturns: {
          where: { status: 'CONFIRMED' },
          select: { debtOffsetAmount: true },
        },
        supplierPayments: {
          select: { amount: true, paymentType: true },
        },
        loans: {
          where: { status: { not: 'CANCELLED' } },
          select: { type: true, remainingAmount: true },
        },
      },
    });

    let totalSupplierDebt = 0;
    let suppliersWithDebtCount = 0;

    suppliers.forEach((s) => {
      const openingDebt = Number(s.openingDebt || 0);
      const totalPurchases = s.purchaseReceipts.reduce(
        (sum, r) => sum + Number(r.payableAmount || 0),
        0
      );
      const totalReturns = s.purchaseReturns.reduce(
        (sum, ret) => sum + Number(ret.debtOffsetAmount || 0),
        0
      );
      const totalPaid = s.supplierPayments
        .filter((p) => p.paymentType === 'PAYMENT' || p.paymentType === 'ADVANCE_DEPOSIT')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const totalRefunded = s.supplierPayments
        .filter((p) => p.paymentType === 'REFUND_RECEIVED')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // Công thức chuẩn kế toán:
      // Số dư cuối kỳ = Nợ đầu kỳ + Phát sinh phải trả - Giảm trừ công nợ - Tiền đã trả + Tiền NCC hoàn lại
      let closingDebt = openingDebt + totalPurchases - totalReturns - totalPaid + totalRefunded;

      // Cộng thêm các khoản vay tiền từ NCC nếu có
      for (const l of s.loans || []) {
        if (l.type === 'BORROWED_FROM_SUPPLIER') {
          closingDebt += Number(l.remainingAmount || 0);
        } else if (l.type === 'LENT_TO_SUPPLIER') {
          closingDebt -= Number(l.remainingAmount || 0);
        }
      }

      if (closingDebt > 0) {
        totalSupplierDebt += closingDebt;
        suppliersWithDebtCount++;
      }
    });

    const pendingReceiptsCount = await this.prisma.purchaseReceipt.count({
      where: {
        tenantId,
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      },
    });

    // 5. Tiền nhân viên ứng hộ chờ hoàn
    const pendingReimbursements = await this.prisma.supplierPayment.aggregate({
      where: {
        tenantId,
        isReimbursementNeeded: true,
        reimbursementStatus: 'PENDING_REIMBURSEMENT',
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    // 6. Lấy 8 giao dịch gần nhất
    const recentTransactions = await this.prisma.cashTransaction.findMany({
      where: { tenantId },
      include: {
        category: true,
        fromAccount: true,
        toAccount: true,
        shop: { select: { id: true, name: true } },
      },
      orderBy: { transactionDate: 'desc' },
      take: 8,
    });

    return {
      accounts,
      totals: {
        totalCash,
        totalBank,
        totalPlatformWallet,
        totalNetBalance,
      },
      period: {
        periodIncome,
        periodExpense,
        netOperatingCashflow,
        periodCapitalIn,
        periodCapitalOut,
      },
      outstanding: {
        pendingPlatformMoney: Number(pendingReconciliations._sum.estimatedPayout || 0),
        pendingPlatformCount: pendingReconciliations._count.id,
        supplierDebt: totalSupplierDebt,
        unpaidReceiptsCount: pendingReceiptsCount || suppliersWithDebtCount,
        staffPersonalDebt: Number(pendingReimbursements._sum.amount || 0),
        pendingReimbursementCount: pendingReimbursements._count.id,
      },
      recentTransactions,
    };
  }
}
