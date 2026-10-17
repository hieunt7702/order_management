import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { warehousesApi } from '../../services/warehousesApi';
import { useAuthStore } from '../../stores/authStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '../../components/ui/Card';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import {
  SystemThead,
  SystemTh,
  SystemTbody,
  SystemTr,
  SystemTd,
} from '../../components/ui/SystemTable';
import { toast } from '../../components/ui/Toast';

export const SettingsPage: React.FC = () => {
  const { currentTenant } = useAuthStore();
  const { warehouses, setContextData } = useWorkspaceStore();

  const [, setIsLoadingWh] = useState<boolean>(false);

  // Modals
  const [isCreateWhModalOpen, setIsCreateWhModalOpen] = useState<boolean>(false);
  const [isEditWhModalOpen, setIsEditWhModalOpen] = useState<boolean>(false);
  const [selectedWhForEdit, setSelectedWhForEdit] = useState<any>(null);
  const [isDeleteWhModalOpen, setIsDeleteWhModalOpen] = useState<boolean>(false);
  const [selectedWhForDelete, setSelectedWhForDelete] = useState<any>(null);
  const [isDeletingWh, setIsDeletingWh] = useState<boolean>(false);

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
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    setIsLoadingWh(true);
    try {
      const res: any = await warehousesApi.findAll();
      setContextData({ warehouses: res || [] });
    } catch (err) {
      console.error('Error loading warehouses:', err);
    } finally {
      setIsLoadingWh(false);
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
              Cấu hình kho hàng, thông tin Workspace và tùy biến thông số vận hành
            </p>
          </div>
        </div>
      </div>

      {/* Workspace Card */}
      <Card className="shrink-0">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Building2 size={16} className="text-[#5865f2]" /> Thông tin Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800">
              <span className="text-gray-500 dark:text-gray-400">Tên Doanh nghiệp:</span>
              <div className="font-medium text-gray-900 dark:text-white text-sm mt-0.5">
                {currentTenant?.name || '--'}
              </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800">
              <span className="text-gray-500 dark:text-gray-400">Mã Workspace:</span>
              <div className="font-mono font-medium text-[#5865f2] text-sm mt-0.5">
                {currentTenant?.code || '--'}
              </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800">
              <span className="text-gray-500 dark:text-gray-400">Vai trò của bạn:</span>
              <div className="font-medium text-[#5865f2] text-sm mt-0.5">
                {currentTenant?.role || 'MEMBER'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warehouses Management Card */}
      <Card className="shrink-0">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Warehouse size={16} className="text-[#5865f2]" /> Quản lý Kho hàng ({warehouses.length})
          </CardTitle>
          <CardAction>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsCreateWhModalOpen(true)}
              className="gap-1.5"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Thêm kho mới</span>
              <span className="sm:hidden">Thêm mới</span>
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto border-t border-gray-200 dark:border-gray-800">
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
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Scan size={16} className="text-[#5865f2]" /> Cấu hình máy quét & Vận hành
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2.5">
          <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
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
            <input
              type="checkbox"
              checked={scannerSound}
              onChange={(e) => setScannerSound(e.target.checked)}
              className="w-4 h-4 text-[#5865f2] rounded border-gray-300 focus:ring-[#5865f2] cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
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
            <input
              type="checkbox"
              checked={autoSelectNext}
              onChange={(e) => setAutoSelectNext(e.target.checked)}
              className="w-4 h-4 text-[#5865f2] rounded border-gray-300 focus:ring-[#5865f2] cursor-pointer"
            />
          </label>
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

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isWhActiveCheck"
                  checked={editWhForm.isActive}
                  onChange={(e) => setEditWhForm({ ...editWhForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-[#5865f2] rounded border-gray-300 focus:ring-[#5865f2] cursor-pointer"
                />
                <label
                  htmlFor="isWhActiveCheck"
                  className="text-xs text-gray-700 dark:text-gray-300 font-medium cursor-pointer"
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
    </div>
  );
};
