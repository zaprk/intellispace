import express from 'express';
import { WorkflowBuilder } from '../services/WorkflowBuilder';
import { WorkflowValidator } from '../services/WorkflowValidator';
import { WorkflowConfig, WorkflowTemplate } from '../../shared/types';

const router = express.Router();
const workflowBuilder = new WorkflowBuilder();
const workflowValidator = new WorkflowValidator();

// Get all templates and categories
router.get('/templates', (req, res) => {
  try {
    const templates = workflowBuilder.getTemplates();
    const categories = workflowBuilder.getCategories();
    
    res.json({
      templates,
      categories,
      stats: {
        totalTemplates: templates.length,
        totalCategories: categories.length
      }
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get templates by category
router.get('/templates/category/:category', (req, res) => {
  try {
    const { category } = req.params;
    const templates = workflowBuilder.getTemplates(category);
    
    res.json({ templates });
  } catch (error) {
    console.error('Error fetching templates by category:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get template by ID
router.get('/templates/:id', (req, res) => {
  try {
    const { id } = req.params;
    const template = workflowBuilder.getTemplateById(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ template });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Clone template
router.post('/templates/:id/clone', (req, res) => {
  try {
    const { id } = req.params;
    const { name, author } = req.body;
    
    if (!name || !author) {
      return res.status(400).json({ error: 'Name and author are required' });
    }
    
    const clonedBuilder = workflowBuilder.cloneTemplate(id, name, author);
    res.json({ builder: clonedBuilder });
  } catch (error) {
    console.error('Error cloning template:', error);
    res.status(500).json({ error: 'Failed to clone template' });
  }
});

// Validate workflow configuration
router.post('/validate', (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({ error: 'Workflow configuration is required' });
    }
    
    const validationResults = workflowValidator.validateWorkflow(config);
    const isSafe = workflowValidator.isWorkflowSafe(config);
    const complexity = workflowValidator.getWorkflowComplexity(config);
    const suggestions = workflowValidator.getWorkflowSuggestions(config);
    
    res.json({
      results: validationResults,
      isSafe,
      complexity,
      suggestions
    });
  } catch (error) {
    console.error('Error validating workflow:', error);
    res.status(500).json({ error: 'Failed to validate workflow' });
  }
});

// Auto-fix workflow configuration
router.post('/autofix', (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({ error: 'Workflow configuration is required' });
    }
    
    const fixedConfig = workflowValidator.autoFixWorkflow(config);
    const validationResults = workflowValidator.validateWorkflow(fixedConfig);
    
    res.json({
      fixedConfig,
      validationResults,
      isSafe: workflowValidator.isWorkflowSafe(fixedConfig)
    });
  } catch (error) {
    console.error('Error auto-fixing workflow:', error);
    res.status(500).json({ error: 'Failed to auto-fix workflow' });
  }
});

// Create new workflow builder
router.post('/builder', (req, res) => {
  try {
    const { name, description, author } = req.body;
    
    if (!name || !author) {
      return res.status(400).json({ error: 'Name and author are required' });
    }
    
    const builder = workflowBuilder.createWorkflowBuilder(name, description || '', author);
    res.json({ builder });
  } catch (error) {
    console.error('Error creating workflow builder:', error);
    res.status(500).json({ error: 'Failed to create workflow builder' });
  }
});

// Add agent to workflow
router.post('/builder/:id/agents', (req, res) => {
  try {
    const { id } = req.params;
    const agent = req.body;
    
    // This would typically fetch the builder from storage
    // For now, we'll create a mock response
    res.json({ 
      message: 'Agent added successfully',
      agent 
    });
  } catch (error) {
    console.error('Error adding agent:', error);
    res.status(500).json({ error: 'Failed to add agent' });
  }
});

// Add phase to workflow
router.post('/builder/:id/phases', (req, res) => {
  try {
    const { id } = req.params;
    const phase = req.body;
    
    res.json({ 
      message: 'Phase added successfully',
      phase 
    });
  } catch (error) {
    console.error('Error adding phase:', error);
    res.status(500).json({ error: 'Failed to add phase' });
  }
});

// Add routing rule to workflow
router.post('/builder/:id/rules', (req, res) => {
  try {
    const { id } = req.params;
    const rule = req.body;
    
    res.json({ 
      message: 'Routing rule added successfully',
      rule 
    });
  } catch (error) {
    console.error('Error adding routing rule:', error);
    res.status(500).json({ error: 'Failed to add routing rule' });
  }
});

// Publish workflow
router.post('/publish', (req, res) => {
  try {
    const builder = req.body;
    
    if (!builder || !builder.config) {
      return res.status(400).json({ error: 'Valid workflow builder is required' });
    }
    
    // Validate the workflow before publishing
    const validationResults = workflowValidator.validateWorkflow(builder.config);
    const isSafe = workflowValidator.isWorkflowSafe(builder.config);
    
    if (!isSafe) {
      return res.status(400).json({ 
        error: 'Cannot publish invalid workflow',
        validationResults 
      });
    }
    
    const template = workflowBuilder.publishWorkflow(builder);
    res.json({ 
      message: 'Workflow published successfully',
      template 
    });
  } catch (error) {
    console.error('Error publishing workflow:', error);
    res.status(500).json({ error: 'Failed to publish workflow' });
  }
});

// Get workflow statistics
router.get('/stats', (req, res) => {
  try {
    const templates = workflowBuilder.getTemplates();
    const categories = workflowBuilder.getCategories();
    
    const stats = {
      totalTemplates: templates.length,
      totalCategories: categories.length,
      templatesByCategory: categories.map(cat => ({
        category: cat.name,
        count: templates.filter(t => t.category === cat.id).length
      })),
      complexityDistribution: {
        simple: templates.filter(t => t.metadata.complexity === 'simple').length,
        moderate: templates.filter(t => t.metadata.complexity === 'moderate').length,
        complex: templates.filter(t => t.metadata.complexity === 'complex').length
      }
    };
    
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching workflow stats:', error);
    res.status(500).json({ error: 'Failed to fetch workflow statistics' });
  }
});

// Search templates
router.get('/search', (req, res) => {
  try {
    const { q, category, complexity } = req.query;
    let templates = workflowBuilder.getTemplates();
    
    // Filter by search query
    if (q) {
      const query = q.toString().toLowerCase();
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Filter by category
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    
    // Filter by complexity
    if (complexity) {
      templates = templates.filter(t => t.metadata.complexity === complexity);
    }
    
    res.json({ templates });
  } catch (error) {
    console.error('Error searching templates:', error);
    res.status(500).json({ error: 'Failed to search templates' });
  }
});

export default router;
