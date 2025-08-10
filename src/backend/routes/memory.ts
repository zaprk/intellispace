// src/backend/routes/memory.ts
import { Router } from 'express';
import { MemoryService } from '../services/MemoryService';

export default function memoryRoutes(memoryService: MemoryService) {
  const router = Router();

  // Get memory
  router.get('/:scope/:scopeId', async (req, res) => {
    try {
      const { scope, scopeId } = req.params;
      
      if (scope !== 'project' && scope !== 'conversation') {
        return res.status(400).json({ error: 'Invalid scope' });
      }
      
      const memory = scope === 'project'
        ? await memoryService.getProjectMemory(scopeId)
        : await memoryService.getConversationMemory(scopeId);
      
      res.json(memory);
    } catch (error) {
      console.error('Error fetching memory:', error);
      res.status(500).json({ error: 'Failed to fetch memory' });
    }
  });

  // Update memory
  router.put('/:scope/:scopeId', async (req, res) => {
    try {
      const { scope, scopeId } = req.params;
      
      if (scope !== 'project' && scope !== 'conversation') {
        return res.status(400).json({ error: 'Invalid scope' });
      }
      
      const memory = scope === 'project'
        ? await memoryService.updateProjectMemory(scopeId, req.body)
        : await memoryService.updateConversationMemory(scopeId, req.body);
      
      res.json(memory);
    } catch (error) {
      console.error('Error updating memory:', error);
      res.status(500).json({ error: 'Failed to update memory' });
    }
  });

  // Merge memory
  router.patch('/:scope/:scopeId', async (req, res) => {
    try {
      const { scope, scopeId } = req.params;
      
      if (scope !== 'project' && scope !== 'conversation') {
        return res.status(400).json({ error: 'Invalid scope' });
      }
      
      const memory = scope === 'project'
        ? await memoryService.mergeProjectMemory(scopeId, req.body)
        : await memoryService.mergeConversationMemory(scopeId, req.body);
      
      res.json(memory);
    } catch (error) {
      console.error('Error merging memory:', error);
      res.status(500).json({ error: 'Failed to merge memory' });
    }
  });

  // Apply memory update
  router.post('/:scope/:scopeId/update', async (req, res) => {
    try {
      const { scope, scopeId } = req.params;
      
      if (scope !== 'project' && scope !== 'conversation') {
        return res.status(400).json({ error: 'Invalid scope' });
      }
      
      const memory = await memoryService.applyMemoryUpdate(
        scope as 'project' | 'conversation',
        scopeId,
        req.body
      );
      
      res.json(memory);
    } catch (error) {
      console.error('Error applying memory update:', error);
      res.status(500).json({ error: 'Failed to apply memory update' });
    }
  });

  // Search memory
  router.get('/:scope/:scopeId/search', async (req, res) => {
    try {
      const { scope, scopeId } = req.params;
      const { q } = req.query;
      
      if (!q) {
        return res.status(400).json({ error: 'Query parameter required' });
      }
      
      if (scope !== 'project' && scope !== 'conversation') {
        return res.status(400).json({ error: 'Invalid scope' });
      }
      
      const results = await memoryService.searchMemory(
        scope as 'project' | 'conversation',
        scopeId,
        q as string
      );
      
      res.json(results);
    } catch (error) {
      console.error('Error searching memory:', error);
      res.status(500).json({ error: 'Failed to search memory' });
    }
  });

  // Get memory stats
  router.get('/:scope/:scopeId/stats', async (req, res) => {
    try {
      const { scope, scopeId } = req.params;
      
      if (scope !== 'project' && scope !== 'conversation') {
        return res.status(400).json({ error: 'Invalid scope' });
      }
      
      const stats = await memoryService.getMemoryStats(
        scope as 'project' | 'conversation',
        scopeId
      );
      
      res.json(stats);
    } catch (error) {
      console.error('Error fetching memory stats:', error);
      res.status(500).json({ error: 'Failed to fetch memory stats' });
    }
  });

  // Clear memory
  router.delete('/:scope/:scopeId', async (req, res) => {
    try {
      const { scope, scopeId } = req.params;
      
      if (scope !== 'project' && scope !== 'conversation') {
        return res.status(400).json({ error: 'Invalid scope' });
      }
      
      await memoryService.clearMemory(
        scope as 'project' | 'conversation',
        scopeId
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error clearing memory:', error);
      res.status(500).json({ error: 'Failed to clear memory' });
    }
  });

  // Export memory
  router.get('/:scope/:scopeId/export', async (req, res) => {
    try {
      const { scope, scopeId } = req.params;
      
      if (scope !== 'project' && scope !== 'conversation') {
        return res.status(400).json({ error: 'Invalid scope' });
      }
      
      const exported = await memoryService.exportMemory(
        scope as 'project' | 'conversation',
        scopeId
      );
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="memory-${scopeId}.json"`);
      res.send(exported);
    } catch (error) {
      console.error('Error exporting memory:', error);
      res.status(500).json({ error: 'Failed to export memory' });
    }
  });

  // Import memory
  router.post('/:scope/:scopeId/import', async (req, res) => {
    try {
      const { scope, scopeId } = req.params;
      
      if (scope !== 'project' && scope !== 'conversation') {
        return res.status(400).json({ error: 'Invalid scope' });
      }
      
      const memory = await memoryService.importMemory(
        scope as 'project' | 'conversation',
        scopeId,
        JSON.stringify(req.body)
      );
      
      res.json(memory);
    } catch (error) {
      console.error('Error importing memory:', error);
      res.status(500).json({ error: 'Failed to import memory' });
    }
  });

  return router;
}

