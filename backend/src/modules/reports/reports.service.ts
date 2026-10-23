import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DashboardFilterDto, PurchaseReportFilterDto, OrderReconciliationReportFilterDto } from './dto/report.dto';
import { PlatformOrderStatus, VerificationStatus, ProductStatus, Prisma } from '@prisma/client';

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

  async getOrderReconciliationReport(
    tenantId: string,
    allowedShopIds: string[] | null,
    filter: OrderReconciliationReportFilterDto,
  ) {
    const start = filter.startDate || filter.fromDate;
    const end = filter.endDate || filter.toDate;
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(1000, Number(filter.limit) || 20));

    // 1. Where clause for PurchaseReceiptItems (Số lượng đã nhập kho)
    const receiptWhere: Prisma.PurchaseReceiptWhereInput = {
      tenantId,
      ...(filter.warehouseId && filter.warehouseId !== 'ALL' ? { warehouseId: filter.warehouseId } : {}),
    };
    if (filter.shopId && filter.shopId !== 'ALL') {
      if (filter.shopId === 'CENTRAL' || filter.shopId === 'NONE') {
        receiptWhere.shopId = null;
      } else {
        receiptWhere.shopId = filter.shopId;
      }
    }
    if (start || end) {
      receiptWhere.receiptDate = {};
      if (start) {
        const startDateObj = new Date(start);
        startDateObj.setHours(0, 0, 0, 0);
        receiptWhere.receiptDate.gte = startDateObj;
      }
      if (end) {
        const endDateObj = new Date(end);
        if (end.length <= 10) endDateObj.setHours(23, 59, 59, 999);
        receiptWhere.receiptDate.lte = endDateObj;
      }
    }

    const receiptAggregations = await this.prisma.purchaseReceiptItem.groupBy({
      by: ['variantId'],
      where: {
        tenantId,
        receipt: receiptWhere,
      },
      _sum: {
        receivedQuantity: true,
        orderedQuantity: true,
        subtotal: true,
      },
      _count: {
        receiptId: true,
      },
    });

    const receiptMap = new Map<string, { receivedQty: number; orderedQty: number; totalAmount: number; receiptsCount: number }>();
    receiptAggregations.forEach((ra) => {
      receiptMap.set(ra.variantId, {
        receivedQty: ra._sum.receivedQuantity || 0,
        orderedQty: ra._sum.orderedQuantity || 0,
        totalAmount: Number(ra._sum.subtotal || 0),
        receiptsCount: ra._count.receiptId || 0,
      });
    });

    // 1b. Where clause for PurchaseReturns (Số lượng xuất trả hàng cho nhà cung cấp)
    const returnWhere: Prisma.PurchaseReturnWhereInput = {
      tenantId,
      status: 'CONFIRMED',
    };
    if (filter.shopId && filter.shopId !== 'ALL') {
      if (filter.shopId === 'CENTRAL' || filter.shopId === 'NONE') {
        returnWhere.OR = [
          { receipt: { shopId: null } },
          { receiptId: null },
        ];
      } else {
        returnWhere.OR = [
          { receipt: { shopId: filter.shopId } },
          { receiptId: null },
        ];
      }
    }
    if (filter.warehouseId && filter.warehouseId !== 'ALL') {
      returnWhere.OR = [
        { receipt: { warehouseId: filter.warehouseId } },
        { receiptId: null },
      ];
    }
    if (start || end) {
      returnWhere.returnDate = {};
      if (start) {
        const startDateObj = new Date(start);
        startDateObj.setHours(0, 0, 0, 0);
        returnWhere.returnDate.gte = startDateObj;
      }
      if (end) {
        const endDateObj = new Date(end);
        if (end.length <= 10) endDateObj.setHours(23, 59, 59, 999);
        returnWhere.returnDate.lte = endDateObj;
      }
    }

    const purchaseReturnAggregations = await this.prisma.purchaseReturnItem.groupBy({
      by: ['variantId'],
      where: {
        tenantId,
        return: returnWhere,
      },
      _sum: {
        quantity: true,
        subtotal: true,
      },
      _count: {
        returnId: true,
      },
    });

    const purchaseReturnMap = new Map<string, { returnedQty: number; totalAmount: number; returnsCount: number }>();
    purchaseReturnAggregations.forEach((pra) => {
      purchaseReturnMap.set(pra.variantId, {
        returnedQty: pra._sum.quantity || 0,
        totalAmount: Number(pra._sum.subtotal || 0),
        returnsCount: pra._count.returnId || 0,
      });
    });

    // 2. Where clause for OrderItems (Số lượng đơn hàng đi / đã bán)
    const orderWhere: Prisma.OrderWhereInput = {
      tenantId,
      platformStatus: {
        notIn: [PlatformOrderStatus.CANCELLED, PlatformOrderStatus.IN_CANCEL],
      },
      NOT: {
        AND: [{ isVirtual: true }, { isRealGoods: false }],
      },
    };
    if (filter.shopId && filter.shopId !== 'ALL') {
      orderWhere.shopId = filter.shopId;
    } else if (allowedShopIds && allowedShopIds.length > 0) {
      orderWhere.shopId = { in: allowedShopIds };
    }
    if (start || end) {
      orderWhere.orderDate = {};
      if (start) {
        const startDateObj = new Date(start);
        startDateObj.setHours(0, 0, 0, 0);
        orderWhere.orderDate.gte = startDateObj;
      }
      if (end) {
        const endDateObj = new Date(end);
        if (end.length <= 10) endDateObj.setHours(23, 59, 59, 999);
        orderWhere.orderDate.lte = endDateObj;
      }
    }

    const orderItemAggregations = await this.prisma.orderItem.groupBy({
      by: ['variantId'],
      where: {
        tenantId,
        variantId: { not: null },
        order: orderWhere,
      },
      _sum: {
        quantity: true,
      },
      _count: {
        orderId: true,
      },
    });

    const orderMap = new Map<string, { quantity: number; ordersCount: number }>();
    orderItemAggregations.forEach((oa) => {
      if (oa.variantId) {
        orderMap.set(oa.variantId, {
          quantity: oa._sum.quantity || 0,
          ordersCount: oa._count.orderId || 0,
        });
      }
    });

    // 2b. Where clause for Customer Order Returns (Hàng khách hoàn nhập lại kho bán được)
    const orderReturnWhere: Prisma.OrderReturnWhereInput = {
      tenantId,
      status: 'COMPLETED',
    };
    if (filter.shopId && filter.shopId !== 'ALL') {
      orderReturnWhere.shopId = filter.shopId;
    } else if (allowedShopIds && allowedShopIds.length > 0) {
      orderReturnWhere.shopId = { in: allowedShopIds };
    }
    if (filter.warehouseId && filter.warehouseId !== 'ALL') {
      orderReturnWhere.warehouseId = filter.warehouseId;
    }
    if (start || end) {
      orderReturnWhere.receivedDate = {};
      if (start) {
        const startDateObj = new Date(start);
        startDateObj.setHours(0, 0, 0, 0);
        orderReturnWhere.receivedDate.gte = startDateObj;
      }
      if (end) {
        const endDateObj = new Date(end);
        if (end.length <= 10) endDateObj.setHours(23, 59, 59, 999);
        orderReturnWhere.receivedDate.lte = endDateObj;
      }
    }

    const orderReturnAggregations = await this.prisma.orderReturnItem.groupBy({
      by: ['variantId'],
      where: {
        tenantId,
        return: orderReturnWhere,
      },
      _sum: {
        sellableQuantity: true,
        damagedQuantity: true,
        receivedQuantity: true,
      },
      _count: {
        returnId: true,
      },
    });

    const orderReturnMap = new Map<string, { sellableQty: number; damagedQty: number; returnsCount: number }>();
    orderReturnAggregations.forEach((ora) => {
      orderReturnMap.set(ora.variantId, {
        sellableQty: ora._sum.sellableQuantity || 0,
        damagedQty: ora._sum.damagedQuantity || 0,
        returnsCount: ora._count.returnId || 0,
      });
    });

    // Handle any unmapped order items with null variantId via listing mappings
    const unmappedOrderItems = await this.prisma.orderItem.findMany({
      where: {
        tenantId,
        variantId: null,
        order: orderWhere,
        externalSku: { not: null },
      },
      select: {
        externalSku: true,
        quantity: true,
        order: { select: { shopId: true } },
      },
    });

    if (unmappedOrderItems.length > 0) {
      const listingMappings = await this.prisma.listingMapping.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
        },
        select: {
          shopId: true,
          sellerSku: true,
          variantId: true,
        },
      });

      const lmMap = new Map<string, string>();
      listingMappings.forEach((lm) => {
        lmMap.set(`${lm.shopId}:${lm.sellerSku.toLowerCase()}`, lm.variantId);
        lmMap.set(lm.sellerSku.toLowerCase(), lm.variantId);
      });

      for (const uoi of unmappedOrderItems) {
        if (!uoi.externalSku) continue;
        const key = `${uoi.order.shopId}:${uoi.externalSku.toLowerCase()}`;
        const matchedVariantId = lmMap.get(key) || lmMap.get(uoi.externalSku.toLowerCase());
        if (matchedVariantId) {
          const cur = orderMap.get(matchedVariantId) || { quantity: 0, ordersCount: 0 };
          cur.quantity += uoi.quantity || 1;
          cur.ordersCount += 1;
          orderMap.set(matchedVariantId, cur);
        }
      }
    }

    // 3. Query all System Product Variants for the tenant
    const search = filter.search?.trim();
    const variantWhere: Prisma.ProductVariantWhereInput = {
      tenantId,
      status: ProductStatus.ACTIVE,
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search, mode: 'insensitive' } },
              { product: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const variants = await this.prisma.productVariant.findMany({
      where: variantWhere,
      include: {
        product: {
          select: { id: true, code: true, name: true },
        },
        inventoryBalances: {
          where: {
            tenantId,
            ...(filter.warehouseId && filter.warehouseId !== 'ALL' ? { warehouseId: filter.warehouseId } : {}),
          },
          select: {
            warehouseId: true,
            onHand: true,
            reserved: true,
            damaged: true,
          },
        },
      },
      orderBy: [
        { product: { name: 'asc' } },
        { sku: 'asc' },
      ],
    });

    // 4. Combine and calculate metrics per variant
    let totalGrossImported = 0;
    let totalSupplierReturned = 0;
    let totalImportedQuantity = 0;
    let totalGrossExported = 0;
    let totalCustomerReturned = 0;
    let totalExportedQuantity = 0;
    let totalOnHand = 0;
    let totalReserved = 0;
    let totalAvailable = 0;
    let balancedCount = 0;
    let discrepancyCount = 0;
    let surplusCount = 0;
    let deficitCount = 0;
    let outOfStockCount = 0;

    const allItems = variants.map((v) => {
      const rData = receiptMap.get(v.id) || { receivedQty: 0, orderedQty: 0, totalAmount: 0, receiptsCount: 0 };
      const prData = purchaseReturnMap.get(v.id) || { returnedQty: 0, totalAmount: 0, returnsCount: 0 };
      const oData = orderMap.get(v.id) || { quantity: 0, ordersCount: 0 };
      const orData = orderReturnMap.get(v.id) || { sellableQty: 0, damagedQty: 0, returnsCount: 0 };

      const onHand = v.inventoryBalances.reduce((acc, b) => acc + (b.onHand || 0), 0);
      const reserved = v.inventoryBalances.reduce((acc, b) => acc + (b.reserved || 0), 0);
      const available = Math.max(0, onHand - reserved);
      const damaged = v.inventoryBalances.reduce((acc, b) => acc + (b.damaged || 0), 0);

      // Inbound: Gross receipt import minus returned to supplier = Net imported quantity
      const grossImportedQty = rData.receivedQty;
      const supplierReturnedQty = prData.returnedQty;
      const importedQty = Math.max(0, grossImportedQty - supplierReturnedQty);

      // Outbound: Gross orders minus sellable customer returns = Net exported quantity
      const grossExportedQty = oData.quantity;
      const customerReturnedQty = orData.sellableQty;
      const exportedQty = Math.max(0, grossExportedQty - customerReturnedQty);

      // Theoretical stock = Net Inbound - Net Outbound
      const calculatedStock = importedQty - exportedQty;
      const discrepancy = onHand - calculatedStock;

      totalGrossImported += grossImportedQty;
      totalSupplierReturned += supplierReturnedQty;
      totalImportedQuantity += importedQty;
      totalGrossExported += grossExportedQty;
      totalCustomerReturned += customerReturnedQty;
      totalExportedQuantity += exportedQty;
      totalOnHand += onHand;
      totalReserved += reserved;
      totalAvailable += available;

      let reconciliationStatus: 'BALANCED' | 'SURPLUS' | 'DEFICIT' = 'BALANCED';
      if (discrepancy === 0) {
        reconciliationStatus = 'BALANCED';
        balancedCount++;
      } else if (discrepancy > 0) {
        reconciliationStatus = 'SURPLUS';
        discrepancyCount++;
        surplusCount++;
      } else {
        reconciliationStatus = 'DEFICIT';
        discrepancyCount++;
        deficitCount++;
      }

      if (onHand <= 0) {
        outOfStockCount++;
      }

      return {
        variantId: v.id,
        productId: v.product?.id,
        productName: v.product?.name || 'Chưa đặt tên',
        productCode: v.product?.code,
        sku: v.sku,
        variantName: v.name,
        barcode: v.barcode,
        unit: v.unit,
        costPrice: Number(v.costPrice || 0),
        sellingPrice: Number(v.sellingPrice || 0),
        grossImportedQuantity: grossImportedQty,
        supplierReturnedQuantity: supplierReturnedQty,
        importedQuantity: importedQty,
        importedAmount: Math.max(0, rData.totalAmount - prData.totalAmount),
        receiptsCount: rData.receiptsCount,
        purchaseReturnsCount: prData.returnsCount,
        grossExportedQuantity: grossExportedQty,
        customerReturnedQuantity: customerReturnedQty,
        exportedQuantity: exportedQty,
        ordersCount: oData.ordersCount,
        orderReturnsCount: orData.returnsCount,
        onHand,
        reserved,
        available,
        damaged,
        calculatedStock,
        discrepancy,
        reconciliationStatus,
        fulfillmentRatePercent:
          importedQty > 0 ? Math.min(100, Math.round((exportedQty / importedQty) * 100)) : (exportedQty > 0 ? 100 : 0),
      };
    });

    // 5. Filter by reconciliationStatus if provided
    let filteredItems = allItems;
    if (filter.reconciliationStatus && filter.reconciliationStatus !== 'ALL') {
      if (filter.reconciliationStatus === 'OUT_OF_STOCK') {
        filteredItems = allItems.filter((it) => it.onHand <= 0);
      } else {
        filteredItems = allItems.filter((it) => it.reconciliationStatus === filter.reconciliationStatus);
      }
    }

    // 6. Pagination
    const totalItems = filteredItems.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const paginatedItems = filteredItems.slice((page - 1) * limit, page * limit);

    return {
      summary: {
        totalVariants: variants.length,
        totalGrossImported,
        totalSupplierReturned,
        totalImportedQuantity,
        totalGrossExported,
        totalCustomerReturned,
        totalExportedQuantity,
        totalOnHand,
        totalReserved,
        totalAvailable,
        balancedCount,
        discrepancyCount,
        surplusCount,
        deficitCount,
        outOfStockCount,
      },
      items: paginatedItems,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    };
  }

  async getOrderReconciliationTransactions(
    tenantId: string,
    allowedShopIds: string[] | null,
    variantId: string,
    filter: OrderReconciliationReportFilterDto,
  ) {
    const start = filter.startDate || filter.fromDate;
    const end = filter.endDate || filter.toDate;

    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, tenantId },
      include: {
        product: { select: { id: true, code: true, name: true } },
        inventoryBalances: {
          where: { tenantId },
          include: { warehouse: { select: { id: true, name: true, code: true } } },
        },
      },
    });

    if (!variant) {
      return null;
    }

    // Outgoing orders
    const orderWhere: Prisma.OrderWhereInput = {
      tenantId,
      platformStatus: {
        notIn: [PlatformOrderStatus.CANCELLED, PlatformOrderStatus.IN_CANCEL],
      },
      NOT: {
        AND: [{ isVirtual: true }, { isRealGoods: false }],
      },
    };
    if (filter.shopId && filter.shopId !== 'ALL') {
      orderWhere.shopId = filter.shopId;
    } else if (allowedShopIds && allowedShopIds.length > 0) {
      orderWhere.shopId = { in: allowedShopIds };
    }
    if (start || end) {
      orderWhere.orderDate = {};
      if (start) {
        const s = new Date(start);
        s.setHours(0, 0, 0, 0);
        orderWhere.orderDate.gte = s;
      }
      if (end) {
        const e = new Date(end);
        if (end.length <= 10) e.setHours(23, 59, 59, 999);
        orderWhere.orderDate.lte = e;
      }
    }

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        tenantId,
        variantId,
        order: orderWhere,
      },
      include: {
        order: {
          select: {
            id: true,
            internalOrderCode: true,
            externalOrderId: true,
            trackingCode: true,
            orderDate: true,
            platformStatus: true,
            fulfillmentStatus: true,
            verificationStatus: true,
            recipientName: true,
            shop: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: {
        order: { orderDate: 'desc' },
      },
      take: 100,
    });

    // Inbound receipts
    const receiptWhere: Prisma.PurchaseReceiptWhereInput = {
      tenantId,
      ...(filter.warehouseId && filter.warehouseId !== 'ALL' ? { warehouseId: filter.warehouseId } : {}),
    };
    if (filter.shopId && filter.shopId !== 'ALL') {
      if (filter.shopId === 'CENTRAL' || filter.shopId === 'NONE') {
        receiptWhere.shopId = null;
      } else {
        receiptWhere.shopId = filter.shopId;
      }
    }
    if (start || end) {
      receiptWhere.receiptDate = {};
      if (start) {
        const s = new Date(start);
        s.setHours(0, 0, 0, 0);
        receiptWhere.receiptDate.gte = s;
      }
      if (end) {
        const e = new Date(end);
        if (end.length <= 10) e.setHours(23, 59, 59, 999);
        receiptWhere.receiptDate.lte = e;
      }
    }

    const receiptItems = await this.prisma.purchaseReceiptItem.findMany({
      where: {
        tenantId,
        variantId,
        receipt: receiptWhere,
      },
      include: {
        receipt: {
          select: {
            id: true,
            receiptCode: true,
            receiptDate: true,
            paymentStatus: true,
            supplier: { select: { id: true, name: true, code: true } },
            warehouse: { select: { id: true, name: true, code: true } },
            shop: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: {
        receipt: { receiptDate: 'desc' },
      },
      take: 100,
    });

    // Inbound purchase returns to supplier
    const returnWhere: Prisma.PurchaseReturnWhereInput = {
      tenantId,
      status: 'CONFIRMED',
    };
    if (filter.shopId && filter.shopId !== 'ALL') {
      if (filter.shopId === 'CENTRAL' || filter.shopId === 'NONE') {
        returnWhere.OR = [
          { receipt: { shopId: null } },
          { receiptId: null },
        ];
      } else {
        returnWhere.OR = [
          { receipt: { shopId: filter.shopId } },
          { receiptId: null },
        ];
      }
    }
    if (filter.warehouseId && filter.warehouseId !== 'ALL') {
      returnWhere.OR = [
        { receipt: { warehouseId: filter.warehouseId } },
        { receiptId: null },
      ];
    }
    if (start || end) {
      returnWhere.returnDate = {};
      if (start) {
        const s = new Date(start);
        s.setHours(0, 0, 0, 0);
        returnWhere.returnDate.gte = s;
      }
      if (end) {
        const e = new Date(end);
        if (end.length <= 10) e.setHours(23, 59, 59, 999);
        returnWhere.returnDate.lte = e;
      }
    }

    const purchaseReturnItems = await this.prisma.purchaseReturnItem.findMany({
      where: {
        tenantId,
        variantId,
        return: returnWhere,
      },
      include: {
        return: {
          select: {
            id: true,
            returnCode: true,
            returnDate: true,
            debtOffsetAmount: true,
            totalReturnAmount: true,
            reason: true,
            note: true,
            supplier: { select: { id: true, name: true, code: true } },
            receipt: { select: { id: true, receiptCode: true, warehouseId: true } },
          },
        },
      },
      orderBy: {
        return: { returnDate: 'desc' },
      },
      take: 100,
    });

    // Customer order returns
    const orderReturnWhere: Prisma.OrderReturnWhereInput = {
      tenantId,
      status: 'COMPLETED',
    };
    if (filter.shopId && filter.shopId !== 'ALL') {
      orderReturnWhere.shopId = filter.shopId;
    } else if (allowedShopIds && allowedShopIds.length > 0) {
      orderReturnWhere.shopId = { in: allowedShopIds };
    }
    if (filter.warehouseId && filter.warehouseId !== 'ALL') {
      orderReturnWhere.warehouseId = filter.warehouseId;
    }
    if (start || end) {
      orderReturnWhere.receivedDate = {};
      if (start) {
        const s = new Date(start);
        s.setHours(0, 0, 0, 0);
        orderReturnWhere.receivedDate.gte = s;
      }
      if (end) {
        const e = new Date(end);
        if (end.length <= 10) e.setHours(23, 59, 59, 999);
        orderReturnWhere.receivedDate.lte = e;
      }
    }

    const orderReturnItems = await this.prisma.orderReturnItem.findMany({
      where: {
        tenantId,
        variantId,
        return: orderReturnWhere,
      },
      include: {
        return: {
          select: {
            id: true,
            returnCode: true,
            trackingCode: true,
            receivedDate: true,
            reason: true,
            note: true,
            shop: { select: { id: true, name: true, code: true } },
            order: { select: { id: true, internalOrderCode: true, externalOrderId: true, trackingCode: true } },
          },
        },
      },
      orderBy: {
        return: { receivedDate: 'desc' },
      },
      take: 100,
    });

    return {
      variant: {
        id: variant.id,
        sku: variant.sku,
        barcode: variant.barcode,
        name: variant.name,
        unit: variant.unit,
        costPrice: Number(variant.costPrice || 0),
        sellingPrice: Number(variant.sellingPrice || 0),
        product: variant.product,
      },
      inventoryBalances: variant.inventoryBalances.map((b) => ({
        warehouseId: b.warehouseId,
        warehouseName: b.warehouse.name,
        warehouseCode: b.warehouse.code,
        onHand: b.onHand,
        reserved: b.reserved,
        available: Math.max(0, b.onHand - b.reserved),
        damaged: b.damaged,
      })),
      orders: orderItems.map((oi) => ({
        id: oi.order.id,
        internalOrderCode: oi.order.internalOrderCode,
        externalOrderId: oi.order.externalOrderId,
        trackingCode: oi.order.trackingCode,
        orderDate: oi.order.orderDate,
        platformStatus: oi.order.platformStatus,
        fulfillmentStatus: oi.order.fulfillmentStatus,
        verificationStatus: oi.order.verificationStatus,
        recipientName: oi.order.recipientName,
        shopName: oi.order.shop?.name || 'N/A',
        quantity: oi.quantity,
        originalPrice: Number(oi.originalPrice || 0),
        discountedPrice: Number(oi.discountedPrice || 0),
      })),
      receipts: receiptItems.map((ri) => ({
        id: ri.receipt.id,
        receiptCode: ri.receipt.receiptCode,
        receiptDate: ri.receipt.receiptDate,
        supplierName: ri.receipt.supplier?.name || 'N/A',
        warehouseName: ri.receipt.warehouse?.name || 'Kho chung',
        shopName: ri.receipt.shop?.name || 'Kho chung',
        orderedQuantity: ri.orderedQuantity,
        receivedQuantity: ri.receivedQuantity,
        unitPrice: Number(ri.unitPrice || 0),
        subtotal: Number(ri.subtotal || 0),
        paymentStatus: ri.receipt.paymentStatus,
      })),
      purchaseReturns: purchaseReturnItems.map((pri) => ({
        id: pri.return.id,
        returnCode: pri.return.returnCode,
        returnDate: pri.return.returnDate,
        supplierName: pri.return.supplier?.name || 'N/A',
        quantity: pri.quantity,
        unitPrice: Number(pri.unitPrice || 0),
        subtotal: Number(pri.subtotal || 0),
        debtOffsetAmount: Number(pri.return.debtOffsetAmount || 0),
        reason: pri.return.reason || pri.return.note || '',
        receiptCode: pri.return.receipt?.receiptCode || null,
      })),
      orderReturns: orderReturnItems.map((ori) => ({
        id: ori.return.id,
        returnCode: ori.return.returnCode,
        receivedDate: ori.return.receivedDate,
        orderCode: ori.return.order?.internalOrderCode || '',
        trackingCode: ori.return.trackingCode || ori.return.order?.trackingCode || '',
        shopName: ori.return.shop?.name || 'N/A',
        sellableQuantity: ori.sellableQuantity,
        damagedQuantity: ori.damagedQuantity,
        reason: ori.return.reason || ori.return.note || '',
      })),
    };
  }
}

