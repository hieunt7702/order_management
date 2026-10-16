import { api, buildQuery } from './apiClient';

export interface ScanHistoryParams {
  page?: number;
  limit?: number;
  warehouseId?: string;
  [key: string]: any;
}

export const fulfillmentApi = {
  scanBarcode: (
    code: string,
    warehouseId: string,
    deviceId?: string,
    packageId?: string,
    idempotencyKey?: string,
  ) => {
    return api.post(
      '/fulfillment/scan',
      { code, warehouseId, deviceId, packageId },
      {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
      },
    );
  },
  batchVerify: (codes: string[], warehouseId?: string, deviceId?: string, sessionName?: string) => {
    return api.post('/fulfillment/batch-verify', { codes, warehouseId, deviceId, sessionName });
  },
  reverseDispatch: (packageId: string, reason: string) => {
    return api.post('/fulfillment/reverse', { packageId, reason });
  },
  getScanHistory: (params: ScanHistoryParams = {}) => {
    return api.get(`/fulfillment/history${buildQuery(params)}`);
  },
};
