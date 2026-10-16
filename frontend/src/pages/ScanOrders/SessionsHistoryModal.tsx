import React, { useState } from 'react';
import {
  X,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  UploadCloud,
  Trash2,
  Download,
  Plus,
  Eye,
  ChevronRight,
  Package,
} from 'lucide-react';
import { useScanSessionStore, ScanSession } from '../../stores/scanSessionStore';
import { toast } from '../../components/ui/Toast';

interface SessionsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSessionToScan: (session: ScanSession) => void;
  onOpenOrderDetail?: (orderId: string) => void;
}

export const SessionsHistoryModal: React.FC<SessionsHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectSessionToScan,
  onOpenOrderDetail,
}) => {
  const {
    sessions,
    activeSessionId,
    createNewSession,
    deleteSession,
    submitSession,
    isVerifyingBatch,
  } = useScanSessionStore();

  const [filterTab, setFilterTab] = useState<'ALL' | 'DRAFT' | 'SUBMITTED'>('ALL');
  const [selectedSessionForDetail, setSelectedSessionForDetail] = useState<ScanSession | null>(null);

  if (!isOpen) return null;

  const filteredSessions = sessions.filter((s) => {
    if (filterTab === 'DRAFT') return s.status === 'DRAFT';
    if (filterTab === 'SUBMITTED') return s.status === 'SUBMITTED';
    return true;
  });

  const handleCreateNew = () => {
    const newSession = createNewSession();
    toast.success(`Đã tạo ${newSession.name}`);
    onSelectSessionToScan(newSession);
    onClose();
  };

  const handleDelete = (s: ScanSession, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Bạn có chắc chắn muốn xóa "${s.name}" (${s.items.length} mã quét)?`)) {
      deleteSession(s.id);
      toast.info(`Đã xóa ${s.name}`);
      if (selectedSessionForDetail?.id === s.id) {
        setSelectedSessionForDetail(null);
      }
    }
  };

  const handleSubmit = async (s: ScanSession, e: React.MouseEvent) => {
    e.stopPropagation();
    if (s.items.length === 0) {
      toast.warning('Phiên quét chưa có mã nào để đối soát');
      return;
    }

    try {
      toast.info(`Đang gửi ${s.items.length} mã lên hệ thống đối soát...`);
      const res = await submitSession(s.id);
      if (res.success) {
        toast.success(
          `Đối soát xong: ${res.summary.verified} thành công, ${res.summary.alreadyVerified} trùng, ${res.summary.notFound} không tìm thấy`,
        );
      }
    } catch (err: any) {
      toast.error('Lỗi khi đối soát phiên quét', err.message);
    }
  };

  const handleExportCSV = (s: ScanSession, e: React.MouseEvent) => {
    e.stopPropagation();
    if (s.items.length === 0) {
      toast.warning('Phiên quét không có mã nào');
      return;
    }

    const headers = ['Mã vận đơn / Đơn hàng', 'Mã kiện', 'Gian hàng', 'Đơn vị VC', 'Trạng thái', 'Thời gian'];
    const rows = s.items.map((item) => [
      item.code,
      item.packageCode || '',
      item.shopName || '',
      item.carrierName || '',
      item.status === 'VERIFIED'
        ? 'Thành công'
        : item.status === 'ALREADY_VERIFIED'
        ? 'Đã quét trước'
        : item.status === 'NOT_FOUND'
        ? 'Không tìm thấy'
        : item.status === 'PENDING'
        ? 'Chờ đối soát'
        : 'Lỗi',
      item.scannedAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${c || ''}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `phien_quet_${s.sessionCode}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã tải xuống danh sách mã quét');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-[#131722] rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#5865f2]/10 border border-[#5865f2]/20 text-[#5865f2] flex items-center justify-center shrink-0">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                Quản lý các phiên quét
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                Lịch sử các phiên quét gom mã
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shrink-0"
            title="Đóng modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Tabs - Responsive Segmented Control */}
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-[#161a26]/50 shrink-0">
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-200/60 dark:bg-[#1a1e2b] rounded-lg text-center">
            <button
              type="button"
              onClick={() => setFilterTab('ALL')}
              className={`py-1.5 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer truncate ${
                filterTab === 'ALL'
                  ? 'bg-white dark:bg-[#2563eb] text-[#2563eb] dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Tất cả ({sessions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('DRAFT')}
              className={`py-1.5 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer truncate flex items-center justify-center gap-1 ${
                filterTab === 'DRAFT'
                  ? 'bg-white dark:bg-amber-600 text-amber-600 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
              <span className="truncate">Quét dở ({sessions.filter((s) => s.status === 'DRAFT').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('SUBMITTED')}
              className={`py-1.5 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer truncate flex items-center justify-center gap-1 ${
                filterTab === 'SUBMITTED'
                  ? 'bg-white dark:bg-emerald-600 text-emerald-600 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">Đã soát ({sessions.filter((s) => s.status === 'SUBMITTED').length})</span>
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar">
          {filteredSessions.length === 0 ? (
            <div className="py-14 text-center text-gray-400">
              <FileText size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Không có phiên quét nào trong mục này</p>
              <button
                type="button"
                onClick={handleCreateNew}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563eb] text-white text-xs font-semibold shadow-sm hover:bg-[#1d4ed8] transition-colors cursor-pointer"
              >
                <Plus size={14} />
                Bắt đầu phiên quét ngay
              </button>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isCurrentActive = session.id === activeSessionId;
              const isDraft = session.status === 'DRAFT';

              return (
                <div
                  key={session.id}
                  className={`relative p-3.5 sm:p-4 rounded-lg border transition-all ${
                    isCurrentActive
                      ? 'border-2 border-[#2563eb] dark:border-[#3b82f6] bg-blue-50/40 dark:bg-blue-950/25 shadow-sm'
                      : 'border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1e2b] hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  {/* Corner Active Icon Indicator replacing the text "Đang mở" */}
                  {isCurrentActive && (
                    <div
                      className="absolute top-3 right-3 flex items-center justify-center w-6 h-6 rounded-full bg-[#2563eb]/10 dark:bg-[#2563eb]/20 text-[#2563eb] dark:text-blue-400 border border-[#2563eb]/30 shadow-xs"
                      title="Phiên đang mở quét hiện tại"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#2563eb] dark:bg-blue-400 animate-pulse" />
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className={`flex items-center gap-2 flex-wrap ${isCurrentActive ? 'pr-7' : ''}`}>
                        <span className="font-bold text-sm text-gray-900 dark:text-white">
                          {session.name}
                        </span>
                        <span className="font-mono text-xs text-gray-500 font-semibold">
                          ({session.sessionCode})
                        </span>
                        {isDraft ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Đang quét dở
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                            <CheckCircle2 size={11} />
                            Đã đối soát
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                        <span className="inline-flex items-center gap-1">
                          <Package size={13} className="text-gray-400" />
                          <strong className="text-gray-900 dark:text-white font-mono">
                            {session.items.length}
                          </strong>{' '}
                          mã
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={13} className="text-gray-400" />
                          {new Date(session.createdAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          {new Date(session.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                        {!isDraft && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            ✓ {session.stats.verified} thành công
                            {session.stats.alreadyVerified > 0 && ` • ${session.stats.alreadyVerified} trùng`}
                            {session.stats.notFound > 0 && ` • ${session.stats.notFound} không thấy`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {isDraft ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectSessionToScan(session);
                              onClose();
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold cursor-pointer shadow-sm transition-all"
                            title="Tiếp tục quét mã vào phiên này"
                          >
                            <Play size={13} className="fill-current" />
                            <span>Tiếp tục quét</span>
                          </button>
                          <button
                            type="button"
                            disabled={session.items.length === 0 || isVerifyingBatch}
                            onClick={(e) => handleSubmit(session, e)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer shadow-sm transition-all"
                            title="Gửi danh sách mã để đối soát & cập nhật đơn hàng"
                          >
                            <UploadCloud size={13} />
                            <span>Đối soát</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setSelectedSessionForDetail(session)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-200 cursor-pointer"
                          >
                            <Eye size={13} />
                            <span>Xem mã</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleExportCSV(session, e)}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                            title="Xuất file CSV"
                          >
                            <Download size={14} />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDelete(session, e)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Xóa phiên này"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Preview items snippet (first 3 codes) */}
                  {session.items.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800/80 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-gray-400">Mã vừa quét:</span>
                      {session.items.slice(0, 4).map((it) => (
                        <span
                          key={it.id}
                          className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-mono text-[11px] font-medium"
                        >
                          {it.code}
                        </span>
                      ))}
                      {session.items.length > 4 && (
                        <span className="text-[11px] text-gray-400 font-medium">
                          +{session.items.length - 4} mã khác...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer with Close & Create Session Buttons */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-[#161a26]/80 flex items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Tạo phiên mới</span>
          </button>
        </div>

        {/* Detail drawer / submodal for completed session */}
        {selectedSessionForDetail && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-xl bg-white dark:bg-[#131722] rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl p-5 flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                    Chi tiết: {selectedSessionForDetail.name}
                  </h4>
                  <p className="text-xs text-gray-500">
                    Tổng cộng {selectedSessionForDetail.items.length} mã đã quét
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSessionForDetail(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-2 custom-scrollbar">
                {selectedSessionForDetail.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg bg-gray-50 dark:bg-[#1a1e2b] border border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-400 font-semibold w-5 text-right">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-mono font-bold text-gray-900 dark:text-white">
                          {item.code}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {item.scannedAt} • {item.message || 'Xác nhận xuất kho'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.status === 'VERIFIED'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : item.status === 'ALREADY_VERIFIED'
                            ? 'bg-amber-500/10 text-amber-500'
                            : item.status === 'NOT_FOUND'
                            ? 'bg-rose-500/10 text-rose-500'
                            : 'bg-blue-500/10 text-blue-500'
                        }`}
                      >
                        {item.status === 'VERIFIED'
                          ? 'Thành công'
                          : item.status === 'ALREADY_VERIFIED'
                          ? 'Đã quét trước'
                          : item.status === 'NOT_FOUND'
                          ? 'Không tìm thấy'
                          : 'Chờ đối soát'}
                      </span>
                      {item.orderId && onOpenOrderDetail && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSessionForDetail(null);
                            onClose();
                            onOpenOrderDetail(item.orderId!);
                          }}
                          className="text-[#2563eb] hover:underline"
                        >
                          <ChevronRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedSessionForDetail(null)}
                  className="px-4 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-semibold"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
