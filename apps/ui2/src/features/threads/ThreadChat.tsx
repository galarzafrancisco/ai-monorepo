import { useState, useEffect, useRef } from "react";
import { Text, Button } from "../../ui/primitives";
import { useThread } from "./useThread";
import "./ThreadChat.css";

interface ThreadChatProps {
  threadId: string;
}

export function ThreadChat({ threadId }: ThreadChatProps) {
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, chatIsSending, chatIsLoading } = useThread(threadId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || chatIsSending) return;
    try {
      const message = await sendMessage(newMessage);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // TODO: optimistic UI. Show the message we just sent. Right now we only show it if the websocket plays it back which I guess it's ok but slow
  
  if (chatIsLoading) {
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
          disabled={chatIsSending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(e);
            }
          }}
        />
        <Button type="submit" disabled={!newMessage.trim() || chatIsSending}>
          {chatIsSending ? "Sending..." : "Send"}
        </Button>
      </form>
    </div>
  );
}
