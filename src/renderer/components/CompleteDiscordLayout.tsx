import { useState, useEffect } from 'react';
import { 
  Hash, 
  User, 
  Settings, 
  Plus, 
  Search,
  Bell,
  AtSign,
  Users,
  MessageCircle,
  Activity
} from 'lucide-react';
import { useSocketConnection } from '../hooks/useSocketConnection';
import { useConversationManagement } from '../hooks/useConversationManagement';
import { useDataLoading } from '../hooks/useDataLoading';
import { Message, Agent, Conversation } from '../../shared/types';

const CompleteDiscordLayout = () => {
  // Add CSS animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [activeChannel, setActiveChannel] = useState('general');
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(true);
  const [workflowStatus, setWorkflowStatus] = useState<any>(null);
  const [typingAgents, setTypingAgents] = useState<{ [key: string]: boolean }>({});
  
  // Real data from backend
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { socket } = useSocketConnection();
  const { loadConversationMessages, createNewConversation } = useConversationManagement();
  const { loadInitialData } = useDataLoading();

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await loadInitialData(
          () => {}, // setOllamaStatus
          setAgents,
          setConversations,
          () => {}, // setActiveConversation
          () => {}, // setActiveAgent
          setIsLoading,
          () => {} // setError
        );
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [loadInitialData]);

  // Load messages for current channel
  useEffect(() => {
    const loadMessages = async () => {
      if (!isLoading && activeChannel) {
        const conversationId = getConversationId(activeChannel);
        console.log('🔄 Loading messages for channel:', activeChannel, '→ conversation:', conversationId);
        
        try {
                     await loadConversationMessages(
             conversationId,
             agents,
             setMessages,
             () => {}, // setConversationMemory
             (error: string) => console.error('Error loading messages:', error)
           );
           
           console.log('📨 Messages loaded for conversation:', conversationId);
        } catch (error) {
          console.error('Error loading messages for', conversationId, ':', error);
          setMessages([]);
        }
      }
    };

    loadMessages();
  }, [activeChannel, agents, isLoading, loadConversationMessages]);

  // Join conversation room when channel changes
  useEffect(() => {
    if (socket && activeChannel) {
      const conversationId = getConversationId(activeChannel);
      // Join the conversation room
      socket.emit('join', { conversationId: conversationId });
      console.log('🔗 Joined conversation room:', activeChannel, '→', conversationId);
    }
  }, [socket, activeChannel]);

  // Listen for new messages from backend
  useEffect(() => {
    if (socket) {
      const handleNewMessage = (message: any) => {
        console.log('📨 Received new message from backend:', message);
        const currentConversationId = getConversationId(activeChannel);
        console.log('🔍 Checking if message belongs to current conversation:', message.conversationId, '===', currentConversationId);
        
        // Only add messages for the current channel
        if (message.conversationId === currentConversationId) {
          setMessages((prev: Message[]) => {
            // Check if message already exists
            const exists = prev.some(m => m.id === message.id);
            if (exists) {
              console.log('⚠️ Message already exists, skipping:', message.id);
              return prev;
            }
            console.log('✅ Adding new message to conversation:', message.id);
            return [...prev, message];
          });
        } else {
          console.log('❌ Message not for current conversation, ignoring');
        }
      };

      socket.on('new-message', handleNewMessage);

      return () => {
        socket.off('new-message', handleNewMessage);
      };
    }
  }, [socket, activeChannel]);

  // Channel management
  const handleChannelChange = (channelId: string) => {
    setActiveChannel(channelId);
    setWorkflowStatus(null);
    setTypingAgents({});
    setMessages([]); // Clear messages when switching channels
  };

  // Create new conversation
  const handleCreateConversation = async () => {
    try {
             await createNewConversation(
         conversations,
         agents,
         setConversations,
         setActiveChannel,
         (error: string) => console.error('Error:', error)
       );
       
       console.log('✅ New conversation creation initiated');
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  // Helper function to get the correct conversation ID
  const getConversationId = (channelId: string): string => {
    if (channelId === 'general') {
      return 'general-conversation';
    }
    return channelId;
  };

  // Helper function to get the display name for a channel
  const getChannelDisplayName = (channelId: string): string => {
    if (channelId === 'general') {
      return 'general';
    }
    if (channelId.startsWith('dm-')) {
      const agentId = channelId.replace('dm-', '');
      const agent = agents.find(a => a.id === agentId);
      return agent ? agent.name : 'Direct Message';
    }
    const conversation = conversations.find(c => c.id === channelId);
    return conversation ? conversation.name : channelId;
  };

  // Message handling
  const handleSendMessage = (messageData: { content: string }) => {
    const conversationId = getConversationId(activeChannel);
    console.log('📤 Sending message to channel:', activeChannel, '→ conversation:', conversationId);
    
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId: conversationId,
      senderId: 'user',
      content: messageData.content,
      timestamp: new Date().toISOString(),
      type: 'text',
      agent: { id: 'user', name: 'You', avatar: '👤', role: 'user' }
    };

             setMessages((prev: Message[]) => [...prev, newMessage]);

    // Simulate agent responses based on mentions
    const mentions = extractMentions(messageData.content);
         if (mentions.length > 0) {
       simulateAgentResponses(mentions);
     }

    if (socket) {
      // Use the correct conversation ID for the backend
      socket.emit('message', {
        conversationId: conversationId,
        senderId: 'user',
        content: messageData.content,
        type: 'text',
        mentions: mentions
      });
    }
  };

  // Extract mentions from message
  const extractMentions = (content: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches = content.match(mentionRegex);
    if (!matches) return [];
    
    return matches.map(match => {
      const name = match.slice(1); // Remove @
      const agent = agents.find(a => 
        a.name.toLowerCase().includes(name.toLowerCase()) ||
        a.role.toLowerCase().includes(name.toLowerCase())
      );
      return agent?.id || name;
    }).filter(Boolean);
  };

     // Simulate agent responses for demo
   const simulateAgentResponses = (mentionedAgents: string[]) => {
    const conversationId = getConversationId(activeChannel);
    
    mentionedAgents.forEach((agentId, index) => {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      // Show typing indicator
      setTimeout(() => {
                 setTypingAgents((prev: { [key: string]: boolean }) => ({ ...prev, [agentId]: true }));
      }, (index + 1) * 1000);

      // Send response
      setTimeout(() => {
        setTypingAgents(prev => ({ ...prev, [agentId]: false }));
        
        const responses: { [key: string]: string } = {
          coordinator: 'I\'ll help coordinate this request. Let me break this down into actionable tasks for the team.',
          designer: 'I can help with the visual design and user experience. Let me create some mockups for this.',
          frontend: 'I\'ll handle the frontend implementation. What framework would you prefer for this project?',
          backend: 'I can set up the backend infrastructure and APIs. Do you need user authentication or payment processing?'
        };

        const newMessage: Message = {
          id: `msg-${Date.now()}-${agentId}`,
          conversationId: conversationId,
          senderId: agentId,
          content: responses[agentId] || 'I\'m ready to help with this request!',
          timestamp: new Date().toISOString(),
          type: 'text',
          agent: {
         id: agent.id,
         name: agent.name,
         avatar: agent.avatar || '🤖',
         role: agent.role
       }
        };

        setMessages((prev: Message[]) => [...prev, newMessage]);
      }, (index + 1) * 3000);
    });

    // Update workflow status
    setWorkflowStatus({
      conversationId: conversationId,
      hasActiveMode: true,
      currentMode: mentionedAgents.length === 1 ? 'solo' : 'mini-collaboration',
      isLocked: false,
      lastActivity: Date.now(),
      canReset: true,
      activeAgents: mentionedAgents,
      completedRounds: 0,
      maxRounds: mentionedAgents.length === 1 ? 1 : 2
    });
  };

  // Workflow controls
  const handleResetWorkflow = (conversationId: string) => {
    console.log(`Resetting workflow for ${conversationId}`);
    setWorkflowStatus(null);
    setTypingAgents({});
  };

  const handlePauseWorkflow = (conversationId: string) => {
    console.log(`Pausing workflow for ${conversationId}`);
    setWorkflowStatus(prev => prev ? { ...prev, hasActiveMode: false } : null);
  };

  // Format timestamp for display
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

  const isDirectMessage = activeChannel.startsWith('dm-');

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#2f3136',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Server List */}
      <div style={{
        width: '72px',
        backgroundColor: '#202225',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: '8px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          backgroundColor: '#5865f2',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          const target = e.target as HTMLElement;
          target.style.borderRadius = '12px';
        }}
        onMouseLeave={(e) => {
          const target = e.target as HTMLElement;
          target.style.borderRadius = '16px';
        }}
        >
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>AI</span>
        </div>
        
        <div style={{
          width: '32px',
          height: '2px',
          backgroundColor: '#4f545c',
          borderRadius: '1px'
        }}></div>
        
        <div style={{
          width: '48px',
          height: '48px',
          backgroundColor: '#4f545c',
          borderRadius: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          const target = e.target as HTMLElement;
          target.style.backgroundColor = '#5865f2';
          target.style.borderRadius = '12px';
        }}
        onMouseLeave={(e) => {
          const target = e.target as HTMLElement;
          target.style.backgroundColor = '#4f545c';
          target.style.borderRadius = '24px';
        }}
        >
          <Hash size={20} style={{ color: 'white' }} />
        </div>
        
        <div style={{
          width: '48px',
          height: '48px',
          backgroundColor: '#4f545c',
          borderRadius: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          const target = e.target as HTMLElement;
          target.style.backgroundColor = '#3ba55c';
          target.style.borderRadius = '12px';
        }}
        onMouseLeave={(e) => {
          const target = e.target as HTMLElement;
          target.style.backgroundColor = '#4f545c';
          target.style.borderRadius = '24px';
        }}
        onClick={handleCreateConversation}
        >
          <Plus size={20} style={{ color: 'white' }} />
        </div>
      </div>

      {/* Channel List */}
      <div style={{
        width: '240px',
        backgroundColor: '#2f3136',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Server Header */}
        <div style={{
          height: '48px',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #40444b',
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        }}
        onMouseEnter={(e) => {
          const target = e.target as HTMLElement;
          target.style.backgroundColor = '#40444b';
        }}
        onMouseLeave={(e) => {
          const target = e.target as HTMLElement;
          target.style.backgroundColor = 'transparent';
        }}
        >
          <h1 style={{ 
            fontWeight: '600', 
            fontSize: '16px',
            color: 'white'
          }}>
            IntelliSpace Team
          </h1>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{
              fontSize: '12px',
              backgroundColor: '#3ba55c',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '10px'
            }}>
                             {isLoading ? '...' : agents.filter(a => a.role !== 'user' && a.role !== 'system').length}
            </span>
          </div>
        </div>

        {/* Quick Channel Buttons */}
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* General channel */}
          <button
            onClick={() => handleChannelChange('general')}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '14px',
              transition: 'all 0.2s',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeChannel === 'general' ? '#5865f2' : 'transparent',
              color: activeChannel === 'general' ? 'white' : '#dcddde'
            }}
            onMouseEnter={(e) => {
              if (activeChannel !== 'general') {
                const target = e.target as HTMLElement;
                target.style.backgroundColor = '#40444b';
                target.style.color = 'white';
              }
            }}
            onMouseLeave={(e) => {
              if (activeChannel !== 'general') {
                const target = e.target as HTMLElement;
                target.style.backgroundColor = 'transparent';
                target.style.color = '#dcddde';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Hash size={14} style={{ marginRight: '8px' }} />
              general
            </div>
          </button>

          {/* Real conversations from backend */}
          {conversations.map(conversation => (
            <button
              key={conversation.id}
              onClick={() => handleChannelChange(conversation.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '14px',
                transition: 'all 0.2s',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeChannel === conversation.id ? '#5865f2' : 'transparent',
                color: activeChannel === conversation.id ? 'white' : '#dcddde'
              }}
              onMouseEnter={(e) => {
                if (activeChannel !== conversation.id) {
                  const target = e.target as HTMLElement;
                  target.style.backgroundColor = '#40444b';
                  target.style.color = 'white';
                }
              }}
              onMouseLeave={(e) => {
                if (activeChannel !== conversation.id) {
                  const target = e.target as HTMLElement;
                  target.style.backgroundColor = 'transparent';
                  target.style.color = '#dcddde';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Hash size={14} style={{ marginRight: '8px' }} />
                {conversation.name}
              </div>
            </button>
          ))}
        </div>

        {/* Agents List */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '8px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#96989d',
            marginBottom: '8px'
          }}>
            AI AGENTS
          </div>
          {isLoading ? (
            <div style={{ color: '#96989d', fontSize: '12px', textAlign: 'center', padding: '16px' }}>
              Loading agents...
            </div>
          ) : agents.length === 0 ? (
            <div style={{ color: '#96989d', fontSize: '12px', textAlign: 'center', padding: '16px' }}>
              No agents available
            </div>
          ) : (
            agents.filter(agent => agent.role !== 'user' && agent.role !== 'system').map(agent => (
              <div
                key={agent.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#dcddde',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.backgroundColor = '#40444b';
                  target.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.backgroundColor = 'transparent';
                  target.style.color = '#dcddde';
                }}
                onClick={() => handleChannelChange(`dm-${agent.id}`)}
              >
                <div style={{ position: 'relative', marginRight: '8px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: '#40444b',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}>
                    {agent.avatar || '🤖'}
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    border: '2px solid #2f3136',
                                         backgroundColor: agent.status === 'online' ? '#3ba55c' : '#747f8d'
                  }}></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>{agent.name}</div>
                  <div style={{ fontSize: '12px', color: '#96989d' }}>{agent.role.replace('-', ' ')}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* User Panel */}
        <div style={{
          height: '52px',
          backgroundColor: '#292b2f',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ position: 'relative', marginRight: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#5865f2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <User size={16} style={{ color: 'white' }} />
              </div>
              <div style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '12px',
                height: '12px',
                backgroundColor: '#3ba55c',
                borderRadius: '50%',
                border: '2px solid #292b2f'
              }}></div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: 'white' }}>You</div>
              <div style={{ fontSize: '12px', color: '#96989d' }}>#1234</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              onClick={() => setShowWorkflowPanel(!showWorkflowPanel)}
              style={{
                padding: '4px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: showWorkflowPanel ? '#40444b' : 'transparent',
                color: showWorkflowPanel ? 'white' : '#96989d',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!showWorkflowPanel) {
                  const target = e.target as HTMLElement;
                  target.style.backgroundColor = '#40444b';
                  target.style.color = 'white';
                }
              }}
              onMouseLeave={(e) => {
                if (!showWorkflowPanel) {
                  const target = e.target as HTMLElement;
                  target.style.backgroundColor = 'transparent';
                  target.style.color = '#96989d';
                }
              }}
            >
              <Activity size={16} />
            </button>
            <button style={{
              padding: '4px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: '#96989d',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              const target = e.target as HTMLElement;
              target.style.backgroundColor = '#40444b';
              target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLElement;
              target.style.backgroundColor = 'transparent';
              target.style.color = '#96989d';
            }}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Chat Header */}
        <div style={{
          height: '48px',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #40444b',
          backgroundColor: '#36393f'
        }}>
          {isDirectMessage ? (
            <MessageCircle size={20} style={{ color: '#96989d', marginRight: '8px' }} />
          ) : (
            <Hash size={20} style={{ color: '#96989d', marginRight: '8px' }} />
          )}
          <h2 style={{ fontWeight: '600', color: 'white' }}>{getChannelDisplayName(activeChannel)}</h2>
          
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Bell size={18} style={{ color: '#96989d', cursor: 'pointer' }} />
            <AtSign size={18} style={{ color: '#96989d', cursor: 'pointer' }} />
            <Users size={18} style={{ color: '#96989d', cursor: 'pointer' }} />
            <Search size={18} style={{ color: '#96989d', cursor: 'pointer' }} />
          </div>
        </div>

        {/* Messages Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          backgroundColor: '#36393f'
        }}>
          {isLoading ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%',
              color: '#96989d',
              fontSize: '14px'
            }}>
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%',
              color: '#96989d',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              <div>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>💬</div>
                <div>No messages yet</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>Start a conversation!</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {messages.map((message) => (
                <div key={message.id} style={{ display: 'flex' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#40444b',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px',
                    marginTop: '2px',
                    fontSize: '18px'
                  }}>
                    {message.agent?.avatar || '👤'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '600', color: 'white' }}>
                        {message.agent?.name || message.senderId}
                      </span>
                      <span style={{ fontSize: '12px', color: '#96989d' }}>
                        {formatMessageTime(message.timestamp)}
                      </span>
                    </div>
                    <div style={{ color: '#dcddde' }}>{message.content}</div>
                  </div>
                </div>
              ))}

              {/* Typing Indicators */}
              {Object.entries(typingAgents).map(([agentId, isTyping]) => {
                if (!isTyping) return null;
                const agent = agents.find(a => a.id === agentId);
                if (!agent) return null;

                return (
                  <div key={`typing-${agentId}`} style={{ display: 'flex' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: '#40444b',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px',
                      marginTop: '2px',
                      fontSize: '18px'
                    }}>
                      {agent.avatar || '🤖'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '600', color: 'white' }}>{agent.name}</span>
                        <span style={{ fontSize: '12px', color: '#96989d' }}>typing...</span>
                      </div>
                      <div style={{ color: '#96989d', fontStyle: 'italic' }}>
                        <span style={{ animation: 'pulse 1.5s infinite' }}>● ● ●</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Message Input */}
        <div style={{ padding: '16px', backgroundColor: '#36393f' }}>
          <div style={{
            backgroundColor: '#40444b',
            borderRadius: '8px',
            padding: '12px 16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Plus size={20} style={{ color: '#96989d', marginRight: '12px', cursor: 'pointer' }} />
              <input
                type="text"
                placeholder={`Message ${isDirectMessage ? getChannelDisplayName(activeChannel) : '#' + activeChannel}... (Use @ to mention agents)`}
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  color: 'white',
                  border: 'none',
                  outline: 'none',
                  fontSize: '14px'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                    handleSendMessage({ content: (e.target as HTMLInputElement).value.trim() });
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                <button style={{ color: '#96989d', border: 'none', background: 'transparent', cursor: 'pointer' }}>🎁</button>
                <button style={{ color: '#96989d', border: 'none', background: 'transparent', cursor: 'pointer' }}>😊</button>
              </div>
            </div>
          </div>
          
          {/* Quick mention buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {isLoading ? (
              <div style={{ color: '#96989d', fontSize: '12px' }}>Loading agents...</div>
            ) : (
              agents.filter(a => a.role !== 'user' && a.role !== 'system').map(agent => (
                <button
                  key={agent.id}
                  onClick={() => {
                    const input = document.querySelector('input[placeholder*="Message"]') as HTMLInputElement;
                    if (input) {
                      input.value = `@${agent.name} `;
                      input.focus();
                    }
                  }}
                  style={{
                    fontSize: '12px',
                    backgroundColor: '#40444b',
                    color: '#dcddde',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    const target = e.target as HTMLElement;
                    target.style.backgroundColor = '#4f545c';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.target as HTMLElement;
                    target.style.backgroundColor = '#40444b';
                  }}
                >
                  @{agent.name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Workflow Status Panel */}
      {showWorkflowPanel && (
        <div style={{
          width: '320px',
          backgroundColor: '#2f3136',
          padding: '16px',
          borderLeft: '1px solid #40444b'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Workflow Status */}
            {workflowStatus ? (
              <div style={{
                backgroundColor: '#292b2f',
                border: '1px solid #40444b',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ fontWeight: '600', color: 'white' }}>Workflow Status</h3>
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    backgroundColor: workflowStatus.hasActiveMode ? '#3ba55c' : '#4f545c',
                    color: workflowStatus.hasActiveMode ? 'white' : '#96989d'
                  }}>
                    {workflowStatus.currentMode}
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#96989d' }}>Active Agents:</span>
                    <span style={{ color: 'white' }}>{workflowStatus.activeAgents?.length || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#96989d' }}>Progress:</span>
                    <span style={{ color: 'white' }}>{workflowStatus.completedRounds}/{workflowStatus.maxRounds}</span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button
                    onClick={() => handleResetWorkflow(workflowStatus.conversationId)}
                    style={{
                      flex: 1,
                      backgroundColor: '#ed4245',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      const target = e.target as HTMLElement;
                      target.style.backgroundColor = '#c03537';
                    }}
                    onMouseLeave={(e) => {
                      const target = e.target as HTMLElement;
                      target.style.backgroundColor = '#ed4245';
                    }}
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => handlePauseWorkflow(workflowStatus.conversationId)}
                    style={{
                      flex: 1,
                      backgroundColor: '#faa61a',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      const target = e.target as HTMLElement;
                      target.style.backgroundColor = '#d68910';
                    }}
                    onMouseLeave={(e) => {
                      const target = e.target as HTMLElement;
                      target.style.backgroundColor = '#faa61a';
                    }}
                  >
                    Pause
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                backgroundColor: '#292b2f',
                border: '1px solid #40444b',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <h3 style={{ fontWeight: '600', color: 'white', marginBottom: '8px' }}>No Active Workflow</h3>
                <p style={{ color: '#96989d', fontSize: '14px' }}>Mention agents with @ to start collaboration</p>
              </div>
            )}

            {/* Online Agents */}
            <div style={{
              backgroundColor: '#292b2f',
              border: '1px solid #40444b',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <h3 style={{ fontWeight: '600', color: 'white', marginBottom: '12px' }}>Online Agents</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {isLoading ? (
                  <div style={{ color: '#96989d', fontSize: '12px', textAlign: 'center', padding: '8px' }}>
                    Loading agents...
                  </div>
                ) : agents.length === 0 ? (
                  <div style={{ color: '#96989d', fontSize: '12px', textAlign: 'center', padding: '8px' }}>
                    No agents available
                  </div>
                ) : (
                  agents.filter(agent => agent.role !== 'user' && agent.role !== 'system').map(agent => (
                    <div key={agent.id} style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ position: 'relative', marginRight: '12px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          backgroundColor: '#40444b',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px'
                        }}>
                          {agent.avatar || '🤖'}
                        </div>
                        <div style={{
                          position: 'absolute',
                          bottom: '-2px',
                          right: '-2px',
                          width: '12px',
                          height: '12px',
                          backgroundColor: '#3ba55c',
                          borderRadius: '50%',
                          border: '2px solid #292b2f'
                        }}></div>
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: 'white' }}>{agent.name}</div>
                        <div style={{ fontSize: '12px', color: '#96989d' }}>{agent.role.replace('-', ' ')}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompleteDiscordLayout;
