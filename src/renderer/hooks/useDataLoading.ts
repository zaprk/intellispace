import { useCallback } from 'react';
import { Agent, Conversation, OllamaStatus } from '../../shared/types';
import { apiService } from '../utils/api';

export const useDataLoading = () => {
  const syncAgentsWithBackend = useCallback(async (setAgents: (agents: Agent[]) => void) => {
    try {
      const response = await fetch('http://localhost:3001/api/agents');
      const backendAgents = await response.json();
      
      setAgents(backendAgents);
      console.log('🔄 Agents synced with backend:', backendAgents.length);
    } catch (error) {
      console.error('❌ Failed to sync agents:', error);
    }
  }, []);

  const loadInitialData = useCallback(async (
    setOllamaStatus: (status: OllamaStatus) => void,
    setAgents: (agents: Agent[]) => void,
    setConversations: (conversations: Conversation[]) => void,
    setActiveConversation: (id: string | null) => void,
    setActiveAgent: (id: string | null) => void,
    setIsLoading: (loading: boolean) => void,
    setError: (error: string) => void
  ) => {
    setIsLoading(true);
    try {
      // Check Ollama status
      try {
        const ollamaStatus = await apiService.checkOllamaStatus();
        setOllamaStatus(ollamaStatus);
      } catch (err) {
        console.warn('Could not check Ollama status:', err);
        setOllamaStatus({ available: false, models: [] });
      }

      // Load agents
      let agentsData: Agent[] = [];
      try {
        agentsData = await apiService.fetchAgents();
      } catch (err) {
        console.warn('Could not fetch agents:', err);
        agentsData = [];
      }

      const agentsWithStatus = agentsData.map(agent => ({
        ...agent,
        status: 'online' as const
      }));
      console.log('🤖 Loaded agents:', agentsWithStatus);
      setAgents(agentsWithStatus);

      // Load conversations
      let conversationsData: Conversation[] = [];
      try {
        conversationsData = await apiService.fetchConversations();
      } catch (err) {
        console.warn('Could not fetch conversations:', err);
        conversationsData = [];
      }

      setConversations(conversationsData);
      
      // Set first conversation as active if any exist
      if (conversationsData.length > 0) {
        setActiveConversation(conversationsData[0].id);
      }

      // Set first non-system agent as active if any exist
      const nonSystemAgents = agentsData.filter(agent => 
        agent.id !== 'system-agent' && agent.id !== 'user-agent'
      );
      if (nonSystemAgents.length > 0) {
        setActiveAgent(nonSystemAgents[0].id);
      }

    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Failed to load initial data. Please check if the backend server is running.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    syncAgentsWithBackend,
    loadInitialData
  };
};
