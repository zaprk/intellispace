import { useState } from 'react';

export const useUIState = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [memoryVisible, setMemoryVisible] = useState(true);
  const [agentSectionExpanded, setAgentSectionExpanded] = useState(true);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showTeamTester, setShowTeamTester] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  return {
    // Sidebar state
    sidebarCollapsed,
    setSidebarCollapsed,
    
    // Memory panel state
    memoryVisible,
    setMemoryVisible,
    
    // Agent section state
    agentSectionExpanded,
    setAgentSectionExpanded,
    hoveredAgent,
    setHoveredAgent,
    
    // Modal states
    showAgentModal,
    setShowAgentModal,
    showTeamTester,
    setShowTeamTester,
    
    // Loading and error states
    isLoading,
    setIsLoading,
    error,
    setError,
    isProcessing,
    setIsProcessing
  };
};





