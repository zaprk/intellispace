"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentOrchestrator = void 0;
const client_1 = require("@prisma/client");
const WebTeamOrchestrator_1 = require("./WebTeamOrchestrator");
class AgentOrchestrator {
    constructor(llmService, conversationService, memoryService, io) {
        Object.defineProperty(this, "prisma", {
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
        Object.defineProperty(this, "webTeamOrchestrator", {
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
        // Agent management
        Object.defineProperty(this, "agents", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "tools", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        // Enhanced processing control
        Object.defineProperty(this, "activeProcessing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "messageHistory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        }); // conversationId -> messageIds
        Object.defineProperty(this, "conversationCycles", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "recentResponders", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "lastProcessedMessage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        }); // conversationId -> messageId
        // Configuration
        Object.defineProperty(this, "maxCollaborationCycles", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 3
        });
        Object.defineProperty(this, "processingTimeout", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 30000
        }); // 30 seconds
        Object.defineProperty(this, "cooldownPeriod", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 2000
        }); // 2 seconds between agent responses
        this.prisma = new client_1.PrismaClient();
        this.llmService = llmService;
        this.conversationService = conversationService;
        this.memoryService = memoryService;
        this.io = io;
        this.webTeamOrchestrator = new WebTeamOrchestrator_1.WebTeamOrchestrator(this.llmService, this.conversationService, this.memoryService, this.io);
        this.initializeBuiltInTools();
        this.loadAgents();
        // Cleanup old processing locks periodically
        setInterval(this.cleanupProcessingLocks.bind(this), 60000); // Every minute
    }
    // 1. MAIN MESSAGE PROCESSING WITH DEDUPLICATION
    async processMessage(message, conversationId) {
        const messageId = message.id;
        const processingKey = `${conversationId}-${messageId}`;
        try {
            // 1. Check if message already processed
            if (this.isMessageAlreadyProcessed(conversationId, messageId)) {
                console.log(`⏭️ Message ${messageId} already processed, skipping`);
                return;
            }
            // 2. Check if already processing this exact message
            if (this.activeProcessing.has(processingKey)) {
                console.log(`⏳ Message ${messageId} already being processed, skipping`);
                return;
            }
            // 3. Check if conversation is currently processing another message
            const conversationProcessing = Array.from(this.activeProcessing.values())
                .find(lock => lock.conversationId === conversationId);
            if (conversationProcessing && conversationProcessing.messageId !== messageId) {
                console.log(`🔒 Conversation ${conversationId} busy with message ${conversationProcessing.messageId}`);
                return;
            }
            // 4. Set processing lock
            this.activeProcessing.set(processingKey, {
                conversationId,
                messageId,
                timestamp: Date.now()
            });
            console.log(`🔄 Processing message ${messageId} in conversation ${conversationId}`);
            // 5. Mark message as processed
            this.markMessageProcessed(conversationId, messageId);
            // 6. Determine processing mode
            const isUserMessage = this.isUserMessage(message.senderId);
            const isWebsiteTeam = this.isWebsiteTeamConversation(conversationId);
            const recentMessages = await this.conversationService.getRecentMessages(conversationId, 10);
            const isFirstUserMessage = isUserMessage && recentMessages.length <= 1;
            // 7. Route to appropriate workflow
            if (isWebsiteTeam && isFirstUserMessage) {
                await this.processWithStructuredWorkflow(message, conversationId);
            }
            else {
                await this.processWithCollaborativeWorkflow(message, conversationId);
            }
        }
        catch (error) {
            console.error(`❌ Error processing message ${messageId}:`, error);
        }
        finally {
            // Always cleanup processing lock
            this.activeProcessing.delete(processingKey);
            console.log(`✅ Finished processing message ${messageId}`);
        }
    }
    // 2. STRUCTURED WORKFLOW PROCESSING
    async processWithStructuredWorkflow(message, conversationId) {
        console.log(`🏗️ Using structured workflow for message: ${message.id}`);
        try {
            this.webTeamOrchestrator.setAgents(this.agents);
            await this.webTeamOrchestrator.processUserRequest(message, conversationId);
        }
        catch (error) {
            console.error(`❌ Structured workflow error:`, error);
            // Fallback to collaborative workflow
            await this.processWithCollaborativeWorkflow(message, conversationId);
        }
    }
    // 3. COLLABORATIVE WORKFLOW PROCESSING
    async processWithCollaborativeWorkflow(message, conversationId) {
        console.log(`🤝 Using collaborative workflow for message: ${message.id}`);
        // Reset collaboration cycle for new user messages
        if (this.isUserMessage(message.senderId)) {
            this.conversationCycles.set(conversationId, 0);
            this.recentResponders.set(conversationId, new Set());
            console.log(`🔄 Reset collaboration cycle for conversation ${conversationId}`);
        }
        // Check collaboration cycle limit
        const currentCycle = this.conversationCycles.get(conversationId) || 0;
        if (currentCycle >= this.maxCollaborationCycles) {
            console.log(`⏹️ Max collaboration cycles (${this.maxCollaborationCycles}) reached`);
            return;
        }
        // Get conversation context
        const conversationMemory = await this.memoryService.getConversationMemory(conversationId);
        const recentMessages = await this.conversationService.getRecentMessages(conversationId, 15);
        // Extract triggers from message
        const collaborationTriggers = this.extractCollaborationTriggers(message.content);
        const mentions = this.extractMentions(message.content);
        const tasks = this.extractTasks(message.content);
        // Process collaboration triggers (limit to one per cycle)
        if (collaborationTriggers.length > 0) {
            await this.processCollaborationTriggers(collaborationTriggers, conversationId, message, recentMessages, conversationMemory);
        }
        // Process direct mentions
        if (mentions.length > 0) {
            await this.processMentions(mentions, conversationId, message, recentMessages, conversationMemory);
        }
        // Process task-based triggers
        if (tasks.length > 0) {
            await this.processTasks(tasks, conversationId, message, recentMessages, conversationMemory);
        }
        // Initial collaboration for user messages without specific triggers
        if (this.isUserMessage(message.senderId) &&
            collaborationTriggers.length === 0 &&
            mentions.length === 0 &&
            tasks.length === 0) {
            await this.startInitialCollaboration(conversationId, message, recentMessages, conversationMemory);
        }
    }
    // 4. MESSAGE DEDUPLICATION HELPERS
    isMessageAlreadyProcessed(conversationId, messageId) {
        const conversationHistory = this.messageHistory.get(conversationId);
        return conversationHistory?.has(messageId) || false;
    }
    markMessageProcessed(conversationId, messageId) {
        if (!this.messageHistory.has(conversationId)) {
            this.messageHistory.set(conversationId, new Set());
        }
        this.messageHistory.get(conversationId).add(messageId);
        this.lastProcessedMessage.set(conversationId, messageId);
    }
    isUserMessage(senderId) {
        return senderId === 'user' ||
            senderId === 'user-agent' ||
            (typeof senderId === 'string' && !Array.from(this.agents.keys()).includes(senderId));
    }
    // 5. IMPROVED AGENT TRIGGERING WITH COOLDOWN
    async triggerAgentWithContext(agentId, conversationId, originalMessage, recentMessages, conversationMemory) {
        const agent = this.agents.get(agentId);
        if (!agent || agent.isActive !== true) {
            console.log(`⏭️ Agent ${agentId} not available`);
            return;
        }
        // Check if agent recently responded
        const recentRespondersSet = this.recentResponders.get(conversationId) || new Set();
        if (recentRespondersSet.has(agentId)) {
            console.log(`⏭️ Agent ${agent.name} recently responded, skipping`);
            return;
        }
        // Apply cooldown
        await new Promise(resolve => setTimeout(resolve, this.cooldownPeriod));
        try {
            console.log(`🎯 Triggering agent: ${agent.name} for conversation ${conversationId}`);
            // Mark agent as recent responder
            recentRespondersSet.add(agentId);
            this.recentResponders.set(conversationId, recentRespondersSet);
            // Clear recent responders after timeout
            setTimeout(() => {
                const currentResponders = this.recentResponders.get(conversationId);
                if (currentResponders) {
                    currentResponders.delete(agentId);
                }
            }, 5 * 60 * 1000); // 5 minutes
            // Trigger agent processing
            await this.processAgentResponse(agent, conversationId, originalMessage, recentMessages, conversationMemory);
            // Increment collaboration cycle
            const currentCycle = this.conversationCycles.get(conversationId) || 0;
            this.conversationCycles.set(conversationId, currentCycle + 1);
        }
        catch (error) {
            console.error(`❌ Error triggering agent ${agent.name}:`, error);
        }
    }
    // 6. COLLABORATION TRIGGER PROCESSING
    async processCollaborationTriggers(triggers, conversationId, message, recentMessages, conversationMemory) {
        console.log(`🤝 Processing collaboration triggers: ${triggers.join(', ')}`);
        // Only trigger ONE agent per collaboration cycle to prevent spam
        for (const trigger of triggers) {
            const targetAgents = this.findAgentsByCollaborationTrigger(trigger, conversationMemory);
            console.log(`🎯 Found ${targetAgents.length} agents for trigger "${trigger}"`);
            if (targetAgents.length > 0) {
                // Find first available agent
                const recentRespondersSet = this.recentResponders.get(conversationId) || new Set();
                const availableAgent = targetAgents.find(agent => !recentRespondersSet.has(agent.id));
                if (availableAgent) {
                    await this.triggerAgentWithContext(availableAgent.id, conversationId, message, recentMessages, conversationMemory);
                    break; // Only trigger one agent per cycle
                }
            }
        }
    }
    // 7. CLEANUP AND MAINTENANCE
    cleanupProcessingLocks() {
        const now = Date.now();
        const expiredLocks = [];
        for (const [key, lock] of this.activeProcessing.entries()) {
            if (now - lock.timestamp > this.processingTimeout) {
                expiredLocks.push(key);
            }
        }
        expiredLocks.forEach(key => {
            this.activeProcessing.delete(key);
            console.log(`🧹 Cleaned up expired processing lock: ${key}`);
        });
        // Cleanup old message history (keep only last 100 messages per conversation)
        for (const [conversationId, messageIds] of this.messageHistory.entries()) {
            if (messageIds.size > 100) {
                const sortedIds = Array.from(messageIds);
                const toKeep = sortedIds.slice(-100);
                this.messageHistory.set(conversationId, new Set(toKeep));
            }
        }
    }
    // 8. UTILITY METHODS
    isWebsiteTeamConversation(conversationId) {
        const websiteTeamRoles = ['coordinator', 'designer', 'frontend-developer', 'backend-developer'];
        const hasWebsiteTeam = Array.from(this.agents.values()).some(agent => websiteTeamRoles.includes(agent.role.toLowerCase()));
        console.log(`🔍 Website team detection: hasWebsiteTeam=${hasWebsiteTeam}, agents=${Array.from(this.agents.values()).map(a => a.role)}`);
        return hasWebsiteTeam;
    }
    // Additional helper methods...
    extractCollaborationTriggers(content) {
        const triggers = [];
        const patterns = [
            /coordinate with/i,
            /work together/i,
            /collaborate/i,
            /team up/i,
            /let me work with/i,
            /need help from/i
        ];
        patterns.forEach(pattern => {
            if (pattern.test(content)) {
                triggers.push(pattern.toString());
            }
        });
        return triggers;
    }
    extractMentions(content) {
        const mentions = content.match(/@\w+/g) || [];
        return mentions;
    }
    extractTasks(content) {
        const tasks = content.match(/#\w+/g) || [];
        return tasks;
    }
    // Existing methods that need to be preserved...
    async processAgentResponse(agent, conversationId, originalMessage, recentMessages, conversationMemory) {
        // Implementation for processing agent response
        console.log(`🤖 Processing response for agent: ${agent.name}`);
    }
    async processMentions(mentions, conversationId, message, recentMessages, conversationMemory) {
        // Implementation for processing mentions
        console.log(`📢 Processing mentions: ${mentions.join(', ')}`);
    }
    async processTasks(tasks, conversationId, message, recentMessages, conversationMemory) {
        // Implementation for processing tasks
        console.log(`📋 Processing tasks: ${tasks.join(', ')}`);
    }
    async startInitialCollaboration(conversationId, message, recentMessages, conversationMemory) {
        // Implementation for starting initial collaboration
        console.log(`🚀 Starting initial collaboration for conversation: ${conversationId}`);
    }
    findAgentsByCollaborationTrigger(trigger, conversationMemory) {
        // Implementation for finding agents by collaboration trigger
        return Array.from(this.agents.values()).filter(agent => agent.isActive === true);
    }
    // Public methods for agent management
    addAgent(agent) {
        this.agents.set(agent.id, agent);
        console.log(`➕ Added agent: ${agent.name} (${agent.role})`);
    }
    removeAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (agent) {
            this.agents.delete(agentId);
            console.log(`➖ Removed agent: ${agent.name}`);
        }
    }
    getAgent(agentId) {
        return this.agents.get(agentId);
    }
    getAllAgents() {
        return Array.from(this.agents.values());
    }
    // Reset orchestrator state (useful for testing)
    reset() {
        this.activeProcessing.clear();
        this.messageHistory.clear();
        this.conversationCycles.clear();
        this.recentResponders.clear();
        this.lastProcessedMessage.clear();
        console.log(`🔄 AgentOrchestrator state reset`);
    }
    // Existing methods that need to be preserved...
    async loadAgents() {
        try {
            const agents = await this.prisma.agent.findMany();
            this.agents.clear();
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
            uniqueAgents.forEach((agent, id) => {
                this.agents.set(id, agent);
            });
            console.log(`✅ Loaded ${uniqueAgents.size} unique agents into memory:`, Array.from(uniqueAgents.values()).map(a => `${a.name} (${a.role})`));
        }
        catch (error) {
            console.error('Error loading agents:', error);
        }
    }
    async createAgent(agentData) {
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
            const newAgent = {
                id: agent.id,
                name: agent.name,
                avatar: agent.avatar,
                description: agent.description,
                role: agent.role,
                config: agentData.config,
                capabilities: defaultCapabilities,
                isActive: agent.isActive,
            };
            this.agents.set(agent.id, newAgent);
            this.io.emit('agent-created', newAgent);
            console.log(`✅ Created and loaded agent: ${newAgent.name} (${newAgent.role}) with capabilities:`, defaultCapabilities);
            console.log(`📊 Total agents in memory: ${this.agents.size}`);
            return newAgent;
        }
        catch (error) {
            console.error('Error creating agent:', error);
            throw error;
        }
    }
    async updateAgent(agentId, updates) {
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
        }
        catch (error) {
            console.error('Error updating agent:', error);
            throw error;
        }
    }
    async deleteAgent(agentId) {
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
                    const updatedParticipants = participants.filter((id) => id !== agentId);
                    if (updatedParticipants.length !== participants.length) {
                        await this.prisma.conversation.update({
                            where: { id: conversation.id },
                            data: { participants: JSON.stringify(updatedParticipants) }
                        });
                    }
                }
                catch (parseError) {
                    console.warn(`Failed to parse participants for conversation ${conversation.id}:`, parseError);
                }
            }
            // Then delete the agent
            await this.prisma.agent.delete({
                where: { id: agentId },
            });
            this.agents.delete(agentId);
            this.io.emit('agent-deleted', agentId);
            console.log(`✅ Deleted agent: ${agentId}`);
        }
        catch (error) {
            console.error('Error deleting agent:', error);
            throw error;
        }
    }
    getDefaultCapabilitiesForRole(role) {
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
    initializeBuiltInTools() {
        // Initialize built-in tools
        console.log('🔧 Initializing built-in tools');
    }
    setAgents(agents) {
        this.agents = agents;
    }
    // Tool management methods
    getAvailableTools() {
        return Array.from(this.tools.values()).map(tool => ({
            id: tool.id,
            name: tool.name,
            description: tool.description
        }));
    }
    async executeTool(toolId, params, agentId) {
        const tool = this.tools.get(toolId);
        if (!tool) {
            throw new Error(`Tool ${toolId} not found`);
        }
        try {
            const result = await tool.execute(params, agentId);
            return { success: true, result };
        }
        catch (error) {
            console.error(`Error executing tool ${toolId}:`, error);
            throw error;
        }
    }
}
exports.AgentOrchestrator = AgentOrchestrator;
