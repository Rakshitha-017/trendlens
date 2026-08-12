import React from 'react';
import { FileText, FileSpreadsheet, FileCode, Music, File, X } from 'lucide-react';
import { AttachedFile } from '../../types';

interface FileCardProps {
  file: AttachedFile;
  onRemove?: (id: string) => void;
  compact?: boolean;
}

export const FileCard: React.FC<FileCardProps> = ({ file, onRemove, compact = false }) => {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) {
      return <FileSpreadsheet className="w-4 h-4 text-[#8A6A4A] dark:text-[#C7D2C1]" />;
    }
    if (file.name.endsWith('.json') || file.name.endsWith('.js') || file.name.endsWith('.ts')) {
      return <FileCode className="w-4 h-4 text-[#8A6A4A] dark:text-[#C7D2C1]" />;
    }
    if (file.category === 'audio') {
      return <Music className="w-4 h-4 text-[#8A6A4A] dark:text-[#C7D2C1]" />;
    }
    if (file.type.includes('pdf') || file.name.endsWith('.txt') || file.name.endsWith('.docx')) {
      return <FileText className="w-4 h-4 text-[#8A6A4A] dark:text-[#C7D2C1]" />;
    }
    return <File className="w-4 h-4 text-[#8A6A4A] dark:text-[#C7D2C1]" />;
  };

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FFFCF8] dark:bg-[#26221F] border border-[#E7DED2] dark:border-[#3E3832] text-xs text-[#3B342E] dark:text-[#F8F5F0]">
        {getFileIcon()}
        <span className="truncate max-w-[120px] font-medium">{file.name}</span>
        {onRemove && (
          <button
            onClick={() => onRemove(file.id)}
            className="p-0.5 rounded-md hover:bg-[#E7DED2]/50 dark:hover:bg-[#3E3832] text-[#7A736C] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#FFFCF8] dark:bg-[#26221F] border border-[#E7DED2] dark:border-[#3E3832] text-xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-2 rounded-lg bg-[#F8F5F0] dark:bg-[#1C1815] border border-[#E7DED2] dark:border-[#3E3832]">
          {getFileIcon()}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-[#3B342E] dark:text-[#F8F5F0] truncate">{file.name}</p>
          <p className="text-[10px] text-[#7A736C] dark:text-[#A8A096]">{formatSize(file.size)}</p>
        </div>
      </div>

      {onRemove && (
        <button
          onClick={() => onRemove(file.id)}
          aria-label={`Remove file ${file.name}`}
          className="p-1 rounded-lg hover:bg-[#E7DED2]/50 dark:hover:bg-[#3E3832] text-[#7A736C] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
