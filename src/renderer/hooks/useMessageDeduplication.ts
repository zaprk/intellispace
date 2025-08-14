import { useCallback, useState } from 'react';
import { Message } from '../../shared/types';

export const useMessageDeduplication = () => {
  const [processedMessages, setProcessedMessages] = useState<Set<string>>(new Set());

  const addMessage = useCallback((message: Message) => {
    const messageKey = `${message.id}-${message.conversationId}`;

    if (processedMessages.has(messageKey)) {
      console.warn(`Duplicate message prevented: ${message.id}`);
      return false;
    }

    setProcessedMessages(prev => new Set([...prev, messageKey]));
    return true;
  }, [processedMessages]);

  const clearProcessed = useCallback(() => {
    setProcessedMessages(new Set());
  }, []);

  return { addMessage, clearProcessed };
};







