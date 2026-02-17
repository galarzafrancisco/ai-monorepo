import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ThreadsService } from './api';
import type { Thread, Message } from './types';
import { ActorType as DtoActorType } from './types';
import { getUIWebSocketUrl } from '../../config/api';
import {
  ThreadWireEvents,
  MessageCreatedWireEvent,
  ThreadMessageWirePayload,
  ActorType as WireActorType,
} from "@taico/events";
import { ActorResponseDto } from '@taico/client';


// Use centralized API configuration
const SOCKET_URL = getUIWebSocketUrl('/threads');


const sortMessages = (messages: Message[]): Message[] => {
  return [...messages].sort((a, b) => {
    const dateA = new Date(a.updatedAt).getTime();
    const dateB = new Date(b.updatedAt).getTime();
    return dateA - dateB; // Ascending order (newest first)
  });
};

export const useThread = (threadId: string) => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatIsLoading, setChatIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatIsSending, setChatIsSending] = useState(false);
  const [chatSendError, setChatSendError] = useState<string | null>(null);

  // Data store
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Transport
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Boot
  useEffect(() => {
    loadThread();
    loadMessages();
    const cleanup = setupWebsocket();
    return cleanup;
  }, [threadId]);

  // Load threads
  const loadThread = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ThreadsService.getThread(threadId);
      setThread(response || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setIsLoading(false);
    }
  };

  // Load messages
  const loadMessages = async () => {
    setChatIsLoading(true);
    setChatError(null);
    try {
      const response = await ThreadsService.listMessages(threadId);
      setMessages(sortMessages(response.items));
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setChatIsLoading(false);
    }
  }

  // Send a message
  const sendMessage = async (content: string): Promise<Message | null> => {
    setChatIsSending(true);
    setChatSendError(null);
    let message: Message | null = null;
    try {
      message = await ThreadsService.createMessage(threadId, content);
    } catch (err) {
      setChatSendError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setChatIsSending(false);
    }
    return message;
  }

  const deleteThread = useCallback(async (id: string) => {
    await ThreadsService.deleteThread(id);
    setThread(null);
  }, []);

  // Setup websocket
  const setupWebsocket = () => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to websocket');
      newSocket.emit('threads.subscribe', { threadId }, (ack: any) => {
        if (ack.ok) {
          console.log(ack);
          console.log('Subscribed to room:', ack.room);
          setIsConnected(true);
        } else {
          console.error('Failed to subscribe to room');
          setIsConnected(false);
        }
      });
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    // Handle new message event
    newSocket.on(ThreadWireEvents.MESSAGE_CREATED, (event: MessageCreatedWireEvent) => {
      console.log(ThreadWireEvents.MESSAGE_CREATED, event);

      if (event.payload.threadId !== threadId) {
        return;
      }

      // Adapt types (this needs better hanlding).
      const createdByActorWire = event.payload.createdByActor;
      let createdByActorDto: ActorResponseDto | null = null;
      if (createdByActorWire) {
        if (createdByActorWire.type == WireActorType.HUMAN) {
          createdByActorDto = {
            ...createdByActorWire,
            type: DtoActorType.HUMAN
          };
        }
        if (createdByActorWire.type == WireActorType.AGENT) {
          createdByActorDto = {
            ...createdByActorWire,
            type: DtoActorType.AGENT
          };
        }
      }
      const incomingMessage: Message = {
        ...event.payload,
        createdByActor: createdByActorDto
      };

      setMessages(prev => {
        return sortMessages([
          ...prev.filter(existingMessage => existingMessage.id != incomingMessage.id),
          incomingMessage,
        ]);
      })

    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('threads.unsubscribe', { threadId });
      newSocket.close();
    };

  }

  return {
    // UI feedback
    isLoading,
    error,
    chatIsLoading,
    chatError,
    chatIsSending,
    chatSendError,

    // Data
    messages,
    sendMessage,
  };
};
