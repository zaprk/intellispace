// src/backend/routes/conversations.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ConversationService } from '../services/ConversationService';

export default function conversationRoutes(prisma: PrismaClient, conversationService: ConversationService) {
  const router = Router();

  // Get all conversations
  router.get('/', async (req, res) => {
    try {
      const { projectId } = req.query;
      const conversations = await conversationService.getConversations(projectId as string);
      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // Get single conversation
  router.get('/:id', async (req, res) => {
    try {
      const conversation = await conversationService.getConversation(req.params.id);
      res.json(conversation);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });

  // Create conversation
  router.post('/', async (req, res) => {
    try {
      const conversation = await conversationService.createConversation(req.body);
      res.status(201).json(conversation);
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  });

  // Update conversation
  router.patch('/:id', async (req, res) => {
    try {
      const conversation = await conversationService.updateConversation(req.params.id, req.body);
      res.json(conversation);
    } catch (error) {
      console.error('Error updating conversation:', error);
      res.status(500).json({ error: 'Failed to update conversation' });
    }
  });

  // Delete conversation
  router.delete('/:id', async (req, res) => {
    try {
      await conversationService.deleteConversation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({ error: 'Failed to delete conversation' });
    }
  });

  // Get messages
  router.get('/:id/messages', async (req, res) => {
    try {
      const { limit = '50', offset = '0' } = req.query;
      const messages = await conversationService.getMessages(
        req.params.id,
        parseInt(limit as string),
        parseInt(offset as string)
      );
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // Create message
  router.post('/:id/messages', async (req, res) => {
    try {
      const message = await conversationService.createMessage({
        conversationId: req.params.id,
        ...req.body,
      });
      res.status(201).json(message);
    } catch (error) {
      console.error('Error creating message:', error);
      res.status(500).json({ error: 'Failed to create message' });
    }
  });

  // Search messages
  router.get('/:id/search', async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ error: 'Query parameter required' });
      }
      const messages = await conversationService.searchMessages(req.params.id, q as string);
      res.json(messages);
    } catch (error) {
      console.error('Error searching messages:', error);
      res.status(500).json({ error: 'Failed to search messages' });
    }
  });

  // Add participant
  router.post('/:id/participants', async (req, res) => {
    try {
      const { agentId } = req.body;
      await conversationService.addParticipant(req.params.id, agentId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error adding participant:', error);
      res.status(500).json({ error: 'Failed to add participant' });
    }
  });

  // Remove participant
  router.delete('/:id/participants/:agentId', async (req, res) => {
    try {
      await conversationService.removeParticipant(req.params.id, req.params.agentId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing participant:', error);
      res.status(500).json({ error: 'Failed to remove participant' });
    }
  });

  // Export conversation
  router.get('/:id/export', async (req, res) => {
    try {
      const { format = 'json' } = req.query;
      const exported = await conversationService.exportConversation(
        req.params.id,
        format as 'json' | 'markdown' | 'txt'
      );
      
      const contentType = format === 'json' ? 'application/json' :
                         format === 'markdown' ? 'text/markdown' : 'text/plain';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="conversation-${req.params.id}.${format}"`);
      res.send(exported);
    } catch (error) {
      console.error('Error exporting conversation:', error);
      res.status(500).json({ error: 'Failed to export conversation' });
    }
  });

  return router;
}

