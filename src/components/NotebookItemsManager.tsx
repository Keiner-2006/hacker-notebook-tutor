/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Tag, 
  Bookmark, 
  Code, 
  ShieldAlert,
  Loader,
  HelpCircle,
  FileText
} from 'lucide-react';
import { Notebook, NotebookItem, NotebookItemType } from '../types';

interface NotebookItemsManagerProps {
  notebook: Notebook;
  items: NotebookItem[];
  onAddItem: (item: Omit<NotebookItem, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateItem: (itemId: string, item: Partial<Omit<NotebookItem, 'id' | 'createdAt'>>) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
}

export default function NotebookItemsManager({
  notebook,
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: NotebookItemsManagerProps) {
  // Estados para Filtro y Búsqueda
  const [activeTab, setActiveTab] = useState<'all' | NotebookItemType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Estados de interfaz de agregación manual
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualType, setManualType] = useState<NotebookItemType>('note');
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualSyntax, setManualSyntax] = useState('');
  const [manualTags, setManualTags] = useState('');

  // Estados de IA Auto-Organización (NotebookLM Style)
  const [showAiForm, setShowAiForm] = useState(false);
  const [rawText, setRawText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    items: Array<{
      type: NotebookItemType;
      title: string;
      content: string;
      syntax?: string;
      tags: string[];
    }>;
  } | null>(null);
  const [selectedAiItems, setSelectedAiItems] = useState<Record<number, boolean>>({});

  // Estado para copiar comandos
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Estado de edición de nota existente
  const [editingItem, setEditingItem] = useState<NotebookItem | null>(null);

  // Estado para expandir/colapsar notas individuales
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Resetear estados al cambiar de drive/cuaderno
  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // Filtrado y Búsqueda
  const allTags = Array.from(new Set(items.flatMap(i => i.tags || [])));

  const filteredItems = items.filter(item => {
    const matchesTab = activeTab === 'all' || item.type === activeTab;
    const matchesTag = !selectedTag || item.tags.includes(selectedTag);
    const text = `${item.title} ${item.content} ${item.syntax || ''} ${item.tags.join(' ')}`.toLowerCase();
    const matchesSearch = text.includes(searchQuery.toLowerCase());
    return matchesTab && matchesTag && matchesSearch;
  });

  // Copiar sintaxis al portapapeles
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Manejar creación manual
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualTitle.trim() === '' || manualContent.trim() === '') return;

    const tagsArray = manualTags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t !== '');

    await onAddItem({
      notebookId: notebook.id,
      type: manualType,
      title: manualTitle.trim(),
      content: manualContent.trim(),
      syntax: manualSyntax.trim() || undefined,
      tags: tagsArray,
    });

    // Resetear formulario
    setManualTitle('');
    setManualContent('');
    setManualSyntax('');
    setManualTags('');
    setShowManualForm(false);
  };

  // Procesar notas con IA automática (Gemini auto-organize API)
  const handleAiOrganize = async () => {
    if (rawText.trim() === '') return;
    try {
      setAiLoading(true);
      setAiResult(null);
      setSelectedAiItems({});
      const res = await fetch('/api/gemini/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });

      if (!res.ok) throw new Error('Error al organizar con Gemini');
      const data = await res.json();
      
      let parsedItems: any[] = [];
      if (data.items && Array.isArray(data.items)) {
        parsedItems = data.items;
      } else if (data.type) {
        parsedItems = [data];
      } else {
        throw new Error('Formato devuelto desconocido');
      }

      setAiResult({ items: parsedItems });
      
      const initialSelection: Record<number, boolean> = {};
      parsedItems.forEach((_, idx) => {
        initialSelection[idx] = true;
      });
      setSelectedAiItems(initialSelection);
    } catch (err) {
      console.error(err);
      alert('Error de conexión o fallo en la IA al organizar. Asegúrate de que el backend esté listo.');
    } finally {
      setAiLoading(false);
    }
  };

  // Guardar resultado de IA
  const handleSaveAiResult = async () => {
    if (!aiResult || !aiResult.items) return;
    const itemsToSave = aiResult.items.filter((_, idx) => selectedAiItems[idx]);
    if (itemsToSave.length === 0) {
      alert('Por favor, selecciona al menos un elemento para guardar.');
      return;
    }

    try {
      setAiLoading(true);
      for (const item of itemsToSave) {
        await onAddItem({
          notebookId: notebook.id,
          type: item.type,
          title: item.title,
          content: item.content,
          syntax: item.syntax,
          tags: item.tags,
        });
      }
      setAiResult(null);
      setSelectedAiItems({});
      setRawText('');
      setShowAiForm(false);
    } catch (err) {
      console.error(err);
      alert('Error al guardar las notas procesadas.');
    } finally {
      setAiLoading(false);
    }
  };

  // Guardar edición
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const tagsArray = typeof editingItem.tags === 'string'
      ? (editingItem.tags as string).split(',').map((t: string) => t.trim().toLowerCase()).filter((t: string) => t !== '')
      : editingItem.tags;

    await onUpdateItem(editingItem.id, {
      title: editingItem.title,
      content: editingItem.content,
      type: editingItem.type,
      syntax: editingItem.syntax,
      tags: tagsArray,
    });
    setEditingItem(null);
  };

  return (
    <div className="space-y-4">
      {/* Botonera de Acción Principal y Buscador */}
      <div className="glow-border bg-terminal-dark/95 p-4 rounded-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
          <div>
            <h3 className="text-md font-bold tracking-wider text-terminal-green glow-text uppercase">
              NOTAS Y APUNTES // DRIVE: {notebook.name}
            </h3>
            <p className="text-[11px] text-terminal-green-dim font-mono">
              Registra comandos (nmap, netcat), metodologías de hacking ético o teoría.
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto text-xs">
            {/* Auto-Organizador con Gemini */}
            <button
              onClick={() => {
                setShowAiForm(!showAiForm);
                setShowManualForm(false);
              }}
              className="flex items-center gap-1.5 bg-terminal-green text-terminal-black font-extrabold px-3 py-1.5 rounded hover:bg-terminal-green-bright shadow-[0_0_8px_rgba(0,255,102,0.3)] transition-all animate-pulse"
            >
              <Sparkles className="w-3.5 h-3.5" /> IA_AUTO_ORGANIZE
            </button>

            <button
              onClick={() => {
                setShowManualForm(!showManualForm);
                setShowAiForm(false);
              }}
              className="flex items-center gap-1 bg-terminal-gray border border-terminal-green hover:bg-terminal-green/10 text-terminal-green px-3 py-1.5 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> AGREGAR_MANUAL
            </button>
          </div>
        </div>

        {/* Buscador de consola */}
        <div className="relative flex items-center bg-terminal-black border border-terminal-green-dim/30 rounded px-2.5 py-1.5 text-xs">
          <Search className="w-4 h-4 text-terminal-green-dim shrink-0 mr-2" />
          <input
            type="text"
            placeholder="[BUSCAR_EN_EL_CUADERNO_COMMAND] (ej. nmap, recon, buffer overflow...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-terminal-green outline-none placeholder-terminal-green-dim/40 font-mono"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-terminal-red/70 hover:text-terminal-red text-[10px] font-mono font-bold ml-1.5">
              CLEAR
            </button>
          )}
        </div>
      </div>

      {/* PANEL IA AUTO-ORGANIZAR (NotebookLM style) */}
      {showAiForm && (
        <div className="glow-border-amber bg-terminal-dark/95 p-4 rounded-lg border border-terminal-amber animate-fadeIn">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-terminal-amber/30">
            <Sparkles className="w-5 h-5 text-terminal-amber animate-pulse glow-text-amber" />
            <h4 className="text-xs font-bold font-mono text-terminal-amber tracking-widest uppercase">
              IA_PROCESS_TERMINAL // SISTEMA AUTO-ORGANIZADOR DE NOTAS
            </h4>
          </div>
          <p className="text-[11px] text-terminal-amber/80 font-mono mb-3 leading-relaxed">
            Pega tus apuntes rápidos en español, un output de terminal, logs o comandos mezclados. Gemini analizará tu texto libre, le asignará un tipo (Concepto, Comando o Técnica), estructurará la explicación en Markdown, extraerá la sintaxis clave y generará etiquetas inteligentes de búsqueda.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Texto Crudo */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono text-terminal-amber font-bold">[ENTRADA_TEXTO_LIBRE]</label>
              <textarea
                placeholder="ej: para escanear puertos de forma rápida con nmap usas nmap -F <ip>. Esto hace un escaneo rápido de los 100 puertos más comunes en lugar de los 1000 normales. me sirve para un análisis preliminar rápido en pentesting."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full h-44 bg-terminal-black text-terminal-amber border border-terminal-amber/40 rounded p-2 text-xs outline-none focus:border-terminal-amber font-mono"
              />
              <button
                onClick={handleAiOrganize}
                disabled={aiLoading || rawText.trim() === ''}
                className="bg-terminal-amber/20 text-terminal-amber border border-terminal-amber font-bold py-1.5 rounded hover:bg-terminal-amber/35 disabled:opacity-40 transition-all font-mono text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                {aiLoading ? (
                  <>
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                    PROCESANDO_CON_GEMINI_LLM...
                  </>
                ) : (
                  'ORGANIZAR_AUTOMATICAMENTE'
                )}
              </button>
            </div>

            {/* Resultado Estructurado */}
            <div className="flex flex-col gap-2 bg-terminal-black p-3 rounded border border-terminal-green-dim/20 min-h-[220px] justify-between max-h-[380px] overflow-y-auto">
              <div>
                <div className="flex items-center justify-between mb-2 pb-1 border-b border-terminal-green-dim/10">
                  <label className="text-[10px] font-mono text-terminal-green font-bold block">[SYS_PARSER_OUTPUT_PREVIEW]</label>
                  {aiResult && aiResult.items && (
                    <span className="text-[9px] text-terminal-green bg-terminal-green/10 px-1.5 py-0.5 rounded border border-terminal-green-dim/30">
                      {aiResult.items.filter((_, idx) => selectedAiItems[idx]).length} / {aiResult.items.length} SELECCIONADOS
                    </span>
                  )}
                </div>

                {aiResult && aiResult.items && aiResult.items.length > 0 ? (
                  <div className="space-y-3 font-mono text-xs">
                    {aiResult.items.map((item, idx) => {
                      const isSelected = !!selectedAiItems[idx];
                      let itemIcon = '📝';
                      if (item.type === 'command') itemIcon = '💻';
                      if (item.type === 'technique') itemIcon = '🎯';

                      return (
                        <div 
                          key={idx} 
                          className={`p-2.5 rounded border transition-all ${
                            isSelected 
                              ? 'border-terminal-green bg-terminal-green/5' 
                              : 'border-terminal-green-dim/10 bg-terminal-black/40 opacity-50'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedAiItems(prev => ({
                                  ...prev,
                                  [idx]: !prev[idx]
                                }));
                              }}
                              className="mt-1 accent-terminal-green cursor-pointer shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono uppercase font-bold ${
                                  item.type === 'command' 
                                    ? 'text-terminal-green border-terminal-green/30 bg-terminal-green/5' 
                                    : item.type === 'technique' 
                                      ? 'text-terminal-amber border-terminal-amber/30 bg-terminal-amber/5' 
                                      : 'text-white border-terminal-green-dim/20 bg-terminal-gray/15'
                                }`}>
                                  {itemIcon} {item.type}
                                </span>
                              </div>
                              <h5 className="font-bold text-white text-[11px] mb-1">{item.title}</h5>
                              
                              {item.syntax && (
                                <div className="mb-1.5 px-2 py-1 bg-terminal-gray border border-terminal-green-dim/25 rounded text-[10px] text-terminal-green-bright font-mono overflow-x-auto">
                                  <code>{item.syntax}</code>
                                </div>
                              )}
                              
                              <p className="text-[10px] text-terminal-green-dim/90 leading-relaxed whitespace-pre-wrap bg-terminal-gray/10 p-1.5 rounded border border-terminal-green-dim/5">
                                {item.content}
                              </p>

                              {item.tags && item.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {item.tags.map(tag => (
                                    <span key={tag} className="text-[9px] text-terminal-green-dim/80 bg-terminal-green/5 px-1 rounded border border-terminal-green-dim/10">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-terminal-green-dim/40 italic flex flex-col items-center justify-center py-12 text-center">
                    <HelpCircle className="w-8 h-8 mb-2 opacity-50" />
                    Ningún análisis disponible.
                    <br />
                    Ingresa tu texto en el panel izquierdo y presiona procesar.
                  </div>
                )}
              </div>

              {aiResult && (
                <div className="flex justify-end gap-2 text-xs pt-2 border-t border-terminal-green-dim/20 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAiResult(null);
                      setSelectedAiItems({});
                    }}
                    className="text-terminal-red hover:underline px-2 py-1 cursor-pointer font-bold font-mono"
                  >
                    DISCARD
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAiResult}
                    className="bg-terminal-green text-terminal-black font-extrabold px-3 py-1 rounded hover:bg-terminal-green-bright cursor-pointer font-mono"
                  >
                    COMMIT_SELECTED_TO_NOTEBOOK
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FORMULARIO AGREGAR MANUAL */}
      {showManualForm && (
        <form onSubmit={handleManualSubmit} className="glow-border bg-terminal-dark/95 p-4 rounded-lg space-y-3 border border-terminal-green animate-fadeIn text-xs">
          <div className="text-xs text-terminal-green font-mono font-bold">[AGREGAR_APUNTE_MANUAL]</div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-terminal-green-dim mb-1 font-mono">TIPO DE CONTENIDO:</label>
              <select
                value={manualType}
                onChange={(e) => setManualType(e.target.value as NotebookItemType)}
                className="w-full bg-terminal-black text-terminal-green border border-terminal-green-dim/40 rounded p-1.5 outline-none focus:border-terminal-green"
              >
                <option value="note">Teoría / Notas Conceptuales (note)</option>
                <option value="command">Comando de Consola (command)</option>
                <option value="technique">Técnica de Pentesting / Exploit (technique)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-terminal-green-dim mb-1 font-mono">TÍTULO DEL APUNTE:</label>
              <input
                type="text"
                required
                placeholder="ej: Escaneo Sutil con Nmap (SYN Scan)"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="w-full bg-terminal-black text-terminal-green border border-terminal-green-dim/40 rounded p-1.5 outline-none focus:border-terminal-green"
              />
            </div>
          </div>

          {manualType === 'command' && (
            <div>
              <label className="block text-[10px] text-terminal-green-dim mb-1 font-mono">SINTAXIS DEL COMANDO (EJECUTABLE):</label>
              <input
                type="text"
                placeholder="ej: nmap -sS -Pn -p- <IP_OBJETIVO>"
                value={manualSyntax}
                onChange={(e) => setManualSyntax(e.target.value)}
                className="w-full bg-terminal-black text-terminal-green border border-terminal-green-dim/40 rounded p-1.5 outline-none focus:border-terminal-green font-mono text-terminal-green-bright"
              />
            </div>
          )}

          {manualType === 'technique' && (
            <div>
              <label className="block text-[10px] text-terminal-green-dim mb-1 font-mono font-bold">PASOS CLAVE / SINTAXIS ASOCIADA (OPCIONAL):</label>
              <input
                type="text"
                placeholder="ej: 1. Recon 2. Escaneo 3. Explotación"
                value={manualSyntax}
                onChange={(e) => setManualSyntax(e.target.value)}
                className="w-full bg-terminal-black text-terminal-green border border-terminal-green-dim/40 rounded p-1.5 outline-none focus:border-terminal-green font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] text-terminal-green-dim mb-1 font-mono">DESCRIPCIÓN / EXPLICACIÓN EN MARKDOWN:</label>
            <textarea
              required
              placeholder="Escribe la explicación detallada, los parámetros del comando, advertencias o ejemplos prácticos en formato Markdown..."
              value={manualContent}
              onChange={(e) => setManualContent(e.target.value)}
              className="w-full h-28 bg-terminal-black text-terminal-green border border-terminal-green-dim/40 rounded p-1.5 outline-none focus:border-terminal-green font-mono resize-y"
            />
          </div>

          <div>
            <label className="block text-[10px] text-terminal-green-dim mb-1 font-mono">ETIQUETAS / TAGS (SEPARADOS POR COMAS):</label>
            <input
              type="text"
              placeholder="ej: nmap, recon, network, portscan, active"
              value={manualTags}
              onChange={(e) => setManualTags(e.target.value)}
              className="w-full bg-terminal-black text-terminal-green border border-terminal-green-dim/40 rounded p-1.5 outline-none focus:border-terminal-green font-mono"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowManualForm(false)}
              className="text-terminal-red hover:underline px-3 py-1 font-mono"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="bg-terminal-green text-terminal-black font-bold px-4 py-1.5 rounded hover:bg-terminal-green-bright font-mono transition-colors"
            >
              COMMIT_ITEM
            </button>
          </div>
        </form>
      )}

      {/* FORMULARIO DE EDICIÓN */}
      {editingItem && (
        <form onSubmit={handleSaveEdit} className="glow-border bg-terminal-dark/95 p-4 rounded-lg space-y-3 border border-terminal-amber animate-fadeIn text-xs">
          <div className="text-xs text-terminal-amber font-mono font-bold">[EDITAR_APUNTE_EXISTENTE]</div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-terminal-green-dim mb-1">TIPO:</label>
              <select
                value={editingItem.type}
                onChange={(e) => setEditingItem({ ...editingItem, type: e.target.value as NotebookItemType })}
                className="w-full bg-terminal-black text-terminal-green border border-terminal-green-dim/40 rounded p-1.5 outline-none focus:border-terminal-green font-mono"
              >
                <option value="note">Teoría / Nota (note)</option>
                <option value="command">Comando de Consola (command)</option>
                <option value="technique">Técnica (technique)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-terminal-green-dim mb-1">TÍTULO:</label>
              <input
                type="text"
                required
                value={editingItem.title}
                onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                className="w-full bg-terminal-black text-terminal-green border border-terminal-green-dim/40 rounded p-1.5 outline-none focus:border-terminal-green font-mono"
              />
            </div>
          </div>

          {(editingItem.type === 'command' || editingItem.type === 'technique') && (
            <div>
              <label className="block text-[10px] text-terminal-green-dim mb-1">SINTAXIS / EJEMPLO:</label>
              <input
                type="text"
                value={editingItem.syntax || ''}
                onChange={(e) => setEditingItem({ ...editingItem, syntax: e.target.value })}
                className="w-full bg-terminal-black text-terminal-green border border-terminal-green-dim/40 rounded p-1.5 outline-none focus:border-terminal-green font-mono text-terminal-green-bright"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] text-terminal-green-dim mb-1">CONTENIDO (MARKDOWN):</label>
            <textarea
              required
              value={editingItem.content}
              onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
              className="w-full h-32 bg-terminal-black text-terminal-green border border-terminal-green-dim/40 rounded p-1.5 outline-none focus:border-terminal-green font-mono resize-y"
            />
          </div>

          <div>
            <label className="block text-[10px] text-terminal-green-dim mb-1">TAGS (SEPARADOS POR COMAS):</label>
            <input
              type="text"
              value={Array.isArray(editingItem.tags) ? editingItem.tags.join(', ') : editingItem.tags}
              onChange={(e) => setEditingItem({ ...editingItem, tags: e.target.value as any })}
              className="w-full bg-terminal-black text-terminal-green border border-terminal-green-dim/40 rounded p-1.5 outline-none focus:border-terminal-green font-mono"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className="text-terminal-red hover:underline px-3 py-1 font-mono"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="bg-terminal-amber text-terminal-black font-bold px-4 py-1.5 rounded hover:bg-terminal-amber/80 font-mono transition-colors"
            >
              SAVE_CHANGES
            </button>
          </div>
        </form>
      )}

      {/* FILTROS DE TIPO Y TAGS */}
      <div className="flex flex-col gap-2.5 font-mono text-xs">
        {/* Pestañas de Tipo */}
        <div className="flex flex-wrap gap-2 border-b border-terminal-green-dim/20 pb-2">
          {(['all', 'note', 'command', 'technique'] as const).map(tab => {
            const isSelected = activeTab === tab;
            let label = tab === 'all' ? '[MOSTRAR_TODO]' : `[${tab.toUpperCase()}]`;
            let color = 'text-terminal-green border-terminal-green-dim/30';
            if (isSelected) color = 'bg-terminal-green text-terminal-black font-bold border-terminal-green shadow-[0_0_6px_rgba(0,255,102,0.2)]';

            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedTag(null);
                }}
                className={`px-3 py-1 rounded border text-[11px] cursor-pointer transition-all duration-150 ${color}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Nube de Tags */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center bg-terminal-dark p-2.5 rounded border border-terminal-green-dim/10">
            <Tag className="w-3.5 h-3.5 text-terminal-green-dim mr-1 shrink-0" />
            <span className="text-[10px] text-terminal-green-dim/80 mr-1.5">TAGS_RAPIDOS:</span>
            {allTags.map(tag => {
              const isSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(isSelected ? null : tag)}
                  className={`text-[10px] px-2 py-0.5 rounded border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-terminal-green/25 text-terminal-green border-terminal-green'
                      : 'bg-terminal-black/50 text-terminal-green-dim border-terminal-green-dim/20 hover:border-terminal-green-dim/50 hover:text-terminal-green'
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
            {selectedTag && (
              <button onClick={() => setSelectedTag(null)} className="text-terminal-red/80 hover:text-terminal-red text-[9px] underline ml-2">
                [X] LIMPIAR
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-[#0F0F0F] border border-[#222222] p-8 rounded-md text-center font-mono text-xs text-[#666666]">
            Ningún registro de notas coincide con los filtros aplicados.
            <br />
            Agrega contenido manual o usa la IA_AUTO_ORGANIZE para parsear apuntes rápidos.
          </div>
        ) : (
          filteredItems.map(item => {
            const isExpanded = expandedItems[item.id];
            
            // Icono según tipo
            let IconComponent = FileText;
            let typeColor = 'text-[#00FF41] border-[#00FF41]/20 bg-[#00FF41]/5';
            let typeLabel = 'Concepto';

            if (item.type === 'command') {
              IconComponent = Code;
              typeColor = 'text-[#00FF41] border-[#00FF41]/30 bg-black';
              typeLabel = 'Comando';
            } else if (item.type === 'technique') {
              IconComponent = ShieldAlert;
              typeColor = 'text-[#D9A006] border-[#D9A006]/30 bg-[#D9A006]/5';
              typeLabel = 'Técnica';
            }

            return (
              <div 
                key={item.id}
                className="bg-[#0F0F0F] rounded-md border border-[#222222] hover:border-[#333333] transition-all duration-150 shadow-sm"
              >
                {/* Header de la tarjeta */}
                <div 
                  onClick={() => toggleExpand(item.id)}
                  className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <IconComponent className={`w-4 h-4 shrink-0 ${item.type === 'command' ? 'text-[#00FF41]' : item.type === 'technique' ? 'text-[#D9A006]' : 'text-white'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono uppercase tracking-wider ${typeColor}`}>
                          {typeLabel}
                        </span>
                        <span className="text-[10px] text-[#666666] font-mono">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white group-hover:text-[#00FF41] transition-colors truncate">
                        {item.title}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Botones de acción rápida */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem({
                          ...item,
                          tags: item.tags.join(', ') as any
                        });
                      }}
                      className="p-1 text-[#666666] hover:text-[#D9A006] hover:bg-[#D9A006]/5 rounded transition-all"
                      title="Editar"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`¿Eliminar apunte de tu cuaderno: "${item.title}"?`)) {
                          onDeleteItem(item.id);
                        }
                      }}
                      className="p-1 text-[#666666] hover:text-[#E03E3E] hover:bg-[#E03E3E]/5 rounded transition-all"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[#888888]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#888888]" />
                    )}
                  </div>
                </div>

                {/* Contenido Extendido */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-[#1A1A1A] bg-black/30 text-xs font-mono animate-fadeIn space-y-3">
                    {/* Comandos / Sintaxis ejecutable */}
                    {item.syntax && (
                      <div className="bg-black border border-[#1A1A1A] rounded p-2.5 flex justify-between items-center gap-4 mt-2">
                        <code className={`overflow-x-auto select-all break-all whitespace-pre text-xs ${item.type === 'technique' ? 'text-[#D9A006]' : 'text-[#00FF41]'}`}>
                          {item.syntax}
                        </code>
                        <button
                          onClick={() => handleCopy(item.syntax!, item.id)}
                          className="shrink-0 px-2 py-1 bg-[#151515] border border-[#222222] hover:border-[#00FF41] hover:text-[#00FF41] rounded text-[#888888] text-[10px] flex items-center gap-1 transition-all"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3 h-3 text-[#00FF41]" />
                              COPIED
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              COPY
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Explicación / Descripción Markdown */}
                    <div className="text-[#E0E0E0] leading-relaxed whitespace-pre-wrap text-[11px] font-sans border-l border-[#333333] pl-3">
                      {item.content}
                    </div>

                    {/* Etiquetas */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center pt-2">
                        <Tag className="w-3.5 h-3.5 text-[#666666] mr-1" />
                        {item.tags.map(tag => (
                          <span 
                            key={tag} 
                            onClick={() => setSelectedTag(tag)}
                            className="text-[10px] text-[#00FF41] bg-[#00FF41]/5 border border-[#222222] px-1.5 py-0.2 rounded hover:border-[#00FF41] cursor-pointer"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
