/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Folder, Plus, Trash2, BookOpen, AlertCircle } from 'lucide-react';
import { Notebook } from '../types';

interface NotebookListProps {
  notebooks: Notebook[];
  selectedNotebook: Notebook | null;
  onSelectNotebook: (notebook: Notebook) => void;
  onAddNotebook: (name: string, description: string) => Promise<void>;
  onDeleteNotebook: (notebookId: string) => Promise<void>;
}

export default function NotebookList({
  notebooks,
  selectedNotebook,
  onSelectNotebook,
  onAddNotebook,
  onDeleteNotebook,
}: NotebookListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() === '') return;
    try {
      setLoading(true);
      await onAddNotebook(name.trim(), description.trim());
      setName('');
      setDescription('');
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0D0D0D] border border-[#333333] p-4 rounded-md flex flex-col h-full shadow-md">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#333333]">
        <h2 className="text-xs font-bold tracking-widest text-[#E0E0E0] flex items-center gap-2 uppercase">
          <BookOpen className="w-3.5 h-3.5 text-[#00FF41]" /> CUADERNOS_DRIVES
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-[11px] font-mono font-bold flex items-center gap-1 border border-dashed border-[#444444] text-[#888888] hover:border-[#00FF41] hover:text-[#00FF41] px-2.5 py-1 rounded cursor-pointer transition-all duration-200"
        >
          <Plus className="w-3 h-3" /> ADD_DRIVE
        </button>
      </div>

      {/* Formulario para agregar cuaderno */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-[#151515] border border-[#333333] rounded flex flex-col gap-2.5 animate-fadeIn">
          <div className="text-[11px] text-[#D9A006] font-mono font-bold">[NUEVO_DRIVE_PROMPT]</div>
          <div>
            <label className="block text-[10px] text-[#888888] mb-1 uppercase tracking-wider">ID / NOMBRE DEL CUADERNO:</label>
            <input
              type="text"
              required
              placeholder="ej: Cybersecurity, Pentesting"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black text-white border border-[#333333] rounded p-1.5 text-xs outline-none focus:border-[#00FF41] transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#888888] mb-1 uppercase tracking-wider">OBJETIVO / DESCRIPCIÓN:</label>
            <textarea
              placeholder="ej: Comandos de escaneo y tácticas de red team."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-black text-white border border-[#333333] rounded p-1.5 text-xs outline-none h-14 resize-none focus:border-[#00FF41] transition-all"
            />
          </div>
          <div className="flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-[#E03E3E] hover:underline px-2 py-1 text-[11px] font-mono"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#00FF41] text-black font-bold px-3 py-1 rounded text-[11px] font-mono hover:bg-[#00FF41]/90 transition-colors"
            >
              {loading ? 'MOUNTING...' : 'MOUNT_DRIVE'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de cuadernos */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {notebooks.length === 0 ? (
          <div className="text-xs text-[#666666] italic text-center py-8">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-[#D9A006] opacity-60" />
            No hay unidades montadas.
            <br />
            <span className="text-[10px] block mt-1">Haz clic en ADD_DRIVE para crear tu primer cuaderno.</span>
          </div>
        ) : (
          notebooks.map((notebook, index) => {
            const isSelected = selectedNotebook?.id === notebook.id;
            const letter = String.fromCharCode(65 + (index % 26)); // Drive letter A, B, C...
            
            return (
              <div
                key={notebook.id}
                className={`relative group border p-2.5 rounded cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? 'border-[#333333] bg-[#1A1A1A] border-l-2 border-l-[#00FF41] shadow-inner'
                    : 'border-transparent bg-transparent hover:bg-[#151515] text-[#888888] hover:text-white'
                }`}
                onClick={() => onSelectNotebook(notebook)}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-start gap-2">
                    <Folder className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-[#00FF41]' : 'text-[#666666]'}`} />
                    <div>
                      <div className={`text-xs font-bold font-mono tracking-wide ${isSelected ? 'text-white' : 'text-[#888888] group-hover:text-white'}`}>
                        DRIVE_{letter}:/ {notebook.name.toUpperCase()}
                      </div>
                      <div className="text-[10px] text-[#666666] group-hover:text-[#888888] line-clamp-2 mt-0.5">
                        {notebook.description || 'Sin descripción del volumen.'}
                      </div>
                    </div>
                  </div>

                  {/* Eliminar unidad */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`¿Estás seguro de desmontar y eliminar la unidad DRIVE_${letter} (${notebook.name})? Se perderán todas las notas y evaluaciones.`)) {
                        onDeleteNotebook(notebook.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#E03E3E]/70 hover:text-[#E03E3E] hover:bg-[#E03E3E]/10 rounded transition-all"
                    title="Desmontar drive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
