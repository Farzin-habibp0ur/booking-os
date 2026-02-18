'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

type EventHandler = (data: any) => void;

let globalSocket: Socket | null = null;
let listenerCount = 0;

function getSocket(token: string): Socket {
  if (!globalSocket || globalSocket.disconnected) {
    globalSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return globalSocket;
}

export function useSocket(events: Record<string, EventHandler>) {
  const { user, token } = useAuth();
  const handlersRef = useRef(events);
  handlersRef.current = events;

  useEffect(() => {
    if (!user?.businessId || !token) return;

    const socket = getSocket(token);
    listenerCount++;

    const boundHandlers: [string, EventHandler][] = Object.entries(handlersRef.current).map(
      ([event, handler]) => {
        const wrapped = (data: any) => handlersRef.current[event]?.(data);
        socket.on(event, wrapped);
        return [event, wrapped];
      },
    );

    const connectErrorHandler = (err: Error) => {
      console.warn('[WebSocket] connect_error:', err.message);
    };
    socket.on('connect_error', connectErrorHandler);

    return () => {
      boundHandlers.forEach(([event, handler]) => socket.off(event, handler));
      socket.off('connect_error', connectErrorHandler);
      listenerCount--;
      if (listenerCount <= 0 && globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
        listenerCount = 0;
      }
    };
  }, [user?.businessId, token]);
}
