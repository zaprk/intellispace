"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebTeamOrchestrator = void 0;
class WebTeamOrchestrator {
    constructor(llmService, conversationService, memoryService, io) {
        Object.defineProperty(this, "workflow", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "workspace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "agents", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "llmService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "conversationService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "memoryService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "io", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "conversationId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.llmService = llmService;
        this.conversationService = conversationService;
        this.memoryService = memoryService;
        this.io = io;
        this.agents = new Map();
        this.workflow = {
            phase: 'requirements',
            activeAgent: 'coordinator',
            completedTasks: [],
            pendingTasks: [],
            maxRounds: 8, // Reduced to prevent too many responses
            currentRound: 0
        };
        this.workspace = {
            project: { name: '', type: '', requirements: [], status: 'planning' },
            design: { approved: false },
            frontend: { completed: false },
            backend: { completed: false },
            decisions: []
        };
    }
    setAgents(agents) {
        this.agents = agents;
    }
    async processUserRequest(message, conversationId) {
        this.conversationId = conversationId;
        // Reset workflow for new project
        this.workflow.currentRound = 0;
        this.workflow.phase = 'requirements';
        this.workflow.activeAgent = 'coordinator';
        this.workflow.completedTasks = [];
        this.workflow.pendingTasks = [];
        // Parse requirements from user message
        this.workspace.project = this.extractProjectRequirements(message.content);
        console.log(`🚀 Starting structured workflow for: ${this.workspace.project.name}`);
        console.log(`📋 Requirements: ${this.workspace.project.requirements.join(', ')}`);
        // Start coordinated workflow
        await this.executeWorkflow();
    }
    async executeWorkflow() {
        while (this.workflow.currentRound < this.workflow.maxRounds &&
            this.workflow.phase !== 'complete') {
            // Find agent by role instead of ID
            const activeAgent = Array.from(this.agents.values()).find(agent => agent.role === this.workflow.activeAgent);
            if (!activeAgent) {
                console.log(`❌ Agent with role ${this.workflow.activeAgent} not found, stopping workflow`);
                break;
            }
            console.log(`🔄 Round ${this.workflow.currentRound + 1}: ${activeAgent.name} (${activeAgent.role}) working on ${this.workflow.phase} phase`);
            // Execute current phase
            const response = await this.executePhase(activeAgent);
            // Process response and determine next step
            await this.processResponse(response);
            // Move to next phase/agent
            this.advanceWorkflow();
            this.workflow.currentRound++;
            // Small delay between responses
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (this.workflow.phase === 'complete') {
            console.log(`✅ Workflow completed successfully in ${this.workflow.currentRound} rounds`);
        }
        else {
            console.log(`⏰ Workflow stopped after ${this.workflow.maxRounds} rounds`);
        }
    }
    async executePhase(agent) {
        const context = this.buildContextForAgent(agent.role);
        const systemPrompt = this.getPhaseSpecificPrompt(agent.role, this.workflow.phase);
        // Show typing indicator
        this.conversationService.broadcastTypingIndicator(this.conversationId, agent.id, true);
        try {
            const response = await this.generateResponse(agent, context, systemPrompt);
            // Save the agent's response as a message
            await this.conversationService.createMessage({
                conversationId: this.conversationId,
                senderId: agent.id,
                content: response,
                type: 'text',
                metadata: {
                    model: agent.config.model,
                    provider: agent.config.llmProvider,
                    workflowPhase: this.workflow.phase,
                    workflowRound: this.workflow.currentRound + 1,
                },
            });
            return response;
        }
        finally {
            // Stop typing indicator
            this.conversationService.broadcastTypingIndicator(this.conversationId, agent.id, false);
        }
    }
    async generateResponse(agent, context, systemPrompt) {
        const fullPrompt = `${systemPrompt}

CONTEXT:
${context}

WORKSPACE STATUS:
${JSON.stringify(this.workspace, null, 2)}

RESPONSE REQUIREMENTS:
- Keep response concise and actionable
- Focus on your specific role and phase
- Reference the workspace context
- Provide clear next steps or deliverables

Respond as ${agent.name} (${agent.role}):`;
        let responseContent = '';
        await this.llmService.streamCompletion(fullPrompt, {
            model: agent.config.model,
            provider: agent.config.llmProvider,
            temperature: agent.config.temperature,
            maxTokens: agent.config.maxTokens,
        }, (chunk) => {
            responseContent += chunk;
            // Emit streaming updates
            this.io.to(`conversation:${this.conversationId}`).emit('agent-streaming', {
                agentId: agent.id,
                content: responseContent,
            });
        });
        return responseContent;
    }
    buildContextForAgent(role) {
        const context = [`Current Project: ${this.workspace.project.name}`];
        switch (role) {
            case 'coordinator':
                context.push(`Phase: ${this.workflow.phase}`);
                context.push(`Completed: ${this.workflow.completedTasks.join(', ')}`);
                context.push(`Pending: ${this.workflow.pendingTasks.join(', ')}`);
                break;
            case 'designer':
                context.push(`Requirements: ${this.workspace.project.requirements.join(', ')}`);
                if (this.workspace.design.wireframes) {
                    context.push(`Previous Design: ${this.workspace.design.wireframes}`);
                }
                break;
            case 'frontend-developer':
                context.push(`Design Status: ${this.workspace.design.approved ? 'Approved' : 'Pending'}`);
                if (this.workspace.design.components) {
                    context.push(`Components: ${JSON.stringify(this.workspace.design.components)}`);
                }
                break;
            case 'backend-developer':
                context.push(`Frontend Progress: ${this.workspace.frontend.completed ? 'Ready' : 'In Progress'}`);
                if (this.workspace.frontend.dependencies) {
                    context.push(`API Requirements: ${this.workspace.frontend.dependencies.join(', ')}`);
                }
                break;
        }
        return context.join('\n');
    }
    getPhaseSpecificPrompt(role, phase) {
        const basePrompts = {
            coordinator: {
                requirements: "Analyze the user request and coordinate initial planning. Delegate specific tasks to team members. Limit response to 3-4 sentences.",
                design: "Review design proposals and coordinate frontend planning. Make decisions and move forward. Limit response to 2-3 sentences.",
                frontend: "Monitor frontend progress and coordinate backend integration. Check for blockers. Limit response to 2-3 sentences.",
                backend: "Oversee backend development and prepare for integration testing. Limit response to 2-3 sentences.",
                integration: "Coordinate final integration and testing. Limit response to 2-3 sentences.",
                complete: "Project complete. Provide final summary."
            },
            designer: {
                requirements: "Create wireframes and design system based on requirements. Be specific and actionable. Limit response to 4-5 sentences.",
                design: "Refine design based on feedback. Finalize component specifications. Limit response to 3-4 sentences."
            },
            'frontend-developer': {
                design: "Review design specifications and plan implementation. Identify technical requirements for backend. Limit response to 4-5 sentences.",
                frontend: "Implement the frontend based on approved designs. Document API requirements. Limit response to 4-5 sentences.",
                integration: "Complete frontend integration with backend APIs. Test functionality. Limit response to 3-4 sentences."
            },
            'backend-developer': {
                frontend: "Design APIs and database schema based on frontend requirements. Plan implementation. Limit response to 4-5 sentences.",
                backend: "Implement backend services and APIs. Prepare for frontend integration. Limit response to 4-5 sentences.",
                integration: "Complete API implementation and test with frontend. Limit response to 3-4 sentences."
            }
        };
        return basePrompts[role]?.[phase] || `Continue working on ${phase} phase. Keep response brief and actionable.`;
    }
    async processResponse(response) {
        // Extract decisions and updates from response
        const agent = this.workflow.activeAgent;
        // Update workspace based on agent role and response
        switch (agent) {
            case 'coordinator':
                // Extract task assignments and decisions
                this.extractCoordinatorDecisions(response);
                break;
            case 'designer':
                // Extract design deliverables
                this.extractDesignDeliverables(response);
                break;
            case 'frontend-developer':
                // Extract implementation details and API requirements
                this.extractFrontendProgress(response);
                break;
            case 'backend-developer':
                // Extract backend implementation details
                this.extractBackendProgress(response);
                break;
        }
        // Log decision in workspace
        this.workspace.decisions.push({
            decision: response.substring(0, 100) + '...',
            rationale: `${agent} in ${this.workflow.phase} phase`,
            timestamp: new Date().toISOString(),
            decidedBy: agent
        });
        // Update memory
        await this.memoryService.updateConversationMemory(this.conversationId, this.workspace);
    }
    advanceWorkflow() {
        const currentPhase = this.workflow.phase;
        const currentAgentRole = this.workflow.activeAgent;
        // Find the current agent by role
        const currentAgent = Array.from(this.agents.values()).find(agent => agent.role === currentAgentRole);
        if (!currentAgent) {
            console.log(`❌ Agent with role ${currentAgentRole} not found, stopping workflow`);
            this.workflow.phase = 'complete';
            return;
        }
        // Define workflow transitions by role
        const transitions = {
            requirements: {
                coordinator: { next: 'design', role: 'designer' }
            },
            design: {
                designer: { next: 'frontend', role: 'frontend-developer' },
                coordinator: { next: 'frontend', role: 'frontend-developer' }
            },
            frontend: {
                'frontend-developer': { next: 'backend', role: 'backend-developer' },
                coordinator: { next: 'backend', role: 'backend-developer' }
            },
            backend: {
                'backend-developer': { next: 'integration', role: 'coordinator' },
                coordinator: { next: 'integration', role: 'frontend-developer' }
            },
            integration: {
                coordinator: { next: 'complete', role: 'coordinator' },
                'frontend-developer': { next: 'complete', role: 'coordinator' }
            }
        };
        const transition = transitions[currentPhase]?.[currentAgentRole];
        if (transition) {
            this.workflow.phase = transition.next;
            this.workflow.activeAgent = transition.role;
            this.workflow.completedTasks.push(`${currentAgentRole}:${currentPhase}`);
            console.log(`🔄 Transitioning from ${currentPhase} (${currentAgentRole}) to ${transition.next} (${transition.role})`);
        }
        else {
            // Fallback: move to next logical agent or complete
            this.workflow.phase = 'complete';
            console.log(`🏁 Workflow completed`);
        }
    }
    extractProjectRequirements(message) {
        // Simple extraction logic - in production, use NLP
        const projectType = this.detectProjectType(message);
        const requirements = this.extractKeyRequirements(message);
        return {
            name: `${projectType} Project`,
            type: projectType,
            requirements,
            status: 'planning'
        };
    }
    detectProjectType(message) {
        const types = {
            'ecommerce': ['ecommerce', 'shop', 'store', 'cart', 'product'],
            'restaurant': ['restaurant', 'menu', 'reservation', 'food'],
            'blog': ['blog', 'content', 'posts', 'articles'],
            'dashboard': ['dashboard', 'analytics', 'admin', 'metrics'],
            'portfolio': ['portfolio', 'showcase', 'gallery', 'resume']
        };
        for (const [type, keywords] of Object.entries(types)) {
            if (keywords.some(keyword => message.toLowerCase().includes(keyword))) {
                return type;
            }
        }
        return 'website';
    }
    extractKeyRequirements(message) {
        // Extract key features mentioned in the message
        const features = [];
        const patterns = [
            /user (?:auth|login|registration)/i,
            /payment|checkout|stripe/i,
            /admin|dashboard|cms/i,
            /responsive|mobile/i,
            /search|filter/i,
            /social|share|comment/i
        ];
        patterns.forEach(pattern => {
            if (pattern.test(message)) {
                features.push(pattern.source.replace(/[\/\(\)\?\!\|]/g, ''));
            }
        });
        return features.length > 0 ? features : ['basic functionality'];
    }
    // Helper methods for extracting specific information
    extractCoordinatorDecisions(response) {
        // Extract task assignments and move to pending
        // This would parse @mentions and task descriptions
    }
    extractDesignDeliverables(response) {
        // Parse design components and wireframes
        if (response.includes('wireframe') || response.includes('design')) {
            this.workspace.design.approved = true;
            this.workspace.design.wireframes = response;
        }
    }
    extractFrontendProgress(response) {
        // Parse implementation progress and API requirements
        if (response.includes('completed') || response.includes('implemented')) {
            this.workspace.frontend.completed = true;
        }
    }
    extractBackendProgress(response) {
        // Parse backend implementation status
        if (response.includes('API') && response.includes('ready')) {
            this.workspace.backend.completed = true;
        }
    }
    getWorkflowStatus() {
        return { ...this.workflow };
    }
    getWorkspaceStatus() {
        return { ...this.workspace };
    }
}
exports.WebTeamOrchestrator = WebTeamOrchestrator;
