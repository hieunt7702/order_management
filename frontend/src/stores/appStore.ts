import { create } from 'zustand';

export type DataSource = 'all' | 'file' | 'time' | string;

export interface DateRange {
  startDate: string | null;
  endDate: string | null;
}

export interface AppState {
  dataSource: DataSource;
  selectedFileId: string | null;
  dateRange: DateRange;
  setDataSource: (source: DataSource) => void;
  setSelectedFileId: (id: string | null) => void;
  setDateRange: (start: string | null, end: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Nguồn dữ liệu: 'all', 'file', 'time'
  dataSource: 'all',

  // Dành cho lọc theo file
  selectedFileId: null,

  // Dành cho lọc theo thời gian
  dateRange: {
    startDate: null,
    endDate: null,
  },

  setDataSource: (source) => set({ dataSource: source }),
  setSelectedFileId: (id) => set({ selectedFileId: id }),
  setDateRange: (start, end) => set({ dateRange: { startDate: start, endDate: end } }),
}));
