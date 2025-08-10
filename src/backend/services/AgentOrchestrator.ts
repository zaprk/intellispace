import { Server as SocketIOServer } from 'socket.io';
import { LLMService, LLMConfig } from './LLMService';
import { MemoryService } from './MemoryService';
import { ConversationService } from './ConversationService';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

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
  private prisma: PrismaClient;

  constructor(
    private llmService: LLMService,
    private memoryService: MemoryService,
    private conversationService: ConversationService,
    private io: SocketIOServer
  ) {
    this.prisma = new PrismaClient();
    this.initializeBuiltInTools();
    this.loadAgents();
  }

  // Agent Management
  async loadAgents() {
    try {
      const agents = await this.prisma.agent.findMany({
        where: { isActive: true },
      });

      agents.forEach(agent => {
        this.agents.set(agent.id, {
          id: agent.id,
          name: agent.name,
          avatar: agent.avatar || undefined,
          description: agent.description || undefined,
          role: agent.role,
          config: JSON.parse(agent.config),
          capabilities: JSON.parse(agent.capabilities),
          isActive: agent.isActive,
        });
      });

      console.log(`✅ Loaded ${agents.length} agents`);
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
          avatar: agentData.avatar,
          description: agentData.description,
          role: agentData.role,
          config: JSON.stringify(agentData.config),
          capabilities: JSON.stringify(defaultCapabilities),
          isActive: agentData.isActive ?? true,
        },
      });

      const newAgent: Agent = {
        id,
        ...agentData,
      };

      this.agents.set(id, newAgent);
      this.io.emit('agent-created', newAgent);

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

      // Parse mentions and tasks from the message
      const mentions = this.extractMentions(message.content);
      const tasks = this.extractTasks(message.content);
      
      // Get conversation context
      const conversationMemory = await this.memoryService.getConversationMemory(conversationId);
      const conversation = await this.conversationService.getConversation(conversationId);
      
      // Process mentions - trigger specific agents
      for (const mention of mentions) {
        const agentName = mention.substring(1); // Remove @ symbol
        const agent = Array.from(this.agents.values()).find(
          a => a.name.toLowerCase() === agentName.toLowerCase()
        );
        
        if (agent) {
          await this.triggerAgent(agent.id, conversationId, message.content);
        }
      }

      // Process tasks - find capable agents
      for (const task of tasks) {
        const taskName = task.substring(1); // Remove # symbol
        const capableAgents = this.findCapableAgents(taskName);
        
        if (capableAgents.length > 0) {
          // Use the first capable agent for now
          await this.triggerAgent(capableAgents[0].id, conversationId, `Task: ${taskName}\n${message.content}`);
        }
      }

      // If no specific mentions or tasks, trigger all active agents in the conversation
      if (mentions.length === 0 && tasks.length === 0) {
        // Get all participants in the conversation
        const conversation = await this.conversationService.getConversation(conversationId);
        const participantIds = conversation.participants;
        
        console.log(`🔍 Processing message in conversation ${conversationId}`);
        console.log(`👥 Participants: ${participantIds.join(', ')}`);
        
        // Trigger all active agents that are participants (except the user)
        for (const agentId of participantIds) {
          const agent = this.agents.get(agentId);
          if (agent && agent.isActive && agent.role !== 'user' && agent.role !== 'system') {
            console.log(`🤖 Triggering agent: ${agent.name} (${agent.role})`);
            await this.triggerAgent(agent.id, conversationId, message.content);
          } else {
            console.log(`⏭️ Skipping agent ${agentId}: ${agent ? `${agent.name} (${agent.role})` : 'not found'}`);
          }
        }
      }

      this.activeProcessing.delete(processingKey);
    } catch (error) {
      console.error('Error processing message:', error);
      this.activeProcessing.delete(`${conversationId}-${message.id}`);
    }
  }

  async triggerAgent(agentId: string, conversationId: string, prompt?: string) {
    try {
      console.log(`🚀 Starting to trigger agent: ${agentId}`);
      const agent = this.agents.get(agentId);
      if (!agent || !agent.isActive) {
        console.warn(`Agent ${agentId} not found or inactive`);
        return;
      }
      
      console.log(`✅ Agent ${agent.name} is active, proceeding with response generation`);

      // Show typing indicator
      this.conversationService.broadcastTypingIndicator(conversationId, agentId, true);

      // Get context
      const conversationMemory = await this.memoryService.getConversationMemory(conversationId);
      const recentMessages = await this.conversationService.getRecentMessages(conversationId, 10);
      
      // Build context for the agent
      const context = this.buildAgentContext(agent, conversationMemory, recentMessages);
      
      // Generate agent response
      const fullPrompt = this.buildPrompt(agent, context, prompt || 'Please respond based on the conversation context.');
      
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
      await this.conversationService.createMessage({
        conversationId,
        senderId: agentId,
        content: responseContent,
        type: 'text',
        metadata: {
          model: agent.config.model,
          provider: agent.config.llmProvider,
        },
      });

      // Update conversation memory with key points
      await this.updateConversationMemory(conversationId, agentId, responseContent);

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

  private findCapableAgents(task: string): Agent[] {
    return Array.from(this.agents.values()).filter(agent => 
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
          agent.capabilities.some(cap => contentLower.includes(cap.toLowerCase()))) {
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
}