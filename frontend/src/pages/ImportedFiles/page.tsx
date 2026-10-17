import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  XCircle,
  FileSpreadsheet,
  Trash2,
  CheckCircle,
  Truck,
  Folder,
  ClipboardList,
  CircleDollarSign,
  PieChart,
  Search,
  LayoutGrid,
  List,
  Eye,
  Plus,
  ChevronDown,
  CloudUpload,
  RotateCcw,
  X,
  ShoppingBag,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SystemMetricCard,
  SystemCompactMetricsBar,
} from '../../components/ui/SystemMetricCard';
import { SystemFilter } from '../../components/ui/SystemFilter';
import { Button } from '../../components/ui/Button';
import {
  SystemTableWrapper,
  SystemThead,
  SystemTbody,
  SystemTr,
  SystemTh,
  SystemTd,
  SystemPagination,
  SystemTableEmpty,
  SystemTableSkeleton,
} from '../../components/ui/SystemTable';
import { Select } from '../../components/ui/Select';
import {
  getImportedFiles,
  deleteImportedFile,
  saveAndMergeOrders,
} from '../../utils/storage';
import {
  parseExcelFile,
  normalizeOrders,
  calculateFileSummary,
  formatCurrency,
} from '../../utils';
import { ORDER_STATUS } from '../../constants';

export const ImportedFilesPage: React.FC = () => {
  const [importedFiles, setImportedFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [, setIsDragging] = useState<boolean>(false);
  const [isMetricsExpanded, setIsMetricsExpanded] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preview & Delete modal states
  const [previewData, setPreviewData] = useState<any>(null);
  const [normalizedPreview, setNormalizedPreview] = useState<any[] | null>(null);
  const [fileToDelete, setFileToDelete] = useState<any>(null);

  // Pagination & Filtering state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(100);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const savedFiles = await getImportedFiles();
      setImportedFiles(savedFiles || []);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const processFile = async (file: File | undefined) => {
    if (!file) return;

    const fileType = file.name.split('.').pop()?.toLowerCase();
    if (fileType !== 'xlsx' && fileType !== 'xls') {
      setError('Vui lòng chọn file Excel (.xlsx, .xls)');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const rawJsonData: any[] = await parseExcelFile(file);

      if (rawJsonData && rawJsonData.length > 0) {
        const fileId = `import_${Date.now()}`;
        const normalized = normalizeOrders(rawJsonData, fileId);

        if (normalized.length === 0) {
          setError('Không tìm thấy dữ liệu đơn hàng hợp lệ trong file.');
          setIsLoading(false);
          return;
        }

        setPreviewData({
          file: file,
          id: fileId,
          total: normalized.length,
          completed: normalized.filter((o) => o.status === ORDER_STATUS.COMPLETED).length,
          delivering: normalized.filter((o) => o.status === ORDER_STATUS.DELIVERING).length,
          cancelled: normalized.filter((o) => o.status === ORDER_STATUS.CANCELLED).length,
          returned: normalized.filter((o) => o.status === ORDER_STATUS.RETURNED).length,
          summary: calculateFileSummary(normalized),
        });
        setNormalizedPreview(normalized);
      } else {
        setError('File trống hoặc không đúng định dạng.');
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi khi đọc file Excel. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !normalizedPreview) return;

    setIsLoading(true);
    try {
      const firstOrder = normalizedPreview[0];
      const orderDate = new Date(firstOrder.orderDate);
      const period = `${String(orderDate.getMonth() + 1).padStart(2, '0')}/${orderDate.getFullYear()}`;

      const fileInfo = {
        id: previewData.id,
        name: previewData.file.name,
        size: previewData.file.size,
        period: period,
        summary: previewData.summary,
      };

      await saveAndMergeOrders(normalizedPreview, fileInfo);

      setPreviewData(null);
      setNormalizedPreview(null);
      await loadData();
    } catch {
      setError('Có lỗi xảy ra khi lưu dữ liệu vào DB.');
      setIsLoading(false);
    }
  };

  const handleCancelImport = () => {
    setPreviewData(null);
    setNormalizedPreview(null);
    setError('');
  };

  const requestDeleteFile = (file: any) => {
    setFileToDelete(file);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    setIsLoading(true);
    try {
      await deleteImportedFile(fileToDelete.id);
      setFileToDelete(null);
      await loadData();
    } catch (err) {
      console.error(err);
      setError('Có lỗi xảy ra khi xóa file.');
    } finally {
      setIsLoading(false);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, []);

  // Compute Metrics
  const totalOrdersCount = importedFiles.reduce((sum, f) => sum + (f.totalOrders || 0), 0);
  const totalRevenueAll = importedFiles.reduce((sum, f) => sum + (f.summary?.revenue || 0), 0);
  const latestImportDate =
    importedFiles.length > 0
      ? new Date(Math.max(...importedFiles.map((f) => new Date(f.importedAt).getTime())))
      : null;
  const latestImportFormatted = latestImportDate
    ? `${String(latestImportDate.getDate()).padStart(2, '0')}/${String(latestImportDate.getMonth() + 1).padStart(2, '0')}/${latestImportDate.getFullYear()} ${String(latestImportDate.getHours()).padStart(2, '0')}:${String(latestImportDate.getMinutes()).padStart(2, '0')}`
    : '--/--/----';

  const filteredFiles = importedFiles.filter(
    (f) =>
      f.fileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.period?.includes(searchTerm),
  );
  const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);
  const currentFiles = filteredFiles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const isFiltering = searchTerm !== '';
  const formatPct = (val: number, total: number) =>
    total > 0 ? `${((val / total) * 100).toFixed(1).replace('.', ',')}%` : '0%';

  return (
    <>
      {/* --- CONFIRM IMPORT MODAL --- */}
      <AnimatePresence>
        {previewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelImport}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-[760px] max-w-full bg-[#131720] border border-gray-800 rounded p-6 shadow-2xl overflow-hidden text-gray-200"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between mb-5 pb-2">
                <div className="flex items-center gap-3.5">
                  <div className="relative w-12 h-12 rounded bg-[#3b82f6]/20 border border-[#3b82f6]/40 flex items-center justify-center text-[#3b82f6]">
                    <CloudUpload size={24} />
                    <div className="absolute -bottom-1 -right-1 bg-[#10b981] text-white text-[9px] font-extrabold px-1 py-0.5 rounded shadow">
                      XLSX
                    </div>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white leading-tight">
                      Xác nhận Import dữ liệu
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Vui lòng kiểm tra thông tin trước khi import dữ liệu vào hệ thống.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCancelImport}
                  className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Section 1: File Info Card */}
              <div className="bg-[#1a1f2b] border border-gray-800 rounded p-4 mb-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded bg-[#10b981]/15 text-[#10b981] flex items-center justify-center shrink-0 border border-[#10b981]/30">
                  <FileSpreadsheet size={22} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      className="text-sm font-bold text-white truncate"
                      title={previewData.file.name}
                    >
                      {previewData.file.name}
                    </h3>
                    <span className="bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0">
                      XLSX
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Kích thước: {(previewData.file.size / (1024 * 1024)).toFixed(2)} MB • Ngày import:{' '}
                    {new Date().toLocaleDateString('vi-VN')}{' '}
                    {new Date().toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {/* Section 2: Data Summary Grid */}
              <div className="mb-5">
                <h3 className="text-xs font-bold text-white mb-3">Tóm tắt dữ liệu</h3>
                <div className="grid grid-cols-5 gap-3">
                  <div className="bg-[#1a1f2b] border border-gray-800 rounded p-3 text-center flex flex-col items-center justify-center aspect-square transition-colors hover:border-gray-700">
                    <div className="w-9 h-9 rounded bg-[#5865f2]/15 text-[#5865f2] flex items-center justify-center mb-2">
                      <ShoppingBag size={18} />
                    </div>
                    <span className="text-lg font-bold text-white leading-tight">
                      {previewData.total}
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium mt-1">
                      Tổng đơn hàng
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold mt-0.5">100%</span>
                  </div>

                  <div className="bg-[#1a1f2b] border border-gray-800 rounded p-3 text-center flex flex-col items-center justify-center aspect-square transition-colors hover:border-gray-700">
                    <div className="w-9 h-9 rounded bg-[#10b981]/15 text-[#10b981] flex items-center justify-center mb-2">
                      <CheckCircle size={18} />
                    </div>
                    <span className="text-lg font-bold text-white leading-tight">
                      {previewData.completed}
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium mt-1">
                      Đơn hoàn thành
                    </span>
                    <span className="text-[11px] text-[#10b981] font-bold mt-0.5">
                      ({formatPct(previewData.completed, previewData.total)})
                    </span>
                  </div>

                  <div className="bg-[#1a1f2b] border border-gray-800 rounded p-3 text-center flex flex-col items-center justify-center aspect-square transition-colors hover:border-gray-700">
                    <div className="w-9 h-9 rounded bg-[#3b82f6]/15 text-[#3b82f6] flex items-center justify-center mb-2">
                      <Truck size={18} />
                    </div>
                    <span className="text-lg font-bold text-white leading-tight">
                      {previewData.delivering}
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium mt-1">
                      Đơn đang giao
                    </span>
                    <span className="text-[11px] text-[#3b82f6] font-bold mt-0.5">
                      ({formatPct(previewData.delivering, previewData.total)})
                    </span>
                  </div>

                  <div className="bg-[#1a1f2b] border border-gray-800 rounded p-3 text-center flex flex-col items-center justify-center aspect-square transition-colors hover:border-gray-700">
                    <div className="w-9 h-9 rounded bg-[#ef4444]/15 text-[#ef4444] flex items-center justify-center mb-2">
                      <XCircle size={18} />
                    </div>
                    <span className="text-lg font-bold text-white leading-tight">
                      {previewData.cancelled}
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium mt-1">Đơn đã hủy</span>
                    <span className="text-[11px] text-[#ef4444] font-bold mt-0.5">
                      ({formatPct(previewData.cancelled, previewData.total)})
                    </span>
                  </div>

                  <div className="bg-[#1a1f2b] border border-gray-800 rounded p-3 text-center flex flex-col items-center justify-center aspect-square transition-colors hover:border-gray-700">
                    <div className="w-9 h-9 rounded bg-[#f59e0b]/15 text-[#f59e0b] flex items-center justify-center mb-2">
                      <RotateCcw size={18} />
                    </div>
                    <span className="text-lg font-bold text-white leading-tight">
                      {previewData.returned}
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium mt-1">
                      Đơn hoàn tiền
                    </span>
                    <span className="text-[11px] text-[#f59e0b] font-bold mt-0.5">
                      ({formatPct(previewData.returned, previewData.total)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Info Box */}
              <div className="bg-[#162338]/60 border border-[#3b82f6]/30 rounded p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded bg-[#3b82f6] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                    i
                  </div>
                  <h4 className="text-xs font-bold text-white">Lưu ý trước khi import</h4>
                </div>
                <ul className="text-xs text-gray-300 space-y-1 pl-7 list-disc">
                  <li>Dữ liệu sẽ được import và lưu vào hệ thống.</li>
                  <li>
                    Sau khi import thành công, bạn có thể xem và phân tích dữ liệu ngay lập tức.
                  </li>
                  <li>
                    Quá trình import có thể mất vài giây đến vài phút tùy theo dung lượng file.
                  </li>
                </ul>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-800/80">
                <button
                  onClick={handleCancelImport}
                  className="px-4 py-2.5 bg-gray-800/80 hover:bg-gray-700 text-gray-300 rounded text-xs font-medium transition-colors border border-gray-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <X size={15} /> Hủy
                </button>

                <button
                  onClick={handleConfirmImport}
                  className="px-6 py-2.5 bg-[#3b82f6] hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                  <CloudUpload size={16} /> Xác nhận Import
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <AnimatePresence>
        {fileToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFileToDelete(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-[440px] max-w-full bg-[#131720] border border-gray-800 rounded p-6 shadow-2xl text-gray-200"
            >
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-10 h-10 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Xác nhận xóa file</h3>
                  <p className="text-xs text-gray-400">Hành động này không thể hoàn tác</p>
                </div>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed mb-6 bg-[#1a1f2b] p-3 rounded border border-gray-800">
                Bạn có chắc chắn muốn xóa file{' '}
                <span className="font-bold text-white">
                  {fileToDelete.fileName || fileToDelete.name}
                </span>{' '}
                và toàn bộ dữ liệu đơn hàng đi kèm không?
              </p>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800">
                <button
                  onClick={() => setFileToDelete(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-medium transition-colors border border-gray-700 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={confirmDeleteFile}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5 shadow-lg shadow-red-500/20 cursor-pointer"
                >
                  <Trash2 size={14} /> Xóa vĩnh viễn
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MAIN IMPORT & LIST SCREEN --- */}
      <div
        className="flex-1 flex flex-col min-h-fit md:min-h-0 w-full space-y-3.5"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1 flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded bg-[#5865f2]/10 dark:bg-[#5865f2]/20 flex items-center justify-center text-[#5865f2] shrink-0">
              <FileSpreadsheet size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1 truncate">
              <h1 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white leading-tight truncate">
                Dữ liệu Excel
              </h1>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate hidden sm:block">
                Quản lý và import dữ liệu đơn hàng từ file Excel Shopee
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => processFile(e.target.files?.[0])}
              className="hidden"
              id="excel-upload"
              ref={fileInputRef}
            />
            <Button
              variant="default"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-2.5 sm:px-3 gap-1 sm:gap-1.5 text-xs"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Import Excel</span>
              <span className="sm:hidden">Import</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMetricsExpanded(!isMetricsExpanded)}
              className="h-8 w-8 p-0"
              title={isMetricsExpanded ? 'Thu gọn thống kê' : 'Mở rộng thống kê'}
            >
              <ChevronDown
                size={16}
                className={`transition-transform duration-300 ${isMetricsExpanded ? 'rotate-180' : ''}`}
              />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-fit md:min-h-0 space-y-3.5">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden flex-shrink-0"
              >
                <div className="bg-[#1c212a] border-l-4 border-l-red-500 border-y border-r border-gray-800 py-4 px-6 rounded-r">
                  <div className="flex items-center gap-2">
                    <XCircle size={18} className="text-red-500" />
                    <span className="text-red-400 font-semibold text-sm">{error}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ROW 1: METRICS */}
          <AnimatePresence mode="wait" initial={false}>
            {isMetricsExpanded ? (
              <motion.div
                key="expanded"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-4 flex-shrink-0"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <SystemMetricCard
                    title="Tổng file đã import"
                    value={importedFiles.length}
                    subtitle="File Excel"
                    icon={Folder}
                    colorScheme="blue"
                    isActive={false}
                  />
                  <SystemMetricCard
                    title="Tổng đơn hàng"
                    value={totalOrdersCount.toLocaleString('vi-VN')}
                    subtitle="Đơn hàng"
                    icon={ClipboardList}
                    colorScheme="green"
                    isActive={false}
                  />
                  <SystemMetricCard
                    title="Tổng doanh thu"
                    value={formatCurrency(totalRevenueAll)}
                    subtitle="Doanh thu"
                    icon={CircleDollarSign}
                    colorScheme="purple"
                    isActive={false}
                  />
                  <SystemMetricCard
                    title="Lần import gần nhất"
                    value={latestImportFormatted}
                    subtitle={importedFiles.length > 0 ? importedFiles[0].fileName : 'Chưa có dữ liệu'}
                    icon={PieChart}
                    colorScheme="orange"
                    isActive={false}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="compact"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-shrink-0"
              >
                <SystemCompactMetricsBar
                  onToggleExpand={() => setIsMetricsExpanded(true)}
                  items={[
                    { label: 'Tổng file', value: importedFiles.length, icon: Folder, color: 'text-blue-500' },
                    {
                      label: 'Tổng đơn',
                      value: totalOrdersCount.toLocaleString('vi-VN'),
                      icon: ClipboardList,
                      color: 'text-green-500',
                    },
                    {
                      label: 'Doanh thu',
                      value: formatCurrency(totalRevenueAll),
                      icon: CircleDollarSign,
                      color: 'text-purple-500',
                    },
                    {
                      label: 'Lần import gần nhất',
                      value: latestImportFormatted,
                      icon: PieChart,
                      color: 'text-orange-500',
                    },
                  ]}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ROW 2: FILTER & TABLE CONTAINER */}
          <div className="flex flex-col gap-3 flex-shrink-0 mb-6">
            <SystemFilter>
              <div className="relative w-64 mr-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm tên file, tháng, năm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-[13px] focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/20 text-gray-900 dark:text-gray-100 placeholder-gray-500 transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select
                  options={[{ value: 'all', label: 'Tất cả năm' }]}
                  value="all"
                  onChange={() => {}}
                  className="bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-[13px] text-gray-700 dark:text-gray-300 min-w-[140px]"
                />
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {isFiltering && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setCurrentPage(1);
                    }}
                    className="h-[34px] px-3 flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/20 rounded transition-colors text-[13px] font-medium cursor-pointer shadow-sm mr-2"
                  >
                    <RotateCcw size={14} /> Xóa bộ lọc
                  </button>
                )}
                <button className="p-2 bg-transparent text-gray-500 hover:text-white rounded transition-colors cursor-pointer">
                  <LayoutGrid size={16} />
                </button>
                <button className="p-2 bg-gray-100 dark:bg-[#1a1b23] text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded transition-colors cursor-pointer shadow-sm">
                  <List size={16} />
                </button>
              </div>
            </SystemFilter>
          </div>

          <div className="flex-1 flex flex-col min-h-fit md:min-h-0 mb-6">
            {/* Desktop Table Wrapper */}
            <div className="hidden md:flex flex-1 flex-col min-h-0">
              <SystemTableWrapper
              tableClassName="min-w-[1400px]"
              pagination={
                <SystemPagination
                  page={currentPage - 1}
                  totalPages={totalPages}
                  totalItems={filteredFiles.length}
                  setPage={(p) => setCurrentPage(p + 1)}
                  itemsPerPage={itemsPerPage}
                  setItemsPerPage={setItemsPerPage}
                />
              }
            >
              <SystemThead>
                <SystemTh className="w-16 text-center">STT</SystemTh>
                <SystemTh>File Excel</SystemTh>
                <SystemTh className="w-36">Kỳ dữ liệu</SystemTh>
                <SystemTh className="w-32">Số đơn</SystemTh>
                <SystemTh className="w-40">Doanh thu</SystemTh>
                <SystemTh className="w-40">Phí Shopee</SystemTh>
                <SystemTh className="w-40">Lợi nhuận</SystemTh>
                <SystemTh className="w-40">Ngày Import</SystemTh>
                <SystemTh className="w-36">Trạng thái</SystemTh>
                <SystemTh className="w-32 text-center">Thao tác</SystemTh>
              </SystemThead>
              <SystemTbody>
                {isLoading ? (
                  <SystemTableSkeleton cols={9} rows={5} />
                ) : (
                  <>
                    {currentFiles.map((file, index) => {
                      const uploadDate = new Date(file.importedAt);
                      const dateStr = uploadDate.toLocaleDateString('vi-VN');
                      const timeStr =
                        String(uploadDate.getHours()).padStart(2, '0') +
                        ':' +
                        String(uploadDate.getMinutes()).padStart(2, '0');
                      const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
                      const stt = (currentPage - 1) * itemsPerPage + index + 1;

                      return (
                        <SystemTr key={file.id}>
                          <SystemTd className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                            {stt}
                          </SystemTd>
                          <SystemTd>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-[#10b981]/10 text-[#10b981] flex items-center justify-center shrink-0 border border-[#10b981]/30">
                                <FileSpreadsheet size={16} strokeWidth={2.5} />
                              </div>
                              <div>
                                <p
                                  className="text-[13px] font-bold text-gray-900 dark:text-white line-clamp-1 whitespace-normal"
                                  title={file.fileName}
                                >
                                  {file.fileName}
                                </p>
                                <p className="text-[11px] text-gray-500">{sizeInMb} MB</p>
                              </div>
                            </div>
                          </SystemTd>
                          <SystemTd>
                            <span className="text-[13px] text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">
                              {file.period}
                            </span>
                          </SystemTd>
                          <SystemTd>
                            <p className="text-[13px] font-bold text-gray-900 dark:text-white">
                              {file.totalOrders}
                            </p>
                            <p className="text-[11px] text-gray-500">đơn hàng</p>
                          </SystemTd>
                          <SystemTd>
                            <span className="text-[13px] font-bold text-[#3b82f6] whitespace-nowrap">
                              {formatCurrency(file.summary?.revenue || 0)}
                            </span>
                          </SystemTd>
                          <SystemTd>
                            <span className="text-[13px] font-medium text-gray-500 whitespace-nowrap">
                              {formatCurrency(file.summary?.shopeeFee || 0)}
                            </span>
                          </SystemTd>
                          <SystemTd>
                            <span className="text-[13px] font-bold text-[#10b981] whitespace-nowrap">
                              {formatCurrency(file.summary?.profit || 0)}
                            </span>
                          </SystemTd>
                          <SystemTd>
                            <p className="text-[13px] text-gray-700 dark:text-gray-300">{dateStr}</p>
                            <p className="text-[11px] text-gray-500">{timeStr}</p>
                          </SystemTd>
                          <SystemTd>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#10b981]/10 text-[#10b981] gap-1">
                              <CheckCircle size={10} strokeWidth={3} /> Thành công
                            </span>
                          </SystemTd>
                          <SystemTd className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-[#3b82f6] transition-colors cursor-pointer"
                                title="Xem chi tiết"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => requestDeleteFile(file)}
                                className="w-7 h-7 flex items-center justify-center rounded bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors cursor-pointer"
                                title="Xóa file"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </SystemTd>
                        </SystemTr>
                      );
                    })}
                    {currentFiles.length === 0 && <SystemTableEmpty colSpan={10} />}
                  </>
                )}
              </SystemTbody>
            </SystemTableWrapper>
          </div>

          {/* Mobile Card View (md:hidden) */}
          <div className="md:hidden flex-1 overflow-y-auto space-y-2.5 pb-20">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-gray-400 font-normal">
                <RefreshCw className="w-5 h-5 mx-auto animate-spin text-[#5865f2] mb-2" />
                Đang tải lịch sử import...
              </div>
            ) : currentFiles.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400 font-normal bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 p-6">
                <FileSpreadsheet className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Chưa có file import nào</p>
                <p className="text-[11px] text-gray-400">Tải lên file Excel Shopee để bắt đầu phân tích đơn hàng.</p>
              </div>
            ) : (
              currentFiles.map((file, index) => {
                const uploadDate = new Date(file.importedAt);
                const dateStr = uploadDate.toLocaleDateString('vi-VN');
                const timeStr =
                  String(uploadDate.getHours()).padStart(2, '0') +
                  ':' +
                  String(uploadDate.getMinutes()).padStart(2, '0');
                const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
                const stt = (currentPage - 1) * itemsPerPage + index + 1;

                return (
                  <div
                    key={file.id}
                    className="p-3.5 rounded bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/50">
                          <FileSpreadsheet size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono text-gray-400">#{stt}</span>
                            <span className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                              {file.filename}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {sizeInMb} MB • {timeStr} {dateStr}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1">
                          <CheckCircle size={10} strokeWidth={3} /> Thành công
                        </span>
                        <button
                          onClick={() => requestDeleteFile(file)}
                          className="w-7 h-7 flex items-center justify-center rounded bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition-colors"
                          title="Xóa file"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs py-2 px-2.5 rounded bg-gray-50 dark:bg-[#1a1b23] border border-gray-100 dark:border-gray-800 text-center">
                      <div>
                        <span className="text-[10px] text-gray-400 block">Số đơn</span>
                        <span className="font-mono font-bold text-xs text-gray-900 dark:text-white">
                          {file.totalOrders?.toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block">Doanh thu</span>
                        <span className="font-mono font-bold text-xs text-[#3b82f6]">
                          {formatCurrency(file.summary?.revenue || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block">Lợi nhuận</span>
                        <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(file.summary?.profit || 0)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
                      <span>Kỳ: <span className="font-medium text-gray-700 dark:text-gray-300">{file.period || '--'}</span></span>
                      <span>Phí sàn: <span className="font-mono font-medium text-rose-600 dark:text-rose-400">{formatCurrency(file.summary?.shopeeFee || 0)}</span></span>
                    </div>
                  </div>
                );
              })
            )}

            {/* Mobile Pagination */}
            <div className="rounded border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-[#14151a] shadow-none mt-2 shrink-0">
              <SystemPagination
                page={currentPage - 1}
                totalPages={totalPages}
                totalItems={filteredFiles.length}
                setPage={(p) => setCurrentPage(p + 1)}
                itemsPerPage={itemsPerPage}
                setItemsPerPage={setItemsPerPage}
                className="border-t-0"
              />
            </div>
          </div>
        </div>

          {/* ROW 3: FOOTER INSTRUCTIONS */}
          <div className="flex-shrink-0 bg-[#1c212a] border border-gray-800 rounded px-4 py-2.5 flex items-center justify-between gap-4 text-[12px]">
            <div className="flex items-center gap-2 font-bold text-white shrink-0">
              <span className="text-yellow-500 text-sm">💡</span>
              <span>Hướng dẫn:</span>
            </div>
            <div className="flex items-center gap-4 md:gap-6 overflow-x-auto custom-scrollbar-autohide text-gray-300">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-4 h-4 rounded bg-[#3b82f6]/20 text-[#3b82f6] text-[10px] font-bold flex items-center justify-center border border-[#3b82f6]/30">
                  1
                </span>{' '}
                Chọn file Excel (.xlsx)
              </span>
              <span className="text-gray-600">➔</span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-4 h-4 rounded bg-gray-800 text-gray-400 text-[10px] font-bold flex items-center justify-center border border-gray-700">
                  2
                </span>{' '}
                Kiểm tra dữ liệu
              </span>
              <span className="text-gray-600">➔</span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-4 h-4 rounded bg-gray-800 text-gray-400 text-[10px] font-bold flex items-center justify-center border border-gray-700">
                  3
                </span>{' '}
                Import vào hệ thống
              </span>
              <span className="text-gray-600">➔</span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-4 h-4 rounded bg-purple-500/20 text-purple-400 text-[10px] font-bold flex items-center justify-center border border-purple-500/30">
                  4
                </span>{' '}
                Xem báo cáo & phân tích
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
