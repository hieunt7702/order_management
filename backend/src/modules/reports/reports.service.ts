import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DashboardFilterDto } from './dto/report.dto';
import { PlatformOrderStatus, VerificationStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary(
    tenantId: string,
    allowedShopIds: string[] | null,
    filter: DashboardFilterDto,
  ) {
    const start = filter.fromDate || filter.startDate;
    const end = filter.toDate || filter.endDate;

    const whereOrderBase: any = {
      tenantId,
      ...(filter.shopId ? { shopId: filter.shopId } : {}),
    };

    if (allowedShopIds) {
      if (filter.shopId && !allowedShopIds.includes(filter.shopId)) {
        whereOrderBase.shopId = '00000000-0000-0000-0000-000000000000'; // empty match
      } else {
        whereOrderBase.shopId = { in: allowedShopIds };
      }
    }

    if (start || end) {
      whereOrderBase.orderDate = {};
      if (start) {
        whereOrderBase.orderDate.gte = new Date(start);
      }
      if (end) {
        const endDateObj = new Date(end);
        if (end.length <= 10) {
          endDateObj.setHours(23, 59, 59, 999);
        }
        whereOrderBase.orderDate.lte = endDateObj;
      }
    }

    // Filter by platformStatuses (multi-select Shopee order statuses)
    const whereOrder = { ...whereOrderBase };
    let activeStatuses: PlatformOrderStatus[] = [];
    if (filter.platformStatuses && filter.platformStatuses.trim()) {
      activeStatuses = filter.platformStatuses
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as PlatformOrderStatus[];
      if (activeStatuses.length > 0) {
        whereOrder.platformStatus = { in: activeStatuses };
      }
    }

    // 1. Order status counts (use whereOrderBase so user sees overall status numbers)
    const statusCounts = await this.prisma.order.groupBy({
      by: ['platformStatus'],
      where: whereOrderBase,
      _count: { id: true },
    });

    const statusMap: Record<string, number> = {};
    statusCounts.forEach((sc) => {
      statusMap[sc.platformStatus] = sc._count.id;
    });

    // 2. Verification status counts
    const verificationCounts = await this.prisma.order.groupBy({
      by: ['verificationStatus'],
      where: whereOrder,
      _count: { id: true },
    });

    const verificationMap: Record<string, number> = {};
    verificationCounts.forEach((vc) => {
      verificationMap[vc.verificationStatus] = vc._count.id;
    });

    // 3. Financial Aggregation
    const totalGmvAgg = await this.prisma.order.aggregate({
      where: whereOrder,
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    // Completed revenue and COGS
    const canIncludeCompleted =
      activeStatuses.length === 0 ||
      activeStatuses.includes(PlatformOrderStatus.COMPLETED);

    let completedRevenue = 0;
    let completedCogs = 0;

    if (canIncludeCompleted) {
      const completedRevenueAgg = await this.prisma.order.aggregate({
        where: {
          ...whereOrderBase,
          platformStatus: PlatformOrderStatus.COMPLETED,
        },
        _sum: {
          totalAmount: true,
          cogsTotal: true,
        },
      });
      completedRevenue = Number(completedRevenueAgg._sum.totalAmount || 0);
      completedCogs = Number(completedRevenueAgg._sum.cogsTotal || 0);
    }

    // Actual settled amount
    const whereSettlement: any = { tenantId };
    if (filter.shopId) whereSettlement.shopId = filter.shopId;
    if (allowedShopIds) whereSettlement.shopId = { in: allowedShopIds };

    const settledAgg = await this.prisma.settlement.aggregate({
      where: whereSettlement,
      _sum: {
        actualReceivedAmount: true,
        commissionFee: true,
        serviceFee: true,
        transactionFee: true,
      },
    });

    const totalOrders = totalGmvAgg._count.id || 0;
    const gmv = Number(totalGmvAgg._sum.totalAmount || 0);
    const estimatedGrossProfit = completedRevenue - completedCogs;
    const actualSettled = Number(settledAgg._sum.actualReceivedAmount || 0);
    const totalPlatformFees =
      Number(settledAgg._sum.commissionFee || 0) +
      Number(settledAgg._sum.serviceFee || 0) +
      Number(settledAgg._sum.transactionFee || 0);

    // 4. Low stock SKU count
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { tenantId },
      include: {
        variant: { select: { lowStockThreshold: true } },
      },
    });
    const lowStockCount = balances.filter(
      (b) => b.onHand - b.reserved <= b.variant.lowStockThreshold,
    ).length;

    // 5. Top 10 Best Selling Items (strictly filtered by whereOrder)
    const topItems = await this.prisma.orderItem.groupBy({
      by: ['productName', 'externalSku'],
      where: {
        order: whereOrder,
      },
      _sum: { quantity: true },
      orderBy: {
        _sum: { quantity: 'desc' },
      },
      take: 10,
    });

    const totalPackages = await this.prisma.package.count({
      where: { order: whereOrder },
    });
    const verifiedPackages = await this.prisma.package.count({
      where: { order: whereOrder, status: 'DISPATCHED' },
    });

    return {
      financials: {
        gmv,
        completedRevenue,
        completedCogs,
        estimatedGrossProfit,
        actualSettled,
        totalPlatformFees,
        currency: 'VND',
      },
      orderStats: {
        totalOrders,
        readyToShip: statusMap[PlatformOrderStatus.READY_TO_SHIP] || 0,
        shipped: statusMap[PlatformOrderStatus.SHIPPED] || 0,
        completed: statusMap[PlatformOrderStatus.COMPLETED] || 0,
        cancelled: statusMap[PlatformOrderStatus.CANCELLED] || 0,
        returned: statusMap[PlatformOrderStatus.TO_RETURN] || 0,
      },
      fulfillmentStats: {
        totalPackages,
        verifiedPackages,
        verificationRatePercent:
          totalPackages > 0 ? Math.round((verifiedPackages / totalPackages) * 100) : 0,
        notVerifiedOrders: verificationMap[VerificationStatus.NOT_VERIFIED] || 0,
        partiallyVerifiedOrders: verificationMap[VerificationStatus.PARTIALLY_VERIFIED] || 0,
        verifiedOrders: verificationMap[VerificationStatus.VERIFIED] || 0,
      },
      inventoryAlerts: {
        lowStockVariantsCount: lowStockCount,
      },
      topSellingItems: topItems.map((ti) => ({
        productName: ti.productName,
        sku: ti.externalSku,
        totalQuantitySold: ti._sum.quantity || 0,
      })),
      filterMeta: {
        activePlatformStatuses: activeStatuses,
      },
    };
  }
}
