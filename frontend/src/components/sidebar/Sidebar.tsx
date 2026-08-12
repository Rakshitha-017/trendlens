import React from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Conversation } from '../../types';
import { ConversationItem } from './ConversationItem';
import { ThemeToggle } from '../common/ThemeToggle';

interface SidebarProps {
  conversations: Conversation[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onRenameChat: (id: string, newTitle: string) => void;
  onDeleteChat: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeChatId,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  searchQuery,
  onSearchChange,
  isOpen,
  onClose
}) => {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static top-0 bottom-0 left-0 z-40 w-72 bg-[#F8F5F0] dark:bg-[#1C1815] border-r border-[#E7DED2] dark:border-[#3E3832] flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Header & Brand */}
        <div className="p-4 flex items-center justify-between border-b border-[#E7DED2]/60 dark:border-[#3E3832]/60">
          <div className="flex items-center gap-2">
            <span className="font-serif text-xl font-medium tracking-tight text-[#3B342E] dark:text-[#F8F5F0]">
              TrendLens
            </span>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-xl text-[#7A736C] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full px-4 py-2.5 rounded-xl bg-[#8A6A4A] hover:bg-[#73553A] text-[#FFFCF8] text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New conversation</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-3 pb-2">
          <div className="relative flex items-center bg-[#FFFCF8] dark:bg-[#26221F] border border-[#E7DED2] dark:border-[#3E3832] rounded-xl px-2.5 py-1.5 shadow-2xs">
            <Search className="w-3.5 h-3.5 text-[#7A736C] dark:text-[#A8A096] shrink-0 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-transparent text-xs text-[#3B342E] dark:text-[#F8F5F0] placeholder-[#7A736C]/60 dark:placeholder-[#A8A096]/60 focus:outline-none"
            />
          </div>
        </div>

        {/* Conversations Scroll List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#7A736C] dark:text-[#A8A096]">
              {searchQuery ? 'No matching conversations' : 'No saved conversations'}
            </div>
          ) : (
            conversations.map((chat) => (
              <ConversationItem
                key={chat.id}
                conversation={chat}
                isActive={chat.id === activeChatId}
                onSelect={(id) => {
                  onSelectChat(id);
                  onClose();
                }}
                onRename={onRenameChat}
                onDelete={onDeleteChat}
              />
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-[#E7DED2]/60 dark:border-[#3E3832]/60 text-[11px] text-[#7A736C] dark:text-[#A8A096] text-center font-normal">
          Visual Trend Intelligence
        </div>
      </aside>
    </>
  );
};
