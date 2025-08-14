import { theme } from './theme';

export const styles = {
  global: {
    margin: 0,
    padding: 0,
    boxSizing: 'border-box' as const,
    fontFamily: theme.fonts.body,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  },
  appContainer: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    background: theme.colors.background
  },
  sidebar: (collapsed: boolean) => ({
    width: collapsed ? '72px' : '240px',
    background: theme.colors.backgroundTertiary,
    display: 'flex',
    flexDirection: 'column' as const,
    transition: 'width 0.2s ease',
    borderRight: `1px solid ${theme.colors.border}`
  }),
  sidebarHeader: {
    height: '48px',
    padding: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${theme.colors.border}`
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontWeight: 'bold',
    color: theme.colors.textBright
  },
  agentList: {
    flex: 1,
    padding: theme.spacing.sm,
    overflowY: 'auto' as const
  },
  agentSection: {
    marginBottom: theme.spacing.md
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    color: theme.colors.textMuted,
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    userSelect: 'none' as const
  },
  agentItem: (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    margin: '2px 0',
    borderRadius: '4px',
    cursor: 'pointer',
    background: active ? theme.colors.active : 'transparent',
    transition: 'background 0.2s'
  }),
  agentAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const
  },
  statusIndicator: (status: string) => ({
    content: '""',
    position: 'absolute' as const,
    bottom: '-2px',
    right: '-2px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: `2px solid ${theme.colors.backgroundTertiary}`,
    background: status === 'online' ? theme.colors.success :
                status === 'busy' ? theme.colors.warning :
                theme.colors.textMuted
  }),
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const
  },
  conversationHeader: {
    height: '48px',
    padding: `0 ${theme.spacing.md}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${theme.colors.border}`,
    background: theme.colors.background
  },
  conversationTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontWeight: 600,
    color: theme.colors.textBright
  },
  messagesContainer: {
    flex: 1,
    padding: theme.spacing.md,
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: theme.spacing.md
  },
  message: {
    display: 'flex',
    gap: theme.spacing.md
  },
  messageAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  messageContent: {
    flex: 1
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs
  },
  messageAuthor: {
    fontWeight: 600,
    color: theme.colors.textBright
  },
  messageTime: {
    fontSize: '12px',
    color: theme.colors.textMuted
  },
  messageText: {
    color: theme.colors.text,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap' as const,
    wordWrap: 'break-word' as const
  },
  inputContainer: {
    padding: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`
  },
  inputWrapper: {
    display: 'flex',
    gap: theme.spacing.sm,
    background: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius,
    padding: theme.spacing.sm
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: theme.colors.text,
    fontSize: '14px'
  },
  sendButton: (disabled: boolean) => ({
    background: theme.colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: theme.spacing.sm,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
    opacity: disabled ? 0.5 : 1
  }),
  memoryPanel: (visible: boolean) => ({
    width: visible ? '320px' : '0',
    background: theme.colors.backgroundSecondary,
    borderLeft: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column' as const,
    transition: 'width 0.2s ease',
    overflow: 'hidden'
  }),
  memoryHeader: {
    height: '48px',
    padding: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${theme.colors.border}`
  },
  memoryContent: {
    flex: 1,
    padding: theme.spacing.md,
    overflowY: 'auto' as const
  },
  jsonEditor: {
    background: theme.colors.backgroundTertiary,
    borderRadius: '4px',
    padding: theme.spacing.sm,
    fontFamily: theme.fonts.mono,
    fontSize: '12px',
    color: theme.colors.text,
    overflowX: 'auto' as const,
    whiteSpace: 'pre' as const,
    border: 'none',
    outline: 'none',
    width: '100%',
    minHeight: '100px',
    resize: 'vertical' as const
  },
  addAgentButton: {
    width: '100%',
    padding: '8px',
    background: theme.colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background 0.2s'
  } as const,
  statusBar: {
    height: '24px',
    background: theme.colors.backgroundTertiary,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    padding: `0 ${theme.spacing.sm}`,
    fontSize: '12px',
    color: theme.colors.textMuted,
    gap: theme.spacing.md
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  loadingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  errorMessage: {
    background: theme.colors.error,
    color: 'white',
    padding: theme.spacing.sm,
    borderRadius: '4px',
    margin: theme.spacing.sm,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm
  }
};







