import { useCallback } from 'react';
import { Message, Agent, OllamaStatus } from '../../shared/types';
import { apiService } from '../utils/api';

export const useMessageManagement = () => {
  const handleSendMessage = useCallback(async (
    inputValue: string,
    activeAgent: string | null,
    activeConversation: string | null,
    agents: Agent[],
    ollamaStatus: OllamaStatus,
    messages: Message[],
    conversationMemory: any,
    setInputValue: (value: string) => void,
    setIsProcessing: (processing: boolean) => void,
    setError: (error: string) => void
  ) => {
    if (inputValue.trim() && activeAgent && activeConversation) {
      setIsProcessing(true);
      
      try {
        // Send user message
        await apiService.sendMessage({
          conversationId: activeConversation,
          senderId: 'user-agent',
          content: inputValue,
          type: 'text'
        });
        
        const userInput = inputValue;
        setInputValue('');

        // Process with Ollama through the active agent
        const agent = agents.find(a => a.id === activeAgent);
        if (agent && ollamaStatus.available && agent.id !== 'system-agent' && agent.id !== 'user-agent') {
          // Get agent response
          const response = await apiService.processWithOllama(
            userInput,
            agent.config?.model || 'llama2',
            {
              systemPrompt: agent.config?.systemPrompt,
              conversationHistory: messages.slice(-10), // Last 10 messages for context
              memory: conversationMemory
            }
          );

          // Send agent response
          await apiService.sendMessage({
            conversationId: activeConversation,
            senderId: activeAgent,
            content: response.response || response.text || 'I understand. Let me help you with that.',
            type: 'text'
          });
        }
      } catch (err) {
        console.error('Error sending message:', err);
        setError('Failed to send message');
      } finally {
        setIsProcessing(false);
      }
    }
  }, []);

  const handleMemoryUpdate = useCallback(async (
    activeConversation: string | null,
    conversationMemory: any,
    setError: (error: string) => void
  ) => {
    try {
      if (activeConversation) {
        await apiService.updateMemory('conversation', activeConversation, conversationMemory);
        // Show success feedback
      }
    } catch (err) {
      console.error('Error updating memory:', err);
      setError('Failed to update memory');
    }
  }, []);

  return {
    handleSendMessage,
    handleMemoryUpdate
  };
};
