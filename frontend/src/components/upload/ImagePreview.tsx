import React, { useState } from 'react';
import { X, Eye } from 'lucide-react';
import { AttachedFile } from '../../types';

interface ImagePreviewProps {
  file: AttachedFile;
  onRemove?: (id: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  file,
  onRemove,
  size = 'md'
}) => {
  const [showModal, setShowModal] = useState(false);

  const dimensionClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32'
  };

  return (
    <>
      <div className={`relative group shrink-0 ${dimensionClasses[size]} rounded-xl overflow-hidden border border-[#E7DED2] dark:border-[#3E3832] bg-[#FFFCF8] dark:bg-[#26221F] shadow-sm`}>
        <img
          src={file.url || file.previewUrl}
          alt={file.name}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 backdrop-blur-[1px]">
          <button
            onClick={() => setShowModal(true)}
            aria-label="View large image"
            className="p-1 rounded-full bg-white/80 text-[#3B342E] hover:bg-white transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {onRemove && (
            <button
              onClick={() => onRemove(file.id)}
              aria-label="Remove image"
              className="p-1 rounded-full bg-white/80 text-[#3B342E] hover:bg-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Fullscreen Modal View */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden border border-[#E7DED2]/20 shadow-2xl bg-[#FFFCF8] dark:bg-[#26221F]">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={file.url || file.previewUrl}
              alt={file.name}
              className="w-full h-full object-contain max-h-[80vh]"
            />
            <div className="p-3 bg-[#FFFCF8] dark:bg-[#26221F] text-xs text-[#7A736C] dark:text-[#A8A096] border-t border-[#E7DED2] dark:border-[#3E3832]">
              {file.name}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
