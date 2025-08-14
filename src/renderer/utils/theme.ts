export const theme = {
  colors: {
    primary: '#5865F2',
    primaryHover: '#4752C4',
    background: '#36393f',
    backgroundSecondary: '#2f3136',
    backgroundTertiary: '#202225',
    text: '#dcddde',
    textMuted: '#96989d',
    textBright: '#ffffff',
    border: '#202225',
    success: '#3ba55d',
    warning: '#faa61a',
    error: '#ed4245',
    info: '#5865F2',
    hover: '#32353b',
    active: '#393c43'
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  borderRadius: '8px',
  fonts: {
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace'
  }
} as const;

export type Theme = typeof theme;







