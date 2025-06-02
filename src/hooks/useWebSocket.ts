import { useEffect } from 'react';
import { useBot } from '../context/BotContext';

export const useWebSocket = () => {
  const { dispatch } = useBot();

  useEffect(() => {
    // Create WebSocket connection
    const ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => {
      console.log('🌟 WebSocket Connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📨 WebSocket Message:', data);

      // Dispatch actions based on WebSocket messages
      dispatch({ type: 'ADD_LOG', payload: { type: data.type, message: data.message } });
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [dispatch]);
};