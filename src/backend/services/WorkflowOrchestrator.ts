import { ChatOllama } from "@langchain/ollama";
import { HumanMessage } from "@langchain/core/messages";
import { 
  WorkflowState, 
  WorkflowStep, 
  AgentNode, 
  WorkflowConfig,
  Message,
  Agent 
} from "../../shared/types";
import { PrismaClient } from "@prisma/client";

// ===== NEW TYPES =====
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

// ===== FIXED WORKFLOW ORCHESTRATOR =====
export class WorkflowOrchestrator {
  private teamAgents: string[] = [];
  private agentInfo: Agent[] = [];
  private llm: ChatOllama;
  private prisma: PrismaClient;
  private io?: any; // Socket.IO instance for streaming
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.llm = new ChatOllama({ model: "llama2" });
  }
  
  setSocketIO(io: any) {
    this.io = io;
  }
  
  setAgents(agents: Agent[]) {
    this.agentInfo = agents;
    this.teamAgents = agents
      .filter(agent => ['coordinator', 'designer', 'frontend-developer', 'backend-developer'].includes(agent.role))
      .map(agent => agent.id);
    
    console.log('🔧 [WORKFLOW] Set agents:', this.teamAgents);
    console.log('🔧 [WORKFLOW] Agent info:', agents.map(a => `${a.name} (${a.role})`));
  }

  private getAgentIdByRole(role: string): string | undefined {
    const agent = this.agentInfo.find(a => a.role === role);
    return agent?.id;
  }

  private parseMentions(content: string): string[] {
    // Extract @ mentions from content - handle multi-word names
    const mentionMatches = content.match(/@([A-Za-z\s]+)/g);
    if (!mentionMatches) return [];
    
    const mentionedAgentIds: string[] = [];
    
    for (const mention of mentionMatches) {
      // Remove @ and get the full match
      let agentName = mention.substring(1).trim();
      
      // Find the longest matching agent name
      let bestMatch: any = null;
      let bestMatchLength = 0;
      
      for (const agent of this.agentInfo) {
        const agentNameLower = agent.name.toLowerCase();
        const agentRoleLower = agent.role.toLowerCase();
        const mentionLower = agentName.toLowerCase();
        
        // Check if this agent name is contained in the mention
        if (mentionLower.includes(agentNameLower) || mentionLower.includes(agentRoleLower)) {
          if (agentNameLower.length > bestMatchLength) {
            bestMatch = agent;
            bestMatchLength = agentNameLower.length;
          }
        }
      }
      
      if (bestMatch) {
        mentionedAgentIds.push(bestMatch.id);
        console.log(`📝 [MENTIONS] Found agent: ${bestMatch.name} (${bestMatch.role}) -> ${bestMatch.id}`);
      } else {
        console.log(`⚠️ [MENTIONS] Agent not found: "${agentName}"`);
      }
    }
    
    return mentionedAgentIds;
  }

  private determineProcessingMode(mentionedAgents: string[], content: string): {
    agents: string[];
    maxRounds: number;
    mode: 'workflow' | 'solo' | 'mini-workflow';
  } {
    // No mentions = Full workflow
    if (mentionedAgents.length === 0) {
      const coordinatorId = this.getAgentIdByRole('coordinator');
      return {
        agents: coordinatorId ? [coordinatorId] : [],
        maxRounds: 3,
        mode: 'workflow'
      };
    }
    
    // Single mention = Solo response
    if (mentionedAgents.length === 1) {
      return {
        agents: mentionedAgents,
        maxRounds: 1,
        mode: 'solo'
      };
    }
    
    // Multiple mentions = Mini workflow
    return {
      agents: mentionedAgents,
      maxRounds: 2,
      mode: 'mini-workflow'
    };
  }
  
  async processMessage(message: Message): Promise<SharedWorkflowState> {
    console.log('🚀 Starting message processing...');
    
    // Parse @ mentions from user input
    const mentionedAgents = this.parseMentions(message.content);
    console.log('📝 [MENTIONS] Parsed mentions:', mentionedAgents);
    
    // Determine processing mode based on mentions
    const processingMode = this.determineProcessingMode(mentionedAgents, message.content);
    console.log('🎯 [MODE] Processing mode:', processingMode);
    
    // Initialize shared state
    const state: SharedWorkflowState = {
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
      nextAgents: processingMode.agents,
      collaborationRound: 1,
      maxRounds: processingMode.maxRounds,
      messages: []
    };
    
    // Run the appropriate processing mode
    if (processingMode.mode === 'solo') {
      // Solo response - direct agent response without workflow
      console.log('🎯 [SOLO] Processing solo agent response');
      await this.processSoloResponse(state);
    } else {
      // Workflow mode - collaborative processing
      console.log('🔄 [WORKFLOW] Processing collaborative workflow');
      while (state.phase !== 'complete' && state.collaborationRound <= state.maxRounds) {
        console.log(`🔄 Round ${state.collaborationRound}, Phase: ${state.phase}`);
        console.log(`🎯 Active agents: ${state.nextAgents.join(', ')}`);
        
        // Process next agents in sequence
        await this.processAgentRound(state);
        
        // Update workflow state
        this.updateWorkflowPhase(state);
        
        // If no more agents to process, complete the workflow
        if (state.nextAgents.length === 0) {
          state.phase = 'complete';
          console.log('✅ No more agents to process, completing workflow');
          break;
        }
        
        state.collaborationRound++;
      }
    }
    
    state.phase = 'complete';
    console.log('✅ Workflow complete');
    
    return state;
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
      ? this.buildSoloPrompt(agentId, agent.role, state)
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

  private buildSoloPrompt(agentId: string, role: string, state: SharedWorkflowState): string {
    const agent = this.agentInfo.find(a => a.id === agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const baseContext = `You are ${agent.name}, a ${role} in a development team. The user has directly mentioned you with @${agent.name}.`;

    const rolePrompts: { [key: string]: string } = {
      'coordinator': `${baseContext}

The user said: "${state.userRequest}"

As the PROJECT COORDINATOR, provide a direct, helpful response to the user. You can:
- Answer questions about project management
- Help with planning and coordination
- Provide guidance on team collaboration
- Address any concerns or requests

Keep your response conversational and helpful. Don't start a full workflow unless the user specifically asks for it.

RESPOND WITH ONLY THIS JSON FORMAT:
{
  "message": "Your direct response to the user here",
  "reasoning": "Brief explanation of your response"
}`,

      'designer': `${baseContext}

The user said: "${state.userRequest}"

As the UI/UX DESIGNER, provide a direct, helpful response to the user. You can:
- Answer questions about design principles
- Help with color schemes, typography, and layout
- Provide design recommendations
- Discuss user experience considerations

Keep your response conversational and helpful. Focus on design-related topics.

RESPOND WITH ONLY THIS JSON FORMAT:
{
  "message": "Your direct response to the user here",
  "reasoning": "Brief explanation of your response"
}`,

      'frontend-developer': `${baseContext}

The user said: "${state.userRequest}"

As the FRONTEND DEVELOPER, provide a direct, helpful response to the user. You can:
- Answer questions about frontend technologies
- Help with HTML, CSS, JavaScript, React, etc.
- Provide coding advice and best practices
- Discuss user interface implementation

Keep your response conversational and helpful. Focus on frontend development topics.

RESPOND WITH ONLY THIS JSON FORMAT:
{
  "message": "Your direct response to the user here",
  "reasoning": "Brief explanation of your response"
}`,

      'backend-developer': `${baseContext}

The user said: "${state.userRequest}"

As the BACKEND DEVELOPER, provide a direct, helpful response to the user. You can:
- Answer questions about backend technologies
- Help with Node.js, Express, databases, APIs, etc.
- Provide coding advice and best practices
- Discuss server-side implementation

Keep your response conversational and helpful. Focus on backend development topics.

RESPOND WITH ONLY THIS JSON FORMAT:
{
  "message": "Your direct response to the user here",
  "reasoning": "Brief explanation of your response"
}`
    };

    return rolePrompts[role] || `${baseContext}\nProvide a direct response to the user.`;
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
  
       private async processSoloResponse(state: SharedWorkflowState): Promise<void> {
    // For solo responses, just get a direct response from the agent
    const agentId = state.nextAgents[0];
    if (!agentId) return;
    
    console.log(`🎯 [SOLO] Getting direct response from agent: ${agentId}`);
    
    try {
      const contribution = await this.invokeAgent(agentId, state);
      
      // Update shared state with contribution
      state.agentContributions[agentId] = contribution;
      
      // Add message for UI
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
            displayMessage = parsed.message || 'Agent response';
          }
        } catch (error) {
          displayMessage = 'Agent response';
        }
      }
      
      const agent = this.agentInfo.find(a => a.id === agentId);
      const message = {
        id: `${agentId}-${Date.now()}`,
        conversationId: state.conversationId,
        senderId: agentId,
        content: displayMessage,
        type: 'text',
        timestamp: new Date().toISOString(),
        sender: agent ? {
          id: agent.id,
          name: agent.name,
          avatar: '🤖', // Default avatar
          role: agent.role
        } : undefined
      };
      
      state.messages.push(message);
      
      // Stream the message if Socket.IO is available
      if (this.io) {
        this.io.to(`conversation:${state.conversationId}`).emit('new-message', message);
      }
      
      console.log(`✅ [SOLO] Solo response completed from ${agentId}`);
      
    } catch (error) {
      console.error(`❌ [SOLO] Error getting solo response from ${agentId}:`, error);
      state.error = `Failed to get response from agent: ${error}`;
    }
    
    // Mark as complete
    state.phase = 'complete';
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
    return null;
  }

  // Legacy method for backward compatibility
  public saveWorkflowState(state: SharedWorkflowState): void {
    console.log("💾 Saving workflow state:", state);
  }
}
