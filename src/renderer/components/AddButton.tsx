import React, { useState } from 'react';
import { Plus, Bot, MessageCircle, X } from 'lucide-react';

interface AddButtonProps {
  onCreateAgent: () => void;
  onCreateConversation: () => void;
  collapsed: boolean;
}

const AddButton: React.FC<AddButtonProps> = ({ 
  onCreateAgent, 
  onCreateConversation, 
  collapsed 
}) => {
  const [showModal, setShowModal] = useState(false);

  const handleAddClick = () => {
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleCreateAgent = () => {
    onCreateAgent();
    closeModal();
  };

  const handleCreateConversation = () => {
    onCreateConversation();
    closeModal();
  };

  return (
    <>
      {/* Add Button */}
      <button
        onClick={handleAddClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: collapsed ? '8px' : '8px 12px',
          borderRadius: '50%',
          backgroundColor: '#5865f2',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s',
          width: '80%',
          fontSize: '14px',
          fontWeight: '500'
        }}
        onMouseEnter={(e) => {
          const target = e.target as HTMLElement;
          target.style.backgroundColor = '#4752c4';
        }}
        onMouseLeave={(e) => {
          const target = e.target as HTMLElement;
          target.style.backgroundColor = '#5865f2';
        }}
      >
        <Plus size={16} />
        {!collapsed && 'Add'}
      </button>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#2f3136',
            borderRadius: '8px',
            padding: '24px',
            width: '400px',
            maxWidth: '90vw',
            border: '1px solid #40444b'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: 'white',
                margin: 0
              }}>
                Create New
              </h2>
              <button
                onClick={closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#96989d',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px'
                }}
                onMouseEnter={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.color = '#96989d';
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Create Agent Option */}
              <button
                onClick={handleCreateAgent}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '8px',
                  backgroundColor: '#40444b',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.backgroundColor = '#4f545c';
                }}
                onMouseLeave={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.backgroundColor = '#40444b';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#5865f2',
                  borderRadius: '8px'
                }}>
                  <Bot size={20} style={{ color: 'white' }} />
                </div>
                <div>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '500',
                    color: 'white',
                    margin: '0 0 4px 0'
                  }}>
                    Create Agent
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#96989d',
                    margin: 0
                  }}>
                    Add a new AI agent with custom capabilities
                  </p>
                </div>
              </button>

              {/* Create Conversation Option */}
              <button
                onClick={handleCreateConversation}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '8px',
                  backgroundColor: '#40444b',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.backgroundColor = '#4f545c';
                }}
                onMouseLeave={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.backgroundColor = '#40444b';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#3ba55c',
                  borderRadius: '8px'
                }}>
                  <MessageCircle size={20} style={{ color: 'white' }} />
                </div>
                <div>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '500',
                    color: 'white',
                    margin: '0 0 4px 0'
                  }}>
                    Create Conversation
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#96989d',
                    margin: 0
                  }}>
                    Start a new conversation with existing agents
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AddButton;

