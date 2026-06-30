"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Message,
  MessageContent,
  MessageGroup,
} from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { useChat as useAiChat, UIMessage } from "@ai-sdk/react";
import { toast } from "sonner";

type ActiveContext = {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  resetNonce: number;
  newChat: () => void;
};

const ChatContext = createContext<ActiveContext | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resetNonce, setResetNonce] = useState(0);
  const newChat = () => {
    setActiveId(null);
    setResetNonce((n) => n + 1);
  };
  return (
    <ChatContext.Provider
      value={{ activeId, setActiveId, resetNonce, newChat }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}

function ChatMessages({ messages }: { messages: UIMessage[] }) {
  return (
    <MessageGroup>
      {messages.map((message) => {
        const isUser = message.role === "user";
        return (
          <Message key={message.id} align={isUser ? "end" : "start"}>
            <MessageContent>
              {message.parts.map((part, i) => {
                if (part.type !== "text") return null;
                return (
                  <Bubble
                    key={`${message.id}-${i}`}
                    align={isUser ? "end" : "start"}
                    variant={isUser ? "default" : "muted"}
                  >
                    <BubbleContent className="whitespace-pre-wrap">
                      {part.text}
                    </BubbleContent>
                  </Bubble>
                );
              })}
            </MessageContent>
          </Message>
        );
      })}
    </MessageGroup>
  );
}

export function ChatPanel() {
  const { activeId, resetNonce } = useChat();
  const [value, setValue] = useState("");
  const [convId, setConvId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const messagesRef = useRef<UIMessage[]>([]);
  const convIdRef = useRef<string | null>(null);
  const { messages, sendMessage, setMessages, stop } = useAiChat({
    id: activeId ?? "chat-new",
    onFinish: ({ message }) => {
      const last = messagesRef.current.find((m) => m.id === message.id);
      if (!last) messagesRef.current = [...messagesRef.current, message];

      const cid = convIdRef.current;
      if (cid) {
        fetch(`/api/conversations/${cid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: messagesRef.current }),
          keepalive: true,
        }).catch(() => {});
      }
    },
  });
  useEffect(() => {
    convIdRef.current = convId;
  }, [convId]);

  useEffect(() => {
    if (!activeId) return;
    stop();
    fetch(`/api/conversations/${activeId}`)
      .then((res) => res.json())
      .then((conv) => {
        setMessages(conv.messages ?? []);
        setConvId(activeId);
        setHasStarted(true);
      })
      .catch(() => {
        toast.error("加载对话失败");
      });
  }, [activeId]);

  useEffect(() => {
    if (resetNonce === 0) return;
    stop();
    setMessages([]);
    setConvId(null);
    setHasStarted(false);
  }, [resetNonce]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    const userInput = value;
    setValue("");
    let id = convId;
    if (!id) {
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: userInput.slice(0, 20) }),
        });
        const conv = (await res.json()) as { id: string };
        id = conv.id;
        setConvId(id);
      } catch {
        toast.error("创建对话失败");
        return;
      }
    }

    setHasStarted(true);
    await sendMessage({ text: userInput });
  };

  // beforeunload 兜底:把当前 messages PUT 到后端
  useEffect(() => {
    if (!convId) return;
    const handler = () => {
      const list = messagesRef.current;
      if (!list.length) return;
      const blob = new Blob([JSON.stringify({ messages: list })], {
        type: "application/json",
      });
      navigator.sendBeacon(`/api/conversations/${convId}`, blob);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [convId]);

  // 没选任何对话
  if (activeId === null) {
    // 未发送:输入框相对整个 viewport 居中
    if (!hasStarted) {
      return (
        <div className="flex h-svh w-full flex-col items-center justify-center pt-14 mb-40">
          <h1 className="mb-8 text-4xl text-center font-bold tracking-tight">
            Superblog
          </h1>
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4"
          >
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="输入消息,Enter 发送"
              className="h-12 flex-1"
            />
            {value.trim() ? (
              <Button type="submit" size="icon" className="h-12 w-12">
                <Send className="h-4 w-4" />
                <span className="sr-only">发送</span>
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-12 w-12"
              >
                <Square className="h-4 w-4" />
                <span className="sr-only">语音输入</span>
              </Button>
            )}
          </form>
        </div>
      );
    }

    // 已发送:消息流从 header 下方开始,输入框在 flex 容器底部
    return (
      <div className="flex h-svh w-full flex-col pt-14">
        <div className="flex-1 overflow-y-auto px-4 pt-6">
          <div className="mx-auto max-w-2xl">
            <ChatMessages messages={messages} />
          </div>
        </div>

        <div className="bg-background px-4 pt-2">
          <form
            onSubmit={handleSubmit}
            className={
              hasStarted
                ? `mx-auto flex w-full max-w-2xl mb-9  items-center gap-2`
                : "mx-auto flex w-full max-w-2xl   items-center gap-2"
            }
          >
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="输入消息,Enter 发送"
              className="h-12 flex-1"
            />
            {value.trim() ? (
              <Button type="submit" size="icon" className="h-12 w-12">
                <Send className="h-4 w-4" />
                <span className="sr-only">发送</span>
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-12 w-12"
              >
                <Square className="h-4 w-4" />
                <span className="sr-only">语音输入</span>
              </Button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // 选中对话:消息流 + 底部输入框(在 header 下方,不再 absolute)
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl mt-20">
          <h2 className="mb-2 text-xl font-semibold">对话 {activeId}</h2>
          <div>
            <ChatMessages messages={messages} />
            {!messages.length && (
              <p className="text-muted-foreground text-sm">开始聊天…</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-background p-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-center gap-2"
        >
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="输入消息,Enter 发送"
            className="h-11"
          />
          {value.trim() ? (
            <Button type="submit" size="icon" className="h-11 w-11">
              <Send className="h-4 w-4" />
              <span className="sr-only">发送</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-11 w-11"
            >
              <Square className="h-4 w-4" />
              <span className="sr-only">语音输入</span>
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
