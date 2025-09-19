import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, 
  User, 
  Send, 
  MessageSquare, 
  RefreshCw,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Sparkles
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface AIAssistantChatProps {
  className?: string;
  initialMessage?: string;
  placeholder?: string;
  title?: string;
  description?: string;
}

export default function AIAssistantChat({ 
  className = "",
  initialMessage = "Hello! I'm your AI assistant. How can I help you today?",
  placeholder = "Type your message here...",
  title = "AI Assistant",
  description = "Chat with Claude AI for assistance with your tasks"
}: AIAssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: initialMessage,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // AI chat mutation
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest('/api/ai-chat', {
        method: 'POST',
        body: { message }
      });
    },
    onSuccess: (data) => {
      setMessages(prev => [
        ...prev.filter(msg => !msg.isLoading),
        {
          id: Date.now().toString(),
          type: 'assistant',
          content: data.response,
          timestamp: new Date()
        }
      ]);
      setIsTyping(false);
    },
    onError: (error) => {
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      setIsTyping(false);
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: "...",
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInputMessage("");
    setIsTyping(true);

    chatMutation.mutate(userMessage.content);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyMessageToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "Message copied to clipboard",
    });
  };

  const clearChat = () => {
    setMessages([{
      id: '1',
      type: 'assistant',
      content: initialMessage,
      timestamp: new Date()
    }]);
  };

  return (
    <Card className={`w-full max-w-4xl mx-auto h-[600px] flex flex-col ${className}`} data-testid="ai-assistant-chat">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-lg" data-testid="chat-title">
                {title}
                <Badge variant="secondary" className="text-xs">
                  Claude AI
                </Badge>
              </CardTitle>
              <CardDescription data-testid="chat-description">
                {description}
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearChat}
            data-testid="button-clear-chat"
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="messages-container">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.type === 'assistant' && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                </div>
              )}
              
              <div className={`max-w-[80%] ${message.type === 'user' ? 'order-last' : ''}`}>
                <div
                  className={`p-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  } ${message.isLoading ? 'animate-pulse' : ''}`}
                  data-testid={`message-${message.type}-${message.id}`}
                >
                  {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>AI is thinking...</span>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )}
                </div>
                
                {!message.isLoading && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>{message.timestamp.toLocaleTimeString()}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyMessageToClipboard(message.content)}
                      className="h-6 px-2"
                      data-testid={`button-copy-${message.id}`}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {message.type === 'user' && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t p-4" data-testid="chat-input-area">
          <div className="flex gap-2">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              className="min-h-[60px] resize-none"
              disabled={chatMutation.isPending}
              data-testid="input-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || chatMutation.isPending}
              className="self-end"
              data-testid="button-send"
            >
              {chatMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {isTyping && (
            <div className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span>AI is typing...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}