import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Brain, 
  Settings, 
  Plus, 
  Hash,
  Database,
  Bot,
  Send,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Loader,
  AlertCircle,
  Check,
  RefreshCw,
  Play,
  Users,
  Clock,
  CheckCircle,
  Trash2,
  User,
  MessageSquare
} from 'lucide-react';

// Type definitions
interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  status: 'online' | 'busy' | 'offline';
  config: {
    llmProvider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
  };
}

interface Conversation {
  id: string;
  name: string;
  type: string;
  projectId: string;
  participants: string[];
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  timestamp: string;
}

interface OllamaStatus {
  available: boolean;
  models: string[];
}

interface Memory {
  [key: string]: any;
}

// API configuration
const API_URL = 'http://localhost:3001/api';

// Theme definition
const theme = {
  colors: {
    primary: '#5865F2',
    primaryHover: '#4752C4',
    background: '#36393f',
    backgroundSecondary: '#2f3136',
    backgroundTertiary: '#202225',
    text: '#dcddde',
    textMuted: '#96989d',
    textBright: '#ffffff',
    border: '#202225',
    success: '#3ba55d',
    warning: '#faa61a',
    error: '#ed4245',
    info: '#5865F2',
    hover: '#32353b',
    active: '#393c43'
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  borderRadius: '8px',
  fonts: {
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace'
  }
};

// API Service
class ApiService {
  async fetchAgents(): Promise<Agent[]> {
    try {
      const response = await fetch(`${API_URL}/agents`);
      if (!response.ok) throw new Error('Failed to fetch agents');
      return await response.json();
    } catch (error) {
      console.error('Error fetching agents:', error);
      return [];
    }
  }

  async createAgent(agent: Omit<Agent, 'id' | 'status'>): Promise<Agent> {
    try {
      const response = await fetch(`${API_URL}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent)
      });
      if (!response.ok) throw new Error('Failed to create agent');
      return await response.json();
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  }

  async deleteAgent(agentId: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/agents/${agentId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete agent');
    } catch (error) {
      console.error('Error deleting agent:', error);
      throw error;
    }
  }

  async deleteAllAgents(): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/agents/clear`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to clear agents');
    } catch (error) {
      console.error('Error clearing agents:', error);
      throw error;
    }
  }

  async fetchConversations(projectId?: string): Promise<Conversation[]> {
    try {
      const response = await fetch(`${API_URL}/conversations${projectId ? `?projectId=${projectId}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return await response.json();
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  }

  async createConversation(conversation: Omit<Conversation, 'id'>): Promise<Conversation> {
    try {
      const response = await fetch(`${API_URL}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversation)
      });
      if (!response.ok) throw new Error('Failed to create conversation');
      return await response.json();
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  async fetchMessages(conversationId: string): Promise<Message[]> {
    try {
      const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return await response.json();
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  async sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    try {
      const response = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      if (!response.ok) throw new Error('Failed to send message');
      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async processWithOllama(prompt: string, model: string = 'llama2', agentContext: any = {}): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/ollama/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model,
          context: agentContext,
          stream: false
        })
      });
      if (!response.ok) throw new Error('Failed to process with Ollama');
      return await response.json();
    } catch (error) {
      console.error('Error processing with Ollama:', error);
      throw error;
    }
  }

  async checkOllamaStatus(): Promise<OllamaStatus> {
    try {
      const response = await fetch(`${API_URL}/ollama/status`);
      if (!response.ok) throw new Error('Ollama not available');
      return await response.json();
    } catch (error) {
      console.error('Error checking Ollama status:', error);
      return { available: false, models: [] };
    }
  }

  async getMemory(scope: string, scopeId: string): Promise<Memory> {
    try {
      const response = await fetch(`${API_URL}/memory/${scope}/${scopeId}`);
      if (!response.ok) throw new Error('Failed to fetch memory');
      return await response.json();
    } catch (error) {
      console.error('Error fetching memory:', error);
      return {};
    }
  }

  async updateMemory(scope: string, scopeId: string, data: Memory): Promise<Memory> {
    try {
      const response = await fetch(`${API_URL}/memory/${scope}/${scopeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update memory');
      return await response.json();
    } catch (error) {
      console.error('Error updating memory:', error);
      throw error;
    }
  }

  async reloadAgents(): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/agents/reload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to reload agents');
    } catch (error) {
      console.error('Error reloading agents:', error);
      throw error;
    }
  }
}

const apiService = new ApiService();

// Styles (keeping the same as before but adding some new ones)
const styles = {
  global: {
    margin: 0,
    padding: 0,
    boxSizing: 'border-box' as const,
    fontFamily: theme.fonts.body,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  },
  appContainer: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    background: theme.colors.background
  },
  sidebar: (collapsed: boolean) => ({
    width: collapsed ? '72px' : '240px',
    background: theme.colors.backgroundTertiary,
    display: 'flex',
    flexDirection: 'column' as const,
    transition: 'width 0.2s ease',
    borderRight: `1px solid ${theme.colors.border}`
  }),
  sidebarHeader: {
    height: '48px',
    padding: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${theme.colors.border}`
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontWeight: 'bold',
    color: theme.colors.textBright
  },
  agentList: {
    flex: 1,
    padding: theme.spacing.sm,
    overflowY: 'auto' as const
  },
  agentSection: {
    marginBottom: theme.spacing.md
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    color: theme.colors.textMuted,
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    userSelect: 'none' as const
  },
  agentItem: (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    margin: '2px 0',
    borderRadius: '4px',
    cursor: 'pointer',
    background: active ? theme.colors.active : 'transparent',
    transition: 'background 0.2s'
  }),
  agentAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const
  },
  statusIndicator: (status: string) => ({
    content: '""',
    position: 'absolute' as const,
    bottom: '-2px',
    right: '-2px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: `2px solid ${theme.colors.backgroundTertiary}`,
    background: status === 'online' ? theme.colors.success :
                status === 'busy' ? theme.colors.warning :
                theme.colors.textMuted
  }),
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const
  },
  conversationHeader: {
    height: '48px',
    padding: `0 ${theme.spacing.md}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${theme.colors.border}`,
    background: theme.colors.background
  },
  conversationTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontWeight: 600,
    color: theme.colors.textBright
  },
  messagesContainer: {
    flex: 1,
    padding: theme.spacing.md,
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: theme.spacing.md
  },
  message: {
    display: 'flex',
    gap: theme.spacing.md
  },
  messageAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  messageContent: {
    flex: 1
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs
  },
  messageAuthor: {
    fontWeight: 600,
    color: theme.colors.textBright
  },
  messageTime: {
    fontSize: '12px',
    color: theme.colors.textMuted
  },
  messageText: {
    color: theme.colors.text,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap' as const,
    wordWrap: 'break-word' as const
  },
  inputContainer: {
    padding: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`
  },
  inputWrapper: {
    display: 'flex',
    gap: theme.spacing.sm,
    background: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius,
    padding: theme.spacing.sm
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: theme.colors.text,
    fontSize: '14px'
  },
  sendButton: (disabled: boolean) => ({
    background: theme.colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: theme.spacing.sm,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
    opacity: disabled ? 0.5 : 1
  }),
  memoryPanel: (visible: boolean) => ({
    width: visible ? '320px' : '0',
    background: theme.colors.backgroundSecondary,
    borderLeft: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column' as const,
    transition: 'width 0.2s ease',
    overflow: 'hidden'
  }),
  memoryHeader: {
    height: '48px',
    padding: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${theme.colors.border}`
  },
  memoryContent: {
    flex: 1,
    padding: theme.spacing.md,
    overflowY: 'auto' as const
  },
  jsonEditor: {
    background: theme.colors.backgroundTertiary,
    borderRadius: '4px',
    padding: theme.spacing.sm,
    fontFamily: theme.fonts.mono,
    fontSize: '12px',
    color: theme.colors.text,
    overflowX: 'auto' as const,
    whiteSpace: 'pre' as const,
    border: 'none',
    outline: 'none',
    width: '100%',
    minHeight: '100px',
    resize: 'vertical' as const
  },
  addAgentButton: {
    width: '100%',
    padding: '8px',
    background: theme.colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background 0.2s'
  },
  statusBar: {
    height: '24px',
    background: theme.colors.backgroundTertiary,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    padding: `0 ${theme.spacing.sm}`,
    fontSize: '12px',
    color: theme.colors.textMuted,
    gap: theme.spacing.md
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  loadingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  errorMessage: {
    background: theme.colors.error,
    color: 'white',
    padding: theme.spacing.sm,
    borderRadius: '4px',
    margin: theme.spacing.sm,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm
  }
};

// Main App Component
export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [memoryVisible, setMemoryVisible] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [agentSectionExpanded, setAgentSectionExpanded] = useState(true);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({ available: false, models: [] });
  const [projectMemory, setProjectMemory] = useState<Memory>({});
  const [conversationMemory, setConversationMemory] = useState<Memory>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showTeamTester, setShowTeamTester] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: '',
    role: '',
    description: '',
    model: 'llama3',
    temperature: 0.7,
    maxTokens: 4000,
    systemPrompt: ''
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    console.log('🔌 Connecting to Socket.IO server...');
    
    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      autoConnect: true
    });
    
    socket.on('connect', () => {
      console.log('✅ Socket.IO connected!', socket.id);
      
      // Join the active conversation if one exists
      if (activeConversation) {
        socket.emit('join', { 
          conversationId: activeConversation 
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('🚨 Socket.IO connection error:', error);
      setError(`Connection error: ${error.message}. Please check if the backend is running.`);
    });

    // Handle incoming messages
    socket.on('new-message', (message: Message) => {
      console.log('📨 New message received:', message);
      setMessages(prev => [...prev, message]);
    });

    // Handle typing indicators
    socket.on('typing-indicator', (data: { conversationId: string; agentId: string; isTyping: boolean }) => {
      console.log('⌨️ Typing indicator:', data);
      // Update UI to show typing indicator
    });

    // Handle agent status updates
    socket.on('agent-status', (data: { agentId: string; status: string }) => {
      console.log('🤖 Agent status update:', data);
      setAgents(prev => prev.map(agent => 
        agent.id === data.agentId 
          ? { ...agent, status: data.status as any }
          : agent
      ));
    });

    // Handle memory updates
    socket.on('memory-updated', (data: { scope: string; scopeId: string; memory: any }) => {
      console.log('🧠 Memory updated:', data);
      if (data.scope === 'conversation' && data.scopeId === activeConversation) {
        setConversationMemory(data.memory);
      } else if (data.scope === 'project') {
        setProjectMemory(data.memory);
      }
    });

    // Handle errors
    socket.on('error', (error: any) => {
      console.error('🚨 Socket error:', error);
      setError(`Server error: ${error.message}`);
    });

    socketRef.current = socket;

    return () => {
      console.log('🔌 Cleaning up Socket.IO connection');
      socket.disconnect();
    };
  }, [activeConversation]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set global styles
  useEffect(() => {
    Object.assign(document.body.style, styles.global);
    return () => {
      document.body.style.cssText = '';
    };
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Check Ollama status
      try {
        const ollamaStatus = await apiService.checkOllamaStatus();
        setOllamaStatus(ollamaStatus);
      } catch (err) {
        console.warn('Could not check Ollama status:', err);
        setOllamaStatus({ available: false, models: [] });
      }

      // Load agents
      let agentsData: Agent[] = [];
      try {
        agentsData = await apiService.fetchAgents();
      } catch (err) {
        console.warn('Could not fetch agents:', err);
        agentsData = [];
      }

      const agentsWithStatus = agentsData.map(agent => ({
        ...agent,
        status: 'online' as const
      }));
      console.log('🤖 Loaded agents:', agentsWithStatus);
      setAgents(agentsWithStatus);

      // Load conversations
      let conversationsData: Conversation[] = [];
      try {
        conversationsData = await apiService.fetchConversations();
      } catch (err) {
        console.warn('Could not fetch conversations:', err);
        conversationsData = [];
      }

      setConversations(conversationsData);
      
      // Set first conversation as active if any exist
      if (conversationsData.length > 0) {
        setActiveConversation(conversationsData[0].id);
      }

      // Set first agent as active if any exist
      if (agentsData.length > 0) {
        setActiveAgent(agentsData[0].id);
      }

    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Failed to load initial data. Please check if the backend server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    try {
      const messagesData = await apiService.fetchMessages(conversationId);
      console.log('📨 Loaded messages:', messagesData);
      console.log('🤖 Available agents:', agents);
      
      // Check for any messages with unknown senderIds
      const unknownSenders = messagesData.filter(msg => 
        msg.senderId !== 'user' && !agents.find(a => a.id === msg.senderId)
      );
      if (unknownSenders.length > 0) {
        console.warn('⚠️ Messages with unknown senderIds:', unknownSenders);
        console.warn('🤖 Available agent IDs:', agents.map(a => a.id));
      }
      
      setMessages(messagesData);
      
      // Load conversation memory
      const memory = await apiService.getMemory('conversation', conversationId);
      setConversationMemory(memory);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    }
  };

  // Handle conversation changes and Socket.IO room joining
  useEffect(() => {
    if (activeConversation && socketRef.current) {
      // Join the new conversation room
      socketRef.current.emit('join', { conversationId: activeConversation });
      // Load messages for the conversation
      loadConversationMessages(activeConversation);
    }
  }, [activeConversation]);

  const handleSendMessage = async () => {
    if (inputValue.trim() && activeAgent && activeConversation) {
      setIsProcessing(true);
      
      try {
        // Send user message
        const userMessage = await apiService.sendMessage({
          conversationId: activeConversation,
          senderId: 'user',
          content: inputValue,
          type: 'text'
        });

        setMessages(prev => [...prev, userMessage]);
        
        const userInput = inputValue;
        setInputValue('');

        // Process with Ollama through the active agent
        const agent = agents.find(a => a.id === activeAgent);
        if (agent && ollamaStatus.available) {
          // Get agent response
          const response = await apiService.processWithOllama(
            userInput,
            agent.config?.model || 'llama2',
            {
              systemPrompt: agent.config?.systemPrompt,
              conversationHistory: messages.slice(-10), // Last 10 messages for context
              memory: conversationMemory
            }
          );

          // Send agent response
          const agentMessage = await apiService.sendMessage({
            conversationId: activeConversation,
            senderId: activeAgent,
            content: response.response || response.text || 'I understand. Let me help you with that.',
            type: 'text'
          });

          setMessages(prev => [...prev, agentMessage]);
        }
      } catch (err) {
        console.error('Error sending message:', err);
        setError('Failed to send message');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleMemoryUpdate = async () => {
    try {
      if (activeConversation) {
        await apiService.updateMemory('conversation', activeConversation, conversationMemory);
        // Show success feedback
      }
    } catch (err) {
      console.error('Error updating memory:', err);
      setError('Failed to update memory');
    }
  };

  const createNewConversation = async () => {
    try {
      const newConversation = await apiService.createConversation({
        projectId: 'default',
        name: `Conversation ${conversations.length + 1}`,
        type: 'group',
        participants: agents.map(a => a.id)
      });
      setConversations(prev => [...prev, newConversation]);
      setActiveConversation(newConversation.id);
    } catch (err) {
      console.error('Error creating conversation:', err);
      setError('Failed to create conversation');
    }
  };

  const createNewAgent = async () => {
    try {
      const agentData = {
        name: newAgent.name,
        role: newAgent.role,
        description: newAgent.description,
        config: {
          llmProvider: 'ollama',
          model: newAgent.model,
          temperature: newAgent.temperature,
          maxTokens: newAgent.maxTokens,
          systemPrompt: newAgent.systemPrompt
        }
      };

      const createdAgent = await apiService.createAgent(agentData);
      setAgents(prev => [...prev, { ...createdAgent, status: 'online' }]);
      
      // Reset form and close modal
      setNewAgent({
        name: '',
        role: '',
        description: '',
        model: 'llama3',
        temperature: 0.7,
        maxTokens: 4000,
        systemPrompt: ''
      });
      setShowAgentModal(false);
    } catch (err) {
      console.error('Error creating agent:', err);
      setError('Failed to create agent');
    }
  };

  const clearAllAgents = async () => {
    try {
      // Get agents to delete (all except system and user agents)
      const agentsToDelete = agents.filter(agent => 
        agent.id !== 'system-agent' && agent.id !== 'user-agent'
      );
      
      // Delete each agent from backend
      for (const agent of agentsToDelete) {
        try {
          await apiService.deleteAgent(agent.id);
        } catch (err) {
          console.warn(`Failed to delete agent ${agent.name}:`, err);
        }
      }
      
      // Update frontend state
      const agentsToKeep = agents.filter(agent => 
        agent.id === 'system-agent' || agent.id === 'user-agent'
      );
      setAgents(agentsToKeep);
      
      console.log('Cleared all agents except system agents');
    } catch (err) {
      console.error('Error clearing agents:', err);
      setError('Failed to clear agents');
    }
  };

  const createWebsiteTeam = async () => {
    try {
      // Clear existing agents first (except system/user)
      await clearAllAgents();
      
      const enhancedWebTeam = [
        // 1. COORDINATOR AGENT - The missing piece!
        {
          name: 'Project Coordinator',
          role: 'coordinator',
          description: 'Coordinates tasks between team members, manages project workflow, and delegates user requests',
          config: {
            llmProvider: 'ollama',
            model: 'llama3',
            temperature: 0.3, // Lower temperature for more consistent coordination
            maxTokens: 4000,
            systemPrompt: `You are a Project Coordinator for a web development team. Your primary role is to orchestrate collaboration between team members.

COLLABORATION APPROACH:
- **Natural Triggers**: Use phrases like "I need input from @designer on the user flow" or "Let's work together on this"
- **Build on Ideas**: Reference what others have said and expand on their contributions
- **Facilitate Discussion**: Encourage team members to share their expertise
- **Coordinate Workflow**: Guide the natural flow from design → frontend → backend

TEAM MEMBERS:
- UI/UX Designer: Creates designs, wireframes, mockups, user flows
- Frontend Developer: Implements UI, handles client-side logic, React/HTML/CSS  
- Backend Developer: Creates APIs, database design, server logic, business logic

COLLABORATION PATTERNS:
1. **Initial Analysis**: "Based on the user request, I think we need to collaborate on..."
2. **Natural Delegation**: "I need @designer to help with the user experience flow"
3. **Progress Updates**: "Great work from @frontend on the UI. Now we need @backend for the API"
4. **Integration**: "Let's coordinate between @designer and @frontend on the component design"

RESPONSE STYLE:
- Be conversational and collaborative
- Acknowledge team members' contributions
- Use natural language to trigger collaboration
- Reference conversation memory for context
- Suggest next steps that involve other team members

Example collaboration:
"I see we need a restaurant website. Let me coordinate with our team:

**Immediate Actions:**
@designer: Create wireframes for homepage, menu page, and reservation form by end of day
@frontend: Confirm if you prefer React with Tailwind CSS for this project
@backend: Design the menu API endpoints and reservation system database schema

**Timeline:** Design → Frontend → Backend integration → Testing

Let's work together to make this restaurant website stand out!"

Remember: You're facilitating natural collaboration, not just delegating tasks.`
          }
        },

        // 2. ENHANCED UI/UX DESIGNER
        {
          name: 'UI/UX Designer',
          role: 'designer',
          description: 'Creates comprehensive UI/UX designs, wireframes, and design systems',
          config: {
            llmProvider: 'ollama',
            model: 'llama3',
            temperature: 0.8,
            maxTokens: 4000,
            systemPrompt: `You are a professional UI/UX Designer working in a collaborative web development team.

COLLABORATION APPROACH:
- **Natural Communication**: Use phrases like "I need to coordinate with @frontend on the implementation" or "Let's work together on this design"
- **Build on Context**: Reference what others have said and design accordingly
- **Share Expertise**: Offer design insights that help the team
- **Request Input**: Ask for technical feedback from @frontend and @backend when needed

YOUR ROLE:
- Create detailed design specifications and wireframes
- Design user flows and information architecture
- Establish design systems (colors, typography, components)
- Ensure accessibility and usability best practices
- Collaborate with frontend developers on implementation feasibility
- Respond to design feedback and iterate on designs

DESIGN PROCESS:
1. **Requirements Analysis**: Understand user needs and business goals
2. **User Research**: Consider user personas and use cases
3. **Wireframing**: Create low-fidelity layouts and user flows
4. **Visual Design**: Apply colors, typography, spacing, and branding
5. **Prototyping**: Define interactions and micro-animations
6. **Specifications**: Provide detailed specs for developers

COLLABORATION PATTERNS:
- "I'll create the design system, then we can work with @frontend on implementation"
- "This design approach would work well with @backend's API structure"
- "Let me coordinate with @coordinator on the project requirements"
- "I need input from @frontend on the technical feasibility of this interaction"

RESPONSE STYLE:
- Be collaborative and open to feedback
- Reference team members naturally in your responses
- Suggest how your design work enables others' contributions
- Use conversation memory to build on previous discussions
- Update shared memory with design decisions and asset locations

DELIVERABLES FORMAT:
When providing designs, include:
- **Component Specifications**: Exact dimensions, colors, typography
- **User Flow**: Step-by-step user journey
- **Responsive Behavior**: Mobile, tablet, desktop considerations
- **Accessibility Notes**: ARIA labels, contrast ratios, keyboard navigation
- **Asset Requirements**: Images, icons, fonts needed

COMMUNICATION STYLE:
- Be specific about design requirements
- Ask clarifying questions about user needs
- Provide rationale for design decisions
- Collaborate openly with team members

Example response:
"Based on the login page requirement, I'll create:
1. User flow wireframe (login → dashboard)
2. Component specifications (form fields, buttons, validation states)
3. Responsive layout for mobile/desktop
4. Accessibility considerations for screen readers

@frontend: I'll need to know your preferred CSS framework for optimal component design
@coordinator: Should we include social login options in this iteration?"`
          }
        },

        // 3. ENHANCED FRONTEND DEVELOPER
        {
          name: 'Frontend Developer',
          role: 'frontend-developer',
          description: 'Implements modern, responsive user interfaces with React and modern frontend technologies',
          config: {
            llmProvider: 'ollama',
            model: 'llama3',
            temperature: 0.6,
            maxTokens: 4000,
            systemPrompt: `You are a professional Frontend Developer working in a collaborative web development team.

COLLABORATION APPROACH:
- **Natural Communication**: Use phrases like "I need to coordinate with @designer on the component specs" or "Let's work together on this implementation"
- **Build on Context**: Reference what others have said and implement accordingly
- **Share Expertise**: Offer technical insights that help the team
- **Request Input**: Ask for design feedback from @designer and API details from @backend

YOUR EXPERTISE:
- React/TypeScript development with modern hooks and state management
- CSS/Sass/Styled-components for responsive, accessible designs
- Frontend build tools (Vite, Webpack) and package management
- Performance optimization and code splitting
- Testing with Jest/React Testing Library
- API integration and state management (Redux, Zustand, React Query)

DEVELOPMENT APPROACH:
1. **Component Architecture**: Create reusable, maintainable components
2. **Responsive Design**: Mobile-first, cross-browser compatibility
3. **Performance**: Code splitting, lazy loading, optimization
4. **Accessibility**: ARIA labels, keyboard navigation, screen reader support
5. **Testing**: Unit tests for components and integration tests
6. **Code Quality**: Clean, documented, maintainable code

COLLABORATION PATTERNS:
- "I'll implement the design from @designer, then coordinate with @backend for API integration"
- "This component structure would work well with @backend's data format"
- "I need clarification from @designer on the responsive behavior"
- "Let me coordinate with @coordinator on the implementation timeline"

RESPONSE STYLE:
- Be collaborative and open to feedback
- Reference team members naturally in your responses
- Suggest how your implementation enables others' work
- Use conversation memory to build on previous discussions
- Ask for input when you need design or API details

COLLABORATION WORKFLOW:
- Implement designs provided by @designer with pixel-perfect accuracy
- Coordinate with @backend for API integration and data structures
- Report to @coordinator on progress and any blockers
- Update shared memory with component documentation and API requirements

DELIVERABLES:
- Clean, commented React/TypeScript code
- Responsive CSS with mobile-first approach
- Component documentation and usage examples
- Integration with backend APIs
- Performance metrics and optimization notes

Example collaboration:
"I'll implement the dashboard based on @designer's specifications. I need to coordinate with @backend on the API endpoints for user data and menu items. Let's work together to ensure the frontend and backend integrate smoothly!"

**Dependencies:**
@backend: Need user data API endpoints (/api/user/profile, /api/dashboard/stats)
@designer: Confirm mobile navigation pattern (hamburger vs bottom tabs)

**Implementation:**
\`\`\`tsx
const Dashboard = () => {
  const { user } = useAuth();
  const { data, loading } = useQuery('/api/dashboard/stats');
  
  return (
    <DashboardLayout>
      <UserProfile user={user} />
      <NavigationSidebar />
      <DataVisualization data={data} loading={loading} />
    </DashboardLayout>
  );
};
\`\`\`

Timeline: 3-4 days including testing and responsive implementation"`
          }
        },

        // 4. ENHANCED BACKEND DEVELOPER
        {
          name: 'Backend Developer',
          role: 'backend-developer',
          description: 'Designs and implements scalable backend systems, APIs, and database architecture',
          config: {
            llmProvider: 'ollama',
            model: 'llama3',
            temperature: 0.5,
            maxTokens: 4000,
            systemPrompt: `You are a professional Backend Developer working in a collaborative web development team.

COLLABORATION APPROACH:
- **Natural Communication**: Use phrases like "I need to coordinate with @frontend on the API structure" or "Let's work together on this backend architecture"
- **Build on Context**: Reference what others have said and design accordingly
- **Share Expertise**: Offer technical insights that help the team
- **Request Input**: Ask for requirements from @frontend and design considerations from @designer

YOUR EXPERTISE:
- API design and implementation (REST, GraphQL)
- Database design and optimization (PostgreSQL, MongoDB, Redis)
- Authentication and authorization (JWT, OAuth, RBAC)
- Server architecture (Node.js, Express, microservices)
- Security best practices and data protection
- Performance optimization and caching strategies
- Testing (unit, integration, load testing)

DEVELOPMENT APPROACH:
1. **API Design**: RESTful endpoints with clear documentation
2. **Database Schema**: Normalized, efficient data structures
3. **Security**: Authentication, authorization, input validation
4. **Performance**: Caching, indexing, query optimization
5. **Scalability**: Modular architecture, horizontal scaling considerations
6. **Documentation**: OpenAPI specs, endpoint documentation

COLLABORATION PATTERNS:
- "I'll design the API structure, then coordinate with @frontend on the data format"
- "This database schema would support @designer's data visualization needs"
- "I need clarification from @frontend on the authentication flow"
- "Let me coordinate with @coordinator on the backend architecture timeline"

RESPONSE STYLE:
- Be collaborative and open to feedback
- Reference team members naturally in your responses
- Suggest how your backend work enables others' contributions
- Use conversation memory to build on previous discussions
- Ask for input when you need frontend or design requirements

COLLABORATION WORKFLOW:
- Design APIs based on frontend requirements from @frontend
- Consider data visualization needs from @designer
- Report progress and technical constraints to @coordinator
- Update shared memory with API documentation and database schemas

TECHNICAL CONSIDERATIONS:
- Design APIs that support frontend state management patterns
- Plan for real-time features (WebSockets, SSE) when needed
- Consider mobile app support in API design
- Implement proper error handling and logging

Example collaboration:
"I'll design the restaurant API structure based on the requirements. I need to coordinate with @frontend on the data format for menu items and reservations. Let's work together to ensure the API supports all the frontend features we discussed!"`
          }
        }
      ];

      // Create all agents
      const createdAgents: Agent[] = [];
      for (const agentData of enhancedWebTeam) {
        console.log('🔄 Creating agent:', agentData.name);
        try {
          const createdAgent = await apiService.createAgent(agentData);
          console.log('✅ Created agent:', createdAgent);
          createdAgents.push(createdAgent);
        } catch (error) {
          console.error('❌ Failed to create agent:', agentData.name, error);
          throw error;
        }
      }

      // Add all agents to state
      setAgents(prev => [...prev, ...createdAgents.map(agent => ({ ...agent, status: 'online' as const }))]);
      
      // Reload agents in the backend orchestrator to ensure they're in memory
      try {
        await apiService.reloadAgents();
        console.log('✅ Reloaded agents in backend orchestrator');
      } catch (error) {
        console.warn('⚠️ Could not reload agents in backend:', error);
      }

      // Create a team conversation with proper participant order
      const teamConversation = await apiService.createConversation({
        projectId: 'default',
        name: 'Web Development Team - Enhanced',
        type: 'group',
        participants: [
          'user-agent', // User first
          createdAgents[0].id, // Coordinator second
          ...createdAgents.slice(1).map(a => a.id) // Then specialists
        ]
      });

      setConversations(prev => [...prev, teamConversation]);
      setActiveConversation(teamConversation.id);
      setActiveAgent(createdAgents[0].id); // Start with coordinator

      // Initialize shared workspace memory
      const initialWorkspace = {
        project: {
          name: "Web Development Project",
          status: "planning",
          created: new Date().toISOString(),
          team: {
            coordinator: createdAgents[0].id,
            designer: createdAgents[1].id,
            frontend: createdAgents[2].id,
            backend: createdAgents[3].id
          }
        },
        requirements: {},
        design: {
          wireframes: {},
          components: {},
          designSystem: {}
        },
        frontend: {
          components: {},
          pages: {},
          apis: {}
        },
        backend: {
          endpoints: {},
          database: {},
          authentication: {}
        },
        timeline: {},
        decisions: []
      };

      // Update shared memory
      await apiService.updateMemory('conversation', teamConversation.id, initialWorkspace);

      console.log('Enhanced web development team created successfully!');
      console.log('Team members:', createdAgents.map(a => `${a.name} (${a.role})`));

    } catch (err) {
      console.error('Error creating enhanced web development team:', err);
      setError('Failed to create enhanced web development team');
    }
  };

  return (
    <div style={styles.appContainer}>
      {isLoading && (
        <div style={styles.loadingOverlay}>
          <Loader size={48} color={theme.colors.primary} className="animate-spin" />
        </div>
      )}

      {error && (
        <div style={{
          ...styles.errorMessage,
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          maxWidth: '300px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <AlertCircle size={16} />
          <span style={{ flex: 1, marginLeft: '8px' }}>{error}</span>
          <X 
            size={16} 
            style={{ cursor: 'pointer', marginLeft: '8px' }}
            onClick={() => setError(null)}
          />
        </div>
      )}

      <div style={styles.sidebar(sidebarCollapsed)}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logo}>
            {!sidebarCollapsed && (
              <>
                <Brain size={20} />
                <span>IntelliSpace</span>
              </>
            )}
          </div>
          <Menu 
            size={20} 
            style={{ cursor: 'pointer', color: theme.colors.text }}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>
        
        <div style={styles.agentList}>
          <div style={styles.agentSection}>
            <div 
              style={styles.sectionHeader}
              onClick={() => setAgentSectionExpanded(!agentSectionExpanded)}
            >
              {agentSectionExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {!sidebarCollapsed && 'Active Agents'}
            </div>
            {agentSectionExpanded && agents.map(agent => (
              <div 
                key={agent.id}
                style={{
                  ...styles.agentItem(agent.id === activeAgent),
                  background: agent.id === activeAgent 
                    ? theme.colors.active 
                    : hoveredAgent === agent.id 
                    ? theme.colors.hover 
                    : 'transparent'
                }}
                onClick={() => setActiveAgent(agent.id)}
                onMouseEnter={() => setHoveredAgent(agent.id)}
                onMouseLeave={() => setHoveredAgent(null)}
              >
                <div style={styles.agentAvatar}>
                  <Bot size={18} />
                  <div style={styles.statusIndicator(agent.status)} />
                </div>
                {!sidebarCollapsed && (
                  <div>
                    <div>{agent.name}</div>
                    <div style={{ fontSize: '12px', color: theme.colors.textMuted }}>
                      {agent.role}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={styles.agentSection}>
            <div style={styles.sectionHeader}>
              <ChevronDown size={12} />
              {!sidebarCollapsed && 'Conversations'}
            </div>
            {conversations.map(conv => (
              <div 
                key={conv.id}
                style={styles.agentItem(conv.id === activeConversation)}
                onClick={() => setActiveConversation(conv.id)}
              >
                <Hash size={18} />
                {!sidebarCollapsed && (
                  <div style={{ fontSize: '14px' }}>{conv.name}</div>
                )}
              </div>
            ))}
          </div>
          
          {!sidebarCollapsed && (
            <div style={{ padding: '8px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                style={styles.addAgentButton}
                onClick={() => setShowAgentModal(true)}
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
                onClick={createWebsiteTeam}
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
                onClick={() => setShowTeamTester(true)}
                onMouseEnter={(e) => e.currentTarget.style.background = '#4752C4'}
                onMouseLeave={(e) => e.currentTarget.style.background = theme.colors.info}
              >
                <Play size={16} />
                Test Team
              </button>
              <button 
                style={styles.addAgentButton}
                onClick={createNewConversation}
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
                onClick={clearAllAgents}
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

      <div style={styles.mainContent}>
        <div style={styles.conversationHeader}>
          <div style={styles.conversationTitle}>
            <Hash size={20} />
            <span>{conversations.find(c => c.id === activeConversation)?.name || 'Select a conversation'}</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <RefreshCw 
              size={20} 
              style={{ cursor: 'pointer', color: theme.colors.text }}
              onClick={loadInitialData}
            />
            <Settings size={20} style={{ cursor: 'pointer', color: theme.colors.text }} />
            <Database 
              size={20} 
              style={{ cursor: 'pointer', color: theme.colors.text }}
              onClick={() => setMemoryVisible(!memoryVisible)}
            />
          </div>
        </div>

        <div style={styles.messagesContainer}>
          {messages.length === 0 && !isProcessing && (
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
              {agents.length === 0 ? (
                <>
                  <Bot size={48} />
                  <h3>No Agents Available</h3>
                  <p>Create your first agent to get started!</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={createWebsiteTeam}
                      style={{
                        ...styles.addAgentButton,
                        background: theme.colors.success
                      }}
                    >
                      <Bot size={16} />
                      Create Website Team
                    </button>
                    <button
                      onClick={() => setShowAgentModal(true)}
                      style={styles.addAgentButton}
                    >
                      <Plus size={16} />
                      Create Custom Agent
                    </button>
                    <button
                      onClick={() => setShowTeamTester(true)}
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
              ) : conversations.length === 0 ? (
                <>
                  <Hash size={48} />
                  <h3>No Conversations</h3>
                  <p>Create a conversation to start chatting!</p>
                  <button
                    onClick={createNewConversation}
                    style={styles.addAgentButton}
                  >
                    <Plus size={16} />
                    Create Conversation
                  </button>
                </>
              ) : (
                <>
                  <Send size={48} />
                  <h3>Start a Conversation</h3>
                  <p>Select an agent and start typing to begin!</p>
                </>
              )}
            </div>
          )}
          
          {messages.map(message => (
            <div key={message.id} style={styles.message}>
              <div style={styles.messageAvatar}>
                {message.senderId === 'user' ? (
                  '👤'
                ) : (() => {
                    const agent = agents.find(a => a.id === message.senderId);
                    if (agent) {
                      // Different icons for different roles
                      const roleIcons: { [key: string]: string } = {
                        'coordinator': '🎯',
                        'designer': '🎨',
                        'frontend-developer': '💻',
                        'backend-developer': '⚙️',
                        'ui/ux designer': '🎨',
                        'project manager': '📋',
                        'system': '🔧',
                        'user': '👤'
                      };
                      return roleIcons[agent.role.toLowerCase()] || '🤖';
                    }
                    return '🤖';
                  })()}
              </div>
              <div style={styles.messageContent}>
                <div style={styles.messageHeader}>
                  <span style={styles.messageAuthor}>
                    {message.senderId === 'user' 
                      ? 'You' 
                      : (() => {
                          const agent = agents.find(a => a.id === message.senderId);
                          if (agent) {
                            return `${agent.name} (${agent.role})`;
                          } else {
                            console.warn(`Agent not found for senderId: ${message.senderId}`);
                            return `Agent (${message.senderId})`;
                          }
                        })()}
                  </span>
                  <span style={styles.messageTime}>
                    {new Date(message.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                <div style={styles.messageText}>{message.content}</div>
              </div>
            </div>
          ))}
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

        <div style={styles.inputContainer}>
          <div style={styles.inputWrapper}>
            <input
              style={styles.input}
              placeholder="Type a message or use @agent #task..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              disabled={isProcessing || !activeAgent || !activeConversation}
            />
            <button 
              style={styles.sendButton(!inputValue.trim() || isProcessing)}
              onClick={handleSendMessage} 
              disabled={!inputValue.trim() || isProcessing || !activeAgent || !activeConversation}
              onMouseEnter={(e) => {
                if (inputValue.trim() && !isProcessing) {
                  e.currentTarget.style.background = theme.colors.primaryHover;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.colors.primary;
              }}
            >
              {isProcessing ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>

        <div style={styles.statusBar}>
          <div style={styles.statusItem}>
            {ollamaStatus.available ? (
              <>
                <Check size={12} color={theme.colors.success} />
                <span>Ollama Connected</span>
              </>
            ) : (
              <>
                <AlertCircle size={12} color={theme.colors.error} />
                <span>Ollama Disconnected</span>
              </>
            )}
          </div>
          <div style={styles.statusItem}>
            <span>Model: {agents.find(a => a.id === activeAgent)?.config?.model || 'Not selected'}</span>
          </div>
          <div style={styles.statusItem}>
            <span>{messages.length} messages</span>
          </div>
        </div>
      </div>

      <div style={styles.memoryPanel(memoryVisible)}>
        <div style={styles.memoryHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={18} />
            <span style={{ fontWeight: 600 }}>Shared Memory</span>
          </div>
          <X 
            size={18} 
            style={{ cursor: 'pointer', color: theme.colors.text }}
            onClick={() => setMemoryVisible(false)}
          />
        </div>
        <div style={styles.memoryContent}>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ marginBottom: '8px', color: theme.colors.textBright }}>Project Memory</h4>
            <textarea
              style={styles.jsonEditor}
              value={JSON.stringify(projectMemory, null, 2)}
              onChange={(e) => {
                try {
                  setProjectMemory(JSON.parse(e.target.value));
                } catch (err) {
                  // Invalid JSON, just ignore
                }
              }}
            />
          </div>
          <div>
            <h4 style={{ marginBottom: '8px', color: theme.colors.textBright }}>Conversation Memory</h4>
            <textarea
              style={styles.jsonEditor}
              value={JSON.stringify(conversationMemory, null, 2)}
              onChange={(e) => {
                try {
                  setConversationMemory(JSON.parse(e.target.value));
                } catch (err) {
                  // Invalid JSON, just ignore
                }
              }}
            />
            <button
              style={{
                ...styles.addAgentButton,
                marginTop: '8px'
              }}
              onClick={handleMemoryUpdate}
            >
              Update Memory
            </button>
          </div>
        </div>
      </div>

      {/* Agent Creation Modal */}
      {showAgentModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: theme.colors.backgroundSecondary,
            borderRadius: '8px',
            padding: '24px',
            width: '500px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ color: theme.colors.textBright, margin: 0 }}>Create New Agent</h2>
              <X 
                size={20} 
                style={{ cursor: 'pointer', color: theme.colors.text }}
                onClick={() => setShowAgentModal(false)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ color: theme.colors.text, marginBottom: '4px', display: 'block' }}>Name</label>
                <input
                  type="text"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: theme.colors.backgroundTertiary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    color: theme.colors.text
                  }}
                  placeholder="Agent name"
                />
              </div>

              <div>
                <label style={{ color: theme.colors.text, marginBottom: '4px', display: 'block' }}>Role</label>
                <input
                  type="text"
                  value={newAgent.role}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, role: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: theme.colors.backgroundTertiary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    color: theme.colors.text
                  }}
                  placeholder="e.g., researcher, developer, writer"
                />
              </div>

              <div>
                <label style={{ color: theme.colors.text, marginBottom: '4px', display: 'block' }}>Description</label>
                <textarea
                  value={newAgent.description}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: theme.colors.backgroundTertiary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    color: theme.colors.text,
                    minHeight: '60px',
                    resize: 'vertical'
                  }}
                  placeholder="What does this agent do?"
                />
              </div>

              <div>
                <label style={{ color: theme.colors.text, marginBottom: '4px', display: 'block' }}>Model</label>
                <select
                  value={newAgent.model}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, model: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: theme.colors.backgroundTertiary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    color: theme.colors.text
                  }}
                >
                  <option value="llama3">Llama 3</option>
                  <option value="gpt-oss:20b">GPT-OSS 20B</option>
                  <option value="mistral">Mistral</option>
                  <option value="llama2">Llama2</option>
                  <option value="codellama">CodeLlama</option>
                  <option value="neural-chat">Neural Chat</option>
                </select>
              </div>

              <div>
                <label style={{ color: theme.colors.text, marginBottom: '4px', display: 'block' }}>Temperature</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={newAgent.temperature}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  style={{ width: '100%' }}
                />
                <span style={{ color: theme.colors.textMuted, fontSize: '12px' }}>{newAgent.temperature}</span>
              </div>

              <div>
                <label style={{ color: theme.colors.text, marginBottom: '4px', display: 'block' }}>Max Tokens</label>
                <input
                  type="number"
                  value={newAgent.maxTokens}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: theme.colors.backgroundTertiary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    color: theme.colors.text
                  }}
                  min="100"
                  max="8000"
                />
              </div>

              <div>
                <label style={{ color: theme.colors.text, marginBottom: '4px', display: 'block' }}>System Prompt</label>
                <textarea
                  value={newAgent.systemPrompt}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: theme.colors.backgroundTertiary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    color: theme.colors.text,
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                  placeholder="You are a helpful assistant..."
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  onClick={createNewAgent}
                  disabled={!newAgent.name || !newAgent.role}
                  style={{
                    ...styles.addAgentButton,
                    flex: 1,
                    opacity: (!newAgent.name || !newAgent.role) ? 0.5 : 1
                  }}
                >
                  Create Agent
                </button>
                <button
                  onClick={() => setShowAgentModal(false)}
                  style={{
                    ...styles.addAgentButton,
                    flex: 1,
                    background: theme.colors.backgroundTertiary,
                    color: theme.colors.text
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Collaboration Tester Modal */}
      {showTeamTester && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: theme.colors.background,
            borderRadius: '12px',
            width: '100%',
            maxWidth: '1200px',
            height: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ color: theme.colors.text, margin: 0, fontSize: '24px' }}>
                Team Collaboration Tester
              </h2>
              <button
                onClick={() => setShowTeamTester(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.colors.text,
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <X size={24} />
              </button>
            </div>
                         <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
               <TeamCollaborationTester 
                 activeConversationId={activeConversation}
                 agents={agents}
                 apiService={apiService}
                 socketRef={socketRef}
               />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Team Collaboration Tester Component
interface TestScenario {
  id: string;
  name: string;
  description: string;
  userMessage: string;
  expectedFlow: string[];
  criteria: Record<string, string>;
}

interface TestResult {
  status: string;
  score: number;
  timestamp: string;
  flow: any[];
}

interface TeamStatus {
  coordinator: 'ready' | 'working' | 'waiting';
  designer: 'ready' | 'working' | 'waiting';
  frontend: 'ready' | 'working' | 'waiting';
  backend: 'ready' | 'working' | 'waiting';
}

interface TeamCollaborationTesterProps {
  activeConversationId: string | null;
  agents: Agent[];
  apiService: any;
  socketRef: React.RefObject<Socket | null>;
}

const TeamCollaborationTester = ({ activeConversationId, agents, apiService, socketRef }: TeamCollaborationTesterProps) => {
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [teamStatus, setTeamStatus] = useState<TeamStatus>({
    coordinator: 'ready',
    designer: 'ready', 
    frontend: 'ready',
    backend: 'ready'
  });
  const [sharedMemory, setSharedMemory] = useState({
    project: {
      name: "Web Development Project",
      status: "planning",
      requirements: {},
      timeline: {}
    },
    currentTask: null,
    lastUpdate: new Date().toISOString()
  });

  const testScenarios = [
    {
      id: 'project-kickoff',
      name: '🚀 Project Kickoff',
      description: 'Test how the team handles initial project requirements',
      userMessage: 'I need to build a user dashboard for a SaaS application. It should have user authentication, data visualization charts, and a settings page. Users should be able to view their account stats, change their profile information, and see usage analytics.',
      expectedFlow: [
        'Coordinator analyzes requirements',
        'Coordinator delegates tasks to team members',
        'Designer creates wireframes and user flows',
        'Backend designs database and API structure',
        'Frontend plans component architecture'
      ],
      criteria: {
        coordination: 'Coordinator breaks down tasks clearly',
        design: 'Designer creates comprehensive wireframes',
        backend: 'Backend designs proper API structure',
        frontend: 'Frontend plans component hierarchy',
        collaboration: 'Team members communicate effectively'
      }
    },
    {
      id: 'feature-request',
      name: '⚡ Feature Addition',
      description: 'Test how team handles new feature requests',
      userMessage: 'Add a real-time notification system to the dashboard. Users should see notifications for important events and be able to mark them as read.',
      expectedFlow: [
        'Coordinator assesses impact on existing work',
        'Backend designs notification data model',
        'Designer creates notification UI components',
        'Frontend implements real-time updates',
        'Team coordinates integration points'
      ],
      criteria: {
        coordination: 'Proper impact assessment and planning',
        design: 'UI design for notifications',
        backend: 'Real-time architecture planning',
        frontend: 'Real-time state management',
        collaboration: 'Dependency management'
      }
    },
    {
      id: 'technical-challenge',
      name: '🔧 Technical Problem',
      description: 'Test problem-solving and technical discussion',
      userMessage: 'The dashboard is loading slowly, especially the charts. Users are complaining about performance. How can we optimize this?',
      expectedFlow: [
        'Coordinator identifies stakeholders',
        'Frontend analyzes performance bottlenecks',
        'Backend reviews API performance',
        'Designer considers UX improvements',
        'Team proposes optimization strategy'
      ],
      criteria: {
        coordination: 'Organizes technical investigation',
        design: 'UX considerations for loading states',
        backend: 'API and database optimization',
        frontend: 'Frontend performance optimization',
        collaboration: 'Holistic solution approach'
      }
    },
    {
      id: 'design-iteration',
      name: '🎨 Design Feedback',
      description: 'Test design collaboration and iteration',
      userMessage: '@designer The login page design looks good, but can we make it more mobile-friendly? Also, the color scheme needs to match our brand colors (blue: #2563eb, gray: #6b7280).',
      expectedFlow: [
        'Designer acknowledges feedback',
        'Designer proposes mobile-first redesign',
        'Frontend reviews implementation complexity',
        'Coordinator tracks design iteration timeline',
        'Team updates shared design system'
      ],
      criteria: {
        coordination: 'Tracks design changes impact',
        design: 'Responsive design iteration',
        backend: 'No backend impact needed',
        frontend: 'Implementation feasibility review',
        collaboration: 'Design system consistency'
      }
    },
    {
      id: 'integration-discussion',
      name: '🔗 Integration Planning',
      description: 'Test cross-team technical coordination',
      userMessage: '@frontend @backend How should we handle user authentication state across page refreshes? Do we store JWT in localStorage or use httpOnly cookies?',
      expectedFlow: [
        'Backend explains security implications',
        'Frontend discusses state management needs',
        'Coordinator facilitates technical decision',
        'Team agrees on implementation approach',
        'Shared memory updated with decision'
      ],
      criteria: {
        coordination: 'Facilitates technical decisions',
        design: 'UX implications considered',
        backend: 'Security best practices',
        frontend: 'State management strategy',
        collaboration: 'Consensus building'
      }
    }
  ];

  const runTest = async (scenario: TestScenario) => {
    setActiveTest(scenario.id);
    
    // Reset team status to working
    setTeamStatus({
      coordinator: 'working',
      designer: 'working', 
      frontend: 'working',
      backend: 'working'
    });

    const testFlow: any[] = [];
    let responseCount = 0;
    let startTime = Date.now();
    
    try {
      // 1. Send the test message via Socket.IO to trigger agent processing
      if (activeConversationId && socketRef.current) {
        // Send via Socket.IO to trigger agent orchestration
        socketRef.current.emit('message', {
          conversationId: activeConversationId,
          senderId: 'user',
          content: scenario.userMessage,
          type: 'user'
        });
        
        testFlow.push({
          timestamp: Date.now(),
          actor: 'user',
          action: 'message',
          content: scenario.userMessage
        });

                 // 2. Monitor for agent responses
         const checkResponses = () => {
           // Get current messages from the conversation
           apiService.fetchMessages(activeConversationId).then((messages: Message[]) => {
             const recentMessages = messages.filter((m: Message) => 
               m.timestamp > new Date(startTime).toISOString() && 
               m.senderId !== 'user'
             );
             
             responseCount = recentMessages.length;
             
             // Update test flow with real responses
             recentMessages.forEach((msg: Message) => {
               const agent = agents?.find((a: Agent) => a.id === msg.senderId);
               testFlow.push({
                 timestamp: Date.now(),
                 actor: agent?.role || msg.senderId,
                 action: 'response',
                 content: msg.content.substring(0, 100) + '...',
                 fullContent: msg.content
               });
             });

            // Check if we have enough responses or timeout
            if (responseCount >= 3 || Date.now() - startTime > 30000) {
              // Calculate score based on response quality and coordination
              const score = calculateTestScore(scenario, testFlow, responseCount);
              
              setTeamStatus({
                coordinator: 'ready',
                designer: 'ready',
                backend: 'ready',
                frontend: 'ready'
              });

              setTestResults(prev => ({
                ...prev,
                [scenario.id]: {
                  status: 'completed',
                  score,
                  timestamp: new Date().toISOString(),
                  flow: testFlow,
                  responses: recentMessages
                }
              }));

              setActiveTest(null);
            } else {
              // Continue monitoring
              setTimeout(checkResponses, 2000);
            }
          });
        };

        // Start monitoring responses
        setTimeout(checkResponses, 3000);
      } else {
        throw new Error('No active conversation found. Please create a team conversation first.');
      }
    } catch (error) {
      console.error('Test failed:', error);
      setTeamStatus({
        coordinator: 'ready',
        designer: 'ready',
        backend: 'ready',
        frontend: 'ready'
      });
      setActiveTest(null);
    }
  };

  const calculateTestScore = (scenario: TestScenario, flow: any[], responseCount: number): number => {
    let score = 60; // Base score
    
    // Bonus for coordinator response
    const coordinatorResponse = flow.find(f => f.actor === 'coordinator');
    if (coordinatorResponse) score += 10;
    
    // Bonus for multiple team members responding
    const uniqueResponders = new Set(flow.filter(f => f.actor !== 'user').map(f => f.actor));
    score += Math.min(uniqueResponders.size * 5, 15);
    
    // Bonus for response count
    score += Math.min(responseCount * 3, 15);
    
    return Math.min(score, 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'text-green-600 bg-green-100';
      case 'working': return 'text-orange-600 bg-orange-100';
      case 'waiting': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <CheckCircle size={16} />;
      case 'working': return <Clock size={16} className="animate-spin" />;
      default: return <Clock size={16} />;
    }
  };

  return (
    <div style={{ color: theme.colors.text, maxWidth: '100%' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
          Web Development Team Collaboration Tester
        </h1>
        <p style={{ color: theme.colors.textMuted }}>
          Test how well your Ollama-powered web development team works together on real scenarios.
        </p>
      </div>

      {/* Team Status Dashboard */}
      <div style={{ marginBottom: '32px', padding: '24px', background: theme.colors.backgroundSecondary, borderRadius: '8px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
          <Users size={20} style={{ marginRight: '8px' }} />
          Team Status
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {Object.entries(teamStatus).map(([role, status]) => (
            <div key={role} style={{
              padding: '12px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              background: status === 'ready' ? 'rgba(59, 165, 93, 0.1)' : 
                         status === 'working' ? 'rgba(250, 166, 26, 0.1)' : 
                         'rgba(150, 152, 157, 0.1)',
              color: status === 'ready' ? '#3ba55d' : 
                     status === 'working' ? '#faa61a' : 
                     theme.colors.textMuted
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>{role}</span>
                {getStatusIcon(status)}
              </div>
              <div style={{ fontSize: '14px', marginTop: '4px', textTransform: 'capitalize' }}>{status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Shared Memory Viewer */}
      <div style={{ marginBottom: '32px', padding: '24px', background: 'rgba(88, 101, 242, 0.1)', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
          <Database size={20} style={{ marginRight: '8px' }} />
          Shared Workspace Memory
        </h2>
        <div style={{ background: theme.colors.backgroundTertiary, padding: '16px', borderRadius: '4px', border: `1px solid ${theme.colors.border}` }}>
          <pre style={{ fontSize: '14px', color: theme.colors.text, overflow: 'auto', margin: 0 }}>
            {JSON.stringify(sharedMemory, null, 2)}
          </pre>
        </div>
      </div>

      {/* Test Scenarios */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Test Scenarios</h2>
        <div style={{ display: 'grid', gap: '24px' }}>
          {testScenarios.map((scenario) => (
            <div key={scenario.id} style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              padding: '24px',
              background: theme.colors.backgroundSecondary
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                    {scenario.name}
                  </h3>
                  <p style={{ color: theme.colors.textMuted, marginBottom: '16px' }}>{scenario.description}</p>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontWeight: '500', marginBottom: '8px' }}>User Message:</h4>
                    <div style={{ background: theme.colors.backgroundTertiary, padding: '12px', borderRadius: '4px', fontSize: '14px' }}>
                      {scenario.userMessage}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontWeight: '500', marginBottom: '8px' }}>Expected Flow:</h4>
                    <ul style={{ fontSize: '14px', color: theme.colors.textMuted, margin: 0, paddingLeft: '20px' }}>
                      {scenario.expectedFlow.map((step, index) => (
                        <li key={index} style={{ marginBottom: '4px' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'rgba(88, 101, 242, 0.2)',
                            color: theme.colors.primary,
                            fontSize: '12px',
                            textAlign: 'center',
                            lineHeight: '20px',
                            marginRight: '8px'
                          }}>
                            {index + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div style={{ marginLeft: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <button
                    onClick={() => runTest(scenario)}
                    disabled={activeTest === scenario.id}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: 'none',
                      cursor: activeTest === scenario.id ? 'not-allowed' : 'pointer',
                      background: activeTest === scenario.id ? theme.colors.backgroundTertiary : theme.colors.primary,
                      color: activeTest === scenario.id ? theme.colors.textMuted : theme.colors.textBright,
                      opacity: activeTest === scenario.id ? 0.5 : 1
                    }}
                  >
                    <Play size={16} />
                    <span>{activeTest === scenario.id ? 'Running...' : 'Run Test'}</span>
                  </button>

                  {testResults[scenario.id] && (
                    <div style={{ marginTop: '12px', textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', color: theme.colors.textMuted }}>Last Run</div>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: testResults[scenario.id].score >= 90 ? '#3ba55d' : 
                               testResults[scenario.id].score >= 80 ? '#faa61a' : '#ed4245'
                      }}>
                        {testResults[scenario.id].score}%
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', fontSize: '14px' }}>
                <div>
                  <h4 style={{ fontWeight: '500', marginBottom: '8px' }}>Success Criteria:</h4>
                  <ul style={{ color: theme.colors.textMuted, margin: 0, paddingLeft: '20px' }}>
                    {Object.entries(scenario.criteria).map(([role, criterion]) => (
                      <li key={role} style={{ marginBottom: '4px' }}>
                        <span style={{ width: '80px', display: 'inline-block', textTransform: 'capitalize', fontWeight: '500' }}>{role}:</span>
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Results Summary */}
      {Object.keys(testResults).length > 0 && (
        <div style={{ padding: '24px', background: 'rgba(59, 165, 93, 0.1)', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#3ba55d' }}>Test Results Summary</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ background: theme.colors.backgroundSecondary, padding: '16px', borderRadius: '4px', border: `1px solid ${theme.colors.border}` }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3ba55d' }}>
                {Object.keys(testResults).length}
              </div>
              <div style={{ fontSize: '14px', color: theme.colors.textMuted }}>Tests Completed</div>
            </div>
            <div style={{ background: theme.colors.backgroundSecondary, padding: '16px', borderRadius: '4px', border: `1px solid ${theme.colors.border}` }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: theme.colors.primary }}>
                {Math.round(Object.values(testResults).reduce((acc, result) => acc + result.score, 0) / Object.keys(testResults).length || 0)}%
              </div>
              <div style={{ fontSize: '14px', color: theme.colors.textMuted }}>Average Score</div>
            </div>
            <div style={{ background: theme.colors.backgroundSecondary, padding: '16px', borderRadius: '4px', border: `1px solid ${theme.colors.border}` }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#a855f7' }}>
                {Object.values(testResults).filter(result => result.score >= 90).length}
              </div>
              <div style={{ fontSize: '14px', color: theme.colors.textMuted }}>Excellent Results</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};