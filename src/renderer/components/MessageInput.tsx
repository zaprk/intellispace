import React from 'react';
import { Send, Loader } from 'lucide-react';
import { theme } from '../utils/theme';
import { styles } from '../utils/styles';

export interface MessageInputProps {
  inputValue: string;
  isProcessing: boolean;
  activeAgent: string | null;
  activeConversation: string | null;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  inputValue,
  isProcessing,
  activeAgent,
  activeConversation,
  onInputChange,
  onSendMessage
}) => {
  const isDisabled = isProcessing || !activeAgent || !activeConversation;
  const canSend = inputValue.trim() && !isDisabled;

  return (
    <div style={styles.inputContainer}>
      <div style={styles.inputWrapper}>
        <input
          style={styles.input}
          placeholder="Type a message or use @agent #task..."
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && onSendMessage()}
          disabled={isDisabled}
        />
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





