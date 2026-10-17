import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  UploadCloud,
  Trash2,
  Download,
  Plus,
  Eye,
  ChevronRight,
  Package,
  X,
  MoreVertical,
  Scan,
  Info,
  RotateCcw,
  CircleDot,
} from 'lucide-react';
import { useScanSessionStore, ScanSession } from '../../stores/scanSessionStore';
import { toast } from '../../components/ui/Toast';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';

interface SessionsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSessionToScan: (session: ScanSession) => void;
  onOpenOrderDetail?: (orderId: string) => void;
}

// Clean session title: "Phiên quét #1 (01:41 17-10)" -> "Phiên quét #1"
const formatSessionTitle = (rawName?: string) => {
  if (!rawName) return 'Phiên quét #1';
  const match = rawName.match(/phiên\s+quét\s+#?(\d+)/i);
  if (match) {
    return `Phiên quét #${match[1]}`;
  }
  return rawName.replace(/\s*\(\d{2}:\d{2}\s+\d{2}[-/]\d{2}\)/i, '').trim();
};

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
    reopenSession,
    setActiveSession,
    isVerifyingBatch,
  } = useScanSessionStore();

  const [filterTab, setFilterTab] = useState<'ALL' | 'DRAFT' | 'SUBMITTED'>('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedSessionForDetail, setSelectedSessionForDetail] = useState<ScanSession | null>(null);
  const [menuOpenSessionId, setMenuOpenSessionId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close 3-dot menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenSessionId(null);
      }
    };
    if (menuOpenSessionId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpenSessionId]);

  if (!isOpen) return null;

  const draftSessions = sessions.filter((s) => s.status === 'DRAFT');
  const submittedSessions = sessions.filter((s) => s.status === 'SUBMITTED');

  const filteredSessions = sessions
    .filter((s) => {
      if (filterTab === 'DRAFT') return s.status === 'DRAFT';
      if (filterTab === 'SUBMITTED') return s.status === 'SUBMITTED';
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

  const handleCreateNew = () => {
    const newSession = createNewSession();
    toast.success(`Đã tạo ${formatSessionTitle(newSession.name)}`);
    onSelectSessionToScan(newSession);
    onClose();
  };

  const handleContinueScan = (session: ScanSession) => {
    if (session.status === 'SUBMITTED') {
      reopenSession(session.id);
      toast.info(`Đã mở lại "${formatSessionTitle(session.name)}" để tiếp tục quét / sửa mã`);
    } else {
      setActiveSession(session.id);
    }
    onSelectSessionToScan(session);
    onClose();
  };

  const handleDelete = (s: ScanSession, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMenuOpenSessionId(null);
    const title = formatSessionTitle(s.name);
    if (confirm(`Bạn có chắc chắn muốn xóa "${title}" (${s.items.length} mã quét)?`)) {
      deleteSession(s.id);
      toast.info(`Đã xóa ${title}`);
      if (selectedSessionForDetail?.id === s.id) {
        setSelectedSessionForDetail(null);
      }
    }
  };

  const handleSubmit = async (s: ScanSession, e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  const handleExportCSV = (s: ScanSession, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMenuOpenSessionId(null);
    if (s.items.length === 0) {
      toast.warning('Phiên chưa có mã quét nào để xuất CSV');
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
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 dark:bg-black/75 backdrop-blur-[2px] animate-modal-backdrop">
        <div className="fixed inset-0 -z-10" onClick={onClose} aria-hidden="true" />

        <div className="bg-[#f9f9fa] dark:bg-[#0c1017] rounded w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-800/80 overflow-hidden flex flex-col max-h-[92vh] max-h-[92dvh] animate-modal-center">
          {/* Mobile Top Drag Indicator Bar */}
          <div className="pt-2 pb-0.5 flex justify-center shrink-0">
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </div>

          {/* Modal Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded bg-[#1c2438] text-[#3b82f6] border border-[#2563eb]/20 flex items-center justify-center shrink-0">
                <FileText size={18} className="stroke-[1.5]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                  Phiên quét
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-normal truncate">
                  Tiếp tục quét hoặc xem lịch sử đối soát
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors cursor-pointer shrink-0"
              title="Đóng (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Filter Tabs - Pill Segmented Bar */}
          <div className="px-4 pt-3 pb-2 shrink-0">
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 dark:bg-[#131722] rounded border border-gray-200/80 dark:border-gray-800 text-center">
              <button
                type="button"
                onClick={() => setFilterTab('ALL')}
                className={`py-2 px-2.5 rounded text-xs font-medium transition-all cursor-pointer truncate ${
                  filterTab === 'ALL'
                    ? 'bg-[#3b82f6] text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                Tất cả {sessions.length}
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('DRAFT')}
                className={`py-2 px-2.5 rounded text-xs font-medium transition-all cursor-pointer truncate flex items-center justify-center gap-1.5 ${
                  filterTab === 'DRAFT'
                    ? 'bg-[#3b82f6] text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="truncate">Đang quét {draftSessions.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('SUBMITTED')}
                className={`py-2 px-2.5 rounded text-xs font-medium transition-all cursor-pointer truncate flex items-center justify-center gap-1.5 ${
                  filterTab === 'SUBMITTED'
                    ? 'bg-[#3b82f6] text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">Đã đối soát {submittedSessions.length}</span>
              </button>
            </div>
          </div>

          {/* Subheader: Count & Sort */}
          <div className="px-4 py-1.5 flex items-center justify-between text-xs shrink-0">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">
              {filteredSessions.length} phiên quét
            </span>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>{sortOrder === 'newest' ? 'Mới nhất' : 'Cũ nhất'}</span>
              <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <line x1="2" y1="4" x2="14" y2="4" />
                <line x1="5" y1="8" x2="14" y2="8" />
                <line x1="8" y1="12" x2="14" y2="12" />
              </svg>
            </button>
          </div>

          {/* Sessions List */}
          <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
            {filteredSessions.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <FileText size={36} className="mx-auto mb-2 opacity-30 stroke-[1.5]" />
                <p className="text-xs sm:text-sm font-normal">Không có phiên quét nào trong mục này</p>
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#2563eb] text-white text-xs font-medium shadow-xs hover:bg-[#1d4ed8] transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  Bắt đầu phiên quét ngay
                </button>
              </div>
            ) : (
              filteredSessions.map((session) => {
                const isCurrentActive = session.id === activeSessionId;
                const isDraft = session.status === 'DRAFT';
                const sessionTitle = formatSessionTitle(session.name);
                const isMenuOpen = menuOpenSessionId === session.id;

                const dateObj = new Date(session.createdAt);
                const hours = String(dateObj.getHours()).padStart(2, '0');
                const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const formattedDateTime = `${hours}:${minutes} · ${day}/${month}`;

                return (
                  <div
                    key={session.id}
                    className={`relative p-3.5 sm:p-4 rounded border transition-all ${
                      isCurrentActive
                        ? 'border-[#3b82f6] bg-white dark:bg-[#10141e] shadow-xs'
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#10141e] hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    {/* Row 1: Title & 3-dot Menu */}
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                        {sessionTitle}
                      </h3>

                      {/* 3-dot dropdown */}
                      <div className="relative shrink-0" ref={isMenuOpen ? menuRef : null}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenSessionId(isMenuOpen ? null : session.id);
                          }}
                          className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                          title="Tùy chọn phiên"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-full mt-1 w-44 rounded bg-white dark:bg-[#181d28] border border-gray-200 dark:border-gray-700/80 shadow-xl py-1 z-30 text-xs">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenSessionId(null);
                                setSelectedSessionForDetail(session);
                              }}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              <Eye size={13} className="text-[#3b82f6]" />
                              <span>Xem chi tiết mã</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleExportCSV(session, e)}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              <Download size={13} className="text-emerald-500" />
                              <span>Tải danh sách CSV</span>
                            </button>

                            <div className="my-1 border-t border-gray-100 dark:border-gray-700/60" />

                            <button
                              type="button"
                              onClick={(e) => handleDelete(session, e)}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                              <span>Xóa phiên quét</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Code tag & Current Active badge */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2.5 py-0.5 rounded bg-gray-100 dark:bg-[#181d28] border border-gray-200 dark:border-gray-700/60 text-gray-700 dark:text-gray-300 font-mono text-xs font-semibold">
                        {session.sessionCode}
                      </span>

                      {isCurrentActive && (
                        <span className="px-2 py-0.5 rounded bg-[#2563eb]/15 dark:bg-[#1c2638] text-[#2563eb] dark:text-[#60a5fa] border border-[#2563eb]/30 text-xs font-medium flex items-center gap-1.5">
                          <CircleDot size={12} className="text-[#3b82f6] dark:text-[#60a5fa] shrink-0" />
                          <span>Phiên hiện tại</span>
                        </span>
                      )}
                    </div>

                    {/* Row 3: Timestamp (left) & Status badge (right) */}
                    <div className="flex items-center justify-between mt-2.5">
                      <div className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-normal">
                        <Clock size={13} className="text-gray-400 shrink-0" />
                        <span>{formattedDateTime}</span>
                      </div>

                      {isDraft ? (
                        <span className="px-2.5 py-0.5 rounded bg-amber-500/10 dark:bg-[#251b0f] border border-amber-500/40 text-amber-600 dark:text-amber-500 text-xs font-medium flex items-center gap-1.5 shrink-0">
                          <Clock size={12} className="stroke-[2]" />
                          <span>Đang quét</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded bg-emerald-500/10 dark:bg-[#0f241a] border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-1.5 shrink-0">
                          <CheckCircle2 size={12} className="stroke-[2]" />
                          <span>Đã đối soát</span>
                        </span>
                      )}
                    </div>

                    {/* Row 4: Package icon & Scanned Items count */}
                    <div className="flex items-start gap-3 mt-3.5 pt-0.5">
                      <Package size={26} className="text-gray-400 dark:text-gray-300 stroke-[1.5] shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                          {session.items.length} mã đã quét
                        </div>
                        {session.items.length === 0 ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-normal">
                            Chưa có mã nào trong phiên này.
                          </div>
                        ) : isDraft ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-normal truncate">
                            Đã lưu {session.items.length} mã trong phiên sẵn sàng đối soát.
                          </div>
                        ) : (
                          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-normal mt-1 flex items-center gap-1 flex-wrap">
                            <span>{session.stats?.verified ?? session.items.length} thành công</span>
                            {(session.stats?.alreadyVerified ?? 0) > 0 && (
                              <span>· {session.stats?.alreadyVerified} trùng</span>
                            )}
                            {(session.stats?.notFound ?? 0) > 0 && (
                              <span>· {session.stats?.notFound} không thấy</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Row 5: Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 mt-3.5">
                      {/* Quét tiếp */}
                      <button
                        type="button"
                        onClick={() => handleContinueScan(session)}
                        className="py-2.5 px-3 rounded bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-[0.99]"
                      >
                        <Scan size={15} />
                        <span>Quét tiếp</span>
                      </button>

                      {/* Đối soát / Xem mã */}
                      {isDraft ? (
                        session.items.length > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => handleSubmit(session, e)}
                            disabled={isVerifyingBatch}
                            className="py-2.5 px-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-50"
                          >
                            <UploadCloud size={15} />
                            <span>Đối soát</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="py-2.5 px-3 rounded bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 cursor-not-allowed select-none"
                          >
                            <UploadCloud size={15} />
                            <span>Đối soát</span>
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedSessionForDetail(session)}
                          className="py-2.5 px-3 rounded bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <Eye size={15} />
                          <span>Xem mã</span>
                        </button>
                      )}
                    </div>

                    {/* Row 6: Helper note */}
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-normal">
                      {session.items.length === 0 ? (
                        <>
                          <Info size={13} className="shrink-0 text-gray-400" />
                          <span>Có mã quét để bắt đầu đối soát.</span>
                        </>
                      ) : isDraft ? (
                        <>
                          <Info size={13} className="shrink-0 text-gray-400" />
                          <span>Bấm &apos;Đối soát&apos; để đồng bộ đơn và cập nhật tồn kho.</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={13} className="shrink-0 text-emerald-500 dark:text-emerald-400" />
                          <span className="text-emerald-600 dark:text-emerald-400">Phiên đã hoàn tất đối soát thành công.</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer: + Tạo phiên mới button */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-[#0c1017] shrink-0">
            <button
              type="button"
              onClick={handleCreateNew}
              className="w-full py-2.5 px-4 rounded border border-[#2563eb]/40 hover:border-[#2563eb] bg-[#2563eb]/10 hover:bg-[#2563eb]/20 text-[#2563eb] dark:text-[#60a5fa] font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.99]"
            >
              <Plus size={16} />
              <span>Tạo phiên mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL FOR A SESSION */}
      {selectedSessionForDetail && (
        <Modal
          isOpen={!!selectedSessionForDetail}
          onClose={() => setSelectedSessionForDetail(null)}
          title={`Chi tiết: ${formatSessionTitle(selectedSessionForDetail.name)}`}
          subtitle={`Tổng cộng ${selectedSessionForDetail.items.length} mã đã quét (${selectedSessionForDetail.sessionCode})`}
          icon={Package}
          size="lg"
          mobilePlacement="bottom"
        >
          <ModalBody className="p-3 sm:p-5 space-y-1.5">
            {selectedSessionForDetail.items.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">Chưa có mã quét nào trong phiên này</div>
            ) : (
              selectedSessionForDetail.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded bg-gray-50 dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-400 font-semibold w-5 text-right">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-mono font-bold text-gray-900 dark:text-white">
                        {item.code}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                        {item.scannedAt} • {item.message || 'Xác nhận xuất kho'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        item.status === 'VERIFIED'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : item.status === 'ALREADY_VERIFIED'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : item.status === 'NOT_FOUND'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
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
                          const orderId = item.orderId!;
                          setSelectedSessionForDetail(null);
                          onClose();
                          onOpenOrderDetail(orderId);
                        }}
                        className="text-[#2563eb] hover:underline cursor-pointer"
                        title="Xem chi tiết đơn hàng"
                      >
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </ModalBody>

          <ModalFooter>
            <ModalButton variant="outline" onClick={() => setSelectedSessionForDetail(null)}>
              Đóng
            </ModalButton>
            <ModalButton
              variant="primary"
              onClick={() => {
                const target = selectedSessionForDetail;
                setSelectedSessionForDetail(null);
                handleContinueScan(target);
              }}
              className="gap-1.5"
            >
              <RotateCcw size={13} />
              <span>
                {selectedSessionForDetail.status === 'SUBMITTED'
                  ? 'Mở lại phiên để sửa & quét'
                  : 'Tiếp tục quét phiên này'}
              </span>
            </ModalButton>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
};
