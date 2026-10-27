import { api, buildQuery } from './apiClient';

export interface ReportQueryParams {
  shopId?: string;
  startDate?: string;
  endDate?: string;
  platformStatuses?: string;
  [key: string]: any;
}

export interface DashboardSystemProduct {
  variantId: string;
  productId: string;
  productName: string;
  productCode?: string;
  variantName?: string;
  sku: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  soldQuantity: number;
  exportedAmount: number;
  importedQuantity: number;
  importedAmount: number;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

export interface DashboardTimelinePoint {
  date: string;
  fullDate: string;
  revenue: number;
  orderCount: number;
  purchaseAmount: number;
  receiptCount: number;
}

export interface DashboardData {
  timeline?: DashboardTimelinePoint[];
  financials: {
    gmv: number;
    completedRevenue: number;
    completedCogs: number;
    estimatedGrossProfit: number;
    actualSettled: number;
    totalPlatformFees: number;
    currency: string;
  };
  orderStats: {
    totalOrders: number;
    readyToShip: number;
    shipped: number;
    delivering: number;
    completed: number;
    completedOnly: number;
    toConfirmReceive: number;
    cancelled: number;
    returned: number;
    statusMap: Record<string, number>;
  };
  fulfillmentStats: {
    totalPackages: number;
    verifiedPackages: number;
    verificationRatePercent: number;
    notVerifiedOrders: number;
    partiallyVerifiedOrders: number;
    verifiedOrders: number;
  };
  inventoryAlerts: {
    lowStockVariantsCount: number;
    totalOnHand?: number;
    totalReserved?: number;
    totalAvailable?: number;
  };
  purchases?: {
    totalPurchaseAmount: number;
    netPurchaseAmount: number;
    totalReturnDeductionAmount: number;
    totalImportedQuantity: number;
    totalReceipts: number;
    inPeriodPayable: number;
    inPeriodPaid: number;
    inPeriodRemaining: number;
  };
  supplierDebt?: {
    totalRemainingDebt: number;
    totalPayableDebt: number;
    totalPaidDebt: number;
    unpaidReceiptsCount: number;
    suppliersWithDebtCount: number;
  };
  outbound?: {
    totalExportedAmount: number;
    totalOrders: number;
    totalExportedQuantity: number;
  };
  systemProducts?: DashboardSystemProduct[];
  topSellingItems: Array<{
    productName: string;
    sku: string;
    variantName?: string;
    unit?: string;
    totalQuantitySold: number;
    exportedAmount?: number;
    importedQuantity?: number;
    onHand?: number;
  }>;
  filterMeta?: {
    activePlatformStatuses: string[];
  };
}

export interface PurchaseReportFilterParams {
  shopId?: string;
  supplierId?: string;
  warehouseId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

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
  transactionType?: 'IMPORT' | 'RETURN';
  reason?: string | null;
  debtOffsetAmount?: number;
}

export interface PurchaseReportData {
  summary: {
    totalReceipts: number;
    totalItemsAmount: number;
    totalReturnDeductionAmount: number;
    netItemsAmount: number;
    totalPayableAmount: number;
    totalPaidAmount: number;
    totalRemainingAmount: number;
    totalReceivedQuantity: number;
    totalDisputedQuantity: number;
    uniqueSkusCount: number;
  };
  dailyTrend: Array<{
    date: string;
    count: number;
    totalAmount: number;
    returnDeduction: number;
    netAmount: number;
    quantity: number;
    paidAmount?: number;
    remainingAmount?: number;
  }>;
  byDate: Array<{
    date: string;
    count: number;
    totalAmount: number;
    returnDeduction: number;
    netAmount: number;
    paidAmount: number;
    remainingAmount: number;
    quantity: number;
  }>;
  byShop: Array<{
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
  }>;
  bySupplier: Array<{
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
    skusCount?: number;
    skus?: Array<{
      sku: string;
      productName: string;
      variationName: string | null;
      quantity: number;
      grossQuantity?: number;
      returnedQuantity?: number;
      netQuantity?: number;
      totalAmount: number;
      grossAmount?: number;
      returnedAmount?: number;
      netAmount?: number;
      avgPrice: number;
      receiptsCount: number;
      returnsCount?: number;
      transactions?: ProductImportTransaction[];
    }>;
  }>;
  topProducts: Array<{
    sku: string;
    productName: string;
    variationName: string | null;
    quantity: number;
    grossQuantity?: number;
    returnedQuantity?: number;
    netQuantity?: number;
    totalAmount: number;
    grossAmount?: number;
    returnedAmount?: number;
    netAmount?: number;
    avgPrice: number;
    receiptsCount: number;
    returnsCount?: number;
    suppliers?: string[];
    transactions?: ProductImportTransaction[];
  }>;
  receipts: any[];
}

export const reportsApi = {
  getDashboard: (params: ReportQueryParams = {}): Promise<DashboardData> => {
    return api.get(`/reports/dashboard${buildQuery(params)}`);
  },
  getPurchaseReport: async (params: PurchaseReportFilterParams = {}): Promise<PurchaseReportData> => {
    try {
      const res = await api.get(`/reports/purchases${buildQuery(params)}`);
      if (res && res.summary) {
        return res;
      }
    } catch (err: any) {
      console.warn(
        'Backend /reports/purchases unavailable or 404, calculating client-side fallback from purchase receipts:',
        err?.message || err,
      );
    }

    // Fallback: Load receipts and compute report metrics
    const queryParams: any = { limit: 500 };
    if (params.shopId && params.shopId !== 'ALL') queryParams.shopId = params.shopId;
    if (params.supplierId && params.supplierId !== 'ALL') queryParams.supplierId = params.supplierId;
    if (params.warehouseId) queryParams.warehouseId = params.warehouseId;
    if (params.startDate) queryParams.startDate = params.startDate;
    if (params.endDate) queryParams.endDate = params.endDate;
    if (params.search) queryParams.search = params.search;

    const receiptsRes: any = await api.get(`/purchase-receipts${buildQuery(queryParams)}`);
    const receipts: any[] = Array.isArray(receiptsRes)
      ? receiptsRes
      : receiptsRes?.data || receiptsRes?.items || [];

    return computePurchaseReportFromReceipts(receipts);
  },

  getOrderReconciliationReport: async (params: any = {}): Promise<OrderReconciliationReportData> => {
    return api.get(`/reports/order-reconciliation${buildQuery(params)}`);
  },

  getOrderReconciliationTransactions: async (variantId: string, params: any = {}): Promise<OrderReconciliationTransactionsData> => {
    return api.get(`/reports/order-reconciliation/${variantId}/transactions${buildQuery(params)}`);
  },

  getShopOrdersReport: async (params: any = {}): Promise<ShopOrdersReportData> => {
    return api.get(`/reports/order-reconciliation/shop-orders${buildQuery(params)}`);
  },
};

export interface OrderReconciliationItem {
  variantId: string;
  productId?: string;
  productName: string;
  productCode?: string;
  sku: string;
  variantName: string;
  barcode?: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  stockBefore: number;
  grossImportedQuantity?: number;
  supplierReturnedQuantity?: number;
  importedQuantity: number;
  importedAmount: number;
  receiptsCount: number;
  purchaseReturnsCount?: number;
  grossExportedQuantity?: number;
  customerReturnedQuantity?: number;
  exportedQuantity: number;
  exportedAmount?: number;
  ordersCount: number;
  orderReturnsCount?: number;
  onHand: number;
  reserved: number;
  available: number;
  damaged: number;
  calculatedStock: number;
  discrepancy: number;
  reconciliationStatus: 'BALANCED' | 'SURPLUS' | 'DEFICIT';
  fulfillmentRatePercent: number;
}

export interface OrderReconciliationSummary {
  totalVariants: number;
  totalStockBefore?: number;
  totalGrossImported?: number;
  totalSupplierReturned?: number;
  totalImportedQuantity: number;
  totalGrossExported?: number;
  totalCustomerReturned?: number;
  totalExportedQuantity: number;
  totalExportedAmount?: number;
  totalOrdersCount?: number;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  balancedCount: number;
  discrepancyCount: number;
  surplusCount: number;
  deficitCount: number;
  outOfStockCount: number;
  shopsSummary?: Array<{
    shopId: string;
    shopName: string;
    shopCode: string;
    ordersCount: number;
    realOrdersCount?: number;
    virtualOrdersCount?: number;
    totalRevenue?: number;
    virtualRevenue?: number;
    virtualCodAmount?: number;
    virtualProfit?: number;
    totalExportedAmount: number;
    netProfit?: number;
    exportedQuantity?: number;
  }>;
}

export interface OrderReconciliationReportData {
  summary: OrderReconciliationSummary;
  items: OrderReconciliationItem[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ShopOrderItem {
  id: string;
  internalOrderCode: string;
  externalOrderId: string;
  trackingCode?: string;
  orderDate?: string;
  platformStatus: string;
  fulfillmentStatus: string;
  verificationStatus: string;
  shopId: string;
  shopName: string;
  shopCode: string;
  recipientName?: string;
  recipientPhone?: string;
  isVirtual: boolean;
  isRealGoods: boolean;
  totalAmount: number;
  customRevenue: number | null;
  effectiveRevenue: number;
  codAmount: number;
  productsSellingTotal: number;
  cogsTotal: number;
  calculatedProfit: number;
  settledPayout: number | null;
  buyerPaidAmount: number | null;
  reconciliationStatus: string;
  items: Array<{
    id: string;
    productName: string;
    variationName?: string;
    sku: string;
    rawQuantity: number;
    packMultiplier: number;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    itemCogs: number;
  }>;
}

export interface ShopOrdersReportData {
  summary: {
    totalOrders: number;
    realOrdersCount: number;
    virtualOrdersCount: number;
    totalProductsSelling: number;
    totalRevenue: number;
    totalCod: number;
    virtualRevenue: number;
    virtualCodAmount: number;
    virtualProfit: number;
    realRevenue: number;
    realProfit: number;
    totalProfit: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  orders: ShopOrderItem[];
}

export interface OrderReconciliationTransactionsData {
  variant: {
    id: string;
    sku: string;
    barcode?: string;
    name: string;
    unit: string;
    costPrice: number;
    sellingPrice: number;
    product?: {
      id: string;
      code: string;
      name: string;
    };
  };
  stockBefore?: number;
  calculatedStock?: number;
  discrepancy?: number;
  reconciliationStatus?: 'BALANCED' | 'SURPLUS' | 'DEFICIT';
  inventoryBalances: Array<{
    warehouseId: string;
    warehouseName: string;
    warehouseCode: string;
    onHand: number;
    reserved: number;
    available: number;
    damaged: number;
  }>;
  orders: Array<{
    id: string;
    internalOrderCode: string;
    externalOrderId: string;
    trackingCode?: string;
    orderDate?: string;
    platformStatus: string;
    fulfillmentStatus: string;
    verificationStatus: string;
    recipientName?: string;
    shopName: string;
    rawQuantity?: number;
    packMultiplier?: number;
    quantity: number;
    originalPrice: number;
    discountedPrice: number;
    unitPrice?: number;
    itemAmount?: number;
    isVirtual?: boolean;
    isRealGoods?: boolean;
    codAmount?: number;
    customRevenue?: number | null;
    totalAmount?: number;
  }>;
  receipts: Array<{
    id: string;
    receiptCode: string;
    receiptDate: string;
    supplierName: string;
    warehouseName: string;
    shopName: string;
    orderedQuantity: number;
    receivedQuantity: number;
    unitPrice: number;
    subtotal: number;
    paymentStatus: string;
    stockBefore?: number;
    stockAfter?: number;
  }>;
  purchaseReturns?: Array<{
    id: string;
    returnCode: string;
    returnDate: string;
    supplierName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    debtOffsetAmount: number;
    reason: string;
    receiptCode?: string | null;
  }>;
  orderReturns?: Array<{
    id: string;
    returnCode: string;
    receivedDate: string;
    orderCode: string;
    trackingCode: string;
    shopName: string;
    sellableQuantity: number;
    damagedQuantity: number;
    reason: string;
  }>;
}

function computePurchaseReportFromReceipts(receipts: any[]): PurchaseReportData {
  let totalReceipts = receipts.length;
  let totalItemsAmount = 0;
  let totalReturnDeductionAmount = 0;
  let totalPayableAmount = 0;
  let totalPaidAmount = 0;
  let totalRemainingAmount = 0;
  let totalReceivedQuantity = 0;
  let totalDisputedQuantity = 0;

  const skuSet = new Set<string>();
  const dailyMap: Record<
    string,
    {
      count: number;
      totalAmount: number;
      returnDeduction: number;
      netAmount: number;
      paidAmount: number;
      remainingAmount: number;
      quantity: number;
    }
  > = {};
  const supplierMap: Record<
    string,
    {
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
      skusMap: Record<
        string,
        {
          sku: string;
          productName: string;
          variationName: string | null;
          quantity: number;
          totalAmount: number;
          receiptsCount: number;
        }
      >;
    }
  > = {};
  const shopMap: Record<
    string,
    {
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
    }
  > = {};
  const productMap: Record<
    string,
    {
      sku: string;
      productName: string;
      variationName: string | null;
      quantity: number;
      totalAmount: number;
      receiptsCount: number;
      suppliers: Set<string>;
    }
  > = {};

  for (const r of receipts) {
    const rItemsAmt = Number(r.totalItemsAmount || 0);
    const rRetDed = Number(r.returnDeductionAmount || 0);
    const rPayable = Number(r.payableAmount || 0);
    const rPaid = Number(r.paidAmount || 0);
    const rRemaining = Number(r.remainingAmount || 0);
    const rNet = Math.max(0, rItemsAmt - rRetDed);

    totalItemsAmount += rItemsAmt;
    totalReturnDeductionAmount += rRetDed;
    totalPayableAmount += rPayable;
    totalPaidAmount += rPaid;
    totalRemainingAmount += rRemaining;

    // Date
    let dStr = 'N/A';
    if (r.receiptDate) {
      try {
        dStr = new Date(r.receiptDate).toISOString().slice(0, 10);
      } catch {
        dStr = String(r.receiptDate).slice(0, 10);
      }
    }
    if (!dailyMap[dStr]) {
      dailyMap[dStr] = {
        count: 0,
        totalAmount: 0,
        returnDeduction: 0,
        netAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        quantity: 0,
      };
    }
    dailyMap[dStr].count += 1;
    dailyMap[dStr].totalAmount += rItemsAmt;
    dailyMap[dStr].returnDeduction += rRetDed;
    dailyMap[dStr].netAmount += rNet;
    dailyMap[dStr].paidAmount += rPaid;
    dailyMap[dStr].remainingAmount += rRemaining;

    // Supplier
    const supId = r.supplierId || 'UNKNOWN';
    const supName = r.supplier?.name || 'Nhà cung cấp khác';
    const supCode = r.supplier?.code || 'NCC_N/A';
    if (!supplierMap[supId]) {
      supplierMap[supId] = {
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
        skusMap: {},
      };
    }
    supplierMap[supId].count += 1;
    supplierMap[supId].totalAmount += rItemsAmt;
    supplierMap[supId].returnDeduction += rRetDed;
    supplierMap[supId].netAmount += rNet;
    supplierMap[supId].paidAmount += rPaid;
    supplierMap[supId].remainingAmount += rRemaining;

    // Shop
    const sId = r.shopId || 'CENTRAL';
    const sName = r.shop?.name || 'Kho chung / Chưa gán shop';
    const sCode = r.shop?.code || 'CENTRAL';
    if (!shopMap[sId]) {
      shopMap[sId] = {
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
    }
    shopMap[sId].count += 1;
    shopMap[sId].totalAmount += rItemsAmt;
    shopMap[sId].returnDeduction += rRetDed;
    shopMap[sId].netAmount += rNet;
    shopMap[sId].paidAmount += rPaid;
    shopMap[sId].remainingAmount += rRemaining;

    // Items
    let rQty = 0;
    if (r.items && Array.isArray(r.items)) {
      for (const it of r.items) {
        const qty = Number(it.receivedQuantity || 0);
        const subtotal = Number(it.subtotal || qty * Number(it.unitPrice || 0));
        rQty += qty;
        totalReceivedQuantity += qty;
        totalDisputedQuantity += Number(it.disputedQuantity || 0);
        if (it.sku) skuSet.add(it.sku);

        // Sub-SKU in Supplier
        if (it.sku) {
          if (!supplierMap[supId].skusMap[it.sku]) {
            supplierMap[supId].skusMap[it.sku] = {
              sku: it.sku,
              productName: it.productName || it.sku,
              variationName: it.variationName || null,
              quantity: 0,
              totalAmount: 0,
              receiptsCount: 0,
            };
          }
          supplierMap[supId].skusMap[it.sku].quantity += qty;
          supplierMap[supId].skusMap[it.sku].totalAmount += subtotal;
          supplierMap[supId].skusMap[it.sku].receiptsCount += 1;

          // Top products
          if (!productMap[it.sku]) {
            productMap[it.sku] = {
              sku: it.sku,
              productName: it.productName || it.sku,
              variationName: it.variationName || null,
              quantity: 0,
              totalAmount: 0,
              receiptsCount: 0,
              suppliers: new Set(),
            };
          }
          productMap[it.sku].quantity += qty;
          productMap[it.sku].totalAmount += subtotal;
          productMap[it.sku].receiptsCount += 1;
          if (supName) productMap[it.sku].suppliers.add(supName);
        }
      }
    }
    dailyMap[dStr].quantity += rQty;
    supplierMap[supId].quantity += rQty;
    shopMap[sId].quantity += rQty;
  }

  // Format daily trend (chronological) & byDate (newest first)
  const sortedDatesAsc = Object.keys(dailyMap).sort();
  const dailyTrend = sortedDatesAsc.map((d) => ({
    date: d,
    count: dailyMap[d].count,
    totalAmount: dailyMap[d].totalAmount,
    returnDeduction: dailyMap[d].returnDeduction,
    netAmount: dailyMap[d].netAmount,
    quantity: dailyMap[d].quantity,
    paidAmount: dailyMap[d].paidAmount,
    remainingAmount: dailyMap[d].remainingAmount,
  }));

  const byDate = [...dailyTrend].reverse();

  // Format bySupplier
  const bySupplier = Object.values(supplierMap)
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .map((s) => ({
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
      skusCount: Object.keys(s.skusMap).length,
      skus: Object.values(s.skusMap)
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .map((it) => ({
          ...it,
          avgPrice: it.quantity > 0 ? Math.round(it.totalAmount / it.quantity) : 0,
        })),
    }));

  // Format byShop
  const byShop = Object.values(shopMap).sort((a, b) => b.totalAmount - a.totalAmount);

  // Format topProducts
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.quantity - a.quantity)
    .map((p) => ({
      sku: p.sku,
      productName: p.productName,
      variationName: p.variationName,
      quantity: p.quantity,
      totalAmount: p.totalAmount,
      avgPrice: p.quantity > 0 ? Math.round(p.totalAmount / p.quantity) : 0,
      receiptsCount: p.receiptsCount,
      suppliers: Array.from(p.suppliers),
    }));

  return {
    summary: {
      totalReceipts,
      totalItemsAmount,
      totalReturnDeductionAmount,
      netItemsAmount: Math.max(0, totalItemsAmount - totalReturnDeductionAmount),
      totalPayableAmount,
      totalPaidAmount,
      totalRemainingAmount,
      totalReceivedQuantity,
      totalDisputedQuantity,
      uniqueSkusCount: skuSet.size,
    },
    dailyTrend,
    byDate,
    byShop,
    bySupplier,
    topProducts,
    receipts: receipts.slice(0, 50),
  };
}

