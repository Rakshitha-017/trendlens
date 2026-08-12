import React, { useState } from 'react';
import { Copy, Check, Volume2, VolumeX, RefreshCw, RotateCcw } from 'lucide-react';
import { useSpeech } from '../../hooks/useSpeech';

interface MessageToolbarProps {
  content: string;
  messageId: string;
  onRegenerate?: () => void;
  onRetry?: () => void;
  isUser?: boolean;
}

export const MessageToolbar: React.FC<MessageToolbarProps> = ({
  content,
  messageId,
  onRegenerate,
  onRetry,
  isUser = false
}) => {
  const [copied, setCopied] = useState(false);
  const { isSpeaking, activeMessageId, speak, stop } = useSpeech();

  const isCurrentSpeaking = isSpeaking && activeMessageId === messageId;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeechToggle = () => {
    if (isCurrentSpeaking) {
      stop();
    } else {
      speak(content, messageId);
    }
  };

  return (
    <div className={`flex items-center gap-1 mt-2 text-[11px] ${isUser ? 'justify-end text-[#E7DED2]' : 'text-[#7A736C] dark:text-[#A8A096]'}`}>
      
      {/* Copy Text Button */}
      <button
        onClick={handleCopy}
        aria-label="Copy message text"
        title="Copy text"
        className="p-1 rounded hover:bg-[#E7DED2]/40 dark:hover:bg-[#3E3832] transition-colors cursor-pointer"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Text-to-Speech Button (Assistant responses) */}
      {!isUser && (
        <button
          onClick={handleSpeechToggle}
          aria-label={isCurrentSpeaking ? 'Stop reading' : 'Read message aloud'}
          title={isCurrentSpeaking ? 'Stop reading' : 'Listen to message'}
          className={`p-1 rounded transition-colors cursor-pointer ${
            isCurrentSpeaking
              ? 'text-[#8A6A4A] dark:text-[#C7D2C1] bg-[#8A6A4A]/10 font-bold'
              : 'hover:bg-[#E7DED2]/40 dark:hover:bg-[#3E3832]'
          }`}
        >
          {isCurrentSpeaking ? (
            <VolumeX className="w-3.5 h-3.5 animate-pulse text-[#8A6A4A] dark:text-[#C7D2C1]" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </button>
      )}

      {/* Regenerate Button */}
      {!isUser && onRegenerate && (
        <button
          onClick={onRegenerate}
          aria-label="Regenerate response"
          title="Regenerate response"
          className="p-1 rounded hover:bg-[#E7DED2]/40 dark:hover:bg-[#3E3832] transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Retry Button (User) */}
      {isUser && onRetry && (
        <button
          onClick={onRetry}
          aria-label="Retry message"
          title="Retry message"
          className="p-1 rounded hover:bg-[#73553A] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}

    </div>
  );
};
