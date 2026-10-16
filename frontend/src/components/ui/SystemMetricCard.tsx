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
      className={`w-full text-left bg-white dark:bg-[#1a1b23] border rounded p-3 sm:p-4 flex items-center gap-2.5 sm:gap-4 relative shadow-none transition-all ${
        onClick ? 'cursor-pointer group' : 'cursor-default'
      } ${isActive ? scheme.borderActive : scheme.borderInactive} ${className}`}
    >
      <div
        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          isActive ? scheme.bgActive : scheme.bgInactive
        }`}
      >
        {Icon && (
          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${scheme.iconColor}`} strokeWidth={2} />
        )}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 relative z-10">
          <span className="text-xs sm:text-[13px] text-gray-500 dark:text-gray-400 font-medium truncate">
            {title}
          </span>
          {tooltip && (
            <div className="relative group/tooltip flex items-center">
              <Info size={13} className="text-gray-400 cursor-help" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-[200px] p-2 bg-gray-800 text-gray-100 text-[11px] rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-[100] text-center pointer-events-none whitespace-normal leading-relaxed">
                {tooltip}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-0.5 border-4 border-transparent border-b-gray-800" />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-xl sm:text-[24px] xl:text-[28px] leading-none font-bold text-gray-900 dark:text-white truncate inline-block">
            <motion.div
              key={String(value)}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="inline-block"
            >
              {value}
            </motion.div>
          </span>
        </div>
        {resolvedSubtitle && (
          <span
            className={`text-[11px] sm:text-[12px] font-medium mt-1 sm:mt-1.5 truncate ${
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
