// Simple Ollama agent test
const axios = require('axios');

async function simpleOllamaTest() {
  try {
    // Test direct Ollama API call
    console.log('🧪 Testing direct Ollama API...');
    const ollamaResponse = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.2:1b',
      prompt: 'Hello, can you introduce yourself in one sentence?',
      stream: false
    });
    
    console.log('✅ Direct Ollama response:', ollamaResponse.data.response);
    
    // Test our agent endpoint
    console.log('\n🤖 Testing IntelliSpace agent...');
    const agentsResponse = await axios.get('http://localhost:3001/api/agents');
    const agents = agentsResponse.data;
    
    if (agents.length > 0) {
      const agent = agents[0];
      console.log(`Found agent: ${agent.name}`);
      console.log(`Agent config:`, agent.config);
    } else {
      console.log('No agents found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

simpleOllamaTest();











