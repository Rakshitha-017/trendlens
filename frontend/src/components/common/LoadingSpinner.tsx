import React from 'react';

export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; label?: string }> = ({
  size = 'md',
  label
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3'
  };

  return (
    <div className="inline-flex items-center gap-2.5">
      <div
        className={`${sizeClasses[size]} rounded-full border-[#E7DED2] dark:border-[#3E3832] border-t-[#8A6A4A] dark:border-t-[#C7D2C1] animate-spin`}
      />
      {label && <span className="text-xs text-[#7A736C] dark:text-[#A8A096]">{label}</span>}
    </div>
  );
};
