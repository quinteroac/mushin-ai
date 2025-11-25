"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Sparkles, Settings, Database, HelpCircle, X } from "lucide-react";
import clsx from "clsx";
import { useRouter } from "next/navigation";

export default function StreamInput() {
  const [text, setText] = useState("");
  const [isAbsorbing, setIsAbsorbing] = useState(false);
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Derived state
  const isChatMode = text.startsWith("/ask");
  const isConfigMode = text.startsWith("/apikey");
  const isVaultMode = text.startsWith("/vault");
  const isHelpMode = text.startsWith("/help");
  
  const cleanText = isChatMode ? text.replace("/ask", "").trim() : 
                    isConfigMode ? text.replace("/apikey", "").trim() :
                    isVaultMode ? text.replace("/vault", "").trim() : text;

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      
      // Help Command
      if (isHelpMode) {
        setShowHelp(true);
        setText("");
        return;
      }
      
      // Configuration Command
      if (isConfigMode) {
        if (!cleanText) return;
        await submitApiKey(cleanText);
        return;
      }

      // Vault Command
      if (isVaultMode) {
        const query = cleanText ? `?q=${encodeURIComponent(cleanText)}` : "";
        router.push(`/vault${query}`);
        return;
      }

      if (!text.trim()) return;

      // Chat or Memory
      if (isChatMode) {
        await submitQuery(cleanText);
      } else {
        await submitMemory(text);
      }
    }
    
    // ESC to close help
    if (e.key === "Escape" && showHelp) {
      setShowHelp(false);
    }
  };

  const submitApiKey = async (input: string) => {
    setIsAbsorbing(true);
    try {
      let config: { provider?: string; api_key: string; api_base?: string; model?: string } = { api_key: "" };
      
      if (input.trim().startsWith("{")) {
        try {
          config = JSON.parse(input);
        } catch (e) {
          toast.error("Invalid JSON format");
          setIsAbsorbing(false);
          return;
        }
      } else {
        const parts = input.trim().split(/\s+/);
        
        if (parts.length === 1) {
          // Single value: assume it's just the API key (backward compatible)
          config.api_key = parts[0];
        } else {
          // Parse key=value pairs
          for (const part of parts) {
            if (part.includes("=")) {
              const [key, ...valueParts] = part.split("=");
              const value = valueParts.join("=");
              
              if (key === "provider") {
                config.provider = value.toLowerCase();
              } else if (key === "key" || key === "api_key") {
                config.api_key = value;
              } else if (key === "base" || key === "api_base") {
                config.api_base = value;
              } else if (key === "model") {
                config.model = value;
              }
            } else {
              // If no =, treat as API key (backward compatible)
              if (!config.api_key) {
                config.api_key = part;
              }
            }
          }
        }
      }
      
      if (!config.api_key) {
        toast.error("API Key is required");
        setIsAbsorbing(false);
        return;
      }
      
      const response = await fetch("http://127.0.0.1:8000/settings/apikey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to set API Key");
      }
      
      toast.success("API Key Configured");
      setText("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Invalid API Key or Server Error";
      toast.error(errorMessage);
    } finally {
      setIsAbsorbing(false);
    }
  };

  const submitMemory = async (content: string) => {
    setIsAbsorbing(true);
    setChatResponse(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));

      const response = await fetch("http://127.0.0.1:8000/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) throw new Error("Failed to save");

      setText("");
      toast.success("Memory absorbed");
    } catch (error) {
      toast.error("Failed to save memory");
      console.error(error);
    } finally {
      setIsAbsorbing(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const submitQuery = async (query: string) => {
    setIsAbsorbing(true);
    setChatResponse(null);
    
    try {
      const response = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) throw new Error("Failed to search");

      const data = await response.json();
      setChatResponse(data.answer);
    } catch (error) {
      toast.error("Brain freeze (Search failed)");
      console.error(error);
    } finally {
      setIsAbsorbing(false);
    }
  };

  const commands = [
    { cmd: "/ask [question]", desc: "Ask your second brain a question" },
    { cmd: "/apikey provider=gemini key=xxx", desc: "Configure API provider (provider=openai|gemini key=xxx or JSON)" },
    { cmd: "/vault [search]", desc: "View and manage memories (use date:YYYY-MM-DD or content keywords)" },
    { cmd: "/help", desc: "Show this help" },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto p-4 relative flex flex-col gap-8">
      {/* Help Icon */}
      <button
        onClick={() => setShowHelp(!showHelp)}
        className="absolute top-0 right-0 p-2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        title="Show help"
      >
        <HelpCircle size={20} />
      </button>

      <div className="relative">
        <AnimatePresence>
          {!isAbsorbing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, y: 20, filter: "blur(10px)" }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="w-full relative"
            >
              {/* Mode Indicator Icon */}
              <div className={clsx(
                "absolute -left-12 top-2 transition-all duration-300",
                isChatMode ? "opacity-100 text-indigo-500" : 
                isConfigMode ? "opacity-100 text-yellow-500" : 
                isVaultMode ? "opacity-100 text-emerald-500" : "opacity-0 text-muted-foreground"
              )}>
                {isChatMode ? <Sparkles size={24} /> : 
                 isConfigMode ? <Settings size={24} /> :
                 isVaultMode ? <Database size={24} /> : null}
              </div>

              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isChatMode ? "Ask your second brain..." : "What's on your mind?"}
                className={clsx(
                  "w-full bg-transparent text-3xl md:text-4xl font-light text-center focus:outline-none resize-none min-h-[120px] transition-colors duration-300",
                  isChatMode ? "text-indigo-400 placeholder:text-indigo-400/30" : 
                  isConfigMode ? "text-yellow-500 placeholder:text-yellow-500/30" : 
                  isVaultMode ? "text-emerald-500 placeholder:text-emerald-500/30" :
                  "text-foreground placeholder:text-muted-foreground/30"
                )}
                autoFocus
              />
              
              {/* Helper Hint */}
              <div className="absolute -bottom-6 w-full text-center text-xs text-muted-foreground/50">
                {isChatMode ? "Press Enter to ask" : 
                 isConfigMode ? (
                   <span>
                     Format: <span className="font-mono">provider=gemini key=xxx</span> or JSON
                   </span>
                 ) :
                 isVaultMode ? "Press Enter to open Vault" : ""}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Loading/Absorbing State Indicator */}
        {isAbsorbing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className={clsx(
              "h-2 w-2 rounded-full animate-ping",
              isChatMode ? "bg-indigo-500" : 
              isConfigMode ? "bg-yellow-500" : 
              isVaultMode ? "bg-emerald-500" : "bg-foreground/50"
            )} />
          </motion.div>
        )}
      </div>

      {/* Help Panel */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full bg-black/5 dark:bg-white/5 p-6 rounded-2xl border border-black/5 dark:border-white/5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Commands</h3>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1 hover:bg-black/5 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {commands.map((cmd, idx) => (
                <div key={idx} className="flex gap-3">
                  <code className="text-xs font-mono bg-black/10 dark:bg-white/10 px-2 py-1 rounded flex-shrink-0">
                    {cmd.cmd}
                  </code>
                  <span className="text-muted-foreground">{cmd.desc}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Response Area */}
      <AnimatePresence>
        {chatResponse && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full bg-black/5 dark:bg-white/5 p-6 rounded-2xl text-lg leading-relaxed border border-black/5 dark:border-white/5"
          >
             <p>{chatResponse}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
