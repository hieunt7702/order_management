import { api, buildQuery } from './apiClient';

export interface ReportQueryParams {
  shopId?: string;
  startDate?: string;
  endDate?: string;
  platformStatuses?: string;
  [key: string]: any;
}

export const reportsApi = {
  getDashboard: (params: ReportQueryParams = {}) => {
    return api.get(`/reports/dashboard${buildQuery(params)}`);
  },
};
