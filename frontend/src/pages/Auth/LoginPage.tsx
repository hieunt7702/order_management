import React, { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command, Lock, Mail, AlertCircle, ArrowRight, Building2 } from 'lucide-react';
import { authApi } from '../../services/authApi';
import { useAuthStore } from '../../stores/authStore';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState<string>('admin@shopee.vn');
  const [password, setPassword] = useState<string>('Admin@123456');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isBootstrapOpen, setIsBootstrapOpen] = useState<boolean>(false);
  const [bootstrapForm, setBootstrapForm] = useState({
    name: 'Admin Tổng',
    email: 'new_admin@shopee.vn',
    password: 'Password123@Pass',
    tenantCode: 'TENANT_NEW_01',
    tenantName: 'Công Ty Bán Lẻ Mới',
  });

  const handleLogin = async (e?: FormEvent) => {
    e?.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const data = await authApi.login(email, password);
      setAuth(data);
      navigate('/');
    } catch (err: any) {
      setError(
        err.message ||
          'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBootstrap = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await authApi.bootstrap(bootstrapForm);
      // Automatically login with the new credentials
      const loginData = await authApi.login(
        bootstrapForm.email,
        bootstrapForm.password,
      );
      setAuth(loginData);
      setIsBootstrapOpen(false);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Khởi tạo Workspace thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123@Pass');
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] dark:bg-[#0f1218] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#161b26] rounded shadow-xl border border-gray-200 dark:border-gray-800 p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded bg-[#5865f2] text-white flex items-center justify-center mb-3 shadow-sm">
            <Command size={26} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Shopee Order Manager
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Hệ thống quản trị đơn hàng, kho & thương mại điện tử đa tenant
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex items-start gap-2.5 text-rose-700 dark:text-rose-400 text-xs">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Normal Login Form */}
        {!isBootstrapOpen ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Email đăng nhập
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-4 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-bold rounded transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? 'Đang xác thực...' : 'Đăng nhập hệ thống'}
              <ArrowRight size={14} />
            </button>

            {/* Admin Account Quick Selection */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 text-center">
                Tài khoản mặc định (Click để chọn nhanh)
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@shopee.vn');
                    setPassword('Admin@123456');
                  }}
                  className="w-full text-left p-2.5 rounded bg-gray-50 dark:bg-gray-800/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-xs border border-gray-200/60 dark:border-gray-700/50 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div>
                    <span className="font-bold text-gray-900 dark:text-gray-100 block">
                      admin@shopee.vn
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                      Mật khẩu: Admin@123456
                    </span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-[#5865f2] dark:text-indigo-400 font-bold">
                    OWNER
                  </span>
                </button>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setIsBootstrapOpen(true)}
                className="text-xs text-[#5865f2] hover:underline font-semibold cursor-pointer"
              >
                + Khởi tạo Workspace mới (Bootstrap)
              </button>
            </div>
          </form>
        ) : (
          /* Bootstrap New Tenant Form */
          <form onSubmit={handleBootstrap} className="space-y-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-900 dark:text-white">
              <Building2 size={16} className="text-[#5865f2]" />
              Khởi tạo Workspace & Tài khoản OWNER mới
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                Tên Workspace
              </label>
              <input
                type="text"
                required
                value={bootstrapForm.tenantName}
                onChange={(e) =>
                  setBootstrapForm({
                    ...bootstrapForm,
                    tenantName: e.target.value,
                  })
                }
                className="w-full px-3 py-1.5 text-xs rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                Mã Workspace (viết hoa, không dấu)
              </label>
              <input
                type="text"
                required
                value={bootstrapForm.tenantCode}
                onChange={(e) =>
                  setBootstrapForm({
                    ...bootstrapForm,
                    tenantCode: e.target.value,
                  })
                }
                className="w-full px-3 py-1.5 text-xs rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                Họ tên Admin
              </label>
              <input
                type="text"
                required
                value={bootstrapForm.name}
                onChange={(e) =>
                  setBootstrapForm({ ...bootstrapForm, name: e.target.value })
                }
                className="w-full px-3 py-1.5 text-xs rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={bootstrapForm.email}
                onChange={(e) =>
                  setBootstrapForm({ ...bootstrapForm, email: e.target.value })
                }
                className="w-full px-3 py-1.5 text-xs rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                Mật khẩu (ít nhất 8 ký tự)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={bootstrapForm.password}
                onChange={(e) =>
                  setBootstrapForm({
                    ...bootstrapForm,
                    password: e.target.value,
                  })
                }
                className="w-full px-3 py-1.5 text-xs rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBootstrapOpen(false)}
                className="flex-1 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-bold rounded shadow-sm cursor-pointer disabled:opacity-50"
              >
                Khởi tạo ngay
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
