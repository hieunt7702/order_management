import { api } from './apiClient';

export const importsApi = {
  uploadFile: (file: File, shopId: string, warehouseId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('shopId', shopId);
    if (warehouseId) {
      formData.append('warehouseId', warehouseId);
    }
    return api.post('/imports/upload', formData);
  },
  getPreview: (id: string) => api.get(`/imports/${id}/preview`),
  confirmImport: (id: string, autoReserve = true) =>
    api.post(`/imports/${id}/confirm`, { autoReserve }),
};
