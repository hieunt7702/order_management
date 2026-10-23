import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DashboardFilterDto, PurchaseReportFilterDto } from './dto/report.dto';
import { PlatformOrderStatus, VerificationStatus, Prisma } from '@prisma/client';

export interface ProductImportTransaction {
  receiptId: string;
  receiptCode: string;
  receiptDate: string;
  supplierId?: string;
  supplierName: string;
  supplierCode?: string;
  warehouseId?: string;
  warehouseName: string;
  shopId?: string | null;
  shopName: string;
  paymentStatus: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitPrice: number;
  subtotal: number;
  stockBefore: number;
  stockAfter: number;
  note?: string | null;
  createdAt: string;
}

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

    // 1. Aggregates with safe fallback
    let summaryAgg: any = { _count: { id: 0 }, _sum: {} };
    let itemsAgg: any = { _sum: {} };
    let receipts: any[] = [];

    try {
      const [sAgg, rList] = await Promise.all([
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
        this.prisma.purchaseReceipt.findMany({
          where,
          orderBy: [{ receiptDate: 'desc' }, { createdAt: 'desc' }],
          take: 1000, // Load up to 1000 for comprehensive analytical breakdowns
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
      summaryAgg = sAgg;
      receipts = rList;

      try {
        itemsAgg = await this.prisma.purchaseReceiptItem.aggregate({
          where: { receipt: where },
          _sum: {
            orderedQuantity: true,
            receivedQuantity: true,
            disputedQuantity: true,
            subtotal: true,
          },
        });
      } catch (itemAggErr) {
        // Fallback to computing from receipts if relation aggregate is restricted
      }
    } catch (dbErr) {
      console.error('Error fetching purchase report data:', dbErr);
    }

    const totalReceipts = summaryAgg._count.id || receipts.length || 0;
    const totalItemsAmount = Number(summaryAgg._sum.totalItemsAmount || 0);
    const totalReturnDeductionAmount = Number(summaryAgg._sum.returnDeductionAmount || 0);
    const netItemsAmount = Math.max(0, totalItemsAmount - totalReturnDeductionAmount);
    const totalPayableAmount = Math.max(0, Number(summaryAgg._sum.payableAmount || 0) - totalReturnDeductionAmount);
    const totalPaidAmount = Number(summaryAgg._sum.paidAmount || 0);
    const totalRemainingAmount = Number(summaryAgg._sum.remainingAmount || 0);
    let totalReceivedQuantity = Number(itemsAgg._sum.receivedQuantity || 0);
    let totalDisputedQuantity = Number(itemsAgg._sum.disputedQuantity || 0);

    // Query variant inventory balances and ledgers to compute exact stockBefore and stockAfter
    const receiptVariantStockMap = new Map<string, { stockBefore: number; stockAfter: number }>();

    try {
      const variantIds = Array.from(
        new Set(
          receipts
            .flatMap((r) => (r.items || []).map((it: any) => it.variantId))
            .filter(Boolean),
        ),
      );

      if (variantIds.length > 0) {
        const [balances, ledgers] = await Promise.all([
          this.prisma.inventoryBalance.findMany({
            where: {
              tenantId,
              variantId: { in: variantIds },
            },
            select: {
              warehouseId: true,
              variantId: true,
              onHand: true,
            },
          }),
          this.prisma.inventoryLedger.findMany({
            where: {
              tenantId,
              variantId: { in: variantIds },
            },
            orderBy: {
              createdAt: 'asc',
            },
            select: {
              id: true,
              warehouseId: true,
              variantId: true,
              movementType: true,
              deltaOnHand: true,
              beforeOnHand: true,
              afterOnHand: true,
              referenceType: true,
              referenceId: true,
              createdAt: true,
            },
          }),
        ]);

        // Group ledgers by `${variantId}_${warehouseId}`
        const ledgerGroup = new Map<string, typeof ledgers>();
        for (const l of ledgers) {
          const key = `${l.variantId}_${l.warehouseId}`;
          const list = ledgerGroup.get(key) || [];
          list.push(l);
          ledgerGroup.set(key, list);
        }

        // Create balance lookup: `${variantId}_${warehouseId}` -> onHand
        const balanceMap = new Map<string, number>();
        for (const b of balances) {
          balanceMap.set(`${b.variantId}_${b.warehouseId}`, Number(b.onHand || 0));
        }

        // Process each variant-warehouse history
        for (const [key, vLedgers] of ledgerGroup.entries()) {
          const currentOnHand = balanceMap.get(key) ?? 0;
          const sumDelta = vLedgers.reduce((acc, l) => acc + (l.deltaOnHand || 0), 0);
          const initialOnHand = Math.max(0, currentOnHand - sumDelta);

          let runningStock = initialOnHand;
          for (const l of vLedgers) {
            let before = runningStock;
            if (l.beforeOnHand !== null && l.beforeOnHand !== undefined) {
              before = l.beforeOnHand;
            }
            let after = before + (l.deltaOnHand || 0);
            if (l.afterOnHand !== null && l.afterOnHand !== undefined) {
              after = l.afterOnHand;
            }
            runningStock = after;

            if (l.referenceType === 'PURCHASE_RECEIPT' && l.referenceId) {
              receiptVariantStockMap.set(`${l.referenceId}_${l.variantId}`, {
                stockBefore: before,
                stockAfter: after,
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('Lỗi tính tồn kho trước/sau phiếu nhập từ ledger:', err);
    }

    // Chronological cumulative fallback for any receipt items not matched in ledger
    const chronologicalReceipts = [...receipts].sort((a, b) => {
      const timeA = new Date(a.receiptDate || a.createdAt).getTime();
      const timeB = new Date(b.receiptDate || b.createdAt).getTime();
      return timeA - timeB;
    });

    const fallbackStockMap = new Map<string, number>();
    for (const r of chronologicalReceipts) {
      for (const item of r.items || []) {
        const vKey = item.variantId || item.sku || item.productName;
        const key = `${r.id}_${item.variantId}`;
        const itQty = Number(item.receivedQuantity) || 0;
        const prevFallback = fallbackStockMap.get(vKey) || 0;
        const nextFallback = prevFallback + itQty;
        fallbackStockMap.set(vKey, nextFallback);

        if (!receiptVariantStockMap.has(key)) {
          receiptVariantStockMap.set(key, {
            stockBefore: prevFallback,
            stockAfter: nextFallback,
          });
        }
      }
    }

    // 2. Daily Trend Breakdown
    const dailyMap = new Map<string, {
      date: string;
      count: number;
      totalAmount: number;
      returnDeduction: number;
      netAmount: number;
      paidAmount: number;
      remainingAmount: number;
      quantity: number;
    }>();

    // 3. Shop Breakdown
    const shopMap = new Map<string, {
      shopId: string;
      shopName: string;
      shopCode: string;
      count: number;
      totalAmount: number;
      returnDeduction: number;
      netAmount: number;
      paidAmount: number;
      remainingAmount: number;
      quantity: number;
    }>();

    // 4. Supplier Breakdown with nested SKU Breakdown
    const supplierMap = new Map<string, {
      supplierId: string;
      supplierName: string;
      supplierCode: string;
      count: number;
      totalAmount: number;
      returnDeduction: number;
      netAmount: number;
      paidAmount: number;
      remainingAmount: number;
      quantity: number;
      skuMap: Map<string, {
        sku: string;
        productName: string;
        variationName: string | null;
        quantity: number;
        totalAmount: number;
        receiptsCount: number;
        transactions: ProductImportTransaction[];
      }>;
    }>();

    // 5. Overall SKU / Product Breakdown
    const skuMap = new Map<string, {
      sku: string;
      productName: string;
      variationName: string | null;
      quantity: number;
      totalAmount: number;
      receiptsCount: number;
      suppliers: Set<string>;
      transactions: ProductImportTransaction[];
    }>();

    let computedReceivedQty = 0;
    let computedDisputedQty = 0;

    for (const r of receipts) {
      let dateKey = 'N/A';
      if (r.receiptDate) {
        try {
          dateKey = r.receiptDate instanceof Date
            ? r.receiptDate.toISOString().slice(0, 10)
            : String(r.receiptDate).slice(0, 10);
        } catch {
          dateKey = 'N/A';
        }
      }

      const itemsAmt = Number(r.totalItemsAmount || 0);
      const returnDed = Number(r.returnDeductionAmount || 0);
      const netAmt = Math.max(0, itemsAmt - returnDed);
      const paidAmt = Number(r.paidAmount || 0);
      const remAmt = Number(r.remainingAmount || 0);
      const rItems = Array.isArray(r.items) ? r.items : [];
      const receiptQty = rItems.reduce((s: number, it: any) => s + (Number(it.receivedQuantity) || 0), 0);
      const disputedQty = rItems.reduce((s: number, it: any) => s + (Number(it.disputedQuantity) || 0), 0);

      computedReceivedQty += receiptQty;
      computedDisputedQty += disputedQty;

      // Daily Trend / Daily Breakdown
      const currentDay = dailyMap.get(dateKey) || {
        date: dateKey,
        count: 0,
        totalAmount: 0,
        returnDeduction: 0,
        netAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        quantity: 0,
      };
      currentDay.count += 1;
      currentDay.totalAmount += itemsAmt;
      currentDay.returnDeduction += returnDed;
      currentDay.netAmount += netAmt;
      currentDay.paidAmount += paidAmt;
      currentDay.remainingAmount += remAmt;
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
      const supId = r.supplierId || 'UNKNOWN';
      const supName = r.supplier?.name || 'Nhà cung cấp không xác định';
      const supCode = r.supplier?.code || 'NCC-UNKNOWN';
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
        skuMap: new Map<string, {
          sku: string;
          productName: string;
          variationName: string | null;
          quantity: number;
          totalAmount: number;
          receiptsCount: number;
          transactions: ProductImportTransaction[];
        }>(),
      };
      currentSupplier.count += 1;
      currentSupplier.totalAmount += itemsAmt;
      currentSupplier.returnDeduction += returnDed;
      currentSupplier.netAmount += netAmt;
      currentSupplier.paidAmount += paidAmt;
      currentSupplier.remainingAmount += remAmt;
      currentSupplier.quantity += receiptQty;

      // Process Items for Supplier & Global SKU maps
      for (const item of rItems) {
        const itemKey = item.sku || item.productName || item.id;
        const itQty = Number(item.receivedQuantity) || 0;
        const itSubtotal = Number(item.subtotal || 0);

        // Global SKU
        const currentItem = skuMap.get(itemKey) || {
          sku: item.sku || 'N/A',
          productName: item.productName || 'Chưa đặt tên',
          variationName: item.variationName || null,
          quantity: 0,
          totalAmount: 0,
          receiptsCount: 0,
          suppliers: new Set<string>(),
          transactions: [] as ProductImportTransaction[],
        };
        currentItem.quantity += itQty;
        currentItem.totalAmount += itSubtotal;
        currentItem.receiptsCount += 1;
        currentItem.suppliers.add(supName);

        // Supplier-specific SKU
        const currentSupItem = currentSupplier.skuMap.get(itemKey) || {
          sku: item.sku || 'N/A',
          productName: item.productName || 'Chưa đặt tên',
          variationName: item.variationName || null,
          quantity: 0,
          totalAmount: 0,
          receiptsCount: 0,
          transactions: [] as ProductImportTransaction[],
        };
        currentSupItem.quantity += itQty;
        currentSupItem.totalAmount += itSubtotal;
        currentSupItem.receiptsCount += 1;

        // Transaction detail with stockBefore and stockAfter
        const txStock = receiptVariantStockMap.get(`${r.id}_${item.variantId}`) || {
          stockBefore: 0,
          stockAfter: itQty,
        };

        const txObj: ProductImportTransaction = {
          receiptId: r.id,
          receiptCode: r.receiptCode,
          receiptDate: r.receiptDate
            ? (r.receiptDate instanceof Date ? r.receiptDate.toISOString() : String(r.receiptDate))
            : (r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || '')),
          supplierId: r.supplierId || undefined,
          supplierName: supName,
          supplierCode: supCode,
          warehouseId: r.warehouseId || undefined,
          warehouseName: r.warehouse?.name || 'Kho chính',
          shopId: r.shopId || null,
          shopName: sName,
          paymentStatus: r.paymentStatus || 'UNPAID',
          orderedQuantity: Number(item.orderedQuantity || 0),
          receivedQuantity: itQty,
          unitPrice: Number(item.unitPrice || 0),
          subtotal: itSubtotal,
          stockBefore: txStock.stockBefore,
          stockAfter: txStock.stockAfter,
          note: item.note || r.note || null,
          createdAt: r.createdAt
            ? (r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt))
            : '',
        };

        currentItem.transactions.push(txObj);
        currentSupItem.transactions.push(txObj);

        skuMap.set(itemKey, currentItem);
        currentSupplier.skuMap.set(itemKey, currentSupItem);
      }

      supplierMap.set(supId, currentSupplier);
    }

    if (totalReceivedQuantity === 0 && computedReceivedQty > 0) {
      totalReceivedQuantity = computedReceivedQty;
    }
    if (totalDisputedQuantity === 0 && computedDisputedQty > 0) {
      totalDisputedQuantity = computedDisputedQty;
    }

    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const byDate = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    const byShop = Array.from(shopMap.values()).sort((a, b) => b.netAmount - a.netAmount);

    const bySupplier = Array.from(supplierMap.values()).map((s) => {
      const skus = Array.from(s.skuMap.values())
        .map((it) => ({
          ...it,
          avgPrice: it.quantity > 0 ? Math.round(it.totalAmount / it.quantity) : 0,
          transactions: it.transactions.sort((a, b) => {
            const timeA = new Date(a.receiptDate || a.createdAt).getTime();
            const timeB = new Date(b.receiptDate || b.createdAt).getTime();
            return timeB - timeA;
          }),
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);

      return {
        supplierId: s.supplierId,
        supplierName: s.supplierName,
        supplierCode: s.supplierCode,
        count: s.count,
        totalAmount: s.totalAmount,
        returnDeduction: s.returnDeduction,
        netAmount: s.netAmount,
        paidAmount: s.paidAmount,
        remainingAmount: s.remainingAmount,
        quantity: s.quantity,
        skusCount: skus.length,
        skus,
      };
    }).sort((a, b) => b.netAmount - a.netAmount);

    const topProducts = Array.from(skuMap.values())
      .map((it) => ({
        sku: it.sku,
        productName: it.productName,
        variationName: it.variationName,
        quantity: it.quantity,
        totalAmount: it.totalAmount,
        receiptsCount: it.receiptsCount,
        suppliers: Array.from(it.suppliers),
        avgPrice: it.quantity > 0 ? Math.round(it.totalAmount / it.quantity) : 0,
        transactions: it.transactions.sort((a, b) => {
          const timeA = new Date(a.receiptDate || a.createdAt).getTime();
          const timeB = new Date(b.receiptDate || b.createdAt).getTime();
          return timeB - timeA;
        }),
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
      byDate,
      byShop,
      bySupplier,
      topProducts,
      receipts: receipts.slice(0, 100), // First 100 recent receipts for table view
    };
  }
}

