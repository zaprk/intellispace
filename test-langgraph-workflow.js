import { WorkflowOrchestrator } from './src/backend/services/WorkflowOrchestrator.js';
import { PrismaClient } from '@prisma/client';

// Test the LangGraph workflow orchestrator
async function testLangGraphWorkflow() {
  console.log('🚀 Testing LangGraph Workflow Orchestrator\n');
  
  const prisma = new PrismaClient();
  const orchestrator = new WorkflowOrchestrator(prisma);
  
  // Test message
  const testMessage = {
    id: 'test-message-1',
    content: 'build an ecommerce platform',
    conversationId: 'test-conversation-1',
    senderId: 'user-agent',
    type: 'text',
    timestamp: new Date().toISOString(),
    metadata: null,
    sender: {
      id: 'user-agent',
      name: 'User',
      avatar: '👤',
      role: 'user'
    }
  };
  
  try {
    console.log('📝 Processing message:', testMessage.content);
    console.log('⏳ Starting workflow execution...\n');
    
    const startTime = Date.now();
    const result = await orchestrator.processMessage(testMessage);
    const endTime = Date.now();
    
    console.log('✅ Workflow completed in', endTime - startTime, 'ms');
    console.log('\n📊 Final Workflow State:');
    console.log('Phase:', result.phase);
    console.log('Error:', result.error || 'None');
    console.log('Retry Count:', result.retryCount);
    console.log('Workflow History Length:', result.workflowHistory.length);
    
    console.log('\n🔄 Workflow History:');
    result.workflowHistory.forEach((step, index) => {
      console.log(`${index + 1}. ${step.node} (${step.status})`);
      console.log(`   Input: ${step.input.substring(0, 50)}...`);
      console.log(`   Output: ${JSON.stringify(step.output).substring(0, 100)}...`);
      console.log('');
    });
    
    console.log('\n🎯 Agent Outputs:');
    Object.entries(result.agentOutputs).forEach(([agent, output]) => {
      console.log(`${agent}:`);
      console.log(`  Message: ${output.message || 'No message'}`);
      console.log(`  Complete: ${output.requirementsComplete || output.designComplete || output.frontendComplete || output.backendComplete || false}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testLangGraphWorkflow().catch(console.error);
