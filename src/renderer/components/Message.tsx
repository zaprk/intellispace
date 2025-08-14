import React from 'react';
import { Agent, Message as MessageType } from '../../shared/types';
import { styles } from '../utils/styles';

export interface MessageProps {
  message: MessageType;
  agents: Agent[];
  getAgentIcon: (role: string) => string;
}

const Message: React.FC<MessageProps> = ({ message, agents, getAgentIcon }) => {
  const agent = agents.find(a => a.id === message.senderId);
  const isUser = message.senderId === 'user' || message.senderId === 'user-agent';
  
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div style={styles.message}>
      <div style={styles.messageAvatar}>
        {isUser ? '👤' : getAgentIcon(agent?.role || 'default')}
      </div>
      <div style={styles.messageContent}>
        <div style={styles.messageHeader}>
          <span style={styles.messageAuthor}>
            {isUser ? 'You' : agent?.name || message.senderId}
          </span>
          <span style={styles.messageTime}>
            {formatTime(message.timestamp)}
          </span>
        </div>
        <div style={styles.messageText}>
          {message.content}
        </div>
      </div>
    </div>
  );
};

export default Message;





