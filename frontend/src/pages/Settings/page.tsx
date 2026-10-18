import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Warehouse,
  Building2,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Volume2,
  Scan,
  MapPin,
  Phone,
  Store,
  Moon,
  Sun,
  LogOut,
  User as UserIcon,
  Compass,
  ShieldAlert,
} from 'lucide-react';
import { warehousesApi } from '../../services/warehousesApi';
import { shopsApi } from '../../services/shopsApi';
import { systemApi } from '../../services/systemApi';
import { useAuthStore } from '../../stores/authStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useNavigationStore } from '../../stores/navigationStore';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Checkbox } from '../../components/ui/Checkbox';
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '../../components/ui/Card';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import {
  SystemThead,
  SystemTh,
  SystemTbody,
  SystemTr,
  SystemTd,
} from '../../components/ui/SystemTable';
import { toast } from '../../components/ui/Toast';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, currentTenant, logout } = useAuthStore();
  const {
    selectedShopId,
    setSelectedShopId,
    selectedWarehouseId,
    setSelectedWarehouseId,
    shops,
    warehouses,
    setContextData,
  } = useWorkspaceStore();
  const openMobileMenu = useNavigationStore((s) => s.openMobileMenu);

  const [, setIsLoadingWh] = useState<boolean>(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState<boolean>(false);

  // Modals
  const [isCreateWhModalOpen, setIsCreateWhModalOpen] = useState<boolean>(false);
  const [isEditWhModalOpen, setIsEditWhModalOpen] = useState<boolean>(false);
  const [selectedWhForEdit, setSelectedWhForEdit] = useState<any>(null);
  const [isDeleteWhModalOpen, setIsDeleteWhModalOpen] = useState<boolean>(false);
  const [selectedWhForDelete, setSelectedWhForDelete] = useState<any>(null);
  const [isDeletingWh, setIsDeletingWh] = useState<boolean>(false);

  // Clear Data Modal State
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState<boolean>(false);
  const [isClearingData, setIsClearingData] = useState<boolean>(false);
  const [clearOrders, setClearOrders] = useState<boolean>(true);
  const [clearPurchaseReceipts, setClearPurchaseReceipts] = useState<boolean>(true);
  const [clearCashflow, setClearCashflow] = useState<boolean>(true);
  const [clearProducts, setClearProducts] = useState<boolean>(false);
  const [clearSuppliers, setClearSuppliers] = useState<boolean>(false);
  const [confirmClearText, setConfirmClearText] = useState<string>('');

  // Theme preferences
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  // Forms
  const [createWhForm, setCreateWhForm] = useState({
    code: '',
    name: '',
    address: '',
    phone: '',
  });

  const [editWhForm, setEditWhForm] = useState({
    name: '',
    address: '',
    phone: '',
    isActive: true,
  });

  // Scanner preferences
  const [scannerSound, setScannerSound] = useState<boolean>(true);
  const [autoSelectNext, setAutoSelectNext] = useState<boolean>(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    loadContextData();
  }, []);

  const loadContextData = async () => {
    setIsLoadingWh(true);
    try {
      const [fetchedShops, fetchedWhs] = await Promise.all([
        shopsApi.findAll(),
        warehousesApi.findAll(),
      ]);
      setContextData({ shops: fetchedShops || [], warehouses: fetchedWhs || [] });
    } catch (err) {
      console.error('Error loading context data:', err);
    } finally {
      setIsLoadingWh(false);
    }
  };

  const loadWarehouses = loadContextData;

  const setTheme = (targetDark: boolean) => {
    if (!(document as any).startViewTransition) {
      document.documentElement.classList.toggle('dark', targetDark);
      setIsDark(targetDark);
      localStorage.setItem('theme', targetDark ? 'dark' : 'light');
      return;
    }
    (document as any).startViewTransition(() => {
      document.documentElement.classList.toggle('dark', targetDark);
      setIsDark(targetDark);
      localStorage.setItem('theme', targetDark ? 'dark' : 'light');
    });
  };

  const handleLogout = () => {
    setIsLogoutModalOpen(false);
    logout();
    navigate('/login');
    toast.success('Đã đăng xuất tài khoản');
  };

  const handleClearData = async () => {
    if (confirmClearText.trim().toUpperCase() !== 'CONFIRM') {
      toast.warning('Vui lòng nhập chính xác "CONFIRM" để xác nhận');
      return;
    }

    if (!clearOrders && !clearPurchaseReceipts && !clearCashflow && !clearProducts && !clearSuppliers) {
      toast.warning('Vui lòng chọn ít nhất 1 nhóm dữ liệu cần xóa');
      return;
    }

    setIsClearingData(true);
    try {
      const res = await systemApi.clearData({
        clearOrders,
        clearPurchaseReceipts,
        clearCashflow,
        clearProducts,
        clearSuppliers,
      });
      toast.success(res.message || 'Đã xóa dữ liệu thành công!');
      setIsClearDataModalOpen(false);
      setConfirmClearText('');
      await loadContextData();
    } catch (err: any) {
      toast.error(err.message || 'Không thể xóa dữ liệu hệ thống');
    } finally {
      setIsClearingData(false);
    }
  };

  const handleCreateWhSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createWhForm.code || !createWhForm.name) {
      toast.warning('Vui lòng nhập mã kho và tên kho');
      return;
    }
    try {
      await warehousesApi.create({
        code: createWhForm.code.trim().toUpperCase(),
        name: createWhForm.name.trim(),
        address: createWhForm.address.trim() || undefined,
        phone: createWhForm.phone.trim() || undefined,
      });
      setIsCreateWhModalOpen(false);
      setCreateWhForm({ code: '', name: '', address: '', phone: '' });
      toast.success('Tạo kho hàng mới thành công!');
      loadWarehouses();
    } catch (err: any) {
      toast.error('Lỗi tạo kho', err.message);
    }
  };

  const handleOpenEditWh = (wh: any) => {
    setSelectedWhForEdit(wh);
    setEditWhForm({
      name: wh.name,
      address: wh.address || '',
      phone: wh.phone || '',
      isActive: wh.status ? wh.status === 'ACTIVE' : (wh.isActive ?? true),
    });
    setIsEditWhModalOpen(true);
  };

  const handleEditWhSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWhForEdit) return;
    try {
      await warehousesApi.update(selectedWhForEdit.id, {
        name: editWhForm.name.trim(),
        address: editWhForm.address.trim() || undefined,
        phone: editWhForm.phone.trim() || undefined,
        isActive: editWhForm.isActive,
      });
      setIsEditWhModalOpen(false);
      toast.success('Cập nhật thông tin kho thành công!');
      loadWarehouses();
    } catch (err: any) {
      toast.error('Lỗi cập nhật kho', err.message);
    }
  };

  const handleOpenDeleteWh = (wh: any) => {
    setSelectedWhForDelete(wh);
    setIsDeleteWhModalOpen(true);
  };

  const handleDeleteWhSubmit = async () => {
    if (!selectedWhForDelete) return;
    setIsDeletingWh(true);
    try {
      await warehousesApi.delete(selectedWhForDelete.id);
      setIsDeleteWhModalOpen(false);
      setSelectedWhForDelete(null);
      toast.success('Xóa kho hàng thành công!');
      loadWarehouses();
    } catch (err: any) {
      toast.error('Lỗi xóa kho hàng', err.message || 'Không thể xóa kho hàng');
    } finally {
      setIsDeletingWh(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-fit md:min-h-0 space-y-3.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#5865f2]/10 dark:bg-[#5865f2]/20 flex items-center justify-center text-[#5865f2] shrink-0">
            <Settings size={18} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-base font-medium text-gray-900 dark:text-white leading-tight">
              Cài đặt hệ thống
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Tài khoản, cửa hàng, kho xử lý, chủ đề giao diện và thông số vận hành
            </p>
          </div>
        </div>

        {/* Mobile & Tablet Drawer Menu Shortcut */}
        <Button
          variant="outline"
          size="sm"
          onClick={openMobileMenu}
          className="lg:hidden gap-1.5 text-xs text-gray-700 dark:text-gray-200 self-start sm:self-auto"
        >
          <Compass size={14} className="text-[#5865f2]" />
          <span>Tất cả tính năng</span>
        </Button>
      </div>

      {/* 1. USER ACCOUNT & LOGOUT CARD */}
      <Card className="shrink-0">
        <CardHeader className="py-2.5 px-3.5 sm:py-3 sm:px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <UserIcon size={16} className="text-[#5865f2]" /> Tài khoản người dùng
          </CardTitle>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLogoutModalOpen(true)}
              className="gap-1.5 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-medium h-7 px-2.5 sm:h-8 sm:px-3"
            >
              <LogOut size={13} />
              <span>Đăng xuất</span>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-3.5 bg-gray-50/80 dark:bg-[#14151a] rounded-[4px] border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-[#5865f2] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'QU'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                    {user?.name || 'Người dùng'}
                  </span>
                  <Badge variant="default" className="text-[10px] py-0 px-1.5 font-mono">
                    {currentTenant?.role || 'MEMBER'}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {user?.email || 'shopee_admin@domain.com'}
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-200 dark:border-gray-800 w-full sm:w-auto">
              <span className="block text-[11px] text-gray-400">Doanh nghiệp:</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {currentTenant?.name || '--'} ({currentTenant?.code || 'WORKSPACE'})
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. WORKING SCOPE: SHOP & WAREHOUSE SELECTORS */}
      <Card className="shrink-0">
        <CardHeader className="py-2.5 px-3.5 sm:py-3 sm:px-4">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <Store size={16} className="text-[#5865f2]" /> Cửa hàng & Kho xử lý hoạt động
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Chọn cửa hàng và kho hàng mặc định để lọc đơn hàng, quản lý xuất nhập và tra cứu báo cáo trên thiết bị này.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Shop Selection */}
            <div className="p-3 bg-gray-50/80 dark:bg-[#14151a] rounded-[4px] border border-gray-200 dark:border-gray-800 space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Store size={14} className="text-[#5865f2]" />
                <span>Cửa hàng (Shop) làm việc:</span>
              </label>
              <Select
                value={selectedShopId || 'ALL'}
                onChange={(val) => {
                  const sId = String(val);
                  setSelectedShopId(sId);
                  const sObj = shops.find((s) => s.id === sId);
                  toast.success(sId === 'ALL' ? 'Đang xem tất cả Shop' : `Đã chuyển sang Shop: ${sObj?.name || sId}`);
                }}
                options={[
                  { value: 'ALL', label: 'Tất cả Shop (Toàn Workspace)', icon: Store },
                  ...shops.map((s) => ({
                    value: s.id,
                    label: s.code ? `[${s.code}] ${s.name}` : s.name,
                    icon: Store,
                  })),
                ]}
                placeholder="Chọn Shop..."
                searchable={true}
                size="md"
                className="w-full"
              />
            </div>

            {/* Warehouse Selection */}
            <div className="p-3 bg-gray-50/80 dark:bg-[#14151a] rounded-[4px] border border-gray-200 dark:border-gray-800 space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Warehouse size={14} className="text-[#5865f2]" />
                <span>Kho xử lý xuất / nhập hàng:</span>
              </label>
              <Select
                value={selectedWarehouseId || ''}
                onChange={(val) => {
                  const wId = String(val);
                  setSelectedWarehouseId(wId);
                  const wObj = warehouses.find((w) => w.id === wId);
                  toast.success(!wId ? 'Đang xem tất cả kho hàng' : `Đã chọn kho: ${wObj?.name || wId}`);
                }}
                options={[
                  { value: '', label: 'Tất cả kho hàng', icon: Warehouse },
                  ...warehouses.map((w) => ({
                    value: w.id,
                    label: `${w.code} - ${w.name}`,
                    icon: Warehouse,
                    badge: w.status === 'ACTIVE' || w.isActive !== false ? 'Hoạt động' : undefined,
                  })),
                ]}
                placeholder="Chọn kho xử lý..."
                searchable={true}
                size="md"
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. THEME PREFERENCES CARD */}
      <Card className="shrink-0">
        <CardHeader className="py-2.5 px-3.5 sm:py-3 sm:px-4">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <Moon size={16} className="text-[#5865f2]" /> Giao diện hiển thị (Theme)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Light Mode Button */}
            <button
              type="button"
              onClick={() => setTheme(false)}
              className={`p-3 rounded-[4px] border text-left transition-all flex items-center gap-3 cursor-pointer ${
                !isDark
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20'
                  : 'bg-gray-50/80 dark:bg-[#14151a] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                !isDark ? 'bg-amber-500 text-white shadow-xs' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'
              }`}>
                <Sun size={18} />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-xs text-gray-900 dark:text-white block leading-tight">
                  Giao diện Sáng
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 block">
                  Nền sáng, độ tương phản cao
                </span>
              </div>
            </button>

            {/* Dark Mode Button */}
            <button
              type="button"
              onClick={() => setTheme(true)}
              className={`p-3 rounded-[4px] border text-left transition-all flex items-center gap-3 cursor-pointer ${
                isDark
                  ? 'bg-[#5865f2]/10 border-[#5865f2]/40 text-[#5865f2] dark:text-indigo-300 ring-2 ring-[#5865f2]/20'
                  : 'bg-gray-50/80 dark:bg-[#14151a] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                isDark ? 'bg-[#5865f2] text-white shadow-xs' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'
              }`}>
                <Moon size={18} />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-xs text-gray-900 dark:text-white block leading-tight">
                  Giao diện Tối
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 block">
                  Dịu mắt, tối ưu làm việc đêm
                </span>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Workspace Card */}
      <Card className="shrink-0">
        <CardHeader className="py-2.5 px-3.5 sm:py-3 sm:px-4">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <Building2 size={16} className="text-[#5865f2]" /> Thông tin Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
            <div className="p-3 sm:p-3.5 bg-gray-50/80 dark:bg-[#14151a] rounded-[4px] border border-gray-200 dark:border-gray-800 space-y-1">
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block">Tên Doanh nghiệp:</span>
              <div className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm">
                {currentTenant?.name || '--'}
              </div>
            </div>
            <div className="p-3 sm:p-3.5 bg-gray-50/80 dark:bg-[#14151a] rounded-[4px] border border-gray-200 dark:border-gray-800 space-y-1">
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block">Mã Workspace:</span>
              <div className="font-mono font-semibold text-[#5865f2] text-xs sm:text-sm">
                {currentTenant?.code || '--'}
              </div>
            </div>
            <div className="p-3 sm:p-3.5 bg-gray-50/80 dark:bg-[#14151a] rounded-[4px] border border-gray-200 dark:border-gray-800 space-y-1">
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block">Vai trò của bạn:</span>
              <div className="font-semibold text-[#5865f2] text-xs sm:text-sm">
                {currentTenant?.role || 'MEMBER'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warehouses Management Card */}
      <Card className="shrink-0">
        <CardHeader className="py-2.5 px-3.5 sm:py-3 sm:px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <Warehouse size={16} className="text-[#5865f2]" /> Quản lý Kho hàng ({warehouses.length})
          </CardTitle>
          <CardAction>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsCreateWhModalOpen(true)}
              className="gap-1.5 h-7 px-2.5 sm:h-8 sm:px-3 text-xs"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Thêm kho mới</span>
              <span className="sm:hidden">Thêm mới</span>
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="p-0">
          {/* MOBILE VIEW: Card List (sm:hidden) */}
          <div className="sm:hidden p-3 space-y-2.5 bg-gray-50/50 dark:bg-[#101216]">
            {warehouses.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                Chưa có kho nào. Nhấn &quot;Thêm mới&quot; để tạo kho xuất hàng.
              </div>
            ) : (
              warehouses.map((wh, index) => (
                <div
                  key={wh.id}
                  className="p-3 bg-white dark:bg-[#161b26] border border-gray-200/80 dark:border-gray-800 rounded-[4px] shadow-xs space-y-2.5"
                >
                  {/* Top row: Name, Status Badge, Code, and Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs text-gray-900 dark:text-white leading-tight">
                          {wh.name}
                        </span>
                        <Badge variant={wh.isActive !== false ? 'success' : 'secondary'} className="text-[10px] py-0 px-1.5 shrink-0">
                          {wh.isActive !== false ? 'Hoạt động' : 'Tạm dừng'}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#5865f2] dark:text-indigo-400 font-mono font-medium">
                        <span className="text-gray-400 dark:text-gray-500 font-sans">#{index + 1}</span>
                        <span className="text-gray-300 dark:text-gray-700">•</span>
                        <span>{wh.code}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 -mr-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleOpenEditWh(wh)}
                        className="h-7 w-7 p-0 text-gray-500 hover:text-[#5865f2] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-[4px]"
                        title="Sửa thông tin kho"
                      >
                        <Edit2 size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleOpenDeleteWh(wh)}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-[4px]"
                        title="Xóa kho hàng"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>

                  {/* Bottom row: Address & Phone */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800/80 space-y-1.5 text-xs">
                    <div className="flex items-start gap-1.5 text-gray-600 dark:text-gray-400">
                      <MapPin size={13} className="text-gray-400 shrink-0 mt-0.5" />
                      <span className="text-[11px] leading-relaxed break-words">
                        {wh.address || <span className="text-gray-400 dark:text-gray-500 italic">Chưa có địa chỉ</span>}
                      </span>
                    </div>
                    {wh.phone && (
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <Phone size={13} className="text-gray-400 shrink-0" />
                        <span className="text-[11px] font-mono text-gray-700 dark:text-gray-300">
                          {wh.phone}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DESKTOP VIEW: Table (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto border-t border-gray-200 dark:border-gray-800">
            <table className="w-full text-left border-collapse text-xs">
              <SystemThead>
                <SystemTr>
                  <SystemTh className="w-14 text-center" align="center">STT</SystemTh>
                  <SystemTh align="left">Mã kho</SystemTh>
                  <SystemTh align="left">Tên kho</SystemTh>
                  <SystemTh align="left">Địa chỉ kho</SystemTh>
                  <SystemTh align="left">Số điện thoại</SystemTh>
                  <SystemTh align="center">Trạng thái</SystemTh>
                  <SystemTh align="center">Thao tác</SystemTh>
                </SystemTr>
              </SystemThead>
              <SystemTbody>
                {warehouses.length === 0 ? (
                  <SystemTr>
                    <SystemTd colSpan={7} align="center" className="py-8 text-gray-400">
                      Chưa có kho nào. Nhấn &quot;Thêm kho mới&quot; để tạo kho xuất hàng.
                    </SystemTd>
                  </SystemTr>
                ) : (
                  warehouses.map((wh, index) => (
                    <SystemTr key={wh.id}>
                      <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                        {index + 1}
                      </SystemTd>
                      <SystemTd className="font-mono font-medium text-[#5865f2]">
                        {wh.code}
                      </SystemTd>
                      <SystemTd className="font-medium text-gray-900 dark:text-white">
                        {wh.name}
                      </SystemTd>
                      <SystemTd className="text-gray-600 dark:text-gray-400">
                        {wh.address || '--'}
                      </SystemTd>
                      <SystemTd className="font-mono text-gray-600 dark:text-gray-400">
                        {wh.phone || '--'}
                      </SystemTd>
                      <SystemTd align="center">
                        <Badge variant={wh.isActive !== false ? 'success' : 'secondary'}>
                          {wh.isActive !== false ? 'Hoạt động' : 'Tạm dừng'}
                        </Badge>
                      </SystemTd>
                      <SystemTd align="center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleOpenEditWh(wh)}
                            className="px-2 text-gray-500 hover:text-[#5865f2]"
                            title="Sửa thông tin kho"
                          >
                            <Edit2 size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleOpenDeleteWh(wh)}
                            className="px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Xóa kho hàng"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </SystemTd>
                    </SystemTr>
                  ))
                )}
              </SystemTbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Operational & Scanner Preferences Card */}
      <Card className="shrink-0">
        <CardHeader className="py-2.5 px-3.5 sm:py-3 sm:px-4">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <Scan size={16} className="text-[#5865f2]" /> Cấu hình máy quét & Vận hành
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4 space-y-2.5">
          <div
            onClick={() => setScannerSound(!scannerSound)}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-colors select-none"
          >
            <div className="flex items-center gap-2.5">
              <Volume2 size={16} className="text-emerald-500" />
              <div>
                <span className="text-xs font-medium text-gray-900 dark:text-white block">
                  Phát âm thanh thông báo khi quét Barcode
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Bật tiếng bíp phân biệt thành công (bíp ngắn), cảnh báo trùng (hai tiếng) và lỗi (bíp trầm)
                </span>
              </div>
            </div>
            <Checkbox
              checked={scannerSound}
              onChange={(e) => setScannerSound(e.target.checked)}
              size="md"
            />
          </div>

          <div
            onClick={() => setAutoSelectNext(!autoSelectNext)}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-colors select-none"
          >
            <div className="flex items-center gap-2.5">
              <Scan size={16} className="text-[#5865f2]" />
              <div>
                <span className="text-xs font-medium text-gray-900 dark:text-white block">
                  Tự động đưa con trỏ chuột về ô nhập sau mỗi lần quét (Auto Focus)
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Tối ưu cho máy quét cầm tay USB / Bluetooth dạng keyboard wedge
                </span>
              </div>
            </div>
            <Checkbox
              checked={autoSelectNext}
              onChange={(e) => setAutoSelectNext(e.target.checked)}
              size="md"
            />
          </div>
        </CardContent>
      </Card>

      {/* 6. DANGER ZONE: CLEAR ALL DATA */}
      <Card className="shrink-0 border-rose-200 dark:border-rose-900/60 bg-white dark:bg-[#15171e] shadow-2xs overflow-hidden">
        <CardHeader className="py-2.5 px-3.5 sm:py-3 sm:px-4 bg-rose-50/60 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/40 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-semibold flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <ShieldAlert size={16} className="text-rose-600 dark:text-rose-400" />
            <span>Vùng nguy hiểm (Danger Zone)</span>
          </CardTitle>
          <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-medium select-none">
            <AlertTriangle size={13} className="shrink-0" />
            <span>Không thể khôi phục</span>
          </div>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-rose-50/30 dark:bg-rose-950/10 rounded border border-rose-100 dark:border-rose-900/30">
            <div className="space-y-1 min-w-0 flex-1">
              <span className="font-semibold text-xs text-gray-900 dark:text-white block">
                Clear toàn bộ hoặc tùy chọn phân hệ dữ liệu
              </span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                Tùy chọn xóa sạch phiếu thu chi, phiếu nhập kho, đơn hàng Shopee hoặc đặt lại dữ liệu vận hành. Thông tin đăng nhập, Shop và Kho hàng luôn được giữ nguyên an toàn.
              </p>
            </div>
            <div className="shrink-0 pt-1 sm:pt-0">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setConfirmClearText('');
                  setClearOrders(true);
                  setClearPurchaseReceipts(true);
                  setClearCashflow(true);
                  setClearProducts(false);
                  setClearSuppliers(false);
                  setIsClearDataModalOpen(true);
                }}
                className="gap-1.5 h-8 px-3 text-xs font-semibold shadow-xs whitespace-nowrap cursor-pointer active:scale-95"
              >
                <Trash2 size={13} />
                <span>Xóa dữ liệu...</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CREATE WAREHOUSE MODAL */}
      {isCreateWhModalOpen && (
        <Modal
          isOpen={isCreateWhModalOpen}
          onClose={() => setIsCreateWhModalOpen(false)}
          title={<><span className="sm:hidden">Thêm kho hàng</span><span className="hidden sm:inline">Thêm Kho hàng mới</span></>}
          subtitle={<span className="line-clamp-1 sm:line-clamp-none">Tạo kho lưu trữ và xuất hàng hóa cho các gian hàng Shopee</span>}
          icon={Warehouse}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCreateWhSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-3.5 p-3 sm:p-5">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mã kho (Duy nhất) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: KHO_TONG_HN"
                  value={createWhForm.code}
                  onChange={(e) => setCreateWhForm({ ...createWhForm, code: e.target.value })}
                  className="w-full h-8 px-3 text-xs font-mono uppercase bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tên kho hàng *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Kho Tổng Hà Nội - Cầu Giấy"
                  value={createWhForm.name}
                  onChange={(e) => setCreateWhForm({ ...createWhForm, name: e.target.value })}
                  className="w-full h-8 px-3 text-xs bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Địa chỉ kho
                </label>
                <input
                  type="text"
                  placeholder="Số nhà, đường, quận/huyện, tỉnh/TP"
                  value={createWhForm.address}
                  onChange={(e) => setCreateWhForm({ ...createWhForm, address: e.target.value })}
                  className="w-full h-8 px-3 text-xs bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Số điện thoại thủ kho
                </label>
                <input
                  type="text"
                  placeholder="09xx..."
                  value={createWhForm.phone}
                  onChange={(e) => setCreateWhForm({ ...createWhForm, phone: e.target.value })}
                  className="w-full h-8 px-3 text-xs font-mono bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsCreateWhModalOpen(false)}
                className="flex-1 sm:flex-initial"
              >
                Hủy
              </ModalButton>
              <ModalButton variant="primary" type="submit" className="flex-1 sm:flex-initial">
                Tạo Kho
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* EDIT WAREHOUSE MODAL */}
      {isEditWhModalOpen && selectedWhForEdit && (
        <Modal
          isOpen={isEditWhModalOpen}
          onClose={() => setIsEditWhModalOpen(false)}
          title={<><span className="sm:hidden">Sửa kho hàng</span><span className="hidden sm:inline">Chỉnh sửa Kho hàng</span></>}
          subtitle={<span className="line-clamp-1 sm:line-clamp-none">{`Cập nhật thông tin chi tiết cho ${selectedWhForEdit.code}`}</span>}
          icon={Warehouse}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleEditWhSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-3.5 p-3 sm:p-5">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tên kho hàng *
                </label>
                <input
                  type="text"
                  required
                  value={editWhForm.name}
                  onChange={(e) => setEditWhForm({ ...editWhForm, name: e.target.value })}
                  className="w-full h-8 px-3 text-xs bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Địa chỉ kho
                </label>
                <input
                  type="text"
                  value={editWhForm.address}
                  onChange={(e) => setEditWhForm({ ...editWhForm, address: e.target.value })}
                  className="w-full h-8 px-3 text-xs bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Số điện thoại thủ kho
                </label>
                <input
                  type="text"
                  value={editWhForm.phone}
                  onChange={(e) => setEditWhForm({ ...editWhForm, phone: e.target.value })}
                  className="w-full h-8 px-3 text-xs font-mono bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div
                onClick={() => setEditWhForm({ ...editWhForm, isActive: !editWhForm.isActive })}
                className="flex items-center gap-2 pt-1 cursor-pointer select-none group"
              >
                <Checkbox
                  id="isWhActiveCheck"
                  checked={editWhForm.isActive}
                  onChange={(e) => setEditWhForm({ ...editWhForm, isActive: e.target.checked })}
                  size="sm"
                />
                <label
                  htmlFor="isWhActiveCheck"
                  className="text-xs text-gray-700 dark:text-gray-300 font-medium cursor-pointer group-hover:text-gray-900 dark:group-hover:text-white transition-colors"
                >
                  Kích hoạt trạng thái hoạt động của kho
                </label>
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsEditWhModalOpen(false)}
                className="flex-1 sm:flex-initial"
              >
                Hủy
              </ModalButton>
              <ModalButton variant="primary" type="submit" className="flex-1 sm:flex-initial">
                Lưu thay đổi
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL 3: DELETE WAREHOUSE */}
      {isDeleteWhModalOpen && selectedWhForDelete && (
        <Modal
          isOpen={isDeleteWhModalOpen}
          onClose={() => setIsDeleteWhModalOpen(false)}
          title={<><span className="sm:hidden">Xóa kho hàng</span><span className="hidden sm:inline">Xác nhận xóa kho hàng</span></>}
          subtitle={<span className="line-clamp-1 sm:line-clamp-none">{`Bạn có chắc chắn muốn xóa kho "${selectedWhForDelete.name}" (${selectedWhForDelete.code})?`}</span>}
          icon={Trash2}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 p-3 sm:p-5">
              <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold">Lưu ý về tính toàn vẹn tồn kho:</p>
                  <p className="mt-0.5 text-amber-700 dark:text-amber-400/90 leading-relaxed">
                    Nếu kho này đang chứa tồn kho hoặc đã ghi nhận các giao dịch sổ cái lịch sử, hệ thống sẽ tự động chuyển trạng thái kho sang <strong>Tạm dừng hoạt động</strong> thay vì xóa vĩnh viễn nhằm đảm bảo tính toàn vẹn của sổ cái.
                  </p>
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsDeleteWhModalOpen(false)}
                disabled={isDeletingWh}
                className="flex-1 sm:flex-initial"
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="danger"
                onClick={handleDeleteWhSubmit}
                disabled={isDeletingWh}
                className="flex-1 sm:flex-initial"
              >
                {isDeletingWh ? 'Đang xóa...' : 'Xác nhận xóa'}
              </ModalButton>
            </ModalFooter>
          </div>
        </Modal>
      )}
      {/* LOGOUT CONFIRMATION MODAL */}
      {isLogoutModalOpen && (
        <Modal
          isOpen={isLogoutModalOpen}
          onClose={() => setIsLogoutModalOpen(false)}
          title="Xác nhận đăng xuất"
          subtitle="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?"
          icon={LogOut}
          maxWidth="max-w-sm"
        >
          <ModalBody className="p-4 space-y-2 text-xs text-gray-600 dark:text-gray-400">
            <p>
              Phiên làm việc hiện tại của bạn sẽ kết thúc. Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng hệ thống.
            </p>
          </ModalBody>
          <ModalFooter className="flex items-center justify-end gap-2 p-3">
            <ModalButton
              variant="outline"
              onClick={() => setIsLogoutModalOpen(false)}
            >
              Hủy
            </ModalButton>
            <ModalButton
              variant="danger"
              onClick={handleLogout}
              className="gap-1.5"
            >
              <LogOut size={13} />
              <span>Đăng xuất</span>
            </ModalButton>
          </ModalFooter>
        </Modal>
      )}

      {/* MODAL: CLEAR DATA CONFIRMATION */}
      {isClearDataModalOpen && (
        <Modal
          isOpen={isClearDataModalOpen}
          onClose={() => !isClearingData && setIsClearDataModalOpen(false)}
          title={
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
              <ShieldAlert size={18} />
              <span>Xóa dữ liệu hệ thống</span>
            </div>
          }
          subtitle="Dữ liệu đã chọn sau khi xóa sẽ không thể khôi phục"
          icon={Trash2}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 p-3.5 sm:p-4">
              {/* Short Alert Notice */}
              <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300">
                <AlertTriangle size={15} className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Hành động này sẽ xóa vĩnh viễn các phân hệ được tích chọn bên dưới. Tài khoản đăng nhập, Shop và Kho hàng luôn được bảo toàn an toàn.
                </p>
              </div>

              {/* Granular Module Checkboxes */}
              <div className="space-y-1.5 p-2.5 rounded bg-gray-50 dark:bg-[#161a22] border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between pb-1 border-b border-gray-200/60 dark:border-gray-800 text-[11px] text-gray-500 font-medium">
                  <span>Chọn dữ liệu cần xóa:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setClearOrders(false);
                        setClearPurchaseReceipts(true);
                        setClearCashflow(true);
                        setClearProducts(false);
                        setClearSuppliers(false);
                      }}
                      className="text-[10px] text-[#5865f2] hover:underline cursor-pointer"
                    >
                      Chỉ thu chi & nhập hàng
                    </button>
                    <span className="text-gray-300 dark:text-gray-700">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = clearOrders && clearPurchaseReceipts && clearCashflow;
                        setClearOrders(!allSelected);
                        setClearPurchaseReceipts(!allSelected);
                        setClearCashflow(!allSelected);
                      }}
                      className="text-[10px] text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                    >
                      {clearOrders && clearPurchaseReceipts && clearCashflow ? 'Bỏ hết' : 'Tất cả'}
                    </button>
                  </div>
                </div>

                {/* 1. Phiếu thu chi & Sổ quỹ */}
                <div
                  onClick={() => setClearCashflow(!clearCashflow)}
                  className="flex items-start gap-2 py-1 px-1 rounded hover:bg-gray-100/60 dark:hover:bg-gray-800/40 cursor-pointer select-none"
                >
                  <Checkbox
                    checked={clearCashflow}
                    onChange={(e) => setClearCashflow(e.target.checked)}
                    size="sm"
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100 block">
                      Phiếu thu chi & Sổ quỹ tiền
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                      Giao dịch thu chi, chuyển quỹ, đặt lại số dư tài khoản về 0
                    </span>
                  </div>
                </div>

                {/* 2. Phiếu nhập hàng & Công nợ NCC */}
                <div
                  onClick={() => setClearPurchaseReceipts(!clearPurchaseReceipts)}
                  className="flex items-start gap-2 py-1 px-1 rounded hover:bg-gray-100/60 dark:hover:bg-gray-800/40 cursor-pointer select-none"
                >
                  <Checkbox
                    checked={clearPurchaseReceipts}
                    onChange={(e) => setClearPurchaseReceipts(e.target.checked)}
                    size="sm"
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100 block">
                      Phiếu nhập hàng & Công nợ NCC
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                      Phiếu nhập kho, trả hàng NCC, phiếu chi thanh toán nợ NCC
                    </span>
                  </div>
                </div>

                {/* 3. Đơn hàng Shopee */}
                <div
                  onClick={() => setClearOrders(!clearOrders)}
                  className="flex items-start gap-2 py-1 px-1 rounded hover:bg-gray-100/60 dark:hover:bg-gray-800/40 cursor-pointer select-none"
                >
                  <Checkbox
                    checked={clearOrders}
                    onChange={(e) => setClearOrders(e.target.checked)}
                    size="sm"
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100 block">
                      Đơn hàng Shopee & Vận hành kho
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                      Đơn hàng, kiện hàng, lịch sử quét mã, đơn hàng hoàn trả
                    </span>
                  </div>
                </div>

                {/* 4. Tùy chọn mở rộng: Sản phẩm & NCC */}
                <div className="pt-1.5 border-t border-gray-200/60 dark:border-gray-800/80 flex items-center justify-between gap-3 text-[11px]">
                  <div
                    onClick={() => setClearProducts(!clearProducts)}
                    className="flex items-center gap-1.5 cursor-pointer select-none"
                  >
                    <Checkbox
                      checked={clearProducts}
                      onChange={(e) => setClearProducts(e.target.checked)}
                      size="sm"
                    />
                    <span className="text-gray-600 dark:text-gray-300">Xóa cả Sản phẩm & SKU</span>
                  </div>

                  <div
                    onClick={() => setClearSuppliers(!clearSuppliers)}
                    className="flex items-center gap-1.5 cursor-pointer select-none"
                  >
                    <Checkbox
                      checked={clearSuppliers}
                      onChange={(e) => setClearSuppliers(e.target.checked)}
                      size="sm"
                    />
                    <span className="text-gray-600 dark:text-gray-300">Xóa cả Nhà cung cấp</span>
                  </div>
                </div>
              </div>

              {/* Safety Type-to-Confirm: CONFIRM */}
              <div className="space-y-1.5 pt-0.5">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Để xác nhận, vui lòng nhập chữ{' '}
                  <span className="font-bold font-mono text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/50 select-all">
                    CONFIRM
                  </span>{' '}
                  vào ô dưới đây:
                </label>
                <input
                  type="text"
                  value={confirmClearText}
                  onChange={(e) => setConfirmClearText(e.target.value)}
                  placeholder="Nhập: CONFIRM"
                  disabled={isClearingData}
                  className="w-full h-8.5 px-3 text-xs bg-white dark:bg-[#181b22] border border-gray-300 dark:border-gray-700 rounded text-gray-900 dark:text-white font-mono focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 placeholder-gray-400"
                />
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full p-3 sm:p-3.5 border-t border-gray-100 dark:border-gray-800">
              <ModalButton
                variant="secondary"
                onClick={() => setIsClearDataModalOpen(false)}
                disabled={isClearingData}
                className="flex-1 sm:flex-initial"
              >
                Hủy bỏ
              </ModalButton>
              <ModalButton
                variant="danger"
                onClick={handleClearData}
                disabled={
                  confirmClearText.trim().toUpperCase() !== 'CONFIRM' ||
                  isClearingData ||
                  (!clearOrders && !clearPurchaseReceipts && !clearCashflow && !clearProducts && !clearSuppliers)
                }
                className="flex-1 sm:flex-initial gap-1.5 font-semibold"
              >
                <Trash2 size={13} />
                <span>{isClearingData ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
              </ModalButton>
            </ModalFooter>
          </div>
        </Modal>
      )}
    </div>
  );
};
