import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  ReconciliationFilterDto,
  BatchImportSettlementDto,
} from './dto/cashflow.dto';
import {
  Prisma,
  OrderReconciliationStatus,
  CashTransactionType,
  CashTransactionStatus,
  CashCategoryType,
} from '@prisma/client';

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Đồng bộ khởi tạo bản ghi đối soát cho các đơn hàng chưa có OrderReconciliationRecord
   */
  async syncMissingOrders(tenantId: string, shopId?: string) {
    const ordersWithoutReconciliation = await this.prisma.order.findMany({
      where: {
        tenantId,
        ...(shopId && { shopId }),
        reconciliation: null,
      },
      select: {
        id: true,
        tenantId: true,
        shopId: true,
        externalOrderId: true,
        totalAmount: true,
        shippingFee: true,
        discountAmount: true,
      },
      take: 200,
    });

    if (ordersWithoutReconciliation.length === 0) {
      return { syncedCount: 0 };
    }

    // Ước tính phí sàn mặc định (khoảng 8-12% nếu chưa có file quyết toán)
    const recordsToCreate = ordersWithoutReconciliation.map((ord) => {
      const totalAmt = Number(ord.totalAmount || 0);
      // Ước tính tiền thực nhận ban đầu (chờ đối chiếu thực tế)
      const estimatedFee = Math.round(totalAmt * 0.1); // ~10% phí tạm tính
      const estimatedPayout = Math.max(0, totalAmt - estimatedFee);

      return {
        tenantId: ord.tenantId,
        shopId: ord.shopId,
        orderId: ord.id,
        externalOrderId: ord.externalOrderId,
        orderItemAmount: new Prisma.Decimal(totalAmt),
        buyerPaidAmount: new Prisma.Decimal(totalAmt + Number(ord.shippingFee || 0)),
        estimatedPayout: new Prisma.Decimal(estimatedPayout),
        settledPayout: new Prisma.Decimal(0),
        commissionFee: new Prisma.Decimal(0),
        serviceFee: new Prisma.Decimal(0),
        transactionFee: new Prisma.Decimal(0),
        shippingFee: new Prisma.Decimal(0),
        adjustmentAmount: new Prisma.Decimal(0),
        reconciliationStatus: OrderReconciliationStatus.NO_DATA,
      };
    });

    await this.prisma.orderReconciliationRecord.createMany({
      data: recordsToCreate,
      skipDuplicates: true,
    });

    return { syncedCount: recordsToCreate.length };
  }

  /**
   * Lấy danh sách đối soát đơn hàng kèm 4 cột tiền trọng yếu
   */
  async getReconciliationList(tenantId: string, filter: ReconciliationFilterDto) {
    // Tự động kiểm tra và đồng bộ đơn mới nếu cần
    await this.syncMissingOrders(tenantId, filter.shopId);

    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderReconciliationRecordWhereInput = {
      tenantId,
      ...(filter.shopId && { shopId: filter.shopId }),
      ...(filter.reconciliationStatus && {
        reconciliationStatus: filter.reconciliationStatus,
      }),
      ...(filter.startDate || filter.endDate
        ? {
            createdAt: {
              ...(filter.startDate && { gte: new Date(filter.startDate) }),
              ...(filter.endDate && { lte: new Date(filter.endDate) }),
            },
          }
        : {}),
      ...(filter.search?.trim()
        ? {
            OR: [
              { externalOrderId: { contains: filter.search.trim(), mode: 'insensitive' } },
              { note: { contains: filter.search.trim(), mode: 'insensitive' } },
              {
                order: {
                  OR: [
                    { internalOrderCode: { contains: filter.search.trim(), mode: 'insensitive' } },
                    { trackingCode: { contains: filter.search.trim(), mode: 'insensitive' } },
                    { recipientName: { contains: filter.search.trim(), mode: 'insensitive' } },
                    { recipientPhone: { contains: filter.search.trim(), mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [total, items, stats] = await Promise.all([
      this.prisma.orderReconciliationRecord.count({ where }),
      this.prisma.orderReconciliationRecord.findMany({
        where,
        include: {
          shop: { select: { id: true, name: true } },
          order: {
            select: {
              id: true,
              internalOrderCode: true,
              externalOrderId: true,
              orderDate: true,
              platformStatus: true,
              fulfillmentStatus: true,
              trackingCode: true,
              shippingCarrier: true,
              totalAmount: true,
              orderItems: {
                select: {
                  productName: true,
                  variationName: true,
                  quantity: true,
                  discountedPrice: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.orderReconciliationRecord.aggregate({
        where,
        _sum: {
          orderItemAmount: true,
          estimatedPayout: true,
          settledPayout: true,
          commissionFee: true,
          serviceFee: true,
          transactionFee: true,
          shippingFee: true,
          adjustmentAmount: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // Thống kê theo trạng thái
    const statusCounts = await this.prisma.orderReconciliationRecord.groupBy({
      by: ['reconciliationStatus'],
      where: {
        tenantId,
        ...(filter.shopId && { shopId: filter.shopId }),
      },
      _count: {
        id: true,
      },
    });

    const statusMap: Record<string, number> = {
      NO_DATA: 0,
      UNMATCHED: 0,
      MATCHED: 0,
      NEEDS_CHECK: 0,
    };
    for (const sc of statusCounts) {
      statusMap[sc.reconciliationStatus] = sc._count.id;
    }

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalGoodsValue: Number(stats._sum.orderItemAmount || 0),
        totalEstimatedPayout: Number(stats._sum.estimatedPayout || 0),
        totalSettledPayout: Number(stats._sum.settledPayout || 0),
        totalFees:
          Number(stats._sum.commissionFee || 0) +
          Number(stats._sum.serviceFee || 0) +
          Number(stats._sum.transactionFee || 0) +
          Number(stats._sum.shippingFee || 0),
        totalAdjustment: Number(stats._sum.adjustmentAmount || 0),
        statusCounts: statusMap,
      },
    };
  }

  /**
   * Import file quyết toán / thu nhập Shopee
   * - Khớp theo externalOrderId
   * - Cập nhật 4 cột tiền, trạng thái đối soát
   * - Tùy chọn ghi nhận tổng tiền quyết toán vào tài khoản ví sàn của shop (chỉ 1 lần, không tạo đúp)
   */
  async batchImportSettlement(
    tenantId: string,
    userId: string,
    dto: BatchImportSettlementDto,
  ) {
    if (!dto.rows || dto.rows.length === 0) {
      throw new BadRequestException('Danh sách dòng quyết toán không được để trống');
    }

    const shop = await this.prisma.shop.findFirst({
      where: { id: dto.shopId, tenantId },
    });
    if (!shop) {
      throw new NotFoundException('Không tìm thấy thông tin shop');
    }

    let matchedCount = 0;
    let unmatchedCount = 0;
    let needsCheckCount = 0;
    let totalSettledAmount = 0;

    const results: Array<{
      externalOrderId: string;
      status: OrderReconciliationStatus;
      actualPayout: number;
      difference: number;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const row of dto.rows) {
        const extOrderId = row.externalOrderId.trim();
        const actualPayout = Number(row.actualPayout || 0);
        const buyerPaid = Number(row.buyerPaidAmount || 0);
        const commissionFee = Number(row.commissionFee || 0);
        const serviceFee = Number(row.serviceFee || 0);
        const transactionFee = Number(row.transactionFee || 0);
        const shippingFee = Number(row.shippingFee || 0);
        const adjustment = Number(row.adjustmentAmount || 0);
        const payoutDate = row.settledAt ? new Date(row.settledAt) : new Date();

        // 1. Tìm đơn hàng tương ứng trong shop
        const existingOrder = await tx.order.findFirst({
          where: {
            tenantId,
            shopId: dto.shopId,
            externalOrderId: extOrderId,
          },
        });

        if (!existingOrder) {
          unmatchedCount++;
          results.push({
            externalOrderId: extOrderId,
            status: OrderReconciliationStatus.UNMATCHED,
            actualPayout,
            difference: 0,
          });
          continue;
        }

        // 2. Tìm hoặc tạo OrderReconciliationRecord
        let recon = await tx.orderReconciliationRecord.findUnique({
          where: { orderId: existingOrder.id },
        });

        const goodsValue = Number(existingOrder.totalAmount || 0);
        const estimatedPayout = recon
          ? Number(recon.estimatedPayout || 0)
          : Math.max(0, goodsValue - (commissionFee + serviceFee + transactionFee));

        // 3. Đánh giá trạng thái đối soát
        let status: OrderReconciliationStatus = OrderReconciliationStatus.MATCHED;
        const diff = Math.abs(estimatedPayout - actualPayout);

        if (adjustment !== 0 || actualPayout <= 0) {
          status = OrderReconciliationStatus.NEEDS_CHECK;
          needsCheckCount++;
        } else if (diff > 5000) {
          // Lệch trên 5.000đ so với dự kiến -> Chưa khớp hoàn toàn
          status = OrderReconciliationStatus.UNMATCHED;
          unmatchedCount++;
        } else {
          matchedCount++;
        }

        totalSettledAmount += actualPayout;

        if (recon) {
          await tx.orderReconciliationRecord.update({
            where: { id: recon.id },
            data: {
              settledPayout: new Prisma.Decimal(actualPayout),
              buyerPaidAmount: new Prisma.Decimal(buyerPaid > 0 ? buyerPaid : Number(recon.buyerPaidAmount)),
              commissionFee: new Prisma.Decimal(commissionFee),
              serviceFee: new Prisma.Decimal(serviceFee),
              transactionFee: new Prisma.Decimal(transactionFee),
              shippingFee: new Prisma.Decimal(shippingFee),
              adjustmentAmount: new Prisma.Decimal(adjustment),
              reconciliationStatus: status,
              payoutDate,
              rawSettlementData: row.rawPlatformData || undefined,
            },
          });
        } else {
          await tx.orderReconciliationRecord.create({
            data: {
              tenantId,
              shopId: dto.shopId,
              orderId: existingOrder.id,
              externalOrderId: extOrderId,
              orderItemAmount: new Prisma.Decimal(goodsValue),
              buyerPaidAmount: new Prisma.Decimal(buyerPaid),
              estimatedPayout: new Prisma.Decimal(estimatedPayout),
              settledPayout: new Prisma.Decimal(actualPayout),
              commissionFee: new Prisma.Decimal(commissionFee),
              serviceFee: new Prisma.Decimal(serviceFee),
              transactionFee: new Prisma.Decimal(transactionFee),
              shippingFee: new Prisma.Decimal(shippingFee),
              adjustmentAmount: new Prisma.Decimal(adjustment),
              reconciliationStatus: status,
              payoutDate,
              rawSettlementData: row.rawPlatformData || undefined,
            },
          });
        }

        results.push({
          externalOrderId: extOrderId,
          status,
          actualPayout,
          difference: actualPayout - estimatedPayout,
        });
      }

      // 4. Nếu người dùng chọn ghi nhận vào tài khoản số dư sàn của shop
      if (dto.creditToAccountId && totalSettledAmount > 0) {
        const walletAccount = await tx.cashAccount.findFirst({
          where: { id: dto.creditToAccountId, tenantId },
        });

        if (walletAccount) {
          // Tìm danh mục Tiền Shopee quyết toán
          const shopeeIncomeCat = await tx.cashCategory.findFirst({
            where: { tenantId, code: 'THU_SHOPEE_QUYET_TOAN' },
          });

          if (shopeeIncomeCat) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
            const txCode = `PT-QS-${y}${m}${d}-${rand}`;

            await tx.cashTransaction.create({
              data: {
                tenantId,
                shopId: dto.shopId,
                transactionCode: txCode,
                type: CashTransactionType.INCOME,
                categoryId: shopeeIncomeCat.id,
                toAccountId: walletAccount.id,
                amount: new Prisma.Decimal(totalSettledAmount),
                transactionDate: now,
                paymentMethod: 'PLATFORM_BALANCE',
                status: CashTransactionStatus.CONFIRMED,
                counterpartyName: `Sàn Shopee (${shop.name})`,
                note: `Quyết toán tiền đơn hàng Shopee theo file đối soát (${dto.rows.length} đơn)`,
                createdById: userId,
                confirmedById: userId,
                confirmedAt: now,
              },
            });

            // Tăng số dư ví sàn Shopee
            await tx.cashAccount.update({
              where: { id: walletAccount.id },
              data: {
                currentBalance: { increment: new Prisma.Decimal(totalSettledAmount) },
              },
            });
          }
        }
      }
    });

    return {
      totalProcessed: dto.rows.length,
      matchedCount,
      unmatchedCount,
      needsCheckCount,
      totalSettledAmount,
      results,
    };
  }
}
