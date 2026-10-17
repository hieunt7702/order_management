import React, { useState, useEffect } from 'react';
import { Settings2, Sparkles, Volume2, VolumeX, Smartphone, Key, Check } from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';

export interface ScannerSettings {
  engine: 'tesseract' | 'gemini';
  geminiApiKey: string;
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  preventDuplicates: boolean;
  autoAddOnBarcode: boolean;
}

export interface ScannerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: ScannerSettings;
  onSaveSettings: (settings: ScannerSettings) => void;
}

export const ScannerSettingsModal: React.FC<ScannerSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [localSettings, setLocalSettings] = useState<ScannerSettings>({
    engine: 'tesseract',
    geminiApiKey: '',
    soundEnabled: true,
    vibrateEnabled: true,
    preventDuplicates: true,
    autoAddOnBarcode: true,
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cài đặt quét đơn"
      subtitle={<span className="line-clamp-1 sm:line-clamp-none">Tùy chỉnh động cơ nhận diện & phản hồi âm thanh / rung</span>}
      icon={Settings2}
      maxWidth="max-w-md"
    >
      <div className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-3 sm:space-y-4 p-3 sm:p-5">
          {/* AI / OCR Engine */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
              Động cơ nhận diện chữ (OCR)
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setLocalSettings({ ...localSettings, engine: 'tesseract' })}
                className={`p-3 rounded border text-left flex flex-col transition-all cursor-pointer ${
                  localSettings.engine === 'tesseract'
                    ? 'border-[#5865f2] bg-[#5865f2]/10 text-gray-900 dark:text-white font-medium'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                <span className="font-semibold text-xs flex items-center gap-1.5">
                  Tesseract OCR
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Chạy Offline 100% trong trình duyệt, miễn phí.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLocalSettings({ ...localSettings, engine: 'gemini' })}
                className={`p-3 rounded border text-left flex flex-col transition-all cursor-pointer ${
                  localSettings.engine === 'gemini'
                    ? 'border-[#5865f2] bg-[#5865f2]/10 text-[#5865f2] dark:text-indigo-300 font-medium'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                <span className="font-semibold text-xs flex items-center gap-1.5">
                  <Sparkles size={13} /> Gemini 2.0 AI
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Siêu nhanh 0.8s, trích xuất 100% chuẩn xác.
                </span>
              </button>
            </div>
          </div>

          {/* Gemini API Key input if selected */}
          {localSettings.engine === 'gemini' && (
            <div className="p-3 bg-gray-50 dark:bg-[#1a1b23] border border-gray-100 dark:border-gray-800 rounded space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5865f2] dark:text-indigo-300">
                <Key size={13} /> Google Gemini API Key
              </div>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={localSettings.geminiApiKey}
                onChange={(e) => setLocalSettings({ ...localSettings, geminiApiKey: e.target.value })}
                className="w-full h-[36px] px-3 bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 font-mono transition-all"
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                Lấy API Key miễn phí tại <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[#5865f2] dark:text-indigo-400 underline">Google AI Studio</a> (hoàn toàn miễn phí 15 lượt quét/phút).
              </p>
            </div>
          )}

          {/* Feedback options */}
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Phản hồi khi quét
            </label>

            {/* Sound toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {localSettings.soundEnabled ? (
                  <Volume2 size={16} className="text-emerald-500" />
                ) : (
                  <VolumeX size={16} className="text-gray-400" />
                )}
                <div>
                  <div className="text-xs font-medium text-gray-900 dark:text-white">Âm thanh bíp</div>
                  <div className="text-[11px] text-gray-500">Phát tiếng bíp khi quét thành công</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={localSettings.soundEnabled}
                onChange={(e) => setLocalSettings({ ...localSettings, soundEnabled: e.target.checked })}
                className="w-4 h-4 text-[#5865f2] rounded cursor-pointer"
              />
            </div>

            {/* Vibration toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Smartphone size={16} className="text-[#5865f2]" />
                <div>
                  <div className="text-xs font-medium text-gray-900 dark:text-white">Rung điện thoại</div>
                  <div className="text-[11px] text-gray-500">Rung nhẹ xác nhận trên thiết bị di động</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={localSettings.vibrateEnabled}
                onChange={(e) => setLocalSettings({ ...localSettings, vibrateEnabled: e.target.checked })}
                className="w-4 h-4 text-[#5865f2] rounded cursor-pointer"
              />
            </div>

            {/* Duplicate prevention */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded border border-amber-500 flex items-center justify-center text-[10px] text-amber-500 font-bold">!</div>
                <div>
                  <div className="text-xs font-medium text-gray-900 dark:text-white">Chống quét trùng</div>
                  <div className="text-[11px] text-gray-500">Cảnh báo nếu mã vận đơn đã có trong danh sách</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={localSettings.preventDuplicates}
                onChange={(e) => setLocalSettings({ ...localSettings, preventDuplicates: e.target.checked })}
                className="w-4 h-4 text-[#5865f2] rounded cursor-pointer"
              />
            </div>
          </div>
        </ModalBody>

        <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
          <ModalButton
            variant="secondary"
            onClick={onClose}
            className="flex-1 sm:flex-initial"
          >
            Đóng
          </ModalButton>
          <ModalButton
            variant="primary"
            onClick={handleSave}
            className="flex-1 sm:flex-initial"
          >
            <Check size={14} className="mr-1 inline" /> Áp dụng
          </ModalButton>
        </ModalFooter>
      </div>
    </Modal>
  );
};
