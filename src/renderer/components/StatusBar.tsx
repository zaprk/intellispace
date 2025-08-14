import React from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { Agent, OllamaStatus } from '../../shared/types';
import { theme } from '../utils/theme';
import { styles } from '../utils/styles';

export interface StatusBarProps {
  ollamaStatus: OllamaStatus;
  activeAgent: string | null;
  agents: Agent[];
  messages: any[];
}

const StatusBar: React.FC<StatusBarProps> = ({
  ollamaStatus,
  activeAgent,
  agents,
  messages
}) => {
  return (
    <div style={styles.statusBar}>
      <div style={styles.statusItem}>
        {ollamaStatus.available ? (
          <>
            <Check size={12} color={theme.colors.success} />
            <span>Ollama Connected</span>
          </>
        ) : (
          <>
            <AlertCircle size={12} color={theme.colors.error} />
            <span>Ollama Disconnected</span>
          </>
        )}
      </div>
      <div style={styles.statusItem}>
        <span>Model: {agents.find(a => a.id === activeAgent)?.config?.model || 'Not selected'}</span>
      </div>
      <div style={styles.statusItem}>
        <span>{messages.length} messages</span>
      </div>
    </div>
  );
};

export default StatusBar;





