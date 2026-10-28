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
import type { TraceEntry } from '../tasks/traces/traceEntries';
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
    return { ...wireActor, type: DtoActorType.HUMAN, deletedAt: wireActor.deletedAt ?? null };
  }
  if (wireActor.type === WireActorType.AGENT) {
    return { ...wireActor, type: DtoActorType.AGENT, deletedAt: wireActor.deletedAt ?? null };
  }
  return undefined;
};

export interface UseThreadSocketResult {
  socket: Socket | null;
  isConnected: boolean;
  agentActivity: "thinking" | "tool_calling" | null;
  activityEntries: TraceEntry[];
  agentResponseStream: {
    streamId: string;
    actorId: string;
    content: string;
  } | null;
  onMessageCreated: (handler: (message: Message) => void) => void;
  /**
   * Registers a handler called each time the socket joins the thread room:
   * on the first connect and on every reconnect.
   */
  onSubscribed: (handler: (() => void) | null) => void;
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
  const [activityEntries, setActivityEntries] = useState<TraceEntry[]>([]);
  const activityTurnRef = useRef<string | null>(null);
  const [agentResponseStream, setAgentResponseStream] = useState<{
    streamId: string;
    actorId: string;
    content: string;
  } | null>(null);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageHandlerRef = useRef<((message: Message) => void) | null>(null);
  const subscribedHandlerRef = useRef<(() => void) | null>(null);

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

  const onSubscribed = useCallback((handler: (() => void) | null) => {
    subscribedHandlerRef.current = handler;
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
          subscribedHandlerRef.current?.();
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

      // The last step stays inspectable until the next turn, but stops animating.
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

      const { kind, turnId, toolCallId, toolName, input, output, failed } = event.payload;
      if (turnId && turnId !== activityTurnRef.current) {
        activityTurnRef.current = turnId;
        setActivityEntries([]);
      }
      setAgentActivity(kind === 'tool_result' ? null : kind);
      if (kind !== 'tool_result') scheduleActivityReset();
      setActivityEntries((previous) => {
        const now = new Date().toISOString();
        const last = previous.at(-1);
        const id = toolCallId ? `tool:${toolCallId}` : last?.kind === 'thinking' ? last.id : `thinking:${now}`;
        const index = previous.findIndex((entry) => entry.id === id);
        const entry: TraceEntry = {
          id,
          kind: toolCallId ? 'tool' : 'thinking',
          title: toolName ?? (toolCallId ? 'Tool call' : 'Thinking'),
          text: output ?? (index >= 0 ? previous[index].text : ''),
          input: input ?? (index >= 0 ? previous[index].input : undefined),
          status: kind === 'tool_result' ? (failed ? 'Failed' : 'Completed') : toolCallId ? 'Running' : undefined,
          events: [],
          timestamp: index >= 0 ? previous[index].timestamp : now,
        };
        if (index < 0) return [...previous, entry];
        return previous.map((item, i) => i === index ? entry : item);
      });
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
    activityEntries,
    agentResponseStream,
    onMessageCreated,
    onSubscribed,
  };
};
