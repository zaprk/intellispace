import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

export interface CreateMessageDto {
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'system' | 'tool_call' | 'tool_response';
  metadata?: Record<string, any>;
}

export interface CreateConversationDto {
  projectId: string;
  name: string;
  type: 'direct' | 'group';
  participants: string[]; // Agent IDs
}

export interface MessageWithAgent {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  metadata: any;
  timestamp: Date;
  sender: {
    id: string;
    name: string;
    avatar: string | null;
    role: string;
  };
}

export class ConversationService {
  private systemAgentId: string = 'system-agent';
  private userAgentId: string = 'user-agent';

  constructor(
    private prisma: PrismaClient,
    private io: SocketIOServer
  ) {
    // Initialize system and user agents on construction
    this.ensureSystemAgents();
  }

  // Initialize system and user agents
  private async validateAndCreateAgent(agentId: string): Promise<boolean> {
    try {
      // Check if agent exists
      const existingAgent = await this.prisma.agent.findUnique({
        where: { id: agentId }
      });

      if (existingAgent) {
        return true;
      }

      // Only create system/user agents automatically
      if (agentId === this.systemAgentId || agentId === this.userAgentId) {
        const agentData = agentId === this.systemAgentId ? {
          id: this.systemAgentId,
          name: 'System',
          role: 'system',
          avatar: '⚙️',
          description: 'System notifications and messages'
        } : {
          id: this.userAgentId,
          name: 'User',
          role: 'user',
          avatar: '👤',
          description: 'Human user'
        };

        await this.prisma.agent.create({
          data: {
            ...agentData,
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
        return true;
      }

      // For other agents, log error and return false
      console.error(`❌ [ConversationService] Agent ${agentId} does not exist and cannot be auto-created`);
      return false;
    } catch (error) {
      console.error('Error validating agent:', error);
      return false;
    }
  }

  private async ensureSystemAgents() {
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
    } catch (error) {
      console.error('Error ensuring system agents:', error);
    }
  }

  // Ensure default conversation exists
  private async ensureDefaultConversation() {
    try {
      // Check if default conversation exists
      const defaultConversation = await this.prisma.conversation.findFirst({
        where: { name: 'general' }
      });

      if (!defaultConversation) {
        // Get or create default project
        let defaultProject = await this.prisma.project.findUnique({
          where: { id: 'default' }
        });

        if (!defaultProject) {
          defaultProject = await this.prisma.project.create({
            data: {
              id: 'default',
              name: 'Default Project',
              description: 'Default project for general conversations'
            }
          });
        }

        // Create default conversation
        await this.prisma.conversation.create({
          data: {
            id: 'general-conversation',
            projectId: defaultProject.id,
            name: 'general',
            type: 'group',
            participants: JSON.stringify([this.userAgentId, this.systemAgentId]),
          }
        });
        console.log('✅ Created default conversation');
      }
    } catch (error) {
      console.error('Error ensuring default conversation:', error);
    }
  }

  // Conversation Management
  async createConversation(data: CreateConversationDto) {
    try {
      const conversation = await this.prisma.conversation.create({
        data: {
          id: uuidv4(),
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
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  async getConversation(conversationId: string) {
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
    } catch (error) {
      console.error('Error getting conversation:', error);
      throw error;
    }
  }

  async getConversations(projectId?: string) {
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
    } catch (error) {
      console.error('Error getting conversations:', error);
      throw error;
    }
  }

  async updateConversation(conversationId: string, updates: Partial<CreateConversationDto>) {
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
    } catch (error) {
      console.error('Error updating conversation:', error);
      throw error;
    }
  }

  async deleteConversation(conversationId: string) {
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
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  // Message Management (UPDATED)
  async createMessage(data: CreateMessageDto): Promise<MessageWithAgent> {
    try {
      console.log('🔍 [ConversationService] Creating message with data:', {
        conversationId: data.conversationId,
        senderId: data.senderId,
        content: data.content?.substring(0, 50) + '...',
        type: data.type
      });

      // Map special senderIds to agent IDs first
      let actualSenderId = data.senderId;
      if (data.senderId === 'system') {
        actualSenderId = this.systemAgentId;
      } else if (data.senderId === 'user') {
        actualSenderId = this.userAgentId;
      }

      // Validate agent exists before creating message
      const agentExists = await this.validateAndCreateAgent(actualSenderId);
      if (!agentExists) {
        throw new Error(`Agent ${actualSenderId} does not exist`);
      }

      // Ensure system agents and default conversation exist
      await this.ensureSystemAgents();
      await this.ensureDefaultConversation();

      // Map conversation ID from frontend channel names to actual conversation IDs
      let actualConversationId = data.conversationId;
      
      // The frontend now sends 'general-conversation' directly, so we don't need to map 'general'
      // But we still need to ensure the conversation exists
      if (data.conversationId === 'general-conversation') {
        const defaultConversation = await this.prisma.conversation.findFirst({
          where: { name: 'general' }
        });
        if (defaultConversation) {
          actualConversationId = defaultConversation.id;
          console.log('🔍 [ConversationService] Mapped general-conversation to actual ID:', actualConversationId);
        }
      }

      console.log('🔍 [ConversationService] Mapped conversationId:', {
        original: data.conversationId,
        mapped: actualConversationId
      });

      console.log('🔍 [ConversationService] Mapped senderId:', {
        original: data.senderId,
        mapped: actualSenderId,
        systemAgentId: this.systemAgentId,
        userAgentId: this.userAgentId
      });

      // Validate that we have a valid sender ID
      if (!actualSenderId) {
        console.error('❌ [ConversationService] Invalid sender ID:', {
          originalSenderId: data.senderId,
          actualSenderId,
          systemAgentId: this.systemAgentId,
          userAgentId: this.userAgentId
        });
        throw new Error('Invalid sender ID: senderId is undefined');
      }

      // Validate that we have a valid conversation ID
      if (!actualConversationId) {
        console.error('❌ [ConversationService] Invalid conversation ID:', {
          originalConversationId: data.conversationId,
          actualConversationId
        });
        throw new Error('Invalid conversation ID: conversationId is undefined');
      }

      // First, verify the sender exists
      const senderExists = await this.prisma.agent.findUnique({
        where: { id: actualSenderId }
      });

      console.log('🔍 [ConversationService] Sender exists check:', {
        actualSenderId,
        exists: !!senderExists
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
        } else {
          // If it's a system or user agent that doesn't exist, create it
          const agentData = actualSenderId === this.systemAgentId ? {
            id: this.systemAgentId,
            name: 'System',
            role: 'system',
            avatar: '⚙️',
            description: 'System notifications and messages'
          } : {
            id: this.userAgentId,
            name: 'User',
            role: 'user',
            avatar: '👤',
            description: 'Human user'
          };

          console.log('🔍 [ConversationService] Creating system/user agent:', agentData);

          await this.prisma.agent.create({
            data: {
              ...agentData,
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
        }
      }

      // Verify the conversation exists
      const conversationExists = await this.prisma.conversation.findUnique({
        where: { id: actualConversationId }
      });

      console.log('🔍 [ConversationService] Conversation exists check:', {
        actualConversationId,
        exists: !!conversationExists
      });

      if (!conversationExists) {
        console.error('❌ [ConversationService] Conversation not found:', actualConversationId);
        throw new Error(`Conversation ${actualConversationId} not found`);
      }

      const message = await this.prisma.message.create({
        data: {
          id: uuidv4(),
          conversationId: actualConversationId,
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
        where: { id: actualConversationId },
        data: { updatedAt: new Date() },
      });

      const formattedMessage: MessageWithAgent = {
        ...message,
        metadata: message.metadata ? JSON.parse(message.metadata) : null,
        sender: {
          id: message.sender.id,
          name: message.sender.name,
          avatar: message.sender.avatar,
          role: message.sender.role,
        },
      };

      console.log('✅ [ConversationService] Message created successfully:', {
        messageId: formattedMessage.id,
        senderId: formattedMessage.senderId,
        senderName: formattedMessage.sender.name,
        conversationId: formattedMessage.conversationId
      });

      // Broadcast to all clients in the conversation
      this.io.to(`conversation:${actualConversationId}`).emit('new-message', formattedMessage);

      return formattedMessage;
    } catch (error) {
      console.error('❌ [ConversationService] Error creating message:', error);
      throw error;
    }
  }

  async getMessages(conversationId: string, limit: number = 50, offset: number = 0) {
    try {
      console.log('🔍 [ConversationService] Getting messages for conversation:', conversationId);
      
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

      console.log('📨 [ConversationService] Found', messages.length, 'messages for conversation:', conversationId);

      return messages.reverse().map(msg => ({
        ...msg,
        metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
      }));
    } catch (error) {
      console.error('❌ [ConversationService] Error getting messages:', error);
      throw error;
    }
  }

  async getRecentMessages(conversationId: string, count: number = 50) {
    return this.getMessages(conversationId, count, 0);
  }

  async searchMessages(conversationId: string, query: string) {
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
    } catch (error) {
      console.error('Error searching messages:', error);
      throw error;
    }
  }

  async deleteMessage(messageId: string) {
    try {
      const message = await this.prisma.message.delete({
        where: { id: messageId },
      });

      this.io.to(`conversation:${message.conversationId}`).emit('message-deleted', messageId);

      return { success: true };
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  // Participant Management (UPDATED)
  async addParticipant(conversationId: string, agentId: string) {
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
    } catch (error) {
      console.error('Error adding participant:', error);
      throw error;
    }
  }

  async removeParticipant(conversationId: string, agentId: string) {
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
    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    }
  }

  // Conversation Analysis
  async generateConversationSummary(conversationId: string): Promise<string> {
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
    } catch (error) {
      console.error('Error generating summary:', error);
      return 'Unable to generate summary';
    }
  }

  async extractActionItems(conversationId: string): Promise<string[]> {
    try {
      const messages = await this.getMessages(conversationId, 100);
      const actionItems: string[] = [];

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
    } catch (error) {
      console.error('Error extracting action items:', error);
      return [];
    }
  }

  // Real-time Updates
  broadcastTypingIndicator(conversationId: string, agentId: string, isTyping: boolean) {
    this.io.to(`conversation:${conversationId}`).emit('typing-indicator', {
      conversationId,
      agentId,
      isTyping,
    });
  }

  broadcastAgentStatus(agentId: string, status: 'online' | 'busy' | 'offline') {
    this.io.emit('agent-status', {
      agentId,
      status,
    });
  }

  // Export Conversation
  async exportConversation(conversationId: string, format: 'json' | 'markdown' | 'txt' = 'json') {
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
          
          conversation.messages.forEach((msg: any) => {
            markdown += `### ${msg.sender.name} - ${msg.timestamp}\n`;
            markdown += `${msg.content}\n\n`;
          });
          
          return markdown;
        
        case 'txt':
          let text = `${conversation.name}\n`;
          text += `${'='.repeat(conversation.name.length)}\n\n`;
          
          conversation.messages.forEach((msg: any) => {
            text += `[${msg.timestamp}] ${msg.sender.name}: ${msg.content}\n`;
          });
          
          return text;
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Error exporting conversation:', error);
      throw error;
    }
  }
}