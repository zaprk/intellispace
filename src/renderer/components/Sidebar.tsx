import React from 'react';
import { 
  Brain, 
  Plus, 
  Hash,
  Bot,
  Play,
  X,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { Agent, Conversation } from '../../shared/types';
import { theme } from '../utils/theme';
import { styles } from '../utils/styles';

export interface SidebarProps {
  collapsed: boolean;
  agents: Agent[];
  conversations: Conversation[];
  activeConversation: string | null;
  activeAgent: string | null;
  agentSectionExpanded: boolean;
  hoveredAgent: string | null;
  onToggleCollapse: () => void;
  onAgentClick: (agentId: string) => void;
  onConversationClick: (conversationId: string) => void;
  onToggleAgentSection: () => void;
  onAgentHover: (agentId: string | null) => void;
  onShowAgentModal: () => void;
  onCreateWebsiteTeam: () => void;
  onShowTeamTester: () => void;
  onCreateNewConversation: () => void;
  onClearAllAgents: () => void;
  getAgentIcon: (role: string) => string;
}

const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  agents,
  conversations,
  activeConversation,
  activeAgent,
  agentSectionExpanded,
  hoveredAgent,
  onToggleCollapse,
  onAgentClick,
  onConversationClick,
  onToggleAgentSection,
  onAgentHover,
  onShowAgentModal,
  onCreateWebsiteTeam,
  onShowTeamTester,
  onCreateNewConversation,
  onClearAllAgents,
  getAgentIcon
}) => {
  return (
    <div style={styles.sidebar(collapsed)}>
      <div style={styles.sidebarHeader}>
        <div style={styles.logo}>
          <Brain size={20} />
          {!collapsed && <span>IntelliSpace</span>}
        </div>
        <button
          onClick={onToggleCollapse}
          style={{
            background: 'none',
            border: 'none',
            color: theme.colors.text,
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={styles.agentList}>
        <div style={styles.agentSection}>
          <div 
            style={styles.sectionHeader}
            onClick={onToggleAgentSection}
          >
            {agentSectionExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {!collapsed && 'Agents'}
          </div>
          
          {agentSectionExpanded && agents.map(agent => (
            <div 
              key={agent.id}
              style={styles.agentItem(agent.id === activeAgent)}
              onClick={() => onAgentClick(agent.id)}
              onMouseEnter={() => onAgentHover(agent.id)}
              onMouseLeave={() => onAgentHover(null)}
            >
              <div style={styles.agentAvatar}>
                {getAgentIcon(agent.role)}
                <div style={styles.statusIndicator(agent.status)} />
              </div>
              {!collapsed && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{agent.name}</div>
                  <div style={{ fontSize: '12px', color: theme.colors.textMuted }}>{agent.role}</div>
                </div>
              )}
              {!collapsed && hoveredAgent === agent.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: Implement delete agent functionality
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.colors.error,
                    cursor: 'pointer',
                    padding: '2px'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={styles.agentSection}>
          <div style={styles.sectionHeader}>
            <ChevronDown size={12} />
            {!collapsed && 'Conversations'}
          </div>
          {conversations.map(conv => (
            <div 
              key={conv.id}
              style={styles.agentItem(conv.id === activeConversation)}
              onClick={() => onConversationClick(conv.id)}
            >
              <Hash size={18} />
              {!collapsed && (
                <div style={{ fontSize: '14px' }}>{conv.name}</div>
              )}
            </div>
          ))}
        </div>
        
        {!collapsed && (
          <div style={{ padding: '8px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              style={styles.addAgentButton}
              onClick={onShowAgentModal}
              onMouseEnter={(e) => e.currentTarget.style.background = theme.colors.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.background = theme.colors.primary}
            >
              <Plus size={16} />
              Create Agent
            </button>
            <button 
              style={{
                ...styles.addAgentButton,
                background: theme.colors.success
              }}
              onClick={onCreateWebsiteTeam}
              onMouseEnter={(e) => e.currentTarget.style.background = '#2d8a4e'}
              onMouseLeave={(e) => e.currentTarget.style.background = theme.colors.success}
            >
              <Bot size={16} />
              Website Team
            </button>
            <button 
              style={{
                ...styles.addAgentButton,
                background: theme.colors.info
              }}
              onClick={onShowTeamTester}
              onMouseEnter={(e) => e.currentTarget.style.background = '#4752C4'}
              onMouseLeave={(e) => e.currentTarget.style.background = theme.colors.info}
            >
              <Play size={16} />
              Test Team
            </button>
            <button 
              style={styles.addAgentButton}
              onClick={onCreateNewConversation}
              onMouseEnter={(e) => e.currentTarget.style.background = theme.colors.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.background = theme.colors.primary}
            >
              <Plus size={16} />
              New Conversation
            </button>
            <button 
              style={{
                ...styles.addAgentButton,
                background: theme.colors.error,
                fontSize: '12px'
              }}
              onClick={onClearAllAgents}
              onMouseEnter={(e) => e.currentTarget.style.background = '#c53030'}
              onMouseLeave={(e) => e.currentTarget.style.background = theme.colors.error}
            >
              <X size={14} />
              Clear Agents
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;





