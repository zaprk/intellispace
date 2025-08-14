import React from 'react';
import { Database, X } from 'lucide-react';
import { Memory } from '../../shared/types';
import { theme } from '../utils/theme';
import { styles } from '../utils/styles';

export interface MemoryPanelProps {
  visible: boolean;
  projectMemory: Memory;
  conversationMemory: Memory;
  onToggleVisibility: () => void;
  onProjectMemoryChange: (memory: Memory) => void;
  onConversationMemoryChange: (memory: Memory) => void;
  onUpdateMemory: () => void;
}

const MemoryPanel: React.FC<MemoryPanelProps> = ({
  visible,
  projectMemory,
  conversationMemory,
  onToggleVisibility,
  onProjectMemoryChange,
  onConversationMemoryChange,
  onUpdateMemory
}) => {
  return (
    <div style={styles.memoryPanel(visible)}>
      <div style={styles.memoryHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={18} />
          <span style={{ fontWeight: 600 }}>Shared Memory</span>
        </div>
        <X 
          size={18} 
          style={{ cursor: 'pointer', color: theme.colors.text }}
          onClick={onToggleVisibility}
        />
      </div>
      <div style={styles.memoryContent}>
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ marginBottom: '8px', color: theme.colors.textBright }}>Project Memory</h4>
          <textarea
            style={styles.jsonEditor}
            value={JSON.stringify(projectMemory, null, 2)}
            onChange={(e) => {
              try {
                onProjectMemoryChange(JSON.parse(e.target.value));
              } catch (err) {
                // Invalid JSON, just ignore
              }
            }}
          />
        </div>
        <div>
          <h4 style={{ marginBottom: '8px', color: theme.colors.textBright }}>Conversation Memory</h4>
          <textarea
            style={styles.jsonEditor}
            value={JSON.stringify(conversationMemory, null, 2)}
            onChange={(e) => {
              try {
                onConversationMemoryChange(JSON.parse(e.target.value));
              } catch (err) {
                // Invalid JSON, just ignore
              }
            }}
          />
          <button
            style={{
              ...styles.addAgentButton,
              marginTop: '8px'
            }}
            onClick={onUpdateMemory}
          >
            Update Memory
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemoryPanel;





