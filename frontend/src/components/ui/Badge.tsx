import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon
}) => {
  const baseStyles = 'inline-flex items-center font-medium tracking-wide rounded-full border transition-colors';

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2'
  };

  const variantStyles = {
    primary: 'bg-purple-950/80 text-purple-300 border-purple-700/50 shadow-sm shadow-purple-900/30',
    secondary: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/50 shadow-sm shadow-cyan-900/30',
    success: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50 shadow-sm shadow-emerald-900/30',
    warning: 'bg-amber-950/80 text-amber-300 border-amber-700/50 shadow-sm shadow-amber-900/30',
    error: 'bg-rose-950/80 text-rose-300 border-rose-700/50 shadow-sm shadow-rose-900/30',
    outline: 'bg-zinc-900/60 text-zinc-300 border-zinc-700/60',
    ghost: 'bg-zinc-800/40 text-zinc-400 border-transparent'
  };

  return (
    <span className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
