// src/backend/server.ts
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import all services - these should be in separate files in src/backend/services/
import { ConversationService } from './services/ConversationService';
import { AgentOrchestrator } from './services/AgentOrchestrator';
import { LLMService } from './services/LLMService';
import { MemoryService } from './services/MemoryService';
import { WorkflowOrchestrator } from './services/WorkflowOrchestrator';
import { Message } from '../shared/types';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST']
  }
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Initialize services
const llmService = new LLMService();
const memoryService = new MemoryService(prisma);
const conversationService = new ConversationService(prisma, io);
const agentOrchestrator = new AgentOrchestrator(
  llmService,
  conversationService,
  memoryService,
  io
);
// Initialize workflow orchestrator
const workflowOrchestrator = new WorkflowOrchestrator(prisma);

// Set up Socket.IO for streaming
workflowOrchestrator.setSocketIO(io);

// Update workflow with actual agent IDs after agents are loaded
const updateWorkflowAgents = () => {
  workflowOrchestrator.updateTeamAgents(agentOrchestrator);
};

// Update workflow agents initially
updateWorkflowAgents();

// Update workflow agents whenever agents are reloaded
const originalLoadAgents = agentOrchestrator.loadAgents.bind(agentOrchestrator);
agentOrchestrator.loadAgents = async () => {
  await originalLoadAgents();
  updateWorkflowAgents();
};

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      websocket: 'active',
      llm: llmService.getStatus()
    }
  });
});

// ===== Agent Routes =====
app.get('/api/agents', async (req, res) => {
  try {
    const agents = agentOrchestrator.getAllAgents();
    res.json(agents);
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agents', async (req, res) => {
  try {
    const agent = await agentOrchestrator.createAgent(req.body);
    res.json(agent);
  } catch (error: any) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/agents/:id', async (req, res) => {
  try {
    const agent = await agentOrchestrator.updateAgent(req.params.id, req.body);
    res.json(agent);
  } catch (error: any) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/agents/:id', async (req, res) => {
  try {
    await agentOrchestrator.deleteAgent(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agents/reload', async (req, res) => {
  try {
    await agentOrchestrator.loadAgents();
    res.json({ success: true, message: 'Agents reloaded successfully' });
  } catch (error: any) {
    console.error('Error reloading agents:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== Conversation Routes =====
app.get('/api/conversations', async (req, res) => {
  try {
    const conversations = await conversationService.getConversations(req.query.projectId as string);
    res.json(conversations);
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/conversations', async (req, res) => {
  try {
    const conversation = await conversationService.createConversation(req.body);
    res.json(conversation);
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/conversations/:id', async (req, res) => {
  try {
    const conversation = await conversationService.getConversation(req.params.id);
    res.json(conversation);
  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const messages = await conversationService.getMessages(req.params.id, limit, offset);
    res.json(messages);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/conversations/:id', async (req, res) => {
  try {
    await conversationService.deleteConversation(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== Message Routes =====
app.post('/api/messages', async (req, res) => {
  try {
    const message = await conversationService.createMessage(req.body);
    
    // Skip workflow processing for REST API calls - let Socket.IO handle it
    // This prevents double processing when frontend uses both REST API and Socket.IO
    console.log('📝 [REST] Message created via REST API, skipping workflow processing');
    console.log('💡 [REST] Use Socket.IO for real-time workflow processing');
    
    res.json(message);
  } catch (error: any) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== Memory Routes =====
app.get('/api/memory/:scope/:scopeId', async (req, res) => {
  try {
    const { scope, scopeId } = req.params;
    const memory = scope === 'project' 
      ? await memoryService.getProjectMemory(scopeId)
      : await memoryService.getConversationMemory(scopeId);
    res.json(memory);
  } catch (error: any) {
    console.error('Error fetching memory:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/memory/:scope/:scopeId', async (req, res) => {
  try {
    const { scope, scopeId } = req.params;
    const memory = scope === 'project'
      ? await memoryService.updateProjectMemory(scopeId, req.body)
      : await memoryService.updateConversationMemory(scopeId, req.body);
    res.json(memory);
  } catch (error: any) {
    console.error('Error updating memory:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/memory/:scope/:scopeId/search', async (req, res) => {
  try {
    const { scope, scopeId } = req.params;
    const { query } = req.body;
    const results = await memoryService.searchMemory(
      scope as 'project' | 'conversation',
      scopeId,
      query
    );
    res.json(results);
  } catch (error: any) {
    console.error('Error searching memory:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== Workflow Routes =====
import workflowRoutes from './routes/workflow';

app.use('/api/workflow', workflowRoutes);

app.post('/api/workflow/process', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log('🔄 Processing message through fixed LangGraph workflow:', message.content);
    
    const workflowResult = await workflowOrchestrator.processMessage(message as Message);
    
    // Save the workflow state
    workflowOrchestrator.saveWorkflowState(workflowResult);
    
    // Return the complete workflow state
    res.json({
      workflowState: workflowResult,
      workflowMessages: workflowResult.messages,
      messageCount: workflowResult.messages.length,
      phase: workflowResult.phase,
      sharedKnowledge: workflowResult.sharedKnowledge,
      success: true
    });
    
  } catch (error: any) {
    console.error('Error processing workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workflow/state/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const state = workflowOrchestrator.getWorkflowState(conversationId);
    
    if (!state) {
      return res.status(404).json({ error: 'Workflow state not found' });
    }
    
    res.json(state);
  } catch (error: any) {
    console.error('Error fetching workflow state:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== LLM/Ollama Routes =====
app.get('/api/ollama/status', async (req, res) => {
  try {
    const isAvailable = await llmService.testConnection('ollama');
    const models = isAvailable ? await llmService.listAvailableModels('ollama') : [];
    
    res.json({
      available: isAvailable,
      models: models.map(name => ({ name, size: 'unknown', modified: new Date() }))
    });
  } catch (error: any) {
    console.error('Error checking Ollama status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ollama/generate', async (req, res) => {
  try {
    const { prompt, model, context, stream } = req.body;
    
    if (stream) {
      // Set up SSE for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      await llmService.streamCompletion(
        prompt,
        {
          provider: 'ollama',
          model: model || 'llama2',
          temperature: context?.temperature || 0.7,
          maxTokens: context?.maxTokens || 2000,
          systemPrompt: context?.systemPrompt
        },
        (chunk) => {
          res.write(`data: ${JSON.stringify({ response: chunk })}\n\n`);
        }
      );
      
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const response = await llmService.generateCompletion(prompt, {
        provider: 'ollama',
        model: model || 'llama2',
        temperature: context?.temperature || 0.7,
        maxTokens: context?.maxTokens || 2000,
        systemPrompt: context?.systemPrompt
      });
      
      res.json({
        response: response.content,
        model: response.model,
        done: true
      });
    }
  } catch (error: any) {
    console.error('Error generating with Ollama:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ollama/models', async (req, res) => {
  try {
    const models = await llmService.listAvailableModels('ollama');
    res.json({ models });
  } catch (error: any) {
    console.error('Error listing Ollama models:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== LLM Provider Status =====
app.get('/api/llm/status', async (req, res) => {
  try {
    const connections = await llmService.testConnections();
    const status = llmService.getStatus();
    
    res.json({
      status,
      connections,
      available: Object.values(connections).some(v => v === true)
    });
  } catch (error: any) {
    console.error('Error checking LLM status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/llm/:provider/models', async (req, res) => {
  try {
    const models = await llmService.listAvailableModels(req.params.provider);
    res.json({ models });
  } catch (error: any) {
    console.error('Error listing models:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== Tools Routes =====
app.get('/api/tools', (req, res) => {
  try {
    const tools = agentOrchestrator.getAvailableTools();
    res.json(tools.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description
    })));
  } catch (error: any) {
    console.error('Error fetching tools:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tools/:toolId/execute', async (req, res) => {
  try {
    const { toolId } = req.params;
    const { params, agentId } = req.body;
    const result = await agentOrchestrator.executeTool(toolId, params, agentId);
    res.json(result);
  } catch (error: any) {
    console.error('Error executing tool:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== Agent Processing Routes =====
app.post('/api/agents/:agentId/trigger', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { conversationId, prompt } = req.body;
    
    // Don't await - let it process in background
    // Create a mock message for the trigger
    const mockMessage = {
      id: `trigger-${Date.now()}`,
      conversationId,
      senderId: 'system',
      content: prompt,
      type: 'text',
      timestamp: new Date().toISOString()
    };
    
    agentOrchestrator.processMessage(mockMessage, conversationId).catch(err => {
      console.error('Error triggering agent:', err);
    });
    
    res.json({ success: true, message: 'Agent triggered' });
  } catch (error: any) {
    console.error('Error triggering agent:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== WebSocket handling =====
io.on('connection', (socket) => {
  console.log('New WebSocket connection:', socket.id);

  socket.on('join', (data) => {
    if (data.conversationId) {
      socket.join(`conversation:${data.conversationId}`);
      console.log(`Socket ${socket.id} joined conversation:${data.conversationId}`);
    }
  });

  socket.on('leave', (data) => {
    if (data.conversationId) {
      socket.leave(`conversation:${data.conversationId}`);
      console.log(`Socket ${socket.id} left conversation:${data.conversationId}`);
    }
  });

  socket.on('typing', (data) => {
    conversationService.broadcastTypingIndicator(
      data.conversationId,
      data.agentId,
      data.isTyping
    );
  });

  socket.on('message', async (data) => {
    try {
      // Create message through conversation service
      const message = await conversationService.createMessage(data);
      
      // Process through LangGraph workflow if it's a user message
      if (data.senderId === 'user' || data.senderId === 'user-agent') {
        console.log('🔄 Processing user message through LangGraph workflow:', data.content);
        console.log('🔍 [DEBUG] Socket message details:', {
          senderId: data.senderId,
          content: data.content,
          conversationId: data.conversationId
        });
        
        try {
          console.log('🚀 [WORKFLOW] Starting fixed workflow processing...');
          const workflowResult = await workflowOrchestrator.processMessage(message as unknown as Message);
          
          console.log('✅ [WORKFLOW] Fixed workflow processing completed successfully');
          console.log('📊 [WORKFLOW] Workflow state:', {
            phase: workflowResult.phase,
            collaborationRound: workflowResult.collaborationRound,
            messagesCount: workflowResult.messages.length,
            error: workflowResult.error
          });
          
          // Save the workflow state
          workflowOrchestrator.saveWorkflowState(workflowResult);
          
          // Broadcast all the messages from the workflow result
          for (const workflowMessage of workflowResult.messages) {
            console.log(`📤 [WORKFLOW] Broadcasting message from ${workflowMessage.senderId}: ${workflowMessage.content.substring(0, 100)}...`);
            io.to(`conversation:${data.conversationId}`).emit('new-message', workflowMessage);
          }
          
          console.log(`✅ [WORKFLOW] All ${workflowResult.messages.length} workflow messages broadcasted`);
        } catch (workflowError) {
          console.error('❌ [WORKFLOW] Workflow processing error:', workflowError);
          console.log('🔄 [FALLBACK] Falling back to AgentOrchestrator...');
          
          // Fallback to old agent orchestrator if workflow fails
          try {
            await agentOrchestrator.processMessage(message, data.conversationId);
          } catch (fallbackError) {
            console.error('❌ [FALLBACK] Error processing message with fallback:', fallbackError);
          }
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// ===== Error handling middleware =====
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'An unexpected error occurred'
  });
});

// ===== Start server =====
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    // Create default project if it doesn't exist
    try {
      const defaultProject = await prisma.project.upsert({
        where: { id: 'default' },
        update: {},
        create: {
          id: 'default',
          name: 'Default Project',
          description: 'Default project for general conversations'
        }
      });
      console.log('✅ Default project ready');
    } catch (error) {
      console.warn('⚠️ Could not create default project:', error.message);
    }

    // Test LLM connections
    console.log('🔍 Testing LLM connections...');
    try {
      const llmConnections = await llmService.testConnections();
      console.log('🤖 LLM Provider Status:');
      Object.entries(llmConnections).forEach(([provider, connected]) => {
        console.log(`[${connected ? '✅' : '❌'}] ${provider}`);
      });
    } catch (error) {
      console.warn('⚠️ Could not test LLM connections:', error.message);
    }
    console.log('✅ LLM connection tests completed');

    // Load agents
    console.log('🔍 Loading agents...');
    try {
      await agentOrchestrator.loadAgents();
      console.log('✅ Agents loaded successfully');
    } catch (error) {
      console.warn('⚠️ Could not load agents:', error.message);
    }

    // Start server
    console.log('🚀 Starting server...');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 WebSocket server ready`);
      console.log(`🎯 Frontend should connect to http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Critical error starting server:', error);
    console.log('💡 Try running: npx prisma migrate dev');
    process.exit(1);
  }
}

// Start the server
startServer();

// ===== Graceful shutdown =====
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing connections...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});