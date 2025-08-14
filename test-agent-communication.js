// Test agent communication
const axios = require('axios');

async function testAgentCommunication() {
  try {
    // Get the agent we just created
    console.log('Fetching agents...');
    const agentsResponse = await axios.get('http://localhost:3001/api/agents');
    const agents = agentsResponse.data;
    console.log(`Found ${agents.length} agents`);
    
    if (agents.length === 0) {
      console.log('No agents found. Run the create agent script first.');
      return;
    }

    const ollamaAgent = agents.find(agent => agent.config.llmProvider === 'ollama');
    if (!ollamaAgent) {
      console.log('No Ollama agent found.');
      return;
    }

    console.log(`Using agent: ${ollamaAgent.name} (${ollamaAgent.id})`);

    // Create a test conversation
    console.log('Creating test conversation...');
    const conversationData = {
      title: "Test Ollama Chat",
      projectId: null // You can create a project first if needed
    };
    
    const convResponse = await axios.post('http://localhost:3001/api/conversations', conversationData);
    const conversation = convResponse.data;
    console.log(`Created conversation: ${conversation.title} (${conversation.id})`);

    // Trigger agent response
    console.log('Triggering agent response...');
    const triggerData = {
      conversationId: conversation.id,
      prompt: "Hello! Can you introduce yourself and tell me what you can help with?"
    };

    await axios.post(`http://localhost:3001/api/agents/${ollamaAgent.id}/trigger`, triggerData);
    console.log('✅ Agent response triggered! Check the conversation for the response.');
    
    // Wait a moment and fetch messages
    console.log('Waiting for response...');
    setTimeout(async () => {
      try {
        const messagesResponse = await axios.get(`http://localhost:3001/api/conversations/${conversation.id}/messages`);
        const messages = messagesResponse.data;
        console.log(`\nConversation messages (${messages.length}):`);
        messages.forEach((msg, i) => {
          console.log(`${i + 1}. [${msg.type}] ${msg.senderId}: ${msg.content}`);
        });
      } catch (error) {
        console.error('Error fetching messages:', error.message);
      }
    }, 3000);

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testAgentCommunication();











