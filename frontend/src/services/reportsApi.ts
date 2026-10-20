import { api, buildQuery } from './apiClient';

export interface ReportQueryParams {
  shopId?: string;
  startDate?: string;
  endDate?: string;
  platformStatuses?: string;
  [key: string]: any;
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
  }>;
  topProducts: Array<{
    sku: string;
    productName: string;
    variationName: string | null;
    quantity: number;
    totalAmount: number;
    avgPrice: number;
    receiptsCount: number;
  }>;
  receipts: any[];
}

export const reportsApi = {
  getDashboard: (params: ReportQueryParams = {}) => {
    return api.get(`/reports/dashboard${buildQuery(params)}`);
  },
  getPurchaseReport: (params: PurchaseReportFilterParams = {}): Promise<PurchaseReportData> => {
    return api.get(`/reports/purchases${buildQuery(params)}`);
  },
};

