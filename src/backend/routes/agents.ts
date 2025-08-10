// src/backend/routes/agents.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AgentOrchestrator } from '../services/AgentOrchestrator';

export default function agentRoutes(prisma: PrismaClient, orchestrator: AgentOrchestrator) {
  const router = Router();

  // Get all agents
  router.get('/', async (req, res) => {
    try {
      const agents = await prisma.agent.findMany({
        orderBy: { createdAt: 'desc' },
      });
      
      const formattedAgents = agents.map(agent => ({
        ...agent,
        config: JSON.parse(agent.config),
        capabilities: JSON.parse(agent.capabilities),
      }));
      
      res.json(formattedAgents);
    } catch (error) {
      console.error('Error fetching agents:', error);
      res.status(500).json({ error: 'Failed to fetch agents' });
    }
  });

  // Get single agent
  router.get('/:id', async (req, res) => {
    try {
      const agent = await prisma.agent.findUnique({
        where: { id: req.params.id },
      });
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      res.json({
        ...agent,
        config: JSON.parse(agent.config),
        capabilities: JSON.parse(agent.capabilities),
      });
    } catch (error) {
      console.error('Error fetching agent:', error);
      res.status(500).json({ error: 'Failed to fetch agent' });
    }
  });

  // Create agent
  router.post('/', async (req, res) => {
    try {
      const agent = await orchestrator.createAgent(req.body);
      res.status(201).json(agent);
    } catch (error) {
      console.error('Error creating agent:', error);
      res.status(500).json({ error: 'Failed to create agent' });
    }
  });

  // Update agent
  router.patch('/:id', async (req, res) => {
    try {
      const agent = await orchestrator.updateAgent(req.params.id, req.body);
      res.json(agent);
    } catch (error) {
      console.error('Error updating agent:', error);
      res.status(500).json({ error: 'Failed to update agent' });
    }
  });

  // Delete agent
  router.delete('/:id', async (req, res) => {
    try {
      await orchestrator.deleteAgent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting agent:', error);
      res.status(500).json({ error: 'Failed to delete agent' });
    }
  });

  // Trigger agent
  router.post('/:id/trigger', async (req, res) => {
    try {
      const { conversationId, prompt } = req.body;
      // Create a mock message for the trigger
      const mockMessage = {
        id: `trigger-${Date.now()}`,
        conversationId,
        senderId: 'system',
        content: prompt,
        type: 'text',
        timestamp: new Date().toISOString()
      };
      
      await orchestrator.processMessage(mockMessage, conversationId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error triggering agent:', error);
      res.status(500).json({ error: 'Failed to trigger agent' });
    }
  });

  return router;
}