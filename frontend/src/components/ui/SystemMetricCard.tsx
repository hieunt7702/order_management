import React, { type ComponentType } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';

export type SystemMetricColorScheme =
  | 'green'
  | 'orange'
  | 'red'
  | 'blue'
  | 'purple'
  | 'indigo';

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

export interface MetricItemProps {
  title: string;
  mobileTitle?: string;
  value: number | string;
  subtitle?: string;
  icon?: ComponentType<{ className?: string; strokeWidth?: number; size?: number }>;
  colorScheme?: SystemMetricColorScheme;
  isActive?: boolean;
  tooltip?: string;
  onClick?: () => void;
  className?: string;
}

export interface SystemMetricPairCardProps {
  leftItem: MetricItemProps;
  rightItem: MetricItemProps;
  className?: string;
}

const schemes: Record<
  SystemMetricColorScheme,
  {
    borderActive: string;
    borderInactive: string;
    circleActive: string;
    circleInactive: string;
    indicatorColor: string;
    iconColor: string;
    textColor: string;
  }
> = {
  green: {
    borderActive: 'border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-500/[0.03]',
    borderInactive:
      'border-gray-200/60 dark:border-white/[0.08] hover:border-emerald-300 dark:hover:border-emerald-900/50',
    circleActive: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500',
    circleInactive:
      'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/25 dark:border-emerald-500/30 text-emerald-500 dark:text-emerald-400',
    indicatorColor: 'bg-emerald-500',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
    textColor: 'text-emerald-500',
  },
  orange: {
    borderActive: 'border-amber-500 ring-1 ring-amber-500/20 bg-amber-500/[0.03]',
    borderInactive:
      'border-gray-200/60 dark:border-white/[0.08] hover:border-amber-300 dark:hover:border-amber-900/50',
    circleActive: 'bg-amber-500/20 border-amber-500/40 text-amber-500',
    circleInactive:
      'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/25 dark:border-amber-500/30 text-amber-500 dark:text-amber-400',
    indicatorColor: 'bg-amber-500',
    iconColor: 'text-amber-500 dark:text-amber-400',
    textColor: 'text-amber-500',
  },
  red: {
    borderActive: 'border-rose-500 ring-1 ring-rose-500/20 bg-rose-500/[0.03]',
    borderInactive:
      'border-gray-200/60 dark:border-white/[0.08] hover:border-rose-300 dark:hover:border-rose-900/50',
    circleActive: 'bg-rose-500/20 border-rose-500/40 text-rose-500',
    circleInactive:
      'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/25 dark:border-rose-500/30 text-rose-500 dark:text-rose-400',
    indicatorColor: 'bg-rose-500',
    iconColor: 'text-rose-500 dark:text-rose-400',
    textColor: 'text-rose-500',
  },
  blue: {
    borderActive: 'border-blue-500 ring-1 ring-blue-500/20 bg-blue-500/[0.03]',
    borderInactive:
      'border-gray-200/60 dark:border-white/[0.08] hover:border-blue-300 dark:hover:border-blue-900/50',
    circleActive: 'bg-blue-500/20 border-blue-500/40 text-blue-500',
    circleInactive:
      'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/25 dark:border-blue-500/30 text-blue-500 dark:text-blue-400',
    indicatorColor: 'bg-blue-500',
    iconColor: 'text-blue-500 dark:text-blue-400',
    textColor: 'text-blue-500',
  },
  purple: {
    borderActive: 'border-purple-500 ring-1 ring-purple-500/20 bg-purple-500/[0.03]',
    borderInactive:
      'border-gray-200/60 dark:border-white/[0.08] hover:border-purple-300 dark:hover:border-purple-900/50',
    circleActive: 'bg-purple-500/20 border-purple-500/40 text-purple-500',
    circleInactive:
      'bg-purple-500/10 dark:bg-purple-500/15 border-purple-500/25 dark:border-purple-500/30 text-purple-500 dark:text-purple-400',
    indicatorColor: 'bg-purple-500',
    iconColor: 'text-purple-500 dark:text-purple-400',
    textColor: 'text-purple-500',
  },
  indigo: {
    borderActive: 'border-indigo-500 ring-1 ring-indigo-500/20 bg-indigo-500/[0.03]',
    borderInactive:
      'border-gray-200/60 dark:border-white/[0.08] hover:border-indigo-300 dark:hover:border-indigo-900/50',
    circleActive: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-500',
    circleInactive:
      'bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/25 dark:border-indigo-500/30 text-indigo-500 dark:text-indigo-400',
    indicatorColor: 'bg-indigo-500',
    iconColor: 'text-indigo-500 dark:text-indigo-400',
    textColor: 'text-indigo-500',
  },
};

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
  const resolvedSubtitle = subtitle ?? trend?.value;
  const scheme = schemes[colorScheme] || schemes.blue;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full text-left bg-white dark:bg-[#161922] border rounded-[4px] px-3 py-2.5 flex items-center justify-between gap-2.5 relative shadow-none transition-all ${
        onClick ? 'cursor-pointer hover:border-[#5865f2]/50 group' : 'cursor-default'
      } ${isActive ? scheme.borderActive : scheme.borderInactive} ${className}`}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        {Icon && (
          <div
            className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
              isActive ? scheme.circleActive : scheme.circleInactive
            }`}
          >
            <Icon className={`w-4 h-4 ${scheme.iconColor}`} strokeWidth={1.8} />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium truncate leading-tight">
            {mobileTitle || title}
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-[15px] sm:text-[17px] font-bold text-gray-900 dark:text-white truncate tracking-tight leading-tight">
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
                className={`text-[10px] font-medium truncate shrink-0 hidden xs:inline-block ${
                  isActive ? scheme.textColor : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {resolvedSubtitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {tooltip && (
        <div className="relative group/tooltip hidden sm:flex items-center shrink-0 self-start mt-0.5">
          <Info size={11} className="text-gray-400 cursor-help" />
          <div className="absolute top-full right-0 mt-1 w-max max-w-[180px] p-1.5 bg-gray-800 text-gray-100 text-[10px] rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-[100] text-center pointer-events-none whitespace-normal leading-relaxed">
            {tooltip}
          </div>
        </div>
      )}
    </button>
  );
};

const SystemMetricHalfItem: React.FC<{ item: MetricItemProps }> = ({ item }) => {
  const scheme = schemes[item.colorScheme || 'blue'] || schemes.blue;
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={item.onClick}
      disabled={!item.onClick}
      className={`px-3 py-2.5 sm:px-3.5 sm:py-2.5 flex items-center gap-2.5 sm:gap-3 text-left transition-colors relative min-w-0 flex-1 ${
        item.onClick ? 'cursor-pointer hover:bg-gray-50/80 dark:hover:bg-white/[0.03]' : 'cursor-default'
      } ${item.isActive ? 'bg-gray-100/70 dark:bg-white/[0.05]' : ''} ${item.className || ''}`}
    >
      {/* Active Indicator Bar on left */}
      {item.isActive && (
        <span
          className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r ${scheme.indicatorColor}`}
        />
      )}

      {/* Circular Icon Badge */}
      {Icon && (
        <div
          className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
            item.isActive ? scheme.circleActive : scheme.circleInactive
          }`}
        >
          <Icon className={`w-4 h-4 ${scheme.iconColor}`} strokeWidth={1.8} />
        </div>
      )}

      {/* Text Column */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium truncate leading-tight">
          {item.mobileTitle || item.title}
        </span>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-[15px] sm:text-[17px] font-bold text-gray-900 dark:text-white truncate tracking-tight leading-tight">
            <motion.div
              key={String(item.value)}
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="inline-block truncate max-w-full"
            >
              {item.value}
            </motion.div>
          </span>
          {item.subtitle && (
            <span
              className={`text-[10px] font-medium truncate shrink-0 hidden xs:inline-block ${
                item.isActive ? scheme.textColor : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {item.subtitle}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export const SystemMetricPairCard: React.FC<SystemMetricPairCardProps> = ({
  leftItem,
  rightItem,
  className = '',
}) => {
  return (
    <div
      className={`w-full bg-white dark:bg-[#161922] border border-gray-200/60 dark:border-white/[0.08] rounded-[4px] grid grid-cols-2 divide-x divide-gray-200/60 dark:divide-white/[0.08] overflow-hidden shadow-none transition-colors ${className}`}
    >
      <SystemMetricHalfItem item={leftItem} />
      <SystemMetricHalfItem item={rightItem} />
    </div>
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
