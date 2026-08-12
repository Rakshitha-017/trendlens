import React from 'react';
import { motion } from 'framer-motion';
import Markdown from 'react-markdown';
import { ChatMessage } from '../../types';
import { MessageToolbar } from './MessageToolbar';
import { ImagePreview } from '../upload/ImagePreview';
import { FileCard } from '../upload/FileCard';

interface MessageBubbleProps {
  message: ChatMessage;
  onRegenerate?: () => void;
  onRetry?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onRegenerate,
  onRetry
}) => {
  const isUser = message.sender === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`w-full ${isUser ? 'flex justify-end' : 'flex justify-start'}`}
    >
      <div
        className={`max-w-xl w-full p-5 sm:p-6 rounded-2xl border transition-all ${
          isUser
            ? 'bg-[#8A6A4A] text-[#FFFCF8] border-[#73553A] shadow-xs ml-auto max-w-lg'
            : 'bg-[#FFFCF8] dark:bg-[#26221F] text-[#3B342E] dark:text-[#F8F5F0] border-[#E7DED2] dark:border-[#3E3832] shadow-[0_2px_12px_rgba(59,52,46,0.03)]'
        }`}
      >
        {/* Card Header Label */}
        <div className="flex items-center justify-between mb-2.5">
          <span
            className={`text-xs font-medium uppercase tracking-wider ${
              isUser ? 'text-[#E7DED2]' : 'text-[#7A736C] dark:text-[#A8A096]'
            }`}
          >
            {isUser ? 'You' : 'TrendLens'}
          </span>
          <span
            className={`text-[11px] ${
              isUser ? 'text-[#E7DED2]/80' : 'text-[#7A736C]/70 dark:text-[#A8A096]/70'
            }`}
          >
            {message.timestamp}
          </span>
        </div>

        {/* Attachments Display (Images, Documents, Data) */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3 pt-1">
            {message.attachments.map((file) => (
              <React.Fragment key={file.id}>
                {file.category === 'image' ? (
                  <ImagePreview file={file} size="sm" />
                ) : (
                  <FileCard file={file} compact />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Message Content Body */}
        <div
          className={`text-sm sm:text-base leading-relaxed ${
            isUser ? 'text-[#FFFCF8]' : 'text-[#3B342E] dark:text-[#F8F5F0]'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-stone dark:prose-invert max-w-none text-sm sm:text-base leading-relaxed">
              <Markdown>{message.content}</Markdown>
            </div>
          )}
        </div>

        {/* Toolbar (Copy, Read aloud, Regenerate) */}
        <MessageToolbar
          content={message.content}
          messageId={message.id}
          isUser={isUser}
          onRegenerate={onRegenerate}
          onRetry={onRetry}
        />
      </div>
    </motion.div>
  );
};
