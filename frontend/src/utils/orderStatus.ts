/**
 * Order Status Definitions & Vietnamese Label Mappings
 * Strictly aligns with Shopee platform lifecycle and internal warehouse fulfillment state machine.
 */

export interface StatusConfigItem {
  label: string;
  color: string;
  badgeClass: string;
  shopeeText: string;
}

// 1. Shopee Platform Order Status
export const PLATFORM_STATUS_CONFIG: Record<string, StatusConfigItem> = {
  COMPLETED: {
    label: 'Hoàn thành',
    color: '#10b981',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
    shopeeText: 'Hoàn thành',
  },
  TO_CONFIRM_RECEIVE: {
    label: 'Đã giao',
    color: '#0ea5e9',
    badgeClass:
      'bg-sky-50 text-sky-700 border border-sky-200/80 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30',
    shopeeText: 'Người mua đã nhận hàng / Đã giao',
  },
  SHIPPED: {
    label: 'Đang giao',
    color: '#6366f1',
    badgeClass:
      'bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/30',
    shopeeText: 'Đang giao hàng',
  },
  READY_TO_SHIP: {
    label: 'Chờ giao hàng',
    color: '#f59e0b',
    badgeClass:
      'bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
    shopeeText: 'Chờ giao hàng',
  },
  CANCELLED: {
    label: 'Đã hủy',
    color: '#ef4444',
    badgeClass:
      'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
    shopeeText: 'Đã hủy',
  },
  TO_RETURN: {
    label: 'Trả hàng/Hoàn tiền',
    color: '#a855f7',
    badgeClass:
      'bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30',
    shopeeText: 'Yêu cầu Trả hàng/Hoàn tiền',
  },
  RETURN_REFUND: {
    label: 'Đã trả hàng/Hoàn tiền',
    color: '#9333ea',
    badgeClass:
      'bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30',
    shopeeText: 'Đã hoàn tiền',
  },
  UNPAID: {
    label: 'Chưa thanh toán',
    color: '#6b7280',
    badgeClass:
      'bg-gray-100 text-gray-700 border border-gray-200/80 dark:bg-gray-800/70 dark:text-gray-300 dark:border-gray-700/50',
    shopeeText: 'Chưa thanh toán',
  },
  IN_CANCEL: {
    label: 'Chờ xác nhận hủy',
    color: '#f97316',
    badgeClass:
      'bg-orange-50 text-orange-700 border border-orange-200/80 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30',
    shopeeText: 'Chờ người bán duyệt hủy',
  },
};

export const FULFILLMENT_STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; step: number; color: string }
> = {
  UNFULFILLED: {
    label: 'Chưa xử lý',
    badgeClass:
      'bg-slate-100 text-slate-700 border border-slate-200/80 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/40',
    step: 0,
    color: '#64748b',
  },
  ALLOCATED: {
    label: 'Đã giữ tồn',
    badgeClass:
      'bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
    step: 1,
    color: '#3b82f6',
  },
  PICKED: {
    label: 'Đã nhặt hàng',
    badgeClass:
      'bg-cyan-50 text-cyan-700 border border-cyan-200/80 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-500/30',
    step: 2,
    color: '#06b6d4',
  },
  PACKED: {
    label: 'Đã đóng gói',
    badgeClass:
      'bg-teal-50 text-teal-700 border border-teal-200/80 dark:bg-teal-500/15 dark:text-teal-400 dark:border-teal-500/30',
    step: 3,
    color: '#14b8a6',
  },
  DISPATCHED: {
    label: 'Đã xuất kho bàn giao',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
    step: 4,
    color: '#10b981',
  },
  CANCELLED: {
    label: 'Đã hủy',
    badgeClass:
      'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
    step: -1,
    color: '#ef4444',
  },
  RETURNED: {
    label: 'Đã nhận hoàn kho',
    badgeClass:
      'bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30',
    step: -2,
    color: '#a855f7',
  },
};

export interface VerificationStatusConfigItem {
  label: string;
  badgeClass: string;
  iconType: 'not_verified' | 'partially_verified' | 'verified' | 'discrepancy';
  color: string;
}

export const VERIFICATION_STATUS_CONFIG: Record<
  string,
  VerificationStatusConfigItem
> = {
  NOT_VERIFIED: {
    label: 'Chưa quét kiểm kho',
    badgeClass:
      'bg-slate-100 text-slate-600 border border-slate-200/70 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700/50',
    iconType: 'not_verified',
    color: '#94a3b8',
  },
  PENDING: {
    label: 'Chưa quét kiểm kho',
    badgeClass:
      'bg-slate-100 text-slate-600 border border-slate-200/70 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700/50',
    iconType: 'not_verified',
    color: '#94a3b8',
  },
  PARTIALLY_VERIFIED: {
    label: 'Quét thiếu / 1 phần',
    badgeClass:
      'bg-amber-50 text-amber-700 border border-amber-200/70 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
    iconType: 'partially_verified',
    color: '#f59e0b',
  },
  PARTIAL: {
    label: 'Quét thiếu / 1 phần',
    badgeClass:
      'bg-amber-50 text-amber-700 border border-amber-200/70 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
    iconType: 'partially_verified',
    color: '#f59e0b',
  },
  VERIFIED: {
    label: 'Đã quét khớp 100%',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
    iconType: 'verified',
    color: '#10b981',
  },
  MATCHED: {
    label: 'Đã quét khớp 100%',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
    iconType: 'verified',
    color: '#10b981',
  },
  DISCREPANCY: {
    label: 'Lỗi / Sai lệch quét',
    badgeClass:
      'bg-rose-50 text-rose-700 border border-rose-200/70 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
    iconType: 'discrepancy',
    color: '#ef4444',
  },
};

export function getPlatformStatusMeta(rawStatus?: string | null): StatusConfigItem {
  if (!rawStatus) {
    return {
      label: 'Không xác định',
      color: '#94a3b8',
      badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      shopeeText: 'N/A',
    };
  }
  const key = rawStatus.toUpperCase();
  return (
    PLATFORM_STATUS_CONFIG[key] || {
      label: rawStatus,
      color: '#64748b',
      badgeClass:
        'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300',
      shopeeText: rawStatus,
    }
  );
}

export function getFulfillmentStatusMeta(rawStatus?: string | null) {
  if (!rawStatus) {
    return FULFILLMENT_STATUS_CONFIG.UNFULFILLED;
  }
  const key = rawStatus.toUpperCase();
  return (
    FULFILLMENT_STATUS_CONFIG[key] || {
      label: rawStatus,
      badgeClass:
        'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300',
      step: 0,
      color: '#64748b',
    }
  );
}

export function getVerificationStatusMeta(rawStatus?: string | null): VerificationStatusConfigItem {
  if (!rawStatus) return VERIFICATION_STATUS_CONFIG.NOT_VERIFIED;
  const key = rawStatus.toUpperCase();
  return (
    VERIFICATION_STATUS_CONFIG[key] || {
      label: rawStatus === 'NOT_VERIFIED' ? 'Chưa quét kiểm kho' : rawStatus,
      badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      iconType: 'not_verified',
      color: '#94a3b8',
    }
  );
}

export const getPlatformStatusConfig = getPlatformStatusMeta;
export const getFulfillmentStatusConfig = getFulfillmentStatusMeta;
export const getVerificationStatusConfig = getVerificationStatusMeta;

