import { api, buildQuery } from './apiClient';

export interface ReturnQueueItem {
  id: string;
  internalOrderCode: string;
  externalOrderId: string;
  trackingCode?: string | null;
  shop?: {
    id: string;
    name: string;
    code: string;
    defaultWarehouseId?: string | null;
  };
  platformStatus: string;
  fulfillmentStatus: string;
  orderDate?: string | null;
  buyerUsername?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  totalDispatched: number;
  totalAccounted: number;
  remainingTotal: number;
  queueStatus: 'WAITING_INSPECTION' | 'PARTIALLY_INSPECTED' | 'FULLY_INSPECTED';
  returnCount: number;
  itemsProgress: Array<{
    orderItemId: string;
    variantId: string;
    sku: string;
    productName: string;
    variationName?: string | null;
    dispatchedQuantity: number;
    returnedSellable: number;
    returnedDamaged: number;
    returnedMissing: number;
    totalAccounted: number;
    remainingToReturn: number;
  }>;
}

export interface InspectReturnItemPayload {
  variantId: string;
  sku: string;
  sellableQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  batchCode?: string;
  expiryDate?: string;
  note?: string;
}

export interface CreateOrderReturnPayload {
  orderId: string;
  warehouseId: string;
  returnCode?: string;
  trackingCode?: string;
  receivedDate?: string;
  inspectorName: string;
  conditionPhoto?: string;
  reason?: string;
  note?: string;
  items: InspectReturnItemPayload[];
}

export interface OrderReturnModel {
  id: string;
  returnCode: string;
  trackingCode?: string | null;
  receivedDate: string;
  inspectedDate?: string | null;
  inspectorName: string;
  status: string;
  reason?: string | null;
  conditionPhoto?: string | null;
  note?: string | null;
  order: {
    id: string;
    internalOrderCode: string;
    externalOrderId: string;
    trackingCode?: string | null;
    buyerUsername?: string | null;
    recipientName?: string | null;
  };
  shop?: {
    id: string;
    name: string;
    code: string;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  items: Array<{
    id: string;
    variantId: string;
    sku: string;
    dispatchedQuantity: number;
    receivedQuantity: number;
    sellableQuantity: number;
    damagedQuantity: number;
    missingQuantity: number;
    batchCode?: string | null;
    expiryDate?: string | null;
    note?: string | null;
    variant?: {
      id: string;
      sku: string;
      name: string;
      product?: {
        name: string;
      };
    };
  }>;
}

export interface OrderReturnsResponse {
  data: OrderReturnModel[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const orderReturnsApi = {
  getReturnQueue: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return api.get<ReturnQueueItem[]>(`/order-returns/queue${qs}`);
  },

  inspectAndReceive: (data: CreateOrderReturnPayload) => {
    return api.post<OrderReturnModel>('/order-returns/inspect', data);
  },

  findAll: (params?: {
    orderId?: string;
    shopId?: string;
    warehouseId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    return api.get<OrderReturnsResponse>(`/order-returns${buildQuery(params)}`);
  },

  findOne: (id: string) => {
    return api.get<OrderReturnModel>(`/order-returns/${id}`);
  },
};
