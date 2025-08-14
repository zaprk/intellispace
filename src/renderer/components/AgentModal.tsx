import React from 'react';
import { X } from 'lucide-react';
import { theme } from '../utils/theme';
import { styles } from '../utils/styles';

export interface NewAgent {
  name: string;
  role: string;
  description: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface AgentModalProps {
  visible: boolean;
  newAgent: NewAgent;
  onClose: () => void;
  onAgentChange: (agent: NewAgent) => void;
  onCreateAgent: () => void;
}

const AgentModal: React.FC<AgentModalProps> = ({
  visible,
  newAgent,
  onClose,
  onAgentChange,
  onCreateAgent
}) => {
  if (!visible) return null;

  const canCreate = newAgent.name && newAgent.role;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        padding: '24px',
        width: '500px',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ color: theme.colors.textBright, margin: 0 }}>Create New Agent</h2>
          <X 
            size={20} 
            style={{ cursor: 'pointer', color: theme.colors.text }}
            onClick={onClose}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ color: theme.colors.text, marginBottom: '4px', display: 'block' }}>Name</label>
            <input
              type="text"
              value={newAgent.name}
              onChange={(e) => onAgentChange({ ...newAgent, name: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                background: theme.colors.backgroundTertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                color: theme.colors.text
              }}
              placeholder="Agent name"
            />
          </div>

          <div>
            <label style={{ color: theme.colors.text, marginBottom: '4px', display: 'block' }}>Role</label>
            <input
              type="text"
              value={newAgent.role}
              onChange={(e) => onAgentChange({ ...newAgent, role: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                background: theme.colors.backgroundTertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                color: theme.colors.text
              }}
              placeholder="e.g., researcher, developer, writer"
            />
          </div>

          <div>
            <label style={{ color: theme.colors.text, marginBottom: '4px', display: 'block' }}>Description</label>
            <textarea
              value={newAgent.description}
              onChange={(e) => onAgentChange({ ...newAgent, description: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                background: theme.colors.backgroundTertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                color: theme.colors.text,
                minHeight: '60px',
                resize: 'vertical'
              }}
              placeholder="What does this agent do?"
            />
          </div>

          <div>
            <label style={{ color: theme.colors.text, marginBottom: '4px', display: 'block' }}>Model</label>
            <select
              value={newAgent.model}
              onChange={(e) => onAgentChange({ ...newAgent, model: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                background: theme.colors.backgroundTertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                color: theme.colors.text
              }}
            >
              <option value="llama3">Llama 3</option>
              <option value="gpt-oss:20b">GPT-OSS 20B</option>
              <option value="mistral">Mistral</option>
              <option value="llama2">Llama2</option>
              <option value="codellama">CodeLlama</option>
              <option value="neural-chat">Neural Chat</option>
            </select>
          </div>

          <div>
            <label style={{ color: theme.colors.text, marginBottom: '4px', display: 'block' }}>Temperature</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={newAgent.temperature}
              onChange={(e) => onAgentChange({ ...newAgent, temperature: parseFloat(e.target.value) })}
              style={{ width: '100%' }}
            />
            <span style={{ color: theme.colors.textMuted, fontSize: '12px' }}>{newAgent.temperature}</span>
          </div>

          <div>
            <label style={{ color: theme.colors.text, marginBottom: '4px', display: 'block' }}>Max Tokens</label>
            <input
              type="number"
              value={newAgent.maxTokens}
              onChange={(e) => onAgentChange({ ...newAgent, maxTokens: parseInt(e.target.value) })}
              style={{
                width: '100%',
                padding: '8px',
                background: theme.colors.backgroundTertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                color: theme.colors.text
              }}
              min="100"
              max="8000"
            />
          </div>

          <div>
            <label style={{ color: theme.colors.text, marginBottom: '4px', display: 'block' }}>System Prompt</label>
            <textarea
              value={newAgent.systemPrompt}
              onChange={(e) => onAgentChange({ ...newAgent, systemPrompt: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                background: theme.colors.backgroundTertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                color: theme.colors.text,
                minHeight: '80px',
                resize: 'vertical'
              }}
              placeholder="You are a helpful assistant..."
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={onCreateAgent}
              disabled={!canCreate}
              style={{
                ...styles.addAgentButton,
                flex: 1,
                opacity: canCreate ? 1 : 0.5
              }}
            >
              Create Agent
            </button>
            <button
              onClick={onClose}
              style={{
                ...styles.addAgentButton,
                flex: 1,
                background: theme.colors.backgroundTertiary,
                color: theme.colors.text
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentModal;





