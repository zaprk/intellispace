import React, { useState, useEffect } from 'react';
import { 
  Hash, 
  Settings, 
  Plus, 
  Users,
  MessageCircle,
  Activity
} from 'lucide-react';
import { useSocketConnection } from '../hooks/useSocketConnection';
import { useConversationManagement } from '../hooks/useConversationManagement';
import { useDataLoading } from '../hooks/useDataLoading';
import { apiService } from '../utils/api';
import { theme } from '../utils/theme';
import { Message, Agent, Conversation } from '../../shared/types';

// Enhanced Channel Switcher Component
const ChannelSwitcher = ({ 
  activeChannel, 
  onChannelChange, 
  agents = [], 
  conversations = [] 
}: {
  activeChannel: string;
  onChannelChange: (channelId: string) => void;
  agents: Agent[];
  conversations: Conversation[];
}) => {
  const [expandedSections, setExpandedSections] = useState({
    teamChannels: true,
    directMessages: true,
    agents: true,
    conversations: true
  });

  // Real conversations from backend
  const realConversations = conversations.filter((conv: Conversation) => conv.id && conv.name);
  
  const teamChannels = [
    { id: 'general', name: 'general', type: 'text', unread: 0, description: 'General team discussion' },
    { id: 'project-discussion', name: 'project-discussion', type: 'text', unread: 0, description: 'Current project updates' },
    { id: 'design-review', name: 'design-review', type: 'text', unread: 0, description: 'Design feedback and reviews' },
    { id: 'dev-updates', name: 'dev-updates', type: 'text', unread: 0, description: 'Development progress' }
  ];

  const directMessages = agents.map((agent: Agent) => ({
    id: `dm-${agent.id}`,
    name: agent.name,
    agent: agent,
    unread: 0,
    lastMessage: '',
    lastMessageTime: ''
  }));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev]
    }));
  };

  const SectionHeader = ({ 
    title, 
    count, 
    icon: Icon, 
    section, 
    children 
  }: {
    title: string;
    count: number;
    icon: any;
    section: string;
    children?: React.ReactNode;
  }) => {
    const isExpanded = expandedSections[section as keyof typeof expandedSections];
    
    return (
      <div style={{ padding: '8px 16px', paddingTop: '16px' }}>
        <div 
          onClick={() => toggleSection(section)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: '600',
            color: theme.colors.textMuted,
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => {
            const target = e.target as HTMLElement;
            target.style.color = theme.colors.text;
          }}
          onMouseLeave={(e) => {
            const target = e.target as HTMLElement;
            target.style.color = theme.colors.textMuted;
          }}
        >
          <span style={{ marginRight: '4px' }}>{isExpanded ? '▼' : '▶'}</span>
          <Icon size={12} style={{ marginRight: '8px' }} />
          <span style={{ flex: 1 }}>
            {title}
            {count !== undefined && ` — ${count}`}
          </span>
          <div style={{ opacity: 0, transition: 'opacity 0.2s' }}>
            {children}
          </div>
        </div>
      </div>
    );
  };

  const ChannelItem = ({ 
    channel, 
    type 
  }: {
    channel: any;
    type: string;
  }) => {
    const isActive = activeChannel === channel.id;
    
    return (
      <div
        onClick={() => onChannelChange(channel.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 8px',
          margin: '0 8px',
          borderRadius: '4px',
          cursor: 'pointer',
          color: isActive ? theme.colors.textBright : theme.colors.textMuted,
          backgroundColor: isActive ? theme.colors.active : 'transparent',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            const target = e.target as HTMLElement;
            target.style.backgroundColor = theme.colors.hover;
            target.style.color = theme.colors.text;
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            const target = e.target as HTMLElement;
            target.style.backgroundColor = 'transparent';
            target.style.color = theme.colors.textMuted;
          }
        }}
      >
        <div style={{ marginRight: '12px' }}>
          {type === 'team' ? (
            <Hash size={16} />
          ) : type === 'dm' ? (
            <div style={{
              width: '16px',
              height: '16px',
              backgroundColor: theme.colors.primary,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px'
            }}>
              {channel.agent?.avatar || '🤖'}
            </div>
          ) : (
            <MessageCircle size={16} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: '500',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {channel.name}
          </div>
          {channel.lastMessage && (
            <div style={{ 
              fontSize: '12px', 
              color: theme.colors.textMuted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {channel.lastMessage}
            </div>
          )}
        </div>
        {channel.unread > 0 && (
          <div style={{
            backgroundColor: theme.colors.error,
            color: 'white',
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '10px',
            minWidth: '16px',
            textAlign: 'center'
          }}>
            {channel.unread}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      width: '240px',
      backgroundColor: theme.colors.backgroundTertiary,
      display: 'flex',
      flexDirection: 'column',
      borderRight: `1px solid ${theme.colors.border}`,
      height: '100vh'
    }}>
      {/* Server Header */}
      <div style={{
        height: '48px',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        borderBottom: `1px solid ${theme.colors.border}`,
        cursor: 'pointer',
        transition: 'background-color 0.2s'
      }}
      onMouseEnter={(e) => {
        const target = e.target as HTMLElement;
        target.style.backgroundColor = theme.colors.hover;
      }}
      onMouseLeave={(e) => {
        const target = e.target as HTMLElement;
        target.style.backgroundColor = 'transparent';
      }}
      >
        <h1 style={{ 
          fontWeight: '600', 
          flex: 1,
          color: theme.colors.textBright,
          fontSize: '16px'
        }}>
          IntelliSpace Team
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '12px',
            backgroundColor: theme.colors.success,
            color: 'white',
            padding: '2px 6px',
            borderRadius: '10px'
          }}>
            {agents.filter((a: Agent) => a.status === 'online').length}
          </span>
          <span style={{ color: theme.colors.textMuted, transition: 'color 0.2s' }}>▼</span>
        </div>
      </div>

      {/* Channel List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Team Channels Section */}
        <SectionHeader 
          title="TEAM CHANNELS" 
          count={teamChannels.length}
          icon={Hash} 
          section="teamChannels"
        >
          <Plus size={14} style={{ color: theme.colors.textBright }} />
        </SectionHeader>
        
        {expandedSections.teamChannels && (
          <div style={{ paddingBottom: '8px' }}>
            {teamChannels.map(channel => (
              <ChannelItem key={channel.id} channel={channel} type="team" />
            ))}
          </div>
        )}

        {/* Conversations Section */}
        <SectionHeader 
          title="CONVERSATIONS" 
          count={realConversations.length}
          icon={MessageCircle} 
          section="conversations"
        >
          <Plus size={14} style={{ color: theme.colors.textBright }} />
        </SectionHeader>
        
        {expandedSections.conversations && (
          <div style={{ paddingBottom: '8px' }}>
            {realConversations.length > 0 ? (
              realConversations.map(conversation => (
                <ChannelItem 
                  key={conversation.id} 
                  channel={{
                    id: conversation.id,
                    name: conversation.name,
                    type: 'conversation',
                    unread: 0
                  }} 
                  type="conversation" 
                />
              ))
            ) : (
              <div style={{
                padding: '8px 16px',
                color: theme.colors.textMuted,
                fontSize: '12px',
                fontStyle: 'italic'
              }}>
                No conversations yet
              </div>
            )}
          </div>
        )}

        {/* Direct Messages Section */}
        <SectionHeader 
          title="DIRECT MESSAGES" 
          count={directMessages.filter(dm => dm.agent.status === 'online').length}
          icon={MessageCircle} 
          section="directMessages"
        >
          <Plus size={14} style={{ color: theme.colors.textBright }} />
        </SectionHeader>
        
        {expandedSections.directMessages && (
          <div style={{ paddingBottom: '8px' }}>
            {directMessages.map(dm => (
              <ChannelItem key={dm.id} channel={dm} type="dm" />
            ))}
          </div>
        )}

        {/* AI Agents Section */}
        <SectionHeader 
          title="AI AGENTS" 
          count={agents.filter((a: Agent) => a.status === 'online').length}
          icon={Users} 
          section="agents"
        >
          <Settings size={14} style={{ color: theme.colors.textBright }} />
        </SectionHeader>
        
        {expandedSections.agents && (
          <div style={{ paddingBottom: '8px' }}>
            {agents.map((agent: Agent) => (
              <div
                key={agent.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 8px',
                  margin: '0 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: theme.colors.textMuted,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.backgroundColor = theme.colors.hover;
                  target.style.color = theme.colors.text;
                }}
                onMouseLeave={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.backgroundColor = 'transparent';
                  target.style.color = theme.colors.textMuted;
                }}
              >
                <div style={{ position: 'relative', marginRight: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px'
                  }}>
                    {agent.avatar || '🤖'}
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '12px',
                    height: '12px',
                    backgroundColor: agent.status === 'online' ? theme.colors.success : theme.colors.textMuted,
                    borderRadius: '50%',
                    border: `2px solid ${theme.colors.backgroundTertiary}`
                  }}></div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '500',
                    color: theme.colors.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {agent.name}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: theme.colors.textMuted,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {agent.role.replace('-', ' ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Message Component
const MessageComponent = ({ 
  message, 
  agents 
}: {
  message: Message;
  agents: Agent[];
}) => {
  const agent = message.agent || agents.find((a: Agent) => a.id === message.senderId);
  
  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div style={{ display: 'flex', gap: theme.spacing.md }}>
      <div style={{
        width: '40px',
        height: '40px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: '18px'
      }}>
        {agent?.avatar || '👤'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'baseline', 
          gap: theme.spacing.sm, 
          marginBottom: theme.spacing.xs 
        }}>
          <span style={{ 
            fontWeight: '600', 
            color: theme.colors.textBright 
          }}>
            {agent?.name || message.senderId}
          </span>
          <span style={{ 
            fontSize: '12px', 
            color: theme.colors.textMuted 
          }}>
            {formatMessageTime(message.timestamp)}
          </span>
        </div>
        <div style={{ 
          color: theme.colors.text,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word'
        }}>
          {message.content}
        </div>
      </div>
    </div>
  );
};

// Message Input Component
const MessageInput = ({ 
  onSendMessage 
}: {
  onSendMessage: (messageData: { content: string }) => void;
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage({ content: inputValue.trim() });
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div style={{
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius,
      padding: theme.spacing.sm,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm
    }}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        placeholder="Message #general... (Use @ to mention agents)"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: theme.colors.text,
          fontSize: '14px'
        }}
      />
      <button
        onClick={handleSend}
        disabled={!inputValue.trim()}
        style={{
          background: inputValue.trim() ? theme.colors.primary : theme.colors.backgroundTertiary,
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: theme.spacing.sm,
          cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
          opacity: inputValue.trim() ? 1 : 0.5
        }}
      >
        Send
      </button>
    </div>
  );
};

// Main Enhanced Discord Layout Component
const EnhancedDiscordLayout = () => {
  const [activeChannel, setActiveChannel] = useState('general');
  const [workflowStatus, setWorkflowStatus] = useState<any>(null);
  const [typingAgents, setTypingAgents] = useState<{ [key: string]: boolean }>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(true);
  
  // Use our existing hooks
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const { createNewConversation, loadConversationMessages } = useConversationManagement();
  const { loadInitialData } = useDataLoading();
  const { socket } = useSocketConnection();

  // Load initial data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setAgentsLoading(true);
        setConversationsLoading(true);
        
        // Load agents
        const agentsResponse = await fetch('http://localhost:3001/api/agents');
        if (agentsResponse.ok) {
          const agentsData = await agentsResponse.json();
          setAgents(agentsData.map((agent: Agent) => ({
            ...agent,
            status: 'online' // Default status
          })));
        } else {
          console.error('Failed to load agents');
          setAgents([]);
        }

        // Load conversations
        const conversationsResponse = await fetch('http://localhost:3001/api/conversations');
        if (conversationsResponse.ok) {
          const conversationsData = await conversationsResponse.json();
          setConversations(conversationsData);
        } else {
          console.error('Failed to load conversations');
          setConversations([]);
        }

      } catch (error) {
        console.error('Error loading initial data:', error);
        setAgents([]);
        setConversations([]);
      } finally {
        setAgentsLoading(false);
        setConversationsLoading(false);
      }
    };

    loadData();
  }, []);

  // Load initial messages for general channel
  useEffect(() => {
    if (agents.length > 0 && !agentsLoading) {
      handleChannelChange('general');
    }
  }, [agents, agentsLoading]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on('typing-indicator', ({ agentId, isTyping }) => {
      setTypingAgents(prev => ({
        ...prev,
        [agentId]: isTyping
      }));
    });

    socket.on('workflow-status', (status) => {
      setWorkflowStatus(status);
    });

    socket.on('workflow-reset', () => {
      setWorkflowStatus(null);
      setTypingAgents({});
    });

    socket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      socket.off('typing-indicator');
      socket.off('workflow-status');
      socket.off('workflow-reset');
      socket.off('new-message');
    };
  }, [socket]);

  // Channel management
  const handleChannelChange = async (channelId: string) => {
    setActiveChannel(channelId);
    setWorkflowStatus(null);
    setTypingAgents({});
    setMessagesLoading(true);
    
    try {
      if (channelId.startsWith('dm-')) {
        const agentId = channelId.replace('dm-', '');
        setMessages([]);
      } else if (channelId === 'general') {
        // For general channel, show a welcome message
        setMessages([{
          id: 'welcome-msg',
          conversationId: 'general',
          senderId: 'system',
          content: 'Welcome to the IntelliSpace team! This is the general channel where you can discuss projects and collaborate with AI agents.',
          type: 'text',
          timestamp: new Date().toISOString(),
          agent: { id: 'system', name: 'System', avatar: '🤖', role: 'system' }
        }]);
      } else {
        // Load messages for real conversations
        await loadConversationMessages(
          channelId,
          agents,
          setMessages,
          () => {},
          (error) => console.error('Error loading messages:', error)
        );
      }
    } catch (error) {
      console.error('Error changing channel:', error);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Message handling
  const handleSendMessage = async (messageData: { content: string }) => {
    try {
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId: activeChannel,
        senderId: 'user',
        content: messageData.content,
        type: 'text',
        timestamp: new Date().toISOString(),
        agent: { id: 'user', name: 'You', avatar: '👤', role: 'user' }
      };

      setMessages(prev => [...prev, newMessage]);

      if (socket) {
        socket.emit('message', {
          conversationId: activeChannel,
          content: messageData.content,
          mentions: [] // No mentions in this simplified version
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Workflow controls
  const handleResetWorkflow = async (conversationId: string) => {
    try {
      // TODO: Implement reset functionality
      console.log(`Resetting workflow for ${conversationId}`);
      setWorkflowStatus(null);
      setTypingAgents({});
    } catch (error) {
      console.error('Failed to reset workflow:', error);
    }
  };

  const handlePauseWorkflow = (conversationId: string) => {
    console.log(`Pausing workflow for ${conversationId}`);
    // TODO: Implement pause functionality
  };

  // Get current channel info
  const getCurrentChannelInfo = () => {
    if (activeChannel === 'general') {
      return { name: 'general', type: 'team' };
    }
    
    if (activeChannel.startsWith('dm-')) {
      const agentId = activeChannel.replace('dm-', '');
      const agent = agents.find(a => a.id === agentId);
      return { name: agent?.name || 'Unknown', type: 'dm', agent };
    }
    
    const conversation = conversations.find(c => c.id === activeChannel);
    return { name: conversation?.name || 'Unknown', type: 'conversation' };
  };

  const currentChannel = getCurrentChannelInfo();

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      backgroundColor: theme.colors.background
    }}>
      {/* Sidebar */}
      <ChannelSwitcher
        activeChannel={activeChannel}
        onChannelChange={handleChannelChange}
        agents={agents}
        conversations={conversations}
      />

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background
      }}>
        {/* Channel Header */}
        <div style={{
          height: '48px',
          padding: `0 ${theme.spacing.md}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm
          }}>
            {currentChannel.type === 'team' ? (
              <Hash size={20} style={{ color: theme.colors.textMuted }} />
            ) : currentChannel.type === 'dm' ? (
              <div style={{
                width: '20px',
                height: '20px',
                backgroundColor: theme.colors.primary,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}>
                {currentChannel.agent?.avatar || '🤖'}
              </div>
            ) : (
              <MessageCircle size={20} style={{ color: theme.colors.textMuted }} />
            )}
            <h2 style={{
              fontWeight: '600',
              color: theme.colors.textBright,
              fontSize: '16px'
            }}>
              {currentChannel.name}
            </h2>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm
          }}>
            <button
              onClick={() => setShowWorkflowPanel(!showWorkflowPanel)}
              style={{
                padding: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: theme.colors.textMuted,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLElement;
                target.style.backgroundColor = theme.colors.hover;
                target.style.color = theme.colors.text;
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLElement;
                target.style.backgroundColor = 'transparent';
                target.style.color = theme.colors.textMuted;
              }}
            >
              <Activity size={16} />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden'
        }}>
          {/* Messages */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: theme.colors.background
          }}>
            {messagesLoading ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.textMuted
              }}>
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.textMuted,
                textAlign: 'center',
                padding: theme.spacing.xl
              }}>
                <div>
                  <h3 style={{ marginBottom: theme.spacing.sm }}>No messages yet</h3>
                  <p>Start a conversation by sending a message!</p>
                </div>
              </div>
            ) : (
              <div style={{
                flex: 1,
                padding: theme.spacing.md,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: theme.spacing.md
              }}>
                {messages.map((message, index) => (
                  <MessageComponent key={message.id || index} message={message} agents={agents} />
                ))}
              </div>
            )}

            {/* Input Area */}
            <div style={{
              padding: theme.spacing.md,
              borderTop: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background
            }}>
              <MessageInput onSendMessage={handleSendMessage} />
            </div>
          </div>

          {/* Workflow Panel */}
          {showWorkflowPanel && (
            <div style={{
              width: '320px',
              backgroundColor: theme.colors.backgroundSecondary,
              borderLeft: `1px solid ${theme.colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              padding: theme.spacing.md,
              gap: theme.spacing.md
            }}>
              {/* Workflow Status */}
              {workflowStatus ? (
                <div style={{
                  backgroundColor: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius,
                  padding: theme.spacing.md
                }}>
                  <h3 style={{ 
                    fontWeight: '600', 
                    color: theme.colors.textBright, 
                    marginBottom: theme.spacing.sm 
                  }}>
                    Active Workflow
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: theme.colors.textMuted }}>Status:</span>
                      <span style={{ color: theme.colors.textBright }}>{workflowStatus.phase}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: theme.colors.textMuted }}>Progress:</span>
                      <span style={{ color: theme.colors.textBright }}>
                        {workflowStatus.completedRounds}/{workflowStatus.maxRounds}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button
                      onClick={() => handleResetWorkflow(workflowStatus.conversationId)}
                      style={{
                        flex: 1,
                        backgroundColor: theme.colors.error,
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => handlePauseWorkflow(workflowStatus.conversationId)}
                      style={{
                        flex: 1,
                        backgroundColor: theme.colors.warning,
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Pause
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  backgroundColor: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius,
                  padding: theme.spacing.md
                }}>
                  <h3 style={{ 
                    fontWeight: '600', 
                    color: theme.colors.textBright, 
                    marginBottom: theme.spacing.sm 
                  }}>
                    No Active Workflow
                  </h3>
                  <p style={{ 
                    color: theme.colors.textMuted, 
                    fontSize: '14px' 
                  }}>
                    Mention agents with @ to start collaboration
                  </p>
                </div>
              )}

              {/* Online Agents */}
              <div style={{
                backgroundColor: theme.colors.backgroundTertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius,
                padding: theme.spacing.md
              }}>
                <h3 style={{ 
                  fontWeight: '600', 
                  color: theme.colors.textBright, 
                  marginBottom: theme.spacing.md 
                }}>
                  Online Agents
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {agents.filter(agent => agent.status === 'online').map(agent => (
                    <div key={agent.id} style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ position: 'relative', marginRight: '12px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          backgroundColor: theme.colors.backgroundSecondary,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px'
                        }}>
                          {agent.avatar || '🤖'}
                        </div>
                        <div style={{
                          position: 'absolute',
                          bottom: '-2px',
                          right: '-2px',
                          width: '12px',
                          height: '12px',
                          backgroundColor: theme.colors.success,
                          borderRadius: '50%',
                          border: `2px solid ${theme.colors.backgroundTertiary}`
                        }}></div>
                      </div>
                      <div>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: theme.colors.textBright 
                        }}>
                          {agent.name}
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: theme.colors.textMuted 
                        }}>
                          {agent.role.replace('-', ' ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedDiscordLayout;
