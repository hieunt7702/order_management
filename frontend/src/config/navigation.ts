import { type ComponentType } from 'react';
import {
  Home,
  FileText,
  ShoppingBag,
  ScanLine,
  RotateCcw,
  Package,
  Warehouse,
  PackagePlus,
  Truck,
  Coins,
  CreditCard,
  Receipt,
  Store,
  Users,
  Settings,
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
    title: 'NGHIỆP VỤ CHÍNH',
    description: 'Xử lý đơn sàn, quét mã vạch đóng gói và hàng hoàn',
    items: [
      {
        id: 'orders',
        name: 'Đơn hàng',
        shortName: 'Đơn hàng',
        href: '/orders',
        icon: FileText,
        description: 'Tra cứu mã vận đơn, trạng thái sàn Shopee và kiểm tra xuất kho',
        colorScheme: 'blue',
      },
      {
        id: 'scan',
        name: 'Quét xuất hàng',
        shortName: 'Quét xuất hàng',
        href: '/scan',
        icon: ScanLine,
        description: 'Quét barcode SPX/J&T/GHTK, kiểm tra đơn trùng và trừ tồn kho tự động',
        badge: 'SCAN',
        highlight: true,
        colorScheme: 'indigo',
      },
      {
        id: 'order-returns',
        name: 'Xử lý đơn hoàn',
        shortName: 'Xử lý đơn hoàn',
        href: '/order-returns',
        icon: RotateCcw,
        description: 'Tiếp nhận kiện hàng hoàn, phân loại hàng bán lại / lỗi và nhập kho',
        colorScheme: 'amber',
      },
      {
        id: 'imports',
        name: 'Import Shopee',
        shortName: 'Import Shopee',
        href: '/imports',
        icon: ShoppingBag,
        description: 'Tải lên bảng kê đơn hàng Shopee để đồng bộ doanh thu & đơn phát sinh',
        colorScheme: 'emerald',
      },
    ],
  },
  {
    id: 'inventory-products',
    title: 'KHO & SẢN PHẨM',
    description: 'Kiểm soát số lượng tồn thực tế, lịch sử xuất nhập và kiểm kho',
    items: [
      {
        id: 'products',
        name: 'Sản phẩm & SKU',
        shortName: 'Sản phẩm & SKU',
        href: '/products',
        icon: Package,
        description: 'Danh mục SKU kho, liên kết phân loại hàng Shopee và cài đặt giá vốn',
        colorScheme: 'purple',
      },
      {
        id: 'inventory',
        name: 'Kho & tồn kho',
        shortName: 'Kho & tồn kho',
        href: '/inventory',
        icon: Warehouse,
        description: 'Theo dõi tồn kho thực tế, hàng giữ cho đơn và đối soát lệch kho',
        colorScheme: 'indigo',
      },
      {
        id: 'purchase-receipts',
        name: 'Nhập kho',
        shortName: 'Nhập kho',
        href: '/purchase-receipts',
        icon: PackagePlus,
        description: 'Khởi tạo phiếu nhập hàng từ NCC, theo dõi lô date và công nợ mua',
        colorScheme: 'cyan',
      },
      {
        id: 'suppliers',
        name: 'Nhà cung cấp',
        shortName: 'Nhà cung cấp',
        href: '/suppliers',
        icon: Users,
        description: 'Quản lý thông tin nhà phân phối, tài khoản ngân hàng và công nợ',
        colorScheme: 'orange',
      },
    ],
  },
  {
    id: 'finance-shops',
    title: 'TÀI CHÍNH & SHOP',
    description: 'Dòng tiền thu chi, công nợ và quyết toán sàn Shopee',
    items: [
      {
        id: 'cashflow',
        name: 'Thu chi & đối soát tiền',
        shortName: 'Thu chi & đối soát tiền',
        href: '/cashflow',
        icon: Coins,
        description: 'Quản lý quỹ tiền mặt, tài khoản ngân hàng và đối soát thanh toán COD',
        badge: 'QUỸ',
        highlight: true,
        colorScheme: 'emerald',
      },
      {
        id: 'supplier-debts',
        name: 'Công nợ nhà cung cấp',
        shortName: 'Công nợ nhà cung cấp',
        href: '/supplier-debts',
        icon: CreditCard,
        description: 'Theo dõi tổng nợ NCC, hạn thanh toán và lập phiếu chi trả nợ',
        colorScheme: 'rose',
      },
      {
        id: 'settlements',
        name: 'Đối soát tài chính',
        shortName: 'Đối soát tài chính',
        href: '/settlements',
        icon: Receipt,
        description: 'Quyết toán Shopee, so khớp doanh thu, phí sàn và tiền về tài khoản',
        colorScheme: 'indigo',
      },
      {
        id: 'shops',
        name: 'Quản lý shop',
        shortName: 'Quản lý shop',
        href: '/shops',
        icon: Store,
        description: 'Kết nối và quản lý danh sách shop Shopee, cấu hình kho xuất mặc định',
        colorScheme: 'orange',
      },
    ],
  },
  {
    id: 'system-admin',
    title: 'HỆ THỐNG & QUYỀN',
    description: 'Phân quyền người dùng, nhật ký hoạt động và cấu hình',
    items: [
      {
        id: 'dashboard',
        name: 'Tổng quan',
        shortName: 'Tổng quan',
        href: '/',
        icon: Home,
        description: 'Trang chủ tổng quan hệ thống và các chức năng',
        colorScheme: 'indigo',
      },
      {
        id: 'members',
        name: 'Thành viên & quyền',
        shortName: 'Thành viên & quyền',
        href: '/members',
        icon: Users,
        description: 'Quản lý nhân viên kho, kế toán, quản lý shop và quyền hạn workspace',
        colorScheme: 'purple',
      },
      {
        id: 'audit',
        name: 'Nhật ký kiểm toán',
        shortName: 'Nhật ký kiểm toán',
        href: '/audit',
        icon: FileText,
        description: 'Lịch sử thao tác tạo/sửa/xóa, IP truy cập và nhật ký bảo mật',
        colorScheme: 'rose',
      },
      {
        id: 'settings',
        name: 'Cài đặt hệ thống',
        shortName: 'Cài đặt hệ thống',
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
