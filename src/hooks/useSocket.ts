import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Message, Conversation } from '../services/chatApi';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

// Global socket instance to prevent multiple connections and stale refs across components
let globalSocket: Socket | null = null;
let connectionCount = 0;

export function useSocket() {
    const [isConnected, setIsConnected] = useState(globalSocket?.connected || false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        connectionCount++;

        if (!globalSocket) {
            globalSocket = io(API_BASE, {
                auth: { token },
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 10,
            });
        }

        const handleConnect = () => setIsConnected(true);
        const handleDisconnect = () => setIsConnected(false);

        globalSocket.on('connect', handleConnect);
        globalSocket.on('disconnect', handleDisconnect);

        if (globalSocket.connected) {
            setIsConnected(true);
        }

        return () => {
            connectionCount--;
            if (globalSocket) {
                globalSocket.off('connect', handleConnect);
                globalSocket.off('disconnect', handleDisconnect);
            }
            if (connectionCount === 0 && globalSocket) {
                globalSocket.disconnect();
                globalSocket = null;
            }
        };
    }, []);

    const sendMessage = useCallback((conversationId: string, content: string, replyToId?: string): Promise<Message | null> => {
        return new Promise((resolve) => {
            if (!globalSocket) return resolve(null);
            globalSocket.emit('send_message', { conversationId, content, replyToId }, (response: any) => {
                if (response?.success) {
                    resolve(response.message);
                } else {
                    resolve(null);
                }
            });
        });
    }, []);

    const onNewMessage = useCallback((callback: (message: Message) => void) => {
        if (!globalSocket) return () => { };
        globalSocket.on('new_message', callback);
        return () => { globalSocket?.off('new_message', callback); };
    }, []);

    const onNewConversation = useCallback((callback: (conversation: Conversation) => void) => {
        if (!globalSocket) return () => { };
        globalSocket.on('new_conversation', callback);
        return () => { globalSocket?.off('new_conversation', callback); };
    }, []);

    const joinConversation = useCallback((conversationId: string) => {
        globalSocket?.emit('join_conversation', { conversationId });
    }, []);

    const emitTypingStart = useCallback((conversationId: string) => {
        globalSocket?.emit('typing_start', { conversationId });
    }, []);

    const emitTypingStop = useCallback((conversationId: string) => {
        globalSocket?.emit('typing_stop', { conversationId });
    }, []);

    const onTyping = useCallback((callback: (data: { conversationId: string; userId: string }) => void) => {
        if (!globalSocket) return () => { };
        globalSocket.on('user_typing', callback);
        return () => { globalSocket?.off('user_typing', callback); };
    }, []);

    const onStopTyping = useCallback((callback: (data: { conversationId: string; userId: string }) => void) => {
        if (!globalSocket) return () => { };
        globalSocket.on('user_stop_typing', callback);
        return () => { globalSocket?.off('user_stop_typing', callback); };
    }, []);

    const onPinnedMessageUpdated = useCallback((callback: (data: { conversationId: string; pinnedMessage: Message | null }) => void) => {
        if (!globalSocket) return () => { };
        globalSocket.on('pinned_message_updated', callback);
        return () => { globalSocket?.off('pinned_message_updated', callback); };
    }, []);

    return {
        isConnected,
        sendMessage,
        onNewMessage,
        onNewConversation,
        joinConversation,
        emitTypingStart,
        emitTypingStop,
        onTyping,
        onStopTyping,
        onPinnedMessageUpdated,
    };
}
