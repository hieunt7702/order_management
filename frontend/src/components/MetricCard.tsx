import React, { type ComponentType } from 'react';
import { Card } from './Card';
import { formatCurrency } from '../utils';

export interface MetricCardProps {
  layout?: 'primary' | 'secondary';
  title: string;
  value: number | string;
  subtext?: string;
  icon?: ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  iconBgColor?: string;
  iconColor?: string;
  trend?: string;
  isCurrency?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  layout = 'primary',
  title,
  value,
  subtext,
  icon: Icon,
  iconBgColor = '',
  iconColor = '',
  trend,
  isCurrency = false,
}) => {
  const displayValue = isCurrency ? formatCurrency(value) : value;

  if (layout === 'primary') {
    return (
      <Card className="flex flex-col justify-center p-5 rounded border border-white/5 bg-[#1c212a] transition-all duration-300">
        <div className="flex items-center gap-4">
          {Icon && (
            <div
              className={`w-12 h-12 rounded flex items-center justify-center shrink-0 ${iconBgColor}`}
            >
              <Icon className={iconColor} size={24} strokeWidth={2.5} />
            </div>
          )}
          <div>
            <h3 className="text-[13px] font-medium text-gray-400 flex items-center gap-1.5">
              {title}
              <span
                className="w-3.5 h-3.5 rounded border border-gray-600 flex items-center justify-center text-[9px] text-gray-500 cursor-help"
                title="Thông tin chi tiết"
              >
                ?
              </span>
            </h3>
            <h3 className="text-2xl font-bold tracking-tight text-white mt-1 flex items-baseline gap-1.5">
              {displayValue}{' '}
              {isCurrency && (
                <span className="text-[14px] font-semibold text-gray-400">đ</span>
              )}
            </h3>
          </div>
        </div>
        {subtext && trend && (
          <p className="text-[12px] text-gray-500 mt-4 ml-16 flex items-center gap-1.5">
            {subtext}{' '}
            <span className="text-emerald-400 font-medium">⬆ {trend}</span>
          </p>
        )}
      </Card>
    );
  }

  // Secondary Layout
  return (
    <Card className="flex flex-col justify-center p-4 rounded border border-white/5 bg-[#1c212a] transition-all duration-300">
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className={`w-12 h-12 rounded flex items-center justify-center shrink-0 ${iconBgColor}`}
          >
            <Icon className={iconColor} size={24} strokeWidth={2.5} />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-[12px] font-medium text-gray-400">{title}</h3>
          <h3 className="text-[20px] font-bold text-white mt-0.5 flex items-baseline gap-1.5">
            {displayValue}{' '}
            {isCurrency && (
              <span className="text-[12px] font-medium text-gray-400">đ</span>
            )}
          </h3>
        </div>
      </div>
      {subtext && <p className="text-[12px] text-gray-500 mt-2">{subtext}</p>}
    </Card>
  );
};
