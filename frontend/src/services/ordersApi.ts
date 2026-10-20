import { api, buildQuery } from './apiClient';

export interface OrderQueryParams {
  page?: number;
  limit?: number;
  shopId?: string;
  orderStatus?: string;
  fulfillmentStatus?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  [key: string]: any;
}

export const ordersApi = {
  findAll: (params: OrderQueryParams = {}) => {
    return api.get(`/orders${buildQuery(params)}`);
  },
  getSummary: (params: { shopId?: string; fromDate?: string; toDate?: string } = {}) => {
    return api.get(`/orders/summary${buildQuery(params)}`);
  },
  findOne: (id: string) => api.get(`/orders/${id}`),
  create: (data: any) => api.post('/orders', data),
  update: (id: string, data: any) => api.patch(`/orders/${id}`, data),
  delete: (id: string) => api.delete(`/orders/${id}`),
  bulkDelete: (data: {
    orderIds?: string[];
    deleteAll?: boolean;
    shopId?: string;
    force?: boolean;
  }) => api.post('/orders/bulk-delete', data),
  reserveOrder: (id: string) => api.post(`/orders/${id}/reserve`, {}),
  cancelOrder: (id: string, reason: string) =>
    api.post(`/orders/${id}/cancel`, { reason }),
  receiveReturn: (id: string, data: any) =>
    api.post(`/orders/${id}/receive-return`, data),
  markVirtual: (id: string, data: { isVirtual: boolean; isRealGoods?: boolean }) =>
    api.patch(`/orders/${id}/virtual`, data),
  bulkMarkVirtual: (data: { orderIds: string[]; isVirtual: boolean; isRealGoods?: boolean }) =>
    api.post('/orders/bulk-virtual', data),
};

