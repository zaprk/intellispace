import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSocketConnection } from './hooks/useSocketConnection';
import { useDataLoading } from './hooks/useDataLoading';
import { useUIState } from './hooks/useUIState';
import CompleteDiscordLayout from './components/CompleteDiscordLayout';
import LoadingOverlay from './components/LoadingOverlay';
import ErrorToast from './components/ErrorToast';
import { styles } from './utils/styles';

// Main App Component
export default function App() {
  // Core state hooks
  const socketRef = useRef<any>(null);

  // Custom hooks
  const { loadInitialData } = useDataLoading();
  
  // New state management hooks
  const uiState = useUIState();
  // DiscordLayout handles its own message processing

  // Destructure for easier access
  const {
    isLoading, setIsLoading,
    error, setError
  } = uiState;

  // Memoized callbacks for Socket.IO connection
  const handleNewMessageCallback = useCallback((message: any) => {
    // DiscordLayout handles its own message state
    console.log('New message received:', message);
  }, []);

  const handleTypingIndicator = useCallback((data: any) => {
    // DiscordLayout handles its own typing indicators
    console.log('Typing indicator:', data);
  }, []);

  const handleAgentStatusUpdate = useCallback((data: any) => {
    // DiscordLayout handles its own agent state
    console.log('Agent status update:', data);
  }, []);

  const handleAgentSync = useCallback(() => {
    // DiscordLayout handles its own agent syncing
    console.log('Agent sync requested');
  }, []);

  const handleMemoryUpdateCallback = useCallback((data: any) => {
    // DiscordLayout handles its own memory state
    console.log('Memory update:', data);
  }, []);

  const handleError = useCallback((error: string) => {
    setError(error);
  }, [setError]);

  // Socket.IO connection hook
  const { socket } = useSocketConnection({
    activeConversation: null, // DiscordLayout manages its own conversation state
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
      () => {}, // setOllamaStatus - not needed for Discord layout
      () => {}, // setAgents - DiscordLayout manages its own agents
      () => {}, // setConversations - DiscordLayout manages its own conversations
      () => {}, // setActiveConversation - DiscordLayout manages its own conversation state
      () => {}, // setActiveAgent - not needed for Discord layout
      setIsLoading,
      setError
    );
  }, [loadInitialData, setIsLoading, setError]);

  // Scroll to bottom when new messages arrive - handled by DiscordLayout

  // Set global styles
  useEffect(() => {
    Object.assign(document.body.style, styles.global);
    return () => {
      document.body.style.cssText = '';
    };
  }, []);

  // DiscordLayout handles its own conversation state and Socket.IO room management

  return (
    <div style={styles.appContainer}>
      <LoadingOverlay isLoading={isLoading} />
      <ErrorToast error={error} onClose={() => setError(null)} />

      <CompleteDiscordLayout />
    </div>
  );
}