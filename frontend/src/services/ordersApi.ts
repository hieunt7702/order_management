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
};

