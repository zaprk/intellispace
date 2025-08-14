import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { Agent } from '../../shared/types';
import { apiService } from '../utils/api';

interface NewAgent {
  name: string;
  role: string;
  description: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export const useAgentManagement = () => {
  const [newAgent, setNewAgent] = useState<NewAgent>({
    name: '',
    role: '',
    description: '',
    model: 'llama3',
    temperature: 0.7,
    maxTokens: 4000,
    systemPrompt: ''
  });

  const createNewAgent = useCallback(async (
    setAgents: Dispatch<SetStateAction<Agent[]>>,
    setShowAgentModal: (show: boolean) => void,
    setError: (error: string) => void
  ) => {
    try {
      const agentData = {
        name: newAgent.name,
        role: newAgent.role,
        description: newAgent.description,
        config: {
          llmProvider: 'ollama',
          model: newAgent.model,
          temperature: newAgent.temperature,
          maxTokens: newAgent.maxTokens,
          systemPrompt: newAgent.systemPrompt
        }
      };

      const createdAgent = await apiService.createAgent(agentData);
      setAgents((prev: Agent[]) => [...prev, { ...createdAgent, status: 'online' as const }]);
      
      // Reset form and close modal
      setNewAgent({
        name: '',
        role: '',
        description: '',
        model: 'llama3',
        temperature: 0.7,
        maxTokens: 4000,
        systemPrompt: ''
      });
      setShowAgentModal(false);
    } catch (err) {
      console.error('Error creating agent:', err);
      setError('Failed to create agent');
    }
  }, [newAgent]);

  const clearAllAgents = useCallback(async (
    currentAgents: Agent[],
    setAgents: Dispatch<SetStateAction<Agent[]>>,
    setError: (error: string) => void
  ) => {
    try {
      // Get agents to delete (all except system and user agents)
      const agentsToDelete = currentAgents.filter(agent => 
        agent.id !== 'system-agent' && agent.id !== 'user-agent'
      );
      
      // Delete each agent from backend
      for (const agent of agentsToDelete) {
        try {
          await apiService.deleteAgent(agent.id);
        } catch (err) {
          console.warn(`Failed to delete agent ${agent.name}:`, err);
        }
      }
      
      // Update frontend state
      const agentsToKeep = currentAgents.filter(agent => 
        agent.id === 'system-agent' || agent.id === 'user-agent'
      );
      setAgents(agentsToKeep);
      
      console.log('Cleared all agents except system agents');
    } catch (err) {
      console.error('Error clearing agents:', err);
      setError('Failed to clear agents');
    }
  }, []);

  return {
    newAgent,
    setNewAgent,
    createNewAgent,
    clearAllAgents
  };
};
