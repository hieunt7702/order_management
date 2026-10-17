import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Store,
  RefreshCw,
  CheckCircle,
  Trash2,
  AlertTriangle,
  Search,
  ShieldCheck,
  Package,
  DollarSign,
  MoreHorizontal,
  Edit2,
  LayoutGrid,
  List,
  Mail,
} from 'lucide-react';
import { membersApi } from '../../services/membersApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useAuthStore } from '../../stores/authStore';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import {
  SystemTableWrapper,
  SystemThead,
  SystemTh,
  SystemTbody,
  SystemTr,
  SystemTd,
  SystemTableSkeleton,
  SystemTableEmpty,
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

interface RoleOption {
  value: string;
  label: string;
  desc: string;
}

const ROLES: RoleOption[] = [
  { value: 'OWNER', label: 'Chủ sở hữu (Owner)', desc: 'Toàn quyền điều hành Workspace' },
  { value: 'ADMIN', label: 'Quản trị viên (Admin)', desc: 'Quản lý toàn bộ đơn hàng, kho, shop và nhân viên' },
  { value: 'WAREHOUSE', label: 'Nhân viên kho (Warehouse)', desc: 'Quét barcode, nhập kho, kiểm kê tồn' },
  { value: 'ACCOUNTANT', label: 'Kế toán (Accountant)', desc: 'Đối soát tiền Shopee, xem báo cáo doanh thu & lãi lỗ' },
  { value: 'VIEWER', label: 'Chỉ xem (Viewer)', desc: 'Chỉ xem báo cáo, không có quyền sửa đổi dữ liệu' },
];

export const MembersPage: React.FC = () => {
  const { shops } = useWorkspaceStore();
  const { currentTenant, user: currentUser } = useAuthStore();

  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedMemberForEdit, setSelectedMemberForEdit] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [selectedMemberForDelete, setSelectedMemberForDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Forms
  const [addForm, setAddForm] = useState({
    employeeCode: '',
    fullName: '',
    email: '',
    password: '',
    role: 'WAREHOUSE',
    allShops: true,
    allowedShopIds: [] as string[],
  });

  const generateNextEmployeeCode = () => {
    const nextSeq = members.length + 1;
    return `NV${String(nextSeq).padStart(3, '0')}`;
  };

  const handleOpenAddModal = () => {
    const code = generateNextEmployeeCode();
    setAddForm({
      employeeCode: code,
      fullName: '',
      email: `${code.toLowerCase()}@kho.internal`,
      password: `Staff@${new Date().getFullYear()}`,
      role: 'WAREHOUSE',
      allShops: true,
      allowedShopIds: [],
    });
    setIsAddModalOpen(true);
  };

  const [editForm, setEditForm] = useState({
    role: 'WAREHOUSE',
    allShops: true,
    allowedShopIds: [] as string[],
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const res: any = await membersApi.findAll();
      setMembers(res || []);
    } catch (err: any) {
      console.error('Error loading members:', err);
      toast.error('Lỗi tải danh sách thành viên', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.email || !addForm.password || !addForm.fullName) {
      toast.warning('Vui lòng điền đầy đủ họ tên, email và mật khẩu');
      return;
    }

    try {
      await membersApi.addMember({
        email: addForm.email.trim(),
        name: addForm.fullName.trim(),
        password: addForm.password,
        role: addForm.role,
        allowedShopIds: addForm.allShops ? [] : addForm.allowedShopIds,
      });
      setIsAddModalOpen(false);
      setAddForm({
        employeeCode: '',
        fullName: '',
        email: '',
        password: '',
        role: 'WAREHOUSE',
        allShops: true,
        allowedShopIds: [],
      });
      toast.success('Thêm nhân viên mới thành công!');
      loadMembers();
    } catch (err: any) {
      toast.error('Lỗi thêm nhân viên', err.message);
    }
  };

  const handleOpenEdit = (m: any) => {
    setSelectedMemberForEdit(m);
    const hasSpecificShops = Array.isArray(m.allowedShopIds) && m.allowedShopIds.length > 0;
    setEditForm({
      role: m.role || 'WAREHOUSE',
      allShops: !hasSpecificShops,
      allowedShopIds: m.allowedShopIds || [],
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberForEdit) return;

    try {
      await membersApi.updateMember(selectedMemberForEdit.id, {
        role: editForm.role,
        allowedShopIds: editForm.allShops ? [] : editForm.allowedShopIds,
      });
      setIsEditModalOpen(false);
      toast.success('Cập nhật quyền nhân viên thành công!');
      loadMembers();
    } catch (err: any) {
      toast.error('Lỗi cập nhật quyền', err.message);
    }
  };

  const handleOpenDelete = (m: any) => {
    setSelectedMemberForDelete(m);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedMemberForDelete) return;
    setIsDeleting(true);
    try {
      await membersApi.removeMember(selectedMemberForDelete.id);
      setIsDeleteModalOpen(false);
      setSelectedMemberForDelete(null);
      toast.success('Xóa thành viên thành công!');
      loadMembers();
    } catch (err: any) {
      toast.error('Lỗi xóa thành viên', err.message || 'Không thể xóa thành viên');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleShopInAddForm = (shopId: string) => {
    const set = new Set(addForm.allowedShopIds);
    if (set.has(shopId)) set.delete(shopId);
    else set.add(shopId);
    setAddForm({ ...addForm, allowedShopIds: Array.from(set) });
  };

  const toggleShopInEditForm = (shopId: string) => {
    const set = new Set(editForm.allowedShopIds);
    if (set.has(shopId)) set.delete(shopId);
    else set.add(shopId);
    setEditForm({ ...editForm, allowedShopIds: Array.from(set) });
  };

  const isOwnerOrAdmin =
    currentTenant?.role === 'OWNER' || currentTenant?.role === 'ADMIN';

  // Metrics
  const adminCount = members.filter((m) => m.role === 'ADMIN' || m.role === 'OWNER').length;
  const warehouseCount = members.filter((m) => m.role === 'WAREHOUSE').length;
  const accountantCount = members.filter((m) => m.role === 'ACCOUNTANT' || m.role === 'VIEWER').length;

  // Filter & Search
  const filteredMembers = members.filter((m) => {
    if (roleFilter !== 'ALL' && m.role !== roleFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const name = (m.user?.name || '').toLowerCase();
      const email = (m.user?.email || '').toLowerCase();
      const code = (m.employeeCode || '').toLowerCase();
      return name.includes(term) || email.includes(term) || code.includes(term);
    }
    return true;
  });

  const paginatedMembers = filteredMembers.slice((page - 1) * limit, page * limit);

  return (
    <div className="flex-1 flex flex-col min-h-fit md:min-h-0 space-y-3.5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
            <Users size={18} className="text-[#5865f2] shrink-0 sm:w-5 sm:h-5" />
            <span className="truncate">Thành viên ({members.length})</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate hidden sm:block">
            Quản lý tài khoản nhân viên, vai trò truy cập và phạm vi shop được phép thao tác
          </p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {isOwnerOrAdmin && (
            <Button
              variant="default"
              size="sm"
              onClick={handleOpenAddModal}
              className="h-8 px-2.5 sm:px-3 gap-1 sm:gap-1.5 text-xs"
            >
              <UserPlus size={14} />
              <span className="hidden sm:inline">Thêm nhân viên</span>
              <span className="sm:hidden">Thêm</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadMembers}
            className="h-8 w-8 sm:w-auto p-0 sm:px-2.5 sm:py-1 gap-1 text-xs"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden lg:inline text-xs">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
        <SystemMetricCard
          title="Tổng nhân sự"
          value={members.length}
          subtitle="Tài khoản trong Workspace"
          icon={Users}
          colorScheme="blue"
        />
        <SystemMetricCard
          title="Quản trị viên (Admin)"
          value={adminCount}
          subtitle="Toàn quyền điều hành"
          icon={ShieldCheck}
          colorScheme="purple"
        />
        <SystemMetricCard
          title="Nhân viên kho"
          value={warehouseCount}
          subtitle="Quét mã & xuất kho"
          icon={Package}
          colorScheme="orange"
        />
        <SystemMetricCard
          title="Kế toán / Xem xét"
          value={accountantCount}
          subtitle="Đối soát & Báo cáo"
          icon={DollarSign}
          colorScheme="green"
        />
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded shrink-0">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo họ tên, email, mã nhân viên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-4 py-1.5 h-8 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-2.5 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">
              Vai trò:
            </span>
            <Select
              value={roleFilter}
              onChange={(val: any) => setRoleFilter(val)}
              options={[
                { value: 'ALL', label: 'Tất cả vai trò' },
                ...ROLES.map((r) => ({ value: r.value, label: r.label })),
              ]}
              size="sm"
              className="w-40 sm:w-48"
              menuWidth="w-56"
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
        <div className="flex-1 flex flex-col min-h-fit md:min-h-0 justify-between">
          <div className="flex-1 md:overflow-y-auto pr-0.5 custom-scrollbar pb-3">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="p-4 rounded bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 animate-pulse space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-10 bg-gray-100 dark:bg-gray-800/60 rounded" />
                  <div className="h-7 bg-gray-100 dark:bg-gray-800/60 rounded" />
                </div>
              ))}
            </div>
          ) : paginatedMembers.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded">
              <Users size={36} className="mx-auto text-gray-400 mb-2" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Không tìm thấy nhân viên nào
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {searchTerm
                  ? 'Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc vai trò.'
                  : 'Chưa có thành viên nào trong Workspace. Nhấn "Thêm nhân viên" để bắt đầu.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {paginatedMembers.map((m) => {
                const roleInfo = ROLES.find((r) => r.value === m.role);
                const allowedShops = m.allowedShopIds || [];
                const isGlobal = allowedShops.length === 0;
                const isCurrent = m.userId === currentUser?.id;

                return (
                  <div
                    key={m.id}
                    className="p-4 rounded bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 hover:border-[#5865f2]/40 hover:shadow-sm transition-all duration-200 flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top: Avatar + Role Badge + Dropdown */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-[#5865f2]/10 text-[#5865f2] flex items-center justify-center font-bold text-sm shrink-0 border border-[#5865f2]/20">
                            {(m.user?.name || m.user?.email || 'U')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3
                                className="font-medium text-sm text-gray-900 dark:text-white truncate group-hover:text-[#5865f2] transition-colors"
                                title={m.user?.name || 'Nhân viên'}
                              >
                                {m.user?.name || 'Nhân viên'}
                              </h3>
                              {isCurrent && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-[#5865f2]/10 text-[#5865f2] shrink-0">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5">
                              <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                                {m.employeeCode || `NV${String(members.indexOf(m) + 1).padStart(3, '0')}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isOwnerOrAdmin && m.role !== 'OWNER' && (
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
                              <DropdownMenuItem onClick={() => handleOpenEdit(m)}>
                                <Edit2 size={13} className="text-gray-400" />
                                <span>Sửa quyền truy cập</span>
                              </DropdownMenuItem>
                              {m.userId !== currentUser?.id && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => handleOpenDelete(m)}
                                  >
                                    <Trash2 size={13} />
                                    <span>Xóa nhân viên</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      {/* Email */}
                      <div
                        className="mt-3 text-xs text-gray-500 dark:text-gray-400 font-mono truncate flex items-center gap-1.5"
                        title={m.user?.email}
                      >
                        <Mail size={12} className="text-gray-400 shrink-0" />
                        <span className="truncate">{m.user?.email || '--'}</span>
                      </div>

                      {/* Role & Scope */}
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/80 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Vai trò:</span>
                          <Badge
                            variant={
                              m.role === 'OWNER'
                                ? 'default'
                                : m.role === 'ADMIN'
                                ? 'info'
                                : m.role === 'WAREHOUSE'
                                ? 'warning'
                                : m.role === 'ACCOUNTANT'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {roleInfo?.label || m.role}
                          </Badge>
                        </div>

                        <div className="p-2.5 rounded bg-gray-50 dark:bg-[#1a1b23] border border-gray-200/60 dark:border-gray-800 text-xs">
                          <span className="text-[11px] text-gray-400 block mb-1">
                            Phạm vi shop:
                          </span>
                          {isGlobal ? (
                            <span className="text-gray-700 dark:text-gray-300 font-medium flex items-center gap-1">
                              <Store size={12} className="text-gray-400" /> Tất cả Shop ({shops.length})
                            </span>
                          ) : (
                            <span className="text-[#5865f2] font-medium flex items-center gap-1">
                              <Store size={12} /> {allowedShops.length} shop được gán
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Hoạt động
                      </span>
                      {isOwnerOrAdmin && m.role !== 'OWNER' && (
                        <Button
                          variant="outline"
                          size="xs"
                          className="text-[11px] gap-1"
                          onClick={() => handleOpenEdit(m)}
                        >
                          <Edit2 size={11} />
                          <span>Sửa quyền</span>
                        </Button>
                      )}
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
              totalPages={Math.ceil(filteredMembers.length / limit) || 1}
              totalItems={filteredMembers.length}
              setPage={(p) => setPage(p + 1)}
              itemsPerPage={limit}
              setItemsPerPage={setLimit}
            />
          </div>
        </div>
      ) : (
        /* Members Table */
        <div className="hidden md:flex flex-1 flex-col min-h-0">
          <SystemTableWrapper
            tableClassName="min-w-[850px]"
            pagination={
              <SystemPagination
                page={page - 1}
                totalPages={Math.ceil(filteredMembers.length / limit) || 1}
                totalItems={filteredMembers.length}
                setPage={(p) => setPage(p + 1)}
                itemsPerPage={limit}
                setItemsPerPage={setLimit}
              />
            }
          >
            <SystemThead>
              <SystemTr>
                <SystemTh className="w-14 text-center" align="center">STT</SystemTh>
                <SystemTh align="left">Nhân viên / Họ tên</SystemTh>
                <SystemTh align="left">Email đăng nhập</SystemTh>
                <SystemTh align="center">Vai trò</SystemTh>
                <SystemTh align="left">Phạm vi Shop</SystemTh>
                <SystemTh align="center">Trạng thái</SystemTh>
                <SystemTh align="center">Thao tác</SystemTh>
              </SystemTr>
            </SystemThead>
            <SystemTbody>
              {isLoading ? (
                <SystemTableSkeleton cols={7} rows={7} />
              ) : paginatedMembers.length === 0 ? (
                <SystemTableEmpty
                  colSpan={7}
                  title="Không tìm thấy nhân viên nào"
                  description={
                    searchTerm
                      ? 'Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc vai trò.'
                      : 'Chưa có thành viên nào trong Workspace. Nhấn "Thêm nhân viên" để bắt đầu.'
                  }
                />
              ) : (
                paginatedMembers.map((m, index) => {
                  const roleInfo = ROLES.find((r) => r.value === m.role);
                  const allowedShops = m.allowedShopIds || [];
                  const isGlobal = allowedShops.length === 0;
                  const stt = (page - 1) * limit + index + 1;

                  return (
                    <SystemTr key={m.id}>
                      <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                        {stt}
                      </SystemTd>
                      <SystemTd>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#5865f2]/10 text-[#5865f2] flex items-center justify-center font-semibold text-xs shrink-0">
                            {(m.user?.name || m.user?.email || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {m.user?.name || 'Nhân viên'}
                              </span>
                              <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                                {m.employeeCode || `NV${String(members.indexOf(m) + 1).padStart(3, '0')}`}
                              </span>
                            </div>
                            {m.userId === currentUser?.id && (
                              <span className="text-[10px] text-[#5865f2] font-medium">
                                (Tài khoản của bạn)
                              </span>
                            )}
                          </div>
                        </div>
                      </SystemTd>

                      <SystemTd className="font-mono text-gray-600 dark:text-gray-400">
                        {m.user?.email || '--'}
                      </SystemTd>

                      <SystemTd align="center">
                        <Badge
                          variant={
                            m.role === 'OWNER'
                              ? 'default'
                              : m.role === 'ADMIN'
                              ? 'info'
                              : m.role === 'WAREHOUSE'
                              ? 'warning'
                              : m.role === 'ACCOUNTANT'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {roleInfo?.label || m.role}
                        </Badge>
                      </SystemTd>

                      <SystemTd>
                        {isGlobal ? (
                          <span className="text-gray-700 dark:text-gray-300 font-medium text-xs">
                            Tất cả shop trong Workspace
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#5865f2] font-medium text-xs">
                            <Store size={13} /> {allowedShops.length} shop được chỉ định
                          </span>
                        )}
                      </SystemTd>

                      <SystemTd align="center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle size={11} /> Hoạt động
                        </span>
                      </SystemTd>

                      <SystemTd align="center">
                        {isOwnerOrAdmin && m.role !== 'OWNER' ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                              <MoreHorizontal size={15} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem
                                onClick={() => handleOpenEdit(m)}
                                className="gap-2 cursor-pointer text-xs"
                              >
                                <Edit2 size={13} />
                                <span>Sửa quyền</span>
                              </DropdownMenuItem>
                              {m.userId !== currentUser?.id && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => handleOpenDelete(m)}
                                    className="gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer text-xs"
                                  >
                                    <Trash2 size={13} />
                                    <span>Xóa nhân viên</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 text-xs">--</span>
                        )}
                      </SystemTd>
                    </SystemTr>
                  );
                })
              )}
            </SystemTbody>
          </SystemTableWrapper>
        </div>
      )}

      {/* MODAL 1: ADD MEMBER */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title={
            <div className="flex items-center gap-2 min-w-0">
              <span className="sm:hidden font-semibold truncate">Thêm nhân viên</span>
              <span className="hidden sm:inline font-semibold truncate">Thêm nhân viên mới</span>
            </div>
          }
          subtitle={
            <div className="min-w-0 truncate">
              <span className="sm:hidden truncate">Tạo tài khoản & phân quyền</span>
              <span className="hidden sm:inline truncate">Tạo tài khoản và thiết lập vai trò phân quyền cho nhân viên trong Workspace</span>
            </div>
          }
          icon={UserPlus}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleAddSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-3.5 p-3 sm:p-5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Mã nhân viên *
                    </label>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-medium">
                      Tự sinh
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const code = generateNextEmployeeCode();
                      setAddForm((prev) => ({
                        ...prev,
                        employeeCode: code,
                        email: `${code.toLowerCase()}@kho.internal`,
                      }));
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-[#5865f2] hover:underline font-medium cursor-pointer"
                    title="Đổi mã nhân viên mới"
                  >
                    <RefreshCw size={11} /> Đổi mã
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={addForm.employeeCode}
                  onChange={(e) => setAddForm({ ...addForm, employeeCode: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs font-mono uppercase bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Họ và tên nhân viên *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn Kho"
                  value={addForm.fullName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setAddForm((prev) => ({
                      ...prev,
                      fullName: name,
                    }));
                  }}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Email đăng nhập *
                </label>
                <input
                  type="email"
                  required
                  placeholder="kho@congty.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Mật khẩu khởi tạo *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Tối thiểu 8 ký tự"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Vai trò chức vụ *
                </label>
                <Select
                  value={addForm.role}
                  onChange={(val: any) => setAddForm({ ...addForm, role: val })}
                  options={ROLES.filter((r) => r.value !== 'OWNER').map((r) => ({
                    value: r.value,
                    label: `${r.label} - ${r.desc}`,
                  }))}
                  size="md"
                  className="w-full"
                  menuWidth="w-full"
                />
              </div>

              {/* Shop Scope */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <label className="block text-xs font-bold text-gray-900 dark:text-white mb-2">
                  Phạm vi quản lý Shop
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="addShopScope"
                      checked={addForm.allShops}
                      onChange={() => setAddForm({ ...addForm, allShops: true })}
                      className="text-[#5865f2]"
                    />
                    Cho phép truy cập tất cả shop trong Workspace
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="addShopScope"
                      checked={!addForm.allShops}
                      onChange={() => setAddForm({ ...addForm, allShops: false })}
                      className="text-[#5865f2]"
                    />
                    Chỉ giới hạn ở các shop được chọn bên dưới
                  </label>
                </div>

                {!addForm.allShops && (
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-[#131720] rounded border border-gray-200 dark:border-gray-700 space-y-1.5 max-h-40 overflow-y-auto">
                    {shops.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={addForm.allowedShopIds.includes(s.id)}
                          onChange={() => toggleShopInAddForm(s.id)}
                          className="w-3.5 h-3.5 text-[#5865f2] rounded cursor-pointer"
                        />
                        <span>
                          {s.name} ({s.code})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsAddModalOpen(false)}
                className="gap-1.5 flex-none px-4 py-2.5 sm:py-1.5 text-xs font-semibold shrink-0"
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="primary"
                type="submit"
                className="gap-1.5 flex-1 sm:flex-none py-2.5 sm:py-1.5 px-4 font-semibold text-xs active:scale-95 justify-center"
              >
                Tạo nhân viên
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL 2: EDIT MEMBER ROLE & SHOP SCOPE */}
      {isEditModalOpen && selectedMemberForEdit && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={
            <div className="flex items-center gap-2 min-w-0">
              <span className="sm:hidden font-semibold truncate">Sửa quyền</span>
              <span className="hidden sm:inline font-semibold truncate">Chỉnh sửa quyền nhân viên</span>
            </div>
          }
          subtitle={
            <div className="min-w-0 truncate">
              <span className="sm:hidden truncate">Vai trò: {selectedMemberForEdit.user?.name || selectedMemberForEdit.user?.email}</span>
              <span className="hidden sm:inline truncate">Cập nhật vai trò và phạm vi shop cho {selectedMemberForEdit.user?.email || ''}</span>
            </div>
          }
          icon={Users}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-3.5 p-3 sm:p-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Vai trò chức vụ *
                </label>
                <Select
                  value={editForm.role}
                  onChange={(val: any) => setEditForm({ ...editForm, role: val })}
                  options={ROLES.filter((r) => r.value !== 'OWNER').map((r) => ({
                    value: r.value,
                    label: `${r.label} - ${r.desc}`,
                  }))}
                  size="md"
                  className="w-full"
                  menuWidth="w-full"
                />
              </div>

              {/* Shop Scope */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <label className="block text-xs font-bold text-gray-900 dark:text-white mb-2">
                  Phạm vi quản lý Shop
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="editShopScope"
                      checked={editForm.allShops}
                      onChange={() => setEditForm({ ...editForm, allShops: true })}
                      className="text-[#5865f2]"
                    />
                    Cho phép truy cập tất cả shop trong Workspace
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="editShopScope"
                      checked={!editForm.allShops}
                      onChange={() => setEditForm({ ...editForm, allShops: false })}
                      className="text-[#5865f2]"
                    />
                    Chỉ giới hạn ở các shop được chọn bên dưới
                  </label>
                </div>

                {!editForm.allShops && (
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-[#131720] rounded border border-gray-200 dark:border-gray-700 space-y-1.5 max-h-40 overflow-y-auto">
                    {shops.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={editForm.allowedShopIds.includes(s.id)}
                          onChange={() => toggleShopInEditForm(s.id)}
                          className="w-3.5 h-3.5 text-[#5865f2] rounded cursor-pointer"
                        />
                        <span>
                          {s.name} ({s.code})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsEditModalOpen(false)}
                className="gap-1.5 flex-none px-4 py-2.5 sm:py-1.5 text-xs font-semibold shrink-0"
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="primary"
                type="submit"
                className="gap-1.5 flex-1 sm:flex-none py-2.5 sm:py-1.5 px-4 font-semibold text-xs active:scale-95 justify-center"
              >
                <span className="sm:hidden">Lưu</span>
                <span className="hidden sm:inline">Lưu thay đổi</span>
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL 3: DELETE MEMBER */}
      {isDeleteModalOpen && selectedMemberForDelete && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Xác nhận xóa thành viên"
          subtitle={`Xóa tài khoản ${selectedMemberForDelete.user?.name || selectedMemberForDelete.user?.email} khỏi Workspace`}
          icon={Trash2}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 p-3 sm:p-5">
              <div className="p-3 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 flex items-start gap-2.5 text-xs text-red-800 dark:text-red-300">
                <AlertTriangle size={16} className="shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <p className="font-semibold">Hành động không thể hoàn tác:</p>
                  <p className="mt-0.5 text-red-700 dark:text-red-400/90 leading-relaxed text-[11px] sm:text-xs">
                    Thành viên này sẽ mất toàn bộ quyền truy cập vào Workspace và các dữ liệu liên quan.
                  </p>
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="gap-1.5 flex-none px-4 py-2.5 sm:py-1.5 text-xs font-semibold shrink-0"
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="danger"
                onClick={handleDeleteSubmit}
                disabled={isDeleting}
                className="gap-1.5 flex-1 sm:flex-none py-2.5 sm:py-1.5 px-4 font-semibold text-xs active:scale-95 justify-center"
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
