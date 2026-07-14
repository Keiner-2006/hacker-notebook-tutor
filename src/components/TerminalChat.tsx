/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, ShieldAlert, AlertCircle, Sparkles, Loader, Trash2 } from 'lucide-react';
import { Notebook, NotebookItem, ChatMessage } from '../types';

interface TerminalChatProps {
  notebook: Notebook | null;
  items: NotebookItem[];
  chatHistory: ChatMessage[];
  setChatHistory: (chats: ChatMessage[]) => void;
}

export default function TerminalChat({
  notebook,
  items,
  chatHistory,
  setChatHistory,
}: TerminalChatProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusOnNotebook, setFocusOnNotebook] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scrollear al final de la conversación
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, loading]);

  // Manejar envío de mensaje
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() === '' || loading) return;

    const userMsgText = input.trim();
    setInput('');

    const newUserMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: userMsgText,
      timestamp: Date.now(),
    };

    const updatedHistory = [...chatHistory, newUserMsg];
    setChatHistory(updatedHistory);
    setLoading(true);

    try {
      // Llamar al proxy del servidor Express
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookName: notebook?.name || 'General',
          notebookDescription: notebook?.description || '',
          items: items,
          messages: updatedHistory,
          focusOnNotebook: focusOnNotebook && !!notebook,
        }),
      });

      if (!res.ok) throw new Error('Error al conectar con la IA de la terminal');
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: 'msg_' + Date.now(),
        sender: 'assistant',
        text: data.text || 'Sin respuesta del sistema.',
        timestamp: Date.now(),
      };

      setChatHistory([...updatedHistory, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        sender: 'assistant',
        text: `[ERROR_CONEXIÓN] No se pudo establecer contacto con el agente Gemini. Error: ${err.message || 'Servicio de AI apagado'}.`,
        timestamp: Date.now(),
      };
      setChatHistory([...updatedHistory, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm('¿Vaciar el historial de la terminal interactiva actual?')) {
      setChatHistory([]);
    }
  };

  return (
    <div className="bg-[#0F0F0F] border border-[#333333] rounded-md flex flex-col h-[580px] overflow-hidden shadow-md">
      {/* Cabecera de la Terminal */}
      <div className="bg-[#151515] px-4 py-3 border-b border-[#333333] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#00FF41] animate-pulse" />
          <span className="text-xs font-bold font-mono text-[#00FF41] tracking-wider">
            INTERACTIVE_SHELL_v2.5 // CONEXIÓN_IA
          </span>
        </div>

        {/* Controles de Config de IA */}
        <div className="flex items-center gap-3 text-xs font-mono">
          {/* Selector de foco (NotebookLM style!) */}
          {notebook ? (
            <button
              onClick={() => setFocusOnNotebook(!focusOnNotebook)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] cursor-pointer transition-all duration-150 ${
                focusOnNotebook
                  ? 'bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41]/40'
                  : 'bg-black text-[#666666] border-[#333333]'
              }`}
              title="Enfocar en notas del cuaderno actual (NotebookLM)"
            >
              <Sparkles className="w-3 h-3 text-[#00FF41]" />
              {focusOnNotebook ? 'MODO: CUADERNO_FOCUS (ON)' : 'MODO: GLOBAL_AI'}
            </button>
          ) : (
            <span className="text-[10px] text-terminal-amber bg-terminal-amber/10 border border-terminal-amber/20 px-2 py-0.5 rounded">
              MODO_GLOBAL (CUADERNO_DESCONECTADO)
            </span>
          )}

          <button
            onClick={handleClearHistory}
            className="p-1 text-[#666666] hover:text-[#E03E3E] hover:bg-[#E03E3E]/5 rounded transition-all"
            title="Borrar logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mensaje de Info / Contexto */}
      <div className="bg-[#0D0D0D] px-4 py-1.5 border-b border-[#222222] text-[10px] font-mono text-[#888888] flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 text-[#00FF41] shrink-0" />
        <span>
          {notebook && focusOnNotebook
            ? `SHELL_LOG: El bot tiene cargadas tus ${items.length} notas de "${notebook.name}" y responderá con base en ellas.`
            : 'SHELL_LOG: Chat general de hacking ético y ciberseguridad.'}
        </span>
      </div>

      {/* Ventana de Consola / Logs del Chat */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono bg-[#0A0A0A]">
        {chatHistory.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center text-xs text-[#888888] space-y-3 py-12">
            <ShieldAlert className="w-8 h-8 text-[#00FF41] animate-pulse" />
            <div className="max-w-xs leading-relaxed">
              <span className="text-white font-bold">CONEXIÓN ESTABLECIDA CON TUTOR_BOT</span>
              <br />
              Ingresa comandos o haz preguntas sobre ciberseguridad, técnicas de pentesting o sobre el material guardado en tu cuaderno.
            </div>
            <div className="text-[10px] text-[#666666] max-w-xs mt-3 border border-[#222222] p-2 rounded">
              ej: "¿Qué comando netcat me sirve para crear una shell reversa?" o "¿Cómo puedo optimizar mi técnica de escaneo nmap?"
            </div>
          </div>
        ) : (
          chatHistory.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col space-y-1 ${
                  isUser ? 'items-end ml-12' : 'items-start mr-12'
                }`}
              >
                {/* Cabecera del prompt */}
                <div className="text-[10px] text-[#666666] flex items-center gap-1 px-1">
                  <span>{isUser ? 'guest@local_net:~$' : 'root@terminal_tutor:~#'}</span>
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>

                {/* Texto del mensaje */}
                <div
                  className={`p-3 rounded-md font-mono text-xs whitespace-pre-wrap leading-relaxed shadow-sm border ${
                    isUser
                      ? 'bg-[#222222] border-[#333333] text-white rounded-tr-none'
                      : 'bg-[#1A1A1A] border border-[#222222] text-[#E0E0E0] rounded-tl-none'
                  }`}
                >
                  <span className={`block mb-1 text-[10px] font-bold uppercase tracking-wider ${isUser ? 'text-blue-400' : 'text-[#00FF41] underline'}`}>
                    {isUser ? 'OPERADOR:' : 'GEMINI_SHELL:'}
                  </span>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}

        {/* Indicador de carga */}
        {loading && (
          <div className="flex flex-col space-y-1 items-start mr-12">
            <div className="text-[10px] text-[#666666]">
              root@terminal_tutor:~# • [PROCESANDO_LLM...]
            </div>
            <div className="bg-[#1A1A1A] border border-[#222222] text-[#00FF41] p-3 rounded-md font-mono text-xs flex items-center gap-2">
              <Loader className="w-3.5 h-3.5 animate-spin text-[#00FF41]" />
              <span className="text-[#888888]">Decodificando buffers y analizando datos de red...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input de Comandos */}
      <form onSubmit={handleSend} className="bg-[#0F0F0F] border-t border-[#333333] p-3 flex gap-2">
        <div className="flex-1 relative flex items-center bg-[#151515] border border-[#333333] rounded px-3 py-1.5 focus-within:border-[#00FF41] transition-all">
          <span className="text-[#00FF41] font-mono text-xs select-none mr-1.5 font-bold">
            {notebook ? 'sh_prompt' : 'global_sh'} $
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder={
              notebook && focusOnNotebook
                ? 'Pregunta sobre este cuaderno...'
                : 'Escribe tu consulta de ciberseguridad aquí...'
            }
            className="w-full bg-transparent text-white outline-none font-mono text-xs placeholder-[#555555]"
          />
        </div>
        <button
          type="submit"
          disabled={loading || input.trim() === ''}
          className="bg-[#00FF41] text-black font-bold p-2.5 rounded hover:bg-[#00FF41]/90 disabled:opacity-40 shrink-0 cursor-pointer flex items-center justify-center transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
