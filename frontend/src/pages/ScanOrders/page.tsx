import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  FileText,
  Package,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  RefreshCw,
  Zap,
  ZapOff,
  Download,
  Trash2,
  UploadCloud,
  Clock,
  Store,
  Warehouse,
  Copy,
  ExternalLink,
  SearchCheck,
  AlertCircle,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  MultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
  BinaryBitmap,
  HybridBinarizer,
  HTMLCanvasElementLuminanceSource,
} from '@zxing/library';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useScanSessionStore, SessionItem } from '../../stores/scanSessionStore';
import { playSuccessSound, playErrorSound, playWarningSound, playCancelledAlarm } from '../../utils/sound';
import { SessionsHistoryModal } from './SessionsHistoryModal';
import { OrderDetailDrawer } from '../Orders/OrderDetailDrawer';
import { ordersApi } from '../../services/ordersApi';
import { fulfillmentApi } from '../../services/fulfillmentApi';
import { toast } from '../../components/ui/Toast';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { confirmModal } from '../../components/ui/ConfirmModal';

export const ScanOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedShopId, shops, setSelectedShopId, selectedWarehouseId, warehouses, setSelectedWarehouseId } =
    useWorkspaceStore();

  // Scan Session Store
  const {
    activeSessionId,
    loadSessionsFromStorage,
    getActiveSession,
    setActiveSession,
    addBarcodeToActiveSession,
    verifySingleBarcodeInActiveSession,
    removeItemFromActiveSession,
    submitSession,
    isVerifyingBatch,
  } = useScanSessionStore();

  // Load sessions from localStorage on mount
  useEffect(() => {
    loadSessionsFromStorage();
  }, []);

  const activeSession = getActiveSession();

  // Auto select default warehouse if not selected
  useEffect(() => {
    if (!selectedWarehouseId && warehouses.length > 0) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId, setSelectedWarehouseId]);

  // Focus mode / Fullscreen
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // TOGGLE ĐỐI SOÁT TRỰC TIẾP: Mặc định là TẮT (FALSE) theo yêu cầu
  const [isLiveVerify, setIsLiveVerify] = useState<boolean>(() => {
    return localStorage.getItem('shopee_scan_live_verify') === 'true';
  });

  const handleToggleLiveVerify = (enabled: boolean) => {
    setIsLiveVerify(enabled);
    localStorage.setItem('shopee_scan_live_verify', enabled ? 'true' : 'false');
    if (enabled) {
      toast.success(
        'Đã BẬT đối soát trực tiếp: Hệ thống sẽ kiểm tra ngay đơn hủy & mã vận đơn không tồn tại sau mỗi lần quét.',
      );
    } else {
      toast.info('Đã TẮT đối soát trực tiếp: Chế độ gom mã vào phiên, đối soát sau khi bấm gửi.');
    }
  };

  // Camera state & Zoom (DEFAULT 1X)
  const [, setIsCameraActive] = useState<boolean>(false);
  const [isCameraPaused, setIsCameraPaused] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [scanFlash, setScanFlash] = useState<'success' | 'warning' | 'error' | null>(null);

  // Modals & Drawers
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'REVERSE' | 'DELETE';
    item: SessionItem;
  } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Recent scan feedback banner
  const [lastScannedFeedback, setLastScannedFeedback] = useState<{
    code: string;
    isDuplicate: boolean;
    timestamp: string;
    status?: 'PENDING' | 'VERIFIED' | 'ALREADY_VERIFIED' | 'NOT_FOUND' | 'CANCELLED' | 'RETURNED' | 'ERROR';
    wasDispatched?: boolean;
    autoRestocked?: boolean;
    message?: string;
    shopName?: string;
    carrierName?: string;
  } | null>(null);

  // Refs
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isCameraRunningRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const isLiveVerifyRef = useRef<boolean>(isLiveVerify);
  const selectedWarehouseIdRef = useRef<string>(selectedWarehouseId);
  const lastScanTimeRef = useRef<number>(0);
  const lastDuplicateScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Direct high-resolution barcode scanner engine (Full sensor 1080p density)
  const scanLoopRef = useRef<number | null>(null);
  const isScanningFrameRef = useRef<boolean>(false);
  const nativeDetectorRef = useRef<any>(null);
  const zxingReaderRef = useRef<MultiFormatReader | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleIncomingBarcodeRef = useRef<((text: string) => void) | null>(null);
  const [manualInputCode, setManualInputCode] = useState<string>('');

  useEffect(() => {
    isLiveVerifyRef.current = isLiveVerify;
  }, [isLiveVerify]);

  useEffect(() => {
    selectedWarehouseIdRef.current = selectedWarehouseId;
  }, [selectedWarehouseId]);

  // List cameras
  useEffect(() => {
    let isMounted = true;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
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

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize camera directly on mount or when camera/facingMode changes
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) {
        startCamera();
      }
    }, 80);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopCamera();
    };
  }, [selectedCameraId, facingMode]);

  // Apply Zoom (Default 1x, no digital crop)
  const applyZoom = async (newZoom: number) => {
    setZoom(newZoom);
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

    const videoEl = document.querySelector('#barcode-camera-reader video') as HTMLVideoElement;
    if (videoEl) {
      if (newZoom <= 1) {
        videoEl.style.transform = 'none';
      } else {
        videoEl.style.transform = `scale(${newZoom})`;
        videoEl.style.transformOrigin = 'center center';
        videoEl.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
      }
    }
  };

  const handleToggleZoom = () => {
    const zoomLevels = [1, 1.5, 2];
    const currentIndex = zoomLevels.indexOf(zoom);
    const nextZoom = zoomLevels[(currentIndex + 1) % zoomLevels.length];
    applyZoom(nextZoom);
  };

  // Helper to calculate precise central horizontal crop coordinates based on video stream geometry
  const getScanCropCoordinates = (videoEl: HTMLVideoElement) => {
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    if (!vw || !vh) return { cropX: 0, cropY: 0, cropW: vw, cropH: vh };

    // Landscape stream
    if (vw >= vh) {
      const cropW = Math.round(vw * 0.94);
      const cropH = Math.round(vh * 0.55);
      const cropX = Math.round((vw - cropW) / 2);
      const cropY = Math.round((vh - cropH) / 2);
      return { cropX, cropY, cropW, cropH };
    }

    // Portrait stream (e.g. mobile 1080x1920)
    // Mobile viewport with object-fit: cover inside standard container (~1.5 aspect ratio)
    const containerAspect = 390 / 260;
    const videoAspect = vw / vh;

    let visibleVideoH = vh;
    let visibleVideoW = vw;

    if (videoAspect < containerAspect) {
      visibleVideoH = vw / containerAspect;
    } else {
      visibleVideoW = vh * containerAspect;
    }

    const visibleCenterY = vh / 2;
    const visibleCenterX = vw / 2;

    const cropW = Math.round(Math.min(vw, visibleVideoW * 0.94));
    const cropH = Math.round(Math.min(vh, visibleVideoH * 0.65));
    const cropX = Math.max(0, Math.round(visibleCenterX - cropW / 2));
    const cropY = Math.max(0, Math.round(visibleCenterY - cropH / 2));

    return { cropX, cropY, cropW, cropH };
  };

  // Safe Native BarcodeDetector initialization (filters out unsupported formats on iOS / Chrome)
  const initNativeBarcodeDetector = async () => {
    if (typeof (window as any).BarcodeDetector === 'undefined') {
      return null;
    }
    try {
      let desiredFormats = ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'itf'];
      if (typeof (window as any).BarcodeDetector.getSupportedFormats === 'function') {
        const supported = await (window as any).BarcodeDetector.getSupportedFormats();
        if (Array.isArray(supported) && supported.length > 0) {
          desiredFormats = desiredFormats.filter((fmt) => supported.includes(fmt));
        }
      }
      if (desiredFormats.length === 0) return null;
      return new (window as any).BarcodeDetector({ formats: desiredFormats });
    } catch (e) {
      console.warn('Native BarcodeDetector not available:', e);
      return null;
    }
  };

  const getZXingReader = () => {
    if (!zxingReaderRef.current) {
      const hints = new Map<DecodeHintType, any>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.ITF,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new MultiFormatReader();
      reader.setHints(hints);
      zxingReaderRef.current = reader;
    }
    return zxingReaderRef.current;
  };

  const startEnhancedScanningLoop = async () => {
    stopEnhancedScanningLoop();

    nativeDetectorRef.current = await initNativeBarcodeDetector();
    const zxing = getZXingReader();

    const runScanCycle = async () => {
      if (!isCameraRunningRef.current) return;

      if (!isPausedRef.current && !isScanningFrameRef.current) {
        const videoEl = document.querySelector('#barcode-camera-reader video') as HTMLVideoElement;
        if (
          videoEl &&
          videoEl.readyState >= 2 &&
          !videoEl.paused &&
          !videoEl.ended &&
          videoEl.videoWidth > 0 &&
          videoEl.videoHeight > 0
        ) {
          isScanningFrameRef.current = true;
          try {
            let detectedText: string | null = null;

            // Tier 1: Hardware-accelerated native BarcodeDetector directly on full-res <video>
            if (nativeDetectorRef.current) {
              try {
                const barcodes = await nativeDetectorRef.current.detect(videoEl);
                if (barcodes && barcodes.length > 0) {
                  const match = barcodes.find((b: any) => Boolean(b.rawValue));
                  if (match && match.rawValue) {
                    detectedText = match.rawValue;
                  }
                }
              } catch {
                // Continue to ZXing on transient frame error
              }
            }

            // Tier 2: High-Resolution Sensor Crop with ZXing (Full 1080p pixel density with TRY_HARDER)
            if (!detectedText && zxing) {
              const { cropX, cropY, cropW, cropH } = getScanCropCoordinates(videoEl);
              if (cropW > 0 && cropH > 0) {
                if (!offscreenCanvasRef.current) {
                  offscreenCanvasRef.current = document.createElement('canvas');
                }
                const canvas = offscreenCanvasRef.current;

                if (canvas.width !== cropW || canvas.height !== cropH) {
                  canvas.width = cropW;
                  canvas.height = cropH;
                }

                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                  ctx.drawImage(videoEl, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
                  try {
                    const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas);
                    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
                    const result = zxing.decode(binaryBitmap);
                    if (result && result.getText()) {
                      detectedText = result.getText();
                    }
                  } catch {
                    // Normal when frame does not contain a recognizable barcode
                  }
                }
              }
            }

            if (detectedText && !isPausedRef.current) {
              if (handleIncomingBarcodeRef.current) {
                handleIncomingBarcodeRef.current(detectedText);
              }
            }
          } catch {
            // Transient frame error
          } finally {
            isScanningFrameRef.current = false;
          }
        }
      }

      if (isCameraRunningRef.current) {
        scanLoopRef.current = window.setTimeout(runScanCycle, 50);
      }
    };

    scanLoopRef.current = window.setTimeout(runScanCycle, 100);
  };

  const stopEnhancedScanningLoop = () => {
    if (scanLoopRef.current) {
      clearTimeout(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    isScanningFrameRef.current = false;
  };

  const startCamera = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    try {
      setCameraError('');
      if (scannerRef.current) {
        await stopCamera();
      }

      // Small delay to allow browser hardware to release previous session
      await new Promise((r) => setTimeout(r, 60));

      const container = document.getElementById('barcode-camera-reader');
      if (!container) {
        isStartingRef.current = false;
        return;
      }

      // Configure Html5Qrcode with robust format set
      const html5QrCode = new Html5Qrcode('barcode-camera-reader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: false, // We run full-resolution native BarcodeDetector directly on <video>
        },
      });
      scannerRef.current = html5QrCode;

      // Full-HD video constraints for crystal-sharp scanning of dense 24+ character Code 128 barcodes
      const config = {
        fps: 25,
        videoConstraints: {
          deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
          facingMode: selectedCameraId ? undefined : (facingMode || 'environment'),
          width: { min: 640, ideal: 1920, max: 3840 },
          height: { min: 480, ideal: 1080, max: 2160 },
        },
      };

      const cameraParam: any = selectedCameraId
        ? { deviceId: { exact: selectedCameraId } }
        : { facingMode: facingMode || 'environment' };

      try {
        await html5QrCode.start(
          cameraParam,
          config,
          (decodedText) => {
            if (!isPausedRef.current && handleIncomingBarcodeRef.current) {
              handleIncomingBarcodeRef.current(decodedText);
            }
          },
          () => {},
        );
      } catch (firstErr: any) {
        console.warn('Initial camera start attempt failed, attempting fallback:', firstErr);
        // Fallback 1: Direct device ID string or facingMode with standard HD
        const fallbackConfig: any = {
          fps: 20,
          videoConstraints: {
            deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
            facingMode: selectedCameraId ? undefined : 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };
        try {
          await html5QrCode.start(
            selectedCameraId || { facingMode: 'environment' },
            fallbackConfig,
            (decodedText) => {
              if (!isPausedRef.current && handleIncomingBarcodeRef.current) {
                handleIncomingBarcodeRef.current(decodedText);
              }
            },
            () => {},
          );
        } catch (secondErr: any) {
          // Fallback 2: Any default camera device
          console.warn('Fallback 1 failed, trying fallback 2 (user camera):', secondErr);
          await html5QrCode.start(
            { facingMode: 'user' },
            { fps: 20 },
            (decodedText) => {
              if (!isPausedRef.current && handleIncomingBarcodeRef.current) {
                handleIncomingBarcodeRef.current(decodedText);
              }
            },
            () => {},
          );
        }
      }

      setIsCameraActive(true);
      setIsCameraPaused(false);
      isPausedRef.current = false;
      isCameraRunningRef.current = true;

      // Start high-resolution parallel scan loop (native BarcodeDetector + Full-res ZXing)
      startEnhancedScanningLoop();

      // Apply initial 1x zoom (full field of view, no cropping)
      setTimeout(() => {
        applyZoom(1);
      }, 150);

      // Request continuous autofocus if supported by camera hardware
      try {
        const videoEl = document.querySelector('#barcode-camera-reader video') as HTMLVideoElement;
        if (videoEl && videoEl.srcObject instanceof MediaStream) {
          const track = videoEl.srcObject.getVideoTracks()[0];
          const capabilities: any = track?.getCapabilities ? track.getCapabilities() : {};
          const advanced: any[] = [];
          if (capabilities.focusMode?.includes('continuous')) {
            advanced.push({ focusMode: 'continuous' });
          }
          if (capabilities.exposureMode?.includes('continuous')) {
            advanced.push({ exposureMode: 'continuous' });
          }
          if (advanced.length > 0) {
            await track.applyConstraints({ advanced });
          }
        }
      } catch {
        // ignore
      }
    } catch (err: any) {
      console.warn('Cannot start camera:', err);
      let errMsg = 'Không thể mở camera. Vui lòng cấp quyền camera trong cài đặt trình duyệt.';
      const errStr = `${err?.name || ''} ${err?.message || ''}`;

      if (
        errStr.includes('NotReadableError') ||
        errStr.includes('TrackStartError') ||
        errStr.includes('Device in use')
      ) {
        errMsg =
          'Camera đang bị ứng dụng khác hoặc tab trình duyệt khác chiếm dụng. Vui lòng đóng các ứng dụng đang dùng camera rồi bấm "Thử lại camera".';
      } else if (errStr.includes('OverconstrainedError')) {
        errMsg =
          'Độ phân giải camera không tương thích. Vui lòng bấm "Đổi camera" hoặc bấm "Thử lại camera".';
      } else if (errStr.includes('NotFoundError') || errStr.includes('DevicesNotFoundError')) {
        errMsg = 'Không tìm thấy thiết bị camera nào được kết nối với máy tính.';
      } else if (errStr.includes('NotAllowedError') || errStr.includes('PermissionDeniedError')) {
        errMsg =
          'Trình duyệt chưa được cấp quyền mở Camera. Vui lòng kiểm tra biểu tượng ổ khóa/camera trên thanh địa chỉ trình duyệt để BẬT quyền.';
      } else if (err?.message) {
        errMsg = `Không thể khởi động camera (${err?.name || 'Lỗi'}): ${err.message}`;
      }

      setCameraError(errMsg);
      setIsCameraActive(false);
      isCameraRunningRef.current = false;
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopCamera = async () => {
    stopEnhancedScanningLoop();
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        try {
          const state = (scanner as any).getState?.();
          // Html5QrcodeScannerState: SCANNING is 2, PAUSED is 3
          if (state === 2 || state === 3 || isCameraRunningRef.current) {
            await scanner.stop();
          }
        } catch {
          // ignore
        }
        try {
          scanner.clear();
        } catch {
          // ignore
        }
      }
    } finally {
      setIsCameraActive(false);
      isCameraRunningRef.current = false;
      isStoppingRef.current = false;
    }
  };

  const togglePauseCamera = async () => {
    const nextPaused = !isCameraPaused;
    setIsCameraPaused(nextPaused);
    isPausedRef.current = nextPaused;

    if (scannerRef.current && isCameraRunningRef.current) {
      try {
        if (nextPaused) {
          const state = (scannerRef.current as any).getState?.();
          // Html5QrcodeScannerState: SCANNING is 2
          if (state === 2 || state === undefined) {
            scannerRef.current.pause(true);
          }
        } else {
          const state = (scannerRef.current as any).getState?.();
          // Html5QrcodeScannerState: PAUSED is 3
          if (state === 3 || state === undefined) {
            scannerRef.current.resume();
          }
        }
      } catch (err) {
        console.warn('Toggle pause camera hardware stream:', err);
      }
    }

    if (nextPaused) {
      toast.info('Đã tạm dừng nhận mã quét');
    } else {
      toast.success('Đã tiếp tục quét mã');
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: !torchOn } as any],
      });
      setTorchOn(!torchOn);
    } catch {
      toast.warning('Thiết bị hoặc camera không hỗ trợ đèn flash');
    }
  };

  const handleSwitchCamera = () => {
    if (cameras.length > 1) {
      const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      setSelectedCameraId(cameras[nextIndex].id);
      toast.info(`Chuyển sang: ${cameras[nextIndex].label || `Camera #${nextIndex + 1}`}`);
    } else {
      setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
      setSelectedCameraId('');
    }
  };

  // CORE SCANNING HANDLER: Supports both Offline Batch Scanning and Live Verification
  const handleIncomingBarcode = async (rawText: string) => {
    if (isPausedRef.current) {
      return;
    }
    let raw = (rawText || '').trim();
    if (!raw) return;

    // 1. Loại bỏ các tiền tố ký hiệu chuẩn của máy quét 1D/2D (AIM symbology prefix: ]C1, ]e0, v.v.)
    raw = raw.replace(/^\][A-Za-z0-9]{2}/, '');

    // 2. Tự động bóc tách mã vận đơn nếu quét trúng mã QR link Shopee / SPX
    if (raw.includes('spx.vn') || raw.includes('shopee.') || raw.includes('http')) {
      try {
        const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
        const trackingParam =
          url.searchParams.get('tracking_number') ||
          url.searchParams.get('tracking') ||
          url.searchParams.get('order_id') ||
          url.searchParams.get('order_sn') ||
          url.searchParams.get('c');
        if (trackingParam) {
          raw = trackingParam;
        } else {
          const segments = url.pathname.split('/').filter(Boolean);
          if (segments.length > 0 && segments[segments.length - 1].length >= 8) {
            raw = segments[segments.length - 1];
          }
        }
      } catch {
        // Continue with raw
      }
    }

    raw = raw.replace(/[\r\n\t]/g, '').trim();
    if (!raw) return;

    // Debounce rapid double trigger (within 600ms)
    const now = Date.now();
    if (now - lastScanTimeRef.current < 600) {
      return;
    }
    lastScanTimeRef.current = now;

    const cleanCode = raw.toUpperCase();
    const timestamp = new Date().toLocaleTimeString('vi-VN');

    // 1. CHẾ ĐỘ MẶC ĐỊNH (TẮT ĐỐI SOÁT TRỰC TIẾP): Gom mã vào phiên
    if (!isLiveVerifyRef.current) {
      const res = addBarcodeToActiveSession(cleanCode);

      if (res.isDuplicate) {
        // Prevent repeated duplicate alerts for the same barcode within 3 seconds
        const isSameDuplicateRecent =
          lastDuplicateScanRef.current.code === cleanCode &&
          now - lastDuplicateScanRef.current.time < 3000;

        if (!isSameDuplicateRecent) {
          lastDuplicateScanRef.current = { code: cleanCode, time: now };
          if (soundEnabled) playWarningSound();
          setScanFlash('warning');
          setTimeout(() => setScanFlash(null), 700);
        }

        setLastScannedFeedback({
          code: cleanCode,
          isDuplicate: true,
          timestamp,
          status: 'PENDING',
        });
      } else {
        lastDuplicateScanRef.current = { code: '', time: 0 };
        if (soundEnabled) playSuccessSound();
        setScanFlash('success');
        setTimeout(() => setScanFlash(null), 700);
        setLastScannedFeedback({
          code: cleanCode,
          isDuplicate: false,
          timestamp,
          status: 'PENDING',
        });
      }
      return;
    }

    // 2. CHẾ ĐỘ ĐỐI SOÁT TRỰC TIẾP: Kiểm tra ngay đơn hủy & mã vận đơn không tồn tại
    const isRapidDuplicate =
      lastDuplicateScanRef.current.code === cleanCode &&
      now - lastDuplicateScanRef.current.time < 1200;

    if (isRapidDuplicate) {
      return;
    }
    lastDuplicateScanRef.current = { code: cleanCode, time: now };

    // Tiến hành đối soát trực tiếp với backend
    setLastScannedFeedback({
      code: cleanCode,
      isDuplicate: false,
      timestamp,
      status: 'PENDING',
      message: 'Đang đối soát trực tiếp...',
    });

    try {
      const whId = selectedWarehouseIdRef.current || warehouses[0]?.id;
      const res = await verifySingleBarcodeInActiveSession(cleanCode, whId);
      const item = res.item;

      if (item.isCancelled) {
        // CẢNH BÁO ĐẶC BIỆT: ĐƠN HÀNG ĐÃ BỊ HỦY (KỂ CẢ ĐƠN ĐÃ XUẤT TRƯỚC)
        if (soundEnabled) playCancelledAlarm();
        setScanFlash('error');
        setTimeout(() => setScanFlash(null), 1200);

        setLastScannedFeedback({
          code: cleanCode,
          isDuplicate: false,
          timestamp,
          status: 'CANCELLED',
          wasDispatched: item.wasDispatched,
          autoRestocked: item.autoRestocked,
          message: item.autoRestocked
            ? (item.message || 'Đơn hàng ĐÃ BỊ HỦY trên sàn Shopee! Hệ thống đã tự động hủy xác nhận đi đơn và hoàn tồn kho cho sản phẩm.')
            : item.wasDispatched
            ? (item.message || 'Đơn hàng ĐÃ XUẤT TRƯỚC NHƯNG ĐÃ BỊ HỦY trên sàn Shopee! Tuyệt đối giữ lại kiện hàng!')
            : (item.message || 'Đơn hàng đã bị hủy trên sàn Shopee, không thể xuất kho!'),
          shopName: item.shopName,
          carrierName: item.carrierName,
        });
      } else if (item.isReturned) {
        // CẢNH BÁO ĐẶC BIỆT: ĐƠN HÀNG CÓ YÊU CẦU TRẢ HÀNG / HOÀN TIỀN
        if (soundEnabled) playCancelledAlarm();
        setScanFlash('error');
        setTimeout(() => setScanFlash(null), 1200);

        setLastScannedFeedback({
          code: cleanCode,
          isDuplicate: false,
          timestamp,
          status: 'RETURNED',
          wasDispatched: item.wasDispatched,
          autoRestocked: false,
          message: item.message || 'Đơn hàng có yêu cầu TRẢ HÀNG / HOÀN TIỀN trên sàn Shopee! Tuyệt đối giữ lại kiện hàng!',
          shopName: item.shopName,
          carrierName: item.carrierName,
        });
      } else if (item.status === 'NOT_FOUND') {
        // CẢNH BÁO: KHÔNG CÓ THÔNG TIN MÃ VẬN ĐƠN
        if (soundEnabled) playErrorSound();
        setScanFlash('error');
        setTimeout(() => setScanFlash(null), 1000);

        setLastScannedFeedback({
          code: cleanCode,
          isDuplicate: false,
          timestamp,
          status: 'NOT_FOUND',
          message: 'Không tìm thấy thông tin mã vận đơn trong hệ thống!',
        });
      } else if (item.status === 'ALREADY_VERIFIED') {
        // ĐƠN ĐÃ XUẤT TRƯỚC
        if (soundEnabled) playWarningSound();
        setScanFlash('warning');
        setTimeout(() => setScanFlash(null), 800);

        setLastScannedFeedback({
          code: cleanCode,
          isDuplicate: true,
          timestamp,
          status: 'ALREADY_VERIFIED',
          message: item.message || 'Kiện hàng này đã được xác nhận xuất kho trước đó',
          shopName: item.shopName,
          carrierName: item.carrierName,
        });
      } else if (item.status === 'VERIFIED') {
        // ĐƠN HỢP LỆ VÀ XUẤT KHO THÀNH CÔNG
        if (soundEnabled) playSuccessSound();
        setScanFlash('success');
        setTimeout(() => setScanFlash(null), 800);

        setLastScannedFeedback({
          code: cleanCode,
          isDuplicate: false,
          timestamp,
          status: 'VERIFIED',
          message: item.message || 'Xác nhận xuất kho thành công',
          shopName: item.shopName,
          carrierName: item.carrierName,
        });
      } else {
        // LỖI KHÁC
        if (soundEnabled) playErrorSound();
        setScanFlash('error');
        setTimeout(() => setScanFlash(null), 900);

        setLastScannedFeedback({
          code: cleanCode,
          isDuplicate: false,
          timestamp,
          status: 'ERROR',
          message: item.message || 'Lỗi đối soát đơn hàng',
        });
      }
    } catch (err: any) {
      if (soundEnabled) playErrorSound();
      setScanFlash('error');
      setTimeout(() => setScanFlash(null), 900);

      setLastScannedFeedback({
        code: cleanCode,
        isDuplicate: false,
        timestamp,
        status: 'ERROR',
        message: err.message || 'Lỗi kết nối khi đối soát',
      });
    }
  };

  useEffect(() => {
    handleIncomingBarcodeRef.current = handleIncomingBarcode;
  }, [handleIncomingBarcode]);

  // Background hardware USB / Bluetooth barcode scanner listener
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not capture if user is focusing a modal input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (isPausedRef.current) {
        buffer = '';
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 120) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          handleIncomingBarcode(buffer);
          buffer = '';
          e.preventDefault();
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [soundEnabled, activeSessionId]);

  // Primary action: Confirm & Verify Batch against Orders
  const handleSubmitBatch = async () => {
    if (!activeSession || activeSession.items.length === 0) {
      toast.warning('Phiên quét chưa có mã nào để gửi đối soát');
      return;
    }

    const pendingCount = activeSession.items.filter((i) => i.status === 'PENDING').length;
    if (pendingCount === 0 && activeSession.status === 'SUBMITTED') {
      const ok = await confirmModal({
        title: 'Đối soát lại phiên quét',
        message: 'Phiên quét này đã được gửi đối soát trước đó. Bạn có muốn gửi đối soát lại không?',
        description: 'Hệ thống sẽ kiểm tra lại toàn bộ trạng thái các đơn hàng trong phiên theo dữ liệu kho hiện tại.',
        confirmText: 'Gửi đối soát lại',
        variant: 'warning',
      });
      if (!ok) return;
    }

    try {
      toast.info(`Đang gửi ${activeSession.items.length} mã lên hệ thống để đối soát đơn hàng...`);
      const whId = selectedWarehouseId || warehouses[0]?.id;
      const res = await submitSession(activeSession.id, whId);

      if (res.success) {
        if (soundEnabled) {
          if (res.summary?.cancelled > 0) {
            playCancelledAlarm();
          } else {
            playSuccessSound();
          }
        }

        toast.success(
          `Đối soát hoàn tất: ${res.summary.verified} đơn thành công, ${res.summary.alreadyVerified} đã xuất trước, ${res.summary.notFound} không tìm thấy`,
        );

        if (res.summary?.cancelled > 0) {
          toast.error(
            `Phát hiện ${res.summary.cancelled} đơn hàng ĐÃ BỊ HỦY trên sàn Shopee! ${
              res.summary.cancelledRestocked > 0
                ? `Hệ thống đã tự động hủy xác nhận đi đơn và hoàn tồn kho cho ${res.summary.cancelledRestocked} đơn hàng.`
                : 'Tuyệt đối giữ lại kiện hàng không bàn giao cho shipper!'
            }`,
            { duration: 9000 },
          );
        }
      }
    } catch (err: any) {
      if (soundEnabled) playErrorSound();
      toast.error('Lỗi khi gửi đối soát', err.message || 'Vui lòng thử lại');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Đã sao chép: ${code}`);
  };

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

  // Action executor for confirmation modal (Reversal & Deletion)
  const handleExecuteConfirmAction = async () => {
    if (!confirmAction) return;

    if (confirmAction.type === 'DELETE') {
      removeItemFromActiveSession(confirmAction.item.id);
      toast.success(`Đã xóa mã "${confirmAction.item.code}" khỏi phiên`);
      setConfirmAction(null);
      return;
    }

    if (confirmAction.type === 'REVERSE') {
      const { item } = confirmAction;
      if (!item.packageId) {
        toast.warning('Không tìm thấy thông tin kiện hàng để hoàn tác');
        setConfirmAction(null);
        return;
      }

      setIsActionLoading(true);
      try {
        toast.info(`Đang hoàn tác xuất kho mã "${item.code}"...`);
        await fulfillmentApi.reverseDispatch(item.packageId, 'Hủy đơn tại kho / Đổi kiện cho đơn khác');
        toast.success(`Đã hoàn tác mã "${item.code}", tồn kho đã được cộng lại!`);
        removeItemFromActiveSession(item.id);
        if (soundEnabled) playWarningSound();
        setConfirmAction(null);
      } catch (err: any) {
        toast.error('Lỗi hoàn tác', err.message || 'Không thể hoàn tác xuất kho');
      } finally {
        setIsActionLoading(false);
      }
    }
  };

  // Export current session CSV
  const handleExportCurrentSession = () => {
    if (!activeSession || activeSession.items.length === 0) {
      toast.warning('Chưa có mã quét nào trong phiên');
      return;
    }

    const headers = ['Mã vận đơn / Đơn hàng', 'Mã kiện', 'Gian hàng', 'Đơn vị VC', 'Trạng thái', 'Thời gian'];
    const rows = activeSession.items.map((s) => [
      s.code,
      s.packageCode || '',
      s.shopName || '',
      s.carrierName || '',
      s.isCancelled
        ? s.wasDispatched
          ? 'Đã xuất trước (ĐÃ HỦY)'
          : 'Đơn đã hủy'
        : s.isReturned
        ? 'Đơn hoàn hàng'
        : s.status === 'VERIFIED'
        ? 'Thành công'
        : s.status === 'ALREADY_VERIFIED'
        ? 'Đã xuất trước'
        : s.status === 'NOT_FOUND'
        ? 'Không tìm thấy'
        : s.status === 'PENDING'
        ? 'Chờ đối soát'
        : 'Lỗi',
      s.scannedAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${c || ''}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `phien_quet_${activeSession.sessionCode}_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã tải danh sách mã quét');
  };

  const pendingItemsCount = (activeSession?.items || []).filter((i) => i.status === 'PENDING').length;
  const verifiedItemsCount = (activeSession?.items || []).filter((i) => i.status === 'VERIFIED').length;
  const cancelledItemsCount = (activeSession?.items || []).filter((i) => i.isCancelled).length;
  const returnedItemsCount = (activeSession?.items || []).filter((i) => i.isReturned).length;
  const notFoundItemsCount = (activeSession?.items || []).filter((i) => i.status === 'NOT_FOUND').length;
  const displayedItems = activeSession?.items || [];

  // Clean session title: "Phiên quét #1 (01:41 17-10)" -> "Phiên Quét 1"
  const formatSessionTitle = (rawName?: string) => {
    if (!rawName) return 'Phiên Quét 1';
    const match = rawName.match(/phiên\s+quét\s+#?(\d+)/i);
    if (match) {
      return `Phiên Quét ${match[1]}`;
    }
    return rawName.replace(/\s*\(\d{2}:\d{2}\s+\d{2}[-/]\d{2}\)/i, '').trim();
  };

  const formattedStartTime = activeSession
    ? new Date(activeSession.createdAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }) +
      ', ' +
      new Date(activeSession.createdAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
      })
    : '--:--, --/--';

  return (
    <div
      className={`w-full ${
        isFocusMode
          ? 'fixed inset-0 z-50 bg-[#0c0e14] p-3 sm:p-5 overflow-y-auto max-w-none'
          : 'max-w-xl lg:max-w-none mx-auto pb-16'
      } flex flex-col space-y-3 lg:space-y-4 animate-in fade-in duration-300`}
    >
      {/* 1. TOP HEADER NAVIGATION */}
      <div className="flex items-center justify-between gap-3 shrink-0 pt-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0 shadow-xs"
            title="Quay lại"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
              Quét xuất hàng
            </h1>
            <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Trạm quét & Đối soát xuất kho
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFocusMode(!isFocusMode)}
            className="h-8 px-2.5 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shrink-0 shadow-xs text-xs font-semibold"
            title={isFocusMode ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFocusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            <span className="hidden sm:inline">{isFocusMode ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>
        </div>
      </div>

      {/* 2-COLUMN RESPONSIVE LAYOUT CONTAINER (Mobile: stacked, Desktop PC: 2 columns full width) */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-4 xl:gap-5 lg:items-start space-y-3 lg:space-y-0">
        {/* LEFT COLUMN: SCANNING STATION & HARDWARE CONTROLS (lg:col-span-5 xl:col-span-5 space-y-3) */}
        <div className="flex flex-col space-y-3 lg:col-span-5 xl:col-span-5">
          {/* 2. SHOP & KHO DROPDOWN SELECTORS */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Shop Selector Card */}
            <div className="relative p-2.5 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded bg-blue-500/10 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Store size={15} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block leading-tight">Shop</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white block leading-tight truncate">
                    {selectedShopId === 'ALL'
                      ? 'Tất cả shop'
                      : shops.find((s) => s.id === selectedShopId)?.name || 'Tất cả shop'}
                  </span>
                </div>
              </div>
              <ChevronDown size={13} className="text-gray-400 shrink-0 pointer-events-none" />
              <select
                value={selectedShopId}
                onChange={(e) => setSelectedShopId(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Chọn Shop"
              >
                <option value="ALL">Tất cả shop</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Warehouse Selector Card */}
            <div className="relative p-2.5 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Warehouse size={15} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block leading-tight">Kho</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white block leading-tight truncate">
                    {warehouses.find((w) => w.id === selectedWarehouseId)?.name || 'Kho tổng'}
                  </span>
                </div>
              </div>
              <ChevronDown size={13} className="text-gray-400 shrink-0 pointer-events-none" />
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Chọn Kho"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. ACTIVE SESSION STATUS & 3 METRIC PILLS */}
          <div className="p-3 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 shadow-xs space-y-2.5">
            {/* Session Info Line */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded bg-[#2563eb]/10 dark:bg-[#2563eb]/20 text-[#2563eb] dark:text-[#3b82f6] flex items-center justify-center shrink-0 border border-[#2563eb]/20">
                  <FileText size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                      {formatSessionTitle(activeSession?.name)}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Sẵn sàng
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5 truncate">
                    {activeSession?.sessionCode} • Bắt đầu {formattedStartTime}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(true)}
                className="text-xs text-[#2563eb] dark:text-[#3b82f6] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer shrink-0"
              >
                <span>Đổi phiên</span>
                <ChevronRight size={13} />
              </button>
            </div>

            {/* 3 Metric Pills */}
            <div className="grid grid-cols-3 gap-2">
              {/* Đã quét */}
              <div className="p-2 rounded bg-gray-50 dark:bg-[#1c2230] border border-gray-100 dark:border-gray-800/80 flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-blue-500/10 dark:bg-blue-500/15 text-blue-500 dark:text-blue-400 grid place-items-center shrink-0">
                  <ScanLine size={14} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate leading-tight">
                    Đã quét
                  </span>
                  <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-white font-mono leading-none">
                    {activeSession?.items.length || 0}
                  </span>
                </div>
              </div>

              {/* Chờ đối soát */}
              <div className="p-2 rounded bg-gray-50 dark:bg-[#1c2230] border border-gray-100 dark:border-gray-800/80 flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-amber-500/10 dark:bg-amber-500/15 text-amber-500 dark:text-amber-400 grid place-items-center shrink-0">
                  <Clock size={14} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate leading-tight">
                    Chờ đối soát
                  </span>
                  <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400 font-mono leading-none">
                    {pendingItemsCount}
                  </span>
                </div>
              </div>

              {/* Thành công */}
              <div className="p-2 rounded bg-gray-50 dark:bg-[#1c2230] border border-gray-100 dark:border-gray-800/80 flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 grid place-items-center shrink-0">
                  <CheckCircle2 size={14} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate leading-tight">
                    Thành công
                  </span>
                  <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono leading-none">
                    {verifiedItemsCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Cảnh báo đơn bị hủy trong phiên */}
            {cancelledItemsCount > 0 && (
              <div className="p-2 sm:p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-500/40 flex items-center justify-between gap-2 text-rose-700 dark:text-rose-300">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle size={16} className="text-rose-500 shrink-0 animate-bounce" />
                  <span className="text-xs font-bold truncate">
                    Cảnh báo: Có {cancelledItemsCount} đơn bị hủy trong phiên quét này!
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[10px] font-bold shrink-0">
                  GIỮ LẠI ĐƠN
                </span>
              </div>
            )}
          </div>

          {/* 3.5 TOGGLE ĐỐI SOÁT TRỰC TIẾP: KIỂM TRA ĐƠN HỦY & MÃ VẬN ĐƠN NGAY KHI QUÉT */}
          <div className="p-3 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between gap-3 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isLiveVerify
                    ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shadow-xs shadow-indigo-500/10'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200/60 dark:border-gray-700/60'
                }`}
              >
                <SearchCheck size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white leading-tight">
                    Đối soát trực tiếp khi quét
                  </span>
                  {isLiveVerify ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      ĐANG BẬT
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                      Mặc định: TẮT
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight truncate">
                  {isLiveVerify
                    ? 'Kiểm tra ngay đơn hủy & mã vận đơn không tồn tại sau mỗi lần quét'
                    : 'Chỉ gom mã vào phiên, chưa đối soát ngay (bấm [Gửi đối soát] để kiểm tra hàng loạt)'}
                </p>
              </div>
            </div>

            {/* Switch Toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={isLiveVerify}
              onClick={() => handleToggleLiveVerify(!isLiveVerify)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-[#161a23] ${
                isLiveVerify ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'
              }`}
              title={isLiveVerify ? 'Bấm để tắt đối soát trực tiếp' : 'Bấm để bật đối soát trực tiếp'}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isLiveVerify ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 4. CAMERA VIEWFINDER & LIVE SCANNER */}
          <div
            className={`rounded bg-black border overflow-hidden relative shadow-md transition-all duration-300 ${
              scanFlash === 'success'
                ? 'border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.35)] ring-2 ring-emerald-500/60'
                : scanFlash === 'warning'
                ? 'border-amber-500 shadow-[0_0_24px_rgba(245,158,11,0.35)] ring-2 ring-amber-500/60'
                : scanFlash === 'error'
                ? 'border-rose-500 shadow-[0_0_24px_rgba(244,63,94,0.35)] ring-2 ring-rose-500/60'
                : 'border-gray-800'
            }`}
          >
            <style>{`
              #barcode-camera-reader #qr-shaded-region,
              #barcode-camera-reader svg,
              #barcode-camera-reader path {
                display: none !important;
              }
              #barcode-camera-reader {
                border: none !important;
                width: 100% !important;
                height: 100% !important;
              }
              #barcode-camera-reader video {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
              }
              @keyframes laserSweepBeam {
                0% { top: 6%; opacity: 0.8; }
                50% { top: 92%; opacity: 1; }
                100% { top: 6%; opacity: 0.8; }
              }
              .laser-sweep-beam-active {
                animation: laserSweepBeam 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
              }
            `}</style>

            {/* Viewport Box */}
            <div className="relative w-full h-[260px] sm:h-[300px] lg:h-[320px] bg-black overflow-hidden flex items-center justify-center">
              <div id="barcode-camera-reader" className="w-full h-full" />

              {/* Center Target Box (Wider horizontal frame optimized for SPX/Shopee 1D Barcodes) */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                <div className="relative w-[94%] max-w-[460px] h-[135px] sm:h-[155px]">
                  {/* Laser beam */}
                  {!isCameraPaused && (
                    <div className="laser-sweep-beam-active absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-[#3b82f6] to-transparent shadow-[0_0_12px_#3b82f6]" />
                  )}

                  {/* 4 Glowing Corner Angles */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-[3.5px] border-l-[3.5px] border-[#3b82f6] rounded-tl shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-[3.5px] border-r-[3.5px] border-[#3b82f6] rounded-tr shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3.5px] border-l-[3.5px] border-[#3b82f6] rounded-bl shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3.5px] border-r-[3.5px] border-[#3b82f6] rounded-br shadow-[0_0_8px_rgba(59,130,246,0.6)]" />

                  {/* Centered Instruction Pill */}
                  <div className="absolute -bottom-7 inset-x-0 flex justify-center">
                    <span className="px-3 py-1 rounded-full bg-black/80 backdrop-blur-md text-[11px] font-medium text-white shadow-md border border-white/10 whitespace-nowrap">
                      {isCameraPaused ? 'Quét đang tạm dừng' : 'Đưa mã vận đơn / mã SPX vào khung (giữ cách 15-25cm)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pause Overlay */}
              {isCameraPaused && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-[3px] flex flex-col items-center justify-center text-center z-25 space-y-3 p-4 pointer-events-auto">
                  <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10">
                    <Pause size={26} className="fill-current" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-white">Đang tạm dừng quét barcode</div>
                    <div className="text-xs text-gray-300 max-w-xs leading-relaxed">
                      Đã khóa nhận diện từ camera và máy quét mã vạch.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={togglePauseCamera}
                    className="mt-1 px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/25 active:scale-95 transition-all"
                  >
                    <Play size={14} className="fill-current" />
                    <span>Tiếp tục quét</span>
                  </button>
                </div>
              )}

              {/* Top Floating Controls */}
              <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-20 pointer-events-auto">
                {/* Camera Mode & Live Verify Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white text-[11px] font-medium shadow-xs">
                    <span className={`w-1.5 h-1.5 rounded-full ${isCameraPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                    <span>{isCameraPaused ? 'Đang tạm dừng' : (facingMode === 'environment' ? 'Camera sau' : 'Camera trước')}</span>
                  </div>

                  {isLiveVerify && (
                    <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-950/80 backdrop-blur-md border border-indigo-500/50 text-indigo-300 text-[10px] font-bold shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                      <span>Đối soát trực tiếp</span>
                    </div>
                  )}
                </div>

                {/* Zoom & Torch Buttons */}
                <div className="flex items-center gap-1.5">
                  {/* Zoom button */}
                  <button
                    type="button"
                    onClick={handleToggleZoom}
                    className="w-7 h-7 rounded-full bg-black/70 text-white border border-white/20 flex items-center justify-center font-mono text-[11px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer backdrop-blur-md"
                    title={`Thu phóng: ${zoom}x. Bấm để đổi`}
                  >
                    {zoom}x
                  </button>

                  {/* Torch button */}
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`w-7 h-7 rounded-full flex items-center justify-center border backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-xs ${
                      torchOn
                        ? 'bg-amber-500 text-white border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                        : 'bg-black/70 text-white border-white/20 hover:bg-black/90'
                    }`}
                    title={torchOn ? 'Tắt đèn Flash' : 'Bật đèn Flash'}
                  >
                    {torchOn ? <Zap size={13} className="fill-current" /> : <ZapOff size={13} />}
                  </button>
                </div>
              </div>

              {/* Camera Error Alert */}
              {cameraError && (
                <div className="absolute inset-0 bg-black/90 p-5 flex flex-col items-center justify-center text-center z-30 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-lg">
                    <AlertTriangle size={24} className="stroke-[2]" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <p className="text-xs font-bold text-white">Chưa thể mở Camera</p>
                    <p className="text-[11px] text-gray-300 leading-relaxed">{cameraError}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-1 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3.5 py-1.5 rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold cursor-pointer active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                    >
                      <RefreshCw size={12} />
                      <span>Thử lại camera</span>
                    </button>
                    {cameras.length > 1 && (
                      <button
                        type="button"
                        onClick={handleSwitchCamera}
                        className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium cursor-pointer active:scale-95 transition-all border border-gray-700 flex items-center gap-1.5"
                      >
                        <RefreshCw size={12} />
                        <span>Đổi sang camera khác ({cameras.length})</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3 Camera Toolbar Buttons */}
            <div className="grid grid-cols-3 gap-1.5 p-2 bg-[#12151e] border-t border-gray-800 text-xs font-semibold">
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="flex items-center justify-center gap-1.5 py-2 rounded bg-[#1c2230] text-gray-200 hover:text-white active:scale-95 transition-all cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Đổi camera</span>
              </button>
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded border transition-all cursor-pointer active:scale-95 ${
                  soundEnabled
                    ? 'bg-[#1c2230] border-gray-700/80 text-gray-200'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
              >
                {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                <span>Âm thanh</span>
              </button>
              <button
                type="button"
                onClick={togglePauseCamera}
                className={`flex items-center justify-center gap-1.5 py-2 rounded border transition-all cursor-pointer active:scale-95 ${
                  isCameraPaused
                    ? 'bg-amber-500 text-white border-amber-400 shadow-sm shadow-amber-500/25 font-semibold'
                    : 'bg-[#2563eb] text-white border-blue-400 shadow-sm shadow-blue-500/20'
                }`}
              >
                {isCameraPaused ? <Play size={13} className="fill-current" /> : <Pause size={13} className="fill-current" />}
                <span>{isCameraPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
              </button>
            </div>

            {/* Quick manual / paste input bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const code = manualInputCode.trim();
                if (code) {
                  if (handleIncomingBarcodeRef.current) {
                    handleIncomingBarcodeRef.current(code);
                  }
                  setManualInputCode('');
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0e1118] border-t border-gray-800"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={manualInputCode}
                  onChange={(e) => setManualInputCode(e.target.value)}
                  placeholder="Dán hoặc nhập tay mã vận đơn (SHOPEE..., SPX...)"
                  className="w-full h-8 pl-8 pr-2.5 text-xs bg-[#161a23] border border-gray-700/80 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                />
                <ScanLine size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
              </div>
              <button
                type="submit"
                disabled={!manualInputCode.trim()}
                className="h-8 px-3 rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 shadow-xs"
              >
                Nhận mã
              </button>
            </form>
          </div>

          {/* 5. LIVE STATUS BANNER */}
          <div className={`p-2.5 rounded border shadow-xs flex items-center gap-2.5 transition-colors ${
            lastScannedFeedback?.status === 'CANCELLED'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-800 dark:text-rose-200 ring-1 ring-rose-500/30'
              : lastScannedFeedback?.status === 'RETURNED'
              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-800 dark:text-purple-200 ring-1 ring-purple-500/30'
              : lastScannedFeedback?.status === 'NOT_FOUND'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500/50 text-amber-800 dark:text-amber-200'
              : 'bg-white dark:bg-[#161a23] border-gray-200 dark:border-gray-800'
          }`}>
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isCameraPaused
                  ? 'bg-amber-400'
                  : lastScannedFeedback?.status === 'CANCELLED'
                  ? 'bg-rose-500 animate-ping'
                  : lastScannedFeedback?.status === 'RETURNED'
                  ? 'bg-purple-500 animate-ping'
                  : lastScannedFeedback?.status === 'NOT_FOUND'
                  ? 'bg-amber-500'
                  : lastScannedFeedback?.status === 'VERIFIED'
                  ? 'bg-emerald-500 animate-pulse'
                  : lastScannedFeedback?.isDuplicate
                  ? 'bg-amber-400'
                  : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-gray-900 dark:text-white">
                {isCameraPaused ? (
                  <span className="text-amber-500 dark:text-amber-400">
                    Đang tạm dừng quét barcode (Bấm &apos;Tiếp tục&apos; để nhận mã)
                  </span>
                ) : lastScannedFeedback?.status === 'CANCELLED' ? (
                  <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} className="shrink-0 animate-bounce" />
                    <span>
                      {lastScannedFeedback.autoRestocked
                        ? `🚨 ĐƠN HÀNG ĐÃ HỦY: ĐÃ TỰ ĐỘNG HOÀN KHO • ${lastScannedFeedback.code}`
                        : lastScannedFeedback.wasDispatched
                        ? `🚨 CẢNH BÁO: ĐÃ XUẤT TRƯỚC NHƯNG ĐÃ BỊ HỦY • ${lastScannedFeedback.code}`
                        : `🚨 CẢNH BÁO ĐƠN HỦY: Mã ${lastScannedFeedback.code}`}
                    </span>
                  </span>
                ) : lastScannedFeedback?.status === 'RETURNED' ? (
                  <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} className="shrink-0 animate-bounce" />
                    <span>
                      {`🚨 CẢNH BÁO ĐƠN HOÀN / TRẢ HÀNG: Mã ${lastScannedFeedback.code}`}
                    </span>
                  </span>
                ) : lastScannedFeedback?.status === 'NOT_FOUND' ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>⚠️ KHÔNG CÓ TT MÃ VẬN ĐƠN: Mã {lastScannedFeedback.code}</span>
                  </span>
                ) : lastScannedFeedback?.status === 'VERIFIED' ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <span>✅ ĐỐI SOÁT THÀNH CÔNG (ĐÃ XUẤT KHO) • {lastScannedFeedback.code}</span>
                  </span>
                ) : lastScannedFeedback?.status === 'ALREADY_VERIFIED' ? (
                  <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1.5">
                    <span>ĐÃ XUẤT KHO TRƯỚC ĐÓ • {lastScannedFeedback.code}</span>
                  </span>
                ) : lastScannedFeedback ? (
                  lastScannedFeedback.isDuplicate ? (
                    <span className="text-amber-500 dark:text-amber-400">
                      Mã đã có trong phiên (Trùng lặp) • {lastScannedFeedback.code}
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Đã thêm mã vào phiên (Chờ đối soát) • {lastScannedFeedback.code}
                    </span>
                  )
                ) : (
                  'Sẵn sàng nhận mã tiếp theo'
                )}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {isCameraPaused
                  ? 'Máy quét phần cứng và camera đang tạm khóa. Không có mã nào được thêm vào phiên.'
                  : lastScannedFeedback?.status === 'CANCELLED'
                  ? (lastScannedFeedback.message || 'Đơn hàng đã bị hủy trên sàn Shopee! Hệ thống đã tự động hủy xác nhận đi đơn và hoàn tồn kho!')
                  : lastScannedFeedback?.status === 'RETURNED'
                  ? (lastScannedFeedback.message || 'Đơn hàng có yêu cầu Trả hàng / Hoàn tiền trên sàn Shopee! Tuyệt đối giữ lại kiện hàng!')
                  : lastScannedFeedback?.status === 'NOT_FOUND'
                  ? 'Mã vận đơn này chưa có trong hệ thống hoặc chưa được đồng bộ từ sàn.'
                  : lastScannedFeedback?.status === 'VERIFIED'
                  ? `Đã cập nhật xuất kho thành công${lastScannedFeedback.shopName ? ` • Shop: ${lastScannedFeedback.shopName}` : ''}${lastScannedFeedback.carrierName ? ` • ĐVVC: ${lastScannedFeedback.carrierName}` : ''}`
                  : lastScannedFeedback
                  ? `Quét lúc ${lastScannedFeedback.timestamp} • Sẵn sàng quét mã tiếp theo.`
                  : isLiveVerify
                  ? 'Đang bật đối soát trực tiếp. Mỗi mã quét sẽ được kiểm tra và xuất kho ngay lập tức.'
                  : 'Chế độ gom mã (Mặc định). Bấm [Gửi đối soát] sau khi hoàn thành phiên quét.'}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SESSION LEDGER & DISPATCH ACTIONS (lg:col-span-7 xl:col-span-7 space-y-3) */}
        <div className="flex flex-col space-y-3 lg:col-span-7 xl:col-span-7">
          {/* MOBILE VIEW (< lg): PRESERVE EXACT ACTION BUTTONS & COMPACT CARD LIST */}
          <div className="lg:hidden space-y-3">
            {/* 6. ACTION BUTTONS: TẢI XUỐNG & GỬI ĐỐI SOÁT */}
            <div className="flex items-center gap-2 pt-0.5">
              {/* Nút Tải xuống / Xuất CSV */}
              <button
                type="button"
                onClick={handleExportCurrentSession}
                disabled={!activeSession || activeSession.items.length === 0}
                className="h-9 px-3.5 rounded bg-white dark:bg-[#161a23] hover:bg-gray-50 dark:hover:bg-[#1c2230] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 active:scale-95 shrink-0 shadow-xs"
                title="Tải danh sách mã quét CSV"
              >
                <Download size={14} className="text-[#2563eb] dark:text-blue-400" />
                <span>Tải xuống</span>
              </button>

              {/* Nút Gửi đối soát */}
              <button
                type="button"
                onClick={handleSubmitBatch}
                disabled={!activeSession || activeSession.items.length === 0 || isVerifyingBatch}
                className="flex-1 h-9 px-4 rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
              >
                {isVerifyingBatch ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Đang gửi đối soát...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={15} />
                    <span>Gửi đối soát ({activeSession?.items.length || 0})</span>
                  </>
                )}
              </button>
            </div>

            {/* 7. SESSION RESULTS LIST FOR MOBILE */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                    Kết quả phiên
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2563eb]/10 dark:bg-[#2563eb]/20 text-[#2563eb] dark:text-[#3b82f6] font-mono">
                    {activeSession?.items.length || 0}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="text-xs text-[#2563eb] dark:text-[#3b82f6] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Xem tất cả</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              {/* Empty state or list */}
              {displayedItems.length === 0 ? (
                <div className="p-6 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 text-center space-y-2 shadow-xs">
                  <div className="w-10 h-10 mx-auto rounded bg-gray-100 dark:bg-gray-800/60 text-gray-400 dark:text-gray-400 grid place-items-center">
                    <Package size={22} className="stroke-[1.5]" />
                  </div>
                  <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    Chưa có mã nào được quét
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    Quét mã trên kiện hàng để bắt đầu.
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-0.5 custom-scrollbar">
                  {displayedItems.map((item, index) => {
                    const isVerified = item.status === 'VERIFIED';
                    const isAlreadyVerified = item.status === 'ALREADY_VERIFIED';
                    const isNotFound = item.status === 'NOT_FOUND';

                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 flex items-start gap-2 shadow-xs hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                      >
                        <span className="font-mono text-xs font-bold text-gray-400 w-5 text-right shrink-0 pt-0.5">
                          #{displayedItems.length - index}
                        </span>

                        <div className="flex-1 min-w-0">
                          {/* Hàng 1: Mã vận đơn (Trái) & Trạng thái + Nút Hoàn tác + Nút Xóa (Phải) */}
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              onClick={() => handleCopyCode(item.code)}
                              className="font-mono font-bold text-xs text-gray-900 dark:text-white truncate cursor-pointer hover:text-[#2563eb]"
                              title="Bấm để sao chép"
                            >
                              {item.code}
                            </span>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.isVirtual && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap border shrink-0 ${
                                    !item.isRealGoods
                                      ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                                      : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                                  }`}
                                  title={!item.isRealGoods ? 'Đơn ảo không đi hàng thật: không trừ kho sản phẩm' : 'Đơn ảo có đi hàng thật: đã trừ kho sản phẩm'}
                                >
                                  Đơn ảo {!item.isRealGoods ? '(K.trừ kho)' : '(Hàng thật)'}
                                </span>
                              )}
                              {item.isCancelled ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap border shrink-0 flex items-center gap-1 animate-pulse ${
                                    item.autoRestocked
                                      ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                                      : item.wasDispatched
                                      ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                  }`}
                                  title={
                                    item.autoRestocked
                                      ? 'Đơn hàng đã bị hủy trên sàn Shopee! Hệ thống đã tự động hủy xác nhận đi đơn và hoàn tồn kho thực tế'
                                      : item.wasDispatched
                                      ? 'Đơn hàng đã xác nhận xuất trước đó nhưng đã bị hủy trên sàn'
                                      : 'Đơn hàng đã bị hủy trên sàn'
                                  }
                                >
                                  <AlertTriangle size={11} className="shrink-0" />
                                  <span>
                                    {item.autoRestocked
                                      ? 'ĐƠN HỦY (ĐÃ HOÀN KHO)'
                                      : item.wasDispatched
                                      ? 'ĐÃ XUẤT (ĐÃ HỦY)'
                                      : 'ĐƠN ĐÃ HỦY'}
                                  </span>
                                </span>
                              ) : item.isReturned ? (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap border shrink-0 flex items-center gap-1 animate-pulse bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30"
                                  title="Đơn hàng có yêu cầu Trả hàng / Hoàn tiền trên sàn Shopee! Tuyệt đối giữ lại kiện hàng!"
                                >
                                  <AlertTriangle size={11} className="shrink-0" />
                                  <span>ĐƠN HOÀN HÀNG</span>
                                </span>
                              ) : (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap border shrink-0 ${
                                    isVerified
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                      : isAlreadyVerified
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                      : isNotFound
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                      : item.status === 'ERROR'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                  }`}
                                >
                                  {isVerified
                                    ? 'Thành công'
                                    : isAlreadyVerified
                                    ? 'Đã xuất trước'
                                    : isNotFound
                                    ? 'Không có TT vận đơn'
                                    : item.status === 'ERROR'
                                    ? 'Lỗi đối soát'
                                    : 'Chờ đối soát'}
                                </span>
                              )}

                              {(isVerified || isAlreadyVerified) && item.packageId && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmAction({ type: 'REVERSE', item })}
                                  className="h-6 px-1.5 rounded flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer shrink-0"
                                  title="Hoàn tác xuất kho (cộng lại tồn kho)"
                                >
                                  <RotateCcw size={11} />
                                  <span>Hoàn tác</span>
                                </button>
                              )}

                              {!isVerified && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmAction({ type: 'DELETE', item })}
                                  className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                                  title="Xóa mã này khỏi phiên"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Hàng 2: Thời gian & Mô tả (Trái) & Nút Xem đơn (Phải) */}
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 truncate min-w-0">
                              <span className="font-mono text-[10px] text-gray-400 shrink-0">{item.scannedAt}</span>
                              <span className="text-gray-300 dark:text-gray-700 shrink-0">•</span>
                              <span className="truncate">
                                {item.message || (item.status === 'PENDING' ? 'Chờ đối soát' : 'Đã đối soát')}
                              </span>
                            </div>

                            {item.orderId && (
                              <button
                                type="button"
                                onClick={() => handleOpenOrderDetail(item.orderId)}
                                className="text-[#2563eb] hover:underline font-semibold text-[11px] shrink-0 flex items-center gap-0.5 cursor-pointer ml-auto"
                              >
                                <span>Xem đơn</span>
                                <span>→</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* DESKTOP PC VIEW (>= lg): EXPANDED FULL-WIDTH WORKSTATION LEDGER TABLE */}
          <div className="hidden lg:flex lg:flex-col space-y-3">
            {/* Desktop Action & Header Bar */}
            <div className="p-3 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 truncate">
                  <span>Danh sách mã đã quét</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#2563eb]/10 dark:bg-[#2563eb]/20 text-[#2563eb] dark:text-[#3b82f6] font-mono shrink-0">
                    {activeSession?.items.length || 0}
                  </span>
                </h3>
                <span className="text-xs text-gray-400 font-mono hidden xl:inline shrink-0">
                  • Phiên: {activeSession?.sessionCode}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportCurrentSession}
                  disabled={!activeSession || activeSession.items.length === 0}
                  className="h-8 px-3 rounded bg-white dark:bg-[#1c2230] hover:bg-gray-50 dark:hover:bg-[#232a3b] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shadow-xs active:scale-95"
                  title="Tải danh sách mã quét CSV"
                >
                  <Download size={13} className="text-[#2563eb] dark:text-blue-400" />
                  <span>Xuất CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmitBatch}
                  disabled={!activeSession || activeSession.items.length === 0 || isVerifyingBatch}
                  className="h-8 px-4 rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isVerifyingBatch ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Đang gửi đối soát...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={14} />
                      <span>Gửi đối soát ({activeSession?.items.length || 0})</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="h-8 px-2.5 rounded bg-gray-50 dark:bg-[#1c2230] hover:bg-gray-100 dark:hover:bg-[#232a3b] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer"
                  title="Xem lịch sử các phiên quét"
                >
                  <span>Lịch sử phiên</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden flex flex-col">
              {displayedItems.length === 0 ? (
                <div className="py-20 text-center space-y-3 p-6">
                  <div className="w-14 h-14 mx-auto rounded-full bg-gray-100 dark:bg-gray-800/80 text-gray-400 grid place-items-center">
                    <Package size={26} className="stroke-[1.5]" />
                  </div>
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Chưa có mã nào được quét trong phiên này
                  </div>
                  <div className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                    Sử dụng súng quét mã vạch cầm tay (USB/Bluetooth) hoặc đưa mã vận đơn vào khung camera để bắt đầu nhận diện tự động.
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[calc(100vh-270px)] min-h-[440px] custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50/90 dark:bg-[#12151e] text-gray-500 dark:text-gray-400 font-semibold sticky top-0 z-10 border-b border-gray-200/80 dark:border-gray-800 backdrop-blur-xs">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">STT</th>
                        <th className="py-2.5 px-3 min-w-[170px]">Mã vận đơn / Kiện</th>
                        <th className="py-2.5 px-3 w-24 whitespace-nowrap">Thời gian</th>
                        <th className="py-2.5 px-3 w-32 whitespace-nowrap">Trạng thái</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Diễn giải đối soát</th>
                        <th className="py-2.5 px-3 w-28 text-right whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
                      {displayedItems.map((item, index) => {
                        const isVerified = item.status === 'VERIFIED';
                        const isAlreadyVerified = item.status === 'ALREADY_VERIFIED';
                        const isNotFound = item.status === 'NOT_FOUND';

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-gray-50/70 dark:hover:bg-[#1c2230]/50 transition-colors"
                          >
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-gray-400 text-[11px]">
                              #{displayedItems.length - index}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span
                                  onClick={() => handleCopyCode(item.code)}
                                  className="font-mono font-bold text-xs text-gray-900 dark:text-white cursor-pointer hover:text-[#2563eb] select-all"
                                  title="Bấm để sao chép"
                                >
                                  {item.code}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyCode(item.code)}
                                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5"
                                  title="Sao chép mã"
                                >
                                  <Copy size={11} />
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                              {item.scannedAt}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {item.isCancelled ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border animate-pulse ${
                                    item.autoRestocked
                                      ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                                      : item.wasDispatched
                                      ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                  }`}
                                  title={
                                    item.autoRestocked
                                      ? 'Đơn hàng đã bị hủy trên sàn Shopee! Hệ thống đã tự động hủy xác nhận đi đơn và hoàn tồn kho thực tế'
                                      : item.wasDispatched
                                      ? 'Đơn hàng đã xác nhận xuất trước đó nhưng đã bị hủy trên sàn'
                                      : 'Đơn hàng đã bị hủy trên sàn'
                                  }
                                >
                                  <AlertTriangle size={11} className="shrink-0" />
                                  <span>
                                    {item.autoRestocked
                                      ? 'ĐƠN HỦY • ĐÃ HOÀN KHO'
                                      : item.wasDispatched
                                      ? 'ĐÃ XUẤT (ĐÃ HỦY)'
                                      : 'ĐƠN ĐÃ HỦY'}
                                  </span>
                                </span>
                              ) : item.isReturned ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border animate-pulse bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30"
                                  title="Đơn hàng có yêu cầu Trả hàng / Hoàn tiền trên sàn Shopee! Tuyệt đối giữ lại kiện hàng!"
                                >
                                  <AlertTriangle size={11} className="shrink-0" />
                                  <span>ĐƠN HOÀN • GIỮ KIỆN</span>
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                    isVerified
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                      : isAlreadyVerified
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                      : isNotFound
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                      : item.status === 'ERROR'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                  }`}
                                >
                                  {isVerified
                                    ? 'Thành công'
                                    : isAlreadyVerified
                                    ? 'Đã xuất trước'
                                    : isNotFound
                                    ? 'Không có TT vận đơn'
                                    : item.status === 'ERROR'
                                    ? 'Lỗi đối soát'
                                    : 'Chờ đối soát'}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                              <div className="truncate max-w-md">
                                {item.isCancelled ? (
                                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                    {item.message || 'Đơn hàng đã bị hủy trên sàn Shopee, không thể xuất kho!'}
                                  </span>
                                ) : item.isReturned ? (
                                  <span className="text-purple-600 dark:text-purple-400 font-semibold">
                                    {item.message || 'Đơn hàng có yêu cầu Trả hàng / Hoàn tiền trên sàn Shopee, không thể xuất kho!'}
                                  </span>
                                ) : item.status === 'NOT_FOUND' ? (
                                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                                    Không tìm thấy thông tin mã vận đơn trong hệ thống
                                  </span>
                                ) : (
                                  item.message || (item.status === 'PENDING' ? 'Chờ gửi đối soát hệ thống' : 'Đã xử lý')
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {item.orderId && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenOrderDetail(item.orderId)}
                                    className="px-2 py-1 rounded bg-[#2563eb]/10 hover:bg-[#2563eb]/20 text-[#2563eb] dark:text-blue-400 text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                                    title="Xem chi tiết đơn hàng"
                                  >
                                    <span>Xem đơn</span>
                                    <ExternalLink size={10} />
                                  </button>
                                )}
                                {(isVerified || isAlreadyVerified) && item.packageId && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmAction({ type: 'REVERSE', item })}
                                    className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-[11px] font-semibold border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer inline-flex items-center gap-1"
                                    title="Hoàn tác xuất kho (cộng lại tồn kho)"
                                  >
                                    <RotateCcw size={10} />
                                    <span>Hoàn tác</span>
                                  </button>
                                )}
                                {!isVerified && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmAction({ type: 'DELETE', item })}
                                    className="p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                    title="Xóa mã này khỏi phiên"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SESSIONS HISTORY MODAL */}
      <SessionsHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onSelectSessionToScan={(session) => {
          setActiveSession(session.id);
          toast.info(`Đang mở: ${session.name}`);
        }}
        onOpenOrderDetail={handleOpenOrderDetail}
      />

      {/* ORDER DETAIL DRAWER */}
      <OrderDetailDrawer
        order={selectedOrderForDrawer}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onRefresh={() => {}}
      />

      {/* ACTION CONFIRMATION MODAL (System UI/UX) */}
      <Modal
        isOpen={!!confirmAction}
        onClose={() => !isActionLoading && setConfirmAction(null)}
        maxWidth="max-w-md"
        size="sm"
        mobilePlacement="bottom"
      >
        <ModalBody className="p-4 sm:p-5 space-y-3">
          {confirmAction?.type === 'REVERSE' ? (
            <>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                  <RotateCcw size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                    Xác nhận hoàn tác xuất kho
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Bạn có chắc chắn muốn hoàn tác xuất kho cho mã{' '}
                    <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                      "{confirmAction.item.code}"
                    </span>
                    ?
                  </p>
                </div>
              </div>

              <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>Lưu ý về tồn kho</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                  Số lượng sản phẩm trong kiện sẽ được <strong>cộng hoàn trả lại vào tồn kho thực tế</strong> ngay lập tức và ghi nhận vào sổ cái kho.
                </p>
              </div>

              {confirmAction.item.carrierName && (
                <div className="p-2.5 rounded bg-gray-50 dark:bg-[#1a1d26] border border-gray-100 dark:border-gray-800 text-xs flex items-center justify-between text-gray-600 dark:text-gray-300">
                  <span>Đơn vị vận chuyển:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {confirmAction.item.carrierName}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                  <Trash2 size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                    Xóa mã khỏi phiên quét
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Bạn có chắc chắn muốn xóa mã{' '}
                    <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                      "{confirmAction?.item.code}"
                    </span>{' '}
                    khỏi danh sách phiên quét hiện tại?
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#1a1d26] p-2.5 rounded border border-gray-100 dark:border-gray-800">
                Thao tác này chỉ gỡ bỏ mã khỏi phiên quét trên thiết bị này, không làm thay đổi trạng thái đơn hàng trên sàn.
              </p>
            </>
          )}
        </ModalBody>

        <ModalFooter className="px-4 py-3">
          <ModalButton
            variant="outline"
            onClick={() => setConfirmAction(null)}
            disabled={isActionLoading}
          >
            Hủy bỏ
          </ModalButton>

          <ModalButton
            variant="danger"
            onClick={handleExecuteConfirmAction}
            loading={isActionLoading}
          >
            {confirmAction?.type === 'REVERSE' ? 'Xác nhận hoàn tác' : 'Xóa khỏi phiên'}
          </ModalButton>
        </ModalFooter>
      </Modal>
    </div>
  );
};
