import React from 'react';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start w-full">
      <div className="p-4 rounded-2xl bg-[#FFFCF8] dark:bg-[#26221F] border border-[#E7DED2] dark:border-[#3E3832] text-[#7A736C] dark:text-[#A8A096] text-xs flex items-center gap-3 shadow-[0_2px_12px_rgba(59,52,46,0.03)]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8A6A4A] dark:bg-[#C7D2C1] animate-pulse" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#8A6A4A] dark:bg-[#C7D2C1] animate-pulse delay-150" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#8A6A4A] dark:bg-[#C7D2C1] animate-pulse delay-300" />
        </div>
        <span className="text-xs">Gathering visual insights...</span>
      </div>
    </div>
  );
};
