import React from 'react';

export interface MovementTypeConfig {
  label: string;
  shortLabel: string;
  badgeClass: string;
  description: string;
}

export const MOVEMENT_TYPE_CONFIG: Record<string, MovementTypeConfig> = {
  RECEIVE: {
    label: 'Nhập kho NCC',
    shortLabel: 'Nhập NCC',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    description: 'Nhập hàng từ nhà cung cấp',
  },
  BORROW_RECEIVE: {
    label: 'Mượn hàng NCC',
    shortLabel: 'Nhập mượn',
    badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    description: 'Nhận mượn hàng từ nhà cung cấp',
  },
  BORROW_RETURN: {
    label: 'Cho mượn / Trả mượn',
    shortLabel: 'Trả mượn',
    badgeClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
    description: 'Xuất trả hàng mượn hoặc cho mượn',
  },
  DISPATCH: {
    label: 'Xuất kho bán',
    shortLabel: 'Xuất bán',
    badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    description: 'Xuất kho bàn giao vận chuyển đơn hàng',
  },
  RETURN_RECEIVE: {
    label: 'Khách hoàn (Đạt chuẩn)',
    shortLabel: 'Hoàn đạt',
    badgeClass: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
    description: 'Nhập hàng hoàn khách đạt chuẩn tái bán',
  },
  RETURN_DAMAGE: {
    label: 'Khách hoàn (Hàng lỗi)',
    shortLabel: 'Hoàn lỗi',
    badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    description: 'Nhập hàng hoàn khách bị móp méo/lỗi/hỏng',
  },
  PURCHASE_RETURN: {
    label: 'Xuất trả NCC',
    shortLabel: 'Trả NCC',
    badgeClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
    description: 'Xuất trả hàng lỗi hoặc tồn cho nhà cung cấp',
  },
  ADJUST: {
    label: 'Điều chỉnh kiểm kê',
    shortLabel: 'Kiểm kê',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    description: 'Điều chỉnh chênh lệch tồn kho sau kiểm kê',
  },
  STATUS_CONVERT: {
    label: 'Chuyển trạng thái hàng',
    shortLabel: 'Chuyển TT',
    badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    description: 'Chuyển đổi trạng thái lưu kho (chờ kiểm -> đạt/lỗi)',
  },
  SCRAP_DISPOSAL: {
    label: 'Xuất hủy / Mất hàng',
    shortLabel: 'Xuất hủy',
    badgeClass: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
    description: 'Xuất hủy hàng hỏng vỡ hoặc ghi nhận mất mát',
  },
  OPENING_BALANCE: {
    label: 'Số dư đầu kỳ',
    shortLabel: 'Đầu kỳ',
    badgeClass: 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30',
    description: 'Khởi tạo số dư tồn kho ban đầu',
  },
  RESERVE: {
    label: 'Giữ hàng cho đơn',
    shortLabel: 'Giữ hàng',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    description: 'Tạm giữ tồn cho đơn hàng đang xử lý',
  },
  RELEASE: {
    label: 'Hủy giữ hàng đơn',
    shortLabel: 'Hủy giữ',
    badgeClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
    description: 'Giải phóng tồn kho khi đơn bị hủy',
  },
};

export function getMovementTypeConfig(rawType?: string, deltaOnHand: number = 0): MovementTypeConfig {
  if (rawType && MOVEMENT_TYPE_CONFIG[rawType]) {
    return MOVEMENT_TYPE_CONFIG[rawType];
  }
  if (deltaOnHand > 0) {
    return {
      label: 'Nhập kho (+)',
      shortLabel: 'Nhập kho',
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      description: 'Nhập kho ghi nhận tăng tồn',
    };
  }
  if (deltaOnHand < 0) {
    return {
      label: 'Xuất kho (-)',
      shortLabel: 'Xuất kho',
      badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      description: 'Xuất kho ghi nhận giảm tồn',
    };
  }
  return {
    label: 'Biến động kho',
    shortLabel: 'Biến động',
    badgeClass: 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30',
    description: 'Bút toán ghi nhận biến động kho',
  };
}

export const MovementTypeBadge: React.FC<{
  type?: string;
  delta?: number;
  className?: string;
}> = ({ type, delta = 0, className = '' }) => {
  const config = getMovementTypeConfig(type, delta);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${config.badgeClass} ${className}`}
      title={config.description}
    >
      {config.label}
    </span>
  );
};

export const LEDGER_REASON_MAP: Record<string, string> = {
  INVENTORY_CHECK_DISCREPANCY: 'Kiểm kê định kỳ phát hiện chênh lệch',
  DAMAGE: 'Hàng hỏng vỡ, lỗi trong quá trình bảo quản',
  LOSS: 'Mất mát, thất thoát không rõ nguyên nhân',
  CORRECTION: 'Bút toán điều chỉnh sai sót nhập liệu',
  MANUAL_ADJUST: 'Điều chỉnh tồn kho thủ công',
  INITIAL_STOCK: 'Tồn kho ban đầu',
  OPENING_BALANCE: 'Số dư đầu kỳ',
  BORROW_RECEIVE: 'Nhập mượn hàng NCC',
  BORROW_RETURN: 'Xuất trả mượn hàng NCC',
  DISPATCH: 'Xuất kho giao hàng',
  RETURN_RECEIVE: 'Nhập hàng hoàn đạt chuẩn',
  RETURN_DAMAGE: 'Nhập hàng hoàn lỗi/hỏng',
  SCRAP_DISPOSAL: 'Xuất hủy hàng lỗi',
  STATUS_CONVERT: 'Chuyển trạng thái hàng',
  RECEIVE: 'Nhập kho nhà cung cấp',
  RESERVE: 'Giữ hàng cho đơn',
  RELEASE: 'Hủy giữ hàng đơn',
  SELLER_CANCELLED: 'Người bán hủy đơn',
  BUYER_CANCELLED: 'Người mua hủy đơn',
  DAMAGED: 'Hàng lỗi / hỏng',
  PENDING_INSPECTION: 'Chờ kiểm tra',
  SELLABLE: 'Đủ điều kiện bán',
};

export function formatLedgerNote(note?: string | null): string {
  if (!note) return '';
  const str = note.trim();
  if (!str) return '';

  // Exact match
  if (LEDGER_REASON_MAP[str]) {
    return LEDGER_REASON_MAP[str];
  }

  // Starts with "ENUM:" or "ENUM -" or "ENUM: "
  for (const [key, label] of Object.entries(LEDGER_REASON_MAP)) {
    if (str.startsWith(`${key}:`)) {
      const rest = str.substring(key.length + 1).trim();
      return rest ? `${label}: ${rest}` : label;
    }
    if (str.startsWith(`${key} -`)) {
      const rest = str.substring(key.length + 2).trim();
      return rest ? `${label} - ${rest}` : label;
    }
    if (str.startsWith(`${key} `)) {
      const rest = str.substring(key.length + 1).trim();
      return rest ? `${label} ${rest}` : label;
    }
  }

  return str;
}

export function formatStockState(state?: string | null): string {
  if (!state) return 'Đủ điều kiện bán';
  switch (state) {
    case 'SELLABLE':
      return 'Đủ điều kiện bán';
    case 'DAMAGED':
      return 'Hàng lỗi / hỏng';
    case 'PENDING_INSPECTION':
      return 'Chờ kiểm tra';
    default:
      return state;
  }
}
