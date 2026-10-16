import { api, buildQuery } from './apiClient';

export type CashAccountType = 'CASH' | 'BANK' | 'PLATFORM_WALLET' | 'PERSONAL_HOLD';
export type CashCategoryType =
  | 'INCOME'
  | 'EXPENSE'
  | 'INTERNAL_TRANSFER'
  | 'CAPITAL'
  | 'REIMBURSEMENT';
export type CashTransactionType =
  | 'INCOME'
  | 'EXPENSE'
  | 'INTERNAL_TRANSFER'
  | 'CAPITAL_IN'
  | 'CAPITAL_OUT'
  | 'REIMBURSEMENT';
export type CashTransactionStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
export type OrderReconciliationStatus = 'NO_DATA' | 'UNMATCHED' | 'MATCHED' | 'NEEDS_CHECK';

export interface CashAccountModel {
  id: string;
  code: string;
  name: string;
  type: CashAccountType;
  shopId?: string | null;
  accountNumber?: string | null;
  bankName?: string | null;
  initialBalance: number;
  currentBalance: number;
  currency: string;
  isActive: boolean;
  note?: string | null;
  shop?: { id: string; name: string } | null;
  _count?: {
    outflowTransactions: number;
    inflowTransactions: number;
  };
}

export interface CashCategoryModel {
  id: string;
  code: string;
  name: string;
  type: CashCategoryType;
  isSystemDefault: boolean;
  isActive: boolean;
  description?: string | null;
  _count?: {
    transactions: number;
  };
}

export interface CashTransactionModel {
  id: string;
  tenantId: string;
  shopId?: string | null;
  isCommonExpense: boolean;
  transactionCode: string;
  type: CashTransactionType;
  categoryId: string;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  amount: number;
  transactionDate: string;
  paymentMethod: string;
  status: CashTransactionStatus;
  counterpartyName?: string | null;
  performedByName?: string | null;
  referenceCode?: string | null;
  voucherImage?: string | null;
  note?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  category?: CashCategoryModel;
  fromAccount?: CashAccountModel | null;
  toAccount?: CashAccountModel | null;
  shop?: { id: string; name: string } | null;
}

export interface CashTransferModel {
  id: string;
  transferCode: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  feeAmount: number;
  transferDate: string;
  status: CashTransactionStatus;
  referenceCode?: string | null;
  note?: string | null;
  fromAccount?: CashAccountModel;
  toAccount?: CashAccountModel;
}

export interface OrderReconciliationRecordModel {
  id: string;
  shopId: string;
  orderId: string;
  externalOrderId: string;
  orderItemAmount: number;
  buyerPaidAmount: number;
  estimatedPayout: number;
  settledPayout: number;
  commissionFee: number;
  serviceFee: number;
  transactionFee: number;
  shippingFee: number;
  adjustmentAmount: number;
  reconciliationStatus: OrderReconciliationStatus;
  payoutDate?: string | null;
  note?: string | null;
  createdAt: string;
  shop?: { id: string; name: string };
  order?: {
    id: string;
    internalOrderCode: string;
    externalOrderId: string;
    orderDate?: string | null;
    platformStatus: string;
    fulfillmentStatus: string;
    trackingCode?: string | null;
    shippingCarrier?: string | null;
    totalAmount: number;
    orderItems?: Array<{
      productName: string;
      variationName?: string | null;
      quantity: number;
      discountedPrice: number;
    }>;
  };
}

export interface CashflowOverviewModel {
  accounts: CashAccountModel[];
  totals: {
    totalCash: number;
    totalBank: number;
    totalPlatformWallet: number;
    totalNetBalance: number;
  };
  period: {
    periodIncome: number;
    periodExpense: number;
    netOperatingCashflow: number;
    periodCapitalIn: number;
    periodCapitalOut: number;
  };
  outstanding: {
    pendingPlatformMoney: number;
    pendingPlatformCount: number;
    supplierDebt: number;
    unpaidReceiptsCount: number;
    staffPersonalDebt: number;
    pendingReimbursementCount: number;
  };
  recentTransactions: CashTransactionModel[];
}

export interface CreateCashTransactionPayload {
  type: CashTransactionType;
  categoryId: string;
  amount: number;
  transactionDate?: string;
  shopId?: string;
  isCommonExpense?: boolean;
  fromAccountId?: string;
  toAccountId?: string;
  paymentMethod?: string;
  status?: CashTransactionStatus;
  counterpartyName?: string;
  performedByName?: string;
  referenceCode?: string;
  voucherImage?: string;
  note?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  allocations?: Array<{ receiptId: string; amount: number }>;
}

export interface CreateInternalTransferPayload {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  feeAmount?: number;
  transferDate?: string;
  referenceCode?: string;
  note?: string;
}

export interface SettlementRowPayload {
  externalOrderId: string;
  orderItemAmount?: number;
  buyerPaidAmount?: number;
  actualPayout?: number;
  commissionFee?: number;
  serviceFee?: number;
  transactionFee?: number;
  shippingFee?: number;
  adjustmentAmount?: number;
  settledAt?: string;
  rawPlatformData?: any;
}

export const cashflowApi = {
  // 1. Tổng quan tiền
  getOverview: (params?: { shopId?: string; startDate?: string; endDate?: string }) =>
    api.get<CashflowOverviewModel>(`/cashflow/overview${buildQuery(params)}`),

  // 2. Tài khoản
  getAccounts: () => api.get<CashAccountModel[]>('/cashflow/accounts'),
  createAccount: (data: {
    code: string;
    name: string;
    type: CashAccountType;
    shopId?: string;
    accountNumber?: string;
    bankName?: string;
    initialBalance?: number;
    note?: string;
  }) => api.post<CashAccountModel>('/cashflow/accounts', data),
  updateAccount: (
    id: string,
    data: {
      name?: string;
      accountNumber?: string;
      bankName?: string;
      isActive?: boolean;
      note?: string;
    },
  ) => api.patch<CashAccountModel>(`/cashflow/accounts/${id}`, data),

  // 3. Danh mục
  getCategories: (type?: CashCategoryType) =>
    api.get<CashCategoryModel[]>(`/cashflow/categories${buildQuery({ type })}`),
  createCategory: (data: {
    code: string;
    name: string;
    type: CashCategoryType;
    description?: string;
  }) => api.post<CashCategoryModel>('/cashflow/categories', data),
  updateCategory: (
    id: string,
    data: { name?: string; isActive?: boolean; description?: string },
  ) => api.patch<CashCategoryModel>(`/cashflow/categories/${id}`, data),
  deleteCategory: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/cashflow/categories/${id}`),

  // 4. Sổ giao dịch
  getTransactions: (params?: {
    startDate?: string;
    endDate?: string;
    type?: string;
    categoryId?: string;
    accountId?: string;
    shopId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get<{
      items: CashTransactionModel[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/cashflow/transactions${buildQuery(params)}`),

  checkDuplicate: (data: {
    amount: number;
    transactionDate?: string;
    counterpartyName?: string;
    referenceCode?: string;
  }) =>
    api.post<{ hasWarning: boolean; warnings: string[] }>(
      '/cashflow/transactions/check-duplicate',
      data,
    ),

  createTransaction: (data: CreateCashTransactionPayload) =>
    api.post<CashTransactionModel>('/cashflow/transactions', data),

  confirmTransaction: (id: string) =>
    api.post<CashTransactionModel>(`/cashflow/transactions/${id}/confirm`),

  cancelTransaction: (id: string, reason?: string) =>
    api.post<CashTransactionModel>(`/cashflow/transactions/${id}/cancel`, { reason }),

  createInternalTransfer: (data: CreateInternalTransferPayload) =>
    api.post<CashTransferModel>('/cashflow/transfers', data),

  // 5. Đối soát tiền Shopee
  getReconciliation: (params?: {
    shopId?: string;
    reconciliationStatus?: OrderReconciliationStatus;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get<{
      items: OrderReconciliationRecordModel[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      summary: {
        totalGoodsValue: number;
        totalEstimatedPayout: number;
        totalSettledPayout: number;
        totalFees: number;
        totalAdjustment: number;
        statusCounts: Record<string, number>;
      };
    }>(`/cashflow/reconciliation${buildQuery(params)}`),

  importSettlement: (data: {
    shopId: string;
    creditToAccountId?: string;
    rows: SettlementRowPayload[];
  }) =>
    api.post<{
      totalProcessed: number;
      matchedCount: number;
      unmatchedCount: number;
      needsCheckCount: number;
      totalSettledAmount: number;
      results: Array<{
        externalOrderId: string;
        status: OrderReconciliationStatus;
        actualPayout: number;
        difference: number;
      }>;
    }>('/cashflow/reconciliation/import-settlement', data),

  syncOrders: (shopId?: string) =>
    api.post<{ syncedCount: number }>('/cashflow/reconciliation/sync-orders', { shopId }),
};
