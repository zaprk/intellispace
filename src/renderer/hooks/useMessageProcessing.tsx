import { useCallback, Dispatch, SetStateAction } from 'react';
import type { Message, Agent } from '../../shared/types';
import MessageComponent from '../components/Message';
import { getAgentIcon } from '../utils/agentUtils';

export const useMessageProcessing = (agents: Agent[]) => {
  const handleNewMessage = useCallback(
    (
      message: Message,
      addMessageFn: (msg: Message) => boolean,
      setMessagesFn: Dispatch<SetStateAction<Message[]>>
    ) => {
      console.log('📨 New message received:', message);

      if (!addMessageFn(message)) {
        return;
      }

      if (message.senderId !== 'user' && message.senderId !== 'user-agent') {
        const agent = agents.find(a => a.id === message.senderId);
        if (!agent) {
          console.error(`❌ Agent not found for senderId: ${message.senderId}`);
          console.log('📋 Available agents:', agents.map(a => `${a.name} (${a.id})`));
          return;
        }
      }

      setMessagesFn((prevMessages: Message[]) => {
        const existsInState = prevMessages.some((m: Message) => m.id === message.id);
        if (existsInState) {
          console.warn(`🔄 Message already in state: ${message.id}`);
          return prevMessages;
        }
        return [...prevMessages, message];
      });
    },
    [agents]
  );

  const renderMessage = useCallback(
    (message: Message, index: number) => {
      const uniqueKey = `${message.id}-${message.conversationId}-${message.timestamp}-${index}`;

      const agent =
        message.senderId === 'user' || message.senderId === 'user-agent'
          ? null
          : agents.find(a => a.id === message.senderId);

      if (message.senderId !== 'user' && message.senderId !== 'user-agent' && !agent) {
        console.warn(`⚠️ Skipping render for message from unknown agent: ${message.senderId}`);
        return null;
      }

      return (
        <MessageComponent
          key={uniqueKey}
          message={message}
          agents={agents}
          getAgentIcon={getAgentIcon}
        />
      );
    },
    [agents]
  );

  return {
    handleNewMessage,
    renderMessage,
  };
};





