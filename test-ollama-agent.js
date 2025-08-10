// Test script to create and communicate with Ollama agent
const axios = require('axios');

async function createOllamaAgent() {
  try {
    // Create an agent that uses Ollama
    const agentData = {
      name: "Ollama Assistant",
      role: "assistant",
      description: "A helpful AI assistant powered by Ollama",
      config: {
        llmProvider: "ollama",
        model: "llama3.2:1b", // or whatever model you have
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: "You are a helpful AI assistant. Be concise and friendly."
      },
      capabilities: ["conversation", "general_assistance"]
    };

    console.log('Creating Ollama agent...');
    const response = await axios.post('http://localhost:3001/api/agents', agentData);
    console.log('✅ Agent created:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error creating agent:', error.response?.data || error.message);
  }
}

async function testOllamaConnection() {
  try {
    console.log('Testing Ollama connection...');
    const response = await axios.get('http://localhost:11434/api/tags');
    console.log('✅ Ollama is running, available models:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Ollama connection failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🤖 Testing IntelliSpace Ollama Integration');
  
  // Test Ollama connection
  const ollamaWorking = await testOllamaConnection();
  if (!ollamaWorking) {
    console.log('Please make sure Ollama is running: ollama serve');
    return;
  }

  // Create agent
  await createOllamaAgent();
}

main();

