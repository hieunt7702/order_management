import React, { type HTMLAttributes, type ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`rounded border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1c212a] ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
};
