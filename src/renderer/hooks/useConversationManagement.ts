import { useCallback, Dispatch, SetStateAction } from 'react';
import { Conversation, Message, Agent } from '../../shared/types';
import { apiService } from '../utils/api';

export const useConversationManagement = () => {
  const createNewConversation = useCallback(async (
    conversations: Conversation[],
    agents: Agent[],
    setConversations: Dispatch<SetStateAction<Conversation[]>>,
    setActiveConversation: (id: string) => void,
    setError: (error: string) => void
  ) => {
    try {
      const newConversation = await apiService.createConversation({
        projectId: 'default',
        name: `Conversation ${conversations.length + 1}`,
        type: 'group',
        participants: agents.map(a => a.id)
      });
      setConversations((prev: Conversation[]) => [...prev, newConversation]);
      setActiveConversation(newConversation.id);
    } catch (err) {
      console.error('Error creating conversation:', err);
      setError('Failed to create conversation');
    }
  }, []);

  const loadConversationMessages = useCallback(async (
    conversationId: string,
    agents: Agent[],
    setMessages: Dispatch<SetStateAction<Message[]>>,
    setConversationMemory: Dispatch<SetStateAction<any>>,
    setError: (error: string) => void
  ) => {
    try {
      const messagesData = await apiService.fetchMessages(conversationId);
      console.log('📨 Loaded messages:', messagesData);
      console.log('🤖 Available agents:', agents);
      
      // Check for any messages with unknown senderIds
      const unknownSenders = messagesData.filter(msg => 
        msg.senderId !== 'user' && !agents.find(a => a.id === msg.senderId)
      );
      if (unknownSenders.length > 0) {
        console.warn('⚠️ Messages with unknown senderIds:', unknownSenders);
        console.warn('🤖 Available agent IDs:', agents.map(a => a.id));
      }
      
      setMessages(messagesData);
      
      // Load conversation memory
      const memory = await apiService.getMemory('conversation', conversationId);
      setConversationMemory(memory);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    }
  }, []);

  return {
    createNewConversation,
    loadConversationMessages
  };
};
