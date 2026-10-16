import { create } from 'zustand';
import type { Shop, Warehouse } from '../types';

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
  selectedShopId: 'ALL',
  selectedWarehouseId: '',
  shops: [],
  warehouses: [],
  isLoadingContext: false,

  setSelectedShopId: (shopId: string) => set({ selectedShopId: shopId }),
  setSelectedWarehouseId: (warehouseId: string) => set({ selectedWarehouseId: warehouseId }),

  setContextData: ({ shops, warehouses }) => {
    const currentWhId = get().selectedWarehouseId;
    let nextWhId = currentWhId;
    if (warehouses && warehouses.length > 0 && (!currentWhId || !warehouses.find((w) => w.id === currentWhId))) {
      nextWhId = warehouses[0].id;
    }

    set({
      shops: shops || [],
      warehouses: warehouses || [],
      selectedWarehouseId: nextWhId,
    });
  },

  resetWorkspaceContext: () =>
    set({
      selectedShopId: 'ALL',
      selectedWarehouseId: '',
      shops: [],
      warehouses: [],
    }),
}));
