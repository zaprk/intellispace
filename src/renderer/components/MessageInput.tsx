import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader, AtSign, Hash, X } from 'lucide-react';
import { theme } from '../utils/theme';
import { styles } from '../utils/styles';
import { Agent } from '../../shared/types';

export interface MessageInputProps {
  inputValue: string;
  isProcessing: boolean;
  activeConversation: string | null;
  agents: Agent[];
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onMentionSelect?: (agentId: string) => void;
}

interface TaskChip {
  id: string;
  text: string;
}

const MessageInput: React.FC<MessageInputProps> = ({
  inputValue,
  isProcessing,
  activeConversation,
  agents,
  onInputChange,
  onSendMessage,
  onMentionSelect
}) => {
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [taskChips, setTaskChips] = useState<TaskChip[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionMenuRef = useRef<HTMLDivElement>(null);

  const isDisabled = isProcessing || !activeConversation;
  const canSend = inputValue.trim() && !isDisabled;

  // Filter agents for mention menu
  const filteredAgents = agents.filter(agent => 
    agent.role !== 'system' && 
    agent.role !== 'user' &&
    agent.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  // Handle input changes and detect @ mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    onInputChange(value);
    setCursorPosition(cursorPos);

    // Detect @ mention
    const beforeCursor = value.substring(0, cursorPos);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setShowMentionMenu(true);
      setMentionFilter(mentionMatch[1]);
    } else {
      setShowMentionMenu(false);
    }

    // Detect #task chips
    const taskMatches = value.match(/#(\w+)/g);
    if (taskMatches) {
      const newTaskChips: TaskChip[] = taskMatches.map((task, index) => ({
        id: `task-${index}`,
        text: task.substring(1) // Remove #
      }));
      setTaskChips(newTaskChips);
    }
  };

  // Handle mention selection
  const handleMentionSelect = (agent: Agent) => {
    const beforeAt = inputValue.substring(0, cursorPosition).replace(/@\w*$/, '');
    const afterAt = inputValue.substring(cursorPosition);
    const newValue = `${beforeAt}@${agent.name} ${afterAt}`;
    
    onInputChange(newValue);
    setShowMentionMenu(false);
    setMentionFilter('');
    
    if (onMentionSelect) {
      onMentionSelect(agent.id);
    }

    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPos = beforeAt.length + agent.name.length + 2; // +2 for @ and space
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Handle task chip removal
  const handleTaskChipRemove = (taskId: string) => {
    const chip = taskChips.find(t => t.id === taskId);
    if (chip) {
      const newValue = inputValue.replace(`#${chip.text}`, '');
      onInputChange(newValue);
      setTaskChips(taskChips.filter(t => t.id !== taskId));
    }
  };

  // Handle key navigation in mention menu
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionMenu && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      e.preventDefault();
      // TODO: Implement keyboard navigation for mention menu
    }
  };

  // Close mention menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mentionMenuRef.current && !mentionMenuRef.current.contains(event.target as Node)) {
        setShowMentionMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={styles.inputContainer}>
      {/* Task Chips Display */}
      {taskChips.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary
        }}>
          {taskChips.map(chip => (
            <div key={chip.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              backgroundColor: theme.colors.primary,
              color: 'white',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 500
            }}>
              <Hash size={12} />
              {chip.text}
              <button
                onClick={() => handleTaskChipRemove(chip.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '0',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={styles.inputWrapper}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            ref={inputRef}
            style={{
              ...styles.input,
              paddingLeft: '40px' // Space for @ icon
            }}
            placeholder="Type a message, use @ to mention agents, or #task for tasks..."
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && onSendMessage()}
            disabled={isDisabled}
          />
          
                     {/* @ Icon */}
           <div style={{
             position: 'absolute',
             left: '12px',
             top: '50%',
             transform: 'translateY(-50%)',
             color: theme.colors.textMuted,
             pointerEvents: 'none'
           }}>
             <AtSign size={16} />
           </div>

          {/* Mention Menu */}
          {showMentionMenu && (
            <div
              ref={mentionMenuRef}
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '0',
                right: '0',
                backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 1000,
                maxHeight: '200px',
                overflowY: 'auto',
                marginBottom: '8px'
              }}
            >
              {filteredAgents.length > 0 ? (
                filteredAgents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => handleMentionSelect(agent)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: theme.colors.text,
                      fontSize: '14px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                                         <span style={{ fontSize: '16px' }}>🤖</span>
                     <div>
                       <div style={{ fontWeight: 500 }}>{agent.name}</div>
                       <div style={{ 
                         fontSize: '12px', 
                         color: theme.colors.textMuted 
                       }}>
                         {agent.role}
                       </div>
                     </div>
                  </button>
                ))
              ) : (
                                 <div style={{
                   padding: '8px 12px',
                   color: theme.colors.textMuted,
                   fontSize: '14px',
                   fontStyle: 'italic'
                 }}>
                   No agents found
                 </div>
              )}
            </div>
          )}
        </div>

        <button 
          style={styles.sendButton(!canSend)}
          onClick={onSendMessage} 
          disabled={!canSend}
          onMouseEnter={(e) => {
            if (canSend) {
              e.currentTarget.style.background = theme.colors.primaryHover;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = theme.colors.primary;
          }}
        >
          {isProcessing ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
};

export default MessageInput;





