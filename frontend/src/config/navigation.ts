import { type ComponentType } from 'react';
import {
  LayoutGrid,
  ShoppingBag,
  ScanLine,
  RotateCcw,
  FileSpreadsheet,
  Package,
  PackagePlus,
  Warehouse,
  Receipt,
  Store,
  Building2,
  Users,
  ShieldAlert,
  Settings,
  Truck,
  CircleDollarSign,
} from 'lucide-react';

export interface NavItem {
  id: string;
  name: string;
  shortName: string;
  href: string;
  icon: ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  description: string;
  badge?: string;
  highlight?: boolean;
  colorScheme: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'blue' | 'cyan' | 'orange';
}

export interface NavGroup {
  id: string;
  title: string;
  description?: string;
  items: NavItem[];
}

export const navigationGroups: NavGroup[] = [
  {
    id: 'core-operations',
    title: 'Nghiệp vụ Đơn hàng & Xuất kho',
    description: 'Xử lý đơn sàn, quét mã vạch đóng gói và hàng hoàn',
    items: [
      {
        id: 'orders',
        name: 'Quản lý Đơn hàng',
        shortName: 'Đơn hàng',
        href: '/orders',
        icon: ShoppingBag,
        description: 'Tra cứu mã vận đơn, trạng thái sàn Shopee và kiểm tra xuất kho',
        colorScheme: 'blue',
      },
      {
        id: 'scan',
        name: 'Quét xuất hàng Shopee',
        shortName: 'Quét mã vạch',
        href: '/scan',
        icon: ScanLine,
        description: 'Quét barcode SPX/J&T/GHTK, kiểm tra đơn trùng và trừ tồn kho tự động',
        badge: 'SCAN',
        highlight: true,
        colorScheme: 'indigo',
      },
      {
        id: 'order-returns',
        name: 'Xử lý Đơn hoàn',
        shortName: 'Đơn hoàn',
        href: '/order-returns',
        icon: RotateCcw,
        description: 'Tiếp nhận kiện hàng hoàn, phân loại hàng bán lại / lỗi và nhập kho',
        colorScheme: 'amber',
      },
      {
        id: 'imports',
        name: 'Import Excel Shopee',
        shortName: 'Import file',
        href: '/imports',
        icon: FileSpreadsheet,
        description: 'Tải lên bảng kê đơn hàng Shopee để đồng bộ doanh thu & đơn phát sinh',
        colorScheme: 'emerald',
      },
    ],
  },
  {
    id: 'inventory-products',
    title: 'Kho & Sản phẩm',
    description: 'Kiểm soát số dư thực có, sổ cái biến động và nhập kho',
    items: [
      {
        id: 'products',
        name: 'Sản phẩm & Biến thể SKU',
        shortName: 'Sản phẩm & SKU',
        href: '/products',
        icon: Package,
        description: 'Danh mục SKU kho, liên kết phân loại hàng Shopee và cài đặt giá vốn',
        colorScheme: 'purple',
      },
      {
        id: 'inventory',
        name: 'Kho & Sổ cái Tồn kho',
        shortName: 'Tồn kho',
        href: '/inventory',
        icon: Warehouse,
        description: 'Báo cáo tồn thực có (onHand), hàng giữ và đối soát sổ cái kho bất biến',
        colorScheme: 'indigo',
      },
      {
        id: 'purchase-receipts',
        name: 'Nhập kho (Phiếu nhập NCC)',
        shortName: 'Phiếu nhập kho',
        href: '/purchase-receipts',
        icon: PackagePlus,
        description: 'Khởi tạo phiếu nhập hàng từ NCC, theo dõi lô date và công nợ mua',
        colorScheme: 'cyan',
      },
      {
        id: 'suppliers',
        name: 'Danh bạ Nhà cung cấp',
        shortName: 'Nhà cung cấp',
        href: '/suppliers',
        icon: Truck,
        description: 'Quản lý thông tin nhà phân phối, tài khoản ngân hàng và công nợ',
        colorScheme: 'orange',
      },
    ],
  },
  {
    id: 'finance-shops',
    title: 'Tài chính & Gian hàng',
    description: 'Dòng tiền thu chi, công nợ và quyết toán sàn Shopee',
    items: [
      {
        id: 'cashflow',
        name: 'Thu chi & Sổ quỹ',
        shortName: 'Sổ thu chi',
        href: '/cashflow',
        icon: CircleDollarSign,
        description: 'Quản lý quỹ tiền mặt, tài khoản ngân hàng và đối soát thanh toán COD',
        badge: 'QUỸ',
        highlight: true,
        colorScheme: 'emerald',
      },
      {
        id: 'supplier-debts',
        name: 'Công nợ Nhà cung cấp',
        shortName: 'Công nợ NCC',
        href: '/supplier-debts',
        icon: Building2,
        description: 'Theo dõi tổng nợ NCC, hạn thanh toán và lập phiếu chi trả nợ',
        colorScheme: 'rose',
      },
      {
        id: 'settlements',
        name: 'Đối soát tài chính Shopee',
        shortName: 'Đối soát sàn',
        href: '/settlements',
        icon: Receipt,
        description: 'Quyết toán Shopee, so khớp doanh thu, phí sàn và tiền về tài khoản',
        colorScheme: 'indigo',
      },
      {
        id: 'shops',
        name: 'Quản lý Gian hàng Shopee',
        shortName: 'Gian hàng',
        href: '/shops',
        icon: Store,
        description: 'Kết nối và quản lý danh sách shop Shopee, cấu hình kho xuất mặc định',
        colorScheme: 'orange',
      },
    ],
  },
  {
    id: 'system-admin',
    title: 'Hệ thống & Quyền hạn',
    description: 'Phân quyền người dùng, nhật ký hoạt động và cấu hình',
    items: [
      {
        id: 'dashboard',
        name: 'Tổng quan Dashboard',
        shortName: 'Tổng quan',
        href: '/',
        icon: LayoutGrid,
        description: 'Báo cáo hiệu quả kinh doanh, tỷ lệ giao hàng và biểu đồ doanh thu',
        colorScheme: 'blue',
      },
      {
        id: 'members',
        name: 'Thành viên & Phân quyền',
        shortName: 'Thành viên',
        href: '/members',
        icon: Users,
        description: 'Quản lý nhân viên kho, kế toán, quản lý shop và quyền hạn workspace',
        colorScheme: 'purple',
      },
      {
        id: 'audit',
        name: 'Nhật ký kiểm toán',
        shortName: 'Kiểm toán',
        href: '/audit',
        icon: ShieldAlert,
        description: 'Lịch sử thao tác tạo/sửa/xóa, IP truy cập và nhật ký bảo mật',
        colorScheme: 'rose',
      },
      {
        id: 'settings',
        name: 'Cài đặt hệ thống & Kho',
        shortName: 'Cài đặt',
        href: '/settings',
        icon: Settings,
        description: 'Thiết lập danh mục kho xuất, quy tắc kiểm tra và thông số vận hành',
        colorScheme: 'indigo',
      },
    ],
  },
];

// Helper to get all items flat
export const allNavItems: NavItem[] = navigationGroups.flatMap((g) => g.items);
