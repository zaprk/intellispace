import { AlertCircle, X } from 'lucide-react';

interface ErrorToastProps {
  error: string | null;
  onClose: () => void;
}

const ErrorToast = ({ error, onClose }: ErrorToastProps) => {
  if (!error) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 1000,
      maxWidth: '300px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      backgroundColor: '#fee2e2',
      border: '1px solid #fecaca',
      color: '#dc2626',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      <AlertCircle size={16} />
      <span style={{ flex: 1 }}>{error}</span>
      <X 
        size={16} 
        onClick={onClose}
        style={{ cursor: 'pointer', opacity: 0.7 }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
      />
    </div>
  );
};

export default ErrorToast;
