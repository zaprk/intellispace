import { StateGraph, END } from "@langchain/langgraph";
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

export class WorkflowOrchestrator {
  private graph: any; // Using any for now due to complex LangGraph types
  private prisma: PrismaClient;
  private llm: ChatOllama;
  private config: WorkflowConfig;
  private teamAgents: string[];

  constructor(prisma: PrismaClient, teamAgents: string[] = []) {
    this.prisma = prisma;
    this.llm = new ChatOllama({ model: "llama2" });
    this.teamAgents = teamAgents.length > 0 ? teamAgents : ["coordinator", "designer", "frontend-developer", "backend-developer"];
    this.config = this.createDefaultConfig();
    this.graph = this.buildWorkflowGraph();
  }

  // Method to update team agents dynamically
  public updateTeamAgents(agentOrchestrator: any): void {
    const allAgents = agentOrchestrator.getAllAgents();
    console.log('🔍 [WORKFLOW] All agents from orchestrator:', allAgents.map(a => `${a.name} (${a.role}) - ${a.id}`));
    
    const agentMap = new Map<string, string>(); // role -> id mapping
    
    allAgents.forEach(agent => {
      agentMap.set(agent.role, agent.id);
    });
    
    // Map roles to actual agent IDs
    this.teamAgents = ["coordinator", "designer", "frontend-developer", "backend-developer"]
      .map(role => agentMap.get(role))
      .filter(id => id !== undefined) as string[];
    
    console.log('🔄 [WORKFLOW] Updated team agents:', this.teamAgents);
    console.log('🔄 [WORKFLOW] Agent mapping:', Object.fromEntries(agentMap));
    console.log('🔍 [WORKFLOW] Team agents length:', this.teamAgents.length);
    console.log('🔍 [WORKFLOW] Expected roles:', ["coordinator", "designer", "frontend-developer", "backend-developer"]);
    
    // Recreate config with new agent IDs
    this.config = this.createDefaultConfig();
  }

  // Get agent information from database
  private async getAgentInfo(): Promise<any[]> {
    try {
      const agents = await this.prisma.agent.findMany({
        select: {
          id: true,
          name: true,
          role: true
        }
      });
      return agents;
    } catch (error) {
      console.error('Error fetching agent info:', error);
      return [];
    }
  }

  // Get agent information synchronously (cached)
  private getAgentInfoSync(): any[] {
    // This is a fallback - in a real implementation, you'd cache the agent info
    // For now, we'll assume the teamAgents are in the correct order
    const roleOrder = ["coordinator", "designer", "frontend-developer", "backend-developer"];
    
    console.log("🔍 [AGENT_INFO] Team agents length:", this.teamAgents.length);
    console.log("🔍 [AGENT_INFO] Role order length:", roleOrder.length);
    
    if (this.teamAgents.length === 0) {
      console.warn("⚠️ [AGENT_INFO] No team agents found!");
      return [];
    }
    
    return this.teamAgents.map((agentId, index) => {
      const role = roleOrder[index] || "unknown";
      console.log(`🔍 [AGENT_INFO] Mapping ${agentId} -> ${role}`);
      return {
        id: agentId,
        name: role,
        role: role
      };
    });
  }

  // Extract tagged agents from text content
  private async extractTaggedAgentsFromText(content: string): Promise<any> {
    const taggedAgents: string[] = [];
    const agentInfo = await this.getAgentInfo();
    
    // Look for role-based tags (@designer, @frontend-developer, etc.)
    const roleTags = ["@designer", "@frontend-developer", "@backend-developer"];
    roleTags.forEach(roleTag => {
      if (content.includes(roleTag)) {
        const role = roleTag.substring(1); // Remove @
        const agent = agentInfo.find(a => a.role === role);
        if (agent) {
          taggedAgents.push(agent.id);
        }
      }
    });
    
    console.log("🔍 [PARSER] Extracted tagged agents from text:", taggedAgents);
    
    return { 
      message: content, 
      taggedAgents: taggedAgents,
      requirementsComplete: false 
    };
  }

  private createDefaultConfig(): WorkflowConfig {
    // Create nodes dynamically from team agents
    const nodes = this.teamAgents.map((agentId, index) => {
      const agentNames: Record<string, string> = {
        "coordinator": "Project Coordinator",
        "designer": "UI/UX Designer", 
        "frontend-developer": "Frontend Developer",
        "backend-developer": "Backend Developer"
      };
      
      const agentCapabilities: Record<string, string[]> = {
        "coordinator": ["planning", "coordination"],
        "designer": ["wireframes", "design"],
        "frontend-developer": ["react", "ui"],
        "backend-developer": ["api", "database"]
      };
      
      return {
        id: agentId,
        name: agentNames[agentId] || agentId,
        role: agentId,
        capabilities: agentCapabilities[agentId] || [],
        priority: index + 1
      };
    });

    // Create routing rules dynamically
    const routingRules = [
      // Coordinator always goes first - but only if it hasn't responded yet
      {
        condition: (state) => {
          const coordinatorId = this.teamAgents.find(id => {
            const agent = this.getAgentInfoSync().find(a => a.id === id);
            return agent && agent.role === "coordinator";
          });
          const hasCoordinatorOutput = coordinatorId ? Boolean(state.agentOutputs[coordinatorId]) : false;
          console.log(`🔍 [ROUTING] Coordinator condition check: phase=${state.phase}, coordinatorId=${coordinatorId}, hasOutput=${hasCoordinatorOutput}`);
          return Boolean(state.phase === "coordinator_response" && coordinatorId && !hasCoordinatorOutput);
        },
        targetNode: "coordinator",
        priority: 1
      }
    ];

    // Add routing rules for tagged agents
    this.teamAgents.forEach((agentId, index) => {
      const agent = this.getAgentInfoSync().find(a => a.id === agentId);
      if (agent && agent.role !== "coordinator") {
        routingRules.push({
          condition: (state) => 
            state.phase === "tagged_response" && 
            Array.isArray(state.taggedAgents) && 
            state.taggedAgents.includes(agentId) && 
            !state.agentOutputs[agentId],
          targetNode: agentId,
          priority: index + 2
        });
      }
    });

    return {
      nodes,
      routingRules,
      phases: [
        {
          name: "coordinator_response",
          requiredAgents: ["coordinator"],
          completionCriteria: (state) => {
            const coordinatorId = this.teamAgents.find(id => {
              const agent = this.getAgentInfoSync().find(a => a.id === id);
              return agent && agent.role === "coordinator";
            });
            return coordinatorId ? Boolean(state.agentOutputs[coordinatorId]) : false;
          },
          nextPhase: "tagged_response"
        },
        {
          name: "tagged_response",
          requiredAgents: [],
          completionCriteria: (state) => {
            if (!state.taggedAgents || state.taggedAgents.length === 0) {
              return true; // No agents to respond to
            }
            // Check if all tagged agents have responded
            return state.taggedAgents.every(agentId => state.agentOutputs[agentId]);
          },
          nextPhase: "complete"
        }
      ]
    };
  }

  private buildWorkflowGraph(): any {
    // Create a simple workflow without LangGraph for now
    // We'll implement a custom workflow engine
    return {
      async invoke(input: any): Promise<any> {
        return { state: input.state };
      }
    };
  }

  private async coordinatorNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    try {
      console.log("🎯 Coordinator node executing...");
      console.log("🔍 [COORDINATOR] Team agents:", this.teamAgents);
      console.log("🔍 [COORDINATOR] Agent info sync:", this.getAgentInfoSync());
      
      // Find the actual coordinator agent ID
      const coordinatorId = this.teamAgents.find(id => {
        const agent = this.getAgentInfoSync().find(a => a.id === id);
        console.log("🔍 [COORDINATOR] Checking agent:", id, "->", agent);
        return agent && agent.role === "coordinator";
      });
      
      console.log("🔍 [COORDINATOR] Found coordinator ID:", coordinatorId);
      
      if (!coordinatorId) {
        throw new Error("Coordinator agent not found");
      }
      
      const prompt = await this.buildCoordinatorPrompt(state);
      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      
      const output = await this.parseCoordinatorOutput(response.content as string);
      
      // Extract tagged agents from coordinator response
      const taggedAgents = output.taggedAgents || [];
      console.log(`🎯 Coordinator extracted taggedAgents:`, taggedAgents);
      
      return {
        agentOutputs: {
          ...state.agentOutputs,
          [coordinatorId]: output
        },
        taggedAgents,
        workflowHistory: [
          ...state.workflowHistory,
          {
            id: `coordinator_${Date.now()}`,
            timestamp: new Date().toISOString(),
            node: coordinatorId,
            input: state.currentInput,
            output,
            status: "success"
          }
        ]
      };
    } catch (error) {
      console.error("❌ Coordinator node error:", error);
      return {
        error: `Coordinator error: ${error}`,
        retryCount: state.retryCount + 1
      };
    }
  }

  private async designerNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    try {
      console.log("🎨 Designer node executing...");
      
      const prompt = this.buildDesignerPrompt(state);
      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      
      const output = this.parseDesignerOutput(response.content as string);
      
      return {
        agentOutputs: {
          ...state.agentOutputs,
          designer: output
        },
        workflowHistory: [
          ...state.workflowHistory,
          {
            id: `designer_${Date.now()}`,
            timestamp: new Date().toISOString(),
            node: "designer",
            input: state.currentInput,
            output,
            status: "success"
          }
        ]
      };
    } catch (error) {
      console.error("❌ Designer node error:", error);
      return {
        error: `Designer error: ${error}`,
        retryCount: state.retryCount + 1
      };
    }
  }

  private async frontendNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    try {
      console.log("⚛️ Frontend node executing...");
      
      const prompt = this.buildFrontendPrompt(state);
      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      
      const output = this.parseFrontendOutput(response.content as string);
      
             return {
         agentOutputs: {
           ...state.agentOutputs,
           "frontend-developer": output
         },
         workflowHistory: [
           ...state.workflowHistory,
           {
             id: `frontend-developer_${Date.now()}`,
             timestamp: new Date().toISOString(),
             node: "frontend-developer",
             input: state.currentInput,
             output,
             status: "success"
           }
         ]
       };
    } catch (error) {
      console.error("❌ Frontend node error:", error);
      return {
        error: `Frontend error: ${error}`,
        retryCount: state.retryCount + 1
      };
    }
  }

  private async backendNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    try {
      console.log("🔧 Backend node executing...");
      
      const prompt = this.buildBackendPrompt(state);
      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      
      const output = this.parseBackendOutput(response.content as string);
      
             return {
         agentOutputs: {
           ...state.agentOutputs,
           "backend-developer": output
         },
         workflowHistory: [
           ...state.workflowHistory,
           {
             id: `backend-developer_${Date.now()}`,
             timestamp: new Date().toISOString(),
             node: "backend-developer",
             input: state.currentInput,
             output,
             status: "success"
           }
         ]
       };
    } catch (error) {
      console.error("❌ Backend node error:", error);
      return {
        error: `Backend error: ${error}`,
        retryCount: state.retryCount + 1
      };
    }
  }

  private async routerNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    console.log("🔄 Router node executing...");
    
    // Check for errors first
    if (state.error) {
      return { error: state.error };
    }

    // Check if workflow is complete
    if (state.phase === "complete") {
      return { phase: "complete" };
    }

    // Check if current phase is complete and transition to next phase
    const currentPhase = this.config.phases.find(p => p.name === state.phase);
    if (currentPhase && currentPhase.completionCriteria(state)) {
      console.log(`✅ Phase '${state.phase}' complete, transitioning to '${currentPhase.nextPhase}'`);
      return { phase: currentPhase.nextPhase };
    }

    return {};
  }

  private async executeAgentNode(agentId: string, state: WorkflowState): Promise<Partial<WorkflowState>> {
    try {
      console.log(`🎯 ${agentId} node executing...`);
      
      const prompt = this.buildAgentPrompt(agentId, state);
      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      
      const output = this.parseAgentOutput(agentId, response.content as string);
      
      return {
        agentOutputs: {
          ...state.agentOutputs,
          [agentId]: output
        },
        workflowHistory: [
          ...state.workflowHistory,
          {
            id: `${agentId}_${Date.now()}`,
            timestamp: new Date().toISOString(),
            node: agentId,
            input: state.currentInput,
            output,
            status: "success"
          }
        ]
      };
    } catch (error) {
      console.error(`❌ ${agentId} node error:`, error);
      return {
        error: `${agentId} error: ${error}`,
        retryCount: state.retryCount + 1
      };
    }
  }

  private async errorHandlerNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
    console.log("🚨 Error handler executing...");
    
    if (state.retryCount >= 3) {
      return {
        error: "Max retries exceeded",
        phase: "complete"
      };
    }

    // Reset error and retry
    return {
      error: undefined,
      retryCount: state.retryCount
    };
  }

  private routeByState(state: WorkflowState): string {
    // Check for errors
    if (state.error) {
      return "error_handler";
    }

    // Check if workflow is complete
    if (state.phase === "complete") {
      return "end";
    }

    console.log(`🔍 Routing for phase: ${state.phase}, taggedAgents:`, state.taggedAgents);
    console.log(`🔍 Current agentOutputs:`, Object.keys(state.agentOutputs));
    console.log(`🔍 Team agents:`, this.teamAgents);

    // Apply routing rules
    const applicableRules = this.config.routingRules
      .filter(rule => rule.condition(state))
      .sort((a, b) => b.priority - a.priority);

    console.log(`🔍 Applicable rules:`, applicableRules.map(r => r.targetNode));

    if (applicableRules.length > 0) {
      console.log(`🎯 Selected node: ${applicableRules[0].targetNode}`);
      return applicableRules[0].targetNode;
    }

    // If no applicable rules, check if we should transition phases
    if (state.phase === "coordinator_response" && Object.keys(state.agentOutputs).length > 0) {
      console.log(`🔄 No more rules, transitioning to next phase`);
      return "router"; // This will trigger phase transition
    }

    // Default to coordinator only if we're in coordinator_response phase and no coordinator output exists
    const coordinatorId = this.teamAgents.find(id => {
      const agent = this.getAgentInfoSync().find(a => a.id === id);
      return agent && agent.role === "coordinator";
    });
    
    if (state.phase === "coordinator_response" && coordinatorId && !state.agentOutputs[coordinatorId]) {
      console.log(`🎯 Defaulting to coordinator`);
      return "coordinator";
    }

    console.log(`🔄 No applicable rules, ending workflow`);
    return "end";
  }

  // Prompt builders
  private async buildCoordinatorPrompt(state: WorkflowState): Promise<string> {
    // Get agent info from the database to map IDs to roles
    const agentInfo = await this.getAgentInfo();
    const availableAgents = this.teamAgents.filter(agentId => {
      const agent = agentInfo.find(a => a.id === agentId);
      return agent && agent.role !== "coordinator";
    });
    
    const agentTags = availableAgents.map(agentId => {
      const agent = agentInfo.find(a => a.id === agentId);
      return `@${agent?.role || agentId}`;
    }).join(", ");
    
    const agentIds = availableAgents.map(agent => `"${agent}"`).join(", ");
    
    console.log('🔍 [COORDINATOR] Available agents:', availableAgents);
    console.log('🔍 [COORDINATOR] Agent tags:', agentTags);
    console.log('🔍 [COORDINATOR] Agent IDs:', agentIds);
    
    return `You are a Project Coordinator managing an e-commerce platform development project.

Current Input: ${state.currentInput}

Your role is to:
1. Analyze the current input and project requirements
2. Provide initial project planning and coordination
3. Tag relevant team members using ${agentTags}
4. Set clear expectations for the team

IMPORTANT: 
- In your message, tag the team members you want to respond using ${agentTags} format.
- You MUST include the taggedAgents array in your JSON response.
- Use EXACTLY these agent IDs: [${agentIds}]

Respond with a JSON object containing:
{
  "analysis": "Your analysis of the project requirements",
  "projectPlan": "High-level project plan and timeline", 
  "teamRoles": "Clear definition of each team member's responsibilities",
  "successCriteria": "What defines success for this project",
  "taggedAgents": [${agentIds}],
  "message": "Your response message with @tags for team members"
}

IMPORTANT: Ensure your JSON is valid - no newlines or special characters in string values.`;
  }

  private buildDesignerPrompt(state: WorkflowState): string {
    return `You are a UI/UX Designer working on an e-commerce platform.

Current Input: ${state.currentInput}
Coordinator Analysis: ${state.agentOutputs.coordinator ? JSON.stringify(state.agentOutputs.coordinator, null, 2) : "Not available yet"}

Your role is to:
1. Provide initial design thinking and wireframe concepts
2. Suggest modern UI/UX patterns for e-commerce
3. Outline the user journey and key screens needed
4. Consider mobile-first responsive design

Respond with a JSON object containing:
{
  "designApproach": "Your overall design philosophy and approach",
  "keyScreens": ["Homepage", "Product Listing", "Product Detail", "Cart", "Checkout"],
  "wireframeConcepts": "High-level wireframe descriptions for each screen",
  "userJourney": "Main user flows and interactions",
  "designSystem": "Proposed design system and components",
  "message": "Your design response and initial concepts"
}`;
  }

  private buildFrontendPrompt(state: WorkflowState): string {
    return `You are a Frontend Developer working on an e-commerce platform.

Current Input: ${state.currentInput}
Designer Concepts: ${state.agentOutputs.designer ? JSON.stringify(state.agentOutputs.designer, null, 2) : "Not available yet"}

Your role is to:
1. Provide technical architecture for the frontend
2. Suggest modern React patterns and technologies
3. Outline component structure and state management
4. Consider performance and scalability

Respond with a JSON object containing:
{
  "techStack": ["React", "TypeScript", "Tailwind CSS", "State Management"],
  "componentArchitecture": "Proposed component hierarchy and structure",
  "stateManagement": "How to handle application state and data flow",
  "performanceConsiderations": "Optimization strategies and best practices",
  "developmentApproach": "Development methodology and tools",
  "message": "Your technical response and implementation approach"
}`;
  }

  private buildAgentPrompt(agentId: string, state: WorkflowState): string {
    // Find coordinator output
    const coordinatorId = this.teamAgents.find(id => {
      const agent = this.getAgentInfoSync().find(a => a.id === id);
      return agent && agent.role === "coordinator";
    });
    const coordinatorOutput = coordinatorId ? state.agentOutputs[coordinatorId] : null;
    
    console.log(`🔍 [AGENT_PROMPT] Building prompt for ${agentId}`);
    console.log(`🔍 [AGENT_PROMPT] Coordinator ID: ${coordinatorId}`);
    console.log(`🔍 [AGENT_PROMPT] Coordinator output exists: ${!!coordinatorOutput}`);
    
    const agentPrompts: Record<string, string> = {
      "designer": `You are a UI/UX Designer working on an e-commerce platform.

IMPORTANT: You are responding to the COORDINATOR'S ANALYSIS, not the original user message.

Original User Request: ${state.currentInput}
Coordinator Analysis: ${coordinatorOutput ? JSON.stringify(coordinatorOutput, null, 2) : "Not available yet"}

Your role is to:
1. Review the coordinator's analysis and project plan
2. Provide design thinking and wireframe concepts based on the coordinator's requirements
3. Suggest modern UI/UX patterns for e-commerce
4. Outline the user journey and key screens needed
5. Consider mobile-first responsive design

IMPORTANT: Base your response on the coordinator's analysis, not the original user request.

Respond with a JSON object containing:
{
  "designApproach": "Your overall design philosophy and approach based on coordinator's analysis",
  "keyScreens": ["Homepage", "Product Listing", "Product Detail", "Cart", "Checkout"],
  "wireframeConcepts": "High-level wireframe descriptions for each screen",
  "userJourney": "Main user flows and interactions",
  "designSystem": "Proposed design system and components",
  "message": "Your design response based on coordinator's analysis"
}`,
      "frontend-developer": `You are a Frontend Developer working on an e-commerce platform.

IMPORTANT: You are responding to the COORDINATOR'S ANALYSIS, not the original user message.

Original User Request: ${state.currentInput}
Coordinator Analysis: ${coordinatorOutput ? JSON.stringify(coordinatorOutput, null, 2) : "Not available yet"}

Your role is to:
1. Review the coordinator's analysis and project plan
2. Provide technical architecture for the frontend based on coordinator's requirements
3. Suggest modern React patterns and technologies
4. Outline component structure and state management
5. Consider performance and scalability

IMPORTANT: Base your response on the coordinator's analysis, not the original user request.

Respond with a JSON object containing:
{
  "techStack": ["React", "TypeScript", "Tailwind CSS", "State Management"],
  "componentArchitecture": "Proposed component hierarchy and structure",
  "stateManagement": "How to handle application state and data flow",
  "performanceConsiderations": "Optimization strategies and best practices",
  "developmentApproach": "Development methodology and tools",
  "message": "Your technical response based on coordinator's analysis"
}`,
      "backend-developer": `You are a Backend Developer working on an e-commerce platform.

IMPORTANT: You are responding to the COORDINATOR'S ANALYSIS, not the original user message.

Original User Request: ${state.currentInput}
Coordinator Analysis: ${coordinatorOutput ? JSON.stringify(coordinatorOutput, null, 2) : "Not available yet"}

Your role is to:
1. Review the coordinator's analysis and project plan
2. Design the backend architecture and API structure based on coordinator's requirements
3. Plan database schema and data models
4. Consider security, scalability, and performance
5. Outline integration points and third-party services

IMPORTANT: Base your response on the coordinator's analysis, not the original user request.

Respond with a JSON object containing:
{
  "backendArchitecture": "Overall backend architecture and technology choices",
  "apiDesign": "RESTful API endpoints and data structures",
  "databaseSchema": "Database design, tables, and relationships",
  "securityMeasures": "Authentication, authorization, and security considerations",
  "scalabilityPlan": "How to handle growth and performance optimization",
  "message": "Your backend response based on coordinator's analysis"
}`
    };

    return agentPrompts[agentId] || `You are an agent with ID: ${agentId}. Please respond to the coordinator's analysis: ${coordinatorOutput ? JSON.stringify(coordinatorOutput, null, 2) : "No coordinator analysis available"}`;
  }

  private buildBackendPrompt(state: WorkflowState): string {
    return `You are a Backend Developer working on an e-commerce platform.

Current Input: ${state.currentInput}
Frontend Architecture: ${state.agentOutputs["frontend-developer"] ? JSON.stringify(state.agentOutputs["frontend-developer"], null, 2) : "Not available yet"}

Your role is to:
1. Design the backend architecture and API structure
2. Plan database schema and data models
3. Consider security, scalability, and performance
4. Outline integration points and third-party services

Respond with a JSON object containing:
{
  "backendArchitecture": "Overall backend architecture and technology choices",
  "apiDesign": "RESTful API endpoints and data structures",
  "databaseSchema": "Database design, tables, and relationships",
  "securityMeasures": "Authentication, authorization, and security considerations",
  "scalabilityPlan": "How to handle growth and performance optimization",
  "message": "Your backend response and technical architecture"
}`;
  }

  // Output parsers
  private async parseCoordinatorOutput(content: string): Promise<any> {
    try {
      console.log("🔍 [PARSER] Raw coordinator output:", content);
      
      // Try to find JSON in the content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonString = jsonMatch[0];
        
        // Clean up common JSON issues
        jsonString = jsonString
          // Replace newlines and carriage returns in string values with spaces
          .replace(/"([^"]*?)(\n|\r)([^"]*?)"/g, '"$1 $3"')
          // Replace tabs with spaces
          .replace(/\t/g, ' ')
          // Remove any other control characters
          .replace(/[\x00-\x1F\x7F]/g, ' ')
          // Fix common LLM JSON issues
          .replace(/,\s*}/g, '}')  // Remove trailing commas
          .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
        
        try {
          const parsed = JSON.parse(jsonString);
          console.log("✅ [PARSER] Successfully parsed coordinator output:", parsed);
          return parsed;
        } catch (jsonError) {
          console.warn("⚠️ [PARSER] JSON parsing failed after cleanup, trying fallback:", jsonError);
          // If JSON parsing still fails, try to extract just the taggedAgents
          return this.extractTaggedAgentsFromText(content);
        }
      }
      
      // If no JSON found, try to extract tagged agents from the message
      return await this.extractTaggedAgentsFromText(content);
    } catch (error) {
      console.error("❌ [PARSER] Failed to parse coordinator output:", error);
      
      // Fallback: extract tagged agents from message
      return await this.extractTaggedAgentsFromText(content);
    }
  }

  private parseDesignerOutput(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("Failed to parse designer output:", error);
    }
    return { message: content, designComplete: false };
  }

  private parseFrontendOutput(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("Failed to parse frontend output:", error);
    }
    return { message: content, frontendComplete: false };
  }

  private parseAgentOutput(agentId: string, content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error(`Failed to parse ${agentId} output:`, error);
    }
    return { message: content, [`${agentId}Complete`]: false };
  }

  private parseBackendOutput(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("Failed to parse backend output:", error);
    }
    return { message: content, backendComplete: false };
  }

  // Custom workflow execution engine
  private async executeWorkflow(state: WorkflowState): Promise<WorkflowState> {
    let currentState = { ...state };
    let maxIterations = 10;
    let iteration = 0;

    while (iteration < maxIterations && currentState.phase !== "complete") {
      console.log(`🔄 Workflow iteration ${iteration + 1}, phase: ${currentState.phase}`);
      
      // Determine next node to execute
      const nextNode = this.routeByState(currentState);
      
      if (nextNode === "end") {
        currentState.phase = "complete";
        break;
      }

             // Execute the node
       let nodeResult: Partial<WorkflowState> = {};
       
       switch (nextNode) {
         case "coordinator":
           nodeResult = await this.coordinatorNode(currentState);
           break;
         case "error_handler":
           nodeResult = await this.errorHandlerNode(currentState);
           break;
         default:
           // Handle dynamic agent nodes
           if (this.teamAgents.includes(nextNode)) {
             nodeResult = await this.executeAgentNode(nextNode, currentState);
           } else {
             console.warn(`Unknown node: ${nextNode}`);
           }
           break;
       }

      // Update state
      currentState = { ...currentState, ...nodeResult };
      
      // Check for phase transitions
      const routerResult = await this.routerNode(currentState);
      currentState = { ...currentState, ...routerResult };
      
      iteration++;
    }

    return currentState;
  }

  // Public API
  public async processMessage(message: Message): Promise<WorkflowState> {
    const initialState: WorkflowState = {
      conversationId: message.conversationId,
      phase: "coordinator_response",
      activeAgents: [],
      completedTasks: [],
      pendingTasks: [],
      agentOutputs: {},
      messages: [message],
      currentInput: message.content,
      workflowHistory: [],
      taggedAgents: [],
      retryCount: 0
    };

    try {
      console.log("🚀 Starting workflow execution...");
      const result = await this.executeWorkflow(initialState);
      console.log("✅ Workflow execution completed");
      return result;
    } catch (error) {
      console.error("❌ Workflow execution error:", error);
      return {
        ...initialState,
        error: `Workflow error: ${error}`,
        phase: "complete"
      };
    }
  }

  public getWorkflowState(conversationId: string): WorkflowState | null {
    // In a real implementation, this would load from persistent storage
    return null;
  }

  public saveWorkflowState(state: WorkflowState): void {
    // In a real implementation, this would save to persistent storage
    console.log("💾 Saving workflow state:", state);
  }
}
