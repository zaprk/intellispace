import { WorkflowValidator } from './src/backend/services/WorkflowValidator';
import { WorkflowBuilder } from './src/backend/services/WorkflowBuilder';
import { AgentNode, WorkflowPhase, RoutingRule } from './src/shared/types';

async function testWorkflowValidation() {
  console.log('🔒 Testing Workflow Validation & Builder System\n');

  const validator = new WorkflowValidator();
  const builder = new WorkflowBuilder();

  // Test 1: Validate existing workflow
  console.log('📋 Test 1: Validating Existing Workflow');
  const existingConfig = builder['createWebDevConfig']();
  const validationResults = validator.validateWorkflow(existingConfig);
  
  console.log('✅ Validation Results:');
  validationResults.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.ruleName} (${result.severity}): ${result.message}`);
    if (result.suggestions.length > 0) {
      console.log(`   💡 Suggestions: ${result.suggestions.join(', ')}`);
    }
  });

  console.log(`\n🔍 Workflow Complexity: ${validator.getWorkflowComplexity(existingConfig)}`);
  console.log(`⏱️ Estimated Duration: ${validator['estimateExecutionTime'](existingConfig)} seconds`);
  console.log(`🛡️ Is Safe: ${validator.isWorkflowSafe(existingConfig)}\n`);

  // Test 2: Create a new workflow builder
  console.log('🏗️ Test 2: Creating New Workflow Builder');
  const newBuilder = builder.createWorkflowBuilder(
    'Custom Marketing Workflow',
    'A workflow for creating marketing campaigns',
    'test-user'
  );
  console.log(`📝 Created builder: ${newBuilder.name} (${newBuilder.status})\n`);

  // Test 3: Add agents with validation
  console.log('🤖 Test 3: Adding Agents with Validation');
  
  try {
    // Add valid agent
    const coordinator: AgentNode = {
      id: 'marketing-coordinator',
      name: 'Marketing Coordinator',
      role: 'coordinator',
      capabilities: ['planning', 'coordination'],
      priority: 1
    };
    
    let updatedBuilder = builder.addAgent(newBuilder, coordinator);
    console.log(`✅ Added coordinator agent (${updatedBuilder.status})`);

    // Add writer agent
    const writer: AgentNode = {
      id: 'content-writer',
      name: 'Content Writer',
      role: 'writer',
      capabilities: ['content', 'writing'],
      priority: 2
    };
    
    updatedBuilder = builder.addAgent(updatedBuilder, writer);
    console.log(`✅ Added writer agent (${updatedBuilder.status})`);

    // Try to add invalid agent (should fail)
    const invalidAgent: AgentNode = {
      id: 'hacker',
      name: 'Hacker',
      role: 'hacker', // Invalid role
      capabilities: ['hacking'],
      priority: 3
    };
    
    updatedBuilder = builder.addAgent(updatedBuilder, invalidAgent);
    console.log('❌ This should have failed!');
  } catch (error) {
    console.log(`❌ Expected error: ${error.message}`);
  }

  // Test 4: Add phases
  console.log('\n📊 Test 4: Adding Phases');
  
  try {
    const requirementsPhase: WorkflowPhase = {
      name: 'requirements',
      requiredAgents: ['marketing-coordinator'],
      completionCriteria: (state) => state.agentOutputs['marketing-coordinator']?.requirementsComplete === true,
      nextPhase: 'content'
    };
    
    let updatedBuilder = builder.addPhase(newBuilder, requirementsPhase);
    console.log(`✅ Added requirements phase (${updatedBuilder.status})`);

    const contentPhase: WorkflowPhase = {
      name: 'content',
      requiredAgents: ['content-writer'],
      completionCriteria: (state) => state.agentOutputs['content-writer']?.contentComplete === true,
      nextPhase: 'complete'
    };
    
    updatedBuilder = builder.addPhase(updatedBuilder, contentPhase);
    console.log(`✅ Added content phase (${updatedBuilder.status})`);
  } catch (error) {
    console.log(`❌ Error adding phase: ${error.message}`);
  }

  // Test 5: Add routing rules
  console.log('\n🔄 Test 5: Adding Routing Rules');
  
  try {
    const coordinatorRule: RoutingRule = {
      condition: (state) => state.phase === 'requirements' && state.currentInput.length > 0,
      targetNode: 'marketing-coordinator',
      priority: 1
    };
    
    let updatedBuilder = builder.addRoutingRule(newBuilder, coordinatorRule);
    console.log(`✅ Added coordinator routing rule (${updatedBuilder.status})`);

    const writerRule: RoutingRule = {
      condition: (state) => state.phase === 'content' && !state.completedTasks.includes('content_complete'),
      targetNode: 'content-writer',
      priority: 2
    };
    
    updatedBuilder = builder.addRoutingRule(updatedBuilder, writerRule);
    console.log(`✅ Added writer routing rule (${updatedBuilder.status})`);
  } catch (error) {
    console.log(`❌ Error adding routing rule: ${error.message}`);
  }

  // Test 6: Validate final workflow
  console.log('\n🔍 Test 6: Final Validation');
  const finalValidation = builder.validateBuilder(newBuilder);
  
  console.log('📋 Final Validation Results:');
  finalValidation.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.ruleName} (${result.severity}): ${result.message}`);
  });

  console.log(`\n📊 Final Status: ${newBuilder.status}`);
  console.log(`🛡️ Is Safe: ${validator.isWorkflowSafe(newBuilder.config)}`);

  // Test 7: Auto-fix capabilities
  console.log('\n🔧 Test 7: Auto-Fix Capabilities');
  const suggestions = validator.getWorkflowSuggestions(newBuilder.config);
  console.log('💡 Suggestions for improvement:');
  suggestions.forEach(suggestion => {
    console.log(`   • ${suggestion}`);
  });

  // Test 8: Template system
  console.log('\n📚 Test 8: Template System');
  const templates = builder.getTemplates();
  const categories = builder.getCategories();
  
  console.log('📂 Available Categories:');
  categories.forEach(category => {
    console.log(`   ${category.icon} ${category.name}: ${category.description}`);
  });

  console.log('\n📋 Available Templates:');
  templates.forEach(template => {
    console.log(`   📄 ${template.name} (${template.category})`);
    console.log(`      ${template.description}`);
    console.log(`      ⏱️ Duration: ${template.metadata.estimatedDuration}`);
    console.log(`      🎯 Complexity: ${template.metadata.complexity}`);
  });

  // Test 9: Clone template
  console.log('\n🔄 Test 9: Cloning Template');
  try {
    const clonedBuilder = builder.cloneTemplate(
      'web-dev-template',
      'My Custom Web Dev Workflow',
      'test-user'
    );
    console.log(`✅ Cloned template: ${clonedBuilder.name}`);
    console.log(`📊 Status: ${clonedBuilder.status}`);
  } catch (error) {
    console.log(`❌ Error cloning template: ${error.message}`);
  }

  console.log('\n🎉 Workflow Validation & Builder System Test Complete!');
}

// Run the test
testWorkflowValidation().catch(console.error);
