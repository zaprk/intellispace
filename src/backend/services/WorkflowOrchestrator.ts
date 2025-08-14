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
  
  async processMessage(message: Message): Promise<SharedWorkflowState> {
    console.log('🚀 Starting shared state workflow...');
    
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
      nextAgents: [this.getAgentIdByRole('coordinator')].filter((id): id is string => id !== undefined),
      collaborationRound: 1,
      maxRounds: 3,
      messages: []
    };
    
    // Run the collaborative workflow
    while (state.phase !== 'complete' && state.collaborationRound <= state.maxRounds) {
      console.log(`🔄 Round ${state.collaborationRound}, Phase: ${state.phase}`);
      console.log(`🎯 Active agents: ${state.nextAgents.join(', ')}`);
      
      // Process next agents in sequence
      await this.processAgentRound(state);
      
      // Update workflow state
      this.updateWorkflowPhase(state);
      
      state.collaborationRound++;
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
  
  private async invokeAgent(agentId: string, state: SharedWorkflowState): Promise<AgentContribution> {
    const agent = this.agentInfo.find(a => a.id === agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    const prompt = this.buildSharedStatePrompt(agentId, agent.role, state);
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
As PROJECT COORDINATOR, analyze "${state.userRequest}" and provide specific requirements, decisions, and tasks.

RESPOND WITH ONLY THIS JSON FORMAT (replace the placeholder text with your actual analysis):
{
  "knowledgeUpdates": {
    "requirements": ["Create a visually appealing landing page", "Use vibrant colors and modern design", "Ensure responsive layout"],
    "decisions": ["Use modern CSS framework", "Implement smooth animations", "Focus on user engagement"],
    "tasks": ["Design wireframes", "Create color palette", "Plan responsive breakpoints"]
  },
  "dependsOn": [],
  "enablesAgents": ["designer", "frontend-developer", "backend-developer"],
  "message": "Project analysis: We need to create a beautiful, vibrant Hello World page with modern design principles, responsive layout, and engaging user experience. Key focus areas include visual appeal, color scheme, and interactive elements.",
  "reasoning": "The user wants a beautiful and vibrant page, so we need strong design focus, modern web technologies, and attention to visual details."
}`,

                    designer: `${baseContext}
As UI/UX DESIGNER, based on the coordinator's analysis of "${state.userRequest}", provide specific design decisions and recommendations.

RESPOND WITH ONLY THIS JSON FORMAT (replace the placeholder text with your actual design analysis):
{
  "knowledgeUpdates": {
    "decisions": ["Use gradient backgrounds for vibrancy", "Implement glassmorphism effects", "Choose bold typography"],
    "tasks": ["Create color palette with vibrant hues", "Design hero section with animations", "Plan interactive elements"],
    "requirements": ["Ensure accessibility compliance", "Optimize for mobile devices", "Include loading animations"]
  },
  "dependsOn": ["coordinator"],
  "enablesAgents": ["frontend-developer"],
  "message": "Design approach: I recommend a vibrant color scheme with gradients, glassmorphism effects for modern appeal, bold typography for impact, and smooth animations to create an engaging user experience. The page should be visually striking while maintaining excellent usability.",
  "reasoning": "The user wants 'beautiful and vibrant', so I'm focusing on modern design trends like gradients, glassmorphism, and bold visual elements that create immediate visual impact."
}`,

                    'frontend-developer': `${baseContext}
As FRONTEND DEVELOPER, based on the coordinator's requirements and designer's decisions for "${state.userRequest}", provide specific technical implementation details.

RESPOND WITH ONLY THIS JSON FORMAT (replace the placeholder text with your actual technical analysis):
{
  "knowledgeUpdates": {
    "decisions": ["Use React with TypeScript", "Implement CSS-in-JS for dynamic styling", "Add Framer Motion for animations"],
    "integrationPoints": ["API endpoint for dynamic content", "WebSocket for real-time updates"],
    "tasks": ["Set up React project structure", "Create reusable components", "Implement responsive design"]
  },
  "dependsOn": ["coordinator", "designer"],
  "enablesAgents": ["backend-developer"],
  "message": "Frontend approach: I'll use React with TypeScript for robust development, CSS-in-JS for dynamic styling capabilities, and Framer Motion for smooth animations. The implementation will focus on creating reusable components and ensuring responsive design across all devices.",
  "reasoning": "React provides the flexibility needed for a vibrant, interactive page, TypeScript ensures code quality, and modern animation libraries will bring the design to life."
}`,

                    'backend-developer': `${baseContext}
As BACKEND DEVELOPER, based on all previous team contributions for "${state.userRequest}", provide specific backend implementation details.

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
  "message": "Backend approach: I'll implement a Node.js Express server with RESTful API endpoints for content management and WebSocket support for real-time features. The backend will provide the necessary infrastructure to support the vibrant, interactive frontend experience.",
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
     const allTeamAgentsContributed = this.teamAgents.every(agentId => 
       state.agentContributions[agentId] !== undefined
     );
     
     if (state.nextAgents.length === 0 || state.collaborationRound >= state.maxRounds || allTeamAgentsContributed) {
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
