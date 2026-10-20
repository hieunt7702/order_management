import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreatePurchaseReturnDto,
  PurchaseReturnFilterDto,
} from './dto/purchase-return.dto';
import {
  Prisma,
  InventoryMovementType,
  PurchasePaymentStatus,
  CashAccountType,
  CashCategoryType,
  CashTransactionType,
  CashTransactionStatus,
  SupplierPaymentType,
} from '@prisma/client';

@Injectable()
export class PurchaseReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateUniqueReturnCode(tenantId: string): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `TH-${y}${m}${d}`;
    for (let i = 0; i < 100; i++) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `${prefix}-${rand}`;
      const existing = await this.prisma.purchaseReturn.findUnique({
        where: { tenantId_returnCode: { tenantId, returnCode: code } },
      });
      if (!existing) return code;
    }
    return `${prefix}-${Date.now().toString().slice(-4)}`;
  }

  async create(tenantId: string, userId: string, dto: CreatePurchaseReturnDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Phiếu trả hàng phải có ít nhất 1 sản phẩm');
    }

    const [supplier, warehouse] = await Promise.all([
      this.prisma.supplier.findFirst({ where: { id: dto.supplierId, tenantId } }),
      this.prisma.warehouse.findFirst({ where: { id: dto.warehouseId, tenantId } }),
    ]);

    if (!supplier) throw new NotFoundException('Không tìm thấy nhà cung cấp');
    if (!warehouse) throw new NotFoundException('Không tìm thấy kho xuất trả');

    let returnCode = dto.returnCode?.trim().toUpperCase();
    if (!returnCode) {
      returnCode = await this.generateUniqueReturnCode(tenantId);
    } else {
      const existing = await this.prisma.purchaseReturn.findUnique({
        where: { tenantId_returnCode: { tenantId, returnCode } },
      });
      if (existing) {
        returnCode = await this.generateUniqueReturnCode(tenantId);
      }
    }

    let totalReturnAmount = 0;
    const itemsData = dto.items.map((it) => {
      const subtotal = it.quantity * it.unitPrice;
      totalReturnAmount += subtotal;
      return {
        tenantId,
        variantId: it.variantId,
        sku: it.sku.trim(),
        quantity: it.quantity,
        unitPrice: new Prisma.Decimal(it.unitPrice),
        subtotal: new Prisma.Decimal(subtotal),
      };
    });

    const debtOffsetAmount =
      dto.debtOffsetAmount !== undefined ? dto.debtOffsetAmount : totalReturnAmount;

    const settlementType = dto.settlementType || (dto.receiptId ? 'OFFSET_DEBT' : 'ACCUMULATE_DEBT');
    const returnDate = dto.returnDate
      ? (dto.returnDate.includes('T') ? new Date(dto.returnDate) : new Date(`${dto.returnDate}T${new Date().toTimeString().split(' ')[0]}`))
      : new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo phiếu trả / chuyển hàng
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          tenantId,
          supplierId: dto.supplierId,
          receiptId: dto.receiptId || null,
          returnCode,
          returnDate,
          totalReturnAmount: new Prisma.Decimal(totalReturnAmount),
          debtOffsetAmount: new Prisma.Decimal(debtOffsetAmount),
          status: 'CONFIRMED',
          reason:
            dto.reason?.trim() ||
            (settlementType === 'IMMEDIATE_PAYMENT'
              ? 'Xuất chuyển hàng NCC (Thanh toán luôn)'
              : settlementType === 'ACCUMULATE_DEBT'
              ? 'Xuất chuyển hàng NCC (Cộng dồn vào nợ)'
              : 'Xuất chuyển hàng NCC (Khấu trừ nợ)'),
          note: dto.note?.trim() || null,
          createdById: userId,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: true,
          supplier: true,
          receipt: true,
        },
      });

      // 2. Trừ tồn kho onHand và ghi bút toán Sổ cái InventoryLedger
      for (const item of itemsData) {
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
            onHand: -item.quantity,
            reserved: 0,
          },
          update: {
            onHand: { decrement: item.quantity },
          },
        });

        await tx.inventoryLedger.create({
          data: {
            tenantId,
            warehouseId: dto.warehouseId,
            variantId: item.variantId,
            movementType: InventoryMovementType.ADJUST,
            deltaOnHand: -item.quantity,
            deltaReserved: 0,
            referenceType: 'PURCHASE_RETURN',
            referenceId: purchaseReturn.id,
            performedByUserId: userId,
            note: `Xuất chuyển hàng cho NCC ${supplier.name} theo phiếu ${returnCode}`,
          },
        });
      }

      // 3. Xử lý tài chính theo 3 phương án
      if (settlementType === 'OFFSET_DEBT') {
        // Phương án 1: Khấu trừ nợ
        if (dto.receiptId && debtOffsetAmount > 0) {
          const receipt = await tx.purchaseReceipt.findFirst({
            where: { id: dto.receiptId, tenantId, supplierId: dto.supplierId },
          });

          if (receipt) {
            const currentPayable = Number(receipt.payableAmount);
            const currentPaid = Number(receipt.paidAmount);
            const currentReturnDeduction = Number(receipt.returnDeductionAmount);

            const newReturnDeduction = currentReturnDeduction + debtOffsetAmount;
            const newRemaining = Math.max(0, currentPayable - currentPaid - newReturnDeduction);

            let newStatus: PurchasePaymentStatus = PurchasePaymentStatus.PARTIALLY_PAID;
            if (newRemaining <= 0) {
              newStatus = PurchasePaymentStatus.PAID;
            } else if (currentPaid <= 0 && newReturnDeduction === 0) {
              newStatus = PurchasePaymentStatus.UNPAID;
            }

            await tx.purchaseReceipt.update({
              where: { id: dto.receiptId },
              data: {
                returnDeductionAmount: new Prisma.Decimal(newReturnDeduction),
                remainingAmount: new Prisma.Decimal(newRemaining),
                paymentStatus: newStatus,
              },
            });
          }
        } else if (debtOffsetAmount > 0) {
          // Tự động cấn trừ các phiếu nhập còn nợ của NCC
          const unpaidReceipts = await tx.purchaseReceipt.findMany({
            where: { tenantId, supplierId: dto.supplierId, remainingAmount: { gt: 0 } },
            orderBy: [{ receiptDate: 'asc' }, { createdAt: 'asc' }],
          });

          let remainOffset = debtOffsetAmount;
          for (const rc of unpaidReceipts) {
            if (remainOffset <= 0) break;
            const rcRemaining = Number(rc.remainingAmount);
            const rcReturnDeduction = Number(rc.returnDeductionAmount);
            const rcPayable = Number(rc.payableAmount);
            const rcPaid = Number(rc.paidAmount);

            const deduct = Math.min(remainOffset, rcRemaining);
            const newReturnDeduction = rcReturnDeduction + deduct;
            const newRemaining = Math.max(0, rcPayable - rcPaid - newReturnDeduction);
            const newStatus =
              newRemaining <= 0 ? PurchasePaymentStatus.PAID : PurchasePaymentStatus.PARTIALLY_PAID;

            await tx.purchaseReceipt.update({
              where: { id: rc.id },
              data: {
                returnDeductionAmount: new Prisma.Decimal(newReturnDeduction),
                remainingAmount: new Prisma.Decimal(newRemaining),
                paymentStatus: newStatus,
              },
            });

            remainOffset -= deduct;
          }
        }
      } else if (settlementType === 'IMMEDIATE_PAYMENT') {
        // Phương án 3: NCC thanh toán tiền luôn cho shop (tiền mặt / chuyển khoản)
        let toAccountId = dto.immediateAccountId || null;
        if (!toAccountId) {
          const accType =
            dto.immediateFundSource === 'BANK_ACCOUNT' ? CashAccountType.BANK : CashAccountType.CASH;
          const acc = await tx.cashAccount.findFirst({
            where: { tenantId, type: accType, isActive: true },
            orderBy: { createdAt: 'asc' },
          });
          if (acc) toAccountId = acc.id;
        }

        let category = await tx.cashCategory.findFirst({
          where: { tenantId, code: 'THU_NCC_HOAN_TIEN' },
        });
        if (!category) {
          category = await tx.cashCategory.findFirst({
            where: { tenantId, type: CashCategoryType.INCOME },
          });
        }
        if (!category) {
          category = await tx.cashCategory.create({
            data: {
              tenantId,
              code: 'THU_NCC_HOAN_TIEN',
              name: 'Nhà cung cấp thanh toán / hoàn tiền',
              type: CashCategoryType.INCOME,
              isSystemDefault: true,
            },
          });
        }

        const paymentCode = `THU-${returnCode}`;
        await tx.supplierPayment.create({
          data: {
            tenantId,
            supplierId: dto.supplierId,
            paymentCode,
            amount: new Prisma.Decimal(totalReturnAmount),
            paymentDate: returnDate,
            payerName: dto.immediatePayerName?.trim() || supplier.name,
            payerUserId: userId,
            fundSource: (dto.immediateFundSource as any) || 'CASH_FUND',
            paymentMethod: dto.immediatePaymentMethod || 'BANK_TRANSFER',
            referenceCode: returnCode,
            paymentType: SupplierPaymentType.REFUND_RECEIVED,
            allocatedAmount: new Prisma.Decimal(0),
            advanceAmount: new Prisma.Decimal(0),
            note: `Thu tiền ngay khi xuất chuyển hàng cho NCC ${supplier.name} theo phiếu ${returnCode}`,
            createdById: userId,
          },
        });

        await tx.cashTransaction.create({
          data: {
            tenantId,
            transactionCode: paymentCode,
            type: CashTransactionType.INCOME,
            categoryId: category.id,
            toAccountId,
            amount: new Prisma.Decimal(totalReturnAmount),
            transactionDate: returnDate,
            paymentMethod: dto.immediatePaymentMethod || 'BANK_TRANSFER',
            status: CashTransactionStatus.CONFIRMED,
            counterpartyName: supplier.name,
            performedByName: dto.immediatePayerName?.trim() || null,
            referenceCode: returnCode,
            note: `Thu tiền khi xuất chuyển hàng cho NCC ${supplier.name} theo phiếu ${returnCode}`,
            relatedEntityType: 'PURCHASE_RETURN',
            relatedEntityId: purchaseReturn.id,
            createdById: userId,
            confirmedById: userId,
            confirmedAt: new Date(),
          },
        });

        if (toAccountId) {
          await tx.cashAccount.update({
            where: { id: toAccountId },
            data: { currentBalance: { increment: new Prisma.Decimal(totalReturnAmount) } },
          });
        }
      }
      // Phương án 2: ACCUMULATE_DEBT (Cộng dồn vào nợ): debtOffsetAmount được lưu trên purchaseReturn, giúp giảm nợ NCC hoặc biến thành nợ NCC phải trả shop.

      return purchaseReturn;
    });
  }

  async findAll(tenantId: string, filter: PurchaseReturnFilterDto = {}) {
    const where: Prisma.PurchaseReturnWhereInput = {
      tenantId,
      ...(filter.supplierId && { supplierId: filter.supplierId }),
      ...(filter.receiptId && { receiptId: filter.receiptId }),
    };

    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 25));
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.purchaseReturn.count({ where }),
      this.prisma.purchaseReturn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { returnDate: 'desc' },
        include: {
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          receipt: {
            select: {
              id: true,
              receiptCode: true,
              payableAmount: true,
              paidAmount: true,
              returnDeductionAmount: true,
            },
          },
          items: true,
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
    const purchaseReturn = await this.prisma.purchaseReturn.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        receipt: true,
        items: {
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                name: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!purchaseReturn) {
      throw new NotFoundException('Không tìm thấy phiếu trả hàng nhà cung cấp');
    }

    return purchaseReturn;
  }

  async delete(tenantId: string, id: string) {
    const purchaseReturn = await this.prisma.purchaseReturn.findFirst({
      where: { id, tenantId },
      include: { items: true, receipt: true },
    });

    if (!purchaseReturn) {
      throw new NotFoundException('Không tìm thấy phiếu trả hàng nhà cung cấp');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Phục hồi tồn kho onHand
      for (const item of purchaseReturn.items) {
        // Tìm warehouse từ receipt nếu có hoặc warehouse đầu tiên
        let warehouseId = purchaseReturn.receipt?.warehouseId;
        if (!warehouseId) {
          const firstWarehouse = await tx.warehouse.findFirst({ where: { tenantId } });
          warehouseId = firstWarehouse?.id;
        }

        if (warehouseId) {
          await tx.inventoryBalance.update({
            where: {
              tenantId_warehouseId_variantId: {
                tenantId,
                warehouseId,
                variantId: item.variantId,
              },
            },
            data: {
              onHand: { increment: item.quantity },
            },
          });

          await tx.inventoryLedger.create({
            data: {
              tenantId,
              warehouseId,
              variantId: item.variantId,
              movementType: InventoryMovementType.RECEIVE,
              deltaOnHand: item.quantity,
              deltaReserved: 0,
              referenceType: 'PURCHASE_RETURN_CANCEL',
              referenceId: purchaseReturn.id,
              note: `Hủy phiếu trả hàng ${purchaseReturn.returnCode}`,
            },
          });
        }
      }

      // 2. Khôi phục lại công nợ phiếu nhập nếu có
      if (purchaseReturn.receiptId && Number(purchaseReturn.debtOffsetAmount) > 0) {
        const receipt = await tx.purchaseReceipt.findUnique({
          where: { id: purchaseReturn.receiptId },
        });

        if (receipt) {
          const currentPayable = Number(receipt.payableAmount);
          const currentPaid = Number(receipt.paidAmount);
          const currentReturnDeduction = Number(receipt.returnDeductionAmount);
          const offsetAmount = Number(purchaseReturn.debtOffsetAmount);

          const newReturnDeduction = Math.max(0, currentReturnDeduction - offsetAmount);
          const newRemaining = Math.max(0, currentPayable - currentPaid - newReturnDeduction);

          let newStatus: PurchasePaymentStatus = PurchasePaymentStatus.UNPAID;
          if (newRemaining <= 0) {
            newStatus = PurchasePaymentStatus.PAID;
          } else if (currentPaid > 0) {
            newStatus = PurchasePaymentStatus.PARTIALLY_PAID;
          }

          await tx.purchaseReceipt.update({
            where: { id: purchaseReturn.receiptId },
            data: {
              returnDeductionAmount: new Prisma.Decimal(newReturnDeduction),
              remainingAmount: new Prisma.Decimal(newRemaining),
              paymentStatus: newStatus,
            },
          });
        }
      }

      // 3. Khôi phục tiền nếu từng thu tiền mặt / ngân hàng khi chuyển hàng
      const relatedCashTx = await tx.cashTransaction.findFirst({
        where: {
          tenantId,
          relatedEntityType: 'PURCHASE_RETURN',
          relatedEntityId: id,
        },
      });
      if (relatedCashTx) {
        if (relatedCashTx.toAccountId) {
          await tx.cashAccount.update({
            where: { id: relatedCashTx.toAccountId },
            data: { currentBalance: { decrement: relatedCashTx.amount } },
          });
        }
        await tx.cashTransaction.delete({ where: { id: relatedCashTx.id } });
      }

      await tx.supplierPayment.deleteMany({
        where: {
          tenantId,
          referenceCode: purchaseReturn.returnCode,
          paymentType: SupplierPaymentType.REFUND_RECEIVED,
        },
      });

      // 4. Xóa items và phiếu trả
      await tx.purchaseReturnItem.deleteMany({ where: { returnId: id } });
      await tx.purchaseReturn.delete({ where: { id } });

      return {
        success: true,
        message: 'Đã xóa phiếu trả hàng và khôi phục tồn kho & công nợ',
      };
    });
  }
}
