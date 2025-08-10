import { contextBridge, ipcRenderer } from 'electron';

// Define the API that will be exposed to the renderer process
const electronAPI = {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  // File operations
  showSaveDialog: (options: any) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options),

  // Agent management
  createAgent: (agent: any) => ipcRenderer.invoke('create-agent', agent),
  updateAgent: (id: string, updates: any) => ipcRenderer.invoke('update-agent', id, updates),
  deleteAgent: (id: string) => ipcRenderer.invoke('delete-agent', id),

  // Conversation management
  createConversation: (conversation: any) => ipcRenderer.invoke('create-conversation', conversation),
  sendMessage: (message: any) => ipcRenderer.invoke('send-message', message),
  getConversations: () => ipcRenderer.invoke('get-conversations'),
  getConversation: (id: string) => ipcRenderer.invoke('get-conversation', id),

  // Memory management
  getProjectMemory: (projectId: string) => ipcRenderer.invoke('get-project-memory', projectId),
  updateProjectMemory: (projectId: string, data: any) => 
    ipcRenderer.invoke('update-project-memory', projectId, data),
  getConversationMemory: (conversationId: string) => 
    ipcRenderer.invoke('get-conversation-memory', conversationId),
  updateConversationMemory: (conversationId: string, data: any) => 
    ipcRenderer.invoke('update-conversation-memory', conversationId, data),

  // Menu events - Listen for menu actions
  onMenuAction: (callback: (action: string) => void) => {
    const validChannels = [
      'menu-new-project',
      'menu-open-project',
      'menu-import-agent',
      'menu-export-agent',
      'menu-new-agent',
      'menu-manage-agents',
      'menu-agent-marketplace',
      'menu-toggle-memory',
      'menu-toggle-agents',
      'menu-llm-settings',
      'menu-plugin-manager',
      'menu-export-conversation',
      'menu-clear-memory',
      'menu-show-shortcuts'
    ];

    validChannels.forEach(channel => {
      ipcRenderer.on(channel, () => callback(channel));
    });

    // Return cleanup function
    return () => {
      validChannels.forEach(channel => {
        ipcRenderer.removeAllListeners(channel);
      });
    };
  },

  // Real-time updates from backend
  onAgentUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('agent-update', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('agent-update');
  },

  onMessageReceived: (callback: (data: any) => void) => {
    ipcRenderer.on('message-received', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('message-received');
  },

  onMemoryUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('memory-update', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('memory-update');
  },

  // LLM Provider management
  testLLMConnection: (provider: string, config: any) => 
    ipcRenderer.invoke('test-llm-connection', provider, config),
  
  getLLMModels: (provider: string) => 
    ipcRenderer.invoke('get-llm-models', provider),

  // Project management
  createProject: (project: any) => ipcRenderer.invoke('create-project', project),
  openProject: (projectId: string) => ipcRenderer.invoke('open-project', projectId),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  deleteProject: (projectId: string) => ipcRenderer.invoke('delete-project', projectId),

  // Tool/Plugin management
  getAvailableTools: () => ipcRenderer.invoke('get-available-tools'),
  executeTool: (toolId: string, params: any) => 
    ipcRenderer.invoke('execute-tool', toolId, params),
  installPlugin: (pluginId: string) => ipcRenderer.invoke('install-plugin', pluginId),
  uninstallPlugin: (pluginId: string) => ipcRenderer.invoke('uninstall-plugin', pluginId),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: any) => ipcRenderer.invoke('update-settings', settings),

  // Export functionality
  exportConversation: (conversationId: string, format: string) => 
    ipcRenderer.invoke('export-conversation', conversationId, format),
  exportAgent: (agentId: string) => ipcRenderer.invoke('export-agent', agentId),
  importAgent: (agentData: string) => ipcRenderer.invoke('import-agent', agentData),
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declarations for TypeScript
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}

// Export types for use in renderer
export type ElectronAPI = typeof electronAPI;