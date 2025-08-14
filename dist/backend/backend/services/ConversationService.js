"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationService = void 0;
const uuid_1 = require("uuid");
class ConversationService {
    constructor(prisma, io) {
        Object.defineProperty(this, "prisma", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: prisma
        });
        Object.defineProperty(this, "io", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: io
        });
        Object.defineProperty(this, "systemAgentId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'system-agent'
        });
        Object.defineProperty(this, "userAgentId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'user-agent'
        });
        // Initialize system and user agents on construction
        this.ensureSystemAgents();
    }
    // Initialize system and user agents
    async ensureSystemAgents() {
        try {
            // Check if system agent exists
            const systemAgent = await this.prisma.agent.findUnique({
                where: { id: this.systemAgentId }
            });
            if (!systemAgent) {
                await this.prisma.agent.create({
                    data: {
                        id: this.systemAgentId,
                        name: 'System',
                        role: 'system',
                        avatar: '⚙️',
                        description: 'System notifications and messages',
                        config: JSON.stringify({
                            llmProvider: 'none',
                            model: 'none',
                            temperature: 0,
                            maxTokens: 0,
                            systemPrompt: ''
                        }),
                        capabilities: JSON.stringify([]),
                        isActive: true
                    }
                });
                console.log('✅ Created system agent');
            }
            // Check if user agent exists
            const userAgent = await this.prisma.agent.findUnique({
                where: { id: this.userAgentId }
            });
            if (!userAgent) {
                await this.prisma.agent.create({
                    data: {
                        id: this.userAgentId,
                        name: 'User',
                        role: 'user',
                        avatar: '👤',
                        description: 'Human user',
                        config: JSON.stringify({
                            llmProvider: 'none',
                            model: 'none',
                            temperature: 0,
                            maxTokens: 0,
                            systemPrompt: ''
                        }),
                        capabilities: JSON.stringify([]),
                        isActive: true
                    }
                });
                console.log('✅ Created user agent');
            }
        }
        catch (error) {
            console.error('Error ensuring system agents:', error);
        }
    }
    // Conversation Management
    async createConversation(data) {
        try {
            const conversation = await this.prisma.conversation.create({
                data: {
                    id: (0, uuid_1.v4)(),
                    projectId: data.projectId,
                    name: data.name,
                    type: data.type,
                    participants: JSON.stringify(data.participants),
                },
            });
            // Notify all clients about new conversation
            this.io.emit('conversation-created', {
                ...conversation,
                participants: JSON.parse(conversation.participants),
            });
            return {
                ...conversation,
                participants: JSON.parse(conversation.participants),
            };
        }
        catch (error) {
            console.error('Error creating conversation:', error);
            throw error;
        }
    }
    async getConversation(conversationId) {
        try {
            const conversation = await this.prisma.conversation.findUnique({
                where: { id: conversationId },
                include: {
                    messages: {
                        include: {
                            sender: true,
                        },
                        orderBy: {
                            timestamp: 'asc',
                        },
                    },
                },
            });
            if (!conversation) {
                throw new Error(`Conversation ${conversationId} not found`);
            }
            return {
                ...conversation,
                participants: JSON.parse(conversation.participants),
                messages: conversation.messages.map(msg => ({
                    ...msg,
                    metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
                })),
            };
        }
        catch (error) {
            console.error('Error getting conversation:', error);
            throw error;
        }
    }
    async getConversations(projectId) {
        try {
            const conversations = await this.prisma.conversation.findMany({
                where: projectId ? { projectId } : undefined,
                include: {
                    messages: {
                        take: 1,
                        orderBy: {
                            timestamp: 'desc',
                        },
                        include: {
                            sender: true,
                        },
                    },
                },
                orderBy: {
                    updatedAt: 'desc',
                },
            });
            return conversations.map(conv => ({
                ...conv,
                participants: JSON.parse(conv.participants),
                lastMessage: conv.messages[0] ? {
                    ...conv.messages[0],
                    metadata: conv.messages[0].metadata ? JSON.parse(conv.messages[0].metadata) : null,
                } : null,
            }));
        }
        catch (error) {
            console.error('Error getting conversations:', error);
            throw error;
        }
    }
    async updateConversation(conversationId, updates) {
        try {
            const conversation = await this.prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    ...(updates.name && { name: updates.name }),
                    ...(updates.type && { type: updates.type }),
                    ...(updates.participants && { participants: JSON.stringify(updates.participants) }),
                    updatedAt: new Date(),
                },
            });
            this.io.emit('conversation-updated', {
                ...conversation,
                participants: JSON.parse(conversation.participants),
            });
            return {
                ...conversation,
                participants: JSON.parse(conversation.participants),
            };
        }
        catch (error) {
            console.error('Error updating conversation:', error);
            throw error;
        }
    }
    async deleteConversation(conversationId) {
        try {
            // Delete all messages first
            await this.prisma.message.deleteMany({
                where: { conversationId },
            });
            // Delete conversation memory
            await this.prisma.memory.deleteMany({
                where: {
                    scope: 'conversation',
                    scopeId: conversationId,
                },
            });
            // Delete the conversation
            await this.prisma.conversation.delete({
                where: { id: conversationId },
            });
            this.io.emit('conversation-deleted', conversationId);
            return { success: true };
        }
        catch (error) {
            console.error('Error deleting conversation:', error);
            throw error;
        }
    }
    // Message Management (UPDATED)
    async createMessage(data) {
        try {
            // Map special senderIds to agent IDs
            let actualSenderId = data.senderId;
            if (data.senderId === 'system') {
                actualSenderId = this.systemAgentId;
            }
            else if (data.senderId === 'user') {
                actualSenderId = this.userAgentId;
            }
            // First, verify the sender exists
            const senderExists = await this.prisma.agent.findUnique({
                where: { id: actualSenderId }
            });
            if (!senderExists) {
                // If sender doesn't exist and it's not a system/user, create a temporary agent
                if (actualSenderId !== this.systemAgentId && actualSenderId !== this.userAgentId) {
                    console.warn(`Agent ${actualSenderId} not found, creating temporary agent`);
                    await this.prisma.agent.create({
                        data: {
                            id: actualSenderId,
                            name: `Agent ${actualSenderId}`,
                            role: 'assistant',
                            avatar: '🤖',
                            description: 'Temporary agent',
                            config: JSON.stringify({
                                llmProvider: 'ollama',
                                model: 'llama3',
                                temperature: 0.7,
                                maxTokens: 4000,
                                systemPrompt: 'You are a helpful assistant.'
                            }),
                            capabilities: JSON.stringify([]),
                            isActive: true
                        }
                    });
                }
            }
            const message = await this.prisma.message.create({
                data: {
                    id: (0, uuid_1.v4)(),
                    conversationId: data.conversationId,
                    senderId: actualSenderId,
                    content: data.content,
                    type: data.type,
                    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
                },
                include: {
                    sender: true,
                },
            });
            // Update conversation's updatedAt
            await this.prisma.conversation.update({
                where: { id: data.conversationId },
                data: { updatedAt: new Date() },
            });
            const formattedMessage = {
                ...message,
                metadata: message.metadata ? JSON.parse(message.metadata) : null,
                sender: {
                    id: message.sender.id,
                    name: message.sender.name,
                    avatar: message.sender.avatar,
                    role: message.sender.role,
                },
            };
            // Broadcast to all clients in the conversation
            this.io.to(`conversation:${data.conversationId}`).emit('new-message', formattedMessage);
            return formattedMessage;
        }
        catch (error) {
            console.error('Error creating message:', error);
            throw error;
        }
    }
    async getMessages(conversationId, limit = 50, offset = 0) {
        try {
            const messages = await this.prisma.message.findMany({
                where: { conversationId },
                include: {
                    sender: true,
                },
                orderBy: {
                    timestamp: 'desc',
                },
                take: limit,
                skip: offset,
            });
            return messages.reverse().map(msg => ({
                ...msg,
                metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
            }));
        }
        catch (error) {
            console.error('Error getting messages:', error);
            throw error;
        }
    }
    async getRecentMessages(conversationId, count = 50) {
        return this.getMessages(conversationId, count, 0);
    }
    async searchMessages(conversationId, query) {
        try {
            const messages = await this.prisma.message.findMany({
                where: {
                    conversationId,
                    content: {
                        contains: query,
                    },
                },
                include: {
                    sender: true,
                },
                orderBy: {
                    timestamp: 'desc',
                },
            });
            return messages.map(msg => ({
                ...msg,
                metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
            }));
        }
        catch (error) {
            console.error('Error searching messages:', error);
            throw error;
        }
    }
    async deleteMessage(messageId) {
        try {
            const message = await this.prisma.message.delete({
                where: { id: messageId },
            });
            this.io.to(`conversation:${message.conversationId}`).emit('message-deleted', messageId);
            return { success: true };
        }
        catch (error) {
            console.error('Error deleting message:', error);
            throw error;
        }
    }
    // Participant Management (UPDATED)
    async addParticipant(conversationId, agentId) {
        try {
            const conversation = await this.prisma.conversation.findUnique({
                where: { id: conversationId },
            });
            if (!conversation) {
                throw new Error(`Conversation ${conversationId} not found`);
            }
            const participants = JSON.parse(conversation.participants);
            if (!participants.includes(agentId)) {
                participants.push(agentId);
                await this.prisma.conversation.update({
                    where: { id: conversationId },
                    data: {
                        participants: JSON.stringify(participants),
                        updatedAt: new Date(),
                    },
                });
                // Create system message with proper system agent ID
                await this.createMessage({
                    conversationId,
                    senderId: 'system', // This will be mapped to systemAgentId
                    content: `Agent ${agentId} joined the conversation`,
                    type: 'system',
                });
                this.io.to(`conversation:${conversationId}`).emit('participant-added', {
                    conversationId,
                    agentId,
                });
            }
            return { success: true };
        }
        catch (error) {
            console.error('Error adding participant:', error);
            throw error;
        }
    }
    async removeParticipant(conversationId, agentId) {
        try {
            const conversation = await this.prisma.conversation.findUnique({
                where: { id: conversationId },
            });
            if (!conversation) {
                throw new Error(`Conversation ${conversationId} not found`);
            }
            const participants = JSON.parse(conversation.participants);
            const index = participants.indexOf(agentId);
            if (index > -1) {
                participants.splice(index, 1);
                await this.prisma.conversation.update({
                    where: { id: conversationId },
                    data: {
                        participants: JSON.stringify(participants),
                        updatedAt: new Date(),
                    },
                });
                // Create system message with proper system agent ID
                await this.createMessage({
                    conversationId,
                    senderId: 'system', // This will be mapped to systemAgentId
                    content: `Agent ${agentId} left the conversation`,
                    type: 'system',
                });
                this.io.to(`conversation:${conversationId}`).emit('participant-removed', {
                    conversationId,
                    agentId,
                });
            }
            return { success: true };
        }
        catch (error) {
            console.error('Error removing participant:', error);
            throw error;
        }
    }
    // Conversation Analysis
    async generateConversationSummary(conversationId) {
        try {
            const messages = await this.getMessages(conversationId, 100);
            // Simple summary for MVP - in production, this would use LLM
            const messageCount = messages.length;
            const participants = new Set(messages.map(m => m.senderId));
            const firstMessage = messages[0];
            const lastMessage = messages[messages.length - 1];
            const summary = `Conversation with ${participants.size} participants and ${messageCount} messages. ` +
                `Started at ${firstMessage?.timestamp || 'unknown'} and last activity at ${lastMessage?.timestamp || 'unknown'}.`;
            return summary;
        }
        catch (error) {
            console.error('Error generating summary:', error);
            return 'Unable to generate summary';
        }
    }
    async extractActionItems(conversationId) {
        try {
            const messages = await this.getMessages(conversationId, 100);
            const actionItems = [];
            // Simple extraction for MVP - look for patterns like "TODO:", "Action:", etc.
            messages.forEach(msg => {
                const patterns = [
                    /TODO:\s*(.+)/gi,
                    /Action:\s*(.+)/gi,
                    /Task:\s*(.+)/gi,
                    /\[ \]\s*(.+)/g,
                ];
                patterns.forEach(pattern => {
                    const matches = msg.content.matchAll(pattern);
                    for (const match of matches) {
                        actionItems.push(match[1].trim());
                    }
                });
            });
            return actionItems;
        }
        catch (error) {
            console.error('Error extracting action items:', error);
            return [];
        }
    }
    // Real-time Updates
    broadcastTypingIndicator(conversationId, agentId, isTyping) {
        this.io.to(`conversation:${conversationId}`).emit('typing-indicator', {
            conversationId,
            agentId,
            isTyping,
        });
    }
    broadcastAgentStatus(agentId, status) {
        this.io.emit('agent-status', {
            agentId,
            status,
        });
    }
    // Export Conversation
    async exportConversation(conversationId, format = 'json') {
        try {
            const conversation = await this.getConversation(conversationId);
            switch (format) {
                case 'json':
                    return JSON.stringify(conversation, null, 2);
                case 'markdown':
                    let markdown = `# ${conversation.name}\n\n`;
                    markdown += `**Type:** ${conversation.type}\n`;
                    markdown += `**Created:** ${conversation.createdAt}\n`;
                    markdown += `**Participants:** ${conversation.participants.join(', ')}\n\n`;
                    markdown += `## Messages\n\n`;
                    conversation.messages.forEach((msg) => {
                        markdown += `### ${msg.sender.name} - ${msg.timestamp}\n`;
                        markdown += `${msg.content}\n\n`;
                    });
                    return markdown;
                case 'txt':
                    let text = `${conversation.name}\n`;
                    text += `${'='.repeat(conversation.name.length)}\n\n`;
                    conversation.messages.forEach((msg) => {
                        text += `[${msg.timestamp}] ${msg.sender.name}: ${msg.content}\n`;
                    });
                    return text;
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
        }
        catch (error) {
            console.error('Error exporting conversation:', error);
            throw error;
        }
    }
}
exports.ConversationService = ConversationService;
