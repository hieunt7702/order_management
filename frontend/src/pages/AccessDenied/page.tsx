import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Headset, Mail, Phone, MessageSquareText, Copy, CheckCircle2 } from 'lucide-react';

export interface AccessDeniedPageProps {
  hwid?: string;
  error?: string | null;
}

export const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({
  hwid,
  error,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async () => {
    try {
      if (!hwid) return;
      await navigator.clipboard.writeText(hwid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center text-center w-full max-w-lg z-10"
      >
        {/* Background Image Secure */}
        <img
          src="/secure2.png"
          alt="Access Denied"
          className="w-[480px] h-auto -mb-8 object-contain pointer-events-none"
        />

        <h1 className="text-[32px] font-semibold text-white mb-3 tracking-tight">
          Không có quyền truy cập ứng dụng
        </h1>

        <p className="text-[16px] text-gray-400 mb-10 leading-relaxed max-w-md">
          Thiết bị của bạn hiện không có quyền truy cập vào hệ thống.
          <br />
          Vui lòng liên hệ quản trị viên để được hỗ trợ.
        </p>

        {/* Contact Card */}
        <div className="w-full max-w-[420px] bg-transparent border border-[#5865f2]/20 rounded p-6 mb-12 flex items-start gap-5">
          <div className="w-14 h-14 rounded bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <Headset size={26} strokeWidth={2} />
          </div>

          <div className="flex flex-col text-left space-y-3">
            <h3 className="text-[15px] font-semibold text-gray-200 mb-0.5">
              Liên hệ quản trị viên
            </h3>

            <div className="flex items-center gap-3 text-[14px]">
              <Mail size={16} className="text-[#5865f2]" />
              <a
                href="https://www.facebook.com/hieunt270702"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5865f2]"
              >
                https://www.facebook.com/hieunt270702
              </a>
            </div>

            <div className="flex items-center gap-3 text-[14px]">
              <Phone size={16} className="text-gray-400" />
              <span className="text-gray-400">033 468 9521</span>
            </div>

            <div className="flex items-center gap-3 text-[14px]">
              <MessageSquareText size={16} className="text-gray-400" />
              <span className="text-gray-400">
                Chúng tôi luôn sẵn sàng hỗ trợ bạn!
              </span>
            </div>
          </div>
        </div>

        {/* HWID Copy Section */}
        <div className="flex flex-col items-center">
          <button
            onClick={handleCopy}
            className="flex items-center gap-3 px-6 py-3.5 rounded border border-[#5865f2]/30 bg-[#5865f2]/5 text-[#5865f2] hover:bg-[#5865f2]/10 transition-colors relative group"
            title="Nhấn để copy mã thiết bị"
          >
            <span className="font-mono text-[16px] tracking-wide select-all">
              {hwid || 'Đang lấy mã...'}
            </span>
            <div className="w-px h-6 bg-[#5865f2]/20" />
            {copied ? (
              <CheckCircle2 size={18} className="text-green-500" />
            ) : (
              <Copy size={18} />
            )}
          </button>
        </div>

        {error && (
          <p className="mt-6 text-xs text-red-400/80 font-medium">
            Lỗi: {error}
          </p>
        )}
      </motion.div>
    </div>
  );
};
