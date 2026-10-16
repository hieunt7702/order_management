export type MembershipRole = 'OWNER' | 'ADMIN' | 'WAREHOUSE' | 'ACCOUNTANT' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface Tenant {
  id: string;
  code: string;
  name: string;
  role?: MembershipRole;
}

export interface Membership {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  role: MembershipRole;
}

export interface Shop {
  id: string;
  tenantId: string;
  code?: string;
  name: string;
  platform: 'SHOPEE' | 'TIKTOK' | 'LAZADA';
  warehouseId?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export interface Warehouse {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE';
  isActive?: boolean;
}


export interface ProductVariant {
  id: string;
  tenantId: string;
  productId: string;
  sku: string;
  barcode?: string | null;
  name: string;
  unit?: string;
  costPrice: number;
  sellingPrice: number;
  sellPrice?: number;
  lowStockThreshold: number;
  minStockAlert?: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
  inventoryBalances?: InventoryBalance[];
  listingMappings?: ListingMapping[];
}

export interface Product {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
  variants: ProductVariant[];
}

export interface ListingMapping {
  id: string;
  tenantId: string;
  shopId: string;
  platform: 'SHOPEE' | 'TIKTOK' | 'LAZADA';
  externalProductId?: string | null;
  externalVariationId?: string | null;
  sellerSku: string;
  productName?: string | null;
  variationName?: string | null;
  multiplier: number;
  variantId: string;
  status: string;
  variant?: ProductVariant;
  shop?: Shop;
}

export interface OrderItem {
  id: string;
  orderId: string;
  tenantId: string;
  variantId?: string | null;
  platformProductId?: string | null;
  platformVariationId?: string | null;
  sellerSku: string;
  productName: string;
  variationName?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variant?: ProductVariant;
}

export interface Order {
  id: string;
  tenantId: string;
  shopId: string;
  orderSn: string;
  platform: string;
  orderStatus: string;
  fulfillmentStatus: 'UNFULFILLED' | 'ALLOCATED' | 'PICKED' | 'PACKED' | 'DISPATCHED' | 'CANCELLED' | 'RETURNED';
  totalAmount: number;
  actualShippingFee?: number;
  trackingNumber?: string | null;
  shippingCarrier?: string | null;
  orderCreationDate: string;
  paidTime?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientAddress?: string | null;
  items?: OrderItem[];
  shop?: Shop;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryBalance {
  id: string;
  warehouseId: string;
  variantId: string;
  onHand: number;
  allocated: number;
  available: number;
  warehouse?: Warehouse;
  variant?: ProductVariant;
}

export interface InventoryLedger {
  id: string;
  tenantId: string;
  warehouseId: string;
  variantId: string;
  movementType: string;
  quantity: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  createdAt: string;
  variant?: ProductVariant;
  warehouse?: Warehouse;
}

export interface Settlement {
  id: string;
  tenantId: string;
  shopId: string;
  payoutId?: string | null;
  payoutDate: string;
  amount: number;
  orderSn?: string | null;
  status: string;
  shop?: Shop;
  order?: Order;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: User;
}

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  timestamp: string;
  requestId: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
