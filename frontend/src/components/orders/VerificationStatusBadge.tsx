import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ScanLine,
  XCircle,
} from 'lucide-react';
import {
  getVerificationStatusConfig,
  VerificationStatusConfigItem,
} from '../../utils/orderStatus';

interface VerificationStatusBadgeProps {
  status?: string | null;
  showLabel?: boolean;
  className?: string;
}

export const VerificationStatusBadge: React.FC<VerificationStatusBadgeProps> = ({
  status,
  showLabel = false,
  className = '',
}) => {
  const cfg: VerificationStatusConfigItem = getVerificationStatusConfig(status);

  const renderIcon = (size: number = 14) => {
    switch (cfg.iconType) {
      case 'verified':
        return <CheckCircle2 size={size} className="stroke-[2.2]" />;
      case 'partially_verified':
        return <AlertTriangle size={size} className="stroke-[2.2]" />;
      case 'discrepancy':
        return <XCircle size={size} className="stroke-[2.2]" />;
      case 'not_verified':
      default:
        return <ScanLine size={size} className="stroke-[1.8]" />;
    }
  };

  const getIconStyles = () => {
    switch (cfg.iconType) {
      case 'verified':
        return 'bg-emerald-50 text-emerald-600 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50';
      case 'partially_verified':
        return 'bg-amber-50 text-amber-600 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50 hover:bg-amber-100/70 dark:hover:bg-amber-900/50';
      case 'discrepancy':
        return 'bg-rose-50 text-rose-600 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50 hover:bg-rose-100/70 dark:hover:bg-rose-900/50';
      case 'not_verified':
      default:
        return 'bg-slate-100/90 text-slate-400 border-slate-200/80 dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-700/60 hover:bg-slate-200/70 dark:hover:bg-slate-700/60';
    }
  };

  if (showLabel) {
    return (
      <span
        title={cfg.label}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${cfg.badgeClass} ${className}`}
      >
        {renderIcon(13)}
        <span>{cfg.label}</span>
      </span>
    );
  }

  return (
    <span
      title={cfg.label}
      aria-label={cfg.label}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full border transition-all duration-150 cursor-help ${getIconStyles()} ${className}`}
    >
      {renderIcon(14)}
    </span>
  );
};
