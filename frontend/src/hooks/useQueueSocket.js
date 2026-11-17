import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

export const useQueueSocket = ({ onQueueUpdate, onStatusChange } = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastQueueUpdate, setLastQueueUpdate] = useState(null);
  const [lastStatusChange, setLastStatusChange] = useState(null);
  const socketRef = useRef(null);

  const queueCallbackRef = useRef(onQueueUpdate);
  const statusCallbackRef = useRef(onStatusChange);

  useEffect(() => {
    queueCallbackRef.current = onQueueUpdate;
    statusCallbackRef.current = onStatusChange;
  }, [onQueueUpdate, onStatusChange]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsConnected(false);
      return;
    }

    // Connect via Vite proxy (/socket.io) or relative host
    const socket = io({
      auth: { token },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      setIsConnected(false);
      console.warn('Queue Socket connection warning:', error.message);
    });

    socket.on('queue:update', (data) => {
      setLastQueueUpdate(data);
      if (queueCallbackRef.current) {
        queueCallbackRef.current(data);
      }
    });

    socket.on('appointment:status', (data) => {
      setLastStatusChange(data);
      if (statusCallbackRef.current) {
        statusCallbackRef.current(data);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('queue:update');
      socket.off('appointment:status');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return {
    isConnected,
    lastQueueUpdate,
    lastStatusChange,
    socket: socketRef.current,
  };
};

export default useQueueSocket;
