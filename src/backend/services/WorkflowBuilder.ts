import { 
  WorkflowConfig, 
  WorkflowTemplate, 
  WorkflowBuilder as WorkflowBuilderType,
  WorkflowValidation,
  ValidationResult,
  AgentNode,
  RoutingRule,
  WorkflowPhase,
  WorkflowCategory
} from '../../shared/types';
import { WorkflowValidator } from './WorkflowValidator';
import { v4 as uuidv4 } from 'uuid';

export class WorkflowBuilder {
  private validator: WorkflowValidator;
  private templates: WorkflowTemplate[] = [];
  private categories: WorkflowCategory[] = [];

  constructor() {
    this.validator = new WorkflowValidator();
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates() {
    // Development Templates
    this.templates.push({
      id: 'web-dev-template',
      name: 'Web Development Workflow',
      description: 'Complete web application development workflow',
      category: 'development',
      tags: ['web', 'fullstack', 'react', 'node'],
      version: '1.0.0',
      author: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: this.createWebDevConfig(),
      validation: this.validator['defaultValidation'],
      metadata: {
        estimatedDuration: '10-15 minutes',
        complexity: 'moderate',
        maxIterations: 15,
        requiredPermissions: ['development'],
        allowedDomains: ['web-development', 'software-development']
      }
    });

    // Design Templates
    this.templates.push({
      id: 'ui-design-template',
      name: 'UI/UX Design Workflow',
      description: 'User interface and experience design workflow',
      category: 'design',
      tags: ['design', 'ui', 'ux', 'wireframes'],
      version: '1.0.0',
      author: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: this.createUIDesignConfig(),
      validation: this.validator['defaultValidation'],
      metadata: {
        estimatedDuration: '5-10 minutes',
        complexity: 'simple',
        maxIterations: 10,
        requiredPermissions: ['design'],
        allowedDomains: ['design', 'ui-ux']
      }
    });

    // Analysis Templates
    this.templates.push({
      id: 'data-analysis-template',
      name: 'Data Analysis Workflow',
      description: 'Data analysis and reporting workflow',
      category: 'analysis',
      tags: ['analysis', 'data', 'reporting', 'insights'],
      version: '1.0.0',
      author: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: this.createDataAnalysisConfig(),
      validation: this.validator['defaultValidation'],
      metadata: {
        estimatedDuration: '8-12 minutes',
        complexity: 'moderate',
        maxIterations: 12,
        requiredPermissions: ['analysis'],
        allowedDomains: ['data-analysis', 'business-intelligence']
      }
    });

    // Content Templates
    this.templates.push({
      id: 'content-creation-template',
      name: 'Content Creation Workflow',
      description: 'Content writing and editing workflow',
      category: 'content',
      tags: ['content', 'writing', 'editing', 'marketing'],
      version: '1.0.0',
      author: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: this.createContentCreationConfig(),
      validation: this.validator['defaultValidation'],
      metadata: {
        estimatedDuration: '5-8 minutes',
        complexity: 'simple',
        maxIterations: 8,
        requiredPermissions: ['content'],
        allowedDomains: ['content-creation', 'marketing']
      }
    });

    // Initialize categories
    this.categories = [
      {
        id: 'development',
        name: 'Development',
        description: 'Software development workflows',
        icon: '💻',
        color: '#3B82F6',
        templates: ['web-dev-template']
      },
      {
        id: 'design',
        name: 'Design',
        description: 'UI/UX and graphic design workflows',
        icon: '🎨',
        color: '#EC4899',
        templates: ['ui-design-template']
      },
      {
        id: 'analysis',
        name: 'Analysis',
        description: 'Data analysis and research workflows',
        icon: '📊',
        color: '#10B981',
        templates: ['data-analysis-template']
      },
      {
        id: 'content',
        name: 'Content',
        description: 'Content creation and editing workflows',
        icon: '✍️',
        color: '#F59E0B',
        templates: ['content-creation-template']
      }
    ];
  }

  private createWebDevConfig(): WorkflowConfig {
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

  private createUIDesignConfig(): WorkflowConfig {
    return {
      nodes: [
        { id: "coordinator", name: "Design Coordinator", role: "coordinator", capabilities: ["planning", "coordination"], priority: 1 },
        { id: "designer", name: "UI/UX Designer", role: "designer", capabilities: ["wireframes", "design"], priority: 2 },
        { id: "reviewer", name: "Design Reviewer", role: "reviewer", capabilities: ["review", "quality"], priority: 3 }
      ],
      routingRules: [
        {
          condition: (state) => state.phase === "requirements" && state.currentInput.length > 0,
          targetNode: "coordinator",
          priority: 1
        },
        {
          condition: (state) => state.phase === "design" && !state.completedTasks.includes("design_complete"),
          targetNode: "designer",
          priority: 2
        },
        {
          condition: (state) => state.phase === "review" && !state.completedTasks.includes("review_complete"),
          targetNode: "reviewer",
          priority: 3
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
          nextPhase: "review"
        },
        {
          name: "review",
          requiredAgents: ["reviewer"],
          completionCriteria: (state) => state.agentOutputs.reviewer?.reviewComplete === true,
          nextPhase: "complete"
        }
      ]
    };
  }

  private createDataAnalysisConfig(): WorkflowConfig {
    return {
      nodes: [
        { id: "coordinator", name: "Analysis Coordinator", role: "coordinator", capabilities: ["planning", "coordination"], priority: 1 },
        { id: "analyst", name: "Data Analyst", role: "analyst", capabilities: ["analysis", "research"], priority: 2 },
        { id: "reviewer", name: "Analysis Reviewer", role: "reviewer", capabilities: ["review", "quality"], priority: 3 }
      ],
      routingRules: [
        {
          condition: (state) => state.phase === "requirements" && state.currentInput.length > 0,
          targetNode: "coordinator",
          priority: 1
        },
        {
          condition: (state) => state.phase === "analysis" && !state.completedTasks.includes("analysis_complete"),
          targetNode: "analyst",
          priority: 2
        },
        {
          condition: (state) => state.phase === "review" && !state.completedTasks.includes("review_complete"),
          targetNode: "reviewer",
          priority: 3
        }
      ],
      phases: [
        {
          name: "requirements",
          requiredAgents: ["coordinator"],
          completionCriteria: (state) => state.agentOutputs.coordinator?.requirementsComplete === true,
          nextPhase: "analysis"
        },
        {
          name: "analysis",
          requiredAgents: ["analyst"],
          completionCriteria: (state) => state.agentOutputs.analyst?.analysisComplete === true,
          nextPhase: "review"
        },
        {
          name: "review",
          requiredAgents: ["reviewer"],
          completionCriteria: (state) => state.agentOutputs.reviewer?.reviewComplete === true,
          nextPhase: "complete"
        }
      ]
    };
  }

  private createContentCreationConfig(): WorkflowConfig {
    return {
      nodes: [
        { id: "coordinator", name: "Content Coordinator", role: "coordinator", capabilities: ["planning", "coordination"], priority: 1 },
        { id: "writer", name: "Content Writer", role: "writer", capabilities: ["content", "writing"], priority: 2 },
        { id: "reviewer", name: "Content Reviewer", role: "reviewer", capabilities: ["review", "quality"], priority: 3 }
      ],
      routingRules: [
        {
          condition: (state) => state.phase === "requirements" && state.currentInput.length > 0,
          targetNode: "coordinator",
          priority: 1
        },
        {
          condition: (state) => state.phase === "writing" && !state.completedTasks.includes("writing_complete"),
          targetNode: "writer",
          priority: 2
        },
        {
          condition: (state) => state.phase === "review" && !state.completedTasks.includes("review_complete"),
          targetNode: "reviewer",
          priority: 3
        }
      ],
      phases: [
        {
          name: "requirements",
          requiredAgents: ["coordinator"],
          completionCriteria: (state) => state.agentOutputs.coordinator?.requirementsComplete === true,
          nextPhase: "writing"
        },
        {
          name: "writing",
          requiredAgents: ["writer"],
          completionCriteria: (state) => state.agentOutputs.writer?.writingComplete === true,
          nextPhase: "review"
        },
        {
          name: "review",
          requiredAgents: ["reviewer"],
          completionCriteria: (state) => state.agentOutputs.reviewer?.reviewComplete === true,
          nextPhase: "complete"
        }
      ]
    };
  }

  // Public API
  public createWorkflowBuilder(name: string, description: string, author: string): WorkflowBuilderType {
    const builder: WorkflowBuilderType = {
      id: uuidv4(),
      name,
      description,
      config: {
        nodes: [],
        routingRules: [],
        phases: []
      },
      validation: this.validator['defaultValidation'],
      status: 'draft',
      validationResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author
    };

    return builder;
  }

  public addAgent(builder: WorkflowBuilderType, agent: AgentNode): WorkflowBuilderType {
    // Validate agent
    if (!agent.id || !agent.name || !agent.role) {
      throw new Error('Agent must have id, name, and role');
    }

    // Check for duplicate IDs
    if (builder.config.nodes.some(node => node.id === agent.id)) {
      throw new Error(`Agent with ID '${agent.id}' already exists`);
    }

    // Validate role
    const allowedRoles = this.validator['defaultValidation'].allowedAgentTypes;
    if (!allowedRoles.includes(agent.role)) {
      throw new Error(`Role '${agent.role}' is not allowed. Allowed roles: ${allowedRoles.join(', ')}`);
    }

    const updatedBuilder = {
      ...builder,
      config: {
        ...builder.config,
        nodes: [...builder.config.nodes, agent]
      },
      updatedAt: new Date().toISOString()
    };

    // Re-validate
    updatedBuilder.validationResults = this.validator.validateWorkflow(updatedBuilder.config);
    updatedBuilder.status = this.validator.isWorkflowSafe(updatedBuilder.config) ? 'valid' : 'invalid';

    return updatedBuilder;
  }

  public addPhase(builder: WorkflowBuilderType, phase: WorkflowPhase): WorkflowBuilderType {
    // Validate phase
    if (!phase.name || !phase.requiredAgents) {
      throw new Error('Phase must have name and requiredAgents');
    }

    // Check for duplicate names
    if (builder.config.phases.some(p => p.name === phase.name)) {
      throw new Error(`Phase with name '${phase.name}' already exists`);
    }

    // Validate required agents exist
    const agentIds = builder.config.nodes.map(n => n.id);
    const invalidAgents = phase.requiredAgents.filter(agentId => !agentIds.includes(agentId));
    if (invalidAgents.length > 0) {
      throw new Error(`Required agents not found: ${invalidAgents.join(', ')}`);
    }

    const updatedBuilder = {
      ...builder,
      config: {
        ...builder.config,
        phases: [...builder.config.phases, phase]
      },
      updatedAt: new Date().toISOString()
    };

    // Re-validate
    updatedBuilder.validationResults = this.validator.validateWorkflow(updatedBuilder.config);
    updatedBuilder.status = this.validator.isWorkflowSafe(updatedBuilder.config) ? 'valid' : 'invalid';

    return updatedBuilder;
  }

  public addRoutingRule(builder: WorkflowBuilderType, rule: RoutingRule): WorkflowBuilderType {
    // Validate rule
    if (!rule.targetNode || !rule.condition) {
      throw new Error('Routing rule must have targetNode and condition');
    }

    // Check if target node exists
    const agentIds = builder.config.nodes.map(n => n.id);
    if (!agentIds.includes(rule.targetNode)) {
      throw new Error(`Target node '${rule.targetNode}' does not exist`);
    }

    const updatedBuilder = {
      ...builder,
      config: {
        ...builder.config,
        routingRules: [...builder.config.routingRules, rule]
      },
      updatedAt: new Date().toISOString()
    };

    // Re-validate
    updatedBuilder.validationResults = this.validator.validateWorkflow(updatedBuilder.config);
    updatedBuilder.status = this.validator.isWorkflowSafe(updatedBuilder.config) ? 'valid' : 'invalid';

    return updatedBuilder;
  }

  public validateBuilder(builder: WorkflowBuilderType): ValidationResult[] {
    const results = this.validator.validateWorkflow(builder.config);
    
    // Add complexity analysis
    const complexity = this.validator.getWorkflowComplexity(builder.config);
    const suggestions = this.validator.getWorkflowSuggestions(builder.config);

    results.push({
      ruleId: 'complexity-analysis',
      ruleName: 'Workflow Complexity',
      severity: complexity === 'complex' ? 'warning' : 'info',
      passed: true,
      message: `Workflow complexity: ${complexity}`,
      suggestions,
      timestamp: new Date().toISOString()
    });

    return results;
  }

  public autoFixBuilder(builder: WorkflowBuilderType): WorkflowBuilderType {
    const fixedConfig = this.validator.autoFixWorkflow(builder.config);
    
    return {
      ...builder,
      config: fixedConfig,
      validationResults: this.validator.validateWorkflow(fixedConfig),
      status: this.validator.isWorkflowSafe(fixedConfig) ? 'valid' : 'invalid',
      updatedAt: new Date().toISOString()
    };
  }

  public publishWorkflow(builder: WorkflowBuilderType): WorkflowTemplate {
    if (builder.status !== 'valid') {
      throw new Error('Cannot publish invalid workflow. Please fix validation errors first.');
    }

    const template: WorkflowTemplate = {
      id: uuidv4(),
      name: builder.name,
      description: builder.description,
      category: 'custom',
      tags: [],
      version: '1.0.0',
      author: builder.author,
      createdAt: builder.createdAt,
      updatedAt: new Date().toISOString(),
      config: builder.config,
      validation: builder.validation,
      metadata: {
        estimatedDuration: this.estimateDuration(builder.config),
        complexity: this.validator.getWorkflowComplexity(builder.config),
        maxIterations: builder.validation.maxIterations,
        requiredPermissions: [],
        allowedDomains: ['custom']
      }
    };

    this.templates.push(template);
    return template;
  }

  public getTemplates(category?: string): WorkflowTemplate[] {
    if (category) {
      return this.templates.filter(template => template.category === category);
    }
    return this.templates;
  }

  public getCategories(): WorkflowCategory[] {
    return this.categories;
  }

  public getTemplateById(id: string): WorkflowTemplate | undefined {
    return this.templates.find(template => template.id === id);
  }

  public cloneTemplate(templateId: string, name: string, author: string): WorkflowBuilderType {
    const template = this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template with ID '${templateId}' not found`);
    }

    return {
      id: uuidv4(),
      name,
      description: `Clone of ${template.name}`,
      config: { ...template.config },
      validation: { ...template.validation },
      status: 'draft',
      validationResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author
    };
  }

  private estimateDuration(config: WorkflowConfig): string {
    const estimatedSeconds = this.validator['estimateExecutionTime'](config);
    const minutes = Math.ceil(estimatedSeconds / 60);
    
    if (minutes <= 5) return '2-5 minutes';
    if (minutes <= 10) return '5-10 minutes';
    if (minutes <= 15) return '10-15 minutes';
    return '15+ minutes';
  }
}
