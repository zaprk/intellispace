// Interactive chat with Ollama
const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function chatWithOllama() {
  console.log('🤖 Ollama Chat Started! Type "quit" to exit.\n');
  
  while (true) {
    const question = await new Promise((resolve) => {
      rl.question('You: ', resolve);
    });
    
    if (question.toLowerCase() === 'quit') {
      console.log('Goodbye! 👋');
      break;
    }
    
    try {
      console.log('🤔 Ollama is thinking...');
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'llama3.2:1b',
        prompt: question,
        stream: false
      });
      
      console.log(`Ollama: ${response.data.response}\n`);
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
  
  rl.close();
}

chatWithOllama();




