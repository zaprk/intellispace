import { useState, useRef } from 'react';
import { Message, Conversation, Memory } from '../../shared/types';

export const useConversationState = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [conversationMemory, setConversationMemory] = useState<Memory>({});
  const [projectMemory, setProjectMemory] = useState<Memory>({});
  const [typingAgents, setTypingAgents] = useState<{ [key: string]: boolean }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  return {
    // Messages state
    messages,
    setMessages,
    
    // Conversations state
    conversations,
    setConversations,
    activeConversation,
    setActiveConversation,
    
    // Memory state
    conversationMemory,
    setConversationMemory,
    projectMemory,
    setProjectMemory,
    
    // Typing indicators
    typingAgents,
    setTypingAgents,
    
    // Refs
    messagesEndRef
  };
};





