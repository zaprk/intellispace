import { Server as SocketIOServer } from 'socket.io';
import { LLMService, LLMConfig } from './LLMService';
import { MemoryService } from './MemoryService';
import { ConversationService } from './ConversationService';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { WebTeamOrchestrator } from './WebTeamOrchestrator';

export interface AgentConfig {
  llmProvider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
  role: string;
  config: AgentConfig;
  capabilities: string[];
  isActive: boolean;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  execute: (params: any, context?: any) => Promise<any>;
}

export class AgentOrchestrator {
  private agents: Map<string, Agent> = new Map();
  private tools: Map<string, Tool> = new Map();
  private activeProcessing: Set<string> = new Set();
  private conversationCycles: Map<string, number> = new Map(); // Track communication cycles per conversation
  private maxCollaborationCycles = 3; // Maximum rounds of agent collaboration
  private recentResponders: Map<string, Set<string>> = new Map(); // Track which agents recently responded per conversation
  private prisma: PrismaClient;
  private webTeamOrchestrator: WebTeamOrchestrator;

  constructor(
    private llmService: LLMService,
    private memoryService: MemoryService,
    private conversationService: ConversationService,
    private io: SocketIOServer
  ) {
    this.prisma = new PrismaClient();
    this.webTeamOrchestrator = new WebTeamOrchestrator(
      this.llmService,
      this.conversationService,
      this.memoryService,
      this.io
    );
    this.initializeBuiltInTools();
    this.loadAgents();
  }

  // Agent Management
  async loadAgents() {
    try {
      const agents = await this.prisma.agent.findMany({
        where: { isActive: true },
      });

      // Clear existing agents from memory
      this.agents.clear();

      // Use a Map to deduplicate agents by ID
      const uniqueAgents = new Map();
      agents.forEach(agent => {
        if (!uniqueAgents.has(agent.id)) {
          uniqueAgents.set(agent.id, {
            id: agent.id,
            name: agent.name,
            avatar: agent.avatar || undefined,
            description: agent.description || undefined,
            role: agent.role,
            config: JSON.parse(agent.config),
            capabilities: JSON.parse(agent.capabilities),
            isActive: agent.isActive,
          });
        }
      });

      // Load unique agents into memory
      uniqueAgents.forEach((agent, id) => {
        this.agents.set(id, agent);
      });

      console.log(`✅ Loaded ${uniqueAgents.size} unique agents into memory:`, Array.from(uniqueAgents.values()).map(a => `${a.name} (${a.role})`));
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  }

  async createAgent(agentData: Omit<Agent, 'id'>): Promise<Agent> {
    try {
      const id = uuidv4();
      
      // Set default capabilities based on role if not provided
      const defaultCapabilities = agentData.capabilities || this.getDefaultCapabilitiesForRole(agentData.role);
      
      const agent = await this.prisma.agent.create({
        data: {
          id,
          name: agentData.name,
          avatar: agentData.avatar || null,
          description: agentData.description || null,
          role: agentData.role,
          config: JSON.stringify(agentData.config),
          capabilities: JSON.stringify(defaultCapabilities),
          isActive: agentData.isActive ?? true,
        },
      });

      const newAgent: Agent = {
        id,
        name: agentData.name,
        avatar: agentData.avatar,
        description: agentData.description,
        role: agentData.role,
        config: agentData.config,
        capabilities: defaultCapabilities,
        isActive: agentData.isActive ?? true,
      };

      this.agents.set(id, newAgent);
      this.io.emit('agent-created', newAgent);

      console.log(`✅ Created and loaded agent: ${newAgent.name} (${newAgent.role}) with capabilities:`, defaultCapabilities);
      console.log(`📊 Total agents in memory: ${this.agents.size}`);

      return newAgent;
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  }

  async updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent> {
    try {
      const existing = this.agents.get(agentId);
      if (!existing) {
        throw new Error(`Agent ${agentId} not found`);
      }

      const updated = { ...existing, ...updates };
      
      await this.prisma.agent.update({
        where: { id: agentId },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.avatar && { avatar: updates.avatar }),
          ...(updates.description && { description: updates.description }),
          ...(updates.role && { role: updates.role }),
          ...(updates.config && { config: JSON.stringify(updates.config) }),
          ...(updates.capabilities && { capabilities: JSON.stringify(updates.capabilities) }),
          ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        },
      });

      this.agents.set(agentId, updated);
      this.io.emit('agent-updated', updated);

      return updated;
    } catch (error) {
      console.error('Error updating agent:', error);
      throw error;
    }
  }

  async deleteAgent(agentId: string): Promise<void> {
    try {
      await this.prisma.agent.delete({
        where: { id: agentId },
      });

      this.agents.delete(agentId);
      this.io.emit('agent-deleted', agentId);
    } catch (error) {
      console.error('Error deleting agent:', error);
      throw error;
    }
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  // Message Processing
  async processMessage(message: any, conversationId: string) {
    try {
      // Prevent duplicate processing
      const processingKey = `${conversationId}-${message.id}`;
      if (this.activeProcessing.has(processingKey)) {
        return;
      }
      this.activeProcessing.add(processingKey);

      // Reset collaboration cycle counter for new user messages
      if (message.senderId === 'user') {
        this.conversationCycles.set(conversationId, 0);
        this.recentResponders.set(conversationId, new Set()); // Reset recent responders
        console.log(`🔄 Starting new collaboration cycle for conversation ${conversationId}`);
        
        // Clear recent responders after 5 minutes to allow agents to respond again
        setTimeout(() => {
          this.recentResponders.delete(conversationId);
          console.log(`⏰ Cleared recent responders for conversation ${conversationId} after timeout`);
        }, 5 * 60 * 1000); // 5 minutes
      }

      // Check if we've reached max collaboration cycles
      const currentCycle = this.conversationCycles.get(conversationId) || 0;
      if (currentCycle >= this.maxCollaborationCycles) {
        console.log(`⏹️ Max collaboration cycles (${this.maxCollaborationCycles}) reached for conversation ${conversationId}`);
        this.activeProcessing.delete(processingKey);
        return;
      }

      // Parse collaboration triggers from the message
      const collaborationTriggers = this.extractCollaborationTriggers(message.content);
      const mentions = this.extractMentions(message.content);
      const tasks = this.extractTasks(message.content);
      
      // Get conversation context and memory
      const conversationMemory = await this.memoryService.getConversationMemory(conversationId);
      const conversation = await this.conversationService.getConversation(conversationId);
      const recentMessages = await this.conversationService.getRecentMessages(conversationId, 15);

      // Check if this is a website team conversation
      const isWebsiteTeam = this.isWebsiteTeamConversation(conversationId);
      
      console.log(`🔍 DEBUG: message.senderId=${message.senderId}, isWebsiteTeam=${isWebsiteTeam}`);
      console.log(`🔍 DEBUG: Available agents:`, Array.from(this.agents.values()).map(a => `${a.name} (${a.role})`));
      
      // Check if this is a user message (either 'user', 'user-agent', or a UUID that's not an agent ID)
      const isUserMessage = message.senderId === 'user' || 
                           message.senderId === 'user-agent' ||
                           (message.senderId && !Array.from(this.agents.keys()).includes(message.senderId));
      
      console.log(`🔍 DEBUG: isUserMessage=${isUserMessage}, message.senderId=${message.senderId}, agentIds=${Array.from(this.agents.keys())}`);
      
      // Only trigger structured workflow for the FIRST user message in a conversation
      const isFirstUserMessage = isUserMessage && recentMessages.length <= 1;
      
      if (isWebsiteTeam && isFirstUserMessage) {
        console.log(`🏗️ Using structured workflow for website team conversation`);
        this.webTeamOrchestrator.setAgents(this.agents); // Pass current agents to the orchestrator
        await this.webTeamOrchestrator.processUserRequest(message, conversationId);
        this.activeProcessing.delete(processingKey);
        return; // Stop further processing in AgentOrchestrator
      } else if (isUserMessage) {
        console.log(`🔄 Using chaotic collaboration mode (not website team) - not first message`);
      }
      
      // Process collaboration triggers - these are natural ways agents can call each other
      if (collaborationTriggers.length > 0) {
        console.log(`🤝 Processing collaboration triggers: ${collaborationTriggers.join(', ')}`);
        
        // Only trigger ONE agent per collaboration cycle to prevent spam
        let triggeredOneAgent = false;
        
        for (const trigger of collaborationTriggers) {
          if (triggeredOneAgent) break; // Only trigger one agent per cycle
          
          const targetAgents = this.findAgentsByCollaborationTrigger(trigger, conversationMemory);
          console.log(`🎯 Found ${targetAgents.length} agents for trigger "${trigger}":`, targetAgents.map(a => a.name));
          
          // Filter out agents that have recently responded
          const recentRespondersSet = this.recentResponders.get(conversationId) || new Set();
          const availableAgents = targetAgents.filter(agent => !recentRespondersSet.has(agent.id));
          
          console.log(`✅ Available agents (not recently responded):`, availableAgents.map(a => a.name));
          
          // Only trigger the first available agent
          if (availableAgents.length > 0) {
            await this.triggerAgentWithContext(availableAgents[0].id, conversationId, message, recentMessages, conversationMemory);
            triggeredOneAgent = true;
            break; // Exit after triggering one agent
          }
        }
      }

      // Process mentions - direct agent calls
      for (const mention of mentions) {
        const agentName = mention.substring(1); // Remove @ symbol
        const agent = Array.from(this.agents.values()).find(
          a => a.name.toLowerCase() === agentName.toLowerCase()
        );
        
        if (agent) {
          // Check if this agent has recently responded
          const recentRespondersSet = this.recentResponders.get(conversationId) || new Set();
          if (!recentRespondersSet.has(agent.id)) {
            await this.triggerAgentWithContext(agent.id, conversationId, message, recentMessages, conversationMemory);
          } else {
            console.log(`⏭️ Skipping ${agent.name} - recently responded`);
          }
        }
      }

      // Process tasks - capability-based triggers
      for (const task of tasks) {
        const taskName = task.substring(1); // Remove # symbol
        const capableAgents = this.findCapableAgents(taskName);
        
        if (capableAgents.length > 0) {
          // Find first agent that hasn't recently responded
          const recentRespondersSet = this.recentResponders.get(conversationId) || new Set();
          const availableAgent = capableAgents.find(agent => !recentRespondersSet.has(agent.id));
          
          if (availableAgent) {
            await this.triggerAgentWithContext(availableAgent.id, conversationId, message, recentMessages, conversationMemory);
          } else {
            console.log(`⏭️ All capable agents have recently responded for task: ${taskName}`);
          }
        }
      }

      // If no specific triggers, start initial collaboration for user messages
      if (message.senderId === 'user' && collaborationTriggers.length === 0 && mentions.length === 0 && tasks.length === 0) {
        console.log(`🚀 Starting initial collaboration for user message`);
        
        // For user messages, always start with coordinator if available
        const coordinator = Array.from(this.agents.values()).find(agent => 
          agent.role.toLowerCase().includes('coordinator') && agent.isActive
        );
        
        if (coordinator) {
          console.log(`🎯 Starting collaboration with coordinator: ${coordinator.name}`);
          await this.triggerAgentWithContext(coordinator.id, conversationId, message, recentMessages, conversationMemory);
        } else {
          // Fallback to general collaboration
          await this.startInitialCollaboration(conversationId, message, recentMessages, conversationMemory);
        }
      }

      this.activeProcessing.delete(processingKey);
    } catch (error) {
      console.error('Error processing message:', error);
      this.activeProcessing.delete(`${conversationId}-${message.id}`);
    }
  }

  async triggerAgentWithContext(agentId: string, conversationId: string, message: any, recentMessages: any[], conversationMemory: any) {
    try {
      console.log(`🚀 Triggering agent: ${agentId} with enhanced context`);
      const agent = this.agents.get(agentId);
      if (!agent || !agent.isActive) {
        console.warn(`Agent ${agentId} not found or inactive`);
        return;
      }
      
      // Increment collaboration cycle
      const currentCycle = this.conversationCycles.get(conversationId) || 0;
      this.conversationCycles.set(conversationId, currentCycle + 1);
      console.log(`🔄 Collaboration cycle ${currentCycle + 1}/${this.maxCollaborationCycles} for conversation ${conversationId}`);
      
      // Track this agent as recently responded
      const recentRespondersSet = this.recentResponders.get(conversationId) || new Set();
      recentRespondersSet.add(agentId);
      this.recentResponders.set(conversationId, recentRespondersSet);
      console.log(`📝 Marked ${agent.name} as recently responded`);

      // Show typing indicator
      this.conversationService.broadcastTypingIndicator(conversationId, agentId, true);

      // Build enhanced context with collaboration awareness
      const context = this.buildCollaborativeContext(agent, conversationMemory, recentMessages, message);
      
      // Generate agent response with collaboration prompts
      const fullPrompt = this.buildCollaborativePrompt(agent, context, message, currentCycle + 1);
      
      // Stream the response
      let responseContent = '';
      await this.llmService.streamCompletion(
        fullPrompt,
        this.convertAgentConfigToLLMConfig(agent.config),
        (chunk) => {
          responseContent += chunk;
          // Emit streaming updates
          this.io.to(`conversation:${conversationId}`).emit('agent-streaming', {
            agentId,
            content: responseContent,
          });
        }
      );

      // Stop typing indicator
      this.conversationService.broadcastTypingIndicator(conversationId, agentId, false);

      // Save the agent's response as a message
      const agentMessage = await this.conversationService.createMessage({
        conversationId,
        senderId: agentId,
        content: responseContent,
        type: 'text',
        metadata: {
          model: agent.config.model,
          provider: agent.config.llmProvider,
          collaborationCycle: currentCycle + 1,
        },
      });

      // Update conversation memory with key points and collaboration context
      await this.updateConversationMemory(conversationId, agentId, responseContent);

      // Check for collaboration triggers in the agent's response
      const responseTriggers = this.extractCollaborationTriggers(responseContent);
      if (responseTriggers.length > 0) {
        console.log(`🤝 Agent ${agent.name} triggered collaboration: ${responseTriggers.join(', ')}`);
        
        // Only continue if we haven't reached max cycles
        const currentCycle = this.conversationCycles.get(conversationId) || 0;
        if (currentCycle < this.maxCollaborationCycles) {
          // Process the agent's response as a new message to trigger collaboration
          await this.processMessage(agentMessage, conversationId);
        } else {
          console.log(`🛑 Max collaboration cycles (${this.maxCollaborationCycles}) reached, stopping`);
        }
      } else {
        console.log(`✅ Agent ${agent.name} completed contribution without triggering further collaboration`);
      }

    } catch (error) {
      console.error(`Error triggering agent ${agentId}:`, error);
      this.conversationService.broadcastTypingIndicator(conversationId, agentId, false);
      
      // Send error message
      await this.conversationService.createMessage({
        conversationId,
        senderId: agentId,
        content: `I encountered an error while processing your request. Please try again.`,
        type: 'system',
        metadata: { error: error.message },
      });
    }
  }

  async startInitialCollaboration(conversationId: string, userMessage: any, recentMessages: any[], conversationMemory: any) {
    try {
      console.log(`🎯 Starting initial collaboration sequence`);
      
      // Get conversation participants
      const conversation = await this.conversationService.getConversation(conversationId);
      const participantIds = conversation.participants;
      
      // Find the most appropriate agent to start (usually coordinator or project manager)
      const starterAgent = this.findStarterAgent(participantIds, userMessage.content);
      
      if (starterAgent) {
        console.log(`🎬 Starting collaboration with ${starterAgent.name}`);
        await this.triggerAgentWithContext(starterAgent.id, conversationId, userMessage, recentMessages, conversationMemory);
      } else {
        // Fallback: trigger all agents in sequence
        console.log(`🔄 No starter agent found, triggering all participants`);
        for (const agentId of participantIds) {
          const agent = this.agents.get(agentId);
          if (agent && agent.isActive && agent.role !== 'user' && agent.role !== 'system') {
            await this.triggerAgentWithContext(agent.id, conversationId, userMessage, recentMessages, conversationMemory);
            break; // Only trigger the first one, let collaboration flow naturally
          }
        }
      }
    } catch (error) {
      console.error('Error starting initial collaboration:', error);
    }
  }

  // Context Building
  private buildAgentContext(agent: Agent, memory: any, recentMessages: any[]): string {
    let context = `## Agent Role\n${agent.role}\n\n`;
    
    if (agent.description) {
      context += `## Description\n${agent.description}\n\n`;
    }
    
    context += `## Capabilities\n${agent.capabilities.join(', ')}\n\n`;
    
    context += `## Conversation Context\n`;
    context += `Summary: ${memory.conversation?.summary || 'No summary available'}\n`;
    context += `Key Points: ${(memory.conversation?.keyPoints || []).join(', ')}\n`;
    context += `Participants: ${Object.keys(memory.participants || {}).join(', ')}\n\n`;
    
    context += `## Recent Messages\n`;
    recentMessages.forEach(msg => {
      context += `[${msg.sender?.name || msg.senderId}]: ${msg.content}\n`;
    });
    
    return context;
  }

  private buildPrompt(agent: Agent, context: string, userPrompt: string): string {
    return `${agent.config.systemPrompt}\n\n${context}\n\nUser Request: ${userPrompt}`;
  }

  private convertAgentConfigToLLMConfig(agentConfig: AgentConfig): LLMConfig {
    return {
      provider: agentConfig.llmProvider,
      model: agentConfig.model,
      temperature: agentConfig.temperature,
      maxTokens: agentConfig.maxTokens,
      systemPrompt: agentConfig.systemPrompt,
    };
  }

  // Collaboration Trigger Methods
  private extractCollaborationTriggers(content: string): string[] {
    const collaborationPatterns = [
      /(?:need|want|require|looking for|seeking)\s+(?:a|an|the)\s+(\w+)/gi,
      /(?:can you|please|would you)\s+(?:help|assist|support)\s+(?:with|on)\s+(\w+)/gi,
      /(?:let's|we should|we need to)\s+(\w+)/gi,
      /(?:design|frontend|backend|database|api|ui|ux|testing|deployment)/gi,
      /(?:collaborate|work together|team up|coordinate)/gi
    ];

    const triggers: string[] = [];
    
    collaborationPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      matches.forEach(match => {
        const trigger = match.toLowerCase().trim();
        if (!triggers.includes(trigger)) {
          triggers.push(trigger);
        }
      });
    });

    return triggers;
  }

  private findAgentsByCollaborationTrigger(trigger: string, conversationMemory: any): Agent[] {
    const triggerLower = trigger.toLowerCase();
    const relevantAgents: Agent[] = [];

    console.log(`🔍 Searching for agents with trigger "${trigger}" (${triggerLower})`);
    console.log(`📋 Available agents in memory:`, Array.from(this.agents.values()).map(a => `${a.name} (${a.role})`));

    // Map triggers to agent roles/capabilities
    const triggerMappings: { [key: string]: string[] } = {
      'design': ['designer', 'ui/ux designer', 'creative director'],
      'frontend': ['frontend developer', 'react developer', 'ui developer'],
      'backend': ['backend developer', 'api developer', 'server developer'],
      'database': ['database developer', 'data engineer', 'backend developer'],
      'api': ['backend developer', 'api developer', 'full-stack developer'],
      'ui': ['ui/ux designer', 'frontend developer', 'designer'],
      'ux': ['ui/ux designer', 'designer', 'user experience designer'],
      'testing': ['qa engineer', 'test engineer', 'quality assurance'],
      'deployment': ['devops engineer', 'backend developer', 'system administrator'],
      'need': ['project manager', 'coordinator', 'team lead'],
      'want': ['project manager', 'coordinator', 'team lead'],
      'require': ['project manager', 'coordinator', 'team lead'],
      'help': ['project manager', 'coordinator', 'team lead'],
      'assist': ['project manager', 'coordinator', 'team lead'],
      'support': ['project manager', 'coordinator', 'team lead'],
      'collaborate': ['project manager', 'coordinator', 'team lead'],
      'work together': ['project manager', 'coordinator', 'team lead'],
      'team up': ['project manager', 'coordinator', 'team lead'],
      'coordinate': ['project manager', 'coordinator', 'team lead']
    };

    // Find agents based on trigger mappings
    for (const [key, roles] of Object.entries(triggerMappings)) {
      if (triggerLower.includes(key)) {
        console.log(`🎯 Trigger "${trigger}" matches key "${key}"`);
        for (const role of roles) {
          console.log(`🔍 Looking for role: "${role}"`);
          const agents = Array.from(this.agents.values()).filter(agent => {
            if (!agent || !agent.isActive) {
              console.log(`❌ Agent ${agent?.name} filtered out: not active or null`);
              return false;
            }
            
            const roleMatch = agent.role.toLowerCase().includes(role.toLowerCase());
            const capabilityMatch = agent.capabilities && Array.isArray(agent.capabilities) && 
              agent.capabilities.some(cap => cap.toLowerCase().includes(role.toLowerCase()));
            
            console.log(`🔍 Agent ${agent.name} (${agent.role}): roleMatch=${roleMatch}, capabilityMatch=${capabilityMatch}`);
            
            return roleMatch || capabilityMatch;
          });
          console.log(`✅ Found ${agents.length} agents for role "${role}":`, agents.map(a => a.name));
          relevantAgents.push(...agents);
        }
      }
    }

    // Remove duplicates
    return relevantAgents.filter((agent, index, self) => 
      index === self.findIndex(a => a.id === agent.id)
    );
  }

  private findStarterAgent(participantIds: string[], userMessage: string): Agent | null {
    // Priority order for starter agents
    const starterRoles = ['project manager', 'coordinator', 'team lead', 'product manager'];
    
    // First, try to find a starter agent among participants
    for (const role of starterRoles) {
      const agent = Array.from(this.agents.values()).find(a => 
        participantIds.includes(a.id) && 
        a.role.toLowerCase().includes(role.toLowerCase())
      );
      if (agent) return agent;
    }

    // If no starter agent, find the most relevant agent based on message content
    const messageLower = userMessage.toLowerCase();
    const relevantAgents = Array.from(this.agents.values()).filter(a => 
      participantIds.includes(a.id) && 
      a.role !== 'user' && 
      a.role !== 'system'
    );

    // Score agents based on message relevance
    const scoredAgents = relevantAgents.map(agent => {
      let score = 0;
      const roleLower = agent.role.toLowerCase();
      const capabilities = agent.capabilities && Array.isArray(agent.capabilities) ? agent.capabilities.map(c => c.toLowerCase()) : [];

      if (messageLower.includes('design') && (roleLower.includes('design') || capabilities.some(c => c.includes('design')))) score += 3;
      if (messageLower.includes('frontend') && (roleLower.includes('frontend') || capabilities.some(c => c.includes('frontend')))) score += 3;
      if (messageLower.includes('backend') && (roleLower.includes('backend') || capabilities.some(c => c.includes('backend')))) score += 3;
      if (messageLower.includes('website') && (roleLower.includes('design') || roleLower.includes('frontend'))) score += 2;
      if (messageLower.includes('app') && (roleLower.includes('frontend') || roleLower.includes('backend'))) score += 2;
      if (messageLower.includes('api') && (roleLower.includes('backend') || capabilities.some(c => c.includes('api')))) score += 2;

      return { agent, score };
    });

    // Return the highest scoring agent
    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents[0]?.agent || null;
  }

  // Enhanced Context Building
  private buildCollaborativeContext(agent: Agent, memory: any, recentMessages: any[], message: any): string {
    let context = `## Agent Role\n${agent.role}\n\n`;
    
    if (agent.description) {
      context += `## Description\n${agent.description}\n\n`;
    }
    
    context += `## Capabilities\n${agent.capabilities.join(', ')}\n\n`;
    
    context += `## Collaboration Context\n`;
    context += `You are part of a collaborative team. Other team members may have already contributed to this conversation.\n`;
    context += `Consider their input and build upon it when appropriate.\n\n`;
    
    context += `## Conversation Memory\n`;
    context += `Summary: ${memory.conversation?.summary || 'No summary available'}\n`;
    context += `Key Points: ${(memory.conversation?.keyPoints || []).join(', ')}\n`;
    context += `Participants: ${Object.keys(memory.participants || {}).join(', ')}\n\n`;
    
    context += `## Recent Conversation Flow\n`;
    recentMessages.forEach(msg => {
      const senderName = msg.sender?.name || msg.senderId;
      const isCurrentAgent = msg.senderId === agent.id;
      const prefix = isCurrentAgent ? '🤖 [YOU]' : `👤 [${senderName}]`;
      context += `${prefix}: ${msg.content}\n`;
    });
    
    // Add discussion tracking to help avoid repetition
    context += `\n## Discussion Tracking\n`;
    const discussedTopics = this.extractDiscussedTopics(recentMessages);
    if (discussedTopics.length > 0) {
      context += `Already discussed: ${discussedTopics.join(', ')}\n`;
      context += `Avoid repeating these topics. Focus on new insights or next steps.\n\n`;
    }
    
    return context;
  }

  private buildCollaborativePrompt(agent: Agent, context: string, message: any, cycleNumber: number): string {
    const collaborationGuidance = `
## Collaboration Guidelines (Cycle ${cycleNumber}/3)

You are ${agent.name}, a ${agent.role}. You're collaborating with other team members on this project.

**How to collaborate naturally:**
1. **Build on others' ideas** - Reference what others have said and expand on it
2. **Ask for input** - If you need input from specific team members, mention them naturally
3. **Suggest next steps** - Propose what should happen next in the workflow
4. **Acknowledge contributions** - Recognize good ideas from other team members
5. **Stay in character** - Respond as your role would naturally
6. **Avoid repetition** - Don't ask questions that have already been asked by others
7. **Provide concrete value** - Give specific insights, suggestions, or deliverables

**Collaboration triggers you can use:**
- "I need input from @[agent-name] on..."
- "Let's work together on..."
- "We should coordinate with..."
- "This would work well with..."

**Cycle ${cycleNumber} Focus:**
${cycleNumber === 1 ? '- Initial analysis and requirements gathering' : ''}
${cycleNumber === 2 ? '- Detailed planning and technical specifications' : ''}
${cycleNumber === 3 ? '- Final coordination and next steps' : ''}

**Remember:** This is cycle ${cycleNumber} of 3. Make your contribution meaningful and avoid repeating what others have already said.
`;

    return `${agent.config.systemPrompt}\n\n${context}\n\n${collaborationGuidance}\n\nCurrent Message: ${message.content}`;
  }

  // Helper Methods
  private extractMentions(content: string): string[] {
    const mentionPattern = /@(\w+)/g;
    const matches = content.match(mentionPattern) || [];
    return matches;
  }

  private extractTasks(content: string): string[] {
    const taskPattern = /#(\w+)/g;
    const matches = content.match(taskPattern) || [];
    return matches;
  }

  private extractDiscussedTopics(messages: any[]): string[] {
    const topics = new Set<string>();
    
    // Common topics to track
    const topicKeywords = [
      'css framework', 'charting library', 'responsive design', 'mobile-first',
      'social login', 'authentication', 'api', 'database', 'wireframes',
      'typography', 'color scheme', 'branding', 'accessibility', 'aria',
      'kpis', 'metrics', 'analytics', 'dashboard', 'settings', 'profile'
    ];
    
    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      topicKeywords.forEach(keyword => {
        if (content.includes(keyword)) {
          topics.add(keyword);
        }
      });
    });
    
    return Array.from(topics);
  }

  private findCapableAgents(task: string): Agent[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent && agent.isActive && agent.capabilities && Array.isArray(agent.capabilities) &&
      agent.capabilities.some(cap => 
        cap.toLowerCase().includes(task.toLowerCase()) ||
        task.toLowerCase().includes(cap.toLowerCase())
      )
    );
  }

  private async findRelevantAgents(content: string, memory: any): Promise<Agent[]> {
    // Simple relevance matching for MVP
    const contentLower = content.toLowerCase();
    const relevant: Agent[] = [];
    
    for (const agent of this.agents.values()) {
      if (!agent.isActive) continue;
      
      // Check if content matches agent's role or capabilities
      if (contentLower.includes(agent.role.toLowerCase()) ||
          (agent.capabilities && Array.isArray(agent.capabilities) && 
           agent.capabilities.some(cap => contentLower.includes(cap.toLowerCase())))) {
        relevant.push(agent);
      }
    }
    
    // If no specific matches, return general assistant agents
    if (relevant.length === 0) {
      const generalAgents = Array.from(this.agents.values()).filter(
        a => a.isActive && (a.role === 'assistant' || a.role === 'general')
      );
      return generalAgents.slice(0, 1); // Return max 1 general agent
    }
    
    return relevant.slice(0, 3); // Return max 3 relevant agents
  }

  private async updateConversationMemory(conversationId: string, agentId: string, response: string) {
    try {
      // Extract key points from response (simple implementation)
      const keyPoints = response
        .split('.')
        .filter(s => s.trim().length > 20)
        .slice(0, 3)
        .map(s => s.trim());
      
      await this.memoryService.mergeConversationMemory(conversationId, {
        lastResponse: {
          agentId,
          timestamp: new Date().toISOString(),
          summary: response.substring(0, 200),
        },
        keyPoints: keyPoints,
      });
    } catch (error) {
      console.error('Error updating conversation memory:', error);
    }
  }

  // Tool Management
  private initializeBuiltInTools() {
    // Web Search Tool
    this.registerTool({
      id: 'web_search',
      name: 'Web Search',
      description: 'Search the web for information',
      execute: async (params) => {
        // Mock implementation for MVP
        return {
          results: [
            { title: 'Result 1', url: 'https://example.com', snippet: 'Sample result' },
          ],
        };
      },
    });

    // File Operations Tool
    this.registerTool({
      id: 'file_operations',
      name: 'File Operations',
      description: 'Read, write, and manipulate files',
      execute: async (params) => {
        // Mock implementation for MVP
        return { success: true, message: 'File operation completed' };
      },
    });

    // Code Execution Tool
    this.registerTool({
      id: 'code_execution',
      name: 'Code Execution',
      description: 'Execute code snippets',
      execute: async (params) => {
        // Mock implementation for MVP - in production, use sandboxed environment
        return { output: 'Code executed successfully', result: null };
      },
    });

    // API Call Tool
    this.registerTool({
      id: 'api_call',
      name: 'API Call',
      description: 'Make HTTP API calls',
      execute: async (params) => {
        // Mock implementation for MVP
        return { status: 200, data: {} };
      },
    });
  }

  registerTool(tool: Tool) {
    this.tools.set(tool.id, tool);
    console.log(`✅ Registered tool: ${tool.name}`);
  }

  async executeTool(toolId: string, params: any, agentId?: string): Promise<any> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    const context = agentId ? { agentId, agent: this.agents.get(agentId) } : undefined;
    
    try {
      const result = await tool.execute(params, context);
      console.log(`Tool ${toolId} executed successfully`);
      return result;
    } catch (error) {
      console.error(`Error executing tool ${toolId}:`, error);
      throw error;
    }
  }

  getAvailableTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  private getDefaultCapabilitiesForRole(role: string): string[] {
    switch (role.toLowerCase()) {
      case 'coordinator':
        return [
          'project_management',
          'task_coordination',
          'team_collaboration',
          'workflow_management',
          'communication_facilitation'
        ];
      case 'designer':
      case 'ui/ux designer':
        return [
          'ui_design',
          'ux_design',
          'wireframing',
          'prototyping',
          'design_systems',
          'user_research',
          'accessibility_design'
        ];
      case 'frontend-developer':
      case 'frontend':
        return [
          'frontend_development',
          'react_development',
          'typescript',
          'css_styling',
          'responsive_design',
          'component_architecture',
          'api_integration'
        ];
      case 'backend-developer':
      case 'backend':
        return [
          'backend_development',
          'api_design',
          'database_design',
          'server_architecture',
          'authentication',
          'security',
          'performance_optimization'
        ];
      case 'researcher':
        return [
          'web_search',
          'document_analysis',
          'data_analysis',
          'research_synthesis',
          'citation_management'
        ];
      case 'developer':
        return [
          'code_generation',
          'code_review',
          'debugging',
          'testing',
          'documentation',
          'architecture_design'
        ];
      case 'writer':
        return [
          'content_creation',
          'editing',
          'proofreading',
          'style_guidance',
          'research_writing'
        ];
      case 'analyst':
        return [
          'data_analysis',
          'statistical_analysis',
          'reporting',
          'visualization',
          'trend_analysis'
        ];
      default:
        return [
          'general_assistance',
          'information_retrieval',
          'problem_solving'
        ];
    }
  }

  private isWebsiteTeamConversation(conversationId: string): boolean {
    // Check if this conversation has website team agents
    const websiteTeamRoles = ['coordinator', 'designer', 'frontend-developer', 'backend-developer'];
    const hasWebsiteTeam = Array.from(this.agents.values()).some(agent => 
      websiteTeamRoles.includes(agent.role.toLowerCase())
    );
    
    console.log(`🔍 Website team detection: hasWebsiteTeam=${hasWebsiteTeam}, agents=${Array.from(this.agents.values()).map(a => a.role)}`);
    
    // If we have website team agents, use structured workflow
    return hasWebsiteTeam;
  }
}