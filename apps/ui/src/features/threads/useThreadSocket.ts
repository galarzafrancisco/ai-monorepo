import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getUIWebSocketUrl } from '../../config/api';
import {
  AgentActivityWireEvent,
  AgentResponseDeltaWireEvent,
  ThreadWireEvents,
  MessageCreatedWireEvent,
  Actor as ThreadWireActor,
  ActorType as WireActorType,
} from "@taico/events";
import { ActorResponseDto } from '@taico/client/v2';
import type { Message } from './types';
import { ActorType as DtoActorType } from './types';

const SOCKET_URL = getUIWebSocketUrl('/threads');

type ThreadsSubscribeAck = {
  ok: boolean;
  room?: string;
  error?: string;
};

/**
 * Converts wire actor type to DTO actor type
 */
const convertWireActorToDto = (
  wireActor: ThreadWireActor | null,
): ActorResponseDto | undefined => {
  if (!wireActor) return undefined;

  if (wireActor.type === WireActorType.HUMAN) {
    return { ...wireActor, type: DtoActorType.HUMAN };
  }
  if (wireActor.type === WireActorType.AGENT) {
    return { ...wireActor, type: DtoActorType.AGENT };
  }
  return undefined;
};

export interface UseThreadSocketResult {
  socket: Socket | null;
  isConnected: boolean;
  agentActivity: "thinking" | "tool_calling" | null;
  agentResponseStream: {
    streamId: string;
    actorId: string;
    content: string;
  } | null;
  onMessageCreated: (handler: (message: Message) => void) => void;
}

/**
 * Manages WebSocket connection and events for a thread
 * Handles:
 * - Socket lifecycle (connect, disconnect, reconnect)
 * - Subscribing to thread room
 * - Agent activity events
 * - Message creation events
 */
export const useThreadSocket = (threadId: string): UseThreadSocketResult => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [agentActivity, setAgentActivity] = useState<"thinking" | "tool_calling" | null>(null);
  const [agentResponseStream, setAgentResponseStream] = useState<{
    streamId: string;
    actorId: string;
    content: string;
  } | null>(null);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageHandlerRef = useRef<((message: Message) => void) | null>(null);

  const scheduleActivityReset = useCallback(() => {
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    activityTimeoutRef.current = setTimeout(() => {
      setAgentActivity(null);
      activityTimeoutRef.current = null;
    }, 3000);
  }, []);

  const onMessageCreated = useCallback((handler: (message: Message) => void) => {
    messageHandlerRef.current = handler;
  }, []);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      newSocket.emit('threads.subscribe', { threadId }, (ack: ThreadsSubscribeAck) => {
        if (ack.ok) {
          setIsConnected(true);
        } else {
          console.error('Failed to subscribe to thread room', { threadId, ack });
          setIsConnected(false);
        }
      });
    });

    newSocket.on('connect_error', (err) => {
      console.error('Thread websocket connect_error', {
        threadId,
        message: err.message,
      });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = null;
      }
      setAgentActivity(null);
      setAgentResponseStream(null);
    });

    // Handle new message event
    newSocket.on(ThreadWireEvents.MESSAGE_CREATED, (event: MessageCreatedWireEvent) => {
      if (event.payload.threadId !== threadId) {
        return;
      }

      // Clear agent activity when a message is created
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = null;
      }
      setAgentActivity(null);
      setAgentResponseStream((current) => {
        if (!current) {
          return current;
        }
        return current.actorId === event.payload.createdByActorId ? null : current;
      });

      // Convert wire types to DTO types
      const createdByActorDto = convertWireActorToDto(event.payload.createdByActor);
      const incomingMessage: Message = {
        ...event.payload,
        createdByActor: createdByActorDto,
      };

      // Notify handler if registered
      if (messageHandlerRef.current) {
        messageHandlerRef.current(incomingMessage);
      }
    });

    newSocket.on(ThreadWireEvents.AGENT_ACTIVITY, (event: AgentActivityWireEvent) => {
      if (event.payload.threadId !== threadId) {
        return;
      }

      setAgentActivity(event.payload.kind);
      scheduleActivityReset();
    });

    newSocket.on(ThreadWireEvents.AGENT_RESPONSE_DELTA, (event: AgentResponseDeltaWireEvent) => {
      if (event.payload.threadId !== threadId) {
        return;
      }

      setAgentResponseStream((current) => {
        if (!current || current.streamId !== event.payload.streamId) {
          return {
            streamId: event.payload.streamId,
            actorId: event.actor.id,
            content: event.payload.delta,
          };
        }

        return {
          ...current,
          content: `${current.content}${event.payload.delta}`,
        };
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('threads.unsubscribe', { threadId });
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = null;
      }
      setAgentResponseStream(null);
      newSocket.close();
    };
  }, [threadId, scheduleActivityReset]);

  return {
    socket,
    isConnected,
    agentActivity,
    agentResponseStream,
    onMessageCreated,
  };
};
