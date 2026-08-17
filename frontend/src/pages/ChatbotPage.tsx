import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';

import { useChat } from '../hooks/useChat';
import { useUpload } from '../hooks/useUpload';
import { Sidebar } from '../components/sidebar/Sidebar';
import { MessageBubble } from '../components/chat/MessageBubble';
import { ChatInput } from '../components/chat/ChatInput';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { CameraCapture } from '../components/camera/CameraCapture';
import { ThemeToggle } from '../components/common/ThemeToggle';

export const ChatbotPage: React.FC = () => {
  const navigate = useNavigate();

  const {
    conversations,
    activeChat,
    activeChatId,
    setActiveChatId,
    isLoading,
    searchQuery,
    setSearchQuery,
    createNewChat,
    deleteChat,
    renameChat,
    sendMessage,
    isSidebarOpen,
    setIsSidebarOpen
  } = useChat();

  const {
    attachments,
    isDragging,
    addFiles,
    removeAttachment,
    clearAttachments,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste
  } = useUpload();

  const [input, setInput] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = [
    'What food photography trends are rising in engagement right now?',
    'I am a fashion content creator — what lighting and colour palette is trending?',
    'What visual styles are most viral in travel photography?',
    'Show me declining nightlife aesthetics I should avoid.',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : input).trim();
    if (!text && attachments.length === 0) return;

    const currentAttachments = [...attachments];
    if (textToSend === undefined) setInput('');
    clearAttachments();

    await sendMessage(text, currentAttachments);
  };

  const handleCameraCapture = async (imageDataUrl: string) => {
    // Convert data URL to blob & File
    const res = await fetch(imageDataUrl);
    const blob = await res.blob();
    const file = new File([blob], `camera-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
    await addFiles([file]);
  };

  const currentMessages = activeChat?.messages || [];

  return (
    <div className="min-h-screen bg-[#F8F5F0] dark:bg-[#1C1815] text-[#3B342E] dark:text-[#F8F5F0] flex w-full overflow-x-hidden selection:bg-[#C7D2C1]">
      
      {/* Sidebar Navigation */}
      <Sidebar
        conversations={conversations}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={createNewChat}
        onRenameChat={renameChat}
        onDeleteChat={deleteChat}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Header Bar */}
        <header className="w-full px-4 sm:px-6 py-4 flex items-center justify-between border-b border-[#E7DED2]/60 dark:border-[#3E3832]/60 bg-[#F8F5F0]/80 dark:bg-[#1C1815]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Toggle sidebar"
              className="p-2 rounded-xl border border-[#E7DED2] dark:border-[#3E3832] bg-[#FFFCF8] dark:bg-[#26221F] text-[#7A736C] dark:text-[#A8A096] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] md:hidden cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              onClick={() => navigate('/')}
              className="font-serif text-2xl font-medium tracking-tight text-[#3B342E] dark:text-[#F8F5F0] hover:opacity-80 transition-opacity cursor-pointer"
            >
              {activeChat ? activeChat.title : 'TrendLens'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={createNewChat}
              className="px-3.5 py-1.5 rounded-xl border border-[#E7DED2] dark:border-[#3E3832] bg-[#FFFCF8] dark:bg-[#26221F] text-xs font-medium text-[#7A736C] dark:text-[#A8A096] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] transition-colors cursor-pointer hidden sm:block"
            >
              New Chat
            </button>
          </div>
        </header>

        {/* Scrollable Messages Stream */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-44 flex flex-col items-center">
          <div className="w-full max-w-2xl space-y-6 my-auto">
            {currentMessages.length === 0 ? (
              /* Empty Conversation Welcome */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center space-y-6 py-12"
              >
                <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#3B342E] dark:text-[#F8F5F0] leading-snug">
                  What social media visual trend would you like to explore?
                </h2>
                <p className="text-sm text-[#7A736C] dark:text-[#A8A096] max-w-md mx-auto leading-relaxed">
                  Powered by the TrendLens FAISS cluster database — 5,000 sampled images from the SMPD dataset (no LLM). Ask about photography styles, engagement trends, and visual aesthetics. <strong>Social media topics only.</strong>
                </p>

                {/* Suggested Chips */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {suggestedPrompts.map((promptText, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(promptText)}
                      className="px-3.5 py-1.5 rounded-full bg-[#FFFCF8] dark:bg-[#26221F] border border-[#E7DED2] dark:border-[#3E3832] text-xs text-[#7A736C] dark:text-[#A8A096] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] hover:border-[#8A6A4A]/50 transition-all duration-200 shadow-2xs cursor-pointer"
                    >
                      {promptText}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              /* Message Bubbles */
              <div className="space-y-6">
                {currentMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onRegenerate={() => handleSend(msg.content)}
                  />
                ))}

                {isLoading && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </main>

        {/* Floating Input Area */}
        <div className="fixed bottom-0 left-0 right-0 md:left-72 bg-gradient-to-t from-[#F8F5F0] via-[#F8F5F0]/90 to-transparent dark:from-[#1C1815] dark:via-[#1C1815]/90 pt-8 pb-6 px-4 sm:px-6 flex flex-col items-center z-20 pointer-events-none">
          <div className="w-full max-w-2xl pointer-events-auto">
            <ChatInput
              input={input}
              setInput={setInput}
              onSend={handleSend}
              isLoading={isLoading}
              attachments={attachments}
              onRemoveAttachment={removeAttachment}
              onAddFiles={addFiles}
              onOpenCamera={() => setIsCameraOpen(true)}
              handleDragOver={handleDragOver}
              handleDragLeave={handleDragLeave}
              handleDrop={handleDrop}
              handlePaste={handlePaste}
              isDragging={isDragging}
            />
          </div>
        </div>

      </div>

      {/* Modal for Camera Capture */}
      <CameraCapture
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

    </div>
  );
};
