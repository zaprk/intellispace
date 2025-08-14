import React, { useState, useEffect } from 'react';
import { 
  WorkflowBuilder as WorkflowBuilderType,
  WorkflowTemplate,
  WorkflowCategory,
  ValidationResult,
  AgentNode,
  WorkflowPhase,
  RoutingRule,
} from '../../shared/types';
import { Plus, Trash2, Check, AlertTriangle, Info, Copy, Save, Settings } from 'lucide-react';

interface WorkflowBuilderProps {
  onWorkflowCreated?: (workflow: WorkflowTemplate) => void;
  onClose?: () => void;
}

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ onWorkflowCreated, onClose }) => {
  const [activeTab, setActiveTab] = useState<'builder' | 'templates' | 'validation'>('templates');
  const [builder, setBuilder] = useState<WorkflowBuilderType | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [categories, setCategories] = useState<WorkflowCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [showValidation, setShowValidation] = useState(false);

  // Form states for new workflow
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [newAgent, setNewAgent] = useState<Partial<AgentNode>>({});
  const [newPhase, setNewPhase] = useState<Partial<WorkflowPhase>>({});
  const [newRule, setNewRule] = useState<Partial<RoutingRule>>({});

  useEffect(() => {
    // Load templates and categories (this would come from API)
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/workflow/templates');
      const data = await response.json();
      setTemplates(data.templates || []);
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const createNewBuilder = () => {
    const newBuilder: WorkflowBuilderType = {
      id: Date.now().toString(),
      name: workflowName || 'New Workflow',
      description: workflowDescription || '',
      config: { nodes: [], routingRules: [], phases: [] },
      validation: {} as any,
      status: 'draft',
      validationResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: 'current-user'
    };
    setBuilder(newBuilder);
    setActiveTab('builder');
  };

  const addAgent = () => {
    if (!builder || !newAgent.id || !newAgent.name || !newAgent.role) {
      alert('Please fill in all agent fields');
      return;
    }

    const agent: AgentNode = {
      id: newAgent.id,
      name: newAgent.name,
      role: newAgent.role,
      capabilities: newAgent.capabilities || [],
      priority: newAgent.priority || 1
    };

    const updatedBuilder = {
      ...builder,
      config: {
        ...builder.config,
        nodes: [...builder.config.nodes, agent]
      },
      updatedAt: new Date().toISOString()
    };

    setBuilder(updatedBuilder);
    setNewAgent({});
    validateWorkflow(updatedBuilder);
  };

  const addPhase = () => {
    if (!builder || !newPhase.name || !newPhase.requiredAgents) {
      alert('Please fill in all phase fields');
      return;
    }

    const phase: WorkflowPhase = {
      name: newPhase.name,
      requiredAgents: newPhase.requiredAgents,
      completionCriteria: newPhase.completionCriteria || (() => true),
      nextPhase: newPhase.nextPhase
    };

    const updatedBuilder = {
      ...builder,
      config: {
        ...builder.config,
        phases: [...builder.config.phases, phase]
      },
      updatedAt: new Date().toISOString()
    };

    setBuilder(updatedBuilder);
    setNewPhase({});
    validateWorkflow(updatedBuilder);
  };

  const addRoutingRule = () => {
    if (!builder || !newRule.targetNode || !newRule.condition) {
      alert('Please fill in all routing rule fields');
      return;
    }

    const rule: RoutingRule = {
      condition: newRule.condition,
      targetNode: newRule.targetNode,
      priority: newRule.priority || 1
    };

    const updatedBuilder = {
      ...builder,
      config: {
        ...builder.config,
        routingRules: [...builder.config.routingRules, rule]
      },
      updatedAt: new Date().toISOString()
    };

    setBuilder(updatedBuilder);
    setNewRule({});
    validateWorkflow(updatedBuilder);
  };

  const validateWorkflow = async (workflowBuilder: WorkflowBuilderType) => {
    try {
      const response = await fetch('/api/workflow/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: workflowBuilder.config })
      });
      const results = await response.json();
      setValidationResults(results);
      
      const updatedBuilder = {
        ...workflowBuilder,
        validationResults: results,
        status: (results.some((r: ValidationResult) => r.severity === 'error' && !r.passed) ? 'invalid' : 'valid') as 'draft' | 'validating' | 'valid' | 'invalid' | 'published'
      };
      setBuilder(updatedBuilder);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const publishWorkflow = async () => {
    if (!builder || builder.status !== 'valid') {
      alert('Cannot publish invalid workflow');
      return;
    }

    try {
      const response = await fetch('/api/workflow/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(builder)
      });
      const template = await response.json();
      onWorkflowCreated?.(template);
      onClose?.();
    } catch (error) {
      console.error('Failed to publish workflow:', error);
    }
  };

  const cloneTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/workflow/templates/${templateId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: `${templates.find(t => t.id === templateId)?.name} Copy`,
          author: 'current-user'
        })
      });
      const clonedBuilder = await response.json();
      setBuilder(clonedBuilder);
      setActiveTab('builder');
    } catch (error) {
      console.error('Failed to clone template:', error);
    }
  };

  const filteredTemplates = selectedCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-11/12 h-5/6 max-w-7xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">Workflow Builder & Validator</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowValidation(!showValidation)}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
            >
              <Check size={16} />
              <span>Validation</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-6 py-3 ${activeTab === 'templates' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          >
            📚 Templates
          </button>
          <button
            onClick={() => setActiveTab('builder')}
            className={`px-6 py-3 ${activeTab === 'builder' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          >
            🏗️ Builder
          </button>
          <button
            onClick={() => setActiveTab('validation')}
            className={`px-6 py-3 ${activeTab === 'validation' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          >
            🔍 Validation
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'templates' && (
            <div className="space-y-6">
              {/* Categories */}
              <div className="flex space-x-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-md whitespace-nowrap ${
                    selectedCategory === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  All Categories
                </button>
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 rounded-md whitespace-nowrap flex items-center space-x-2 ${
                      selectedCategory === category.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span>{category.icon}</span>
                    <span>{category.name}</span>
                  </button>
                ))}
              </div>

              {/* Templates Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map(template => (
                  <div key={template.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-lg">{template.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        template.metadata.complexity === 'simple' ? 'bg-green-100 text-green-700' :
                        template.metadata.complexity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {template.metadata.complexity}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{template.description}</p>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-500">
                        <span>⏱️ {template.metadata.estimatedDuration}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {template.tags.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => cloneTemplate(template.id)}
                        className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                      >
                        <Copy size={16} />
                        <span>Use Template</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Create New Workflow */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <h3 className="text-lg font-semibold mb-2">Create Custom Workflow</h3>
                <p className="text-gray-600 mb-4">Start from scratch with a custom workflow</p>
                <div className="space-y-3 max-w-md mx-auto">
                  <input
                    type="text"
                    placeholder="Workflow Name"
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                  <textarea
                    placeholder="Description"
                    value={workflowDescription}
                    onChange={(e) => setWorkflowDescription(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    rows={3}
                  />
                  <button
                    onClick={createNewBuilder}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                  >
                    <Plus size={16} />
                    <span>Create New Workflow</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'builder' && builder && (
            <div className="space-y-6">
              {/* Workflow Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">{builder.name}</h3>
                <p className="text-gray-600 text-sm mb-2">{builder.description}</p>
                <div className="flex items-center space-x-4 text-sm">
                  <span className={`px-2 py-1 rounded-full ${
                    builder.status === 'valid' ? 'bg-green-100 text-green-700' :
                    builder.status === 'invalid' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {builder.status}
                  </span>
                  <span>Agents: {builder.config.nodes.length}</span>
                  <span>Phases: {builder.config.phases.length}</span>
                  <span>Rules: {builder.config.routingRules.length}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Agents */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center space-x-2">
                    <span>🤖 Agents</span>
                    <span className="text-sm text-gray-500">({builder.config.nodes.length})</span>
                  </h4>
                  
                  <div className="space-y-3">
                    {builder.config.nodes.map(agent => (
                      <div key={agent.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{agent.name}</div>
                            <div className="text-sm text-gray-600">{agent.role}</div>
                            <div className="text-xs text-gray-500">
                              Capabilities: {agent.capabilities.join(', ')}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const updatedBuilder = {
                                ...builder,
                                config: {
                                  ...builder.config,
                                  nodes: builder.config.nodes.filter(n => n.id !== agent.id)
                                }
                              };
                              setBuilder(updatedBuilder);
                              validateWorkflow(updatedBuilder);
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Agent Form */}
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h5 className="font-medium mb-3">Add New Agent</h5>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Agent ID"
                        value={newAgent.id || ''}
                        onChange={(e) => setNewAgent({ ...newAgent, id: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Agent Name"
                        value={newAgent.name || ''}
                        onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                      <select
                        value={newAgent.role || ''}
                        onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      >
                        <option value="">Select Role</option>
                        <option value="coordinator">Coordinator</option>
                        <option value="designer">Designer</option>
                        <option value="frontend">Frontend</option>
                        <option value="backend">Backend</option>
                        <option value="analyst">Analyst</option>
                        <option value="writer">Writer</option>
                        <option value="reviewer">Reviewer</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Capabilities (comma-separated)"
                        value={newAgent.capabilities?.join(', ') || ''}
                        onChange={(e) => setNewAgent({ 
                          ...newAgent, 
                          capabilities: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                        })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                      <button
                        onClick={addAgent}
                        className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                      >
                        <Plus size={16} />
                        <span>Add Agent</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Phases */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center space-x-2">
                    <span>📊 Phases</span>
                    <span className="text-sm text-gray-500">({builder.config.phases.length})</span>
                  </h4>
                  
                  <div className="space-y-3">
                    {builder.config.phases.map((phase, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{phase.name}</div>
                            <div className="text-sm text-gray-600">
                              Required: {phase.requiredAgents.join(', ')}
                            </div>
                            {phase.nextPhase && (
                              <div className="text-xs text-gray-500">
                                Next: {phase.nextPhase}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              const updatedBuilder = {
                                ...builder,
                                config: {
                                  ...builder.config,
                                  phases: builder.config.phases.filter((_, i) => i !== index)
                                }
                              };
                              setBuilder(updatedBuilder);
                              validateWorkflow(updatedBuilder);
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Phase Form */}
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h5 className="font-medium mb-3">Add New Phase</h5>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Phase Name"
                        value={newPhase.name || ''}
                        onChange={(e) => setNewPhase({ ...newPhase, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                      <select
                        multiple
                        value={newPhase.requiredAgents || []}
                        onChange={(e) => setNewPhase({ 
                          ...newPhase, 
                          requiredAgents: Array.from(e.target.selectedOptions, option => option.value)
                        })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      >
                        {builder.config.nodes.map(agent => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} ({agent.role})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Next Phase (optional)"
                        value={newPhase.nextPhase || ''}
                        onChange={(e) => setNewPhase({ ...newPhase, nextPhase: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                      <button
                        onClick={addPhase}
                        className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                      >
                        <Plus size={16} />
                        <span>Add Phase</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Routing Rules */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center space-x-2">
                  <span>🔄 Routing Rules</span>
                  <span className="text-sm text-gray-500">({builder.config.routingRules.length})</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {builder.config.routingRules.map((rule, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Rule {index + 1}</div>
                          <div className="text-sm text-gray-600">
                            Target: {rule.targetNode}
                          </div>
                          <div className="text-xs text-gray-500">
                            Priority: {rule.priority}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const updatedBuilder = {
                              ...builder,
                              config: {
                                ...builder.config,
                                routingRules: builder.config.routingRules.filter((_, i) => i !== index)
                              }
                            };
                            setBuilder(updatedBuilder);
                            validateWorkflow(updatedBuilder);
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Rule Form */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h5 className="font-medium mb-3">Add New Routing Rule</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      value={newRule.targetNode || ''}
                      onChange={(e) => setNewRule({ ...newRule, targetNode: e.target.value })}
                      className="px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="">Select Target Agent</option>
                      {builder.config.nodes.map(agent => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Priority"
                      value={newRule.priority || ''}
                      onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) })}
                      className="px-3 py-2 border rounded-md text-sm"
                    />
                    <button
                      onClick={addRoutingRule}
                      className="flex items-center justify-center space-x-2 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                    >
                      <Plus size={16} />
                      <span>Add Rule</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => validateWorkflow(builder)}
                    className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
                  >
                    <Check size={16} />
                    <span>Validate</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('validation')}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    <Settings size={16} />
                    <span>View Validation</span>
                  </button>
                </div>
                <button
                  onClick={publishWorkflow}
                  disabled={builder.status !== 'valid'}
                  className="flex items-center space-x-2 px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Save size={16} />
                  <span>Publish Workflow</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'validation' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Workflow Validation Results</h3>
              
              {validationResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Info size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No validation results available. Create or select a workflow to validate.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {validationResults.map((result, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-4 ${
                        result.severity === 'error' && !result.passed ? 'border-red-200 bg-red-50' :
                        result.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                        'border-green-200 bg-green-50'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {result.severity === 'error' && !result.passed ? (
                          <AlertTriangle size={20} className="text-red-500 mt-0.5" />
                        ) : result.severity === 'warning' ? (
                          <AlertTriangle size={20} className="text-yellow-500 mt-0.5" />
                        ) : (
                          <Check size={20} className="text-green-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium">{result.ruleName}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              result.severity === 'error' ? 'bg-red-100 text-red-700' :
                              result.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {result.severity}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{result.message}</p>
                          {result.suggestions.length > 0 && (
                            <div className="text-sm">
                              <p className="font-medium text-gray-700 mb-1">Suggestions:</p>
                              <ul className="list-disc list-inside text-gray-600 space-y-1">
                                {result.suggestions.map((suggestion, i) => (
                                  <li key={i}>{suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
