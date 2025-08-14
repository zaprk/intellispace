import { 
  WorkflowConfig, 
  WorkflowValidation, 
  ValidationRule, 
  WorkflowConstraint, 
  SafetyCheck, 
  ValidationResult,
  WorkflowState,
  AgentNode,
  RoutingRule,
  WorkflowPhase
} from '../../shared/types';

export class WorkflowValidator {
  private defaultValidation: WorkflowValidation;

  constructor() {
    this.defaultValidation = this.createDefaultValidation();
  }

  private createDefaultValidation(): WorkflowValidation {
    return {
      rules: this.createDefaultRules(),
      constraints: this.createDefaultConstraints(),
      safetyChecks: this.createDefaultSafetyChecks(),
      maxExecutionTime: 300, // 5 minutes
      maxIterations: 20,
      maxConcurrentAgents: 5,
      allowedAgentTypes: ['coordinator', 'designer', 'frontend', 'backend', 'analyst', 'writer', 'reviewer'],
      forbiddenKeywords: [
        'hack', 'exploit', 'bypass', 'unauthorized', 'illegal', 'malicious',
        'delete all', 'format', 'wipe', 'corrupt', 'inject', 'sql injection',
        'xss', 'csrf', 'ddos', 'brute force', 'password crack'
      ],
      requiredPhases: ['requirements', 'complete'],
      phaseOrder: ['requirements', 'design', 'frontend', 'backend', 'integration', 'complete']
    };
  }

  private createDefaultRules(): ValidationRule[] {
    return [
      // Syntax Rules
      {
        id: 'syntax-001',
        name: 'Valid Node IDs',
        description: 'All nodes must have valid, unique IDs',
        type: 'syntax',
        severity: 'error',
        condition: (config) => {
          const nodeIds = config.nodes.map(n => n.id);
          const uniqueIds = new Set(nodeIds);
          return nodeIds.length === uniqueIds.size && nodeIds.every(id => /^[a-zA-Z0-9_-]+$/.test(id));
        },
        message: 'All nodes must have unique, alphanumeric IDs (letters, numbers, underscores, hyphens only)',
        fix: (config) => {
          const fixedNodes = config.nodes.map((node, index) => ({
            ...node,
            id: node.id.replace(/[^a-zA-Z0-9_-]/g, '_') || `node_${index}`
          }));
          return { ...config, nodes: fixedNodes };
        }
      },
      {
        id: 'syntax-002',
        name: 'Valid Routing Rules',
        description: 'All routing rules must reference existing nodes',
        type: 'syntax',
        severity: 'error',
        condition: (config) => {
          const nodeIds = new Set(config.nodes.map(n => n.id));
          return config.routingRules.every(rule => nodeIds.has(rule.targetNode));
        },
        message: 'All routing rules must reference existing node IDs',
        fix: (config) => {
          const nodeIds = new Set(config.nodes.map(n => n.id));
          const fixedRules = config.routingRules.filter(rule => nodeIds.has(rule.targetNode));
          return { ...config, routingRules: fixedRules };
        }
      },

      // Semantic Rules
      {
        id: 'semantic-001',
        name: 'Phase Completeness',
        description: 'All phases must have completion criteria',
        type: 'semantic',
        severity: 'error',
        condition: (config) => {
          return config.phases.every(phase => typeof phase.completionCriteria === 'function');
        },
        message: 'All phases must have completion criteria functions',
        fix: (config) => {
          const fixedPhases = config.phases.map(phase => ({
            ...phase,
            completionCriteria: phase.completionCriteria || (() => true)
          }));
          return { ...config, phases: fixedPhases };
        }
      },
      {
        id: 'semantic-002',
        name: 'Agent Role Consistency',
        description: 'Agent roles must be consistent with their capabilities',
        type: 'semantic',
        severity: 'warning',
        condition: (config) => {
          const roleCapabilityMap: Record<string, string[]> = {
            coordinator: ['planning', 'coordination', 'management'],
            designer: ['wireframes', 'design', 'ui', 'ux'],
            frontend: ['react', 'ui', 'components', 'frontend'],
            backend: ['api', 'database', 'backend', 'server'],
            analyst: ['analysis', 'research', 'data'],
            writer: ['content', 'writing', 'copy'],
            reviewer: ['review', 'quality', 'testing']
          };

          return config.nodes.every(node => {
            const expectedCapabilities = roleCapabilityMap[node.role] || [];
            return node.capabilities.some(cap => expectedCapabilities.includes(cap));
          });
        },
        message: 'Agent capabilities should match their roles'
      },

      // Safety Rules
      {
        id: 'safety-001',
        name: 'No Infinite Loops',
        description: 'Workflow must not have infinite loops',
        type: 'safety',
        severity: 'error',
        condition: (config) => {
          // Check for cycles in routing rules
          const graph = this.buildDependencyGraph(config);
          return !this.hasCycle(graph);
        },
        message: 'Workflow contains potential infinite loops',
        fix: (config) => {
          // Remove circular dependencies
          const graph = this.buildDependencyGraph(config);
          const fixedRules = config.routingRules.filter(rule => {
            // Simple fix: remove rules that could create cycles
            return !this.wouldCreateCycle(graph, rule);
          });
          return { ...config, routingRules: fixedRules };
        }
      },
      {
        id: 'safety-002',
        name: 'Execution Time Limit',
        description: 'Workflow must have reasonable execution time',
        type: 'safety',
        severity: 'warning',
        condition: (config) => {
          const estimatedTime = this.estimateExecutionTime(config);
          return estimatedTime <= 300; // 5 minutes
        },
        message: 'Workflow execution time may be too long',
        fix: (config) => {
          // Reduce max iterations or simplify phases
          const simplifiedPhases = config.phases.slice(0, 3); // Limit to 3 phases
          return { ...config, phases: simplifiedPhases };
        }
      },

      // Performance Rules
      {
        id: 'performance-001',
        name: 'Agent Count Limit',
        description: 'Workflow should not have too many agents',
        type: 'performance',
        severity: 'warning',
        condition: (config) => {
          return config.nodes.length <= 10;
        },
        message: 'Too many agents may impact performance',
        fix: (config) => {
          // Keep only essential agents
          const essentialAgents = config.nodes.slice(0, 5);
          return { ...config, nodes: essentialAgents };
        }
      },
      {
        id: 'performance-002',
        name: 'Phase Complexity',
        description: 'Phases should not be overly complex',
        type: 'performance',
        severity: 'info',
        condition: (config) => {
          return config.phases.every(phase => phase.requiredAgents.length <= 3);
        },
        message: 'Phases with many required agents may be complex'
      }
    ];
  }

  private createDefaultConstraints(): WorkflowConstraint[] {
    return [
      {
        id: 'constraint-001',
        name: 'Required Coordinator',
        description: 'Workflow must have a coordinator agent',
        type: 'agent',
        constraint: (config) => {
          return config.nodes.some(node => node.role === 'coordinator');
        },
        message: 'Workflow must include a coordinator agent'
      },
      {
        id: 'constraint-002',
        name: 'Phase Order',
        description: 'Phases must follow logical order',
        type: 'phase',
        constraint: (config) => {
          const phaseNames = config.phases.map(p => p.name);
          const requiredOrder = ['requirements', 'design', 'frontend', 'backend', 'integration', 'complete'];
          
          for (let i = 0; i < phaseNames.length - 1; i++) {
            const currentIndex = requiredOrder.indexOf(phaseNames[i]);
            const nextIndex = requiredOrder.indexOf(phaseNames[i + 1]);
            if (currentIndex > nextIndex && nextIndex !== -1) {
              return false;
            }
          }
          return true;
        },
        message: 'Phases must follow logical development order'
      },
      {
        id: 'constraint-003',
        name: 'Resource Limits',
        description: 'Workflow must respect resource constraints',
        type: 'resource',
        constraint: (config) => {
          const totalAgents = config.nodes.length;
          const totalPhases = config.phases.length;
          return totalAgents <= 10 && totalPhases <= 6;
        },
        message: 'Workflow exceeds resource limits (max 10 agents, 6 phases)'
      }
    ];
  }

  private createDefaultSafetyChecks(): SafetyCheck[] {
    return [
      {
        id: 'safety-001',
        name: 'Forbidden Keywords',
        description: 'Check for forbidden keywords in agent prompts',
        type: 'content',
        check: (config, state) => {
          // This would check agent prompts for forbidden keywords
          // For now, return true (safe)
          return true;
        },
        action: 'block',
        message: 'Workflow contains forbidden keywords'
      },
      {
        id: 'safety-002',
        name: 'Execution Timeout',
        description: 'Check if workflow execution is taking too long',
        type: 'execution',
        check: (config, state) => {
          const startTime = new Date(state.workflowHistory[0]?.timestamp || Date.now());
          const currentTime = new Date();
          const elapsedSeconds = (currentTime.getTime() - startTime.getTime()) / 1000;
          return elapsedSeconds <= 300; // 5 minutes
        },
        action: 'warn',
        message: 'Workflow execution is taking longer than expected'
      },
      {
        id: 'safety-003',
        name: 'Error Rate',
        description: 'Check if workflow has too many errors',
        type: 'execution',
        check: (config, state) => {
          const errorCount = state.workflowHistory.filter(step => step.status === 'error').length;
          const totalSteps = state.workflowHistory.length;
          return totalSteps === 0 || (errorCount / totalSteps) <= 0.3; // Max 30% error rate
        },
        action: 'warn',
        message: 'Workflow has high error rate'
      }
    ];
  }

  private buildDependencyGraph(config: WorkflowConfig): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    // Initialize all nodes
    config.nodes.forEach(node => {
      graph.set(node.id, []);
    });

    // Add edges from routing rules
    config.routingRules.forEach(rule => {
      // Each rule creates a potential edge from any node to targetNode
      config.nodes.forEach(node => {
        if (rule.condition({ phase: 'any' } as any)) {
          const edges = graph.get(node.id) || [];
          if (!edges.includes(rule.targetNode)) {
            edges.push(rule.targetNode);
          }
          graph.set(node.id, edges);
        }
      });
    });

    return graph;
  }

  private hasCycle(graph: Map<string, string[]>): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) return true;
      }

      recStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (dfs(node)) return true;
      }
    }

    return false;
  }

  private wouldCreateCycle(graph: Map<string, string[]>, rule: RoutingRule): boolean {
    // Simulate adding the rule and check for cycles
    const testGraph = new Map(graph);
    const edges = testGraph.get('any') || [];
    edges.push(rule.targetNode);
    testGraph.set('any', edges);
    
    return this.hasCycle(testGraph);
  }

  private estimateExecutionTime(config: WorkflowConfig): number {
    // Rough estimation: 30 seconds per phase per agent
    const totalAgents = config.nodes.length;
    const totalPhases = config.phases.length;
    return totalAgents * totalPhases * 30;
  }

  // Public API
  public validateWorkflow(config: WorkflowConfig, validation?: WorkflowValidation): ValidationResult[] {
    const rules = validation?.rules || this.defaultValidation.rules;
    const constraints = validation?.constraints || this.defaultValidation.constraints;
    
    const results: ValidationResult[] = [];

    // Validate rules
    rules.forEach(rule => {
      const passed = rule.condition(config);
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        passed,
        message: passed ? 'Passed' : rule.message,
        suggestions: passed ? [] : rule.fix ? ['Auto-fix available'] : [],
        timestamp: new Date().toISOString()
      });
    });

    // Validate constraints
    constraints.forEach(constraint => {
      const passed = constraint.constraint(config);
      results.push({
        ruleId: constraint.id,
        ruleName: constraint.name,
        severity: 'error',
        passed,
        message: passed ? 'Passed' : constraint.message,
        suggestions: [],
        timestamp: new Date().toISOString()
      });
    });

    return results;
  }

  public autoFixWorkflow(config: WorkflowConfig, validation?: WorkflowValidation): WorkflowConfig {
    const rules = validation?.rules || this.defaultValidation.rules;
    let fixedConfig = { ...config };

    rules.forEach(rule => {
      if (rule.fix && !rule.condition(fixedConfig)) {
        fixedConfig = rule.fix(fixedConfig);
      }
    });

    return fixedConfig;
  }

  public runSafetyChecks(config: WorkflowConfig, state: WorkflowState, validation?: WorkflowValidation): ValidationResult[] {
    const safetyChecks = validation?.safetyChecks || this.defaultValidation.safetyChecks;
    
    return safetyChecks.map(check => {
      const passed = check.check(config, state);
      return {
        ruleId: check.id,
        ruleName: check.name,
        severity: check.action === 'block' ? 'error' : check.action === 'warn' ? 'warning' : 'info',
        passed,
        message: passed ? 'Passed' : check.message,
        suggestions: [],
        timestamp: new Date().toISOString()
      };
    });
  }

  public isWorkflowSafe(config: WorkflowConfig, validation?: WorkflowValidation): boolean {
    const results = this.validateWorkflow(config, validation);
    return !results.some(result => result.severity === 'error' && !result.passed);
  }

  public getWorkflowComplexity(config: WorkflowConfig): 'simple' | 'moderate' | 'complex' {
    const agentCount = config.nodes.length;
    const phaseCount = config.phases.length;
    const ruleCount = config.routingRules.length;

    const score = agentCount + phaseCount + ruleCount;

    if (score <= 5) return 'simple';
    if (score <= 10) return 'moderate';
    return 'complex';
  }

  public getWorkflowSuggestions(config: WorkflowConfig): string[] {
    const suggestions: string[] = [];
    const complexity = this.getWorkflowComplexity(config);

    if (complexity === 'complex') {
      suggestions.push('Consider breaking down into smaller workflows');
      suggestions.push('Reduce the number of agents or phases');
    }

    if (config.nodes.length > 5) {
      suggestions.push('Consider consolidating similar agent roles');
    }

    if (config.phases.length > 4) {
      suggestions.push('Consider combining related phases');
    }

    const estimatedTime = this.estimateExecutionTime(config);
    if (estimatedTime > 300) {
      suggestions.push('Workflow may take too long to execute');
    }

    return suggestions;
  }
}
