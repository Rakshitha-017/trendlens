import { useState, useEffect, useCallback } from 'react';
import { Conversation, ChatMessage, AttachedFile } from '../types';
import { chatService } from '../services/chatService';

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load chats on mount
  useEffect(() => {
    async function load() {
      const list = await chatService.getChats();
      setConversations(list);
      if (list.length > 0 && !activeChatId) {
        setActiveChatId(list[0].id);
      }
    }
    load();
  }, []);

  const activeChat = conversations.find((c) => c.id === activeChatId) || null;

  const createNewChat = useCallback(async () => {
    const newChat = await chatService.createChat('New Conversation');
    setConversations((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    return newChat;
  }, []);

  const deleteChat = useCallback(async (id: string) => {
    await chatService.deleteChat(id);
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      if (activeChatId === id && updated.length > 0) {
        setActiveChatId(updated[0].id);
      } else if (updated.length === 0) {
        setActiveChatId(null);
      }
      return updated;
    });
  }, [activeChatId]);

  const renameChat = useCallback(async (id: string, newTitle: string) => {
    await chatService.renameChat(id, newTitle);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
  }, []);

  const sendMessage = useCallback(
    async (text: string, attachments: AttachedFile[] = []) => {
      if (!text.trim() && attachments.length === 0) return;

      let currentChat = activeChat;
      let targetChatId = activeChatId;

      // If no active chat exists, create one
      if (!currentChat || !targetChatId) {
        const titleSnippet = text.slice(0, 30) || 'Attachment Analysis';
        currentChat = await chatService.createChat(titleSnippet);
        targetChatId = currentChat.id;
        setActiveChatId(targetChatId);
      } else if (currentChat.messages.length === 0 && text) {
        // Auto-generate a title based on first user prompt
        const titleSnippet = text.slice(0, 32) + (text.length > 32 ? '...' : '');
        await renameChat(targetChatId, titleSnippet);
      }

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'user',
        content: text.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        attachments: attachments.length > 0 ? [...attachments] : undefined
      };

      // Update state with user message immediately
      const updatedMessages = [...(currentChat?.messages || []), userMsg];
      const updatedChat: Conversation = {
        ...currentChat!,
        messages: updatedMessages
      };

      setConversations((prev) =>
        prev.map((c) => (c.id === targetChatId ? updatedChat : c))
      );
      await chatService.saveChat(updatedChat);

      setIsLoading(true);

      try {
        const assistantReply = await chatService.sendMessage(
          text,
          updatedMessages,
          attachments
        );

        const finalMessages = [...updatedMessages, assistantReply];
        const finalChat: Conversation = {
          ...updatedChat,
          messages: finalMessages
        };

        setConversations((prev) =>
          prev.map((c) => (c.id === targetChatId ? finalChat : c))
        );
        await chatService.saveChat(finalChat);
      } catch (err) {
        console.error('Error in sendMessage:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [activeChat, activeChatId, renameChat]
  );

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return {
    conversations: filteredConversations,
    allConversations: conversations,
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
  };
}
