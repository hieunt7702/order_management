import React, { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { importsApi } from '../../services/importsApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { Select } from '../../components/ui/Select';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SystemMetricPairCard } from '../../components/ui/SystemMetricCard';

export const ImportsPage: React.FC = () => {
  const { shops, selectedShopId, warehouses, selectedWarehouseId } =
    useWorkspaceStore();

  const [shopId, setShopId] = useState<string>(
    selectedShopId !== 'ALL' ? selectedShopId : shops[0]?.id || '',
  );
  const [warehouseId, setWarehouseId] = useState<string>(
    selectedWarehouseId || '',
  );
  const [file, setFile] = useState<File | null>(null);

  // Automatically sync shopId when selectedShopId in AppHeader changes
  useEffect(() => {
    if (selectedShopId && selectedShopId !== 'ALL') {
      setShopId(selectedShopId);
    } else if (!shopId && shops.length > 0) {
      setShopId(shops[0].id);
    }
  }, [selectedShopId, shops]);

  const [step, setStep] = useState<number>(1); // 1: Upload, 2: Preview, 3: Completed
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [autoReserve, setAutoReserve] = useState<boolean>(true);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [confirmResult, setConfirmResult] = useState<any>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !shopId) {
      alert('Vui lòng chọn Shop và file dữ liệu');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const res = await importsApi.uploadFile(
        file,
        shopId,
        warehouseId || undefined,
      );
      setUploadResult(res);
      setStep(2); // Move to Preview
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải lên và phân tích file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!uploadResult?.importJobId) return;

    setIsConfirming(true);
    setError(null);

    try {
      const res = await importsApi.confirmImport(
        uploadResult.importJobId,
        autoReserve,
      );
      setConfirmResult(res);
      setStep(3); // Completed
    } catch (err: any) {
      setError(err.message || 'Lỗi khi áp dụng import đơn hàng');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setUploadResult(null);
    setConfirmResult(null);
    setError(null);
    setStep(1);
  };

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-300">
      {/* Page Header */}
      <div>
        <h1 className="text-lg md:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <FileSpreadsheet size={20} className="text-[#5865f2]" />
          Import Đơn Hàng Shopee (Excel / CSV)
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Tự động phân tích file xuất 62 cột từ Kênh người bán, gom nhóm đơn
          nhiều dòng, bảo toàn chuỗi mã số và giữ hàng nguyên tử
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle size={15} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step Indicator */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 text-center text-[11px] sm:text-xs font-medium">
        <div
          className={`p-2 sm:p-2.5 rounded border transition-colors ${
            step >= 1
              ? 'bg-[#5865f2]/10 border-[#5865f2] text-[#5865f2] font-semibold'
              : 'bg-white dark:bg-[#14151a] text-gray-400 border-gray-200 dark:border-gray-800'
          }`}
        >
          1. Chọn Shop & File
        </div>

        <div
          className={`p-2 sm:p-2.5 rounded border transition-colors ${
            step >= 2
              ? 'bg-[#5865f2]/10 border-[#5865f2] text-[#5865f2] font-semibold'
              : 'bg-white dark:bg-[#14151a] text-gray-400 border-gray-200 dark:border-gray-800'
          }`}
        >
          2. Kiểm Tra SKU
        </div>

        <div
          className={`p-2 sm:p-2.5 rounded border transition-colors ${
            step >= 3
              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'bg-white dark:bg-[#14151a] text-gray-400 border-gray-200 dark:border-gray-800'
          }`}
        >
          3. Hoàn Tất
        </div>
      </div>

      {/* STEP 1: Upload Form */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Cấu hình nhập file</CardTitle>
            <CardDescription>
              Chọn shop nhận đơn và tải lên file dữ liệu báo cáo đơn hàng xuất từ
              Shopee
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Chọn Shop nhập đơn *
                  </label>
                  <Select
                    value={shopId}
                    onChange={(val) => setShopId(String(val))}
                    options={[
                      { value: '', label: '-- Chọn Shop --' },
                      ...shops.map((s: any) => ({
                        value: s.id,
                        label: `${s.name} (${s.code || s.name})`,
                      })),
                    ]}
                    placeholder="-- Chọn Shop --"
                    size="md"
                    className="w-full"
                    menuWidth="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Kho xuất hàng mặc định (Tùy chọn)
                  </label>
                  <Select
                    value={warehouseId}
                    onChange={(val) => setWarehouseId(String(val))}
                    options={[
                      { value: '', label: 'Lấy theo kho mặc định của Shop' },
                      ...warehouses.map((w: any) => ({
                        value: w.id,
                        label: `${w.name} (${w.code})`,
                      })),
                    ]}
                    placeholder="Lấy theo kho mặc định của Shop"
                    size="md"
                    className="w-full"
                    menuWidth="w-full"
                  />
                </div>
              </div>

              {/* File Drag & Drop Zone */}
              <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-[#5865f2] dark:hover:border-[#5865f2] rounded p-8 text-center space-y-2 cursor-pointer transition-colors relative bg-gray-50/30 dark:bg-[#14151a]/50">
                <input
                  type="file"
                  required
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="w-12 h-12 rounded-full bg-[#5865f2]/10 text-[#5865f2] flex items-center justify-center mx-auto">
                  <UploadCloud size={24} strokeWidth={1.5} />
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                  {file
                    ? file.name
                    : 'Nhấp để chọn file hoặc kéo thả file Excel Shopee vào đây'}
                </p>
                <p className="text-xs text-gray-400">
                  Hỗ trợ định dạng .xlsx, .xls, .csv từ Kênh người bán Shopee (tối
                  đa 25MB)
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={isUploading || !file || !shopId}
                  loading={isUploading}
                  className="px-5 gap-2"
                >
                  <span>
                    {isUploading ? 'Đang phân tích...' : 'Tải lên & Phân tích'}
                  </span>
                  <ArrowRight size={14} />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Preview & Validation */}
      {step === 2 && uploadResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  Kết quả phân tích: {uploadResult.fileName}
                </CardTitle>
                <CardDescription>
                  Mã Job: {uploadResult.importJobId}
                </CardDescription>
              </div>
              <Badge variant="default">SẴN SÀNG ÁP DỤNG</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 shrink-0">
              <SystemMetricPairCard
                leftItem={{
                  title: 'Tổng đơn nhận diện',
                  value: uploadResult.totalOrders,
                  subtitle: 'Đơn trong file',
                  icon: FileSpreadsheet,
                  colorScheme: 'blue',
                }}
                rightItem={{
                  title: 'Đơn mới hoàn toàn',
                  value:
                    uploadResult.newOrderCount !== undefined
                      ? uploadResult.newOrderCount
                      : uploadResult.totalOrders,
                  subtitle: 'Tạo mới',
                  icon: CheckCircle2,
                  colorScheme: 'green',
                }}
              />
              <SystemMetricPairCard
                leftItem={{
                  title: 'Đơn trùng (Cập nhật)',
                  value: uploadResult.duplicateOrderCount || 0,
                  subtitle: 'Cập nhật trạng thái',
                  icon: RefreshCw,
                  colorScheme: 'purple',
                }}
                rightItem={{
                  title: 'SKU chưa map',
                  value: uploadResult.unmappedSkuCount,
                  subtitle:
                    uploadResult.unmappedSkuCount > 0 ? 'Cần ánh xạ' : 'Hoàn hảo',
                  icon: AlertTriangle,
                  colorScheme:
                    uploadResult.unmappedSkuCount > 0 ? 'red' : 'green',
                }}
              />
            </div>

            {/* Deduplication & Latest Status Info Banner */}
            {uploadResult.duplicateOrderCount > 0 && (
              <div className="p-3.5 rounded bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <div className="flex items-center gap-1.5 font-medium">
                  <RefreshCw size={14} className="text-[#5865f2]" />
                  <span>
                    Lọc trùng & Cập nhật trạng thái theo file mới nhất:
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                  Phát hiện{' '}
                  <strong>{uploadResult.duplicateOrderCount} đơn hàng</strong> đã
                  có sẵn trong Shop này. Hệ thống sẽ{' '}
                  <strong>tự động cập nhật trạng thái mới nhất</strong> theo file
                  này mà không tạo bản ghi trùng lặp.
                </p>
              </div>
            )}

            {/* Unmapped SKUs Warning */}
            {uploadResult.unmappedSkuCount > 0 && (
              <div className="p-3.5 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle size={14} />
                  <span>
                    Có {uploadResult.unmappedSkuCount} SKU sàn chưa được liên kết
                    với SKU nội bộ:
                  </span>
                </div>
                <p className="text-xs opacity-90 text-gray-600 dark:text-gray-300">
                  Các đơn hàng chứa SKU này vẫn sẽ được nhập vào hệ thống nhưng sẽ
                  ở trạng thái UNMAPPED và bị chặn xuất kho cho tới khi được
                  mapping.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {uploadResult.unmappedSkus?.map((sku: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-amber-500/20 font-mono text-[11px] font-semibold"
                    >
                      {sku}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Auto Reserve Checkbox */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="autoReserve"
                checked={autoReserve}
                onChange={(e) => setAutoReserve(e.target.checked)}
                className="rounded text-[#5865f2] focus:ring-[#5865f2] border-gray-300 dark:border-gray-700"
              />
              <label
                htmlFor="autoReserve"
                className="text-xs text-gray-700 dark:text-gray-300 font-normal"
              >
                Tự động giữ hàng (reserve) cho các đơn hàng có đủ mapping và đủ
                số lượng khả dụng trong kho
              </label>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-800">
              <Button variant="outline" size="sm" onClick={handleReset}>
                Hủy bỏ & Chọn file khác
              </Button>

              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={isConfirming}
                loading={isConfirming}
                className="gap-2"
              >
                <span>
                  {isConfirming
                    ? 'Đang áp dụng batch...'
                    : 'Xác nhận Import Đơn Hàng'}
                </span>
                <CheckCircle2 size={15} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Completed */}
      {step === 3 && confirmResult && (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 size={30} strokeWidth={1.5} />
            </div>

            <div>
              <h2 className="text-base font-medium text-gray-900 dark:text-white">
                Import Đơn Hàng Hoàn Tất!
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {confirmResult.message}
              </p>
            </div>

            <div className="max-w-md mx-auto grid grid-cols-3 gap-2.5 text-xs text-center py-2">
              <div className="p-3 rounded bg-gray-50 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800">
                <span className="text-[11px] text-gray-400">Đơn mới</span>
                <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
                  {confirmResult.job?.newOrdersCount || 0}
                </p>
              </div>

              <div className="p-3 rounded bg-gray-50 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800">
                <span className="text-[11px] text-gray-400">Đơn cập nhật</span>
                <p className="font-bold text-blue-600 dark:text-blue-400 text-sm mt-0.5">
                  {confirmResult.job?.updatedOrdersCount || 0}
                </p>
              </div>

              <div className="p-3 rounded bg-gray-50 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800">
                <span className="text-[11px] text-gray-400">Đơn lỗi</span>
                <p className="font-bold text-red-600 dark:text-red-400 text-sm mt-0.5">
                  {confirmResult.job?.errorCount || 0}
                </p>
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                Tiếp tục import file khác
              </Button>

              <Button
                size="sm"
                onClick={() => (window.location.href = '/orders')}
              >
                Xem danh sách đơn hàng
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
