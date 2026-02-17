import { useState, useEffect, useRef } from "react";
import { Text, Stack, Button } from "../../ui/primitives";
import { ThreadsService } from "./api";
import type { ThreadMessageResponseDto } from "@taico/client";
import "./ThreadChat.css";

interface ThreadChatProps {
  threadId: string;
}

export function ThreadChat({ threadId }: ThreadChatProps) {
  const [messages, setMessages] = useState<ThreadMessageResponseDto[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages on mount
  useEffect(() => {
    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const response = await ThreadsService.listMessages(threadId);
        setMessages(response.items);
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [threadId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const message = await ThreadsService.createMessage(threadId, newMessage);
      setMessages((prev) => [...prev, message]);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="thread-chat">
        <Text size="2" tone="muted">
          Loading messages...
        </Text>
      </div>
    );
  }

  return (
    <div className="thread-chat">
      <div className="thread-chat__messages">
        {messages.length === 0 ? (
          <Text size="2" tone="muted">
            No messages yet. Start the conversation!
          </Text>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="thread-chat__message">
              <div className="thread-chat__message-header">
                <Text size="1" weight="semibold">
                  {message.createdByActor?.displayName || "Anonymous"}
                </Text>
                <Text size="1" tone="muted">
                  {new Date(message.createdAt).toLocaleString()}
                </Text>
              </div>
              <Text size="2">{message.content}</Text>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="thread-chat__input-form" onSubmit={handleSendMessage}>
        <textarea
          className="thread-chat__input"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          rows={3}
          disabled={isSending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(e);
            }
          }}
        />
        <Button type="submit" disabled={!newMessage.trim() || isSending}>
          {isSending ? "Sending..." : "Send"}
        </Button>
      </form>
    </div>
  );
}
