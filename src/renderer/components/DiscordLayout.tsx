import React, { useState, useEffect } from 'react';
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
  Activity,
  AlertTriangle
} from 'lucide-react';
import { useSocketConnection } from '../hooks/useSocketConnection';
import { useConversationManagement } from '../hooks/useConversationManagement';
import { apiService } from '../utils/api';

// Enhanced Channel Switcher Component
const ChannelSwitcher = ({ activeChannel, onChannelChange, agents }) => {
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');

  const channels = [
    { id: 'general', name: 'General', icon: Hash, type: 'channel' },
    { id: 'project-discussion', name: 'Project Discussion', icon: Hash, type: 'channel' },
    ...agents.map(agent => ({
      id: `dm-${agent.id}`,
      name: agent.name,
      icon: MessageCircle,
      type: 'dm',
      agent
    }))
  ];

  const filteredChannels = channels.filter(channel => 
    channel.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  return (
    <div className="w-60 bg-gray-700 flex flex-col">
      {/* Server Header */}
      <div className="h-12 px-4 flex items-center border-b border-gray-600 cursor-pointer hover:bg-gray-600">
        <h1 className="font-semibold">IntelliSpace Team</h1>
        <div className="ml-auto">
          <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">
            {agents.filter(a => a.status === 'online').length}
          </span>
        </div>
      </div>

      {/* Quick Channel Buttons */}
      <div className="p-2 space-y-1">
        {channels.slice(0, 4).map(channel => (
          <button
            key={channel.id}
            onClick={() => onChannelChange(channel.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              activeChannel === channel.id 
                ? 'bg-indigo-600 text-white' 
                : 'text-gray-300 hover:bg-gray-600 hover:text-white'
            }`}
          >
            <div className="flex items-center">
              <channel.icon size={14} className="mr-2" />
              {channel.type === 'dm' ? `DM: ${channel.name}` : channel.name}
            </div>
          </button>
        ))}
      </div>

      {/* Agents List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="text-xs font-semibold text-gray-400 mb-2">AI AGENTS</div>
        {agents.map(agent => (
          <div
            key={agent.id}
            className="flex items-center px-2 py-2 rounded cursor-pointer text-gray-300 hover:bg-gray-600 hover:text-white group"
            onClick={() => onChannelChange(`dm-${agent.id}`)}
          >
            <div className="relative mr-2">
              <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-lg">
                {agent.avatar || '🤖'}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-700 ${
                agent.status === 'online' ? 'bg-green-400' : 
                agent.status === 'away' ? 'bg-yellow-400' : 'bg-gray-400'
              }`}></div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{agent.name}</div>
              <div className="text-xs text-gray-400">{agent.role.replace('-', ' ')}</div>
            </div>
          </div>
        ))}
      </div>

      {/* User Panel */}
      <div className="h-14 bg-gray-800 flex items-center px-2">
        <div className="flex items-center flex-1">
          <div className="relative mr-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <User size={16} />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800"></div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-white">You</div>
            <div className="text-xs text-gray-400">#1234</div>
          </div>
        </div>
        <div className="flex space-x-1">
          <button className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded">
            <Settings size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Enhanced Message Input Component
const EnhancedMessageInput = ({ agents, onSendMessage, activeChannel, isTyping }) => {
  const [inputValue, setInputValue] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setCursorPosition(e.target.selectionStart);

    // Check for @ mentions
    const lastAtSymbol = value.lastIndexOf('@');
    if (lastAtSymbol !== -1 && lastAtSymbol < e.target.selectionStart) {
      const afterAt = value.substring(lastAtSymbol + 1, e.target.selectionStart);
      if (!afterAt.includes(' ')) {
        setMentionFilter(afterAt);
        setShowMentionDropdown(true);
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const handleMentionSelect = (agent) => {
    const lastAtSymbol = inputValue.lastIndexOf('@');
    const beforeAt = inputValue.substring(0, lastAtSymbol);
    const afterCursor = inputValue.substring(cursorPosition);
    const newValue = beforeAt + `@${agent.name} ` + afterCursor;
    setInputValue(newValue);
    setShowMentionDropdown(false);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    // Parse mentions from the message
    const mentions = [];
    const mentionRegex = /@([A-Za-z0-9\s\-_]+)/g;
    let match;
    while ((match = mentionRegex.exec(inputValue)) !== null) {
      const agentName = match[1].trim();
      const agent = agents.find(a => 
        a.name.toLowerCase().includes(agentName.toLowerCase()) ||
        a.role.toLowerCase().includes(agentName.toLowerCase())
      );
      if (agent) {
        mentions.push(agent.id);
      }
    }

    onSendMessage({
      content: inputValue,
      mentions: mentions,
      conversationId: activeChannel
    });

    setInputValue('');
    setShowMentionDropdown(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(mentionFilter.toLowerCase()) ||
    agent.role.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  return (
    <div className="p-4 bg-gray-750 relative">
      <div className="bg-gray-600 rounded-lg px-4 py-3">
        <div className="flex items-center">
          <Plus size={20} className="text-gray-400 mr-3 cursor-pointer hover:text-white" />
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={`Message ${activeChannel.startsWith('dm-') ? agents.find(a => a.id === activeChannel.replace('dm-', ''))?.name : '#' + activeChannel}... (Use @ to mention agents)`}
              className="w-full bg-transparent text-white placeholder-gray-400 outline-none"
              disabled={isTyping}
            />
            
            {/* Mention Dropdown */}
            {showMentionDropdown && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                {filteredAgents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => handleMentionSelect(agent)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-700 flex items-center"
                  >
                    <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-sm mr-2">
                      {agent.avatar || '🤖'}
                    </div>
                    <div>
                      <div className="text-white text-sm">{agent.name}</div>
                      <div className="text-gray-400 text-xs">{agent.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex space-x-2 ml-3">
            <button className="text-gray-400 hover:text-white">🎁</button>
            <button className="text-gray-400 hover:text-white">😊</button>
          </div>
        </div>
      </div>
      
      {/* Quick mention buttons */}
      <div className="flex space-x-2 mt-2">
        {agents.filter(a => a.status === 'online').map(agent => (
          <button
            key={agent.id}
            onClick={() => {
              setInputValue(prev => prev + `@${agent.name} `);
            }}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded"
          >
            @{agent.name}
          </button>
        ))}
      </div>
    </div>
  );
};

// Workflow Status Panel Component
const WorkflowStatusPanel = ({ conversationId, workflowStatus, onResetWorkflow, agents }) => {
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(true);

  const handleResetWorkflow = async () => {
    try {
      await apiService.forceResetConversation(conversationId);
      onResetWorkflow(conversationId, true);
    } catch (error) {
      console.error('Failed to reset workflow:', error);
    }
  };

  const handlePauseWorkflow = () => {
    // Implement pause functionality
    console.log('Pausing workflow');
  };

  const handleResumeWorkflow = () => {
    // Implement resume functionality
    console.log('Resuming workflow');
  };

  return (
    <>
      {/* Toggle Button */}
      <button 
        onClick={() => setShowWorkflowPanel(!showWorkflowPanel)}
        className={`p-1 rounded ${showWorkflowPanel ? 'text-white bg-gray-600' : 'text-gray-400 hover:text-white hover:bg-gray-600'}`}
      >
        <Activity size={16} />
      </button>

      {/* Workflow Panel */}
      {showWorkflowPanel && (
        <div className="w-80 bg-gray-700 p-4 border-l border-gray-600">
          <div className="space-y-4">
            {/* Workflow Status */}
            {workflowStatus ? (
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">Workflow Status</h3>
                  <div className={`px-2 py-1 rounded text-xs ${
                    workflowStatus.hasActiveMode ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {workflowStatus.currentMode}
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Active Agents:</span>
                    <span className="text-white">{workflowStatus.activeAgents?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Progress:</span>
                    <span className="text-white">{workflowStatus.completedRounds || 0}/{workflowStatus.maxRounds || 1}</span>
                  </div>
                  {workflowStatus.isLocked && (
                    <div className="flex items-center text-yellow-400 text-xs">
                      <AlertTriangle size={12} className="mr-1" />
                      Processing...
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2 mt-4">
                  <button
                    onClick={handleResetWorkflow}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handlePauseWorkflow}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-xs"
                  >
                    Pause
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">No Active Workflow</h3>
                <p className="text-gray-400 text-sm">Mention agents with @ to start collaboration</p>
              </div>
            )}

            {/* Online Agents */}
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-3">Online Agents</h3>
              <div className="space-y-2">
                {agents.filter(agent => agent.status === 'online').map(agent => (
                  <div key={agent.id} className="flex items-center">
                    <div className="relative mr-3">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-lg">
                        {agent.avatar || '🤖'}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800"></div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{agent.name}</div>
                      <div className="text-xs text-gray-400">{agent.role.replace('-', ' ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Main Discord Layout Component
const DiscordLayout = () => {
  const [activeChannel, setActiveChannel] = useState('general');
  const [workflowStatus, setWorkflowStatus] = useState(null);
  const [typingAgents, setTypingAgents] = useState({});
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  
  // Use our existing hooks
  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const { createNewConversation, loadConversationMessages } = useConversationManagement();
  const { socket } = useSocketConnection();

  // Load agents on component mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        setAgentsLoading(true);
        const response = await fetch('http://localhost:3001/api/agents');
        if (response.ok) {
          const agentsData = await response.json();
          setAgents(agentsData);
        } else {
          console.error('Failed to load agents');
        }
      } catch (error) {
        console.error('Error loading agents:', error);
      } finally {
        setAgentsLoading(false);
      }
    };

    loadAgents();
  }, []);

  // Load initial messages for general channel
  useEffect(() => {
    if (agents.length > 0) {
      handleChannelChange('general');
    }
  }, [agents]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Handle typing indicators
    socket.on('typing-indicator', ({ agentId, isTyping }) => {
      setTypingAgents(prev => ({
        ...prev,
        [agentId]: isTyping
      }));
    });

    // Handle workflow status updates
    socket.on('workflow-status', (status) => {
      setWorkflowStatus(status);
    });

    // Handle workflow reset
    socket.on('workflow-reset', () => {
      setWorkflowStatus(null);
      setTypingAgents({});
    });

    // Handle new messages
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
  const handleChannelChange = async (channelId) => {
    setActiveChannel(channelId);
    setWorkflowStatus(null);
    setTypingAgents({});
    setMessagesLoading(true);
    
    try {
      // Load conversation for this channel
      if (channelId.startsWith('dm-')) {
        const agentId = channelId.replace('dm-', '');
        // For now, just clear messages for DM channels
        setMessages([]);
      } else {
        // Load channel conversation messages
        await loadConversationMessages(
          channelId,
          agents,
          setMessages,
          () => {}, // setConversationMemory - not needed for now
          (error) => console.error('Error loading messages:', error)
        );
      }
    } catch (error) {
      console.error('Error changing channel:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Message handling
  const handleSendMessage = async (messageData) => {
    try {
      // Create a new message object
      const newMessage = {
        id: `msg-${Date.now()}`,
        conversationId: activeChannel,
        senderId: 'user',
        content: messageData.content,
        type: 'text',
        timestamp: new Date().toISOString(),
        agent: { id: 'user', name: 'You', avatar: '👤', role: 'user' }
      };

      // Add message to local state
      setMessages(prev => [...prev, newMessage]);

      // Send message to backend via socket
      if (socket) {
        socket.emit('message', {
          conversationId: activeChannel,
          content: messageData.content,
          mentions: messageData.mentions || []
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Workflow controls
  const handleResetWorkflow = async (conversationId, force = false) => {
    try {
      await apiService.forceResetConversation(conversationId);
      setWorkflowStatus(null);
      setTypingAgents({});
    } catch (error) {
      console.error('Failed to reset workflow:', error);
    }
  };

  // Format timestamp for display
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const getChannelDisplayName = () => {
    if (activeChannel.startsWith('dm-')) {
      const agentId = activeChannel.replace('dm-', '');
      const agent = agents.find(a => a.id === agentId);
      return agent ? agent.name : 'Direct Message';
    }
    return activeChannel;
  };

  const isDirectMessage = activeChannel.startsWith('dm-');
  const isTyping = Object.values(typingAgents).some(Boolean);

  if (agentsLoading) {
    return (
      <div className="flex h-screen bg-gray-800 text-white items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-800 text-white font-sans">
      {/* Server List */}
      <div className="w-16 bg-gray-900 flex flex-col items-center py-3 space-y-2">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center cursor-pointer hover:rounded-xl transition-all duration-200">
          <span className="text-white font-bold">AI</span>
        </div>
        <div className="w-8 h-0.5 bg-gray-600 rounded"></div>
        <div className="w-12 h-12 bg-gray-700 rounded-3xl flex items-center justify-center cursor-pointer hover:bg-indigo-600 hover:rounded-xl transition-all duration-200">
          <Hash size={20} />
        </div>
        <div className="w-12 h-12 bg-gray-700 rounded-3xl flex items-center justify-center cursor-pointer hover:bg-green-600 hover:rounded-xl transition-all duration-200">
          <Plus size={20} />
        </div>
      </div>

      {/* Channel Switcher */}
      <ChannelSwitcher 
        activeChannel={activeChannel}
        onChannelChange={handleChannelChange}
        agents={agents}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="h-12 px-4 flex items-center border-b border-gray-600 bg-gray-750">
          {isDirectMessage ? (
            <MessageCircle size={20} className="text-gray-400 mr-2" />
          ) : (
            <Hash size={20} className="text-gray-400 mr-2" />
          )}
          <h2 className="font-semibold text-white">{getChannelDisplayName()}</h2>
          
          <div className="ml-auto flex items-center space-x-3">
            <Bell size={18} className="text-gray-400 hover:text-white cursor-pointer" />
            <AtSign size={18} className="text-gray-400 hover:text-white cursor-pointer" />
            <Users size={18} className="text-gray-400 hover:text-white cursor-pointer" />
            <Search size={18} className="text-gray-400 hover:text-white cursor-pointer" />
            <WorkflowStatusPanel 
              conversationId={activeChannel}
              workflowStatus={workflowStatus}
              onResetWorkflow={handleResetWorkflow}
              agents={agents}
            />
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-750">
          {messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-gray-400">Loading messages...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="flex">
                  <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center mr-3 mt-0.5 text-lg">
                    {message.agent?.avatar || '👤'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline space-x-2 mb-1">
                      <span className="font-semibold text-white">{message.agent?.name || message.senderId}</span>
                      <span className="text-xs text-gray-400">{formatMessageTime(message.timestamp)}</span>
                    </div>
                    <div className="text-gray-300">{message.content}</div>
                    {message.tasks && message.tasks.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {message.tasks.map((task, index) => (
                          <span key={index} className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs">
                            #{task}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing Indicators */}
              {Object.entries(typingAgents).map(([agentId, isTyping]) => {
                if (!isTyping) return null;
                const agent = agents.find(a => a.id === agentId);
                if (!agent) return null;

                return (
                  <div key={`typing-${agentId}`} className="flex">
                    <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center mr-3 mt-0.5 text-lg">
                      {agent.avatar || '🤖'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline space-x-2 mb-1">
                        <span className="font-semibold text-white">{agent.name}</span>
                        <span className="text-xs text-gray-400">typing...</span>
                      </div>
                      <div className="text-gray-400 italic">
                        <span className="animate-pulse">● ● ●</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Enhanced Message Input */}
        <EnhancedMessageInput 
          agents={agents}
          onSendMessage={handleSendMessage}
          activeChannel={activeChannel}
          isTyping={isTyping}
        />
      </div>
    </div>
  );
};

export default DiscordLayout;
