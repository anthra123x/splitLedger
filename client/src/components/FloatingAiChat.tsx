import React, { useState, useRef, useEffect } from 'react';
import { sendAgentMessage, AgentAction, AgentChatMessage, getExportCsvUrl } from '../services/api';

interface FloatingAiChatProps {
  onNavigate: (view: 'upload' | 'detail' | 'history') => void;
  onSelectInvoiceById: (invoiceId: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: AgentAction | null;
  suggestions?: string[];
  timestamp: string;
}

const DEFAULT_SUGGESTIONS = [
  'Resumen financiero total',
  'Consultar factura de AWS',
  '¿Hay descuadres de paridad?',
  'Ir al Historial de facturas'
];

export default function FloatingAiChat({
  onNavigate,
  onSelectInvoiceById,
  isOpen,
  setIsOpen
}: FloatingAiChatProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hola. Soy **SplitLedger AI**, tu asistente contable y de navegación de SplitLedger. Puedes consultarme datos sobre tus facturas, buscar gastos por proveedor, verificar la paridad contable o pedirme que te lleve a cualquier sección.',
      suggestions: DEFAULT_SUGGESTIONS,
      timestamp: 'Ahora'
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  // Handle ESC and Cmd+J to toggle chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const historyPayload: AgentChatMessage[] = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await sendAgentMessage(text, historyPayload);
      const data = res.data;

      const aiMsg: ChatMessageItem = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        action: data.action,
        suggestions: data.suggestions && data.suggestions.length > 0 ? data.suggestions : undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessageItem = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error al procesar tu consulta: ${err.message || 'Error de conexión'}. ¿Deseas reintentar?`,
        suggestions: ['¿Cuántas facturas hay?', 'Ir al Historial'],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = (action: AgentAction) => {
    if (action.type === 'navigate_upload') {
      onNavigate('upload');
    } else if (action.type === 'navigate_history') {
      onNavigate('history');
    } else if (action.type === 'navigate_detail') {
      if (action.invoice_id) {
        onSelectInvoiceById(action.invoice_id);
      } else {
        onNavigate('detail');
      }
    } else if (action.type === 'export_csv') {
      window.location.href = getExportCsvUrl();
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: 'Conversación reiniciada. ¿En qué puedo ayudarte?',
        suggestions: DEFAULT_SUGGESTIONS,
        timestamp: 'Ahora'
      }
    ]);
  };

  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, lIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const renderedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={pIdx} className="font-semibold text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      return (
        <span key={lIdx} className="block leading-relaxed">
          {renderedParts}
        </span>
      );
    });
  };

  return (
    <>
      {/* Floating Chat Modal desplegable estilo SplitLedger */}
      {isOpen && (
        <div className="fixed bottom-22 right-6 z-50 w-[92vw] max-w-[420px] h-[580px] max-h-[82vh] bg-[#131315]/95 backdrop-blur-2xl border border-dashed border-[#444748]/60 rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden animate-pop-in">
          
          {/* Header SplitLedger */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1c1b1d] border-b border-dashed border-[#444748]/40">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#353437] border border-dashed border-[#444748]/60 text-white shadow-inner">
                <span className="material-symbols-outlined text-[16px]">splitscreen</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm tracking-tight text-white">
                    SplitLedger AI
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#201f22] border border-dashed border-[#444748]/40 text-[#c4c7c8] font-mono">
                    v2.4
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 font-mono">Agente contable & navegación</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#2a2a2c] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Reiniciar chat"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#2a2a2c] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Cerrar chat (ESC)"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>



          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 select-text">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fade-in`}
                >
                  {isUser ? (
                    <div className="bg-[#2a2a2c] text-white border border-[#444748]/50 rounded-xl px-3.5 py-2.5 text-xs max-w-[85%] shadow-sm">
                      {renderFormattedContent(msg.content)}
                      <div className="text-[9px] text-zinc-400 font-mono text-right mt-1">
                        {msg.timestamp}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#1c1b1d] text-[#e5e1e4] border border-[#444748]/40 rounded-xl p-3 text-xs max-w-[94%] shadow-md space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#444748]/20 text-[10px] font-mono text-zinc-400">
                        <span className="font-medium text-white flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[13px] text-zinc-400">splitscreen</span>
                          <span>SplitLedger AI</span>
                        </span>
                        <span>{msg.timestamp}</span>
                      </div>

                      <div className="leading-relaxed">
                        {renderFormattedContent(msg.content)}
                      </div>

                      {/* Embedded Action Button */}
                      {msg.action && (
                        <div className="mt-3 pt-2 border-t border-[#444748]/20">
                          <button
                            onClick={() => handleExecuteAction(msg.action!)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#2a2a2c] hover:bg-[#353437] text-white text-xs font-medium border border-[#444748]/60 transition-all cursor-pointer active:scale-95 shadow-sm group/btn hover:border-zinc-400"
                          >
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px] text-zinc-300">
                                {msg.action.type === 'navigate_detail'
                                  ? 'splitscreen'
                                  : msg.action.type === 'navigate_history'
                                  ? 'table_chart'
                                  : msg.action.type === 'navigate_upload'
                                  ? 'upload_file'
                                  : 'download'}
                              </span>
                              <span className="truncate">{msg.action.label}</span>
                            </div>
                            <span className="material-symbols-outlined text-[16px] group-hover/btn:translate-x-0.5 transition-transform text-zinc-400 group-hover/btn:text-white">
                              arrow_forward
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Suggestion Chips under Assistant Message */}
                  {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-w-[95%]">
                      {msg.suggestions.map((sug, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => handleSendMessage(sug)}
                          disabled={isLoading}
                          className="text-[11px] px-2.5 py-1 rounded-full bg-[#1c1b1d] hover:bg-[#2a2a2c] text-[#c4c7c8] hover:text-white border border-[#444748]/40 font-mono transition-colors active:scale-95 cursor-pointer disabled:opacity-50 text-left"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Thinking / Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[#1c1b1d] border border-[#444748]/40 text-xs text-zinc-300 max-w-[75%] animate-pulse font-mono">
                <span className="material-symbols-outlined text-[16px] animate-spin text-zinc-200">
                  sync
                </span>
                <span>SplitLedger AI procesando consulta...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Banner if initial message */}
          {messages.length === 1 && (
            <div className="px-4 py-2 border-t border-[#444748]/20 bg-[#0e0e10]">
              <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1.5">
                Consultas Rápidas
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_SUGGESTIONS.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(sug)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-[#1c1b1d] hover:bg-[#2a2a2c] text-[#c4c7c8] hover:text-white border border-[#444748]/40 font-mono transition-colors active:scale-95 cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-[#0e0e10] border-t border-dashed border-[#444748]/40 flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-2 bg-[#1c1b1d] border border-dashed border-[#444748]/50 rounded-xl px-3 py-2 focus-within:border-zinc-400 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Consultar a SplitLedger AI sobre facturas..."
                disabled={isLoading}
                className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-7 h-7 rounded-lg bg-[#353437] hover:bg-white text-zinc-200 hover:text-zinc-950 disabled:opacity-30 disabled:hover:bg-[#353437] disabled:hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer active:scale-90 shrink-0"
                title="Enviar consulta"
              >
                <span className="material-symbols-outlined text-[15px] font-bold">arrow_upward</span>
              </button>
            </div>
            <div className="flex items-center justify-between px-1 text-[10px] text-zinc-500 font-mono">
              <span>Enter para enviar</span>
              <span>ESC para cerrar</span>
            </div>
          </form>

        </div>
      )}

      {/* Floating Trigger Launcher Button en la parte inferior derecha (Estilo SplitLedger) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Cerrar SplitLedger AI' : 'Abrir SplitLedger AI'}
          className={`relative w-13 h-13 rounded-2xl flex items-center justify-center border border-dashed shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-all cursor-pointer active:scale-95 hover-lift ${
            isOpen
              ? 'bg-[#353437] text-white border-white/40'
              : 'bg-[#1c1b1d] hover:bg-[#2a2a2c] text-white border-[#444748]/60 hover:border-zinc-400'
          }`}
          title={isOpen ? 'Cerrar SplitLedger AI' : 'Abrir SplitLedger AI (⌘J)'}
        >
          <span className="material-symbols-outlined text-[22px] transition-transform duration-200">
            {isOpen ? 'close' : 'splitscreen'}
          </span>
          {!isOpen && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white opacity-90 shadow-sm"></span>
          )}
        </button>
      </div>
    </>
  );
}
