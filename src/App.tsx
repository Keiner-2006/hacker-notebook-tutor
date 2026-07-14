/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Terminal, 
  Brain, 
  FileText, 
  FolderSync, 
  FolderOpen, 
  ChevronRight, 
  Activity, 
  Unlock,
  FolderGit2
} from 'lucide-react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import Login from './components/Login';
import Header from './components/Header';
import NotebookList from './components/NotebookList';
import NotebookItemsManager from './components/NotebookItemsManager';
import TerminalChat from './components/TerminalChat';
import EvaluationCenter from './components/EvaluationCenter';
import LabsManager from './components/LabsManager';
import { 
  getSavedHandleForId,
  saveUserHandleForId,
  buildFirestoreUserKey,
  migrateUserWorkspaceToEmailKey,
  getNotebooks, 
  addNotebook, 
  deleteNotebook,
  getNotebookItems,
  addNotebookItem,
  updateNotebookItem,
  deleteNotebookItem,
  getEvaluations,
  addEvaluation,
  getLabs,
  addLab,
  updateLab,
  deleteLab
} from './lib/db';
import { Notebook, NotebookItem, ChatMessage, Evaluation as EvalType, Lab } from './types';

export default function App() {
  const [userId, setUserId] = useState<string>('');
  const [rawUserId, setRawUserId] = useState<string>('');
  const [userHandle, setUserHandle] = useState<string>('');
  const [authInitialized, setAuthInitialized] = useState<boolean>(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [items, setItems] = useState<NotebookItem[]>([]);
  const [evaluations, setEvaluations] = useState<EvalType[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  // Navegación de secciones dentro de la unidad de cuaderno activa
  const [activeTab, setActiveTab] = useState<'notes' | 'chat' | 'eval' | 'labs'>('notes');
  
  // Estados de carga generales
  const [loadingNotebooks, setLoadingNotebooks] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);

  // Escuchar estado de autenticación de Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setRawUserId(user.uid);
        const normalizedUserId = await migrateUserWorkspaceToEmailKey(user.uid, user.email);
        setUserId(normalizedUserId);
        const savedHandle = getSavedHandleForId(normalizedUserId);
        setUserHandle(savedHandle);
      } else {
        setRawUserId('');
        setUserId('');
        setUserHandle('');
      }
      setAuthInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  // Cargar Drives (Notebooks) cuando hay un operador autenticado
  useEffect(() => {
    if (!userId) {
      setNotebooks([]);
      setSelectedNotebook(null);
      setLoadingNotebooks(false);
      return;
    }

    const mergeNotebooks = (primary: Notebook[], fallback: Notebook[]) => {
      const merged = [...primary];
      for (const notebook of fallback) {
        if (!merged.some((item) => item.id === notebook.id)) {
          merged.push(notebook);
        }
      }
      return merged.sort((a, b) => b.createdAt - a.createdAt);
    };

    const fetchDrives = async () => {
      try {
        setLoadingNotebooks(true);
        const primary = await getNotebooks(userId);
        let data = primary;

        if (rawUserId && rawUserId !== userId) {
          const fallback = await getNotebooks(rawUserId);
          data = mergeNotebooks(primary, fallback);
        }

        setNotebooks(data);
        if (data.length > 0) {
          setSelectedNotebook(data[0]);
        } else {
          setSelectedNotebook(null);
        }
      } catch (err) {
        console.error('Error cargando drives:', err);
      } finally {
        setLoadingNotebooks(false);
      }
    };

    fetchDrives();
  }, [userId, rawUserId]);

  // Cargar items y evaluaciones cuando cambia el cuaderno activo
  useEffect(() => {
    if (!userId || !selectedNotebook) {
      setItems([]);
      setEvaluations([]);
      setChatHistory([]);
      return;
    }

    const fetchNotebookData = async () => {
      try {
        setLoadingItems(true);
        let fetchedItems = await getNotebookItems(userId, selectedNotebook.id);
        let fetchedEvals = await getEvaluations(userId, selectedNotebook.id);
        let fetchedLabs = await getLabs(userId, selectedNotebook.id);

        if (rawUserId && rawUserId !== userId) {
          if (fetchedItems.length === 0) {
            fetchedItems = await getNotebookItems(rawUserId, selectedNotebook.id);
          }
          if (fetchedEvals.length === 0) {
            fetchedEvals = await getEvaluations(rawUserId, selectedNotebook.id);
          }
          if (fetchedLabs.length === 0) {
            fetchedLabs = await getLabs(rawUserId, selectedNotebook.id);
          }
        }
        
        setItems(fetchedItems);
        setEvaluations(fetchedEvals);
        setLabs(fetchedLabs);
        
        // Cargar historial de chat específico del cuaderno desde LocalStorage
        const savedChat = localStorage.getItem(`chat_${selectedNotebook.id}`);
        if (savedChat) {
          try {
            setChatHistory(JSON.parse(savedChat));
          } catch (e) {
            setChatHistory([]);
          }
        } else {
          setChatHistory([]);
        }
      } catch (err) {
        console.error('Error cargando datos del drive:', err);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchNotebookData();
  }, [userId, rawUserId, selectedNotebook]);

  // Sincronizar el chat actual en LocalStorage cuando cambie
  useEffect(() => {
    if (selectedNotebook && chatHistory.length > 0) {
      localStorage.setItem(`chat_${selectedNotebook.id}`, JSON.stringify(chatHistory));
    }
  }, [chatHistory, selectedNotebook]);

  // --- CONTROLADORES DE BASE DE DATOS (CUADERNOS) ---

  const handleCreateNotebook = async (name: string, description: string) => {
    if (!userId) return;
    const newDrive = await addNotebook(userId, name, description);
    setNotebooks(prev => [newDrive, ...prev]);
    setSelectedNotebook(newDrive);
  };

  const handleDeleteNotebook = async (notebookId: string) => {
    if (!userId) return;
    await deleteNotebook(userId, notebookId);
    setNotebooks(prev => prev.filter(n => n.id !== notebookId));
    
    // Si borramos el drive seleccionado, seleccionar el primero disponible
    if (selectedNotebook?.id === notebookId) {
      const remaining = notebooks.filter(n => n.id !== notebookId);
      setSelectedNotebook(remaining.length > 0 ? remaining[0] : null);
    }
  };

  // --- CONTROLADORES DE ITEMS DE CUADERNO ---

  const handleAddItem = async (itemFields: Omit<NotebookItem, 'id' | 'createdAt'>) => {
    if (!userId || !selectedNotebook) return;
    const addedItem = await addNotebookItem(userId, selectedNotebook.id, itemFields);
    setItems(prev => [addedItem, ...prev]);
  };

  const handleUpdateItem = async (itemId: string, updatedFields: Partial<Omit<NotebookItem, 'id' | 'createdAt'>>) => {
    if (!userId || !selectedNotebook) return;
    await updateNotebookItem(userId, selectedNotebook.id, itemId, updatedFields);
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, ...updatedFields } : item));
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!userId || !selectedNotebook) return;
    await deleteNotebookItem(userId, selectedNotebook.id, itemId);
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  // --- CONTROLADORES DE EVALUACIONES ---

  const handleAddEvaluation = async (evalFields: Omit<EvalType, 'id'>) => {
    if (!userId || !selectedNotebook) throw new Error('Usuario o cuaderno no activo.');
    const addedEval = await addEvaluation(userId, selectedNotebook.id, evalFields);
    setEvaluations(prev => [addedEval, ...prev]);
    return addedEval;
  };

  // --- CONTROLADORES DE LABS ---

  const handleAddLab = async (labFields: Omit<Lab, 'id' | 'createdAt'>) => {
    if (!userId || !selectedNotebook) throw new Error('Usuario o cuaderno no activo.');
    const addedLab = await addLab(userId, selectedNotebook.id, labFields);
    setLabs(prev => [addedLab, ...prev]);
    return addedLab;
  };

  const handleUpdateLab = async (labId: string, updatedFields: Partial<Omit<Lab, 'id' | 'createdAt'>>) => {
    if (!userId || !selectedNotebook) return;
    await updateLab(userId, selectedNotebook.id, labId, updatedFields);
    setLabs(prev => prev.map(lab => lab.id === labId ? { ...lab, ...updatedFields } : lab));
  };

  const handleDeleteLab = async (labId: string) => {
    if (!userId || !selectedNotebook) return;
    await deleteLab(userId, selectedNotebook.id, labId);
    setLabs(prev => prev.filter(lab => lab.id !== labId));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  if (!authInitialized) {
    return (
      <div className="relative min-h-screen bg-terminal-black text-terminal-green flex flex-col justify-center items-center p-4 font-mono">
        <div className="crt-overlay crt-flicker pointer-events-none" />
        <FolderSync className="w-8 h-8 text-terminal-green animate-spin mb-3 glow-text" />
        <span className="text-xs">[INICIALIZANDO_ENTORNO_CRIPTOGRÁFICO...]</span>
      </div>
    );
  }

  if (!userId) {
    return <Login onAuthSuccess={(uid, handle) => {
      setUserId(uid);
      setUserHandle(handle);
    }} />;
  }

  return (
    <div className="relative min-h-screen bg-terminal-black text-terminal-green flex flex-col p-4 md:p-6 select-none font-mono">
      {/* Retro CRT Scanline overlay effect */}
      <div className="crt-overlay crt-flicker pointer-events-none" />

      {/* Header del Sistema */}
      <Header 
        userId={userId}
        userHandle={userHandle} 
        setUserHandle={setUserHandle} 
        onlineCount={notebooks.length}
        onLogout={handleLogout}
      />

      {loadingNotebooks ? (
        <div className="flex-1 flex flex-col justify-center items-center py-20 text-xs">
          <FolderSync className="w-8 h-8 text-terminal-green animate-spin mb-3 glow-text" />
          <span>[CARGANDO_DRIVES_Y_VECTORES_DE_SISTEMA...]</span>
        </div>
      ) : notebooks.length === 0 ? (
        /* PANTALLA DE BIENVENIDA / SIN CUADERNOS CONFIGURADOS */
        <div className="flex-1 max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch my-6">
          <div className="md:col-span-1">
            <NotebookList
              notebooks={notebooks}
              selectedNotebook={selectedNotebook}
              onSelectNotebook={setSelectedNotebook}
              onAddNotebook={handleCreateNotebook}
              onDeleteNotebook={handleDeleteNotebook}
            />
          </div>

          <div className="md:col-span-2 glow-border bg-terminal-dark/95 p-8 rounded-lg flex flex-col justify-center items-center text-center space-y-4">
            <div className="border border-terminal-green p-4 rounded-full bg-terminal-green/5 shadow-[0_0_15px_rgba(0,255,102,0.2)]">
              <Terminal className="w-12 h-12 text-terminal-green animate-pulse glow-text" />
            </div>
            
            <div className="max-w-md">
              <h3 className="text-sm font-bold text-terminal-green tracking-widest uppercase mb-1 flex items-center justify-center gap-1.5">
                <Unlock className="w-4 h-4 text-terminal-green" />
                ACCESO_PERMITIDO // CONSOLA_VACÍA
              </h3>
              <p className="text-xs text-terminal-green-dim leading-relaxed mb-4">
                Has ingresado a tu terminal de auto-aprendizaje. En este entorno simularás el almacenamiento de cuadernos de ciberseguridad o desarrollo en discos montados virtuales (Drives).
              </p>
              <div className="text-[11px] text-terminal-amber bg-terminal-amber/10 border border-terminal-amber/30 p-3 rounded font-sans leading-relaxed text-left">
                <strong>INSTRUCCIÓN:</strong> Para comenzar, utiliza el panel <strong>CUADERNOS_DRIVES</strong> en el costado izquierdo. Haz clic en <strong>ADD_DRIVE</strong>, ponle un título como <em>"Ciberseguridad"</em> o <em>"Desarrollo Seguro"</em>, móntalo y prepárate para registrar conocimientos con IA y realizar auto-evaluaciones con Active Recall.
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* PANTALLA DEL SISTEMA OPERATIVO PRINCIPAL */
        <div className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-4 gap-6 items-start my-1">
          
          {/* Columna Izquierda: Selector de Cuadernos y Estado de Memoria */}
          <div className="lg:col-span-1 space-y-4 self-stretch flex flex-col lg:h-[680px]">
            <NotebookList
              notebooks={notebooks}
              selectedNotebook={selectedNotebook}
              onSelectNotebook={setSelectedNotebook}
              onAddNotebook={handleCreateNotebook}
              onDeleteNotebook={handleDeleteNotebook}
            />

            {/* Widget de Telemetría Hacker (Decorativo) */}
            <div className="glow-border bg-terminal-black/80 p-3 rounded text-[10px] font-mono text-terminal-green-dim space-y-1">
              <div className="flex justify-between border-b border-terminal-green-dim/10 pb-1 mb-1.5 font-bold">
                <span>[LOG_TELEMETRY]</span>
                <span className="text-terminal-green flex items-center gap-1">
                  <Activity className="w-3 h-3 animate-pulse text-terminal-green" /> LIVE
                </span>
              </div>
              <div className="flex justify-between">
                <span>MEMORIA_SISTEMA:</span>
                <span className="text-terminal-green">412 MB / 1024 MB</span>
              </div>
              <div className="flex justify-between">
                <span>NÚCLEO_AI:</span>
                <span className="text-terminal-green">GEMINI-3.5-FLASH</span>
              </div>
              <div className="flex justify-between">
                <span>APUNTES_ACTIVOS:</span>
                <span className="text-terminal-green">{items.length} REGISTROS</span>
              </div>
              <div className="flex justify-between">
                <span>LABS_PRACTICOS:</span>
                <span className="text-terminal-green">{labs.length} MÁQUINAS</span>
              </div>
              <div className="flex justify-between">
                <span>PRUEBAS_REALIZADAS:</span>
                <span className="text-terminal-green">{evaluations.length} TESTS</span>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Panel Interactivo Multi-Sección */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Barra de Navegación Estilo Pestañas de Terminal */}
            {selectedNotebook && (
              <div className="glow-border bg-terminal-dark/95 p-2 rounded-lg flex flex-wrap gap-1 border border-terminal-green-dim/30">
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`flex-1 min-w-[120px] py-2 px-3 rounded text-xs font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    activeTab === 'notes'
                      ? 'bg-terminal-green text-terminal-black shadow-[0_0_10px_rgba(0,255,102,0.25)]'
                      : 'text-terminal-green-dim hover:text-terminal-green hover:bg-terminal-green/5'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  [01] APUNTES
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 min-w-[120px] py-2 px-3 rounded text-xs font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    activeTab === 'chat'
                      ? 'bg-terminal-green text-terminal-black shadow-[0_0_10px_rgba(0,255,102,0.25)]'
                      : 'text-terminal-green-dim hover:text-terminal-green hover:bg-terminal-green/5'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  [02] TERMINAL IA
                </button>
                <button
                  onClick={() => setActiveTab('eval')}
                  className={`flex-1 min-w-[120px] py-2 px-3 rounded text-xs font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    activeTab === 'eval'
                      ? 'bg-terminal-green text-terminal-black shadow-[0_0_10px_rgba(0,255,102,0.25)]'
                      : 'text-terminal-green-dim hover:text-terminal-green hover:bg-terminal-green/5'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5" />
                  [03] EVALUADOR DE CONOCIMIENTOS
                </button>
                <button
                  onClick={() => setActiveTab('labs')}
                  className={`flex-1 min-w-[120px] py-2 px-3 rounded text-xs font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    activeTab === 'labs'
                      ? 'bg-terminal-green text-terminal-black shadow-[0_0_10px_rgba(0,255,102,0.25)]'
                      : 'text-terminal-green-dim hover:text-terminal-green hover:bg-terminal-green/5'
                  }`}
                >
                  <FolderGit2 className="w-3.5 h-3.5" />
                  [04] REGISTRO DE LABS
                </button>
              </div>
            )}

            {/* Carga interna del Cuaderno */}
            {selectedNotebook ? (
              loadingItems ? (
                <div className="glow-border bg-terminal-dark/95 p-16 rounded-lg text-center font-mono text-xs text-terminal-green flex flex-col justify-center items-center gap-2">
                  <FolderOpen className="w-8 h-8 animate-bounce text-terminal-green" />
                  <span>[DESENCRIPTANDO_BUFFERS_DEL_DRIVE...]</span>
                </div>
              ) : (
                <div className="animate-fadeIn">
                  {activeTab === 'notes' && (
                    <NotebookItemsManager
                      notebook={selectedNotebook}
                      items={items}
                      onAddItem={handleAddItem}
                      onUpdateItem={handleUpdateItem}
                      onDeleteItem={handleDeleteItem}
                    />
                  )}
                  {activeTab === 'chat' && (
                    <TerminalChat
                      notebook={selectedNotebook}
                      items={items}
                      chatHistory={chatHistory}
                      setChatHistory={setChatHistory}
                    />
                  )}
                  {activeTab === 'eval' && (
                    <EvaluationCenter
                      notebook={selectedNotebook}
                      items={items}
                      evaluations={evaluations}
                      onAddEvaluation={handleAddEvaluation}
                    />
                  )}
                  {activeTab === 'labs' && (
                    <LabsManager
                      notebook={selectedNotebook}
                      labs={labs}
                      onAddLab={handleAddLab}
                      onUpdateLab={handleUpdateLab}
                      onDeleteLab={handleDeleteLab}
                    />
                  )}
                </div>
              )
            ) : (
              <div className="glow-border bg-terminal-dark/95 p-16 rounded-lg text-center font-mono text-xs text-terminal-green">
                SELECCIONA O MONTA UNA UNIDAD DE ALMACENAMIENTO DRIVE PARA COMENZAR EL ENTRENAMIENTO.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
