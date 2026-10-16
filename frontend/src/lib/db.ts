import Dexie, { type EntityTable } from 'dexie';

export interface LocalImport {
  id: string;
  fileName: string;
  importedAt: string;
  period?: string;
}

export interface LocalOrder {
  id: string;
  fileId: string;
  orderCode: string;
  orderDate: string;
  status: string;
}

export interface LocalProduct {
  id: string;
  sku: string;
  name: string;
  variation?: string;
  costPrice?: number;
}

export interface ScannedBatch {
  id: string;
  name: string;
  createdAt: string;
  totalOrders: number;
  totalAmount?: number;
}

export interface ScannedOrder {
  id: string;
  batchId: string;
  trackingCode: string;
  orderCode?: string;
  scannedAt: string;
}

export type ShopeeDatabase = Dexie & {
  imports: EntityTable<LocalImport, 'id'>;
  orders: EntityTable<LocalOrder, 'id'>;
  products: EntityTable<LocalProduct, 'id'>;
  scannedBatches: EntityTable<ScannedBatch, 'id'>;
  scannedOrders: EntityTable<ScannedOrder, 'id'>;
};

export const db = new Dexie('ShopeeCRM') as ShopeeDatabase;

db.version(1).stores({
  imports: 'id, fileName, importedAt, period',
  orders: 'id, fileId, orderCode, orderDate, status',
});

db.version(2).stores({
  products: 'id, sku, name, variation, costPrice',
});

// Version 4: Hỗ trợ lưu trữ các đợt quét đơn hàng bằng điện thoại
db.version(4).stores({
  products: 'id, sku, name, variation, costPrice',
  scannedBatches: 'id, name, createdAt, totalOrders, totalAmount',
  scannedOrders: 'id, batchId, trackingCode, orderCode, scannedAt',
});

// Helper exports
export const imports = db.imports;
export const orders = db.orders;
export const products = db.products;
export const scannedBatches = db.scannedBatches;
export const scannedOrders = db.scannedOrders;
