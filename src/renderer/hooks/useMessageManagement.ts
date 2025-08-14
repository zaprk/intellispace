import { useCallback } from 'react';
import { apiService } from '../utils/api';

export const useMessageManagement = () => {
  const handleSendMessage = useCallback(async (
    inputValue: string,
    activeAgent: string | null,
    activeConversation: string | null,
    setInputValue: (value: string) => void,
    setIsProcessing: (processing: boolean) => void,
    setError: (error: string) => void,
    socket?: any
  ) => {
    if (inputValue.trim() && activeAgent && activeConversation) {
      setIsProcessing(true);
      
      try {
        if (socket) {
          // Send user message via Socket.IO for real-time workflow processing
          socket.emit('message', {
            conversationId: activeConversation,
            senderId: 'user-agent',
            content: inputValue,
            type: 'text'
          });
          
          console.log('📤 [SOCKET] Message sent via Socket.IO for workflow processing');
        } else {
          // Fallback to REST API if socket not available
          await apiService.sendMessage({
            conversationId: activeConversation,
            senderId: 'user-agent',
            content: inputValue,
            type: 'text'
          });
          
          console.log('📤 [REST] Message sent via REST API (fallback)');
        }
        
        setInputValue('');

        // Note: Agent responses are now handled by the WorkflowOrchestrator via Socket.IO
        // No need to manually process with individual agents
        
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
