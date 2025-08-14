import React from 'react';
import { Hash, RefreshCw, Settings, Database, Workflow } from 'lucide-react';
import { Conversation } from '../../shared/types';
import { theme } from '../utils/theme';
import { styles } from '../utils/styles';

export interface HeaderProps {
  activeConversation: string | null;
  conversations: Conversation[];
  memoryVisible: boolean;
  onRefresh: () => void;
  onToggleMemory: () => void;
  onOpenWorkflowBuilder?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  activeConversation,
  conversations,
   // Available for future use (e.g., visual indicator)
  onRefresh,
  onToggleMemory,
  onOpenWorkflowBuilder
}) => {
  const currentConversation = conversations.find(c => c.id === activeConversation);

  return (
    <div style={styles.conversationHeader}>
      <div style={styles.conversationTitle}>
        <Hash size={20} />
        <span>{currentConversation?.name || 'Select a conversation'}</span>
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <RefreshCw 
          size={20} 
          style={{ cursor: 'pointer', color: theme.colors.text }}
          onClick={onRefresh}
        />
        <Settings size={20} style={{ cursor: 'pointer', color: theme.colors.text }} />
        <Database 
          size={20} 
          style={{ cursor: 'pointer', color: theme.colors.text }}
          onClick={onToggleMemory}
        />
        {onOpenWorkflowBuilder && (
          <Workflow 
            size={20} 
            style={{ cursor: 'pointer', color: theme.colors.text }}
            onClick={onOpenWorkflowBuilder}
          />
        )}
      </div>
    </div>
  );
};

export default Header;
