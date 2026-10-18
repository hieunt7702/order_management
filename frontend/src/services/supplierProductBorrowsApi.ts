import { api, buildQuery } from './apiClient';

export interface SupplierProductBorrowItemModel {
  id: string;
  tenantId: string;
  borrowId: string;
  variantId: string;
  productName: string;
  variationName?: string | null;
  sku: string;
  borrowQuantity: number;
  returnedQuantity: number;
  purchasedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  subtotal: number;
  note?: string | null;
  createdAt: string;
  variant?: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    costPrice: number;
  };
}

export interface SupplierProductBorrowModel {
  id: string;
  tenantId: string;
  supplierId: string;
  warehouseId: string;
  borrowCode: string;
  type: 'BORROW_FROM_SUPPLIER' | 'LEND_TO_SUPPLIER';
  borrowDate: string;
  dueDate?: string | null;
  totalQuantity: number;
  returnedQuantity: number;
  purchasedQuantity: number;
  remainingQuantity: number;
  estimatedTotalAmount: number;
  status: 'BORROWED' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'CONVERTED_TO_PURCHASE' | 'CANCELLED';
  note?: string | null;
  createdAt: string;
  supplier?: {
    id: string;
    code: string;
    name: string;
    phone?: string;
    bankName?: string | null;
    bankAccount?: string | null;
    bankBeneficiary?: string | null;
  };
  warehouse?: {
    id: string;
    code: string;
    name: string;
  };
  items?: SupplierProductBorrowItemModel[];
}

export interface CreateBorrowItemPayload {
  variantId: string;
  sku: string;
  productName: string;
  variationName?: string;
  borrowQuantity: number;
  unitPrice?: number;
  note?: string;
}

export interface CreateSupplierProductBorrowPayload {
  supplierId: string;
  warehouseId: string;
  borrowCode?: string;
  type?: 'BORROW_FROM_SUPPLIER' | 'LEND_TO_SUPPLIER';
  borrowDate?: string;
  dueDate?: string;
  note?: string;
  items: CreateBorrowItemPayload[];
}

export interface ReturnBorrowItemPayload {
  itemId: string;
  returnQuantity: number;
  note?: string;
}

export interface ReturnSupplierProductBorrowPayload {
  borrowId: string;
  returnDate?: string;
  note?: string;
  items: ReturnBorrowItemPayload[];
}

export interface ConvertBorrowItemPayload {
  itemId: string;
  purchaseQuantity: number;
  unitPrice: number;
  note?: string;
}

export interface ConvertBorrowToPurchasePayload {
  borrowId: string;
  shopId?: string;
  receiptCode?: string;
  paymentDueDate?: string;
  note?: string;
  items: ConvertBorrowItemPayload[];
}

export interface SupplierProductBorrowFilterParams {
  supplierId?: string;
  warehouseId?: string;
  type?: 'BORROW_FROM_SUPPLIER' | 'LEND_TO_SUPPLIER';
  status?: 'BORROWED' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'CONVERTED_TO_PURCHASE' | 'CANCELLED';
  search?: string;
  page?: number;
  limit?: number;
}

export interface SupplierProductBorrowsResponse {
  items: SupplierProductBorrowModel[];
  data?: SupplierProductBorrowModel[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: {
    totalBorrowedRemaining: number;
    totalEstimatedBorrowedValue: number;
    totalLentRemaining: number;
    overdueCount: number;
  };
}

export const supplierProductBorrowsApi = {
  findAll: async (
    params?: SupplierProductBorrowFilterParams,
  ): Promise<SupplierProductBorrowsResponse> => {
    const q = buildQuery(params);
    return api.get<SupplierProductBorrowsResponse>(`/supplier-product-borrows${q}`);
  },

  findOne: async (id: string): Promise<SupplierProductBorrowModel> => {
    return api.get<SupplierProductBorrowModel>(`/supplier-product-borrows/${id}`);
  },

  create: async (
    payload: CreateSupplierProductBorrowPayload,
  ): Promise<SupplierProductBorrowModel> => {
    return api.post<SupplierProductBorrowModel>('/supplier-product-borrows', payload);
  },

  returnItems: async (
    payload: ReturnSupplierProductBorrowPayload,
  ): Promise<SupplierProductBorrowModel> => {
    return api.post<SupplierProductBorrowModel>('/supplier-product-borrows/return', payload);
  },

  convertToPurchase: async (
    payload: ConvertBorrowToPurchasePayload,
  ): Promise<{ borrow: SupplierProductBorrowModel; purchaseReceipt: any }> => {
    return api.post<{ borrow: SupplierProductBorrowModel; purchaseReceipt: any }>(
      '/supplier-product-borrows/convert-to-purchase',
      payload,
    );
  },
};
