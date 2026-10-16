import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Volume2,
  VolumeX,
  FileText,
  Package,
  Search,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Pause,
  Play,
  Camera,
  Keyboard,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Zap,
  ZapOff,
  Download,
  Trash2,
  Eye,
  SlidersHorizontal,
  Activity,
  Building2,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { fulfillmentApi } from '../../services/fulfillmentApi';
import { ordersApi } from '../../services/ordersApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { playSuccessSound, playErrorSound, playWarningSound } from '../../utils/sound';
import { ScannedOrdersListModal } from './ScannedOrdersListModal';
import { OrderDetailDrawer } from '../Orders/OrderDetailDrawer';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../components/ui/DropdownMenu';
import { toast } from '../../components/ui/Toast';
import { Select } from '../../components/ui/Select';

interface SessionScanItem {
  id: string | number;
  code: string;
  trackingCode: string;
  packageCode: string;
  orderId: string;
  carrierName: string;
  shopName: string;
  result: 'VERIFIED' | 'ALREADY_VERIFIED' | 'ERROR' | 'REVERSED';
  message?: string;
  timestamp: string;
  packageId?: string;
  source: string;
}

interface AmbiguousCandidate {
  packageId: string;
  packageCode: string;
  trackingCode?: string;
  externalOrderId: string;
  shopName: string;
  carrierName: string;
  status?: string;
}

export const ScanOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedWarehouseId, warehouses, setSelectedWarehouseId } = useWorkspaceStore();

  // Session metadata
  const [sessionCode] = useState<string>(() => `QS-${Math.floor(1000 + Math.random() * 9000)}`);
  const [sessionStartTime] = useState<string>(() =>
    new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  );

  // Auto select default warehouse if not selected
  useEffect(() => {
    if (!selectedWarehouseId && warehouses.length > 0) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId, setSelectedWarehouseId]);

  // Focus mode / Fullscreen
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

  // Tab & Input modes
  const [activeInputTab, setActiveInputTab] = useState<'camera' | 'manual'>('camera');
  const [activeResultsTab, setActiveResultsTab] = useState<'session' | 'historical'>('session');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Camera state & Zoom (DEFAULT 2X as requested)
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isCameraPaused, setIsCameraPaused] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(2); // Default zoom 2x!
  const [scanFlash, setScanFlash] = useState<'success' | 'warning' | 'error' | null>(null);

  // Results & History
  const [lastScanResult, setLastScanResult] = useState<{
    result: 'VERIFIED' | 'ALREADY_VERIFIED' | 'ERROR' | 'REVERSED';
    code: string;
    message?: string;
    timestamp: string;
    orderId?: string;
    raw?: any;
  } | null>(null);

  const [sessionScans, setSessionScans] = useState<SessionScanItem[]>([]);
  const [historicalScans, setHistoricalScans] = useState<any[]>([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(false);
  const [ambiguousCandidates, setAmbiguousCandidates] = useState<AmbiguousCandidate[] | null>(null);

  // Modal / Drawer states
  const [isListModalOpen, setIsListModalOpen] = useState<boolean>(false);
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Refs
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isCameraRunningRef = useRef<boolean>(false);
  const scannedCodesSet = useRef<Set<string>>(new Set());
  const lastDuplicateNoticeTime = useRef<number>(0);

  // Focus keyboard input on mount
  useEffect(() => {
    focusInput();
  }, []);

  const focusInput = () => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
  };

  // Get available video devices
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('sau') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment'),
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch((err) => {
        console.warn('Could not list cameras:', err);
      });
  }, []);

  // Initialize camera on mount or camera switch
  useEffect(() => {
    if (activeInputTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [selectedCameraId, facingMode, activeInputTab]);

  // Apply Zoom (hardware track constraint + CSS transform fallback)
  const applyZoom = async (newZoom: number) => {
    setZoom(newZoom);

    // 1. Hardware track zoom
    try {
      const videoEl = document.querySelector('#barcode-camera-reader video') as HTMLVideoElement;
      if (videoEl && videoEl.srcObject instanceof MediaStream) {
        const track = videoEl.srcObject.getVideoTracks()[0];
        const capabilities: any = track?.getCapabilities ? track.getCapabilities() : {};
        if (capabilities && capabilities.zoom) {
          const minZ = capabilities.zoom.min || 1;
          const maxZ = capabilities.zoom.max || 10;
          await track.applyConstraints({
            advanced: [{ zoom: Math.min(Math.max(newZoom, minZ), maxZ) } as any],
          });
        }
      }
    } catch {
      // Ignore hardware constraint failure
    }

    // 2. CSS scale on video element for guaranteed visual magnification
    const videoEl = document.querySelector('#barcode-camera-reader video') as HTMLVideoElement;
    if (videoEl) {
      videoEl.style.transform = `scale(${newZoom})`;
      videoEl.style.transformOrigin = 'center center';
      videoEl.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    }
  };

  // Toggle through zoom levels with single button: 1x -> 2x -> 3x -> 4x -> 1x
  const handleToggleZoom = () => {
    const zoomLevels = [1, 2, 3, 4];
    const currentIndex = zoomLevels.indexOf(zoom);
    const nextZoom = zoomLevels[(currentIndex + 1) % zoomLevels.length];
    applyZoom(nextZoom);
  };

  const startCamera = async () => {
    try {
      setCameraError('');
      if (scannerRef.current) {
        await stopCamera();
      }

      const container = document.getElementById('barcode-camera-reader');
      if (!container) return;

      const html5QrCode = new Html5Qrcode('barcode-camera-reader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      // Omit qrbox to remove html5-qrcode's default white corner box overlay
      const config = {
        fps: 25,
        aspectRatio: 1.33,
      };

      const cameraParam = selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode };

      await html5QrCode.start(
        cameraParam,
        config,
        (decodedText) => {
          handleCameraBarcode(decodedText);
        },
        () => {},
      );

      setIsCameraActive(true);
      setIsCameraPaused(false);
      isCameraRunningRef.current = true;

      // Apply initial zoom 2x after starting!
      setTimeout(() => {
        applyZoom(2);
      }, 350);
    } catch (err) {
      console.warn('Cannot start camera:', err);
      setCameraError(
        'Không thể mở camera. Vui lòng cấp quyền truy cập Camera cho trình duyệt hoặc chuyển sang tab Nhập mã.',
      );
      setIsCameraActive(false);
      isCameraRunningRef.current = false;
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && isCameraRunningRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
      setIsCameraActive(false);
      isCameraRunningRef.current = false;
    }
  };

  // Toggle Camera Pause/Resume
  const togglePauseCamera = async () => {
    if (!scannerRef.current) return;
    try {
      if (isCameraPaused) {
        scannerRef.current.resume();
        setIsCameraPaused(false);
      } else {
        scannerRef.current.pause();
        setIsCameraPaused(true);
      }
    } catch (err) {
      console.warn('Toggle pause camera failed:', err);
    }
  };

  // Toggle Flashlight (Torch)
  const toggleTorch = async () => {
    if (!scannerRef.current || !isCameraActive) return;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: !torchOn } as any],
      });
      setTorchOn(!torchOn);
    } catch {
      toast.warning('Thiết bị hoặc camera không hỗ trợ đèn flash');
    }
  };

  // Switch between front and back camera
  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    setSelectedCameraId('');
  };

  // Load confirmed scans from server
  // Load confirmed scans from server
  const loadHistoricalScans = async () => {
    setIsLoadingHistorical(true);
    try {
      const whId = selectedWarehouseId || warehouses[0]?.id;
      const res: any = await fulfillmentApi.getScanHistory({
        limit: 50,
        warehouseId: whId || undefined,
      });

      const eventsList = (res?.events || []).map((ev: any) => {
        const isSuccess = ev.scanResult === 'VERIFIED';
        const isDuplicate = ev.scanResult === 'ALREADY_VERIFIED';
        return {
          id: ev.id,
          code: ev.package?.trackingCode || ev.package?.packageCode || ev.rawCode,
          trackingCode: ev.package?.trackingCode || ev.rawCode,
          packageCode: ev.package?.packageCode || ev.normalizedCode,
          orderId: ev.order?.externalOrderId || 'N/A',
          internalOrderCode: ev.order?.internalOrderCode,
          shopName: ev.order?.shop?.name || ev.shop?.name || 'Gian hàng',
          carrierName: ev.package?.carrierName || ev.order?.shippingCarrier || 'SPX Express',
          result: isSuccess ? 'VERIFIED' : isDuplicate ? 'ALREADY_VERIFIED' : 'ERROR',
          message:
            ev.errorMessage ||
            (isSuccess
              ? 'Đã xác nhận xuất kho'
              : isDuplicate
              ? 'Đã quét trước đó'
              : 'Kiểm tra mã hoặc shop'),
          timestamp: new Date(ev.createdAt).toLocaleTimeString('vi-VN'),
          source: ev.deviceId || 'SCANNER',
          rawDate: new Date(ev.createdAt),
          packageId: ev.package?.id,
        };
      });

      setHistoricalScans(eventsList);
    } catch (err) {
      console.error('Error loading historical scans:', err);
    } finally {
      setIsLoadingHistorical(false);
    }
  };

  useEffect(() => {
    loadHistoricalScans();
  }, [selectedWarehouseId]);

  // Handle scanned barcode from camera
  const handleCameraBarcode = (decodedText: string) => {
    const rawCode = (decodedText || '').trim();
    if (!rawCode) return;

    const cleanCode = rawCode.toUpperCase();
    const now = Date.now();

    // Check duplicate in current session
    if (scannedCodesSet.current.has(cleanCode)) {
      if (now - lastDuplicateNoticeTime.current > 2500) {
        lastDuplicateNoticeTime.current = now;
        if (soundEnabled) playWarningSound();
        setScanFlash('warning');
        setTimeout(() => setScanFlash(null), 800);
        setLastScanResult({
          result: 'ALREADY_VERIFIED',
          code: cleanCode,
          message: 'Không ghi nhận xuất kho lần nữa (đã quét trong phiên)',
          timestamp: new Date().toLocaleTimeString('vi-VN'),
        });
      }
      return;
    }

    scannedCodesSet.current.add(cleanCode);
    executeScan(rawCode, 'CAMERA_SCANNER');
  };

  // Handle manual / USB gun input
  const handleManualScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const cleanCode = code.toUpperCase();
    if (scannedCodesSet.current.has(cleanCode)) {
      if (soundEnabled) playWarningSound();
      setScanFlash('warning');
      setTimeout(() => setScanFlash(null), 800);
      setLastScanResult({
        result: 'ALREADY_VERIFIED',
        code: cleanCode,
        message: 'Không ghi nhận xuất kho lần nữa (đã quét trong phiên)',
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
      setBarcodeInput('');
      return;
    }

    scannedCodesSet.current.add(cleanCode);
    executeScan(code, 'BROWSER_KEYBOARD_SCANNER');
  };

  // Execute scan against backend API
  const executeScan = async (
    code: string | null,
    source = 'CAMERA_SCANNER',
    forcedPackageId: string | null = null,
  ) => {
    if (!code && !forcedPackageId) return;

    setIsScanning(true);
    setAmbiguousCandidates(null);

    const idempotencyKey = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const warehouseId = selectedWarehouseId || warehouses[0]?.id || '';

    try {
      const res: any = await fulfillmentApi.scanBarcode(
        code || '',
        warehouseId,
        source,
        forcedPackageId || undefined,
        idempotencyKey,
      );

      const timestamp = new Date().toLocaleTimeString('vi-VN');
      const isSuccess = res.result === 'VERIFIED';
      const isDuplicate = res.result === 'ALREADY_VERIFIED';
      const isAmbiguous = res.result === 'AMBIGUOUS_CODE';

      if (soundEnabled) {
        if (isSuccess) playSuccessSound();
        else if (isDuplicate || isAmbiguous) playWarningSound();
        else playErrorSound();
      }

      if (isAmbiguous && res.candidates) {
        setScanFlash('warning');
        setTimeout(() => setScanFlash(null), 800);
        setAmbiguousCandidates(res.candidates);
        toast.warning(res.message || 'Mã quét khớp với nhiều kiện hàng. Vui lòng chọn đúng đơn.');
        return;
      }

      const trackingCode =
        res.package?.trackingCode || (code && code.length > 5 ? code : res.package?.packageCode || 'N/A');
      const packageCode = res.package?.packageCode || res.packageCode || 'N/A';
      const orderId = res.order?.externalOrderId || res.externalOrderId || code || 'N/A';
      const carrierName = res.package?.carrierName || res.carrierName || 'SPX Express';
      const shopName = res.order?.shop?.name || 'Gian hàng';

      let resultType: 'VERIFIED' | 'ALREADY_VERIFIED' | 'ERROR' = 'ERROR';
      if (isSuccess) resultType = 'VERIFIED';
      else if (isDuplicate) resultType = 'ALREADY_VERIFIED';

      const message =
        res.message ||
        (isSuccess
          ? 'Đã xác nhận xuất kho thành công'
          : isDuplicate
          ? 'Không ghi nhận xuất kho lần nữa'
          : 'Kiểm tra mã hoặc shop đang chọn');

      const newItem: SessionScanItem = {
        id: Date.now(),
        code: trackingCode,
        trackingCode,
        packageCode,
        orderId,
        carrierName,
        shopName,
        result: resultType,
        message,
        timestamp,
        packageId: res.package?.id || res.packageId,
        source,
      };

      setSessionScans((prev) => [newItem, ...prev]);
      setLastScanResult({
        result: resultType,
        code: trackingCode,
        message,
        timestamp,
        orderId,
        raw: res,
      });

      if (isSuccess) {
        setScanFlash('success');
        setTimeout(() => setScanFlash(null), 800);
        toast.success(message);
        loadHistoricalScans();
      } else if (isDuplicate) {
        setScanFlash('warning');
        setTimeout(() => setScanFlash(null), 800);
        toast.warning(message);
      } else {
        setScanFlash('error');
        setTimeout(() => setScanFlash(null), 800);
        toast.error(message);
      }

      setBarcodeInput('');
    } catch (err: any) {
      if (soundEnabled) playErrorSound();
      setScanFlash('error');
      setTimeout(() => setScanFlash(null), 800);
      const timestamp = new Date().toLocaleTimeString('vi-VN');
      const errorMsg = err.message || 'Kiểm tra mã hoặc shop đang chọn';
      toast.error(errorMsg);

      setLastScanResult({
        result: 'ERROR',
        code: code || 'N/A',
        message: errorMsg,
        timestamp,
      });
      setSessionScans((prev) => [
        {
          id: Date.now(),
          code: code || 'N/A',
          trackingCode: code || 'N/A',
          packageCode: 'N/A',
          orderId: 'N/A',
          carrierName: 'SPX Express',
          shopName: 'Chưa xác định',
          result: 'ERROR',
          message: errorMsg,
          timestamp,
          source,
        },
        ...prev,
      ]);
    } finally {
      setIsScanning(false);
      focusInput();
    }
  };

  // Open order detail drawer
  const handleOpenOrderDetail = async (orderId?: string) => {
    if (!orderId || orderId === 'N/A') {
      navigate('/orders');
      return;
    }
    try {
      const res: any = await ordersApi.findAll({ search: orderId, limit: 1 });
      if (res?.data?.[0]) {
        setSelectedOrderForDrawer(res.data[0]);
        setIsDrawerOpen(true);
      } else {
        navigate(`/orders?search=${encodeURIComponent(orderId)}`);
      }
    } catch {
      navigate(`/orders?search=${encodeURIComponent(orderId)}`);
    }
  };

  // Reverse dispatch
  const handleReverse = async (packageId: string, code: string) => {
    const reason = prompt('Nhập lý do hoàn tác xuất kho:');
    if (!reason) return;

    try {
      await fulfillmentApi.reverseDispatch(packageId, reason);
      if (code) {
        scannedCodesSet.current.delete(code.toUpperCase());
      }
      setSessionScans((prev) =>
        prev.map((s) =>
          s.packageId === packageId ? { ...s, result: 'REVERSED', message: 'Đã hoàn tác xuất kho' } : s,
        ),
      );
      toast.success('Đã hoàn tác xuất kho kiện hàng');
      loadHistoricalScans();
    } catch (err: any) {
      toast.error('Lỗi hoàn tác', err.message);
    }
  };

  // Clear / End session
  const handleClearSession = () => {
    if (sessionScans.length > 0 && !confirm('Bạn có chắc chắn muốn kết thúc phiên và xóa danh sách quét này?')) {
      return;
    }
    scannedCodesSet.current.clear();
    lastDuplicateNoticeTime.current = 0;
    setSessionScans([]);
    setLastScanResult(null);
    toast.info('Đã kết thúc phiên quét');
  };

  // Export CSV
  const handleExportList = () => {
    if (sessionScans.length === 0) {
      toast.warning('Chưa có mã quét nào trong phiên');
      return;
    }
    const headers = ['Mã vận đơn / Đơn hàng', 'Mã kiện', 'Gian hàng', 'Đơn vị VC', 'Kết quả', 'Thời gian'];
    const rows = sessionScans.map((s) => [
      s.trackingCode || s.code,
      s.packageCode,
      s.shopName,
      s.carrierName,
      s.result === 'VERIFIED'
        ? 'Thành công'
        : s.result === 'ALREADY_VERIFIED'
        ? 'Đã quét trước đó'
        : 'Lỗi / Không tìm thấy',
      s.timestamp,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${c || ''}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `xuat_kho_${sessionCode}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã tải xuống danh sách mã quét');
  };

  // Copy code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Đã sao chép: ${code}`);
  };

  // Statistics
  const stats = {
    total: sessionScans.length,
    verified: sessionScans.filter((s) => s.result === 'VERIFIED').length,
    alreadyVerified: sessionScans.filter((s) => s.result === 'ALREADY_VERIFIED').length,
    failed: sessionScans.filter((s) => s.result === 'ERROR' || s.result === 'REVERSED').length,
  };

  // Filtered scans
  const displayScans =
    activeResultsTab === 'session'
      ? sessionScans.filter(
          (s) =>
            s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.orderId.toLowerCase().includes(searchTerm.toLowerCase()),
        )
      : historicalScans.filter(
          (s) =>
            s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.orderId.toLowerCase().includes(searchTerm.toLowerCase()),
        );

  return (
    <div
      className={`w-full flex flex-col space-y-4 animate-in fade-in duration-300 ${
        isFocusMode ? 'fixed inset-0 z-50 bg-[#0c0e14] p-4 md:p-6 overflow-y-auto' : ''
      }`}
    >
      {/* 1. TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[#5865f2]/10 border border-[#5865f2]/20 text-[#5865f2] flex items-center justify-center shrink-0">
            <ScanLine size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                Quét xuất hàng
              </h1>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Quét mã vận đơn hoặc mã đơn hàng để xác nhận xuất kho.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {warehouses.length > 1 && (
            <div className="w-[160px] sm:w-[200px]">
              <Select
                value={selectedWarehouseId || ''}
                onChange={(val) => setSelectedWarehouseId(String(val))}
                options={warehouses.map((w) => ({
                  value: w.id,
                  label: w.name,
                  icon: Building2,
                }))}
                icon={Building2}
                size="sm"
                className="w-full"
                placeholder="Chọn kho..."
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. TOP METRICS / SESSION BAR */}
      {/* Desktop Stat Bar */}
      <div className="hidden md:grid grid-cols-4 gap-3 shrink-0">
        {/* Card 1: Session */}
        <div className="p-3.5 rounded bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 flex items-center justify-between shadow-none">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#5865f2]/10 text-[#5865f2] flex items-center justify-center shrink-0 border border-[#5865f2]/20">
              <FileText size={17} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  Phiên quét #{sessionCode}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Đang hoạt động
                </span>
              </div>
              <span className="text-[11px] text-gray-400 block mt-0.5">
                Bắt đầu {sessionStartTime}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Lượt quét */}
        <div className="p-3.5 rounded bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 flex items-center justify-between shadow-none">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/20">
              <ScanLine size={17} />
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block">Lượt quét</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {stats.total}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Xuất kho mới */}
        <div className="p-3.5 rounded bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 flex items-center justify-between shadow-none">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <Package size={17} />
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block">Xuất kho mới</span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 leading-tight">
                {stats.verified}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Cần kiểm tra */}
        <div className="p-3.5 rounded bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 flex items-center justify-between shadow-none">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
              <AlertTriangle size={17} />
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block">Cần kiểm tra</span>
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400 leading-tight">
                {stats.alreadyVerified + stats.failed}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Stat Header */}
      <div className="md:hidden space-y-2 shrink-0">
        <div className="p-3 rounded bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#5865f2]/10 text-[#5865f2] flex items-center justify-center border border-[#5865f2]/20">
              <FileText size={15} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  Phiên #{sessionCode}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  Đang quét
                </span>
              </div>
              <span className="text-[11px] text-gray-400">Bắt đầu {sessionStartTime}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <ScanLine size={13} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-400 block truncate">Lượt quét</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white leading-none">
                {stats.total}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 size={13} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-400 block truncate">Thành công</span>
              <span className="text-sm font-bold text-emerald-500 leading-none">
                {stats.verified}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <AlertTriangle size={13} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-400 block truncate">Cần kiểm tra</span>
              <span className="text-sm font-bold text-amber-500 leading-none">
                {stats.alreadyVerified + stats.failed}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE GRID: Left (Scanner & Controls) vs Right (Results list) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* LEFT COLUMN: Camera & Input (7 Cols on PC) */}
        <div className="lg:col-span-7 flex flex-col space-y-3.5">
          {/* Scanner Header & Mode Tabs */}
          <div className="p-3.5 rounded bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 flex flex-col space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900 dark:text-white">Quét mã</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Sẵn sàng
                </span>
                <button
                  type="button"
                  onClick={() => setIsFocusMode(!isFocusMode)}
                  className={`w-7 h-7 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                    isFocusMode
                      ? 'border-[#5865f2] bg-[#5865f2]/10 text-[#5865f2]'
                      : 'border-gray-200 dark:border-gray-700/80 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title={isFocusMode ? 'Thoát chế độ tập trung' : 'Chế độ tập trung (Toàn màn hình)'}
                  aria-label={isFocusMode ? 'Thoát chế độ tập trung' : 'Chế độ tập trung'}
                >
                  {isFocusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              </div>

              {/* Camera selection dropdown */}
              {cameras.length > 0 && (
                <div className="w-[190px] sm:w-[260px]">
                  <Select
                    value={selectedCameraId}
                    onChange={(val) => setSelectedCameraId(String(val))}
                    options={cameras.map((c, i) => ({
                      value: c.id,
                      label: c.label || `Camera ${i + 1}`,
                      icon: Camera,
                    }))}
                    icon={Camera}
                    size="sm"
                    className="w-full"
                    placeholder="Chọn camera..."
                  />
                </div>
              )}
            </div>

            {/* Input switcher tabs (Camera vs Máy quét USB/Nhập tay) */}
            <div className="grid grid-cols-2 p-0.5 bg-gray-100 dark:bg-[#1a1e2b] rounded border border-gray-200 dark:border-gray-700/60">
              <button
                type="button"
                onClick={() => setActiveInputTab('camera')}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded transition-colors cursor-pointer ${
                  activeInputTab === 'camera'
                    ? 'bg-[#2563eb] text-white shadow-none'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <Camera size={14} />
                <span>Camera</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveInputTab('manual')}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded transition-colors cursor-pointer ${
                  activeInputTab === 'manual'
                    ? 'bg-[#2563eb] text-white shadow-none'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <Keyboard size={14} />
                <span>Máy quét USB / Nhập tay</span>
              </button>
            </div>
          </div>

          {/* CAMERA VIEWPORT CONTAINER */}
          {activeInputTab === 'camera' && (
            <div
              className={`rounded bg-black border overflow-hidden relative group transition-all duration-300 ${
                scanFlash === 'success'
                  ? 'border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.35)] ring-2 ring-emerald-500/50'
                  : scanFlash === 'warning'
                  ? 'border-amber-500 shadow-[0_0_24px_rgba(245,158,11,0.35)] ring-2 ring-amber-500/50'
                  : scanFlash === 'error'
                  ? 'border-rose-500 shadow-[0_0_24px_rgba(244,63,94,0.35)] ring-2 ring-rose-500/50'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              {/* CSS to eliminate html5-qrcode's white outer box and style laser animation */}
              <style>{`
                #barcode-camera-reader #qr-shaded-region,
                #barcode-camera-reader svg,
                #barcode-camera-reader path {
                  display: none !important;
                }
                #barcode-camera-reader {
                  border: none !important;
                }
                #barcode-camera-reader video {
                  width: 100% !important;
                  height: 100% !important;
                  object-fit: cover !important;
                }
                @keyframes laserSweep {
                  0% { top: 6%; opacity: 0.7; }
                  50% { top: 92%; opacity: 1; }
                  100% { top: 6%; opacity: 0.7; }
                }
                .laser-sweep-beam {
                  animation: laserSweep 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
              `}</style>

              {/* Aspect Ratio Video Container */}
              <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-black overflow-hidden flex items-center justify-center">
                {/* HTML5 QR Code Mount Element */}
                <div id="barcode-camera-reader" className="w-full h-full" />

                {/* Target Frame with Animated Laser & Guidance Pill (Overlay) */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                  <div className="relative w-64 sm:w-80 h-36 sm:h-48">
                    {/* Glowing scanning laser beam */}
                    <div className="laser-sweep-beam absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-[#3b82f6] to-transparent shadow-[0_0_10px_#3b82f6]" />

                    {/* Top-Left */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-[#3b82f6] rounded-tl shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    {/* Top-Right */}
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-[#3b82f6] rounded-tr shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    {/* Bottom-Left */}
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-[#3b82f6] rounded-bl shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    {/* Bottom-Right */}
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-[#3b82f6] rounded-br shadow-[0_0_8px_rgba(59,130,246,0.5)]" />

                    {/* Centered Instruction Pill */}
                    <div className="absolute bottom-2.5 inset-x-0 flex justify-center">
                      <span className="px-3.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-[11px] font-medium text-white shadow-none border border-white/10">
                        Đưa mã vận đơn vào khung
                      </span>
                    </div>
                  </div>
                </div>

                {/* Overlays: Top Left Camera Pill & Top Right Action Buttons */}
                <div className="absolute top-3 inset-x-3 flex items-center justify-between z-20 pointer-events-auto">
                  {/* Left: Camera Selector Badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white text-[11px] font-medium shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <Camera size={12} className="text-emerald-400" />
                    <span className="truncate max-w-[120px] sm:max-w-[180px]">
                      {facingMode === 'environment' ? 'Camera sau' : 'Camera trước'}
                    </span>
                  </div>

                  {/* Right: Single Zoom Button & Torch & Switch */}
                  <div className="flex items-center gap-1.5">
                    {/* SINGLE TOGGLE ZOOM BUTTON */}
                    <button
                      type="button"
                      onClick={handleToggleZoom}
                      className="w-7 h-7 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-95 text-white border border-blue-400/40 flex items-center justify-center backdrop-blur-md transition-all cursor-pointer font-mono text-[11px] font-bold select-none shadow-sm"
                      title={`Mức thu phóng: ${zoom}x. Bấm để đổi (1x → 2x → 3x → 4x)`}
                    >
                      {zoom}x
                    </button>

                    {/* Flashlight Torch */}
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`w-7 h-7 rounded-full flex items-center justify-center border backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-sm ${
                        torchOn
                          ? 'bg-amber-500 text-white border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                          : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                      }`}
                      title={torchOn ? 'Tắt đèn Flash' : 'Bật đèn Flash'}
                    >
                      {torchOn ? <Zap size={13} className="fill-current" /> : <ZapOff size={13} />}
                    </button>

                    {/* Switch Camera */}
                    <button
                      type="button"
                      onClick={handleSwitchCamera}
                      className="w-7 h-7 rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/80 active:scale-95 flex items-center justify-center backdrop-blur-md transition-all cursor-pointer shadow-sm"
                      title="Đổi camera trước/sau"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>

                {/* Error overlay if camera blocked */}
                {cameraError && (
                  <div className="absolute inset-0 bg-black/90 p-5 flex flex-col items-center justify-center text-center z-30 space-y-3">
                    <AlertTriangle size={32} className="text-amber-500" />
                    <p className="text-xs text-gray-300 max-w-sm">{cameraError}</p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3 py-1.5 rounded bg-[#2563eb] text-white text-xs font-medium cursor-pointer"
                    >
                      Thử lại
                    </button>
                  </div>
                )}
              </div>

              {/* Camera Control Bar under Video */}
              {/* Desktop Bar */}
              <div className="hidden sm:flex items-center justify-between p-3 bg-white dark:bg-[#131722] border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePauseCamera}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700/80 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    {isCameraPaused ? <Play size={13} /> : <Pause size={13} />}
                    <span>{isCameraPaused ? 'Tiếp tục camera' : 'Tạm dừng camera'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-colors cursor-pointer ${
                      soundEnabled
                        ? 'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-gray-200 dark:border-gray-700/80 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                    <span>{soundEnabled ? 'Âm thanh bật' : 'Tắt âm thanh'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFocusMode(!isFocusMode)}
                  className={`w-7 h-7 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                    isFocusMode
                      ? 'border-[#5865f2] bg-[#5865f2]/10 text-[#5865f2]'
                      : 'border-gray-200 dark:border-gray-700/80 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title={isFocusMode ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
                  aria-label={isFocusMode ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
                >
                  {isFocusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              </div>

              {/* Mobile Bar (Matching Image 2) */}
              <div className="sm:hidden grid grid-cols-3 gap-2 p-2.5 bg-white dark:bg-[#131722] border-t border-gray-200 dark:border-gray-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  className="flex items-center justify-center gap-1.5 py-2 rounded bg-gray-100 dark:bg-[#1a1e2b] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700/80 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Đổi camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded border cursor-pointer ${
                    soundEnabled
                      ? 'border-blue-500/40 bg-blue-500/10 text-blue-500'
                      : 'border-gray-200 dark:border-gray-700/80 bg-gray-100 dark:bg-[#1a1e2b] text-gray-400'
                  }`}
                >
                  {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                  <span>Âm thanh</span>
                </button>
                <button
                  type="button"
                  onClick={togglePauseCamera}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded border cursor-pointer ${
                    isCameraPaused
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                      : 'bg-gray-100 dark:bg-[#1a1e2b] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700/80'
                  }`}
                >
                  {isCameraPaused ? <Play size={13} /> : <Pause size={13} />}
                  <span>{isCameraPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                </button>
              </div>
            </div>
          )}

          {/* MANUAL INPUT BOX (Always visible on PC, or when Tab = Manual) */}
          <div className="p-3.5 rounded bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 space-y-2.5 shadow-none">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
              <Keyboard size={14} className="text-gray-400" />
              <span>Nhập mã thủ công</span>
            </div>

            <form onSubmit={handleManualScanSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Nhập mã vận đơn hoặc mã đơn hàng"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-[#1a1e2b] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 font-mono shadow-none"
                />
              </div>
              <button
                type="submit"
                disabled={isScanning || !barcodeInput.trim()}
                className="px-4 py-2 rounded bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-none"
              >
                <span>Xác nhận</span>
                <span className="text-[11px]">↵</span>
              </button>
            </form>
            <p className="text-[11px] text-gray-400">Nhấn Enter để xác nhận</p>
          </div>

          {/* LATEST SCAN RESULT BANNER (Matching Image 1 & 2) */}
          {lastScanResult && (
            <div
              className={`p-3.5 rounded border flex items-center justify-between gap-3 shadow-none transition-all ${
                lastScanResult.result === 'VERIFIED'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-100'
                  : lastScanResult.result === 'ALREADY_VERIFIED'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-100'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-100'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    lastScanResult.result === 'VERIFIED'
                      ? 'bg-emerald-500 text-white'
                      : lastScanResult.result === 'ALREADY_VERIFIED'
                      ? 'bg-amber-500 text-white'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {lastScanResult.result === 'VERIFIED' ? (
                    <CheckCircle2 size={20} className="stroke-[2.5]" />
                  ) : lastScanResult.result === 'ALREADY_VERIFIED' ? (
                    <AlertTriangle size={18} className="stroke-[2.5]" />
                  ) : (
                    <XCircle size={20} className="stroke-[2.5]" />
                  )}
                </div>

                <div className="min-w-0">
                  <h4
                    className={`text-xs font-bold leading-tight ${
                      lastScanResult.result === 'VERIFIED'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : lastScanResult.result === 'ALREADY_VERIFIED'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {lastScanResult.result === 'VERIFIED'
                      ? 'Xuất kho thành công'
                      : lastScanResult.result === 'ALREADY_VERIFIED'
                      ? 'Đã quét trước đó'
                      : 'Không tìm thấy đơn'}
                  </h4>
                  <div className="font-mono text-sm font-bold text-gray-900 dark:text-white truncate mt-0.5">
                    {lastScanResult.code}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {lastScanResult.message} • {lastScanResult.timestamp}
                  </p>
                </div>
              </div>

              {/* Action Link */}
              <button
                type="button"
                onClick={() => handleOpenOrderDetail(lastScanResult.orderId || lastScanResult.code)}
                className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 cursor-pointer"
              >
                <span className="hidden sm:inline">Xem đơn hàng</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* AMBIGUOUS CANDIDATES MODAL / RESOLVER */}
          {ambiguousCandidates && ambiguousCandidates.length > 0 && (
            <div className="p-3.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 space-y-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                <AlertTriangle size={15} />
                <span>Trùng mã kiện! Vui lòng chọn đúng đơn hàng cần xuất kho:</span>
              </div>
              <div className="space-y-2">
                {ambiguousCandidates.map((cand) => (
                  <div
                    key={cand.packageId}
                    className="p-2.5 rounded bg-white dark:bg-[#131722] border border-amber-200 dark:border-amber-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white font-mono">
                        {cand.externalOrderId}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {cand.shopName} • {cand.carrierName} ({cand.packageCode})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        executeScan(
                          cand.trackingCode || cand.packageCode || cand.externalOrderId || 'MANUAL_SELECTION',
                          'MANUAL_SELECTION',
                          cand.packageId,
                        )
                      }
                      className="px-3 py-1 rounded bg-[#2563eb] text-white text-xs font-semibold cursor-pointer"
                    >
                      Chọn xuất đơn này
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FOOTER NOTE & END SESSION (Bottom Left) */}
          <div className="p-3 rounded bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <Keyboard size={13} className="shrink-0 text-gray-400" />
              <span>Giữ ô nhập mã được chọn khi dùng máy quét USB. Nhấn Enter để xác nhận.</span>
            </div>
            <button
              type="button"
              onClick={handleClearSession}
              className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shrink-0"
            >
              Kết thúc phiên
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Scan Results & History (5 Cols on PC) */}
        <div className="lg:col-span-5 flex flex-col space-y-3.5">
          <div className="p-3.5 rounded bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 flex-1 flex flex-col min-h-0 space-y-3 shadow-none">
            {/* Header: Title + Export */}
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Kết quả quét
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportList}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <Download size={13} />
                  <span>Xuất danh sách</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsListModalOpen(true)}
                  className="md:hidden flex items-center gap-1 text-xs text-[#5865f2] font-semibold"
                >
                  <span>Xem tất cả ({stats.total})</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* Tabs: Trong phiên (4) vs Đã xác nhận */}
            <div className="flex items-center border-b border-gray-200 dark:border-gray-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveResultsTab('session')}
                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                  activeResultsTab === 'session'
                    ? 'border-[#2563eb] text-[#2563eb] font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <span>Trong phiên ({stats.total})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveResultsTab('historical')}
                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                  activeResultsTab === 'historical'
                    ? 'border-[#2563eb] text-[#2563eb] font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <span>Đã xác nhận ({historicalScans.length})</span>
              </button>
            </div>

            {/* Search filter input */}
            <div className="relative shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder={activeResultsTab === 'session' ? 'Tìm mã trong phiên...' : 'Tìm mã đã xác nhận...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-4 py-1.5 bg-gray-50 dark:bg-[#1a1e2b] border border-gray-200 dark:border-gray-700/80 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
              />
            </div>

            {/* Scan List (Scrollable) */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar min-h-[300px] max-h-[520px]">
              {displayScans.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  <Package size={32} className="mx-auto mb-2 text-gray-500 opacity-50" />
                  <p>Chưa có mã quét nào {searchTerm ? 'phù hợp' : 'trong danh sách'}</p>
                </div>
              ) : (
                displayScans.map((item: any) => {
                  const isSuccess = item.result === 'VERIFIED';
                  const isDuplicate = item.result === 'ALREADY_VERIFIED';
                  const isError = item.result === 'ERROR' || item.result === 'REVERSED';

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded bg-gray-50 dark:bg-[#1a1e2b] border border-gray-200/80 dark:border-gray-800/80 hover:border-gray-300 dark:hover:border-gray-700 transition-colors flex items-center justify-between gap-2.5 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Status Icon Indicator */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : isDuplicate
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 size={16} />
                          ) : isDuplicate ? (
                            <span className="font-bold text-xs">A</span>
                          ) : (
                            <XCircle size={16} />
                          )}
                        </div>

                        {/* Order info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="font-mono font-bold text-xs text-gray-900 dark:text-white truncate cursor-pointer hover:text-[#5865f2]"
                              onClick={() => handleCopyCode(item.trackingCode || item.code)}
                              title="Nhấn để sao chép mã"
                            >
                              {item.trackingCode || item.code}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {item.timestamp}
                            </span>
                          </div>

                          <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 truncate mt-0.5">
                            <Package size={11} className="shrink-0 text-gray-400" />
                            <span className="truncate">
                              {item.message || (isSuccess ? 'Đã xác nhận xuất kho' : 'Chưa xác định')}
                            </span>
                            {isError && (
                              <button
                                type="button"
                                onClick={() => handleOpenOrderDetail(item.orderId || item.code)}
                                className="text-blue-500 hover:underline font-semibold ml-1 shrink-0"
                              >
                                Kiểm tra →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge & 3-dots Menu */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : isDuplicate
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {isSuccess
                            ? 'Thành công'
                            : isDuplicate
                            ? 'Đã quét trước đó'
                            : 'Không tìm thấy đơn'}
                        </span>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleCopyCode(item.trackingCode || item.code)}>
                              <Copy size={13} className="text-gray-400" />
                              <span>Sao chép mã</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenOrderDetail(item.orderId || item.code)}>
                              <Eye size={13} className="text-[#5865f2]" />
                              <span>Xem chi tiết đơn</span>
                            </DropdownMenuItem>
                            {isSuccess && item.packageId && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleReverse(item.packageId, item.code)}
                                  className="text-amber-600 dark:text-amber-400"
                                >
                                  <RotateCcw size={13} />
                                  <span>Hoàn tác xuất kho</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Summary Footer Line (Matching Image 1) */}
            <div className="pt-2.5 border-t border-gray-200 dark:border-gray-800 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 shrink-0">
              <Activity size={13} className="text-[#5865f2]" />
              <span>
                {stats.verified} thành công • {stats.alreadyVerified} trùng mã • {stats.failed} không tìm thấy
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FULL LIST MODAL */}
      <ScannedOrdersListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        sessionScans={sessionScans}
        historicalScans={historicalScans}
        onClearSession={handleClearSession}
        onReverse={handleReverse}
      />

      {/* ORDER DETAIL DRAWER */}
      <OrderDetailDrawer
        order={selectedOrderForDrawer}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onRefresh={() => {
          loadHistoricalScans();
        }}
      />
    </div>
  );
};
