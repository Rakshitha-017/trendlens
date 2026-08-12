import React from 'react';

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  className = 'h-12 w-full',
  count = 1
}) => {
  return (
    <div className="space-y-3 w-full animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-zinc-800/60 rounded-2xl border border-zinc-700/30 ${className}`}
        />
      ))}
    </div>
  );
};
