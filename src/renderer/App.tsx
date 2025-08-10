import { useState, useEffect, useRef } from 'react';
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
  RefreshCw
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

// WebSocket and API configuration
const API_URL = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001';

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
  const wsRef = useRef<WebSocket | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      if (activeConversation) {
        ws.send(JSON.stringify({ 
          type: 'join', 
          conversationId: activeConversation 
        }));
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'new-message':
          setMessages(prev => [...prev, data.message]);
          break;
        case 'typing-indicator':
          // Handle typing indicator
          break;
        case 'agent-status':
          setAgents(prev => prev.map(agent => 
            agent.id === data.agentId 
              ? { ...agent, status: data.status }
              : agent
          ));
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error. Please refresh the page.');
    };

    wsRef.current = ws;

    return () => {
      ws.close();
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

      setAgents(agentsData.map(agent => ({
        ...agent,
        status: 'online'
      })));

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
      setMessages(messagesData);
      
      // Load conversation memory
      const memory = await apiService.getMemory('conversation', conversationId);
      setConversationMemory(memory);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    }
  };

  useEffect(() => {
    if (activeConversation) {
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
      
      const websiteTeam = [
        {
          name: 'UI/UX Designer',
          role: 'designer',
          description: 'Creates UI/UX designs, wireframes, and visual mockups',
          config: {
            llmProvider: 'ollama',
            model: 'llama3',
            temperature: 0.8,
            maxTokens: 4000,
            systemPrompt: `You are a professional UI/UX designer. Your role is to:
- Create detailed design specifications
- Provide wireframes and mockups
- Define color schemes, typography, and layout
- Ensure user experience best practices
- Collaborate with frontend and backend developers
- Provide clear design requirements and specifications

When working on projects:
1. Start by understanding the requirements
2. Create a design brief with key elements
3. Provide specific design specifications
4. Include layout, colors, typography, and interactions
5. Work with the team to ensure feasibility

Always communicate clearly with your team members and ask questions when you need clarification.`
          }
        },
        {
          name: 'Frontend Developer',
          role: 'frontend-developer',
          description: 'Implements user interfaces using HTML, CSS, JavaScript, and React',
          config: {
            llmProvider: 'ollama',
            model: 'llama3',
            temperature: 0.6,
            maxTokens: 4000,
            systemPrompt: `You are a professional frontend developer. Your role is to:
- Implement user interfaces based on design specifications
- Write clean, responsive HTML, CSS, and JavaScript
- Use modern frameworks like React when appropriate
- Ensure cross-browser compatibility
- Optimize for performance and accessibility
- Collaborate with designers and backend developers

When working on projects:
1. Review design specifications carefully
2. Ask clarifying questions about interactions
3. Implement the interface step by step
4. Provide code snippets and explanations
5. Coordinate with backend for API integration
6. Ensure responsive and accessible design

Always communicate with your team and ask for clarification when needed.`
          }
        },
        {
          name: 'Backend Developer',
          role: 'backend-developer',
          description: 'Handles server logic, APIs, database design, and business logic',
          config: {
            llmProvider: 'ollama',
            model: 'llama3',
            temperature: 0.5,
            maxTokens: 4000,
            systemPrompt: `You are a professional backend developer. Your role is to:
- Design and implement APIs
- Design database schemas
- Handle business logic and data processing
- Ensure security and performance
- Provide data structures and endpoints
- Collaborate with frontend developers

When working on projects:
1. Understand the project requirements
2. Design appropriate database schemas
3. Create API endpoints and documentation
4. Implement business logic
5. Ensure security best practices
6. Coordinate with frontend for integration
7. Provide clear API specifications

Always communicate with your team and ask for clarification when needed.`
          }
        }
      ];

      // Create all agents
      const createdAgents: Agent[] = [];
      for (const agentData of websiteTeam) {
        const createdAgent = await apiService.createAgent(agentData);
        createdAgents.push(createdAgent);
      }

      // Add all agents to state
      setAgents(prev => [...prev, ...createdAgents.map(agent => ({ ...agent, status: 'online' as const }))]);

      // Create a team conversation
      const teamConversation = await apiService.createConversation({
        projectId: 'default',
        name: 'Website Development Team',
        type: 'group',
        participants: createdAgents.map(a => a.id)
      });

      setConversations(prev => [...prev, teamConversation]);
      setActiveConversation(teamConversation.id);
      setActiveAgent(createdAgents[0].id);

    } catch (err) {
      console.error('Error creating website team:', err);
      setError('Failed to create website development team');
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
                {message.senderId === 'user' ? '👤' : <Bot size={20} />}
              </div>
              <div style={styles.messageContent}>
                <div style={styles.messageHeader}>
                  <span style={styles.messageAuthor}>
                    {message.senderId === 'user' 
                      ? 'You' 
                      : agents.find(a => a.id === message.senderId)?.name || 'Agent'}
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
    </div>
  );
}