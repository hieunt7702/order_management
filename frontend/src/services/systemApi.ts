import { api } from './apiClient';

export interface ClearDataParams {
  clearOrders?: boolean;
  clearPurchaseReceipts?: boolean;
  clearCashflow?: boolean;
  clearProducts?: boolean;
  clearSuppliers?: boolean;
}

export interface ClearDataResponse {
  success: boolean;
  message: string;
  counts: Record<string, number>;
}

export const systemApi = {
  clearData: (params: ClearDataParams = {}) => {
    return api.post<ClearDataResponse>('/system/clear-data', params);
  },
};
