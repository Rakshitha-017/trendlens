import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle light/dark theme"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className={`p-2 rounded-xl border border-[#E7DED2] dark:border-[#3E3832] bg-[#FFFCF8] dark:bg-[#26221F] text-[#7A736C] dark:text-[#A8A096] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] hover:border-[#8A6A4A]/50 transition-all cursor-pointer shadow-sm ${className}`}
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4 text-[#73553A]" />
      ) : (
        <Sun className="w-4 h-4 text-[#C7D2C1]" />
      )}
    </button>
  );
};
