import React from 'react';
import { Bot, Hash, MessageCircle, Loader, Plus, Play } from 'lucide-react';
import { Agent, Message, Conversation } from '../../shared/types';
import { theme } from '../utils/theme';
import { styles } from '../utils/styles';

export interface MessageListProps {
  messages: Message[];
  agents: Agent[];
  conversations: Conversation[];
  isProcessing: boolean;
  typingAgents: { [key: string]: boolean };
  activeConversation: string | null;
  onCreateWebsiteTeam: () => void;
  onShowAgentModal: () => void;
  onShowTeamTester: () => void;
  onCreateNewConversation: () => void;
  getAgentIcon: (role: string) => string;
  renderMessage: (message: Message, index: number) => React.ReactNode;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  agents,
  conversations,
  isProcessing,
  typingAgents,
  activeConversation,
  onCreateWebsiteTeam,
  onShowAgentModal,
  onShowTeamTester,
  onCreateNewConversation,
  getAgentIcon,
  renderMessage,
  messagesEndRef
}) => {
  const validMessages = messages.filter(m => m.conversationId === activeConversation);

  const renderEmptyState = () => {
    if (agents.length === 0) {
      return (
        <>
          <Bot size={48} />
          <h3>No Agents Available</h3>
          <p>Create your first agent to get started!</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={onCreateWebsiteTeam}
              style={{
                ...styles.addAgentButton,
                background: theme.colors.success
              }}
            >
              <Bot size={16} />
              Create Website Team
            </button>
            <button
              onClick={onShowAgentModal}
              style={styles.addAgentButton}
            >
              <Plus size={16} />
              Create Custom Agent
            </button>
            <button
              onClick={onShowTeamTester}
              style={{
                ...styles.addAgentButton,
                background: theme.colors.info
              }}
            >
              <Play size={16} />
              Test Team Collaboration
            </button>
          </div>
        </>
      );
    } else if (conversations.length === 0) {
      return (
        <>
          <Hash size={48} />
          <h3>No Conversations</h3>
          <p>Create a conversation to start chatting!</p>
          <button
            onClick={onCreateNewConversation}
            style={styles.addAgentButton}
          >
            <Plus size={16} />
            Create Conversation
          </button>
        </>
      );
    } else {
      return (
        <>
          <MessageCircle size={48} style={{ opacity: 0.5 }} />
          <h3>Start a Conversation</h3>
          <p>Select an agent and start typing to begin!</p>
        </>
      );
    }
  };

  return (
    <div style={styles.messagesContainer}>
      {validMessages.length === 0 && !isProcessing ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: theme.colors.textMuted,
          textAlign: 'center',
          gap: '16px'
        }}>
          {renderEmptyState()}
        </div>
      ) : (
        <>
          {validMessages.map((message, index) => renderMessage(message, index))}
          
          {/* Typing indicators */}
          {Object.entries(typingAgents).map(([agentId, isTyping]) => {
            if (!isTyping) return null;
            
            const agent = agents.find(a => a.id === agentId);
            if (!agent) return null;
            
            return (
              <div key={`typing-${agentId}`} style={styles.message}>
                <div style={styles.messageAvatar}>
                  {getAgentIcon(agent.role)}
                </div>
                <div style={styles.messageContent}>
                  <div style={styles.messageHeader}>
                    <span style={styles.messageAuthor}>{agent.name}</span>
                    <span style={styles.messageTime}>typing...</span>
                  </div>
                  <div style={styles.messageText}>
                    <span style={{ opacity: 0.6 }}>● ● ●</span>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
      
      {isProcessing && (
        <div style={styles.message}>
          <div style={styles.messageAvatar}>
            <Loader size={20} className="animate-spin" />
          </div>
          <div style={styles.messageContent}>
            <div style={styles.messageHeader}>
              <span style={styles.messageAuthor}>Processing...</span>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
