import { api, buildQuery } from './apiClient';

export interface SettlementQueryParams {
  page?: number;
  limit?: number;
  shopId?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}

export const settlementsApi = {
  findAll: (params: SettlementQueryParams = {}) => {
    return api.get(`/settlements${buildQuery(params)}`);
  },
  recordSettlement: (data: any) => api.post('/settlements', data),
};
