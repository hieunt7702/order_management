import { api, buildQuery } from './apiClient';

export interface InventoryParams {
  warehouseId?: string;
  variantId?: string;
  sku?: string;
  page?: number;
  limit?: number;
  search?: string;
  movementType?: string;
  stockState?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}

export interface VariantInventorySummary {
  variant: {
    id: string;
    sku: string;
    name: string;
    barcode?: string;
    unit: string;
    costPrice: number;
    sellingPrice: number;
    lowStockThreshold: number;
    product: {
      id: string;
      name: string;
      code: string;
    };
  };
  summary: {
    actualWarehouseStock: number; // Tồn thực tế tại kho = bán được + chờ kiểm tra + hàng lỗi
    sellableStock: number;        // Tồn đủ điều kiện bán (onHand)
    reservedStock: number;        // Đang giữ cho đơn (reserved)
    availableToSell: number;      // Có thể bán thêm (onHand - reserved)
    inboundReturningStock: number;// Đang hoàn về (không cộng vào tồn thực tế)
    damagedStock: number;         // Hàng lỗi / hỏng
    pendingInspectionStock: number;// Hàng chờ kiểm tra
  };
  byWarehouse: Array<{
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string;
    actualWarehouseStock: number;
    sellableStock: number;
    reservedStock: number;
    availableToSell: number;
    damagedStock: number;
    pendingInspectionStock: number;
    inboundReturningStock: number;
    updatedAt: string;
  }>;
}

export interface InventoryLedgerEntry {
  id: string;
  createdAt: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  movementType: string;
  stockState: 'SELLABLE' | 'DAMAGED' | 'PENDING_INSPECTION' | string;
  deltaOnHand: number;
  deltaReserved: number;
  deltaDamaged: number;
  deltaInspection: number;
  beforeOnHand?: number;
  afterOnHand?: number;
  voucherCode?: string;
  performerName?: string;
  batchCode?: string;
  expiryDate?: string;
  referenceType?: string;
  referenceId?: string;
  performedByUserId?: string;
  note?: string;
}

export interface InventoryLedgerResponse {
  items: InventoryLedgerEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const inventoryApi = {
  getBalances: (params: InventoryParams = {}) => {
    return api.get(`/inventory/balances${buildQuery(params)}`);
  },

  getVariantSummary: (variantId: string, warehouseId?: string) => {
    const qs = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return api.get<VariantInventorySummary>(`/inventory/variant/${variantId}/summary${qs}`);
  },

  getLedger: (params: InventoryParams = {}) => {
    return api.get<InventoryLedgerResponse>(`/inventory/ledger${buildQuery(params)}`);
  },

  receiveStock: (data: any, idempotencyKey?: string) => {
    return api.post('/inventory/receive', data, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    });
  },

  adjustStock: (data: any, idempotencyKey?: string) => {
    return api.post('/inventory/adjust', data, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    });
  },

  reconcile: (warehouseId?: string) => {
    const qs = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return api.get(`/inventory/reconciliation${qs}`);
  },
};
