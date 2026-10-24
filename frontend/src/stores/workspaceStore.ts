import { create } from 'zustand';
import type { Shop, Warehouse } from '../types';

const STORAGE_KEY_SHOP = 'shopee_selected_shop_id';
const STORAGE_KEY_WAREHOUSE = 'shopee_selected_warehouse_id';

const getSavedShopId = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SHOP);
    if (saved) return saved;
  } catch (e) {
    console.warn('Failed to read saved shop from localStorage', e);
  }
  return 'ALL';
};

const getSavedWarehouseId = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_WAREHOUSE);
    if (saved) return saved;
  } catch (e) {
    console.warn('Failed to read saved warehouse from localStorage', e);
  }
  return '';
};

export interface WorkspaceState {
  selectedShopId: string;
  selectedWarehouseId: string;
  shops: Shop[];
  warehouses: Warehouse[];
  isLoadingContext: boolean;
  setSelectedShopId: (shopId: string) => void;
  setSelectedWarehouseId: (warehouseId: string) => void;
  setContextData: (data: { shops?: Shop[]; warehouses?: Warehouse[] }) => void;
  resetWorkspaceContext: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  selectedShopId: getSavedShopId(),
  selectedWarehouseId: getSavedWarehouseId(),
  shops: [],
  warehouses: [],
  isLoadingContext: false,

  setSelectedShopId: (shopId: string) => {
    try {
      if (shopId) {
        localStorage.setItem(STORAGE_KEY_SHOP, shopId);
      } else {
        localStorage.removeItem(STORAGE_KEY_SHOP);
      }
    } catch (e) {
      console.warn('Failed to save shop to localStorage', e);
    }
    set({ selectedShopId: shopId || 'ALL' });
  },

  setSelectedWarehouseId: (warehouseId: string) => {
    try {
      if (warehouseId) {
        localStorage.setItem(STORAGE_KEY_WAREHOUSE, warehouseId);
      } else {
        localStorage.removeItem(STORAGE_KEY_WAREHOUSE);
      }
    } catch (e) {
      console.warn('Failed to save warehouse to localStorage', e);
    }
    set({ selectedWarehouseId: warehouseId || '' });
  },

  setContextData: ({ shops, warehouses }) => {
    const currentWhId = get().selectedWarehouseId;
    let nextWhId = currentWhId;
    if (warehouses && warehouses.length > 0 && (!currentWhId || !warehouses.find((w) => w.id === currentWhId))) {
      nextWhId = warehouses[0].id;
    }

    const currentShopId = get().selectedShopId;
    let nextShopId = currentShopId;
    // Validate if currentShopId exists in shops list when shops are loaded
    if (currentShopId && currentShopId !== 'ALL' && shops && shops.length > 0) {
      const exists = shops.some((s) => s.id === currentShopId);
      if (!exists) {
        nextShopId = 'ALL';
        try {
          localStorage.setItem(STORAGE_KEY_SHOP, 'ALL');
        } catch (e) {}
      }
    }

    set({
      shops: shops || [],
      warehouses: warehouses || [],
      selectedWarehouseId: nextWhId,
      selectedShopId: nextShopId,
    });
  },

  resetWorkspaceContext: () => {
    try {
      localStorage.removeItem(STORAGE_KEY_SHOP);
      localStorage.removeItem(STORAGE_KEY_WAREHOUSE);
    } catch (e) {}
    set({
      selectedShopId: 'ALL',
      selectedWarehouseId: '',
      shops: [],
      warehouses: [],
    });
  },
}));

