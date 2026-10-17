import React, { type ComponentType } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';

export type SystemMetricColorScheme =
  | 'green'
  | 'orange'
  | 'red'
  | 'blue'
  | 'purple';

export interface SystemMetricCardProps {
  title: string;
  mobileTitle?: string;
  value: number | string;
  subtitle?: string;
  /** Alias for subtitle — trend.value is used as the subtitle text */
  trend?: { value: string; isPositive?: boolean };
  icon?: ComponentType<{ className?: string; strokeWidth?: number; size?: number }>;
  colorScheme?: SystemMetricColorScheme;
  isActive?: boolean;
  tooltip?: string;
  onClick?: () => void;
  className?: string;
}

export const SystemMetricCard: React.FC<SystemMetricCardProps> = ({
  title,
  mobileTitle,
  value,
  subtitle,
  trend,
  icon: Icon,
  colorScheme = 'blue',
  isActive = false,
  tooltip,
  onClick,
  className = '',
}) => {
  // Resolve subtitle: explicit subtitle wins, otherwise use trend.value
  const resolvedSubtitle = subtitle ?? trend?.value;

  const schemes: Record<
    SystemMetricColorScheme,
    {
      borderActive: string;
      borderInactive: string;
      bgActive: string;
      bgInactive: string;
      iconColor: string;
      textColor: string;
    }
  > = {
    green: {
      borderActive: 'border-green-500 ring-2 ring-green-500/20',
      borderInactive:
        'border-gray-100 dark:border-gray-800 hover:border-green-300 dark:hover:border-green-900/50',
      bgActive: 'bg-green-500/20',
      bgInactive: 'bg-green-500/10',
      iconColor: 'text-green-500',
      textColor: 'text-green-500',
    },
    orange: {
      borderActive: 'border-orange-500 ring-2 ring-orange-500/20',
      borderInactive:
        'border-gray-100 dark:border-gray-800 hover:border-orange-300 dark:hover:border-orange-900/50',
      bgActive: 'bg-orange-500/20',
      bgInactive: 'bg-orange-500/10',
      iconColor: 'text-orange-500',
      textColor: 'text-orange-500',
    },
    red: {
      borderActive: 'border-red-500 ring-2 ring-red-500/20',
      borderInactive:
        'border-gray-100 dark:border-gray-800 hover:border-red-300 dark:hover:border-red-900/50',
      bgActive: 'bg-red-500/20',
      bgInactive: 'bg-red-500/10',
      iconColor: 'text-red-500',
      textColor: 'text-red-500',
    },
    blue: {
      borderActive: 'border-blue-500 ring-2 ring-blue-500/20',
      borderInactive:
        'border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-900/50',
      bgActive: 'bg-blue-500/20',
      bgInactive: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      textColor: 'text-blue-500',
    },
    purple: {
      borderActive: 'border-purple-500 ring-2 ring-purple-500/20',
      borderInactive:
        'border-gray-100 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-900/50',
      bgActive: 'bg-purple-500/20',
      bgInactive: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
      textColor: 'text-purple-500',
    },
  };

  const scheme = schemes[colorScheme] || schemes.blue;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full text-left bg-white dark:bg-[#161922] border rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 flex flex-col justify-between relative shadow-2xs transition-all ${
        onClick ? 'cursor-pointer hover:border-[#5865f2]/50 group' : 'cursor-default'
      } ${isActive ? scheme.borderActive : scheme.borderInactive} ${className}`}
    >
      {/* Top Header Row: Icon + Title */}
      <div className="flex items-center justify-between w-full min-w-0 gap-1.5 mb-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {Icon && (
            <div
              className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${
                isActive ? scheme.bgActive : scheme.bgInactive
              }`}
            >
              <Icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${scheme.iconColor}`} strokeWidth={2} />
            </div>
          )}
          <span className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
            {mobileTitle || title}
          </span>
        </div>
        {tooltip && (
          <div className="relative group/tooltip hidden sm:flex items-center shrink-0">
            <Info size={11} className="text-gray-400 cursor-help" />
            <div className="absolute top-full right-0 mt-1 w-max max-w-[180px] p-1.5 bg-gray-800 text-gray-100 text-[10px] rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-[100] text-center pointer-events-none whitespace-normal leading-relaxed">
              {tooltip}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row: Value & Subtitle */}
      <div className="flex items-baseline justify-between gap-1 w-full min-w-0">
        <span className="text-[13px] xs:text-[14px] sm:text-[16px] font-bold text-gray-900 dark:text-white truncate tracking-tight leading-tight">
          <motion.div
            key={String(value)}
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="inline-block truncate max-w-full"
          >
            {value}
          </motion.div>
        </span>
        {resolvedSubtitle && (
          <span
            className={`text-[9px] sm:text-[10px] font-medium truncate shrink-0 ml-1 hidden xs:inline-block ${
              isActive ? scheme.textColor : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {resolvedSubtitle}
          </span>
        )}
      </div>
    </button>
  );
};

export interface CompactMetricItem {
  icon?: ComponentType<{ className?: string }>;
  color?: string;
  label: string;
  value: number | string;
  subtitle?: string;
}

export interface SystemCompactMetricsBarProps {
  items?: CompactMetricItem[];
  onToggleExpand?: () => void;
}

export const SystemCompactMetricsBar: React.FC<SystemCompactMetricsBarProps> = ({
  items = [],
  onToggleExpand,
}) => {
  return (
    <div className="w-full bg-white dark:bg-[#1a1b23] border border-gray-100 dark:border-gray-800 rounded px-4 py-2.5 flex items-center justify-between gap-4 shadow-none mb-6 transition-colors">
      <div className="flex items-center gap-4 flex-wrap text-[13px] font-medium overflow-x-auto custom-scrollbar-autohide py-0.5">
        {items.map((item, idx) => {
          const ItemIcon = item.icon;
          return (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <span className="text-gray-200 dark:text-gray-700 font-normal">
                  |
                </span>
              )}
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                {ItemIcon && (
                  <ItemIcon
                    className={`w-4 h-4 ${item.color || 'text-gray-400'}`}
                  />
                )}
                <span className="text-gray-500 dark:text-gray-400">
                  {item.label}:
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {item.value}
                </span>
                {item.subtitle && (
                  <span className="text-[11px] text-gray-400 ml-0.5">
                    ({item.subtitle})
                  </span>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <button
        onClick={onToggleExpand}
        className="h-7 px-3 bg-gray-50 dark:bg-[#1c212a] hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors text-[12px] font-medium cursor-pointer flex items-center gap-1 shrink-0 ml-2 shadow-none"
      >
        <span>Mở rộng</span>
        <svg
          className="w-3.5 h-3.5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    </div>
  );
};
