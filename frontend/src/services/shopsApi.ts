import { api } from './apiClient';

export interface CreateShopDto {
  code?: string;
  name: string;
  platform?: 'SHOPEE' | 'TIKTOK' | 'LAZADA' | string;
  warehouseId?: string;
  defaultWarehouseId?: string;
  isActive?: boolean;
}



export const shopsApi = {
  findAll: () => api.get('/shops'),
  findOne: (id: string) => api.get(`/shops/${id}`),
  getNextCode: () => api.get<{ code: string }>('/shops/next-code'),
  create: (data: CreateShopDto) => api.post('/shops', data),
  update: (id: string, data: Partial<CreateShopDto>) =>
    api.patch(`/shops/${id}`, data),
  delete: (id: string) => api.delete(`/shops/${id}`),
};
