import { ChatOllama } from "@langchain/ollama";
import { HumanMessage } from "@langchain/core/messages";
import { 
  WorkflowState, 
  WorkflowStep, 
  AgentNode, 
  WorkflowConfig,
  Message,
  Agent,
  WorkflowMode
} from "../../shared/types";

// Extended Agent interface for backend use
interface BackendAgent extends Agent {
  isActive: boolean;
  capabilities: string[];
  avatar?: string;
}
import { PrismaClient } from "@prisma/client";

// ===== ENHANCED TYPES =====
export interface SharedWorkflowState {
  conversationId: string;
  phase: 'analysis' | 'coordination' | 'collaboration' | 'integration' | 'complete';
  
  // Original user input
  userRequest: string;
  
  // Shared knowledge base that accumulates
  sharedKnowledge: {
    projectRequirements: string;
    designDecisions: string[];
    technicalDecisions: string[];
    implementationNotes: string[];
    integrationPoints: string[];
    completedTasks: string[];
    blockers: string[];
  };
  
  // Agent contributions to shared state
  agentContributions: {
    coordinator?: AgentContribution;
    designer?: AgentContribution;
    'frontend-developer'?: AgentContribution;
    'backend-developer'?: AgentContribution;
  };
  
  // Flow control
  activeAgents: string[];
  nextAgents: string[];
  collaborationRound: number;
  maxRounds: number;
  
  // Messages for UI
  messages: Message[];
  error?: string;
  workflowMode?: 'solo' | 'mini-workflow' | 'full-workflow';
}

export interface AgentContribution {
  agentId: string;
  round: number;
  timestamp: string;
  
  // What this agent added to shared knowledge
  knowledgeUpdates: {
    requirements?: string[];
    decisions?: string[];
    tasks?: string[];
    blockers?: string[];
  };
  
  // Dependencies on other agents
  dependsOn: string[];
  enablesAgents: string[];
  
  // Status
  status: 'pending' | 'contributing' | 'complete' | 'blocked';
  
  // Public message for UI
  message: string;
  
  // Internal reasoning (not shown to user)
  reasoning?: string;
}



// ===== ENHANCED WORKFLOW ORCHESTRATOR =====
export class WorkflowOrchestrator {
  private teamAgents: string[] = [];
  private agentInfo: BackendAgent[] = [];
  private agents = new Map<string, BackendAgent>(); // Agent management
  private tools = new Map<string, any>(); // Tool management
  private llm: ChatOllama;
  private prisma: PrismaClient;
  private io?: any; // Socket.IO instance for streaming
  private conversationStates: Map<string, SharedWorkflowState> = new Map();
  
  // Enhanced state tracking (moved from AgentOrchestrator)
  private activeProcessing = new Map<string, any>();
  private messageHistory = new Map<string, Set<string>>();
  private conversationCycles = new Map<string, number>();
  private recentResponders = new Map<string, Set<string>>();
  private conversationModes = new Map<string, any>();
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.llm = new ChatOllama({ model: "llama2" });
  }
  
  setSocketIO(io: any) {
    this.io = io;
  }
  
  setAgents(agents: Agent[]) {
    // Convert Agent[] to BackendAgent[] with default values
    this.agentInfo = agents.map(agent => ({
      ...agent,
      isActive: agent.isActive ?? true,
      capabilities: agent.capabilities ?? [],
      avatar: agent.avatar
    }));
    
    this.teamAgents = this.agentInfo
      .filter(agent => ['coordinator', 'designer', 'frontend-developer', 'backend-developer'].includes(agent.role))
      .map(agent => agent.id);
    
    console.log('🔧 [WORKFLOW] Set agents:', this.teamAgents);
    console.log('🔧 [WORKFLOW] Agent info:', this.agentInfo.map(a => `${a.name} (${a.role})`));
  }

  /**
   * Enhanced mention parsing that handles various formats and edge cases
   */
  private parseMentions(content: string): string[] {
    const mentionedAgentIds: string[] = [];
    
    // Method 1: Standard @ mentions with word boundaries
    const standardMentions = content.match(/@([A-Za-z0-9\s\-\_]+)(?=\s|$|[^\w])/gi);
    
    if (standardMentions) {
      for (const mention of standardMentions) {
        const agentName = mention.substring(1).trim().toLowerCase();
        const matchedAgent = this.findAgentByNameOrRole(agentName);
        if (matchedAgent) {
          mentionedAgentIds.push(matchedAgent.id);
          console.log(`✅ [MENTIONS] Standard match: "${agentName}" → ${matchedAgent.name} (${matchedAgent.id})`);
        }
      }
    }

    // Method 2: Fallback - look for agent names/roles without @
    if (mentionedAgentIds.length === 0) {
      for (const agent of this.agentInfo) {
        const agentNameLower = agent.name.toLowerCase();
        const agentRoleLower = agent.role.toLowerCase();
        const contentLower = content.toLowerCase();
        
        // Check for exact name matches
        if (contentLower.includes(agentNameLower) || contentLower.includes(agentRoleLower)) {
          if (!mentionedAgentIds.includes(agent.id)) {
            mentionedAgentIds.push(agent.id);
            console.log(`✅ [MENTIONS] Fallback match: "${agentNameLower}" → ${agent.name} (${agent.id})`);
          }
        }
      }
    }

    // Method 3: Role-based keywords (designer, frontend, backend, coordinator)
    const roleKeywords = {
      'design': ['designer'],
      'frontend': ['frontend-developer', 'frontend'],
      'backend': ['backend-developer', 'backend'],
      'coordinate': ['coordinator'],
      'ui': ['designer'],
      'ux': ['designer'],
      'api': ['backend-developer'],
      'database': ['backend-developer'],
      'styling': ['frontend-developer'],
      'css': ['frontend-developer'],
      'html': ['frontend-developer'],
      'react': ['frontend-developer']
    };

    for (const [keyword, roles] of Object.entries(roleKeywords)) {
      if (content.toLowerCase().includes(keyword)) {
        for (const role of roles) {
          const agent = this.agentInfo.find(a => a.role === role);
          if (agent && !mentionedAgentIds.includes(agent.id)) {
            mentionedAgentIds.push(agent.id);
            console.log(`✅ [MENTIONS] Keyword match: "${keyword}" → ${agent.name} (${agent.id})`);
          }
        }
      }
    }

    return [...new Set(mentionedAgentIds)]; // Remove duplicates
  }

  /**
   * Find agent by name or role with fuzzy matching
   */
  private findAgentByNameOrRole(searchTerm: string): BackendAgent | null {
    const searchLower = searchTerm.toLowerCase();
    
    // Exact name match
    let match = this.agentInfo.find(agent => 
      agent.name.toLowerCase() === searchLower
    );
    if (match) return match;

    // Exact role match
    match = this.agentInfo.find(agent => 
      agent.role.toLowerCase() === searchLower
    );
    if (match) return match;

    // Partial name match
    match = this.agentInfo.find(agent => 
      agent.name.toLowerCase().includes(searchLower) ||
      searchLower.includes(agent.name.toLowerCase())
    );
    if (match) return match;

    // Partial role match
    match = this.agentInfo.find(agent => 
      agent.role.toLowerCase().includes(searchLower) ||
      searchLower.includes(agent.role.toLowerCase())
    );
    if (match) return match;

    // Role abbreviation matches
    const roleAbbreviations: Record<string, string> = {
      'fe': 'frontend-developer',
      'be': 'backend-developer',
      'ui': 'designer',
      'ux': 'designer',
      'coord': 'coordinator',
      'pm': 'coordinator'
    };

    const abbreviationMatch = roleAbbreviations[searchLower];
    if (abbreviationMatch) {
      match = this.agentInfo.find(agent => agent.role === abbreviationMatch);
      if (match) return match;
    }

    return null;
  }

  /**
   * Enhanced processing mode determination with clearer logic
   */
  private determineProcessingMode(mentionedAgents: string[], content: string): WorkflowMode {
    console.log(`🔍 [MODE] Determining mode for ${mentionedAgents.length} mentions`);
    
    // No mentions = Full workflow (coordinator starts)
    if (mentionedAgents.length === 0) {
      const coordinatorId = this.getAgentIdByRole('coordinator');
      return {
        type: 'full-workflow',
        agents: coordinatorId ? [coordinatorId] : [],
        maxRounds: 3,
        reason: 'No mentions detected, starting full team workflow'
      };
    }
    
    // Single mention = Solo response (direct agent response)
    if (mentionedAgents.length === 1) {
      return {
        type: 'solo',
        agents: mentionedAgents,
        maxRounds: 1,
        reason: `Direct mention of single agent: ${mentionedAgents[0]}`
      };
    }
    
    // Multiple mentions = Mini workflow (mentioned agents collaborate)
    return {
      type: 'mini-workflow',
      agents: mentionedAgents,
      maxRounds: 2,
      reason: `Multiple mentions detected: ${mentionedAgents.join(', ')}`
    };
  }

  /**
   * Validate that mentioned agents exist and are active
   */
  private validateMentionedAgents(mentionedAgents: string[]): string[] {
    const validAgents = mentionedAgents.filter(agentId => {
      const agent = this.agentInfo.find(a => a.id === agentId);
      const isValid = agent && agent.isActive;
      
      if (!isValid) {
        console.warn(`⚠️ [MENTIONS] Invalid or inactive agent: ${agentId}`);
      }
      
      return isValid;
    });

    if (validAgents.length !== mentionedAgents.length) {
      console.warn(`⚠️ [MENTIONS] ${mentionedAgents.length - validAgents.length} invalid agents filtered out`);
    }

    return validAgents;
  }

  /**
   * Main entry point - simplified message processing
   */
  async processMessage(message: Message): Promise<SharedWorkflowState> {
    console.log('🚀 [WORKFLOW] Starting message processing...');
    console.log(`📝 [WORKFLOW] Message content: "${message.content}"`);
    
    // Step 1: Parse mentions with validation
    const rawMentions = this.parseMentions(message.content);
    const validMentions = this.validateMentionedAgents(rawMentions);
    console.log(`🎯 [WORKFLOW] Valid mentions: ${validMentions.join(', ')}`);
    
    // Step 2: Determine workflow mode
    const workflowMode = this.determineProcessingMode(validMentions, message.content);
    console.log(`⚙️ [WORKFLOW] Mode: ${workflowMode.type} - ${workflowMode.reason}`);
    
    // Step 3: Initialize state
    const state = this.initializeWorkflowState(message, workflowMode);
    
    // Step 4: Execute workflow based on mode
    switch (workflowMode.type) {
      case 'solo':
        await this.executeSoloMode(state);
        break;
      case 'mini-workflow':
        await this.executeMiniWorkflow(state);
        break;
      case 'full-workflow':
        await this.executeFullWorkflow(state);
        break;
    }
    
    console.log(`✅ [WORKFLOW] Processing complete. Final state: ${state.phase}`);
    return state;
  }

  /**
   * Initialize workflow state based on mode
   */
  private initializeWorkflowState(message: Message, mode: WorkflowMode): SharedWorkflowState {
    return {
      conversationId: message.conversationId,
      phase: 'analysis',
      userRequest: message.content,
      sharedKnowledge: {
        projectRequirements: '',
        designDecisions: [],
        technicalDecisions: [],
        implementationNotes: [],
        integrationPoints: [],
        completedTasks: [],
        blockers: []
      },
      agentContributions: {},
      activeAgents: [],
      nextAgents: mode.agents,
      collaborationRound: 1,
      maxRounds: mode.maxRounds,
      messages: [],
      workflowMode: mode.type
    };
  }

  /**
   * Solo Mode: Single agent responds directly
   */
  private async executeSoloMode(state: SharedWorkflowState): Promise<void> {
    console.log('🎯 [SOLO] Executing solo mode');
    
    if (state.nextAgents.length !== 1) {
      throw new Error(`Solo mode requires exactly 1 agent, got ${state.nextAgents.length}`);
    }

    const agentId = state.nextAgents[0];
    const agent = this.agentInfo.find(a => a.id === agentId);
    
    if (!agent) {
      state.error = `Agent ${agentId} not found`;
      state.phase = 'complete';
      return;
    }

    try {
      console.log(`🤖 [SOLO] Processing agent: ${agent.name} (${agent.role})`);
      
      // Build solo prompt (no collaboration context needed)
      const soloPrompt = this.buildSoloPrompt(agent, state.userRequest);
      
      // Get response from agent
      const response = await this.callAgent(agent, soloPrompt);
      
      // Create message for UI
      const message = {
        id: `msg-${Date.now()}-${agentId}`,
        conversationId: state.conversationId,
        senderId: agentId,
        content: response,
        type: 'text' as const,
        timestamp: new Date().toISOString(),
        metadata: {
          model: agent.config.model,
          provider: agent.config.llmProvider,
          workflowMode: 'solo',
          directResponse: true
        },
        agent: {
          id: agent.id,
          name: agent.name,
          avatar: agent.avatar || '🤖',
          role: agent.role
        }
      };

      state.messages.push(message);
      
      // Stream to UI if possible
      if (this.io) {
        this.io.to(`conversation:${state.conversationId}`).emit('new-message', message);
      }
      
      console.log(`✅ [SOLO] Solo response completed from ${agent.name}`);
      
    } catch (error) {
      console.error(`❌ [SOLO] Error in solo mode:`, error);
      state.error = `Solo mode failed: ${error.message}`;
    }
    
    state.phase = 'complete';
  }

  /**
   * Mini Workflow: 2-3 mentioned agents collaborate briefly
   */
  private async executeMiniWorkflow(state: SharedWorkflowState): Promise<void> {
    console.log('🔄 [MINI] Executing mini workflow');
    
    let currentRound = 1;
    
    while (state.phase !== 'complete' && currentRound <= state.maxRounds) {
      console.log(`🔄 [MINI] Round ${currentRound}/${state.maxRounds}`);
      
      // Process agents in sequence
      const agentsThisRound = [...state.nextAgents];
      state.activeAgents = agentsThisRound;
      state.nextAgents = [];
      
      for (const agentId of agentsThisRound) {
        await this.processAgentInMiniWorkflow(agentId, state);
      }
      
      // Check if mini workflow should continue
      if (state.nextAgents.length === 0 || currentRound >= state.maxRounds) {
        state.phase = 'complete';
        break;
      }
      
      currentRound++;
      state.collaborationRound = currentRound;
    }
    
    console.log(`✅ [MINI] Mini workflow completed in ${currentRound} rounds`);
  }

  /**
   * Full Workflow: Complete team collaboration
   */
  private async executeFullWorkflow(state: SharedWorkflowState): Promise<void> {
    console.log('🏗️ [FULL] Executing full workflow');
    
    while (state.phase !== 'complete' && state.collaborationRound <= state.maxRounds) {
      console.log(`🏗️ [FULL] Round ${state.collaborationRound}/${state.maxRounds}, Phase: ${state.phase}`);
      
      // Process agents for this round
      await this.processAgentRound(state);
      
      // Update workflow phase
      this.updateWorkflowPhase(state);
      
      // Check completion conditions
      if (state.nextAgents.length === 0) {
        console.log('✅ [FULL] No more agents to process');
        state.phase = 'complete';
        break;
      }
      
      state.collaborationRound++;
    }
    
    console.log(`✅ [FULL] Full workflow completed in ${state.collaborationRound} rounds`);
  }

  /**
   * Helper: Build solo prompt without collaboration overhead
   */
  private buildSoloPrompt(agent: BackendAgent, userRequest: string): string {
    return `You are a ${agent.role} responding directly to a user request.

USER REQUEST: "${userRequest}"

ROLE: ${agent.role}
CAPABILITIES: ${agent.capabilities?.join(', ') || 'General assistance'}

Respond naturally and directly to the user's request. Be helpful, concise, and stay in character for your role.

IMPORTANT: This is a direct response - no collaboration with other agents is needed.`;
  }

  /**
   * Helper: Process agent in mini workflow context
   */
  private async processAgentInMiniWorkflow(agentId: string, state: SharedWorkflowState): Promise<void> {
    const agent = this.agentInfo.find(a => a.id === agentId) as BackendAgent | undefined;
    if (!agent) {
      console.error(`❌ [MINI] Agent ${agentId} not found`);
      return;
    }

    try {
      console.log(`🤖 [MINI] Processing ${agent.name} (${agent.role})`);
      
      // Build mini workflow prompt
      const miniPrompt = this.buildMiniWorkflowPrompt(agent, state);
      
      // Get response
      const response = await this.callAgent(agent, miniPrompt);
      
      // Create and emit message
      const message = {
        id: `msg-${Date.now()}-${agentId}`,
        conversationId: state.conversationId,
        senderId: agentId,
        content: response,
        type: 'text' as const,
        timestamp: new Date().toISOString(),
        metadata: {
          model: agent.config.model,
          provider: agent.config.llmProvider,
          workflowMode: 'mini-workflow',
          round: state.collaborationRound
        },
        agent: {
          id: agent.id,
          name: agent.name,
          avatar: agent.avatar || '🤖',
          role: agent.role
        }
      };

      state.messages.push(message);
      
      if (this.io) {
        this.io.to(`conversation:${state.conversationId}`).emit('new-message', message);
      }
      
    } catch (error) {
      console.error(`❌ [MINI] Error processing ${agent.name}:`, error);
    }
  }

  /**
   * Helper: Build mini workflow prompt with light collaboration context
   */
  private buildMiniWorkflowPrompt(agent: BackendAgent, state: SharedWorkflowState): string {
    const previousMessages = state.messages.map(msg => 
      `${msg.agent?.name || msg.senderId}: ${msg.content}`
    ).join('\n');

    return `You are a ${agent.role} collaborating with other mentioned team members.

USER REQUEST: "${state.userRequest}"

PREVIOUS TEAM RESPONSES:
${previousMessages}

Your role is to contribute your expertise to help address the user's request. Keep your response focused and collaborative.

Respond naturally - this is a brief collaboration, not a full project workflow.`;
  }

  /**
   * Helper: Call agent with proper error handling
   */
  private async callAgent(agent: BackendAgent, prompt: string): Promise<string> {
    // Show typing indicator
    if (this.io) {
      this.io.to(`conversation:${agent.id}`).emit('typing-indicator', {
        agentId: agent.id,
        isTyping: true
      });
    }

    try {
      const messages = [new HumanMessage(prompt)];
      const response = await this.llm.invoke(messages);
      return response.content as string;
    } finally {
      // Hide typing indicator
      if (this.io) {
        this.io.to(`conversation:${agent.id}`).emit('typing-indicator', {
          agentId: agent.id,
          isTyping: false
        });
      }
    }
  }

  /**
   * Determine workflow mode with enhanced logic
   */
  private determineWorkflowMode(mentionedAgents: string[], content: string): WorkflowMode {
    // No mentions = Full workflow
    if (mentionedAgents.length === 0) {
      const coordinatorId = this.getAgentIdByRole('coordinator');
      return {
        type: 'full-workflow',
        agents: coordinatorId ? [coordinatorId] : [],
        maxRounds: 4,
        reason: 'No specific agents mentioned - starting full team workflow'
      };
    }
    
    // Single mention = Solo response
    if (mentionedAgents.length === 1) {
      return {
        type: 'solo',
        agents: mentionedAgents,
        maxRounds: 1,
        reason: `Direct mention of single agent: ${mentionedAgents[0]}`
      };
    }
    
    // Multiple mentions = Mini workflow
    return {
      type: 'mini-workflow',
      agents: mentionedAgents,
      maxRounds: 2,
      reason: `Multiple agents mentioned: ${mentionedAgents.join(', ')}`
    };
  }

  // Legacy methods for backward compatibility
  private getAgentIdByRole(role: string): string | undefined {
    const agent = this.agentInfo.find(a => a.role === role);
    return agent?.id;
  }

  private async processAgentRound(state: SharedWorkflowState): Promise<void> {
    const currentAgents = [...state.nextAgents];
    state.activeAgents = currentAgents;
    state.nextAgents = [];
    
    // Process agents in sequence (not parallel) for proper state sharing
    for (const agentId of currentAgents) {
      console.log(`🤖 Processing agent: ${agentId}`);
      
      try {
        const contribution = await this.invokeAgent(agentId, state);
        
        // Update shared state with contribution
        state.agentContributions[agentId] = contribution;
        this.updateSharedKnowledge(state, contribution);
        
        // Add message for UI - extract actual message from JSON if needed
        let displayMessage = contribution.message;
        
        // If the message is raw JSON, try to extract the actual message
        if (typeof contribution.message === 'string' && contribution.message.trim().startsWith('{')) {
          try {
            const jsonMatch = contribution.message.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const cleanedJson = jsonMatch[0]
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t')
                .replace(/,\s*}/g, '}')
                .replace(/,\s*]/g, ']');
              
              const parsed = JSON.parse(cleanedJson);
              displayMessage = parsed.message || 'Agent analysis completed';
            }
          } catch (error) {
            displayMessage = 'Agent analysis completed';
          }
        }
        
        const message = {
          id: `${agentId}-${Date.now()}`,
          conversationId: state.conversationId,
          senderId: agentId,
          content: displayMessage,
          type: 'text',
          timestamp: new Date().toISOString(),
          metadata: {
            round: state.collaborationRound,
            phase: state.phase,
            knowledgeUpdates: contribution.knowledgeUpdates
          }
        };
        
        state.messages.push(message);
        
        // Stream the message in real-time if Socket.IO is available
        if (this.io) {
          this.io.to(`conversation:${state.conversationId}`).emit('new-message', message);
          console.log(`📤 [STREAM] Emitted message from ${agentId}: ${displayMessage.substring(0, 100)}...`);
        }
        
        // Determine which agents should go next - only if they haven't contributed yet
        const enabledAgents = contribution.enablesAgents
          .map(role => this.getAgentIdByRole(role))
          .filter((id): id is string => 
            id !== undefined && 
            this.teamAgents.includes(id) && 
            !state.agentContributions[id] &&
            !state.nextAgents.includes(id) &&
            !currentAgents.includes(id) && // Don't enable agents that are currently processing
            id !== agentId // Don't enable the current agent again
          );
        
        state.nextAgents.push(...enabledAgents);
        
      } catch (error) {
        console.error(`❌ Error processing agent ${agentId}:`, error);
        state.error = `Agent ${agentId} failed: ${error.message}`;
      }
    }
    
    // Remove duplicates from nextAgents
    state.nextAgents = [...new Set(state.nextAgents)];
  }

  private async invokeAgent(agentId: string, state: SharedWorkflowState, isSolo: boolean = false): Promise<AgentContribution> {
    const agent = this.agentInfo.find(a => a.id === agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    const prompt = isSolo 
      ? this.buildSoloPrompt(agent, state.userRequest)
      : this.buildSharedStatePrompt(agentId, agent.role, state);
    const response = await this.llm.invoke([new HumanMessage(prompt)]);
    
    try {
      // Try to extract JSON from the response
      const content = response.content as string;
      console.log(`🔍 [PARSER] Raw response from ${agentId}:`, content.substring(0, 200) + '...');
      
      // First, try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        console.log(`🔍 [PARSER] Found JSON match for ${agentId}:`, jsonStr.substring(0, 200) + '...');
        
        // Clean the JSON string to handle control characters
        const cleanedJson = jsonStr
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
          .replace(/\n/g, '\\n') // Escape newlines
          .replace(/\r/g, '\\r') // Escape carriage returns
          .replace(/\t/g, '\\t') // Escape tabs
          .replace(/,\s*}/g, '}') // Remove trailing commas
          .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
        
        console.log(`🔍 [PARSER] Cleaned JSON for ${agentId}:`, cleanedJson.substring(0, 200) + '...');
        
        const parsed = JSON.parse(cleanedJson);
        
        return {
          agentId,
          round: state.collaborationRound,
          timestamp: new Date().toISOString(),
          knowledgeUpdates: parsed.knowledgeUpdates || {},
          dependsOn: parsed.dependsOn || [],
          enablesAgents: parsed.enablesAgents || [],
          status: 'complete',
          message: parsed.message || 'Agent analysis completed',
          reasoning: parsed.reasoning
        };
      } else {
        // No JSON found, create a fallback contribution
        console.log(`⚠️ No JSON found in response for ${agentId}, using fallback`);
        
        // Try to extract enabled agents from the text
        const enabledAgents: string[] = [];
        if (content.includes('designer')) enabledAgents.push('designer');
        if (content.includes('frontend-developer')) enabledAgents.push('frontend-developer');
        if (content.includes('backend-developer')) enabledAgents.push('backend-developer');
        
        return {
          agentId,
          round: state.collaborationRound,
          timestamp: new Date().toISOString(),
          knowledgeUpdates: {},
          dependsOn: [],
          enablesAgents: enabledAgents,
          status: 'complete',
          message: content,
          reasoning: 'Used fallback parsing - no JSON found'
        };
      }
      
    } catch (error) {
      console.error(`❌ Failed to parse agent response for ${agentId}:`, error);
      
      // Final fallback contribution
      const content = response.content as string;
      const enabledAgents: string[] = [];
      if (content.includes('designer')) enabledAgents.push('designer');
      if (content.includes('frontend-developer')) enabledAgents.push('frontend-developer');
      if (content.includes('backend-developer')) enabledAgents.push('backend-developer');
      
      return {
        agentId,
        round: state.collaborationRound,
        timestamp: new Date().toISOString(),
        knowledgeUpdates: {},
        dependsOn: [],
        enablesAgents: enabledAgents,
        status: 'complete',
        message: content || 'Agent response was invalid',
        reasoning: 'Failed to parse structured response'
      };
    }
  }

  private buildSharedStatePrompt(agentId: string, role: string, state: SharedWorkflowState): string {
    const baseContext = `
You are a ${role} in a collaborative team working on: "${state.userRequest}"

CURRENT SHARED KNOWLEDGE:
${JSON.stringify(state.sharedKnowledge, null, 2)}

PREVIOUS TEAM CONTRIBUTIONS:
${Object.entries(state.agentContributions).map(([id, contrib]) => 
  `${id}: ${contrib.message}`
).join('\n')}

AVAILABLE TEAM MEMBERS: ${this.teamAgents.join(', ')}

IMPORTANT: You MUST respond with ONLY valid JSON. No text before or after the JSON.
`;

    const rolePrompts = {
      coordinator: `${baseContext}
As PROJECT COORDINATOR, analyze "${state.userRequest}" and provide collaborative direction for the team.

RESPOND WITH ONLY THIS JSON FORMAT (replace the placeholder text with your actual analysis):
{
  "knowledgeUpdates": {
    "requirements": ["Create a visually appealing landing page", "Use vibrant colors and modern design", "Ensure responsive layout"],
    "decisions": ["Use modern CSS framework", "Implement smooth animations", "Focus on user engagement"],
    "tasks": ["Design wireframes", "Create color palette", "Plan responsive breakpoints"]
  },
  "dependsOn": [],
  "enablesAgents": ["designer", "frontend-developer", "backend-developer"],
  "message": "Based on the user request, our team will need to collaborate on creating a beautiful, vibrant 'Hello World' page. I need @designer to help us define the color palette and typography for this page. Then, @frontend can start building the basic HTML structure and styling it with CSS. Finally, @backend can help us integrate any necessary API calls or database interactions for our 'Hello World' message. Let's work together to create a stunning page!",
  "reasoning": "The user wants a beautiful and vibrant page, so I'm coordinating natural collaboration between design, frontend, and backend specialists."
}`,

      designer: `${baseContext}
As UI/UX DESIGNER, based on the coordinator's analysis of "${state.userRequest}", provide collaborative design recommendations.

RESPOND WITH ONLY THIS JSON FORMAT (replace the placeholder text with your actual design analysis):
{
  "knowledgeUpdates": {
    "decisions": ["Use gradient backgrounds for vibrancy", "Implement glassmorphism effects", "Choose bold typography"],
    "tasks": ["Create color palette with vibrant hues", "Design hero section with animations", "Plan interactive elements"],
    "requirements": ["Ensure accessibility compliance", "Optimize for mobile devices", "Include loading animations"]
  },
  "dependsOn": ["coordinator"],
  "enablesAgents": ["frontend-developer"],
  "message": "Based on the shared knowledge and user request, I propose a design approach that prioritizes simplicity and ease of use. The layout will be clean and uncluttered, with clear calls to action and sufficient white space to guide the user's eye. The color scheme will be vibrant and consistent throughout, with accent colors used sparingly to draw attention to important elements. I will work closely with @frontend to ensure that the design is implemented correctly and meets the user's needs.",
  "reasoning": "The user wants 'beautiful and vibrant', so I'm focusing on modern design trends while ensuring the design works well with frontend implementation."
}`,

      'frontend-developer': `${baseContext}
As FRONTEND DEVELOPER, based on the coordinator's requirements and designer's decisions for "${state.userRequest}", provide collaborative technical implementation details.

RESPOND WITH ONLY THIS JSON FORMAT (replace the placeholder text with your actual technical analysis):
{
  "knowledgeUpdates": {
    "decisions": ["Use React with TypeScript", "Implement CSS-in-JS for dynamic styling", "Add Framer Motion for animations"],
    "integrationPoints": ["API endpoint for dynamic content", "WebSocket for real-time updates"],
    "tasks": ["Set up React project structure", "Create reusable components", "Implement responsive design"]
  },
  "dependsOn": ["coordinator", "designer"],
  "enablesAgents": ["backend-developer"],
  "message": "I will build on the design and requirements provided, using a modular and scalable frontend approach. I will ensure that the design is consistent across different pages and elements, and that the user experience is intuitive and easy to navigate. I will also consider integration with @backend services and data sources to enhance the functionality of the page.",
  "reasoning": "React provides the flexibility needed for a vibrant, interactive page, TypeScript ensures code quality, and I need to coordinate with backend for API integration."
}`,

      'backend-developer': `${baseContext}
As BACKEND DEVELOPER, based on all previous team contributions for "${state.userRequest}", provide collaborative backend implementation details.

RESPOND WITH ONLY THIS JSON FORMAT (replace the placeholder text with your actual backend analysis):
{
  "knowledgeUpdates": {
    "decisions": ["Use Node.js with Express", "Implement RESTful API", "Add WebSocket support"],
    "integrationPoints": ["Content management API", "Real-time messaging system"],
    "tasks": ["Set up Express server", "Create API endpoints", "Implement WebSocket connections"],
    "completedTasks": ["Technical analysis complete"]
  },
  "dependsOn": ["coordinator", "designer", "frontend-developer"],
  "enablesAgents": [],
  "message": "Based on the frontend requirements and design specifications, I'll implement a Node.js Express server with RESTful API endpoints for content management and WebSocket support for real-time features. The backend will provide the necessary infrastructure to support the vibrant, interactive frontend experience, including API endpoints for dynamic content and real-time messaging capabilities.",
  "reasoning": "Node.js with Express provides the performance and flexibility needed, while WebSocket support enables real-time interactions that enhance the vibrant user experience."
}`
    };

    return rolePrompts[role] || `${baseContext}\nProvide your contribution as a ${role}.`;
  }

  private updateSharedKnowledge(state: SharedWorkflowState, contribution: AgentContribution): void {
    const updates = contribution.knowledgeUpdates;
    
    // Append to shared knowledge arrays
    if (updates.requirements) {
      state.sharedKnowledge.projectRequirements += '\n' + updates.requirements.join('\n');
    }
    if (updates.decisions) {
      state.sharedKnowledge.designDecisions.push(...updates.decisions);
      state.sharedKnowledge.technicalDecisions.push(...updates.decisions);
    }
    if (updates.tasks) {
      state.sharedKnowledge.implementationNotes.push(...updates.tasks);
    }
    if (updates.blockers) {
      state.sharedKnowledge.blockers.push(...updates.blockers);
    }
    
    console.log(`📝 Updated shared knowledge from ${contribution.agentId}`);
  }

  private updateWorkflowPhase(state: SharedWorkflowState): void {
    // Determine next phase based on contributions
    if (state.agentContributions.coordinator && !state.agentContributions.designer) {
      state.phase = 'coordination';
    } else if (state.agentContributions.designer && !state.agentContributions['frontend-developer']) {
      state.phase = 'collaboration';
    } else if (Object.keys(state.agentContributions).length >= 3) {
      state.phase = 'integration';
    }
    
    // Check if we should continue or complete
    // Only check if mentioned agents have contributed, not all team agents
    const mentionedAgents = this.parseMentions(state.userRequest);
    const expectedAgents = mentionedAgents.length > 0 ? mentionedAgents : [this.getAgentIdByRole('coordinator')].filter((id): id is string => id !== undefined);
    
    const allExpectedAgentsContributed = expectedAgents.every(agentId => 
      state.agentContributions[agentId] !== undefined
    );
    
    if (state.nextAgents.length === 0 || state.collaborationRound >= state.maxRounds || allExpectedAgentsContributed) {
      state.phase = 'complete';
    }
  }

  /**
   * Clear conversation state to prevent stuck workflows
   */
  public clearConversationState(conversationId: string): void {
    this.conversationStates.delete(conversationId);
    console.log(`🧹 [WORKFLOW] Cleared state for conversation ${conversationId}`);
  }

  // Legacy method for backward compatibility
  public updateTeamAgents(agentOrchestrator: any): void {
    const allAgents = agentOrchestrator.getAllAgents();
    console.log('🔍 [WORKFLOW] All agents from orchestrator:', allAgents.map(a => `${a.name} (${a.role}) - ${a.id}`));
    
    // Convert to Agent format and set
    const agents: Agent[] = allAgents.map(agent => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      avatar: agent.avatar,
      description: agent.description,
      config: agent.config,
      capabilities: agent.capabilities,
      isActive: agent.isActive
    }));
    
    this.setAgents(agents);
  }

  // Legacy method for backward compatibility
  public getWorkflowState(conversationId: string): SharedWorkflowState | null {
    return this.conversationStates.get(conversationId) || null;
  }

  // Legacy method for backward compatibility
  public saveWorkflowState(state: SharedWorkflowState): void {
    this.conversationStates.set(state.conversationId, state);
    console.log("💾 [WORKFLOW] Saved workflow state:", state.conversationId);
  }

  // ===== AGENT MANAGEMENT METHODS (moved from AgentOrchestrator) =====

  /**
   * Load agents from database
   */
  async loadAgents(): Promise<void> {
    try {
      const agents = await this.prisma.agent.findMany();
      this.agents.clear();
      const uniqueAgents = new Map();
      
      agents.forEach(agent => {
        if (!uniqueAgents.has(agent.id)) {
          const backendAgent: BackendAgent = {
            id: agent.id,
            name: agent.name,
            role: agent.role,
            description: agent.description || '',
            status: 'online',
            avatar: agent.avatar || undefined,
            isActive: agent.isActive,
            capabilities: JSON.parse(agent.capabilities),
            config: JSON.parse(agent.config)
          };
          uniqueAgents.set(agent.id, backendAgent);
        }
      });
      
      uniqueAgents.forEach((agent, id) => {
        this.agents.set(id, agent);
      });
      
      // Update agentInfo for workflow processing
      this.agentInfo = Array.from(this.agents.values());
      
      console.log(`✅ [WORKFLOW] Loaded ${uniqueAgents.size} agents:`, 
        Array.from(uniqueAgents.values()).map(a => `${a.name} (${a.role})`));
    } catch (error) {
      console.error('❌ [WORKFLOW] Error loading agents:', error);
    }
  }

  /**
   * Create a new agent
   */
  async createAgent(agentData: any): Promise<BackendAgent> {
    try {
      const defaultCapabilities = this.getDefaultCapabilitiesForRole(agentData.role);
      
      const agent = await this.prisma.agent.create({
        data: {
          name: agentData.name,
          role: agentData.role,
          description: agentData.description,
          avatar: agentData.avatar,
          config: JSON.stringify(agentData.config),
          capabilities: JSON.stringify(defaultCapabilities),
          isActive: agentData.isActive ?? true,
        }
      });

      const newAgent: BackendAgent = {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        description: agent.description || '',
        status: 'online',
        avatar: agent.avatar || undefined,
        isActive: agent.isActive,
        capabilities: defaultCapabilities,
        config: agentData.config
      };
      
      this.agents.set(agent.id, newAgent);
      this.agentInfo = Array.from(this.agents.values());
      
      if (this.io) {
        this.io.emit('agent-created', newAgent);
      }
      
      console.log(`✅ [WORKFLOW] Created agent: ${newAgent.name} (${newAgent.role})`);
      return newAgent;
    } catch (error) {
      console.error('❌ [WORKFLOW] Error creating agent:', error);
      throw error;
    }
  }

  /**
   * Update an existing agent
   */
  async updateAgent(agentId: string, updates: any): Promise<BackendAgent> {
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
      this.agentInfo = Array.from(this.agents.values());
      
      if (this.io) {
        this.io.emit('agent-updated', updated);
      }

      return updated;
    } catch (error) {
      console.error('❌ [WORKFLOW] Error updating agent:', error);
      throw error;
    }
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    try {
      // First, delete all messages sent by this agent
      await this.prisma.message.deleteMany({
        where: { senderId: agentId },
      });

      // Remove agent from conversation participants
      const conversations = await this.prisma.conversation.findMany();
      for (const conversation of conversations) {
        try {
          const participants = JSON.parse(conversation.participants);
          const updatedParticipants = participants.filter((id: string) => id !== agentId);
          
          if (updatedParticipants.length !== participants.length) {
            await this.prisma.conversation.update({
              where: { id: conversation.id },
              data: { participants: JSON.stringify(updatedParticipants) }
            });
          }
        } catch (parseError) {
          console.warn(`⚠️ Failed to parse participants for conversation ${conversation.id}:`, parseError);
        }
      }

      // Then delete the agent
      await this.prisma.agent.delete({
        where: { id: agentId },
      });

      this.agents.delete(agentId);
      this.agentInfo = Array.from(this.agents.values());
      
      if (this.io) {
        this.io.emit('agent-deleted', agentId);
      }
      
      console.log(`✅ [WORKFLOW] Deleted agent: ${agentId}`);
    } catch (error) {
      console.error('❌ [WORKFLOW] Error deleting agent:', error);
      throw error;
    }
  }

  /**
   * Get all agents
   */
  getAllAgents(): BackendAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get a specific agent
   */
  getAgent(agentId: string): BackendAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get default capabilities for a role
   */
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
      default:
        return ['general_assistance', 'communication', 'problem_solving'];
    }
  }

  /**
   * Get available tools
   */
  getAvailableTools(): any[] {
    return Array.from(this.tools.values()).map(tool => ({
      id: tool.id,
      name: tool.name,
      description: tool.description
    }));
  }

  /**
   * Execute a tool
   */
  async executeTool(toolId: string, params: any, agentId: string): Promise<any> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    try {
      const result = await tool.execute(params, agentId);
      return { success: true, result };
    } catch (error) {
      console.error(`❌ [WORKFLOW] Error executing tool ${toolId}:`, error);
      throw error;
    }
  }

  /**
   * Reset orchestrator state
   */
  reset(): void {
    this.activeProcessing.clear();
    this.messageHistory.clear();
    this.conversationCycles.clear();
    this.recentResponders.clear();
    this.conversationModes.clear();
    this.conversationStates.clear();
    console.log(`🔄 [WORKFLOW] Orchestrator state reset`);
  }

  /**
   * Reset conversation state to prevent "perma workflow state"
   */
  public resetConversationState(conversationId: string, reason: string = 'Manual reset'): void {
    console.log(`🔄 [RESET] Resetting conversation state for ${conversationId}: ${reason}`);
    
    // Clear all state
    this.conversationModes.delete(conversationId);
    this.activeProcessing.delete(conversationId);
    this.conversationCycles.delete(conversationId);
    this.recentResponders.delete(conversationId);
    this.conversationStates.delete(conversationId);
    
    // Emit reset event to UI
    if (this.io) {
      this.io.to(`conversation:${conversationId}`).emit('workflow-reset', {
        conversationId,
        reason,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`✅ [RESET] Conversation state cleared for ${conversationId}`);
  }

  /**
   * Get current conversation status
   */
  public getConversationStatus(conversationId: string): any {
    const mode = this.conversationModes.get(conversationId);
    const lock = Array.from(this.activeProcessing.values())
      .find(lock => lock.conversationId === conversationId);
    
    return {
      conversationId,
      hasActiveMode: !!mode,
      currentMode: mode?.type,
      isLocked: !!lock && (Date.now() - lock.timestamp <= lock.timeout),
      lastActivity: mode?.startTime || lock?.timestamp,
      canReset: !!mode || !!lock
    };
  }

  /**
   * Check if conversation is in a stuck state
   */
  public isConversationStuck(conversationId: string): boolean {
    const mode = this.conversationModes.get(conversationId);
    const lock = Array.from(this.activeProcessing.values())
      .find(lock => lock.conversationId === conversationId);
    
    // Stuck if mode has been running too long
    if (mode && Date.now() - mode.startTime > mode.timeout * 2) {
      return true;
    }
    
    // Stuck if lock is expired but still present
    if (lock && Date.now() - lock.timestamp > lock.timeout) {
      return true;
    }
    
    return false;
  }
}
