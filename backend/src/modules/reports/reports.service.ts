import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DashboardFilterDto, PurchaseReportFilterDto } from './dto/report.dto';
import { PlatformOrderStatus, VerificationStatus, Prisma } from '@prisma/client';

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
        shipped: (statusMap[PlatformOrderStatus.SHIPPED] || 0) + (statusMap[PlatformOrderStatus.RETRY_SHIP] || 0),
        delivering: (statusMap[PlatformOrderStatus.SHIPPED] || 0) + (statusMap[PlatformOrderStatus.RETRY_SHIP] || 0),
        completed: (statusMap[PlatformOrderStatus.COMPLETED] || 0) + (statusMap[PlatformOrderStatus.TO_CONFIRM_RECEIVE] || 0),
        completedOnly: statusMap[PlatformOrderStatus.COMPLETED] || 0,
        toConfirmReceive: statusMap[PlatformOrderStatus.TO_CONFIRM_RECEIVE] || 0,
        cancelled: (statusMap[PlatformOrderStatus.CANCELLED] || 0) + (statusMap[PlatformOrderStatus.IN_CANCEL] || 0),
        returned: (statusMap[PlatformOrderStatus.TO_RETURN] || 0) + (statusMap[PlatformOrderStatus.RETURN_REFUND] || 0),
        statusMap,
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

  async getPurchaseReport(
    tenantId: string,
    allowedShopIds: string[] | null,
    filter: PurchaseReportFilterDto,
  ) {
    const start = filter.startDate || filter.fromDate;
    const end = filter.endDate || filter.toDate;

    const where: Prisma.PurchaseReceiptWhereInput = {
      tenantId,
    };

    // Date range filter on receiptDate
    if (start || end) {
      where.receiptDate = {};
      if (start) {
        const startDateObj = new Date(start);
        startDateObj.setHours(0, 0, 0, 0);
        where.receiptDate.gte = startDateObj;
      }
      if (end) {
        const endDateObj = new Date(end);
        if (end.length <= 10) {
          endDateObj.setHours(23, 59, 59, 999);
        }
        where.receiptDate.lte = endDateObj;
      }
    }

    // Shop filter & RBAC
    if (allowedShopIds && allowedShopIds.length > 0) {
      if (filter.shopId) {
        if (filter.shopId === 'CENTRAL' || filter.shopId === 'NONE') {
          where.shopId = null;
        } else if (allowedShopIds.includes(filter.shopId)) {
          where.shopId = filter.shopId;
        } else {
          where.shopId = '00000000-0000-0000-0000-000000000000';
        }
      } else {
        where.OR = [
          { shopId: { in: allowedShopIds } },
          { shopId: null },
        ];
      }
    } else if (filter.shopId && filter.shopId !== 'ALL') {
      if (filter.shopId === 'CENTRAL' || filter.shopId === 'NONE') {
        where.shopId = null;
      } else {
        where.shopId = filter.shopId;
      }
    }

    // Supplier filter
    if (filter.supplierId && filter.supplierId !== 'ALL') {
      where.supplierId = filter.supplierId;
    }

    // Warehouse filter
    if (filter.warehouseId && filter.warehouseId !== 'ALL') {
      where.warehouseId = filter.warehouseId;
    }

    // Search filter
    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim();
      where.AND = [
        {
          OR: [
            { receiptCode: { contains: q, mode: 'insensitive' } },
            { note: { contains: q, mode: 'insensitive' } },
            { supplier: { name: { contains: q, mode: 'insensitive' } } },
            { supplier: { code: { contains: q, mode: 'insensitive' } } },
            { items: { some: { productName: { contains: q, mode: 'insensitive' } } } },
            { items: { some: { sku: { contains: q, mode: 'insensitive' } } } },
          ],
        },
      ];
    }

    // 1. Aggregates
    const [summaryAgg, itemsAgg, receipts] = await Promise.all([
      this.prisma.purchaseReceipt.aggregate({
        where,
        _count: { id: true },
        _sum: {
          totalItemsAmount: true,
          payableAmount: true,
          paidAmount: true,
          returnDeductionAmount: true,
          remainingAmount: true,
          discountAmount: true,
          shippingFee: true,
        },
      }),
      this.prisma.purchaseReceiptItem.aggregate({
        where: { receipt: where },
        _sum: {
          orderedQuantity: true,
          receivedQuantity: true,
          disputedQuantity: true,
          subtotal: true,
        },
      }),
      this.prisma.purchaseReceipt.findMany({
        where,
        orderBy: [{ receiptDate: 'desc' }, { createdAt: 'desc' }],
        take: 500, // Load up to 500 for rich analytical breakdowns
        include: {
          shop: { select: { id: true, name: true, code: true } },
          supplier: { select: { id: true, name: true, code: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          items: true,
          purchaseReturns: {
            where: { status: 'CONFIRMED' },
            select: { id: true, returnCode: true, debtOffsetAmount: true },
          },
        },
      }),
    ]);

    const totalReceipts = summaryAgg._count.id || 0;
    const totalItemsAmount = Number(summaryAgg._sum.totalItemsAmount || 0);
    const totalReturnDeductionAmount = Number(summaryAgg._sum.returnDeductionAmount || 0);
    const netItemsAmount = Math.max(0, totalItemsAmount - totalReturnDeductionAmount);
    const totalPayableAmount = Math.max(0, Number(summaryAgg._sum.payableAmount || 0) - totalReturnDeductionAmount);
    const totalPaidAmount = Number(summaryAgg._sum.paidAmount || 0);
    const totalRemainingAmount = Number(summaryAgg._sum.remainingAmount || 0);
    const totalReceivedQuantity = Number(itemsAgg._sum.receivedQuantity || 0);
    const totalDisputedQuantity = Number(itemsAgg._sum.disputedQuantity || 0);

    // 2. Daily Trend Breakdown
    const dailyMap = new Map<string, { date: string; count: number; totalAmount: number; returnDeduction: number; netAmount: number; quantity: number }>();
    // 3. Shop Breakdown
    const shopMap = new Map<string, { shopId: string; shopName: string; shopCode: string; count: number; totalAmount: number; returnDeduction: number; netAmount: number; paidAmount: number; remainingAmount: number; quantity: number }>();
    // 4. Supplier Breakdown
    const supplierMap = new Map<string, { supplierId: string; supplierName: string; supplierCode: string; count: number; totalAmount: number; returnDeduction: number; netAmount: number; paidAmount: number; remainingAmount: number; quantity: number }>();
    // 5. SKU / Product Breakdown
    const skuMap = new Map<string, { sku: string; productName: string; variationName: string | null; quantity: number; totalAmount: number; receiptsCount: number }>();

    for (const r of receipts) {
      const dateKey = r.receiptDate.toISOString().slice(0, 10);
      const itemsAmt = Number(r.totalItemsAmount || 0);
      const returnDed = Number(r.returnDeductionAmount || 0);
      const netAmt = Math.max(0, itemsAmt - returnDed);
      const paidAmt = Number(r.paidAmount || 0);
      const remAmt = Number(r.remainingAmount || 0);
      const receiptQty = r.items.reduce((s, it) => s + (it.receivedQuantity || 0), 0);

      // Trend
      const currentDay = dailyMap.get(dateKey) || {
        date: dateKey,
        count: 0,
        totalAmount: 0,
        returnDeduction: 0,
        netAmount: 0,
        quantity: 0,
      };
      currentDay.count += 1;
      currentDay.totalAmount += itemsAmt;
      currentDay.returnDeduction += returnDed;
      currentDay.netAmount += netAmt;
      currentDay.quantity += receiptQty;
      dailyMap.set(dateKey, currentDay);

      // Shop
      const sId = r.shopId || 'CENTRAL';
      const sName = r.shop?.name || 'Kho chung / Chưa gán shop';
      const sCode = r.shop?.code || 'KHO-CHUNG';
      const currentShop = shopMap.get(sId) || {
        shopId: sId,
        shopName: sName,
        shopCode: sCode,
        count: 0,
        totalAmount: 0,
        returnDeduction: 0,
        netAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        quantity: 0,
      };
      currentShop.count += 1;
      currentShop.totalAmount += itemsAmt;
      currentShop.returnDeduction += returnDed;
      currentShop.netAmount += netAmt;
      currentShop.paidAmount += paidAmt;
      currentShop.remainingAmount += remAmt;
      currentShop.quantity += receiptQty;
      shopMap.set(sId, currentShop);

      // Supplier
      const supId = r.supplierId;
      const supName = r.supplier.name;
      const supCode = r.supplier.code;
      const currentSupplier = supplierMap.get(supId) || {
        supplierId: supId,
        supplierName: supName,
        supplierCode: supCode,
        count: 0,
        totalAmount: 0,
        returnDeduction: 0,
        netAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        quantity: 0,
      };
      currentSupplier.count += 1;
      currentSupplier.totalAmount += itemsAmt;
      currentSupplier.returnDeduction += returnDed;
      currentSupplier.netAmount += netAmt;
      currentSupplier.paidAmount += paidAmt;
      currentSupplier.remainingAmount += remAmt;
      currentSupplier.quantity += receiptQty;
      supplierMap.set(supId, currentSupplier);

      // Items
      for (const item of r.items) {
        const itemKey = item.sku || item.productName;
        const currentItem = skuMap.get(itemKey) || {
          sku: item.sku,
          productName: item.productName,
          variationName: item.variationName || null,
          quantity: 0,
          totalAmount: 0,
          receiptsCount: 0,
        };
        currentItem.quantity += item.receivedQuantity || 0;
        currentItem.totalAmount += Number(item.subtotal || 0);
        currentItem.receiptsCount += 1;
        skuMap.set(itemKey, currentItem);
      }
    }

    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const byShop = Array.from(shopMap.values()).sort((a, b) => b.netAmount - a.netAmount);
    const bySupplier = Array.from(supplierMap.values()).sort((a, b) => b.netAmount - a.netAmount);
    const topProducts = Array.from(skuMap.values())
      .map((it) => ({
        ...it,
        avgPrice: it.quantity > 0 ? Math.round(it.totalAmount / it.quantity) : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      summary: {
        totalReceipts,
        totalItemsAmount,
        totalReturnDeductionAmount,
        netItemsAmount,
        totalPayableAmount,
        totalPaidAmount,
        totalRemainingAmount,
        totalReceivedQuantity,
        totalDisputedQuantity,
        uniqueSkusCount: skuMap.size,
      },
      dailyTrend,
      byShop,
      bySupplier,
      topProducts,
      receipts: receipts.slice(0, 100), // First 100 recent receipts for table view
    };
  }
}

