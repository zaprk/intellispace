import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message } from '../../shared/types';

interface UseSocketConnectionProps {
  activeConversation?: string | null;
  onNewMessage?: (message: Message) => void;
  onTypingIndicator?: (data: { conversationId: string; agentId: string; isTyping: boolean }) => void;
  onAgentStatusUpdate?: (data: { agentId: string; status: string }) => void;
  onAgentSync?: () => void;
  onMemoryUpdate?: (data: { scope: string; scopeId: string; memory: any }) => void;
  onError?: (error: string) => void;
}

export const useSocketConnection = (props?: UseSocketConnectionProps) => {
  const {
    activeConversation = null,
    onNewMessage = () => {},
    onTypingIndicator = () => {},
    onAgentStatusUpdate = () => {},
    onAgentSync = () => {},
    onMemoryUpdate = () => {},
    onError = () => {}
  } = props || {};
  const socketRef = useRef<Socket | null>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    console.log('🔌 Connecting to Socket.IO server...');
    
    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      autoConnect: true
    });
    
    socket.on('connect', () => {
      console.log('✅ Socket.IO connected!', socket.id);
      
      // Join the active conversation if one exists
      if (activeConversation) {
        socket.emit('join', { 
          conversationId: activeConversation 
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('🚨 Socket.IO connection error:', error);
      onError(`Connection error: ${error.message}. Please check if the backend is running.`);
    });

    // Handle incoming messages
    socket.on('new-message', (message: Message) => {
      onNewMessage(message);
    });

    // Handle typing indicators
    socket.on('typing-indicator', (data: { conversationId: string; agentId: string; isTyping: boolean }) => {
      console.log('⌨️ Typing indicator:', data);
      onTypingIndicator(data);
    });

    // Handle agent status updates
    socket.on('agent-status', (data: { agentId: string; status: string }) => {
      console.log('🤖 Agent status update:', data);
      onAgentStatusUpdate(data);
    });

    // Handle agent synchronization events
    socket.on('agent-created', () => {
      console.log('🔄 Agent created, syncing with backend');
      onAgentSync();
    });

    socket.on('agent-updated', () => {
      console.log('🔄 Agent updated, syncing with backend');
      onAgentSync();
    });

    socket.on('agent-deleted', () => {
      console.log('🔄 Agent deleted, syncing with backend');
      onAgentSync();
    });

    // Handle memory updates
    socket.on('memory-updated', (data: { scope: string; scopeId: string; memory: any }) => {
      console.log('🧠 Memory updated:', data);
      onMemoryUpdate(data);
    });

    // Handle errors
    socket.on('error', (error: any) => {
      console.error('🚨 Socket error:', error);
      onError(`Server error: ${error.message}`);
    });

    socketRef.current = socket;

    return () => {
      console.log('🔌 Cleaning up Socket.IO connection');
      socket.disconnect();
    };
  }, [activeConversation]);

  // Handle conversation changes and Socket.IO room joining
  useEffect(() => {
    if (activeConversation && socketRef.current) {
      console.log(`🔄 Switching to conversation: ${activeConversation}`);
      
      // Join the new conversation room
      socketRef.current.emit('join', { conversationId: activeConversation });
    }
  }, [activeConversation]);

  return {
    socket: socketRef.current
  };
};
