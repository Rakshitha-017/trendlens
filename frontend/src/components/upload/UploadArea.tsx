import React, { useRef } from 'react';
import { Upload, Image as ImageIcon, FileText } from 'lucide-react';
import { AttachedFile } from '../../types';
import { ImagePreview } from './ImagePreview';
import { FileCard } from './FileCard';

interface UploadAreaProps {
  attachments: AttachedFile[];
  onRemove: (id: string) => void;
  onAddFiles: (files: FileList | File[]) => void;
  isDragging?: boolean;
}

export const UploadArea: React.FC<UploadAreaProps> = ({
  attachments,
  onRemove,
  onAddFiles,
  isDragging = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (attachments.length === 0 && !isDragging) {
    return null;
  }

  return (
    <div className="w-full space-y-2 mb-2">
      {/* Drag Overlay visual feedback */}
      {isDragging && (
        <div className="p-4 rounded-2xl border-2 border-dashed border-[#8A6A4A] dark:border-[#C7D2C1] bg-[#8A6A4A]/5 dark:bg-[#C7D2C1]/10 flex items-center justify-center gap-2 text-xs font-medium text-[#8A6A4A] dark:text-[#C7D2C1] transition-all">
          <Upload className="w-4 h-4 animate-bounce" />
          <span>Drop files here to attach (Images, Documents, Data)</span>
        </div>
      )}

      {/* Attachment Badges Grid */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-[#FFFCF8] dark:bg-[#26221F] border border-[#E7DED2] dark:border-[#3E3832] shadow-sm">
          {attachments.map((file) => (
            <React.Fragment key={file.id}>
              {file.category === 'image' ? (
                <ImagePreview file={file} onRemove={onRemove} size="sm" />
              ) : (
                <FileCard file={file} onRemove={onRemove} compact />
              )}
            </React.Fragment>
          ))}

          {/* Hidden File Input Trigger */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.docx,.txt,.csv,.xlsx,.json"
            onChange={(e) => e.target.files && onAddFiles(e.target.files)}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 rounded-xl border border-dashed border-[#E7DED2] dark:border-[#3E3832] text-[11px] text-[#7A736C] dark:text-[#A8A096] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] hover:border-[#8A6A4A] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Upload className="w-3 h-3" />
            <span>Add more</span>
          </button>
        </div>
      )}
    </div>
  );
};
