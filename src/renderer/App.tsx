import { useState, useEffect, useRef, useCallback } from 'react';
import { Agent, OllamaStatus } from '../shared/types';
import { apiService } from './utils/api';
import { theme } from './utils/theme';
import { styles } from './utils/styles';
import { useMessageDeduplication } from './hooks/useMessageDeduplication';
import { useSocketConnection } from './hooks/useSocketConnection';
import { useAgentManagement } from './hooks/useAgentManagement';
import { useConversationManagement } from './hooks/useConversationManagement';
import { useMessageManagement } from './hooks/useMessageManagement';
import { useDataLoading } from './hooks/useDataLoading';
import { useUIState } from './hooks/useUIState';
import { useConversationState } from './hooks/useConversationState';
import { useInputState } from './hooks/useInputState';
import { useMessageProcessing } from './hooks/useMessageProcessing';
import { getAgentIcon } from './utils/agentUtils';
import { createWebsiteTeam } from './utils/teamConfig';
import TeamCollaborationTester from './components/TeamCollaborationTester';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import StatusBar from './components/StatusBar';
import MemoryPanel from './components/MemoryPanel';
import AgentModal from './components/AgentModal';
import LoadingOverlay from './components/LoadingOverlay';
import ErrorToast from './components/ErrorToast';
import { WorkflowBuilder } from './components/WorkflowBuilder';

//

// Main App Component
export default function App() {
  // Core state hooks
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({ available: false, models: [] });
  const socketRef = useRef<any>(null);

  // Custom hooks
  const { addMessage, clearProcessed } = useMessageDeduplication();
  const { newAgent, setNewAgent, createNewAgent, clearAllAgents } = useAgentManagement();
  const { createNewConversation, loadConversationMessages } = useConversationManagement();
  const { handleSendMessage, handleMemoryUpdate: updateMemoryViaAPI } = useMessageManagement();
  const { syncAgentsWithBackend, loadInitialData } = useDataLoading();
  
  // New state management hooks
  const uiState = useUIState();
  const conversationState = useConversationState();
  const inputState = useInputState();
  // Message processing hooks
  const { handleNewMessage, renderMessage } = useMessageProcessing(agents);

  // Destructure for easier access
  const {
    sidebarCollapsed, setSidebarCollapsed,
    memoryVisible, setMemoryVisible,
    agentSectionExpanded, setAgentSectionExpanded,
    hoveredAgent, setHoveredAgent,
    showAgentModal, setShowAgentModal,
    showTeamTester, setShowTeamTester,
    isLoading, setIsLoading,
    error, setError,
    isProcessing, setIsProcessing
  } = uiState;

  const {
    messages, setMessages,
    conversations, setConversations,
    activeConversation, setActiveConversation,
    conversationMemory, setConversationMemory,
    projectMemory, setProjectMemory,
    typingAgents, setTypingAgents,
    messagesEndRef
  } = conversationState;

  const { inputValue, setInputValue } = inputState;

  // Workflow builder state
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);

  // Memoized callbacks for Socket.IO connection
  const handleNewMessageCallback = useCallback((message: any) => {
    handleNewMessage(message, addMessage, setMessages);
  }, [handleNewMessage, addMessage, setMessages]);

  const handleTypingIndicator = useCallback((data: any) => {
    setTypingAgents(prev => ({
      ...prev,
      [data.agentId]: data.isTyping
    }));
  }, [setTypingAgents]);

  const handleAgentStatusUpdate = useCallback((data: any) => {
    setAgents(prev => prev.map(agent => 
      agent.id === data.agentId 
        ? { ...agent, status: data.status as any }
        : agent
    ));
  }, [setAgents]);

  const handleAgentSync = useCallback(() => {
    syncAgentsWithBackend(setAgents);
  }, [syncAgentsWithBackend, setAgents]);

  const handleMemoryUpdateCallback = useCallback((data: any) => {
    if (data.scope === 'conversation' && data.scopeId === activeConversation) {
      setConversationMemory(data.memory);
    } else if (data.scope === 'project') {
      setProjectMemory(data.memory);
    }
  }, [activeConversation, setConversationMemory, setProjectMemory]);

  const handleError = useCallback((error: string) => {
    setError(error);
  }, [setError]);



  // Socket.IO connection hook
  const { socket } = useSocketConnection({
    activeConversation,
    onNewMessage: handleNewMessageCallback,
    onTypingIndicator: handleTypingIndicator,
    onAgentStatusUpdate: handleAgentStatusUpdate,
    onAgentSync: handleAgentSync,
    onMemoryUpdate: handleMemoryUpdateCallback,
    onError: handleError
  });

  // Update socket ref
    socketRef.current = socket;

  // Load initial data
  useEffect(() => {
    loadInitialData(
      setOllamaStatus,
      setAgents,
      setConversations,
      setActiveConversation,
      setActiveAgent,
      setIsLoading,
      setError
    );
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set global styles
  useEffect(() => {
    Object.assign(document.body.style, styles.global);
    return () => {
      document.body.style.cssText = '';
    };
  }, []);

  // Handle conversation changes and Socket.IO room joining
  useEffect(() => {
    if (activeConversation && socket) {
      console.log(`🔄 Switching to conversation: ${activeConversation}`);
      
      // Clear processed messages for new conversation
      clearProcessed();
      
      // Reset message state
      setMessages([]);
      
      // Join the new conversation room
      socket.emit('join', { conversationId: activeConversation });
      // Load messages for the conversation
      loadConversationMessages(
        activeConversation,
        agents,
        setMessages,
        setConversationMemory,
        setError
      );
    }
  }, [activeConversation, clearProcessed, socket, agents]);

  return (
    <div style={styles.appContainer}>
      <LoadingOverlay isLoading={isLoading} />
      <ErrorToast error={error} onClose={() => setError(null)} />

      <Sidebar
        collapsed={sidebarCollapsed}
        agents={agents}
        conversations={conversations}
        activeConversation={activeConversation}
        activeAgent={activeAgent}
        agentSectionExpanded={agentSectionExpanded}
        hoveredAgent={hoveredAgent}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onAgentClick={setActiveAgent}
        onConversationClick={setActiveConversation}
        onToggleAgentSection={() => setAgentSectionExpanded(!agentSectionExpanded)}
        onAgentHover={setHoveredAgent}
        onShowAgentModal={() => setShowAgentModal(true)}
        onCreateWebsiteTeam={() => {
          createWebsiteTeam(apiService, agents, setAgents, setConversations, setActiveConversation, setActiveAgent, setError);
        }}
        onShowTeamTester={() => setShowTeamTester(true)}
        onCreateNewConversation={() => {
          createNewConversation(conversations, agents, setConversations, setActiveConversation, setError);
        }}
        onClearAllAgents={() => {
          clearAllAgents(agents, setAgents, setError);
        }}
        getAgentIcon={getAgentIcon}
      />

      <div style={styles.mainContent}>
        <Header
          activeConversation={activeConversation}
          conversations={conversations}
          memoryVisible={memoryVisible}
          onRefresh={() => loadInitialData(setOllamaStatus, setAgents, setConversations, setActiveConversation, setActiveAgent, setIsLoading, setError)}
          onToggleMemory={() => setMemoryVisible(!memoryVisible)}
          onOpenWorkflowBuilder={() => setShowWorkflowBuilder(true)}
        />

        <MessageList
          messages={messages}
          agents={agents}
          conversations={conversations}
          isProcessing={isProcessing}
          typingAgents={typingAgents}
          activeConversation={activeConversation}
          onCreateWebsiteTeam={() => createWebsiteTeam(apiService, agents, setAgents, setConversations, setActiveConversation, setActiveAgent, setError)}
          onShowAgentModal={() => setShowAgentModal(true)}
          onShowTeamTester={() => setShowTeamTester(true)}
          onCreateNewConversation={() => createNewConversation(conversations, agents, setConversations, setActiveConversation, setError)}
          getAgentIcon={getAgentIcon}
          renderMessage={renderMessage}
          messagesEndRef={messagesEndRef}
        />

        <MessageInput
          inputValue={inputValue}
          isProcessing={isProcessing}
          activeAgent={activeAgent}
          activeConversation={activeConversation}
          onInputChange={setInputValue}
          onSendMessage={() => handleSendMessage(inputValue, activeAgent, activeConversation, agents, ollamaStatus, messages, conversationMemory, setInputValue, setIsProcessing, setError)}
        />

        <StatusBar
          ollamaStatus={ollamaStatus}
          activeAgent={activeAgent}
          agents={agents}
          messages={messages}
              />
            </div>

      <MemoryPanel
        visible={memoryVisible}
        projectMemory={projectMemory}
        conversationMemory={conversationMemory}
        onToggleVisibility={() => setMemoryVisible(!memoryVisible)}
        onProjectMemoryChange={setProjectMemory}
        onConversationMemoryChange={setConversationMemory}
        onUpdateMemory={() => updateMemoryViaAPI(activeConversation, conversationMemory, setError)}
      />

      <AgentModal
        visible={showAgentModal}
        newAgent={newAgent}
        onClose={() => setShowAgentModal(false)}
        onAgentChange={setNewAgent}
        onCreateAgent={() => createNewAgent(setAgents, setShowAgentModal, setError)}
      />

      {/* Workflow Builder Modal */}
      {showWorkflowBuilder && (
        <WorkflowBuilder
          onWorkflowCreated={(workflow) => {
            console.log('Workflow created:', workflow);
            setShowWorkflowBuilder(false);
          }}
          onClose={() => setShowWorkflowBuilder(false)}
        />
      )}

      {/* Team Collaboration Tester Modal */}
      {showTeamTester && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: theme.colors.background,
            borderRadius: '12px',
            width: '100%',
            maxWidth: '1200px',
            height: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ color: theme.colors.text, margin: 0, fontSize: '24px' }}>
                Team Collaboration Tester
              </h2>
              <button
                onClick={() => setShowTeamTester(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.colors.text,
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                ✕
              </button>
            </div>
                         <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
               <TeamCollaborationTester 
                 activeConversationId={activeConversation}
                 agents={agents}
                 apiService={apiService}
                 socketRef={socketRef}
               />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

// TeamCollaborationTester moved to ./components/TeamCollaborationTester

// useMessageDeduplication moved to ./hooks/useMessageDeduplication