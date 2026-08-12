import { useState, useCallback } from 'react';
import { AttachedFile } from '../types';

export interface UseUploadResult {
  attachments: AttachedFile[];
  isDragging: boolean;
  addFiles: (files: FileList | File[]) => Promise<void>;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
}

export function useUpload(): UseUploadResult {
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback(async (incomingFiles: FileList | File[]) => {
    const fileArray = Array.from(incomingFiles);
    if (fileArray.length === 0) return;

    const newAttachments: AttachedFile[] = await Promise.all(
      fileArray.map(async (file, idx) => {
        const id = `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const isImage = file.type.startsWith('image/');
        const isAudio = file.type.startsWith('audio/');
        const isData = file.name.endsWith('.csv') || file.name.endsWith('.json') || file.name.endsWith('.xlsx');

        let category: AttachedFile['category'] = 'document';
        if (isImage) category = 'image';
        else if (isAudio) category = 'audio';
        else if (isData) category = 'data';

        let url = '';
        if (isImage) {
          url = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string || '');
            reader.readAsDataURL(file);
          });
        } else {
          url = URL.createObjectURL(file);
        }

        return {
          id,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url,
          previewUrl: isImage ? url : undefined,
          fileObject: file,
          progress: 100,
          category
        };
      })
    );

    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target && target.url && !target.url.startsWith('data:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    attachments.forEach((item) => {
      if (item.url && !item.url.startsWith('data:')) {
        URL.revokeObjectURL(item.url);
      }
    });
    setAttachments([]);
  }, [attachments]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      addFiles(e.clipboardData.files);
    }
  }, [addFiles]);

  return {
    attachments,
    isDragging,
    addFiles,
    removeAttachment,
    clearAttachments,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste
  };
}
