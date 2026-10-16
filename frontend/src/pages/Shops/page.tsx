import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  FileSpreadsheet,
  Warehouse,
  Search,
  MoreHorizontal,
  CheckCircle,
  SlidersHorizontal,
  LayoutGrid,
  List,
} from 'lucide-react';
import { shopsApi } from '../../services/shopsApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { Select } from '../../components/ui/Select';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import {
  SystemTableWrapper,
  SystemThead,
  SystemTh,
  SystemTbody,
  SystemTr,
  SystemTd,
  SystemTableEmpty,
  SystemTableSkeleton,
  SystemPagination,
} from '../../components/ui/SystemTable';
import { SystemMetricCard } from '../../components/ui/SystemMetricCard';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../components/ui/DropdownMenu';
import { toast } from '../../components/ui/Toast';

export const ShopsPage: React.FC = () => {
  const navigate = useNavigate();
  const { warehouses, setSelectedShopId } = useWorkspaceStore();

  const [shops, setShops] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedShopForEdit, setSelectedShopForEdit] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [selectedShopForDelete, setSelectedShopForDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [createForm, setCreateForm] = useState({
    code: '',
    name: '',
    platform: 'SHOPEE',
    defaultWarehouseId: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    defaultWarehouseId: '',
    isActive: true,
  });

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    setIsLoading(true);
    try {
      const res: any = await shopsApi.findAll();
      setShops(res || []);
    } catch (err: any) {
      console.error('Error loading shops:', err);
      toast.error('Lỗi tải danh sách shop', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.code || !createForm.name) {
      toast.warning('Vui lòng nhập mã shop và tên shop');
      return;
    }
    try {
      await shopsApi.create({
        code: createForm.code.trim().toUpperCase(),
        name: createForm.name.trim(),
        platform: createForm.platform,
        defaultWarehouseId: createForm.defaultWarehouseId || undefined,
      });
      setIsCreateModalOpen(false);
      setCreateForm({
        code: '',
        name: '',
        platform: 'SHOPEE',
        defaultWarehouseId: '',
      });
      toast.success('Thêm shop mới thành công!');
      loadShops();
    } catch (err: any) {
      toast.error('Lỗi tạo shop', err.message);
    }
  };

  const handleOpenEdit = (shop: any) => {
    setSelectedShopForEdit(shop);
    setEditForm({
      name: shop.name,
      defaultWarehouseId: shop.defaultWarehouseId || '',
      isActive: shop.isActive ?? true,
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopForEdit) return;
    try {
      await shopsApi.update(selectedShopForEdit.id, {
        name: editForm.name.trim(),
        defaultWarehouseId: editForm.defaultWarehouseId || undefined,
        isActive: editForm.isActive,
      });
      setIsEditModalOpen(false);
      toast.success('Cập nhật thông tin shop thành công!');
      loadShops();
    } catch (err: any) {
      toast.error('Lỗi cập nhật shop', err.message);
    }
  };

  const handleOpenDelete = (shop: any) => {
    setSelectedShopForDelete(shop);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedShopForDelete) return;
    setIsDeleting(true);
    try {
      await shopsApi.delete(selectedShopForDelete.id);
      setIsDeleteModalOpen(false);
      setSelectedShopForDelete(null);
      toast.success('Xóa shop thành công!');
      loadShops();
    } catch (err: any) {
      toast.error('Lỗi xóa shop', err.message || 'Không thể xóa shop');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleJumpToOrders = (shopId: string) => {
    setSelectedShopId(shopId);
    navigate(`/orders?shopId=${shopId}`);
  };

  const handleJumpToImports = (shopId: string) => {
    setSelectedShopId(shopId);
    navigate('/imports');
  };

  // Metrics
  const activeCount = shops.filter((s) => s.isActive !== false).length;
  const inactiveCount = shops.filter((s) => s.isActive === false).length;
  const withWarehouseCount = shops.filter((s) => Boolean(s.defaultWarehouseId)).length;

  // Filter & Search
  const filteredShops = shops.filter((s) => {
    if (statusFilter === 'ACTIVE' && s.isActive === false) return false;
    if (statusFilter === 'INACTIVE' && s.isActive !== false) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const code = (s.code || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      return code.includes(term) || name.includes(term);
    }
    return true;
  });

  const paginatedShops = filteredShops.slice((page - 1) * limit, page * limit);

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-3.5 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-lg md:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <Store size={20} className="text-[#5865f2]" />
            Quản lý Shop ({shops.length})
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Cấu hình các gian hàng Shopee, gán kho xuất mặc định và kiểm soát trạng thái hoạt động
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-1.5"
          >
            <Plus size={14} />
            <span>Thêm Shop mới</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadShops}
            className="p-2"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <SystemMetricCard
          title="Tổng số Shop"
          value={shops.length}
          subtitle="Gian hàng đã kết nối"
          icon={Store}
          colorScheme="blue"
        />
        <SystemMetricCard
          title="Đang hoạt động"
          value={activeCount}
          subtitle="Sẵn sàng đồng bộ đơn"
          icon={CheckCircle}
          colorScheme="green"
        />
        <SystemMetricCard
          title="Tạm dừng"
          value={inactiveCount}
          subtitle="Ngừng đồng bộ"
          icon={AlertTriangle}
          colorScheme="red"
        />
        <SystemMetricCard
          title="Đã gán kho xuất"
          value={withWarehouseCount}
          subtitle="Kho xuất hàng tự động"
          icon={Warehouse}
          colorScheme="purple"
        />
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded shrink-0">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo mã shop, tên gian hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-4 py-1.5 h-8 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-2.5 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">
              Trạng thái:
            </span>
            <Select
              value={statusFilter}
              onChange={(val: any) => setStatusFilter(val)}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: 'Đang hoạt động' },
                { value: 'INACTIVE', label: 'Tạm dừng' },
              ]}
              size="sm"
              className="w-36 sm:w-40"
              menuWidth="w-44"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700/60 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
              title="Dạng lưới thẻ (Grid)"
            >
              <LayoutGrid size={13} />
              <span>Lưới</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
              title="Dạng bảng (Table)"
            >
              <List size={13} />
              <span>Bảng</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Grid or Table View */}
      {viewMode === 'grid' ? (
        <div className="flex-1 flex flex-col min-h-0 justify-between">
          <div className="flex-1 md:overflow-y-auto pr-0.5 custom-scrollbar pb-3">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 animate-pulse space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-800" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-8 bg-gray-100 dark:bg-gray-800/60 rounded" />
                  <div className="h-7 bg-gray-100 dark:bg-gray-800/60 rounded" />
                </div>
              ))}
            </div>
          ) : paginatedShops.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded-lg">
              <Store size={36} className="mx-auto text-gray-400 mb-2" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Không tìm thấy gian hàng nào
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {searchTerm
                  ? 'Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc.'
                  : 'Chưa có gian hàng nào trong Workspace. Nhấn "Thêm Shop mới" để kết nối.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {paginatedShops.map((shop) => {
                const defaultWh = warehouses.find((w) => w.id === shop.defaultWarehouseId);
                const isActive = shop.isActive !== false;

                return (
                  <div
                    key={shop.id}
                    className="p-4 rounded-lg bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 hover:border-[#5865f2]/40 hover:shadow-sm transition-all duration-200 flex flex-col justify-between group"
                  >
                    <div>
                      {/* Header: Platform Avatar + Title + Menu */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-sm border border-orange-500/20 shrink-0">
                            {shop.platform?.[0] || 'S'}
                          </div>
                          <div className="min-w-0">
                            <h3
                              className="font-medium text-sm text-gray-900 dark:text-white truncate group-hover:text-[#5865f2] transition-colors"
                              title={shop.name}
                            >
                              {shop.name}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] text-gray-400">
                                {shop.code}
                              </span>
                              <span className="font-semibold text-orange-600 dark:text-orange-400 text-[10px] px-1.5 py-0.2 rounded bg-orange-50 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-900/40">
                                {shop.platform || 'SHOPEE'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shrink-0"
                              title="Thao tác"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleJumpToOrders(shop.id)}>
                              <ShoppingBag size={13} className="text-[#5865f2]" />
                              <span>Xem danh sách đơn</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleJumpToImports(shop.id)}>
                              <FileSpreadsheet size={13} className="text-emerald-500" />
                              <span>Import file đơn Shopee</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenEdit(shop)}>
                              <Edit2 size={13} className="text-gray-400" />
                              <span>Chỉnh sửa thông tin shop</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => handleOpenDelete(shop)}
                            >
                              <Trash2 size={13} />
                              <span>Xóa gian hàng</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Warehouse & Status */}
                      <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-gray-800/80 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                            <Warehouse size={13} className="text-gray-400 shrink-0" />
                            <span>Kho xuất:</span>
                          </span>
                          {defaultWh ? (
                            <span
                              className="font-medium text-gray-900 dark:text-gray-200 truncate"
                              title={`${defaultWh.name} (${defaultWh.code})`}
                            >
                              {defaultWh.name}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Chưa gán</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-500 dark:text-gray-400">Trạng thái:</span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? 'bg-emerald-500' : 'bg-gray-400'
                              }`}
                            />
                            {isActive ? 'Hoạt động' : 'Tạm dừng'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="xs"
                        className="flex-1 gap-1 text-[11px]"
                        onClick={() => handleJumpToOrders(shop.id)}
                      >
                        <ShoppingBag size={12} />
                        <span>Đơn hàng</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        className="flex-1 gap-1 text-[11px]"
                        onClick={() => handleJumpToImports(shop.id)}
                      >
                        <FileSpreadsheet size={12} />
                        <span>Import</span>
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(shop)}
                        className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
                        title="Sửa shop"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          </div>

          {/* Grid Pagination - Pinned to bottom, identical to table/list view */}
          <div className="shrink-0 rounded border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-[#14151a] shadow-none [&>div]:border-t-0">
            <SystemPagination
              page={page - 1}
              totalPages={Math.ceil(filteredShops.length / limit) || 1}
              totalItems={filteredShops.length}
              setPage={(p) => setPage(p + 1)}
              itemsPerPage={limit}
              setItemsPerPage={setLimit}
            />
          </div>
        </div>
      ) : (
        /* Unified SystemTable */
        <div className="flex-1 flex flex-col min-h-0">
          <SystemTableWrapper
            tableClassName="min-w-[850px]"
            pagination={
              <SystemPagination
                page={page - 1}
                totalPages={Math.ceil(filteredShops.length / limit) || 1}
                totalItems={filteredShops.length}
                setPage={(p) => setPage(p + 1)}
                itemsPerPage={limit}
                setItemsPerPage={setLimit}
              />
            }
          >
            <SystemThead>
              <SystemTh className="w-[320px]" align="left">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Store size={13} className="text-orange-500 shrink-0" />
                  <span>Gian hàng / Mã Shop</span>
                </div>
              </SystemTh>
              <SystemTh className="w-[140px]" align="center">
                <span>Nền tảng</span>
              </SystemTh>
              <SystemTh className="w-[240px]" align="left">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Warehouse size={13} className="text-gray-400 shrink-0" />
                  <span>Kho xuất mặc định</span>
                </div>
              </SystemTh>
              <SystemTh className="w-[150px]" align="center">
                <div className="flex items-center justify-center gap-1.5 font-semibold">
                  <CheckCircle size={13} className="text-blue-500 shrink-0" />
                  <span>Trạng thái</span>
                </div>
              </SystemTh>
              <SystemTh className="w-[60px]" align="center">
                <div className="flex items-center justify-center" title="Thao tác">
                  <SlidersHorizontal size={13} className="text-gray-400" />
                </div>
              </SystemTh>
            </SystemThead>
            <SystemTbody>
              {isLoading ? (
                <SystemTableSkeleton cols={5} rows={6} />
              ) : paginatedShops.length === 0 ? (
                <SystemTableEmpty
                  colSpan={5}
                  title="Không tìm thấy gian hàng nào"
                  description={
                    searchTerm
                      ? 'Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc.'
                      : 'Chưa có gian hàng nào trong Workspace. Nhấn "Thêm Shop mới" để kết nối.'
                  }
                />
              ) : (
                paginatedShops.map((shop) => {
                  const defaultWh = warehouses.find((w) => w.id === shop.defaultWarehouseId);
                  const isActive = shop.isActive !== false;

                  return (
                    <SystemTr key={shop.id}>
                      <SystemTd>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-xs border border-orange-500/20 shrink-0">
                            {shop.platform?.[0] || 'S'}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {shop.name}
                            </div>
                            <div className="font-mono text-[11px] text-gray-400">
                              {shop.code}
                            </div>
                          </div>
                        </div>
                      </SystemTd>

                      <SystemTd align="center">
                        <span className="font-semibold text-orange-600 dark:text-orange-400 text-xs px-2 py-0.5 rounded bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50">
                          {shop.platform || 'SHOPEE'}
                        </span>
                      </SystemTd>

                      <SystemTd>
                        <div className="flex items-center gap-1.5 text-xs">
                          <Warehouse size={13} className="text-gray-400 shrink-0" />
                          {defaultWh ? (
                            <span className="font-medium text-gray-900 dark:text-gray-200">
                              {defaultWh.name} <span className="font-mono text-gray-400">({defaultWh.code})</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Chưa gán kho</span>
                          )}
                        </div>
                      </SystemTd>

                      {/* Trạng thái (Chip status đặt ở cuối ngay trước Thao tác) */}
                      <SystemTd align="center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle size={11} /> Hoạt động
                            </>
                          ) : (
                            'Tạm dừng'
                          )}
                        </span>
                      </SystemTd>

                      {/* Thao tác: Toàn bộ action gom vào DropdownMenu đồng bộ */}
                      <SystemTd align="center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                title="Thao tác"
                              >
                                <MoreHorizontal size={14} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleJumpToOrders(shop.id)}>
                                <ShoppingBag size={13} className="text-[#5865f2]" />
                                <span>Xem danh sách đơn</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleJumpToImports(shop.id)}>
                                <FileSpreadsheet size={13} className="text-emerald-500" />
                                <span>Import file đơn Shopee</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenEdit(shop)}>
                                <Edit2 size={13} className="text-gray-400" />
                                <span>Chỉnh sửa thông tin shop</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleOpenDelete(shop)}
                              >
                                <Trash2 size={13} />
                                <span>Xóa gian hàng</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </SystemTd>
                    </SystemTr>
                  );
                })
              )}
            </SystemTbody>
          </SystemTableWrapper>
        </div>
      )}

      {/* MODAL 1: CREATE SHOP */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Thêm Shop mới"
          subtitle="Tạo cấu hình gian hàng Shopee và liên kết kho xuất hàng mặc định"
          icon={Store}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Mã shop (Duy nhất trong Workspace) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: SHOP_HN_01"
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono uppercase bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Tên hiển thị Shop *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Cửa hàng Thời trang Shopee Hà Nội"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Kho xuất hàng mặc định
                </label>
                <Select
                  value={createForm.defaultWarehouseId}
                  onChange={(val: any) =>
                    setCreateForm({ ...createForm, defaultWarehouseId: val })
                  }
                  options={[
                    { value: '', label: '-- Chọn kho mặc định (tùy chọn) --' },
                    ...warehouses.map((w) => ({
                      value: w.id,
                      label: `${w.name} (${w.code})`,
                    })),
                  ]}
                  placeholder="-- Chọn kho mặc định (tùy chọn) --"
                  size="md"
                  className="w-full"
                  menuWidth="w-full"
                />
              </div>
            </ModalBody>

            <ModalFooter>
              <ModalButton
                variant="secondary"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Hủy
              </ModalButton>
              <ModalButton variant="primary" type="submit">
                Tạo Shop
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL 2: EDIT SHOP */}
      {isEditModalOpen && selectedShopForEdit && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Chỉnh sửa Shop"
          subtitle={`Cập nhật thông tin và kho xuất mặc định cho ${selectedShopForEdit.code}`}
          icon={Store}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Tên hiển thị Shop *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Kho xuất hàng mặc định
                </label>
                <Select
                  value={editForm.defaultWarehouseId}
                  onChange={(val: any) =>
                    setEditForm({ ...editForm, defaultWarehouseId: val })
                  }
                  options={[
                    { value: '', label: '-- Chưa gán kho --' },
                    ...warehouses.map((w) => ({
                      value: w.id,
                      label: `${w.name} (${w.code})`,
                    })),
                  ]}
                  placeholder="-- Chưa gán kho --"
                  size="md"
                  className="w-full"
                  menuWidth="w-full"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-[#5865f2] rounded border-gray-300 focus:ring-[#5865f2] cursor-pointer"
                />
                <label
                  htmlFor="isActiveCheck"
                  className="text-xs text-gray-700 dark:text-gray-300 font-medium cursor-pointer"
                >
                  Kích hoạt trạng thái hoạt động của Shop
                </label>
              </div>
            </ModalBody>

            <ModalFooter>
              <ModalButton
                variant="secondary"
                onClick={() => setIsEditModalOpen(false)}
              >
                Hủy
              </ModalButton>
              <ModalButton variant="primary" type="submit">
                Lưu thay đổi
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL 3: DELETE SHOP */}
      {isDeleteModalOpen && selectedShopForDelete && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Xác nhận xóa Shop"
          subtitle={`Bạn có chắc chắn muốn xóa gian hàng "${selectedShopForDelete.name}" (${selectedShopForDelete.code})?`}
          icon={Trash2}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3">
              <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold">Lưu ý về tính toàn vẹn dữ liệu:</p>
                  <p className="mt-0.5 text-amber-700 dark:text-amber-400/90 leading-relaxed">
                    Nếu shop đã có đơn hàng hoặc dữ liệu đối soát lịch sử, hệ thống sẽ tự động chuyển trạng thái shop sang <strong>Ngừng hoạt động (Tạm dừng)</strong> nhằm bảo toàn báo cáo tài chính và sổ cái kiểm toán.
                  </p>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <ModalButton
                variant="secondary"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="danger"
                onClick={handleDeleteSubmit}
                disabled={isDeleting}
              >
                {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </ModalButton>
            </ModalFooter>
          </div>
        </Modal>
      )}
    </div>
  );
};
