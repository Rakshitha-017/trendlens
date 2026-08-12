import React, { useState } from 'react';
import { MessageSquare, Edit2, Trash2, Check, X } from 'lucide-react';
import { Conversation } from '../../types';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onSelect,
  onRename,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [titleInput, setTitleInput] = useState(conversation.title);

  const handleSaveRename = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (titleInput.trim()) {
      onRename(conversation.id, titleInput.trim());
    } else {
      setTitleInput(conversation.title);
    }
    setIsEditing(false);
  };

  return (
    <div
      onClick={() => !isEditing && onSelect(conversation.id)}
      className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
        isActive
          ? 'bg-[#FFFCF8] dark:bg-[#26221F] text-[#3B342E] dark:text-[#F8F5F0] font-medium shadow-sm border border-[#E7DED2] dark:border-[#3E3832]'
          : 'text-[#7A736C] dark:text-[#A8A096] hover:bg-[#FFFCF8]/60 dark:hover:bg-[#26221F]/60 hover:text-[#3B342E] dark:hover:text-[#F8F5F0]'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#8A6A4A] dark:text-[#C7D2C1]' : 'text-[#7A736C]/70'}`} />

        {isEditing ? (
          <form onSubmit={handleSaveRename} className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              autoFocus
              className="w-full bg-transparent border-b border-[#8A6A4A] dark:border-[#C7D2C1] text-xs text-[#3B342E] dark:text-[#F8F5F0] focus:outline-none py-0.5"
            />
            <button
              type="submit"
              aria-label="Save title"
              className="p-1 rounded text-[#8A6A4A] hover:bg-[#E7DED2]/40 cursor-pointer"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              aria-label="Cancel rename"
              className="p-1 rounded text-[#7A736C] hover:bg-[#E7DED2]/40 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </form>
        ) : (
          <span className="truncate">{conversation.title}</span>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            aria-label="Rename chat"
            title="Rename"
            className="p-1 rounded hover:bg-[#E7DED2]/50 dark:hover:bg-[#3E3832] text-[#7A736C] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] transition-colors cursor-pointer"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(conversation.id);
            }}
            aria-label="Delete chat"
            title="Delete"
            className="p-1 rounded hover:bg-[#E7DED2]/50 dark:hover:bg-[#3E3832] text-[#7A736C] hover:text-[#3B342E] dark:hover:text-[#F8F5F0] transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
