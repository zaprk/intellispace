import React from 'react';
import { theme } from '../utils/theme';

export interface StopRulesHeaderProps {
  turns: {
    current: number;
    max: number;
  };
  tools: {
    used: number;
    max: number;
  };
  acceptance: {
    current: number;
    required: number;
  };
  isVisible: boolean;
}

const StopRulesHeader: React.FC<StopRulesHeaderProps> = ({
  turns,
  tools,
  acceptance,
  isVisible
}) => {
  if (!isVisible) return null;

  const getProgressColor = (current: number, max: number) => {
    const ratio = current / max;
    if (ratio >= 0.8) return theme.colors.warning;
    if (ratio >= 0.6) return theme.colors.info;
    return theme.colors.success;
  };

  const getAcceptanceColor = () => {
    if (acceptance.current >= acceptance.required) return theme.colors.success;
    return theme.colors.warning;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      backgroundColor: theme.colors.backgroundSecondary,
      borderBottom: `1px solid ${theme.colors.border}`,
      fontSize: '12px',
      fontWeight: 500,
      color: theme.colors.textMuted
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Turns Counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>🔄</span>
          <span style={{ 
            color: getProgressColor(turns.current, turns.max) 
          }}>
            Turns {turns.current}/{turns.max}
          </span>
        </div>

        {/* Tools Counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>🔧</span>
          <span style={{ 
            color: getProgressColor(tools.used, tools.max) 
          }}>
            Tools {tools.used}/{tools.max}
          </span>
        </div>

        {/* Acceptance Counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>✅</span>
          <span style={{ 
            color: getAcceptanceColor() 
          }}>
            Acceptance: {acceptance.current}/{acceptance.required}
          </span>
        </div>
      </div>

      {/* Status Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '12px',
        backgroundColor: theme.colors.backgroundTertiary,
        fontSize: '10px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: theme.colors.success,
          animation: 'pulse 2s infinite'
        }} />
        <span>Active</span>
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
};

export default StopRulesHeader;
