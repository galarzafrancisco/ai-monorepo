import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ThreadsService } from './api';
import type { Thread, Message } from './types';
import { ActorType as DtoActorType } from './types';
import { getUIWebSocketUrl } from '../../config/api';
import {
  AgentActivityWireEvent,
  ThreadWireEvents,
  MessageCreatedWireEvent,
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
  const [agentActivity, setAgentActivity] = useState<"thinking" | "tool_calling" | null>(null);

  // Transport
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logPrefix = `[useThread][${threadId}]`;

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
    console.log(`${logPrefix} Initializing websocket`, { socketUrl: SOCKET_URL });

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    console.log(`${logPrefix} Websocket created`, { socketId: newSocket.id ?? null });

    newSocket.on('connect', () => {
      console.log(`${logPrefix} Connected to websocket`, {
        socketId: newSocket.id,
      });

      console.log(`${logPrefix} Sending threads.subscribe`, { threadId });
      newSocket.emit('threads.subscribe', { threadId }, (ack: any) => {
        if (ack.ok) {
          console.log(`${logPrefix} Subscribed to room`, {
            room: ack.room,
            ack,
          });
          setIsConnected(true);
        } else {
          console.error(`${logPrefix} Failed to subscribe to room`, { ack });
          setIsConnected(false);
        }
      });
    });

    newSocket.on('connect_error', (err) => {
      console.error(`${logPrefix} Websocket connect_error`, {
        message: err.message,
      });
    });

    newSocket.on('disconnect', () => {
      console.log(`${logPrefix} WebSocket disconnected`);
      setIsConnected(false);
      if (activityTimeoutRef.current) {
        console.log(`${logPrefix} Clearing activity timeout on disconnect`);
        clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = null;
      }
      console.log(`${logPrefix} Clearing agent activity on disconnect`);
      setAgentActivity(null);
    });

    const scheduleActivityReset = () => {
      if (activityTimeoutRef.current) {
        console.log(`${logPrefix} Replacing existing activity timeout`);
        clearTimeout(activityTimeoutRef.current);
      }
      activityTimeoutRef.current = setTimeout(() => {
        console.log(`${logPrefix} Activity timeout reached, clearing indicator`);
        setAgentActivity(null);
        activityTimeoutRef.current = null;
      }, 3000);

      console.log(`${logPrefix} Activity timeout scheduled`, {
        timeoutMs: 3000,
      });
    };

    console.log(`${logPrefix} Registering websocket event handlers`, {
      messageEvent: ThreadWireEvents.MESSAGE_CREATED,
      activityEvent: ThreadWireEvents.AGENT_ACTIVITY,
    });

    // Handle new message event
    newSocket.on(ThreadWireEvents.MESSAGE_CREATED, (event: MessageCreatedWireEvent) => {
      console.log(`${logPrefix} Received MESSAGE_CREATED`, event);

      if (event.payload.threadId !== threadId) {
        console.log(`${logPrefix} Ignoring MESSAGE_CREATED for different thread`, {
          incomingThreadId: event.payload.threadId,
          expectedThreadId: threadId,
        });
        return;
      }

      if (activityTimeoutRef.current) {
        console.log(`${logPrefix} Clearing activity timeout because message arrived`);
        clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = null;
      }
      console.log(`${logPrefix} Clearing agent activity because message arrived`);
      setAgentActivity(null);

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

    newSocket.on(ThreadWireEvents.AGENT_ACTIVITY, (event: AgentActivityWireEvent) => {
      console.log(`${logPrefix} Received AGENT_ACTIVITY`, event);

      if (event.payload.threadId !== threadId) {
        console.log(`${logPrefix} Ignoring AGENT_ACTIVITY for different thread`, {
          incomingThreadId: event.payload.threadId,
          expectedThreadId: threadId,
        });
        return;
      }

      console.log(`${logPrefix} Updating agent activity`, {
        kind: event.payload.kind,
      });
      setAgentActivity(event.payload.kind);
      scheduleActivityReset();
    });

    setSocket(newSocket);

    return () => {
      console.log(`${logPrefix} Cleaning up websocket`, {
        socketId: newSocket.id ?? null,
      });
      console.log(`${logPrefix} Sending threads.unsubscribe`, { threadId });
      newSocket.emit('threads.unsubscribe', { threadId });
      if (activityTimeoutRef.current) {
        console.log(`${logPrefix} Clearing activity timeout on cleanup`);
        clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = null;
      }
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
    agentActivity,
    sendMessage,
  };
};
