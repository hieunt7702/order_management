import React, { useState, useMemo } from 'react';
import {
  X,
  Trash2,
  FileSpreadsheet,
  Package,
  Copy,
  Check,
  Search,
  RotateCcw,
  Clock,
  Building2,
} from 'lucide-react';

export interface ScannedOrdersListModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionScans?: any[];
  historicalScans?: any[];
  onClearSession?: () => void;
  onReverse?: (packageId: string, code: string) => void;
}

export const ScannedOrdersListModal: React.FC<ScannedOrdersListModalProps> = ({
  isOpen,
  onClose,
  sessionScans = [],
  historicalScans = [],
  onClearSession,
  onReverse,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'ALL' | 'SESSION' | 'HISTORICAL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Chuẩn hóa và gộp danh sách mã
  const allItems = useMemo(() => {
    const sessionList = (sessionScans || []).map((s, idx) => ({
      ...s,
      isSession: true,
      uniqueKey: `session_${s.id || idx}_${s.code}`,
      trackingCode: s.trackingCode || s.code,
      carrierName: s.carrierName || 'Shopee Express',
      shopName: s.shopName || 'Gian hàng',
    }));

    const historicalList = (historicalScans || []).map((h, idx) => ({
      ...h,
      isSession: false,
      uniqueKey: `hist_${h.id || idx}_${h.trackingCode || h.code}`,
      trackingCode: h.trackingCode || h.code,
      carrierName: h.carrierName || 'Shopee Express',
      shopName: h.shopName || 'Gian hàng',
    }));

    return {
      all: [...sessionList, ...historicalList],
      session: sessionList,
      historical: historicalList,
    };
  }, [sessionScans, historicalScans]);

  // Lọc theo Tab và Search
  const filteredList = useMemo(() => {
    let source = allItems.all;
    if (activeTab === 'SESSION') source = allItems.session;
    if (activeTab === 'HISTORICAL') source = allItems.historical;

    const term = searchTerm.trim().toLowerCase();
    if (!term) return source;

    return source.filter((item) => {
      const code = (item.trackingCode || item.code || '').toLowerCase();
      const pkg = (item.packageCode || '').toLowerCase();
      const order = (item.orderId || '').toLowerCase();
      const shop = (item.shopName || '').toLowerCase();
      const carrier = (item.carrierName || '').toLowerCase();
      return (
        code.includes(term) ||
        pkg.includes(term) ||
        order.includes(term) ||
        shop.includes(term) ||
        carrier.includes(term)
      );
    });
  }, [allItems, activeTab, searchTerm]);

  // Sao chép 1 mã vận đơn
  const handleCopyCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  // Sao chép toàn bộ mã vận đơn đang hiển thị
  const handleCopyAllCodes = () => {
    const codes = filteredList
      .map((item) => item.trackingCode || item.code)
      .filter(Boolean);
    if (codes.length === 0) return;
    navigator.clipboard.writeText(codes.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Xuất file Excel / CSV danh sách mã vận đơn
  const handleExportExcel = () => {
    if (filteredList.length === 0) return;

    const headers = [
      'STT',
      'Mã vận đơn',
      'Mã kiện hàng',
      'Mã đơn Shopee',
      'Gian hàng',
      'Đơn vị vận chuyển',
      'Phân loại',
      'Trạng thái',
      'Thời gian quét / xác nhận',
    ];

    const rows = filteredList.map((item, idx) => [
      idx + 1,
      `"${item.trackingCode || item.code || ''}"`,
      `"${item.packageCode || ''}"`,
      `"${item.orderId || ''}"`,
      `"${item.shopName || ''}"`,
      `"${item.carrierName || ''}"`,
      `"${item.isSession ? 'Phiên hiện tại' : 'Đã xác nhận trước'}"`,
      `"${item.result || 'VERIFIED'}"`,
      `"${item.timestamp || ''}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `danh_sach_ma_van_don_xuat_kho_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      {/* Click outside to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#f9f9fa] dark:bg-[#14151a] rounded shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden z-10 animate-slide-up">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0 bg-white dark:bg-[#181b22]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded bg-indigo-50/80 dark:bg-indigo-500/10 text-[#5865f2] border border-indigo-100/50 dark:border-indigo-500/20 flex items-center justify-center font-bold">
              <Package size={18} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white text-base">
                  Danh sách mã vận đơn đã quét
                </h3>
                <span className="bg-indigo-50 dark:bg-indigo-500/20 text-[#5865f2] dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-500/30 font-medium text-xs px-2 py-0.5 rounded">
                  {filteredList.length} mã
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Xem lại toàn bộ mã vận đơn quét trong phiên & các lần xuất kho trước đó
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {filteredList.length > 0 && (
              <button
                onClick={handleCopyAllCodes}
                className="h-[32px] px-2.5 text-xs text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                title="Sao chép toàn bộ danh sách mã vận đơn vào Clipboard"
              >
                {copiedAll ? <Check size={14} className="text-emerald-500" /> : <Copy size={13} />}
                <span className="hidden sm:inline">
                  {copiedAll ? 'Đã sao chép!' : 'Sao chép tất cả mã'}
                </span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab & Search Filter Bar */}
        <div className="p-3 bg-gray-50/80 dark:bg-[#10141d] border-b border-gray-100 dark:border-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-0.5 bg-gray-200/70 dark:bg-gray-800/80 rounded w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-white dark:bg-[#1a1f2c] text-[#5865f2] dark:text-indigo-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Tất cả ({allItems.all.length})
            </button>
            <button
              onClick={() => setActiveTab('SESSION')}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                activeTab === 'SESSION'
                  ? 'bg-white dark:bg-[#1a1f2c] text-[#5865f2] dark:text-indigo-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Trong phiên ({allItems.session.length})
            </button>
            <button
              onClick={() => setActiveTab('HISTORICAL')}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                activeTab === 'HISTORICAL'
                  ? 'bg-white dark:bg-[#1a1f2c] text-[#5865f2] dark:text-indigo-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Đã xác nhận trước ({allItems.historical.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm mã vận đơn, mã đơn, shop..."
              className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#5865f2]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body - Scanned Orders List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 custom-scrollbar min-h-[320px]">
          {filteredList.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <div className="w-12 h-12 rounded bg-gray-100 dark:bg-gray-800/60 flex items-center justify-center text-gray-400 mb-2 border border-gray-200/50 dark:border-gray-700/50">
                <Package size={24} />
              </div>
              <p className="font-normal text-sm text-gray-700 dark:text-gray-300">
                {searchTerm ? 'Không tìm thấy mã vận đơn phù hợp' : 'Chưa có mã vận đơn nào'}
              </p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs font-normal">
                {searchTerm
                  ? 'Vui lòng kiểm tra lại từ khóa tìm kiếm.'
                  : 'Hãy hướng camera quét mã vạch trên kiện hàng để bắt đầu.'}
              </p>
            </div>
          ) : (
            filteredList.map((item, index) => {
              const code = item.trackingCode || item.code || 'CHƯA CÓ MÃ';
              const isCopied = copiedCode === code;

              return (
                <div
                  key={item.uniqueKey || item.id || index}
                  className="p-3 bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 rounded hover:border-[#5865f2]/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  {/* Left: STT, Mã Vận Đơn & Badge Phân loại */}
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded bg-indigo-50/80 dark:bg-indigo-500/10 text-[#5865f2] dark:text-indigo-400 font-medium text-xs flex items-center justify-center border border-indigo-100/50 dark:border-indigo-500/20 shrink-0 mt-0.5 sm:mt-0">
                      {filteredList.length - index}
                    </span>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Tracking Code font mono */}
                        <span className="font-mono font-medium text-sm text-gray-900 dark:text-white tracking-wide">
                          {code}
                        </span>

                        {/* Copy Code button */}
                        <button
                          onClick={() => handleCopyCode(code)}
                          className={`p-1 rounded text-gray-400 hover:text-[#5865f2] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
                            isCopied ? 'text-emerald-500' : ''
                          }`}
                          title="Sao chép mã vận đơn này"
                        >
                          {isCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        </button>

                        {/* Session / Historical Tag */}
                        {item.isSession ? (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-[#5865f2] border border-indigo-100 dark:border-indigo-800">
                            Trong phiên
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                            Đã xác nhận
                          </span>
                        )}

                        {/* Device / Source */}
                        {item.source && (
                          <span className="text-xs font-normal bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                            {item.source === 'CAMERA_SCANNER' ? 'Cam' : item.source === 'BROWSER_KEYBOARD_SCANNER' ? 'USB' : item.source}
                          </span>
                        )}
                      </div>

                      {/* Package code & Order ID info */}
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                        {item.orderId && item.orderId !== 'N/A' && (
                          <span>
                            Đơn: <span className="font-medium text-gray-700 dark:text-gray-300">{item.orderId}</span>
                          </span>
                        )}
                        {item.packageCode && item.packageCode !== code && (
                          <span>
                            Kiện: <span className="font-mono text-gray-600 dark:text-gray-400">{item.packageCode}</span>
                          </span>
                        )}
                        {item.shopName && (
                          <span className="flex items-center gap-1 text-gray-500">
                            <Building2 size={12} /> {item.shopName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Carrier, Status, Time & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800/80">
                    <div className="flex flex-col sm:items-end text-left sm:text-right">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {item.carrierName}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.result === 'VERIFIED'
                              ? 'bg-emerald-500'
                              : item.result === 'ALREADY_VERIFIED'
                              ? 'bg-blue-500'
                              : 'bg-rose-500'
                          }`}
                        />
                      </div>
                      <span className="text-xs text-gray-400 font-mono mt-0.5 flex items-center gap-1">
                        <Clock size={11} /> {item.timestamp}
                      </span>
                    </div>

                    {/* Hoàn tác nếu trong phiên và đã xuất kho */}
                    {item.isSession && (item.result === 'VERIFIED' || item.result === 'ALREADY_VERIFIED') && item.packageId && onReverse && (
                      <button
                        onClick={() => onReverse(item.packageId, code)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-colors cursor-pointer"
                        title="Hoàn tác xuất kho nếu quét nhầm"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Sticky Footer - Total info & Export */}
        <div className="p-3 sm:p-4 bg-white dark:bg-[#181b22] border-t border-gray-200 dark:border-gray-800 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Tổng <strong className="text-gray-900 dark:text-white">{filteredList.length}</strong> mã vận đơn
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onClearSession && allItems.session.length > 0 && activeTab === 'SESSION' && (
              <button
                onClick={onClearSession}
                className="h-[34px] px-3 rounded font-medium text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 size={13} />
                <span>Xóa phiên</span>
              </button>
            )}

            <button
              onClick={handleExportExcel}
              disabled={filteredList.length === 0}
              className={`h-[34px] px-4 rounded font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                filteredList.length > 0
                  ? 'bg-[#10b981] hover:bg-[#059669] text-white shadow-xs active:scale-95'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-800'
              }`}
            >
              <FileSpreadsheet size={14} />
              <span>Xuất Excel / CSV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
