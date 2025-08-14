// Utility function for agent icons
export const getAgentIcon = (role: string): string => {
  const roleIcons: { [key: string]: string } = {
    'coordinator': '🎯',
    'designer': '🎨',
    'frontend-developer': '💻',
    'backend-developer': '⚙️',
    'ui/ux designer': '🎨',
    'project manager': '📋',
    'system': '🔧',
    'user': '👤'
  };
  return roleIcons[role.toLowerCase()] || '🤖';
};
