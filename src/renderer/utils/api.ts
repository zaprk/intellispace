import { Agent, Conversation, Message, Memory, OllamaStatus } from '../../shared/types';

const API_URL = 'http://localhost:3001/api';

export class ApiService {
  async fetchAgents(): Promise<Agent[]> {
    try {
      const response = await fetch(`${API_URL}/agents`);
      if (!response.ok) throw new Error('Failed to fetch agents');
      return await response.json();
    } catch (error) {
      console.error('Error fetching agents:', error);
      return [];
    }
  }

  async createAgent(agent: Omit<Agent, 'id' | 'status'>): Promise<Agent> {
    try {
      const response = await fetch(`${API_URL}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent)
      });
      if (!response.ok) throw new Error('Failed to create agent');
      return await response.json();
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  }

  async deleteAgent(agentId: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/agents/${agentId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete agent');
    } catch (error) {
      console.error('Error deleting agent:', error);
      throw error;
    }
  }

  async deleteAllAgents(): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/agents/clear`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to clear agents');
    } catch (error) {
      console.error('Error clearing agents:', error);
      throw error;
    }
  }

  async fetchConversations(projectId?: string): Promise<Conversation[]> {
    try {
      const response = await fetch(`${API_URL}/conversations${projectId ? `?projectId=${projectId}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return await response.json();
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  }

  async createConversation(conversation: Omit<Conversation, 'id'>): Promise<Conversation> {
    try {
      const response = await fetch(`${API_URL}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversation)
      });
      if (!response.ok) throw new Error('Failed to create conversation');
      return await response.json();
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  async fetchMessages(conversationId: string): Promise<Message[]> {
    try {
      const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return await response.json();
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  async sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    try {
      const response = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      if (!response.ok) throw new Error('Failed to send message');
      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async processWithOllama(prompt: string, model: string = 'llama2', agentContext: any = {}): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/ollama/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model,
          context: agentContext,
          stream: false
        })
      });
      if (!response.ok) throw new Error('Failed to process with Ollama');
      return await response.json();
    } catch (error) {
      console.error('Error processing with Ollama:', error);
      throw error;
    }
  }

  async checkOllamaStatus(): Promise<OllamaStatus> {
    try {
      const response = await fetch(`${API_URL}/ollama/status`);
      if (!response.ok) throw new Error('Ollama not available');
      return await response.json();
    } catch (error) {
      console.error('Error checking Ollama status:', error);
      return { available: false, models: [] };
    }
  }

  async getMemory(scope: string, scopeId: string): Promise<Memory> {
    try {
      const response = await fetch(`${API_URL}/memory/${scope}/${scopeId}`);
      if (!response.ok) throw new Error('Failed to fetch memory');
      return await response.json();
    } catch (error) {
      console.error('Error fetching memory:', error);
      return {};
    }
  }

  async updateMemory(scope: string, scopeId: string, data: Memory): Promise<Memory> {
    try {
      const response = await fetch(`${API_URL}/memory/${scope}/${scopeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update memory');
      return await response.json();
    } catch (error) {
      console.error('Error updating memory:', error);
      throw error;
    }
  }

  async reloadAgents(): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/agents/reload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to reload agents');
    } catch (error) {
      console.error('Error reloading agents:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService();







