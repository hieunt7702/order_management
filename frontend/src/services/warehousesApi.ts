import { api } from './apiClient';

export interface CreateWarehouseDto {
  code?: string;
  name: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
}


export const warehousesApi = {
  findAll: () => api.get('/warehouses'),
  findOne: (id: string) => api.get(`/warehouses/${id}`),
  create: (data: CreateWarehouseDto) => api.post('/warehouses', data),
  update: (id: string, data: Partial<CreateWarehouseDto>) =>
    api.patch(`/warehouses/${id}`, data),
  delete: (id: string) => api.delete(`/warehouses/${id}`),
};
