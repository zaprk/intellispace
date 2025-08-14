"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowOrchestrator = void 0;
const ollama_1 = require("@langchain/ollama");
const messages_1 = require("@langchain/core/messages");
class WorkflowOrchestrator {
    constructor(prisma) {
        Object.defineProperty(this, "graph", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // Using any for now due to complex LangGraph types
        Object.defineProperty(this, "prisma", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "llm", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "config", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.prisma = prisma;
        this.llm = new ollama_1.ChatOllama({ model: "llama3.2" });
        this.config = this.createDefaultConfig();
        this.graph = this.buildWorkflowGraph();
    }
    createDefaultConfig() {
        return {
            nodes: [
                { id: "coordinator", name: "Project Coordinator", role: "coordinator", capabilities: ["planning", "coordination"], priority: 1 },
                { id: "designer", name: "UI/UX Designer", role: "designer", capabilities: ["wireframes", "design"], priority: 2 },
                { id: "frontend", name: "Frontend Developer", role: "frontend", capabilities: ["react", "ui"], priority: 3 },
                { id: "backend", name: "Backend Developer", role: "backend", capabilities: ["api", "database"], priority: 4 }
            ],
            routingRules: [
                {
                    condition: (state) => state.phase === "requirements" && state.currentInput.length > 0,
                    targetNode: "coordinator",
                    priority: 1
                },
                {
                    condition: (state) => state.phase === "design" && !state.completedTasks.includes("design_approved"),
                    targetNode: "designer",
                    priority: 2
                },
                {
                    condition: (state) => state.phase === "frontend" && !state.completedTasks.includes("frontend_complete"),
                    targetNode: "frontend",
                    priority: 3
                },
                {
                    condition: (state) => state.phase === "backend" && !state.completedTasks.includes("backend_complete"),
                    targetNode: "backend",
                    priority: 4
                }
            ],
            phases: [
                {
                    name: "requirements",
                    requiredAgents: ["coordinator"],
                    completionCriteria: (state) => state.agentOutputs.coordinator?.requirementsComplete === true,
                    nextPhase: "design"
                },
                {
                    name: "design",
                    requiredAgents: ["designer"],
                    completionCriteria: (state) => state.agentOutputs.designer?.designComplete === true,
                    nextPhase: "frontend"
                },
                {
                    name: "frontend",
                    requiredAgents: ["frontend"],
                    completionCriteria: (state) => state.agentOutputs.frontend?.frontendComplete === true,
                    nextPhase: "backend"
                },
                {
                    name: "backend",
                    requiredAgents: ["backend"],
                    completionCriteria: (state) => state.agentOutputs.backend?.backendComplete === true,
                    nextPhase: "integration"
                },
                {
                    name: "integration",
                    requiredAgents: ["coordinator"],
                    completionCriteria: (state) => state.agentOutputs.coordinator?.integrationComplete === true,
                    nextPhase: "complete"
                }
            ]
        };
    }
    buildWorkflowGraph() {
        // Create a simple workflow without LangGraph for now
        // We'll implement a custom workflow engine
        return {
            async invoke(input) {
                return { state: input.state };
            }
        };
    }
    async coordinatorNode(state) {
        try {
            console.log("🎯 Coordinator node executing...");
            const prompt = this.buildCoordinatorPrompt(state);
            const response = await this.llm.invoke([new messages_1.HumanMessage(prompt)]);
            const output = this.parseCoordinatorOutput(response.content);
            return {
                agentOutputs: {
                    ...state.agentOutputs,
                    coordinator: output
                },
                workflowHistory: [
                    ...state.workflowHistory,
                    {
                        id: `coordinator_${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        node: "coordinator",
                        input: state.currentInput,
                        output,
                        status: "success"
                    }
                ]
            };
        }
        catch (error) {
            console.error("❌ Coordinator node error:", error);
            return {
                error: `Coordinator error: ${error}`,
                retryCount: state.retryCount + 1
            };
        }
    }
    async designerNode(state) {
        try {
            console.log("🎨 Designer node executing...");
            const prompt = this.buildDesignerPrompt(state);
            const response = await this.llm.invoke([new messages_1.HumanMessage(prompt)]);
            const output = this.parseDesignerOutput(response.content);
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
        }
        catch (error) {
            console.error("❌ Designer node error:", error);
            return {
                error: `Designer error: ${error}`,
                retryCount: state.retryCount + 1
            };
        }
    }
    async frontendNode(state) {
        try {
            console.log("⚛️ Frontend node executing...");
            const prompt = this.buildFrontendPrompt(state);
            const response = await this.llm.invoke([new messages_1.HumanMessage(prompt)]);
            const output = this.parseFrontendOutput(response.content);
            return {
                agentOutputs: {
                    ...state.agentOutputs,
                    frontend: output
                },
                workflowHistory: [
                    ...state.workflowHistory,
                    {
                        id: `frontend_${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        node: "frontend",
                        input: state.currentInput,
                        output,
                        status: "success"
                    }
                ]
            };
        }
        catch (error) {
            console.error("❌ Frontend node error:", error);
            return {
                error: `Frontend error: ${error}`,
                retryCount: state.retryCount + 1
            };
        }
    }
    async backendNode(state) {
        try {
            console.log("🔧 Backend node executing...");
            const prompt = this.buildBackendPrompt(state);
            const response = await this.llm.invoke([new messages_1.HumanMessage(prompt)]);
            const output = this.parseBackendOutput(response.content);
            return {
                agentOutputs: {
                    ...state.agentOutputs,
                    backend: output
                },
                workflowHistory: [
                    ...state.workflowHistory,
                    {
                        id: `backend_${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        node: "backend",
                        input: state.currentInput,
                        output,
                        status: "success"
                    }
                ]
            };
        }
        catch (error) {
            console.error("❌ Backend node error:", error);
            return {
                error: `Backend error: ${error}`,
                retryCount: state.retryCount + 1
            };
        }
    }
    async routerNode(state) {
        console.log("🔄 Router node executing...");
        // Check for errors first
        if (state.error) {
            return { error: state.error };
        }
        // Check if workflow is complete
        if (state.phase === "complete") {
            return { phase: "complete" };
        }
        // Determine next phase if current phase is complete
        const currentPhase = this.config.phases.find(p => p.name === state.phase);
        if (currentPhase && currentPhase.completionCriteria(state)) {
            const nextPhase = currentPhase.nextPhase || "complete";
            return { phase: nextPhase };
        }
        return {};
    }
    async errorHandlerNode(state) {
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
    routeByState(state) {
        // Check for errors
        if (state.error) {
            return "error_handler";
        }
        // Check if workflow is complete
        if (state.phase === "complete") {
            return "end";
        }
        // Apply routing rules
        const applicableRules = this.config.routingRules
            .filter(rule => rule.condition(state))
            .sort((a, b) => b.priority - a.priority);
        if (applicableRules.length > 0) {
            return applicableRules[0].targetNode;
        }
        // Default to coordinator
        return "coordinator";
    }
    // Prompt builders
    buildCoordinatorPrompt(state) {
        return `You are a Project Coordinator managing an e-commerce platform development project.

Current Phase: ${state.phase}
Current Input: ${state.currentInput}

Previous Outputs: ${JSON.stringify(state.agentOutputs, null, 2)}

Your role is to:
1. Analyze the current input and project state
2. Determine the next steps and required deliverables
3. Coordinate between team members
4. Ensure project requirements are clear and complete

Respond with a JSON object containing:
{
  "analysis": "Your analysis of the current situation",
  "nextSteps": ["step1", "step2", "step3"],
  "requiredDeliverables": ["deliverable1", "deliverable2"],
  "teamAssignments": {"designer": "task1", "frontend": "task2", "backend": "task3"},
  "requirementsComplete": true/false,
  "message": "Your response message to the team"
}`;
    }
    buildDesignerPrompt(state) {
        return `You are a UI/UX Designer working on an e-commerce platform.

Current Phase: ${state.phase}
Current Input: ${state.currentInput}
Coordinator Output: ${JSON.stringify(state.agentOutputs.coordinator, null, 2)}

Your role is to:
1. Create wireframes and design specifications
2. Ensure user experience is intuitive and modern
3. Provide design assets and guidelines

Respond with a JSON object containing:
{
  "wireframes": ["description of wireframe1", "description of wireframe2"],
  "designSpecs": "Detailed design specifications",
  "userExperience": "UX considerations and flow",
  "designComplete": true/false,
  "message": "Your response message"
}`;
    }
    buildFrontendPrompt(state) {
        return `You are a Frontend Developer working on an e-commerce platform.

Current Phase: ${state.phase}
Current Input: ${state.currentInput}
Designer Output: ${JSON.stringify(state.agentOutputs.designer, null, 2)}

Your role is to:
1. Implement the frontend using React and modern technologies
2. Create reusable components
3. Ensure responsive and accessible design

Respond with a JSON object containing:
{
  "components": ["component1", "component2"],
  "technologies": ["React", "TypeScript", "Tailwind"],
  "implementation": "Implementation details",
  "frontendComplete": true/false,
  "message": "Your response message"
}`;
    }
    buildBackendPrompt(state) {
        return `You are a Backend Developer working on an e-commerce platform.

Current Phase: ${state.phase}
Current Input: ${state.currentInput}
Frontend Output: ${JSON.stringify(state.agentOutputs.frontend, null, 2)}

Your role is to:
1. Design and implement RESTful APIs
2. Set up database schema and models
3. Ensure security and performance

Respond with a JSON object containing:
{
  "apis": ["api1", "api2"],
  "database": "Database schema and models",
  "security": "Security considerations",
  "backendComplete": true/false,
  "message": "Your response message"
}`;
    }
    // Output parsers
    parseCoordinatorOutput(content) {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        catch (error) {
            console.error("Failed to parse coordinator output:", error);
        }
        return { message: content, requirementsComplete: false };
    }
    parseDesignerOutput(content) {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        catch (error) {
            console.error("Failed to parse designer output:", error);
        }
        return { message: content, designComplete: false };
    }
    parseFrontendOutput(content) {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        catch (error) {
            console.error("Failed to parse frontend output:", error);
        }
        return { message: content, frontendComplete: false };
    }
    parseBackendOutput(content) {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        catch (error) {
            console.error("Failed to parse backend output:", error);
        }
        return { message: content, backendComplete: false };
    }
    // Custom workflow execution engine
    async executeWorkflow(state) {
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
            let nodeResult = {};
            switch (nextNode) {
                case "coordinator":
                    nodeResult = await this.coordinatorNode(currentState);
                    break;
                case "designer":
                    nodeResult = await this.designerNode(currentState);
                    break;
                case "frontend":
                    nodeResult = await this.frontendNode(currentState);
                    break;
                case "backend":
                    nodeResult = await this.backendNode(currentState);
                    break;
                case "error_handler":
                    nodeResult = await this.errorHandlerNode(currentState);
                    break;
                default:
                    console.warn(`Unknown node: ${nextNode}`);
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
    async processMessage(message) {
        const initialState = {
            conversationId: message.conversationId,
            phase: "requirements",
            activeAgents: [],
            completedTasks: [],
            pendingTasks: [],
            agentOutputs: {},
            messages: [message],
            currentInput: message.content,
            workflowHistory: [],
            retryCount: 0
        };
        try {
            console.log("🚀 Starting workflow execution...");
            const result = await this.executeWorkflow(initialState);
            console.log("✅ Workflow execution completed");
            return result;
        }
        catch (error) {
            console.error("❌ Workflow execution error:", error);
            return {
                ...initialState,
                error: `Workflow error: ${error}`,
                phase: "complete"
            };
        }
    }
    getWorkflowState(conversationId) {
        // In a real implementation, this would load from persistent storage
        return null;
    }
    saveWorkflowState(state) {
        // In a real implementation, this would save to persistent storage
        console.log("💾 Saving workflow state:", state);
    }
}
exports.WorkflowOrchestrator = WorkflowOrchestrator;
