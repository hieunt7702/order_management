import { api } from './apiClient';

export const membersApi = {
  findAll: () => api.get('/memberships'),
  addMember: (data: { email: string; role: string; name?: string; password?: string; allowedShopIds?: string[] }) =>
    api.post('/memberships', data),
  updateMember: (id: string, data: { role: string; allowedShopIds?: string[] }) =>
    api.patch(`/memberships/${id}`, data),
  delete: (id: string) => api.delete(`/memberships/${id}`),
  removeMember: (id: string) => api.delete(`/memberships/${id}`),
};


