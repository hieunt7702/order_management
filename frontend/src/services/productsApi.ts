import { api, buildQuery } from './apiClient';

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: any;
}

export const productsApi = {
  findAll: (params: ProductQueryParams = {}) => {
    return api.get(`/products${buildQuery(params)}`);
  },
  findOne: (id: string) => api.get(`/products/${id}`),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.patch(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  updateVariant: (variantId: string, data: any) =>
    api.patch(`/products/variants/${variantId}`, data),
  deleteVariant: (variantId: string) =>
    api.delete(`/products/variants/${variantId}`),
  findMappings: (shopId?: string) => {
    const qs = shopId ? `?shopId=${shopId}` : '';
    return api.get(`/products/mappings${qs}`);
  },
  createMapping: (data: any) => api.post('/products/mappings', data),
  bulkMapping: (data: any) => api.post('/products/mappings/bulk', data),
  deleteMapping: (id: string) => api.delete(`/products/mappings/${id}`),
  findAllVariants: (params: ProductQueryParams = {}) =>
    api.get(`/products/variants${buildQuery(params)}`),
};

