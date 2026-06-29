import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

interface AIHelpChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AIHelpChat = ({ open, onOpenChange }: AIHelpChatProps) => {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  const { panel } = usePermissions();
  const isAdminPanel = panel === 'admin';


  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !profile) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(
        `https://qqrvezuesxaappslfvrh.supabase.co/functions/v1/ai-help-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxcnZlenVlc3hhYXBwc2xmdnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNDM1NTksImV4cCI6MjA3NDcxOTU1OX0.0801HLIkQnUCbPpuFvoXhFb7BLgVsO_hjWcg7Pc6M0s',
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            role: isAdminPanel ? 'admin' : 'employee',
            language: i18n.language,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(i18n.language === 'en' 
            ? 'Too many requests. Please try again later.' 
            : 'Previše zahteva. Molimo pokušajte kasnije.');
        }
        if (response.status === 402) {
          throw new Error(i18n.language === 'en' 
            ? 'Credits needed for AI functionality.' 
            : 'Potrebno je dodati kredite za AI funkcionalnost.');
        }
        throw new Error(`HTTP ${i18n.language === 'en' ? 'error' : 'greška'}: ${response.status}`);
      }

      if (!response.body) {
        throw new Error(i18n.language === 'en' ? 'No response from server' : 'Nema odgovora od servera');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      // Add empty assistant message that will be updated
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process line by line
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.content = assistantContent;
                }
                return newMessages;
              });
            }
          } catch (parseError) {
            // Incomplete JSON, put it back
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (let raw of lines) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.content = assistantContent;
                }
                return newMessages;
              });
            }
          } catch {
            // Ignore partial leftovers
          }
        }
      }

    } catch (error) {
      console.error('Error calling AI assistant:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : (i18n.language === 'en' ? 'An error occurred. Please try again.' : 'Došlo je do greške. Molimo pokušajte ponovo.');
      setMessages(prev => {
        const filtered = prev.filter(m => !(m.role === 'assistant' && m.content === ''));
        return [...filtered, { role: 'assistant', content: errorMessage }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const exampleQuestions = i18n.language === 'en' ? {
    intro: 'Example questions:',
    orderMeal: 'How do I order a meal?',
    giveFeedback: 'How do I give feedback?',
    createMenu: 'How do I create a menu?',
    addMeal: 'How do I add a new meal?',
  } : {
    intro: 'Primeri pitanja:',
    orderMeal: 'Kako da poručim obrok?',
    giveFeedback: 'Kako da dam feedback?',
    createMenu: 'Kako da kreiram jelovnik?',
    addMeal: 'Kako da dodam novi obrok?',
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[440px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {t('navigation.aiAssistant')}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  {i18n.language === 'en' 
                    ? 'Ask me anything about using the app!' 
                    : 'Pitajte me bilo šta o upotrebi aplikacije!'}
                </p>
                <div className="mt-4 space-y-2 text-xs">
                  <p className="font-medium">{exampleQuestions.intro}</p>
                  <p>• {exampleQuestions.orderMeal}</p>
                  <p>• {exampleQuestions.giveFeedback}</p>
                  {isAdminPanel && (
                    <>
                      <p>• {exampleQuestions.createMenu}</p>
                      <p>• {exampleQuestions.addMeal}</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder={i18n.language === 'en' ? 'Enter your question...' : 'Unesite vaše pitanje...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Re-export MessageCircle for use in navigation
export { MessageCircle };
