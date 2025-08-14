export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  status: 'online' | 'busy' | 'offline';
  avatar?: string;
  isActive?: boolean;
  capabilities?: string[];
  config: {
    llmProvider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
  };
}

export interface Conversation {
  id: string;
  name: string;
  type: string;
  projectId: string;
  participants: string[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  timestamp: string;
  metadata?: any;
  sender?: {
    id: string;
    name: string;
    avatar: string;
    role: string;
  };
  agent?: {
    id: string;
    name: string;
    avatar: string;
    role: string;
  };
}

// New workflow-related types
export interface WorkflowMode {
  type: 'solo' | 'mini-workflow' | 'full-workflow';
  agents: string[];
  maxRounds: number;
  reason: string;
}

export interface ProcessingStrategy {
  type: 'direct-mention' | 'mini-collaboration' | 'team-workflow' | 'collaborative-flow' | 'continue-flow' | 'no-processing';
  targetAgents: string[];
  maxResponses: number;
  timeout: number;
  reason: string;
}

export interface ConversationStatus {
  conversationId: string;
  hasActiveMode: boolean;
  currentMode?: string;
  isLocked: boolean;
  lastActivity?: number;
  canReset: boolean;
}

export interface OllamaStatus {
  available: boolean;
  models: string[];
}

export interface Memory {
  [key: string]: any;
}

// LangGraph Workflow Types
export interface WorkflowState {
  conversationId: string;
  phase: string; // Made flexible to support any phase name
  activeAgents: string[];
  completedTasks: string[];
  pendingTasks: string[];
  agentOutputs: Record<string, any>;
  messages: Message[];
  currentInput: string;
  workflowHistory: WorkflowStep[];
  taggedAgents?: string[]; // Agents tagged by coordinator
  error?: string;
  retryCount: number;
}

export interface WorkflowStep {
  id: string;
  timestamp: string;
  node: string;
  input: any;
  output: any;
  status: 'success' | 'error' | 'pending';
}

export interface AgentNode {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  priority: number;
}

export interface WorkflowConfig {
  nodes: AgentNode[];
  routingRules: RoutingRule[];
  phases: WorkflowPhase[];
}

export interface RoutingRule {
  condition: (state: WorkflowState) => boolean;
  targetNode: string;
  priority: number;
}

export interface WorkflowPhase {
  name: string;
  requiredAgents: string[];
  completionCriteria: (state: WorkflowState) => boolean;
  nextPhase?: string;
}

// Workflow Builder & Validation Types
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'development' | 'design' | 'analysis' | 'content' | 'custom';
  tags: string[];
  version: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  config: WorkflowConfig;
  validation: WorkflowValidation;
  metadata: {
    estimatedDuration: string;
    complexity: 'simple' | 'moderate' | 'complex';
    maxIterations: number;
    requiredPermissions: string[];
    allowedDomains: string[];
  };
}

export interface WorkflowValidation {
  rules: ValidationRule[];
  constraints: WorkflowConstraint[];
  safetyChecks: SafetyCheck[];
  maxExecutionTime: number; // in seconds
  maxIterations: number;
  maxConcurrentAgents: number;
  allowedAgentTypes: string[];
  forbiddenKeywords: string[];
  requiredPhases: string[];
  phaseOrder: string[];
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  type: 'syntax' | 'semantic' | 'safety' | 'performance' | 'business';
  severity: 'error' | 'warning' | 'info';
  condition: (config: WorkflowConfig) => boolean;
  message: string;
  fix?: (config: WorkflowConfig) => WorkflowConfig;
}

export interface WorkflowConstraint {
  id: string;
  name: string;
  description: string;
  type: 'agent' | 'phase' | 'routing' | 'execution' | 'resource';
  constraint: (config: WorkflowConfig) => boolean;
  message: string;
}

export interface SafetyCheck {
  id: string;
  name: string;
  description: string;
  type: 'content' | 'execution' | 'resource' | 'security';
  check: (config: WorkflowConfig, state: WorkflowState) => boolean;
  action: 'block' | 'warn' | 'log';
  message: string;
}

export interface WorkflowBuilder {
  id: string;
  name: string;
  description: string;
  config: WorkflowConfig;
  validation: WorkflowValidation;
  status: 'draft' | 'validating' | 'valid' | 'invalid' | 'published';
  validationResults: ValidationResult[];
  createdAt: string;
  updatedAt: string;
  author: string;
}

export interface ValidationResult {
  ruleId: string;
  ruleName: string;
  severity: 'error' | 'warning' | 'info';
  passed: boolean;
  message: string;
  suggestions: string[];
  timestamp: string;
}

export interface WorkflowLibrary {
  templates: WorkflowTemplate[];
  categories: WorkflowCategory[];
  tags: string[];
  stats: {
    totalTemplates: number;
    totalExecutions: number;
    averageExecutionTime: number;
    successRate: number;
  };
}

export interface WorkflowCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  templates: string[]; // template IDs
}

// Workflow Execution Monitoring
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  conversationId: string;
  status: 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  startTime: string;
  endTime?: string;
  duration?: number;
  iterations: number;
  currentPhase: string;
  currentAgent?: string;
  error?: string;
  metrics: ExecutionMetrics;
  logs: ExecutionLog[];
}

export interface ExecutionMetrics {
  totalIterations: number;
  averageIterationTime: number;
  agentExecutionTimes: Record<string, number>;
  phaseExecutionTimes: Record<string, number>;
  errorCount: number;
  successRate: number;
  resourceUsage: {
    memory: number;
    cpu: number;
    network: number;
  };
}

export interface ExecutionLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  agent?: string;
  phase?: string;
  message: string;
  data?: any;
}






