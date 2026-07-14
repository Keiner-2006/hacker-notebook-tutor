/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Terminal, User, Cpu, AlertTriangle, LogOut } from 'lucide-react';
import { saveUserHandleForId } from '../lib/db';

interface HeaderProps {
  userId?: string;
  userHandle: string;
  setUserHandle: (h: string) => void;
  onlineCount: number;
  onLogout?: () => void;
}

export default function Header({ userId, userHandle, setUserHandle, onlineCount, onLogout }: HeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newHandle, setNewHandle] = useState(userHandle);

  const handleSave = () => {
    if (newHandle.trim() !== '') {
      let formatted = newHandle.trim();
      if (!formatted.includes('@')) {
        formatted += '@fsociety';
      }
      setUserHandle(formatted);
      if (userId) {
        saveUserHandleForId(userId, formatted);
      }
      setIsEditing(false);
    }
  };

  return (
    <header className="bg-[#0F0F0F] border border-[#333333] rounded-md p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-md">
      {/* Logotipo y Título de Terminal */}
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-[#00FF41] shadow-[0_0_8px_#00FF41] animate-pulse shrink-0"></div>
        <div>
          <h1 className="text-lg font-bold tracking-widest text-[#00FF41] flex items-center gap-2">
            HACKER_NOTEBOOK // TUTOR.AI
          </h1>
          <p className="text-[11px] text-[#888888] font-mono tracking-tight mt-0.5">
            [SYS_STATUS: ACTIVE] • SECURE_NODE_OK • GEMINI_3.5_ENGAGED
          </p>
        </div>
      </div>

      {/* Widgets y Estado del Hacker */}
      <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-xs">
        {/* Terminal Ping / Estado */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#151515] border border-[#222222] rounded text-[#888888]">
          <Cpu className="w-3.5 h-3.5 text-[#00FF41] animate-spin" />
          <span>LATENCY:</span>
          <span className="text-white font-bold">14ms</span>
        </div>

        {/* Info de Sesión del Usuario */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#151515] border border-[#222222] rounded text-[#888888]">
          <User className="w-3.5 h-3.5 text-[#00FF41]" />
          <span>OPERADOR:</span>
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="bg-black text-[#00FF41] border border-[#333333] rounded px-1.5 py-0.5 outline-none max-w-[120px] text-xs"
                autoFocus
              />
              <button 
                onClick={handleSave} 
                className="text-[#00FF41] hover:text-white px-1.5 py-0.5 border border-[#333333] rounded text-[10px]"
              >
                SAVE
              </button>
            </div>
          ) : (
            <span 
              onClick={() => setIsEditing(true)} 
              className="text-[#00FF41] hover:underline cursor-pointer border-b border-dashed border-[#00FF41]/40"
              title="Click para cambiar alias"
            >
              {userHandle}
            </span>
          )}
        </div>

        {/* Banner Ético de Advertencia */}
        <div className="hidden lg:flex items-center gap-1.5 text-terminal-amber px-3 py-1.5 bg-terminal-amber/5 border border-terminal-amber/20 rounded">
          <AlertTriangle className="w-3.5 h-3.5 text-terminal-amber" />
          <span className="font-bold text-[10px]">ETHICAL_PENTEST_ONLY</span>
        </div>

        {/* Botón de Cerrar Sesión */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-terminal-red/10 border border-terminal-red/30 rounded text-terminal-red hover:bg-terminal-red/20 transition-all cursor-pointer font-bold"
            title="Desconectar consola segura"
          >
            <LogOut className="w-3.5 h-3.5 text-terminal-red" />
            <span>DISCONNECT</span>
          </button>
        )}
      </div>
    </header>
  );
}
