import React, { useState } from 'react';
import { Clock, CheckCircle, XCircle, Play, Pause, AlertTriangle } from 'lucide-react';
import { theme } from '../utils/theme';

export interface ToolCall {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'requires_approval';
  result?: any;
  error?: string;
  requiresApproval?: boolean;
  approvalReason?: string;
}

export interface ToolCallCardProps {
  toolCall: ToolCall;
  onApprove?: (toolCallId: string) => void;
  onReject?: (toolCallId: string) => void;
  onRetry?: (toolCallId: string) => void;
}

const ToolCallCard: React.FC<ToolCallCardProps> = ({
  toolCall,
  onApprove,
  onReject,
  onRetry
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (toolCall.status) {
      case 'pending':
        return <Clock size={16} color={theme.colors.warning} />;
      case 'running':
        return <Play size={16} color={theme.colors.info} />;
      case 'completed':
        return <CheckCircle size={16} color={theme.colors.success} />;
      case 'failed':
        return <XCircle size={16} color={theme.colors.error} />;
      case 'requires_approval':
        return <AlertTriangle size={16} color={theme.colors.warning} />;
      default:
        return <Clock size={16} color={theme.colors.textMuted} />;
    }
  };

  const getStatusColor = () => {
    switch (toolCall.status) {
      case 'pending':
        return theme.colors.warning;
      case 'running':
        return theme.colors.info;
      case 'completed':
        return theme.colors.success;
      case 'failed':
        return theme.colors.error;
      case 'requires_approval':
        return theme.colors.warning;
      default:
        return theme.colors.textMuted;
    }
  };

  const getStatusText = () => {
    switch (toolCall.status) {
      case 'pending':
        return 'Pending';
      case 'running':
        return 'Running';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'requires_approval':
        return 'Requires Approval';
      default:
        return 'Unknown';
    }
  };

  return (
    <div style={{
      border: `1px solid ${theme.colors.border}`,
      borderRadius: '8px',
      backgroundColor: theme.colors.backgroundSecondary,
      marginBottom: '8px',
      overflow: 'hidden',
      transition: 'all 0.2s ease'
    }}>
      {/* Header */}
      <div 
        style={{
          padding: '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: toolCall.status === 'requires_approval' 
            ? `${theme.colors.warning}20` 
            : 'transparent'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {getStatusIcon()}
          <div>
            <div style={{ 
              fontWeight: 600, 
              color: theme.colors.text,
              fontSize: '14px'
            }}>
              {toolCall.name}
            </div>
            <div style={{ 
              color: theme.colors.textMuted,
              fontSize: '12px'
            }}>
              {toolCall.description}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 500,
            color: getStatusColor(),
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {getStatusText()}
          </span>
          
          {/* Expand/Collapse Icon */}
          <div style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}>
            ▼
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{
          padding: '16px',
          borderTop: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background
        }}>
          {/* Result or Error */}
          {toolCall.result && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ 
                fontWeight: 600, 
                color: theme.colors.text,
                marginBottom: '4px',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Result
              </div>
              <div style={{
                padding: '8px 12px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: theme.fonts.mono,
                color: theme.colors.text,
                whiteSpace: 'pre-wrap',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {JSON.stringify(toolCall.result, null, 2)}
              </div>
            </div>
          )}

          {toolCall.error && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ 
                fontWeight: 600, 
                color: theme.colors.error,
                marginBottom: '4px',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Error
              </div>
              <div style={{
                padding: '8px 12px',
                backgroundColor: `${theme.colors.error}20`,
                borderRadius: '4px',
                fontSize: '12px',
                color: theme.colors.error
              }}>
                {toolCall.error}
              </div>
            </div>
          )}

          {/* Approval Section */}
          {toolCall.status === 'requires_approval' && toolCall.approvalReason && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ 
                fontWeight: 600, 
                color: theme.colors.warning,
                marginBottom: '4px',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Approval Required
              </div>
              <div style={{
                padding: '8px 12px',
                backgroundColor: `${theme.colors.warning}20`,
                borderRadius: '4px',
                fontSize: '12px',
                color: theme.colors.text
              }}>
                {toolCall.approvalReason}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {toolCall.status === 'requires_approval' && (
              <>
                <button
                  onClick={() => onApprove?.(toolCall.id)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: theme.colors.success,
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => onReject?.(toolCall.id)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: theme.colors.error,
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Reject
                </button>
              </>
            )}

            {toolCall.status === 'failed' && (
              <button
                onClick={() => onRetry?.(toolCall.id)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: theme.colors.info,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolCallCard;
