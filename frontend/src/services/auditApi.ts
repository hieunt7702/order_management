import { api, buildQuery } from './apiClient';

export interface AuditLogParams {
  page?: number;
  limit?: number;
  action?: string;
  resource?: string;
  [key: string]: any;
}

export const auditApi = {
  getAuditLogs: (params: AuditLogParams = {}) => {
    return api.get(`/audit${buildQuery(params)}`);
  },
};
