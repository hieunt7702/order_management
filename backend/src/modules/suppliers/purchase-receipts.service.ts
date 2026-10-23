import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreatePurchaseReceiptDto,
  UpdatePurchaseReceiptDto,
  PurchaseReceiptFilterDto,
} from './dto/purchase-receipt.dto';
import {
  Prisma,
  InventoryMovementType,
  CashAccountType,
  CashCategoryType,
  CashTransactionType,
  CashTransactionStatus,
  SupplierPaymentType,
  PurchasePaymentStatus,
} from '@prisma/client';

@Injectable()
export class PurchaseReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

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

    let receiptCode = dto.receiptCode?.trim().toUpperCase();
    if (!receiptCode) {
      receiptCode = await this.generateUniqueReceiptCode(tenantId);
    } else {
      const existingCode = await this.prisma.purchaseReceipt.findUnique({
        where: { tenantId_receiptCode: { tenantId, receiptCode } },
      });
      if (existingCode) {
        receiptCode = await this.generateUniqueReceiptCode(tenantId);
      }
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
    const result = await this.prisma.$transaction(async (tx) => {
      // A. Tạo phiếu nhập PurchaseReceipt
      const receipt = await tx.purchaseReceipt.create({
        data: {
          tenantId,
          supplierId: dto.supplierId,
          shopId: dto.shopId || null,
          warehouseId: dto.warehouseId,
          receiptCode,
          receiptDate: dto.receiptDate
            ? (dto.receiptDate.includes('T') ? new Date(dto.receiptDate) : new Date(`${dto.receiptDate}T${new Date().toTimeString().split(' ')[0]}`))
            : new Date(),
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
          // Lấy tồn kho trước khi nhập
          const existingBalance = await tx.inventoryBalance.findUnique({
            where: {
              tenantId_warehouseId_variantId: {
                tenantId,
                warehouseId: dto.warehouseId,
                variantId: item.variantId,
              },
            },
          });
          const prevOnHand = existingBalance ? Number(existingBalance.onHand || 0) : 0;
          const nextOnHand = prevOnHand + item.receivedQuantity;

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

          // Ghi InventoryLedger (RECEIVE) với beforeOnHand và afterOnHand
          await tx.inventoryLedger.create({
            data: {
              tenantId,
              warehouseId: dto.warehouseId,
              variantId: item.variantId,
              movementType: InventoryMovementType.RECEIVE,
              deltaOnHand: item.receivedQuantity,
              deltaReserved: 0,
              beforeOnHand: prevOnHand,
              afterOnHand: nextOnHand,
              voucherCode: receiptCode,
              referenceType: 'PURCHASE_RECEIPT',
              referenceId: receipt.id,
              performedByUserId: userId,
              note: `Nhập kho theo phiếu ${receiptCode} từ NCC ${supplier.name}`,
            },
          });
        }

        // Cập nhật giá vốn sản phẩm ProductVariant.costPrice theo đơn giá nhập
        if (Number(item.unitPrice) > 0) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { costPrice: item.unitPrice },
          });
        }
      }

      // C. Tự động cấn trừ tiền NCC nợ shop / tiền ứng trước nếu có
      await this.autoOffsetSupplierReceipts(tx, tenantId, dto.supplierId, receipt.id);

      // Đọc lại trạng thái phiếu nhập sau khi đã cấn trừ tự động
      const updatedReceipt = await tx.purchaseReceipt.findUniqueOrThrow({
        where: { id: receipt.id },
      });

      let currentPaid = Number(updatedReceipt.paidAmount);
      let currentRemaining = Number(updatedReceipt.remainingAmount);

      // D. Xử lý thanh toán ngay (Immediate Payment) nếu có
      if (dto.immediatePayment && dto.immediatePaymentAmount && dto.immediatePaymentAmount > 0) {
        // Số tiền thực tế thanh toán thêm cho phiếu này (không vượt quá số tiền còn nợ sau cấn trừ)
        const payAmount = Math.min(dto.immediatePaymentAmount, currentRemaining);
        // Số tiền dôi dư (nếu người dùng chi nhiều hơn số còn thiếu) trở thành tiền ứng trước mới
        const advancePortion = Math.max(0, dto.immediatePaymentAmount - payAmount);

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

        // Tạo allocation cho phần chi thêm (nếu có thanh toán cho phiếu này)
        if (payAmount > 0) {
          await tx.paymentAllocation.create({
            data: {
              tenantId,
              paymentId: payment.id,
              receiptId: receipt.id,
              allocatedAmount: new Prisma.Decimal(payAmount),
              note: 'Thanh toán ngay lúc nhận hàng',
            },
          });
        }

        const newRemaining = Math.max(0, currentRemaining - payAmount);
        const newPaid = currentPaid + payAmount;
        const newPaymentStatus =
          newRemaining === 0 ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

        await tx.purchaseReceipt.update({
          where: { id: receipt.id },
          data: {
            paidAmount: new Prisma.Decimal(newPaid),
            remainingAmount: new Prisma.Decimal(newRemaining),
            paymentStatus: newPaymentStatus,
          },
        });

        // Ghi nhận vào Sổ thu chi (CashTransaction)
        let fromAccountId: string | null = null;
        if (dto.immediateFundSource === 'CASH_FUND') {
          const cashAcc = await tx.cashAccount.findFirst({
            where: { tenantId, type: CashAccountType.CASH, isActive: true },
            orderBy: { createdAt: 'asc' },
          });
          if (cashAcc) fromAccountId = cashAcc.id;
        } else if (dto.immediateFundSource === 'BANK_ACCOUNT') {
          const bankAcc = await tx.cashAccount.findFirst({
            where: { tenantId, type: CashAccountType.BANK, isActive: true },
            orderBy: { createdAt: 'asc' },
          });
          if (bankAcc) fromAccountId = bankAcc.id;
        }

        let category = await tx.cashCategory.findFirst({
          where: { tenantId, code: 'CHI_NHAP_HANG' },
        });
        if (!category) {
          category = await tx.cashCategory.findFirst({
            where: { tenantId, type: CashCategoryType.EXPENSE },
          });
        }
        if (!category) {
          category = await tx.cashCategory.create({
            data: {
              tenantId,
              code: 'CHI_NHAP_HANG',
              name: 'Thanh toán nhập hàng',
              type: CashCategoryType.EXPENSE,
              isSystemDefault: true,
            },
          });
        }

        const immediateTxAmount = new Prisma.Decimal(dto.immediatePaymentAmount);
        await tx.cashTransaction.create({
          data: {
            tenantId,
            transactionCode: paymentCode,
            type: CashTransactionType.EXPENSE,
            categoryId: category.id,
            fromAccountId,
            amount: immediateTxAmount,
            transactionDate: new Date(),
            paymentMethod: dto.immediatePaymentMethod || 'BANK_TRANSFER',
            status: CashTransactionStatus.CONFIRMED,
            counterpartyName: supplier.name,
            performedByName: dto.immediatePayerName?.trim() || null,
            referenceCode: receiptCode,
            note: `Thanh toán ngay khi nhập hàng phiếu ${receiptCode}`,
            relatedEntityType: 'SUPPLIER_PAYMENT',
            relatedEntityId: payment.id,
            createdById: userId,
            confirmedById: userId,
            confirmedAt: new Date(),
          },
        });

        if (fromAccountId) {
          await tx.cashAccount.update({
            where: { id: fromAccountId },
            data: { currentBalance: { decrement: immediateTxAmount } },
          });
        }
      }

      return receipt;
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'PURCHASE_RECEIPT_CREATED',
      entityType: 'PurchaseReceipt',
      entityId: result.id,
      newValues: {
        receiptCode: result.receiptCode,
        supplierId: dto.supplierId,
        supplierName: supplier.name,
        warehouseId: dto.warehouseId,
        warehouseName: warehouse.name,
        totalItemsAmount,
        payableAmount,
        receivingStatus,
        itemCount: itemsData.length,
      },
    });

    return result;
  }

  async findAll(tenantId: string, filter: PurchaseReceiptFilterDto = {}) {
    // Tự động kiểm tra và cấn trừ các phiếu nhập chưa trả từ tiền NCC đang nợ shop
    try {
      await this.autoOffset(tenantId, filter.supplierId);
    } catch (err) {
      // Tránh để lỗi cấn trừ làm gián đoạn tải danh sách
    }

    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filter.limit) || 25));
    const skip = (page - 1) * limit;

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const andConditions: Prisma.PurchaseReceiptWhereInput[] = [];

    if (filter.search) {
      andConditions.push({
        OR: [
          { receiptCode: { contains: filter.search, mode: 'insensitive' } },
          { supplier: { name: { contains: filter.search, mode: 'insensitive' } } },
          { supplier: { code: { contains: filter.search, mode: 'insensitive' } } },
          { note: { contains: filter.search, mode: 'insensitive' } },
        ],
      });
    }

    if (filter.dueStatus) {
      if (filter.dueStatus === 'OVERDUE') {
        // Quá hạn nợ: Phải còn nợ và có hạn nợ đã quá ngày
        andConditions.push({
          remainingAmount: { gt: 0 },
          paymentDueDate: { not: null, lt: now },
        });
      } else if (filter.dueStatus === 'DUE_SOON') {
        // Sắp đến hạn: Phải còn nợ và hạn nợ trong vòng 7 ngày tới
        andConditions.push({
          remainingAmount: { gt: 0 },
          paymentDueDate: { not: null, gte: now, lte: sevenDaysLater },
        });
      } else if (filter.dueStatus === 'NOT_DUE') {
        // Chưa đến hạn: Nếu không có hạn nợ thì là chưa đến hạn, hoặc đã hết nợ, hoặc còn xa
        andConditions.push({
          OR: [
            { remainingAmount: { lte: 0 } },
            { paymentDueDate: null },
            { paymentDueDate: { gt: sevenDaysLater } },
          ],
        });
      }
    }

    if (filter.startDate || filter.endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (filter.startDate) {
        const start = new Date(filter.startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.gte = start;
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      andConditions.push({ receiptDate: dateFilter });
    }

    const where: Prisma.PurchaseReceiptWhereInput = {
      tenantId,
      ...(filter.supplierId && { supplierId: filter.supplierId }),
      ...(filter.shopId && { shopId: filter.shopId }),
      ...(filter.warehouseId && { warehouseId: filter.warehouseId }),
      ...(filter.paymentStatus && {
        paymentStatus:
          typeof filter.paymentStatus === 'string' && filter.paymentStatus.includes(',')
            ? { in: filter.paymentStatus.split(',') as any }
            : filter.paymentStatus,
      }),
      ...(filter.receivingStatus && { receivingStatus: filter.receivingStatus }),
      ...(andConditions.length > 0 && { AND: andConditions }),
    };

    const [total, receipts, aggregate] = await Promise.all([
      this.prisma.purchaseReceipt.count({ where }),
      this.prisma.purchaseReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ receiptDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              code: true,
              phone: true,
              bankName: true,
              bankAccount: true,
              bankBeneficiary: true,
            },
          },
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
                  note: true,
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
      this.prisma.purchaseReceipt.aggregate({
        where,
        _sum: {
          totalItemsAmount: true,
          payableAmount: true,
          paidAmount: true,
          returnDeductionAmount: true,
          remainingAmount: true,
        },
      }),
    ]);

    const items = receipts.map((r) => {
      let calculatedDueStatus: 'NOT_DUE' | 'DUE_SOON' | 'OVERDUE' = 'NOT_DUE';
      const rem = Number(r.remainingAmount || 0);

      if (r.paymentDueDate && rem > 0) {
        const dueDate = new Date(r.paymentDueDate);
        if (dueDate < now) {
          calculatedDueStatus = 'OVERDUE';
        } else if (dueDate <= sevenDaysLater) {
          calculatedDueStatus = 'DUE_SOON';
        } else {
          calculatedDueStatus = 'NOT_DUE';
        }
      } else {
        // Nếu không có hạn nợ hoặc đã hết nợ -> Chưa đến hạn
        calculatedDueStatus = 'NOT_DUE';
      }

      return {
        ...r,
        dueStatus: calculatedDueStatus,
      };
    });

    const summary = {
      totalItemsAmount: Number(aggregate._sum.totalItemsAmount || 0),
      payableAmount: Number(aggregate._sum.payableAmount || 0),
      paidAmount: Number(aggregate._sum.paidAmount || 0),
      returnDeductionAmount: Number(aggregate._sum.returnDeductionAmount || 0),
      totalPaidAndOffsetAmount:
        Number(aggregate._sum.paidAmount || 0) + Number(aggregate._sum.returnDeductionAmount || 0),
      remainingAmount: Number(aggregate._sum.remainingAmount || 0),
    };

    return {
      items,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      summary,
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

    // Tính toán công nợ nhà cung cấp TRƯỚC và SAU khi phát sinh phiếu nhập này
    let supplierDebtBefore = 0;
    let supplierDebtAfter = 0;
    try {
      const sup = await this.prisma.supplier.findFirst({
        where: { id: receipt.supplierId, tenantId },
        include: {
          purchaseReceipts: {
            where: { createdAt: { lt: receipt.createdAt } },
            select: { payableAmount: true, paidAmount: true, returnDeductionAmount: true },
          },
          purchaseReturns: {
            where: { status: 'CONFIRMED', createdAt: { lt: receipt.createdAt } },
            select: { debtOffsetAmount: true },
          },
          supplierPayments: {
            where: { createdAt: { lt: receipt.createdAt } },
            select: { amount: true, paymentType: true },
          },
          transfersFrom: {
            where: { createdAt: { lt: receipt.createdAt } },
            select: { amount: true },
          },
          transfersTo: {
            where: { createdAt: { lt: receipt.createdAt } },
            select: { amount: true },
          },
        },
      });

      if (sup) {
        const opening = Number(sup.openingDebt || 0);
        const prevPurchases = sup.purchaseReceipts.reduce((sum, r) => sum + Number(r.payableAmount || 0), 0);
        const prevReturns = sup.purchaseReturns.reduce((sum, r) => sum + Number(r.debtOffsetAmount || 0), 0);
        const prevPaid = sup.supplierPayments
          .filter((p) => p.paymentType === 'PAYMENT' || p.paymentType === 'ADVANCE_DEPOSIT')
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const prevRefund = sup.supplierPayments
          .filter((p) => p.paymentType === 'REFUND_RECEIVED')
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const prevTransOut = (sup.transfersFrom || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const prevTransIn = (sup.transfersTo || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);

        supplierDebtBefore = opening + prevPurchases - prevReturns - prevPaid + prevRefund + prevTransOut - prevTransIn;
        supplierDebtAfter =
          supplierDebtBefore +
          Number(receipt.payableAmount || 0) -
          Number(receipt.paidAmount || 0) -
          Number(receipt.returnDeductionAmount || 0);
      }
    } catch (err) {
      console.warn('Lỗi tính công nợ trước/sau phiếu nhập (suppressed):', err);
    }

    // Tra cứu biến động số dư tài khoản quỹ cho các đợt thanh toán của phiếu nhập này
    let enhancedAllocations = receipt.paymentAllocations;
    try {
      enhancedAllocations = await Promise.all(
        receipt.paymentAllocations.map(async (alloc: any) => {
          let cashTx: any = null;
          if (alloc.payment?.id || alloc.payment?.paymentCode) {
            cashTx = await this.prisma.cashTransaction.findFirst({
              where: {
                tenantId,
                OR: [
                  { relatedEntityId: alloc.payment?.id },
                  { transactionCode: alloc.payment?.paymentCode },
                ],
              },
              include: { fromAccount: true, toAccount: true },
            });
          }
          return {
            ...alloc,
            cashTransaction: cashTx,
          };
        }),
      );
    } catch {
      // suppress
    }

    return {
      ...receipt,
      paymentAllocations: enhancedAllocations,
      supplierDebtBefore,
      supplierDebtAfter,
      dueStatus: calculatedDueStatus,
    };
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdatePurchaseReceiptDto,
    userId?: string,
  ) {
    const receipt = await this.prisma.purchaseReceipt.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
        supplier: true,
        warehouse: true,
        paymentAllocations: {
          include: {
            payment: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        purchaseReturns: true,
      },
    });

    if (!receipt) {
      throw new NotFoundException('Không tìm thấy phiếu nhập kho');
    }

    // 1. Kiểm tra kho và NCC nếu có thay đổi
    const targetWarehouseId = dto.warehouseId || receipt.warehouseId;
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: targetWarehouseId, tenantId },
    });
    if (!warehouse) {
      throw new NotFoundException('Không tìm thấy kho hàng');
    }

    // Không cho phép đổi NCC nếu phiếu đã phát sinh thanh toán hoặc trả hàng
    if (dto.supplierId && dto.supplierId !== receipt.supplierId) {
      if (receipt.paymentAllocations.length > 0 || receipt.purchaseReturns.length > 0) {
        throw new BadRequestException(
          'Không thể thay đổi Nhà cung cấp khi phiếu nhập đã có giao dịch thanh toán hoặc trả hàng.',
        );
      }
      const supplierExists = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, tenantId },
      });
      if (!supplierExists) {
        throw new NotFoundException('Không tìm thấy nhà cung cấp mới');
      }
    }
    const targetSupplierId = dto.supplierId || receipt.supplierId;

    // 2. Chuẩn bị dữ liệu items
    const hasItemsUpdate = dto.items !== undefined;
    let itemsData: Array<{
      tenantId: string;
      receiptId: string;
      variantId: string;
      productName: string;
      variationName: string | null;
      sku: string;
      orderedQuantity: number;
      receivedQuantity: number;
      disputedQuantity: number;
      unitPrice: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      note: string | null;
    }> = [];

    let totalItemsAmount = Number(receipt.totalItemsAmount);

    if (hasItemsUpdate) {
      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('Phiếu nhập phải có ít nhất 1 sản phẩm');
      }

      totalItemsAmount = 0;
      itemsData = dto.items.map((it) => {
        const subtotal = (it.receivedQuantity || 0) * (it.unitPrice || 0);
        totalItemsAmount += subtotal;
        return {
          tenantId,
          receiptId: id,
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
    }

    // 3. Tính toán lại tài chính
    const discountAmount =
      dto.discountAmount !== undefined ? dto.discountAmount : Number(receipt.discountAmount);
    const taxAmount =
      dto.taxAmount !== undefined ? dto.taxAmount : Number(receipt.taxAmount);
    const shippingFee =
      dto.shippingFee !== undefined ? dto.shippingFee : Number(receipt.shippingFee);
    const shippingFeePayerType =
      dto.shippingFeePayerType || receipt.shippingFeePayerType;
    const isShippingPaidToSupplier = shippingFeePayerType === 'PAID_TO_SUPPLIER';

    const newPayableAmount =
      totalItemsAmount -
      discountAmount +
      taxAmount +
      (isShippingPaidToSupplier ? shippingFee : 0);

    const currentPaid = Number(receipt.paidAmount);
    const currentReturnDeduction = Number(receipt.returnDeductionAmount);

    // Xác định receivingStatus
    let receivingStatus = receipt.receivingStatus;
    if (hasItemsUpdate) {
      const totalOrdered = itemsData.reduce((acc, it) => acc + it.orderedQuantity, 0);
      const totalReceived = itemsData.reduce((acc, it) => acc + it.receivedQuantity, 0);
      if (totalReceived === 0) {
        receivingStatus = 'PENDING_RECEIVE';
      } else if (totalReceived < totalOrdered) {
        receivingStatus = 'PARTIALLY_RECEIVED';
      } else {
        receivingStatus = 'RECEIVED';
      }
    }

    // 4. Thực thi transaction đảm bảo tính toàn vẹn và bất biến
    const updatedReceipt = await this.prisma.$transaction(async (tx) => {
      let finalPaid = currentPaid;
      let finalRemaining = Math.max(0, newPayableAmount - currentPaid - currentReturnDeduction);

      // Nếu số tiền phải trả mới nhỏ hơn số tiền đã trả + giảm trừ trả hàng (do giảm giá/giảm số lượng)
      // -> Trả lại phần thừa cho NCC vào quỹ tiền ứng trước (advanceAmount)
      if (newPayableAmount < currentPaid + currentReturnDeduction) {
        let excessAmount = (currentPaid + currentReturnDeduction) - newPayableAmount;
        let totalDeductedFromAllocations = 0;

        for (const alloc of receipt.paymentAllocations) {
          if (excessAmount <= 0) break;
          const allocAmount = Number(alloc.allocatedAmount);
          const deduct = Math.min(allocAmount, excessAmount);
          const newAlloc = allocAmount - deduct;

          if (newAlloc <= 0) {
            await tx.paymentAllocation.delete({ where: { id: alloc.id } });
          } else {
            await tx.paymentAllocation.update({
              where: { id: alloc.id },
              data: { allocatedAmount: new Prisma.Decimal(newAlloc) },
            });
          }

          if (alloc.payment) {
            const currentAllocOfPayment = Number(alloc.payment.allocatedAmount);
            const currentAdvOfPayment = Number(alloc.payment.advanceAmount);
            await tx.supplierPayment.update({
              where: { id: alloc.payment.id },
              data: {
                allocatedAmount: new Prisma.Decimal(Math.max(0, currentAllocOfPayment - deduct)),
                advanceAmount: new Prisma.Decimal(currentAdvOfPayment + deduct),
              },
            });
          }

          excessAmount -= deduct;
          totalDeductedFromAllocations += deduct;
        }

        finalPaid = Math.max(0, currentPaid - totalDeductedFromAllocations);
        finalRemaining = 0;
      }

      const newPaymentStatus: PurchasePaymentStatus =
        finalRemaining === 0
          ? PurchasePaymentStatus.PAID
          : finalPaid > 0
          ? PurchasePaymentStatus.PARTIALLY_PAID
          : PurchasePaymentStatus.UNPAID;

      // Xử lý tồn kho nếu items hoặc kho thay đổi
      if (hasItemsUpdate || (dto.warehouseId && dto.warehouseId !== receipt.warehouseId)) {
        const isWarehouseChanged = dto.warehouseId && dto.warehouseId !== receipt.warehouseId;

        if (isWarehouseChanged) {
          // Trừ toàn bộ tồn kho cũ ở kho cũ
          for (const oldItem of receipt.items) {
            if (oldItem.receivedQuantity > 0) {
              await tx.inventoryBalance.upsert({
                where: {
                  tenantId_warehouseId_variantId: {
                    tenantId,
                    warehouseId: receipt.warehouseId,
                    variantId: oldItem.variantId,
                  },
                },
                create: {
                  tenantId,
                  warehouseId: receipt.warehouseId,
                  variantId: oldItem.variantId,
                  onHand: -oldItem.receivedQuantity,
                  reserved: 0,
                },
                update: {
                  onHand: { decrement: oldItem.receivedQuantity },
                },
              });

              await tx.inventoryLedger.create({
                data: {
                  tenantId,
                  warehouseId: receipt.warehouseId,
                  variantId: oldItem.variantId,
                  movementType: InventoryMovementType.ADJUST,
                  deltaOnHand: -oldItem.receivedQuantity,
                  deltaReserved: 0,
                  referenceType: 'UPDATE_PURCHASE_RECEIPT',
                  referenceId: receipt.id,
                  performedByUserId: userId,
                  note: `Chuyển kho nhập cho phiếu ${receipt.receiptCode}: Hoàn trả kho cũ`,
                },
              });
            }
          }

          // Cộng toàn bộ tồn kho mới ở kho mới
          for (const newItem of itemsData) {
            if (newItem.receivedQuantity > 0) {
              await tx.inventoryBalance.upsert({
                where: {
                  tenantId_warehouseId_variantId: {
                    tenantId,
                    warehouseId: targetWarehouseId,
                    variantId: newItem.variantId,
                  },
                },
                create: {
                  tenantId,
                  warehouseId: targetWarehouseId,
                  variantId: newItem.variantId,
                  onHand: newItem.receivedQuantity,
                  reserved: 0,
                },
                update: {
                  onHand: { increment: newItem.receivedQuantity },
                },
              });

              await tx.inventoryLedger.create({
                data: {
                  tenantId,
                  warehouseId: targetWarehouseId,
                  variantId: newItem.variantId,
                  movementType: InventoryMovementType.RECEIVE,
                  deltaOnHand: newItem.receivedQuantity,
                  deltaReserved: 0,
                  referenceType: 'UPDATE_PURCHASE_RECEIPT',
                  referenceId: receipt.id,
                  performedByUserId: userId,
                  note: `Chuyển kho nhập cho phiếu ${receipt.receiptCode}: Nhập vào kho mới`,
                },
              });
            }
          }
        } else {
          // Cùng kho: Tính delta từng variant
          const oldVariantMap = new Map<string, number>();
          for (const it of receipt.items) {
            oldVariantMap.set(it.variantId, (oldVariantMap.get(it.variantId) || 0) + it.receivedQuantity);
          }

          const newVariantMap = new Map<string, number>();
          for (const it of itemsData) {
            newVariantMap.set(it.variantId, (newVariantMap.get(it.variantId) || 0) + it.receivedQuantity);
          }

          const allVariantIds = new Set([...oldVariantMap.keys(), ...newVariantMap.keys()]);
          for (const vId of allVariantIds) {
            const oldQty = oldVariantMap.get(vId) || 0;
            const newQty = newVariantMap.get(vId) || 0;
            const delta = newQty - oldQty;

            if (delta !== 0) {
              await tx.inventoryBalance.upsert({
                where: {
                  tenantId_warehouseId_variantId: {
                    tenantId,
                    warehouseId: targetWarehouseId,
                    variantId: vId,
                  },
                },
                create: {
                  tenantId,
                  warehouseId: targetWarehouseId,
                  variantId: vId,
                  onHand: delta,
                  reserved: 0,
                },
                update: {
                  onHand: { increment: delta },
                },
              });

              await tx.inventoryLedger.create({
                data: {
                  tenantId,
                  warehouseId: targetWarehouseId,
                  variantId: vId,
                  movementType: InventoryMovementType.ADJUST,
                  deltaOnHand: delta,
                  deltaReserved: 0,
                  referenceType: 'UPDATE_PURCHASE_RECEIPT',
                  referenceId: receipt.id,
                  performedByUserId: userId,
                  note: `Điều chỉnh SL phiếu nhập ${receipt.receiptCode} (${delta > 0 ? '+' : ''}${delta})`,
                },
              });
            }
          }
        }

        // Cập nhật lại items trong database
        await tx.purchaseReceiptItem.deleteMany({
          where: { receiptId: id },
        });

        await tx.purchaseReceiptItem.createMany({
          data: itemsData,
        });
      }

      // 5. Cập nhật giá vốn sản phẩm ProductVariant.costPrice & Đồng bộ COGS toàn hệ thống
      const itemsToCheckPrice = hasItemsUpdate ? itemsData : receipt.items;
      const syncOrderCogs = dto.syncOrderCogs !== false;

      for (const it of itemsToCheckPrice) {
        const unitPriceNum = Number(it.unitPrice);
        if (unitPriceNum >= 0) {
          // Cập nhật giá vốn biến thể SKU
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: { costPrice: new Prisma.Decimal(unitPriceNum) },
          });

          // Nếu được bật: Đồng bộ tính lại giá vốn cho tất cả đơn hàng đã phát sinh
          if (syncOrderCogs) {
            const orderItems = await tx.orderItem.findMany({
              where: { tenantId, variantId: it.variantId },
              select: { id: true, orderId: true, quantity: true },
            });

            if (orderItems.length > 0) {
              const affectedOrderIds = new Set<string>();

              for (const oi of orderItems) {
                const itemCogs = unitPriceNum * (oi.quantity || 1);
                await tx.orderItem.update({
                  where: { id: oi.id },
                  data: { itemCogs: new Prisma.Decimal(itemCogs) },
                });
                affectedOrderIds.add(oi.orderId);
              }

              for (const orderId of affectedOrderIds) {
                const allItems = await tx.orderItem.findMany({
                  where: { orderId },
                  select: { itemCogs: true },
                });
                const totalOrderCogs = allItems.reduce(
                  (sum, item) => sum + Number(item.itemCogs || 0),
                  0,
                );
                await tx.order.update({
                  where: { id: orderId },
                  data: { cogsTotal: new Prisma.Decimal(totalOrderCogs) },
                });
              }
            }
          }
        }
      }

      // 6. Cập nhật PurchaseReceipt
      const updated = await tx.purchaseReceipt.update({
        where: { id },
        data: {
          supplierId: targetSupplierId,
          warehouseId: targetWarehouseId,
          shopId: dto.shopId !== undefined ? (dto.shopId || null) : receipt.shopId,
          ...(dto.receiptDate && {
            receiptDate: dto.receiptDate.includes('T')
              ? new Date(dto.receiptDate)
              : new Date(`${dto.receiptDate}T${new Date().toTimeString().split(' ')[0]}`),
          }),
          ...(dto.paymentDueDate !== undefined && {
            paymentDueDate: dto.paymentDueDate ? new Date(dto.paymentDueDate) : null,
          }),
          ...(dto.note !== undefined && { note: dto.note?.trim() || null }),
          totalItemsAmount: new Prisma.Decimal(totalItemsAmount),
          discountAmount: new Prisma.Decimal(discountAmount),
          taxAmount: new Prisma.Decimal(taxAmount),
          shippingFee: new Prisma.Decimal(shippingFee),
          shippingFeePayerType,
          payableAmount: new Prisma.Decimal(newPayableAmount),
          paidAmount: new Prisma.Decimal(finalPaid),
          remainingAmount: new Prisma.Decimal(finalRemaining),
          paymentStatus: newPaymentStatus,
          receivingStatus,
        },
        include: {
          items: true,
          supplier: true,
          warehouse: true,
          shop: true,
          paymentAllocations: {
            include: { payment: true },
          },
          purchaseReturns: true,
        },
      });

      // 7. Nếu còn nợ và NCC có tiền ứng trước, thử auto offset
      if (finalRemaining > 0) {
        await this.autoOffsetSupplierReceipts(tx, tenantId, targetSupplierId, id);
      }

      return updated;
    });

    // 8. Ghi Audit Log
    await this.auditService.log({
      tenantId,
      userId,
      action: 'PURCHASE_RECEIPT_UPDATED',
      entityType: 'PurchaseReceipt',
      entityId: id,
      oldValues: {
        receiptCode: receipt.receiptCode,
        payableAmount: Number(receipt.payableAmount),
        paidAmount: Number(receipt.paidAmount),
        remainingAmount: Number(receipt.remainingAmount),
        itemCount: receipt.items.length,
      },
      newValues: {
        receiptCode: updatedReceipt.receiptCode,
        payableAmount: Number(updatedReceipt.payableAmount),
        paidAmount: Number(updatedReceipt.paidAmount),
        remainingAmount: Number(updatedReceipt.remainingAmount),
        itemCount: updatedReceipt.items.length,
        syncOrderCogs: dto.syncOrderCogs !== false,
      },
    });

    return updatedReceipt;
  }

  async delete(tenantId: string, id: string, userId?: string) {
    const receipt = await this.findOne(tenantId, id);

    if (receipt.purchaseReturns && receipt.purchaseReturns.length > 0) {
      throw new BadRequestException(
        'Không thể xóa phiếu nhập đã phát sinh phiếu trả hàng nhà cung cấp. Vui lòng hủy các phiếu trả hàng liên quan trước.'
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let totalRefundedToCash = 0;
      let totalAdvanceRestored = 0;

      // 1. Xử lý các phân bổ thanh toán (PaymentAllocation)
      const allocations = await tx.paymentAllocation.findMany({
        where: { receiptId: id, tenantId },
        include: {
          payment: {
            include: {
              allocations: true,
            },
          },
        },
      });

      for (const alloc of allocations) {
        const allocAmount = Number(alloc.allocatedAmount);
        const payment = alloc.payment;

        if (!payment) {
          await tx.paymentAllocation.delete({ where: { id: alloc.id } });
          continue;
        }

        // Kiểm tra xem payment này là thanh toán riêng cho phiếu nhập này (ví dụ tạo lúc thanh toán ngay hoặc chỉ thanh toán cho phiếu này)
        // hay là thanh toán gộp / tiền ứng trước cọc trước đó của NCC (tự động cấn trừ)
        const isSingleAllocForThisReceipt =
          payment.allocations.length === 1 && payment.allocations[0].id === alloc.id;
        const isImmediatePayment =
          payment.referenceCode === receipt.receiptCode ||
          payment.paymentCode === `PC-${receipt.receiptCode.replace('PNK-', '')}`;

        // Tìm các giao dịch sổ quỹ (CashTransaction) liên quan tới payment này
        const relatedCashTxs = await tx.cashTransaction.findMany({
          where: {
            tenantId,
            OR: [
              { relatedEntityType: 'SUPPLIER_PAYMENT', relatedEntityId: payment.id },
              { referenceCode: payment.paymentCode },
            ],
          },
        });

        if ((isImmediatePayment || isSingleAllocForThisReceipt) && relatedCashTxs.length > 0) {
          // Trường hợp 1: Phiếu chi tiền mặt / ngân hàng dành riêng cho việc thanh toán phiếu nhập này.
          // Hoàn tiền lại vào tài khoản tiền và xóa giao dịch thu chi + phiếu chi
          for (const cashTx of relatedCashTxs) {
            if (cashTx.fromAccountId) {
              await tx.cashAccount.update({
                where: { id: cashTx.fromAccountId },
                data: { currentBalance: { increment: cashTx.amount } },
              });
              totalRefundedToCash += Number(cashTx.amount);
            }
            if (cashTx.toAccountId) {
              await tx.cashAccount.update({
                where: { id: cashTx.toAccountId },
                data: { currentBalance: { decrement: cashTx.amount } },
              });
            }
            await tx.cashTransaction.delete({ where: { id: cashTx.id } });
          }

          // Xóa allocation và payment
          await tx.paymentAllocation.delete({ where: { id: alloc.id } });
          await tx.supplierPayment.delete({ where: { id: payment.id } });
        } else if (isImmediatePayment || isSingleAllocForThisReceipt) {
          // Thanh toán riêng cho phiếu nhập này nhưng không qua tài khoản tiền (ví dụ tiền cá nhân chi hộ PERSONAL_FUND)
          await tx.paymentAllocation.delete({ where: { id: alloc.id } });
          await tx.supplierPayment.delete({ where: { id: payment.id } });
        } else {
          // Trường hợp 2: Khoản tiền này là tiền cọc / tiền ứng trước NCC nợ shop (được auto-offset cấn trừ tự động)
          // hoặc là phiếu thanh toán chung cho nhiều phiếu nhập khác.
          // Hoàn trả lại số tiền này vào quỹ ứng trước (advanceAmount) của NCC, không làm mất tiền cọc của shop
          await tx.paymentAllocation.delete({ where: { id: alloc.id } });

          const newAllocated = Math.max(0, Number(payment.allocatedAmount) - allocAmount);
          const newAdvance = Math.max(0, Number(payment.advanceAmount) + allocAmount);

          await tx.supplierPayment.update({
            where: { id: payment.id },
            data: {
              allocatedAmount: new Prisma.Decimal(newAllocated),
              advanceAmount: new Prisma.Decimal(newAdvance),
            },
          });

          totalAdvanceRestored += allocAmount;
        }
      }

      // Kiểm tra thêm: Có CashTransaction nào gắn trực tiếp với mã phiếu nhập này chưa được xóa không
      const directCashTxs = await tx.cashTransaction.findMany({
        where: {
          tenantId,
          OR: [
            { referenceCode: receipt.receiptCode },
            { relatedEntityType: 'PURCHASE_RECEIPT', relatedEntityId: receipt.id },
          ],
        },
      });

      for (const dTx of directCashTxs) {
        if (dTx.fromAccountId) {
          await tx.cashAccount.update({
            where: { id: dTx.fromAccountId },
            data: { currentBalance: { increment: dTx.amount } },
          });
          totalRefundedToCash += Number(dTx.amount);
        }
        if (dTx.toAccountId) {
          await tx.cashAccount.update({
            where: { id: dTx.toAccountId },
            data: { currentBalance: { decrement: dTx.amount } },
          });
        }
        await tx.cashTransaction.delete({ where: { id: dTx.id } });
      }

      // Xóa các phân bổ chuyển tiền giữa các NCC nếu có
      await tx.supplierTransferAllocation.deleteMany({
        where: { receiptId: id },
      });

      // 2. Hoàn trả lại tồn kho đã cộng khi nhập
      for (const item of receipt.items) {
        if (item.receivedQuantity > 0) {
          await tx.inventoryBalance.upsert({
            where: {
              tenantId_warehouseId_variantId: {
                tenantId,
                warehouseId: receipt.warehouseId,
                variantId: item.variantId,
              },
            },
            create: {
              tenantId,
              warehouseId: receipt.warehouseId,
              variantId: item.variantId,
              onHand: -item.receivedQuantity,
              reserved: 0,
            },
            update: {
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
              performedByUserId: userId,
              note: `Hủy phiếu nhập ${receipt.receiptCode}`,
            },
          });
        }
      }

      // 3. Xóa các mặt hàng và xóa phiếu nhập
      await tx.purchaseReceiptItem.deleteMany({
        where: { receiptId: id },
      });

      await tx.purchaseReceipt.delete({ where: { id } });

      return {
        success: true,
        message: 'Đã hủy phiếu nhập kho và hoàn tiền / đảo ngược tồn kho thành công',
        totalRefundedToCash,
        totalAdvanceRestored,
      };
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'PURCHASE_RECEIPT_DELETED',
      entityType: 'PurchaseReceipt',
      entityId: receipt.id,
      oldValues: {
        receiptCode: receipt.receiptCode,
        supplierId: receipt.supplierId,
        supplierName: receipt.supplier?.name,
        warehouseId: receipt.warehouseId,
        payableAmount: receipt.payableAmount,
        paidAmount: receipt.paidAmount,
        totalRefundedToCash: result.totalRefundedToCash,
        totalAdvanceRestored: result.totalAdvanceRestored,
      },
    });

    return result;
  }

  /**
   * Tự động cấn trừ tiền ứng trước / tiền cọc của NCC vào các phiếu nhập còn nợ
   */
  async autoOffsetSupplierReceipts(
    tx: Prisma.TransactionClient,
    tenantId: string,
    supplierId: string,
    targetReceiptId?: string,
  ) {
    // 1. Lấy tất cả phiếu chi của NCC này có thể dùng để cấn trừ
    const payments = await tx.supplierPayment.findMany({
      where: {
        tenantId,
        supplierId,
        paymentType: { in: [SupplierPaymentType.PAYMENT, SupplierPaymentType.ADVANCE_DEPOSIT] },
      },
      orderBy: { paymentDate: 'asc' },
    });

    const availablePayments = payments
      .map((p) => {
        const amt = Number(p.amount);
        const alloc = Number(p.allocatedAmount);
        const adv = Number(p.advanceAmount);
        // Tiền chưa phân bổ = max(adv, amt - alloc)
        const available = Math.max(0, adv > 0 ? adv : amt - alloc);
        return {
          id: p.id,
          paymentCode: p.paymentCode,
          amount: amt,
          allocatedAmount: alloc,
          advanceAmount: adv,
          available,
        };
      })
      .filter((p) => p.available > 0);

    if (availablePayments.length === 0) {
      return [];
    }

    // 2. Lấy các phiếu nhập còn nợ (remainingAmount > 0)
    const receiptsWhere: Prisma.PurchaseReceiptWhereInput = {
      tenantId,
      supplierId,
      remainingAmount: { gt: 0 },
      ...(targetReceiptId ? { id: targetReceiptId } : {}),
    };

    const receipts = await tx.purchaseReceipt.findMany({
      where: receiptsWhere,
      orderBy: { receiptDate: 'asc' },
    });

    if (receipts.length === 0) {
      return [];
    }

    const allocationsCreated: any[] = [];

    // 3. Phân bổ tuần tự
    for (const rc of receipts) {
      let receiptRemaining = Number(rc.remainingAmount);
      let receiptPaid = Number(rc.paidAmount);

      for (const pm of availablePayments) {
        if (receiptRemaining <= 0) break;
        if (pm.available <= 0) continue;

        const offset = Math.min(receiptRemaining, pm.available);
        if (offset <= 0) continue;

        // Tạo bản ghi phân bổ
        const alloc = await tx.paymentAllocation.create({
          data: {
            tenantId,
            paymentId: pm.id,
            receiptId: rc.id,
            allocatedAmount: new Prisma.Decimal(offset),
            note: `Tự động cấn trừ từ tiền ứng trước của NCC (Phiếu chi ${pm.paymentCode})`,
          },
        });
        allocationsCreated.push(alloc);

        // Cập nhật payment
        pm.available -= offset;
        pm.allocatedAmount += offset;
        pm.advanceAmount = Math.max(0, pm.amount - pm.allocatedAmount);

        await tx.supplierPayment.update({
          where: { id: pm.id },
          data: {
            allocatedAmount: new Prisma.Decimal(pm.allocatedAmount),
            advanceAmount: new Prisma.Decimal(pm.advanceAmount),
          },
        });

        // Cập nhật receipt
        receiptRemaining -= offset;
        receiptPaid += offset;
      }

      const newPaymentStatus =
        receiptRemaining <= 0
          ? PurchasePaymentStatus.PAID
          : receiptPaid > 0
          ? PurchasePaymentStatus.PARTIALLY_PAID
          : PurchasePaymentStatus.UNPAID;

      await tx.purchaseReceipt.update({
        where: { id: rc.id },
        data: {
          paidAmount: new Prisma.Decimal(receiptPaid),
          remainingAmount: new Prisma.Decimal(Math.max(0, receiptRemaining)),
          paymentStatus: newPaymentStatus,
        },
      });
    }

    return allocationsCreated;
  }

  /**
   * API/Phương thức công khai để kích hoạt cấn trừ tự động nợ giữa NCC và các phiếu nhập
   */
  async autoOffset(tenantId: string, supplierId?: string) {
    const hasUnpaidReceipts = await this.prisma.purchaseReceipt.findFirst({
      where: { tenantId, remainingAmount: { gt: 0 }, ...(supplierId ? { supplierId } : {}) },
      select: { id: true },
    });

    if (!hasUnpaidReceipts) {
      return { success: true, message: 'Không có phiếu nhập nào còn nợ', totalAllocated: 0 };
    }

    return this.prisma.$transaction(async (tx) => {
      let supplierIds: string[] = [];
      if (supplierId) {
        supplierIds = [supplierId];
      } else {
        const receipts = await tx.purchaseReceipt.findMany({
          where: { tenantId, remainingAmount: { gt: 0 } },
          select: { supplierId: true },
          distinct: ['supplierId'],
        });
        supplierIds = receipts.map((r) => r.supplierId);
      }

      let totalAllocated = 0;
      for (const sId of supplierIds) {
        const allocs = await this.autoOffsetSupplierReceipts(tx, tenantId, sId);
        totalAllocated += allocs.length;
      }

      return {
        success: true,
        message: `Đã tự động cấn trừ công nợ thành công (${totalAllocated} khoản phân bổ)`,
        totalAllocated,
      };
    });
  }
}
