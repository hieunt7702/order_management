import { db } from '../lib/db';
import { recalculateOrder, generateProductKey } from './index';

/**
 * Get all imported files info
 */
export const getImportedFiles = async (): Promise<any[]> => {
  try {
    return await db.imports.orderBy('importedAt').reverse().toArray();
  } catch (error) {
    console.error('Error getting files:', error);
    return [];
  }
};

/**
 * Save new orders and tag them with fileId, saving the file info as well
 */
export const saveAndMergeOrders = async (
  newOrders: any[],
  fileInfo: {
    id: string;
    name: string;
    size?: number;
    period?: string;
    summary?: any;
  },
) => {
  try {
    await db.transaction('rw', db.imports, db.orders, db.products, async () => {
      // 1. Save import metadata
      const fileToSave = {
        id: fileInfo.id,
        fileName: fileInfo.name,
        importedAt: new Date().toISOString(),
        period: fileInfo.period || 'Unknown',
        totalOrders: newOrders.length,
        size: fileInfo.size || 0,
        summary: fileInfo.summary || { revenue: 0, shopeeFee: 0, profit: 0 },
      };

      await db.imports.put(fileToSave as any);

      // Extract products
      const newProductsMap: Record<string, any> = {};
      newOrders.forEach((order) => {
        (order.productsList || [order.rawData]).forEach((p: any) => {
          const key = generateProductKey(p);
          if (!newProductsMap[key]) {
            newProductsMap[key] = {
              id: key,
              sku: p['SKU phân loại hàng'] || p['SKU sản phẩm'] || '',
              name: p['Tên sản phẩm'] || 'Sản phẩm không xác định',
              variation: p['Phân loại hàng'] || 'Mặc định',
              costPrice: 0,
            };
          }
        });
      });

      // Update DB products without overwriting existing costPrice
      const existingProducts = await db.products
        .where('id')
        .anyOf(Object.keys(newProductsMap))
        .toArray();
      const existingProductKeys = new Set(existingProducts.map((p) => p.id));

      const productsToInsert = Object.values(newProductsMap).filter(
        (p) => !existingProductKeys.has(p.id),
      );
      if (productsToInsert.length > 0) {
        await db.products.bulkAdd(productsToInsert);
      }

      // 2. Save orders
      await db.orders.bulkPut(newOrders);
    });

    return { success: true };
  } catch (error) {
    console.error('Error saving data to IndexedDB:', error);
    throw error;
  }
};

/**
 * Delete a specific imported file and all its associated orders
 */
export const deleteImportedFile = async (fileId: string) => {
  try {
    await db.transaction('rw', db.imports, db.orders, async () => {
      await db.imports.delete(fileId);
      await db.orders.where('fileId').equals(fileId).delete();
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

/**
 * Clear all saved orders and files
 */
export const clearAllOrders = async () => {
  try {
    await db.transaction('rw', db.imports, db.orders, async () => {
      await db.imports.clear();
      await db.orders.clear();
    });
  } catch (error) {
    console.error('Error clearing DB:', error);
    throw error;
  }
};

export interface FilterOptions {
  type?: 'all' | 'file' | 'time';
  fileId?: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
}

/**
 * Get orders based on filter (All, by File, or by Time range)
 */
export const getFilteredOrders = async (filter: FilterOptions = {}) => {
  try {
    let data: any[] = [];

    // 1. Initial Data Fetch based on main filter type
    if (filter.type === 'file' && filter.fileId) {
      data = await db.orders.where('fileId').equals(filter.fileId).toArray();
    } else if (filter.type === 'time' && filter.startDate && filter.endDate) {
      const start = new Date(filter.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filter.endDate);
      end.setHours(23, 59, 59, 999);
      data = await db.orders
        .where('orderDate')
        .between(start.toISOString(), end.toISOString(), true, true)
        .toArray();
    } else {
      data = await db.orders.toArray();
    }

    // 2. Apply Date Range post-filtering if not already done by DB index
    if (filter.type !== 'time' && filter.startDate && filter.endDate) {
      const start = new Date(filter.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filter.endDate);
      end.setHours(23, 59, 59, 999);

      const startStr = start.toISOString();
      const endStr = end.toISOString();

      data = data.filter(
        (order) => order.orderDate >= startStr && order.orderDate <= endStr,
      );
    }

    // Fetch products map
    const allProducts = await db.products.toArray();
    const productsMap: Record<string, any> = {};
    allProducts.forEach((p) => (productsMap[p.id] = p));

    // Bổ sung các sản phẩm bị thiếu từ data cũ
    const missingProducts: Record<string, any> = {};
    data.forEach((order) => {
      (order.productsList || [order.rawData]).forEach((p: any) => {
        const key = generateProductKey(p);
        if (!productsMap[key] && !missingProducts[key]) {
          missingProducts[key] = {
            id: key,
            sku: p['SKU phân loại hàng'] || p['SKU sản phẩm'] || '',
            name: p['Tên sản phẩm'] || 'Sản phẩm không xác định',
            variation: p['Phân loại hàng'] || 'Mặc định',
            costPrice: 0,
          };
        }
      });
    });

    const productsToInsert = Object.values(missingProducts);
    if (productsToInsert.length > 0) {
      await db.products.bulkAdd(productsToInsert);
      productsToInsert.forEach((p) => (productsMap[p.id] = p));
    }

    return data.map((order) => recalculateOrder(order, productsMap));
  } catch (error) {
    console.error('Error getting filtered orders:', error);
    return [];
  }
};

/**
 * Backup entire database to JSON blob
 */
export const exportDatabaseBackup = async (): Promise<string> => {
  const importsData = await db.imports.toArray();
  const ordersData = await db.orders.toArray();
  const backup = {
    version: 1,
    timestamp: new Date().toISOString(),
    imports: importsData,
    orders: ordersData,
  };
  return JSON.stringify(backup);
};

/**
 * Restore database from JSON blob
 */
export const importDatabaseBackup = async (jsonString: string) => {
  try {
    const backup = JSON.parse(jsonString);
    if (!backup.imports || !backup.orders) {
      throw new Error('Invalid backup format');
    }

    await db.transaction('rw', db.imports, db.orders, async () => {
      await db.imports.clear();
      await db.orders.clear();
      await db.imports.bulkAdd(backup.imports);
      await db.orders.bulkAdd(backup.orders);
    });
    return { success: true };
  } catch (error) {
    console.error('Restore error:', error);
    throw error;
  }
};

/**
 * Get total imported files size in bytes
 */
export const getStorageUsage = async (): Promise<number> => {
  try {
    const imports = await db.imports.toArray();
    const totalBytes = imports.reduce(
      (sum, file: any) => sum + (file.size || 0),
      0,
    );
    return totalBytes;
  } catch (error) {
    console.error('Error getting storage usage:', error);
    return 0;
  }
};

/**
 * Lưu đợt quét đơn hàng vào cơ sở dữ liệu
 */
export const saveScannedBatch = async (batchInfo: any, orders: any[]) => {
  try {
    await db.transaction(
      'rw',
      db.scannedBatches,
      db.scannedOrders,
      async () => {
        await db.scannedBatches.put(batchInfo);
        if (orders && orders.length > 0) {
          await db.scannedOrders.bulkPut(orders);
        }
      },
    );
    return { success: true };
  } catch (err) {
    console.error('Lỗi khi lưu đợt quét:', err);
    throw err;
  }
};

/**
 * Lấy danh sách các đợt quét đơn hàng
 */
export const getScannedBatches = async (): Promise<any[]> => {
  try {
    return await db.scannedBatches.orderBy('createdAt').reverse().toArray();
  } catch (err) {
    console.error('Lỗi khi lấy danh sách đợt quét:', err);
    return [];
  }
};

/**
 * Lấy các đơn hàng thuộc một đợt quét
 */
export const getScannedOrdersByBatch = async (
  batchId: string,
): Promise<any[]> => {
  try {
    return await db.scannedOrders.where('batchId').equals(batchId).toArray();
  } catch (err) {
    console.error('Lỗi khi lấy đơn hàng theo đợt:', err);
    return [];
  }
};

/**
 * Xóa đợt quét
 */
export const deleteScannedBatch = async (batchId: string) => {
  try {
    await db.transaction(
      'rw',
      db.scannedBatches,
      db.scannedOrders,
      async () => {
        await db.scannedBatches.delete(batchId);
        await db.scannedOrders.where('batchId').equals(batchId).delete();
      },
    );
    return { success: true };
  } catch (err) {
    console.error('Lỗi khi xóa đợt quét:', err);
    throw err;
  }
};
