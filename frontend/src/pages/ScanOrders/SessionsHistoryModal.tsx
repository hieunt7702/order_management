import React, { useState } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
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
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';

interface SessionsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSessionToScan: (session: ScanSession) => void;
  onOpenOrderDetail?: (orderId: string) => void;
}

// Clean session title: "Phiên quét #1 (01:41 17-10)" -> "Phiên Quét 1"
const formatSessionTitle = (rawName?: string) => {
  if (!rawName) return 'Phiên Quét 1';
  const match = rawName.match(/phiên\s+quét\s+#?(\d+)/i);
  if (match) {
    return `Phiên Quét ${match[1]}`;
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
  const [selectedSessionForDetail, setSelectedSessionForDetail] = useState<ScanSession | null>(null);

  if (!isOpen) return null;

  const filteredSessions = sessions.filter((s) => {
    if (filterTab === 'DRAFT') return s.status === 'DRAFT';
    if (filterTab === 'SUBMITTED') return s.status === 'SUBMITTED';
    return true;
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

  const handleDelete = (s: ScanSession, e: React.MouseEvent) => {
    e.stopPropagation();
    const title = formatSessionTitle(s.name);
    if (confirm(`Bạn có chắc chắn muốn xóa "${title}" (${s.items.length} mã quét)?`)) {
      deleteSession(s.id);
      toast.info(`Đã xóa ${title}`);
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
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Quản lý các phiên quét"
        subtitle="Lịch sử các phiên quét gom mã"
        icon={FileText}
        size="xl"
        mobilePlacement="bottom"
      >
        {/* Filter Tabs - Responsive Segmented Control */}
        <div className="px-3.5 sm:px-5 py-2.5 border-b border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-[#161a26]/50 shrink-0">
          <div className="grid grid-cols-3 gap-1 p-1 bg-gray-200/60 dark:bg-[#1a1e2b] rounded-lg text-center">
            <button
              type="button"
              onClick={() => setFilterTab('ALL')}
              className={`py-1.5 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer truncate ${
                filterTab === 'ALL'
                  ? 'bg-white dark:bg-[#2563eb] text-[#2563eb] dark:text-white shadow-xs'
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
                  ? 'bg-white dark:bg-amber-600 text-amber-600 dark:text-white shadow-xs'
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
                  ? 'bg-white dark:bg-emerald-600 text-emerald-600 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">Đã soát ({sessions.filter((s) => s.status === 'SUBMITTED').length})</span>
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <ModalBody className="p-3 sm:p-5 space-y-2.5">
          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <FileText size={36} className="mx-auto mb-2 opacity-30 stroke-[1.5]" />
              <p className="text-xs sm:text-sm font-medium">Không có phiên quét nào trong mục này</p>
              <button
                type="button"
                onClick={handleCreateNew}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563eb] text-white text-xs font-semibold shadow-xs hover:bg-[#1d4ed8] transition-colors cursor-pointer"
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

              return (
                <div
                  key={session.id}
                  onClick={() => handleContinueScan(session)}
                  className={`relative p-3 rounded-lg border transition-all cursor-pointer ${
                    isCurrentActive
                      ? 'border-2 border-[#2563eb] dark:border-[#3b82f6] bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161a23] hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  {/* Corner Active Indicator */}
                  {isCurrentActive && (
                    <div
                      className="absolute top-3 right-3 flex items-center justify-center w-5 h-5 rounded-full bg-[#2563eb]/15 dark:bg-[#2563eb]/25 text-[#2563eb] dark:text-blue-400 border border-[#2563eb]/30 shadow-xs"
                      title="Phiên đang mở quét hiện tại"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#2563eb] dark:bg-blue-400 animate-pulse" />
                    </div>
                  )}

                  {/* Header Row: Title, Code & Icon Status */}
                  <div className={`flex items-center gap-1.5 sm:gap-2 flex-wrap ${isCurrentActive ? 'pr-7' : ''}`}>
                    <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                      {sessionTitle}
                    </span>
                    <span className="font-mono text-xs text-gray-400 dark:text-gray-400 font-semibold">
                      ({session.sessionCode})
                    </span>

                    {/* Status using ICON and COLOR only */}
                    {isDraft ? (
                      <span
                        title="Đang quét dở"
                        className="grid place-items-center w-5 h-5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 shrink-0 leading-none"
                      >
                        <Clock size={11} className="stroke-[2.2] block shrink-0" />
                      </span>
                    ) : (
                      <span
                        title="Đã đối soát"
                        className="grid place-items-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 shrink-0 leading-none"
                      >
                        <CheckCircle2 size={11} className="stroke-[2.2] block shrink-0" />
                      </span>
                    )}
                  </div>

                  {/* Metadata Row: Count & Time */}
                  <div className="flex items-center gap-2 text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Package size={12} className="text-gray-400 shrink-0" />
                      <strong className="text-gray-900 dark:text-white font-mono">
                        {session.items.length}
                      </strong>{' '}
                      mã
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 font-mono">
                      <Clock size={11} className="shrink-0" />
                      {new Date(session.createdAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      {new Date(session.createdAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Verification Results: Distinct Badge Pills */}
                  {!isDraft && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-800/60">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold whitespace-nowrap">
                        <span className="font-bold">✓</span> {session.stats?.verified ?? 0} thành công
                      </span>
                      {(session.stats?.alreadyVerified ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-semibold whitespace-nowrap">
                          <span className="font-bold">⚠</span> {session.stats.alreadyVerified} trùng
                        </span>
                      )}
                      {(session.stats?.notFound ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-semibold whitespace-nowrap">
                          <span className="font-bold">✕</span> {session.stats.notFound} không thấy
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action Buttons Row */}
                  <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between gap-2 flex-wrap">
                    {/* Left: Preview first codes */}
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                      {session.items.length > 0 ? (
                        <>
                          <span className="text-[10px] text-gray-400 shrink-0">Mã:</span>
                          {session.items.slice(0, 3).map((it) => (
                            <span
                              key={it.id}
                              className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#1a1e2b] text-gray-700 dark:text-gray-300 font-mono text-[10px] font-medium"
                            >
                              {it.code}
                            </span>
                          ))}
                          {session.items.length > 3 && (
                            <span className="text-[10px] text-gray-400 font-medium">
                              +{session.items.length - 3}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">Chưa có mã</span>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleContinueScan(session)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold cursor-pointer shadow-xs transition-all"
                        title={isDraft ? 'Tiếp tục quét mã vào phiên này' : 'Mở lại phiên này để quét thêm hoặc sửa/xóa mã'}
                      >
                        <Play size={11} className="fill-current" />
                        <span>Quét tiếp</span>
                      </button>

                      {isDraft ? (
                        <button
                          type="button"
                          disabled={session.items.length === 0 || isVerifyingBatch}
                          onClick={(e) => handleSubmit(session, e)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer shadow-xs transition-all"
                          title="Gửi danh sách mã để đối soát & cập nhật đơn hàng"
                        >
                          <UploadCloud size={12} />
                          <span>Đối soát</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setSelectedSessionForDetail(session)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-200 cursor-pointer"
                            title="Xem chi tiết các mã trong phiên"
                          >
                            <Eye size={12} />
                            <span>Xem mã</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleExportCSV(session, e)}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                            title="Xuất file CSV"
                          >
                            <Download size={12} />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDelete(session, e)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Xóa phiên này"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </ModalBody>

        {/* Modal Footer with Close & Create Session Buttons */}
        <ModalFooter>
          <ModalButton variant="outline" onClick={onClose}>
            Đóng
          </ModalButton>
          <ModalButton variant="primary" onClick={handleCreateNew} className="gap-1.5">
            <Plus size={15} />
            <span>Tạo phiên mới</span>
          </ModalButton>
        </ModalFooter>
      </Modal>

      {/* DETAIL MODAL FOR A SESSION (USING SYSTEM MODAL) */}
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
                  className="p-2.5 rounded-lg bg-gray-50 dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs"
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
                        className="text-[#2563eb] hover:underline"
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
              <Play size={12} className="fill-current" />
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
