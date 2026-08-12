import React, { useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Camera, Paperclip, Square } from 'lucide-react';
import { AttachedFile } from '../../types';
import { UploadArea } from '../upload/UploadArea';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: (text?: string) => void;
  isLoading: boolean;
  onStopGenerating?: () => void;
  attachments: AttachedFile[];
  onRemoveAttachment: (id: string) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onOpenCamera: () => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  isDragging?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  isLoading,
  onStopGenerating,
  attachments,
  onRemoveAttachment,
  onAddFiles,
  onOpenCamera,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handlePaste,
  isDragging = false
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Auto-expand textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="w-full max-w-2xl space-y-2"
    >
      {/* Attachments preview & Drag target */}
      <UploadArea
        attachments={attachments}
        onRemove={onRemoveAttachment}
        onAddFiles={onAddFiles}
        isDragging={isDragging}
      />

      {/* Input Outer Card */}
      <div className="relative flex flex-col bg-[#FFFCF8] dark:bg-[#26221F] border border-[#E7DED2] dark:border-[#3E3832] focus-within:border-[#8A6A4A] dark:focus-within:border-[#C7D2C1] rounded-2xl p-2.5 shadow-[0_4px_20px_rgba(59,52,46,0.04)] transition-all">
        
        {/* Hidden File Inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => e.target.files && onAddFiles(e.target.files)}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.csv,.xlsx,.json,image/*"
          multiple
          onChange={(e) => e.target.files && onAddFiles(e.target.files)}
          className="hidden"
        />

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ask about a visual trend or upload an image..."
          rows={1}
          className="w-full bg-transparent text-sm text-[#3B342E] dark:text-[#F8F5F0] placeholder-[#7A736C]/60 dark:placeholder-[#A8A096]/60 focus:outline-none resize-none px-2 py-1 max-h-36 scrollbar-thin"
        />

        {/* Action Toolbar */}
        <div className="flex items-center justify-between pt-2 border-t border-[#E7DED2]/40 dark:border-[#3E3832]/40 mt-1">
          
          {/* Multimodal Media Buttons */}
          <div className="flex items-center gap-1">
            
            {/* Image Upload Button */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              aria-label="Upload image"
              title="Add image"
              className="p-1.5 rounded-xl hover:bg-[#F8F5F0] dark:hover:bg-[#1C1815] text-[#7A736C] dark:text-[#A8A096] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] transition-colors cursor-pointer"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            {/* Camera Capture Button */}
            <button
              type="button"
              onClick={onOpenCamera}
              aria-label="Open camera"
              title="Take photo"
              className="p-1.5 rounded-xl hover:bg-[#F8F5F0] dark:hover:bg-[#1C1815] text-[#7A736C] dark:text-[#A8A096] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Document / File Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach files"
              title="Attach documents or data"
              className="p-1.5 rounded-xl hover:bg-[#F8F5F0] dark:hover:bg-[#1C1815] text-[#7A736C] dark:text-[#A8A096] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] transition-colors cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          </div>

          {/* Send / Stop Button */}
          {isLoading && onStopGenerating ? (
            <button
              type="button"
              onClick={onStopGenerating}
              aria-label="Stop generating"
              className="px-3.5 py-1.5 rounded-xl bg-[#8A6A4A] hover:bg-[#73553A] text-[#FFFCF8] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSend()}
              disabled={(!input.trim() && attachments.length === 0) || isLoading}
              aria-label="Send message"
              className="px-4 py-1.5 rounded-xl bg-[#8A6A4A] hover:bg-[#73553A] disabled:opacity-30 text-[#FFFCF8] text-xs font-medium transition-all shrink-0 cursor-pointer shadow-2xs"
            >
              Send
            </button>
          )}

        </div>

      </div>
    </div>
  );
};
