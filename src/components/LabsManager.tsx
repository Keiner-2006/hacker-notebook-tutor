/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  FolderGit2, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  Sparkles, 
  Loader, 
  Calendar, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  ChevronRight, 
  FileText,
  Briefcase,
  X,
  AlertTriangle,
  Info,
  ExternalLink
} from 'lucide-react';
import { Notebook, Lab, Vulnerability } from '../types';

interface LabsManagerProps {
  notebook: Notebook;
  labs: Lab[];
  onAddLab: (lab: Omit<Lab, 'id' | 'createdAt'>) => Promise<Lab>;
  onUpdateLab: (labId: string, updatedFields: Partial<Omit<Lab, 'id' | 'createdAt'>>) => Promise<void>;
  onDeleteLab: (labId: string) => Promise<void>;
}

export default function LabsManager({
  notebook,
  labs,
  onAddLab,
  onUpdateLab,
  onDeleteLab
}: LabsManagerProps) {
  // Lista o Formulario
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [activeLabDetail, setActiveLabDetail] = useState<Lab | null>(null);

  // Estados del Formulario
  const [formName, setFormName] = useState('');
  const [formPlatform, setFormPlatform] = useState('HackTheBox');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState<'en_progreso' | 'completado'>('completado');
  const [formNotes, setFormNotes] = useState('');
  const [formVulnerabilities, setFormVulnerabilities] = useState<Vulnerability[]>([]);

  // Cargadores de IA
  const [loadingSuggestIdx, setLoadingSuggestIdx] = useState<number | null>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Vulnerabilidad temporal para agregar
  const [newVulnName, setNewVulnName] = useState('');

  // Iniciar creación de lab
  const handleOpenCreate = () => {
    setFormName('');
    setFormPlatform('HackTheBox');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormStatus('completado');
    setFormNotes('');
    setFormVulnerabilities([]);
    setNewVulnName('');
    setAiReport(null);
    setSelectedLabId(null);
    setIsEditing(true);
  };

  // Iniciar edición de lab
  const handleOpenEdit = (lab: Lab) => {
    setSelectedLabId(lab.id);
    setFormName(lab.name);
    setFormPlatform(lab.platform);
    setFormDate(lab.date);
    setFormStatus(lab.status);
    setFormNotes(lab.notes);
    setFormVulnerabilities([...lab.vulnerabilities]);
    setNewVulnName('');
    setAiReport(null);
    setIsEditing(true);
  };

  // Agregar vulnerabilidad vacía / sugerida al formulario
  const handleAddVulnerability = () => {
    if (!newVulnName.trim()) return;
    const newVuln: Vulnerability = {
      name: newVulnName.trim(),
      severity: 'media',
      description: '',
      remediation: ''
    };
    setFormVulnerabilities([...formVulnerabilities, newVuln]);
    setNewVulnName('');
  };

  // Eliminar vulnerabilidad del formulario
  const handleRemoveVulnerability = (idx: number) => {
    setFormVulnerabilities(prev => prev.filter((_, i) => i !== idx));
  };

  // Editar campo de una vulnerabilidad en el formulario
  const handleUpdateVulnerabilityField = (idx: number, field: keyof Vulnerability, value: string) => {
    setFormVulnerabilities(prev => prev.map((v, i) => {
      if (i === idx) {
        return { ...v, [field]: value };
      }
      return v;
    }));
  };

  // Autocompletar vulnerabilidad individual con IA de Gemini
  const handleSuggestVulnerabilityWithAi = async (idx: number) => {
    const vuln = formVulnerabilities[idx];
    if (!vuln.name.trim()) return;

    try {
      setLoadingSuggestIdx(idx);
      const res = await fetch('/api/gemini/vulnerability-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vulnName: vuln.name })
      });

      if (!res.ok) throw new Error('Error al generar la sugerencia de la IA');
      const data = await res.json();

      if (data && data.name) {
        setFormVulnerabilities(prev => prev.map((v, i) => {
          if (i === idx) {
            return {
              name: data.name || v.name,
              severity: data.severity || v.severity,
              description: data.description || v.description,
              remediation: data.remediation || v.remediation
            };
          }
          return v;
        }));
      }
    } catch (err: any) {
      console.error(err);
      alert('Error al autocompletar con IA: ' + err.message);
    } finally {
      setLoadingSuggestIdx(null);
    }
  };

  // Guardar laboratorio
  const handleSaveLab = async () => {
    if (!formName.trim()) {
      alert('Por favor ingresa el nombre de la máquina o laboratorio.');
      return;
    }

    try {
      setSubmitting(true);
      const labPayload = {
        notebookId: notebook.id,
        name: formName.trim(),
        platform: formPlatform,
        date: formDate,
        status: formStatus,
        notes: formNotes,
        vulnerabilities: formVulnerabilities
      };

      if (selectedLabId) {
        // Actualizar
        await onUpdateLab(selectedLabId, labPayload);
      } else {
        // Crear nuevo
        await onAddLab(labPayload);
      }

      setIsEditing(false);
      setSelectedLabId(null);
    } catch (err: any) {
      console.error(err);
      alert('Error al guardar el laboratorio: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Eliminar lab
  const handleDeleteClick = async (labId: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este registro de laboratorio permanentemente?')) {
      try {
        await onDeleteLab(labId);
        if (activeLabDetail?.id === labId) {
          setActiveLabDetail(null);
          setAiReport(null);
        }
      } catch (err: any) {
        console.error(err);
        alert('Error al eliminar: ' + err.message);
      }
    }
  };

  // Generar reporte de cierre / auditoría con IA
  const handleGenerateAiReport = async (lab: Lab) => {
    try {
      setLoadingReport(true);
      setAiReport(null);

      const res = await fetch('/api/gemini/lab-summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lab.name,
          platform: lab.platform,
          date: lab.date,
          notes: lab.notes,
          vulnerabilities: lab.vulnerabilities
        })
      });

      if (!res.ok) throw new Error('Error al generar el informe consolidado');
      const data = await res.json();
      
      setAiReport(data.summary);
    } catch (err: any) {
      console.error(err);
      alert('Error de conexión o fallo al generar el reporte: ' + err.message);
    } finally {
      setLoadingReport(false);
    }
  };

  // Colores de severidad
  const getSeverityStyle = (severity: 'baja' | 'media' | 'alta' | 'crítica') => {
    switch (severity) {
      case 'crítica':
        return 'text-terminal-red border-terminal-red/30 bg-terminal-red/10';
      case 'alta':
        return 'text-terminal-amber border-terminal-amber/30 bg-terminal-amber/10';
      case 'media':
        return 'text-white border-terminal-green-dim/30 bg-terminal-gray/35';
      case 'baja':
        return 'text-terminal-green-dim border-terminal-green-dim/15 bg-terminal-gray/10';
      default:
        return 'text-white border-terminal-green-dim/20 bg-terminal-gray/15';
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner / Cabecera */}
      <div className="bg-[#0F0F0F] border border-[#333333] p-4 rounded-md flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm">
        <div>
          <h3 className="text-sm font-bold tracking-wider text-white uppercase flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-terminal-green animate-pulse" />
            REGISTRO DE LABORATORIOS PRÁCTICOS Y MÁQUINAS
          </h3>
          <p className="text-[11px] text-terminal-green-dim font-mono">
            Registra writeups, máquinas explotadas de HackTheBox/TryHackMe y el catálogo de vulnerabilidades encontradas.
          </p>
        </div>

        {!isEditing && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 bg-terminal-green text-terminal-black px-3 py-1.5 rounded text-xs font-bold font-mono transition-colors cursor-pointer hover:bg-terminal-green-bright"
          >
            <Plus className="w-4 h-4" />
            REGISTRAR_NUEVO_LAB
          </button>
        )}
      </div>

      {/* FORMULARIO DE EDICIÓN O CREACIÓN */}
      {isEditing ? (
        <div className="glow-border bg-[#0F0F0F] p-5 rounded-md space-y-6 font-mono text-xs text-white">
          <div className="flex items-center justify-between border-b border-[#222222] pb-3">
            <span className="text-terminal-green font-bold text-sm tracking-wider uppercase">
              {selectedLabId ? '[MODIFICANDO_REGISTRO_LAB]' : '[NUEVO_REGISTRO_LAB_PENTEST]'}
            </span>
            <button
              onClick={() => {
                setIsEditing(false);
                setSelectedLabId(null);
              }}
              className="text-[#666666] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Campo: Nombre */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] text-terminal-green-dim font-bold block uppercase">
                Nombre de la Máquina / Lab *
              </label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="ej: Kioptrix Level 1, HTB Jerry, OWASP Juice Shop..."
                className="w-full bg-black border border-[#222222] rounded px-2.5 py-1.5 text-white outline-none focus:border-terminal-green font-mono text-xs"
                required
              />
            </div>

            {/* Campo: Plataforma */}
            <div className="space-y-1">
              <label className="text-[10px] text-terminal-green-dim font-bold block uppercase">
                Plataforma / Entorno
              </label>
              <select
                value={formPlatform}
                onChange={e => setFormPlatform(e.target.value)}
                className="w-full bg-black border border-[#222222] rounded px-2 py-1.5 text-white outline-none focus:border-terminal-green font-mono text-xs"
              >
                <option value="HackTheBox">HackTheBox</option>
                <option value="TryHackMe">TryHackMe</option>
                <option value="VulnHub">VulnHub</option>
                <option value="PortSwigger">PortSwigger</option>
                <option value="Laboratorio Local">Laboratorio Local</option>
                <option value="Servidor AWS/Cloud">Servidor AWS/Cloud</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            {/* Campo: Fecha */}
            <div className="space-y-1">
              <label className="text-[10px] text-terminal-green-dim font-bold block uppercase">
                Fecha de Realización
              </label>
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                className="w-full bg-black border border-[#222222] rounded px-2.5 py-1 text-white outline-none focus:border-terminal-green font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Campo: Estado */}
            <div className="space-y-1">
              <label className="text-[10px] text-terminal-green-dim font-bold block uppercase">
                Estado del Laboratorio
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormStatus('completado')}
                  className={`flex-1 py-1.5 px-3 rounded text-[10px] font-bold border transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                    formStatus === 'completado'
                      ? 'border-terminal-green text-terminal-green bg-terminal-green/5'
                      : 'border-[#222222] text-[#888888] bg-black hover:border-[#333333]'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  COMPLETADO
                </button>
                <button
                  type="button"
                  onClick={() => setFormStatus('en_progreso')}
                  className={`flex-1 py-1.5 px-3 rounded text-[10px] font-bold border transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                    formStatus === 'en_progreso'
                      ? 'border-terminal-amber text-terminal-amber bg-terminal-amber/5'
                      : 'border-[#222222] text-[#888888] bg-black hover:border-[#333333]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  EN PROGRESO
                </button>
              </div>
            </div>

            {/* Write-up de notas */}
            <div className="md:col-span-3 space-y-1">
              <label className="text-[10px] text-terminal-green-dim font-bold block uppercase">
                Pasos de Explotación / Write-up General (Markdown)
              </label>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Describe la fase de reconocimiento, enumeración de puertos, vectores de entrada, escalada de privilegios y lo aprendido..."
                className="w-full h-24 bg-black border border-[#222222] rounded p-2 text-white outline-none focus:border-terminal-green font-mono text-xs placeholder-[#555555]"
              />
            </div>
          </div>

          {/* VULNERABILIDADES ASOCIADAS */}
          <div className="border border-[#222222] p-4 rounded bg-black/30 space-y-4">
            <div className="flex items-center justify-between border-b border-[#222222] pb-1.5">
              <span className="text-[11px] text-terminal-green font-bold block uppercase">
                [VULNERABILIDADES_DETECTADAS_Y_REPORTADAS]
              </span>
              <span className="text-[9px] text-terminal-green-dim bg-terminal-green/5 px-2 py-0.5 rounded border border-terminal-green-dim/10">
                {formVulnerabilities.length} ENCONTRADAS
              </span>
            </div>

            {/* Agregar vulnerabilidad rápida */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newVulnName}
                onChange={e => setNewVulnName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddVulnerability())}
                placeholder="Ingresa vulnerabilidad (ej: EternalBlue, SQLi, Insecure Deserialization)"
                className="flex-1 bg-black border border-[#222222] rounded px-2.5 py-1.5 text-white outline-none focus:border-terminal-green font-mono text-xs"
              />
              <button
                type="button"
                onClick={handleAddVulnerability}
                className="bg-terminal-green text-terminal-black font-bold px-3 py-1.5 rounded hover:bg-terminal-green-bright flex items-center gap-1 cursor-pointer text-[10px]"
              >
                <Plus className="w-3.5 h-3.5" /> AGREGAR
              </button>
            </div>

            {/* Listado de vulnerabilidades en el formulario */}
            {formVulnerabilities.length === 0 ? (
              <div className="text-[10px] text-[#666666] italic text-center py-4">
                No hay vulnerabilidades registradas para esta máquina aún. Agrega una arriba.
              </div>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {formVulnerabilities.map((vuln, idx) => (
                  <div key={idx} className="border border-[#222222] p-3 rounded bg-black/60 relative space-y-2.5">
                    <button
                      type="button"
                      onClick={() => handleRemoveVulnerability(idx)}
                      className="absolute top-2.5 right-2.5 text-terminal-red hover:bg-terminal-red/10 p-1 rounded transition-colors"
                      title="Eliminar vulnerabilidad"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
                      {/* Nombre y botón IA */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[9px] text-[#666666] font-bold block">VULNERABILIDAD</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={vuln.name}
                            onChange={e => handleUpdateVulnerabilityField(idx, 'name', e.target.value)}
                            className="flex-1 bg-black border border-[#222222] rounded px-2 py-1 text-white text-[11px] font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleSuggestVulnerabilityWithAi(idx)}
                            disabled={loadingSuggestIdx === idx}
                            className="bg-terminal-green/10 border border-terminal-green-dim/30 hover:border-terminal-green hover:text-terminal-green text-terminal-green-dim px-2 py-1 rounded text-[9px] flex items-center gap-1 shrink-0 font-bold transition-all"
                            title="Autocompletar descripción y remediación basada en el nombre usando la IA de Gemini"
                          >
                            {loadingSuggestIdx === idx ? (
                              <Loader className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-2.5 h-2.5" />
                            )}
                            AUTO_IA
                          </button>
                        </div>
                      </div>

                      {/* Severidad */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-[#666666] font-bold block">SEVERIDAD</label>
                        <select
                          value={vuln.severity}
                          onChange={e => handleUpdateVulnerabilityField(idx, 'severity', e.target.value)}
                          className="w-full bg-black border border-[#222222] rounded px-1.5 py-1 text-white text-[11px]"
                        >
                          <option value="baja">Baja</option>
                          <option value="media">Media</option>
                          <option value="alta">Alta</option>
                          <option value="crítica">Crítica</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Descripción */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-[#666666] font-bold block">EXPLICACIÓN / DESCRIPCIÓN</label>
                        <textarea
                          value={vuln.description}
                          onChange={e => handleUpdateVulnerabilityField(idx, 'description', e.target.value)}
                          placeholder="Describe el fallo y cómo se descubrió..."
                          className="w-full h-16 bg-black border border-[#222222] rounded p-1.5 text-[10px] text-white outline-none focus:border-terminal-green"
                        />
                      </div>

                      {/* Remediación */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-[#666666] font-bold block">MITIGACIÓN / REMEDIACIÓN</label>
                        <textarea
                          value={vuln.remediation || ''}
                          onChange={e => handleUpdateVulnerabilityField(idx, 'remediation', e.target.value)}
                          placeholder="Pasos de parcheo o mitigación para asegurar el sistema..."
                          className="w-full h-16 bg-black border border-[#222222] rounded p-1.5 text-[10px] text-white outline-none focus:border-terminal-green"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botones de acción del Formulario */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#222222]">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setSelectedLabId(null);
              }}
              className="text-terminal-red hover:underline font-bold cursor-pointer"
            >
              CANCELAR
            </button>
            <button
              onClick={handleSaveLab}
              disabled={submitting}
              className="bg-terminal-green text-terminal-black font-extrabold px-5 py-2 rounded hover:bg-terminal-green-bright flex items-center gap-1.5 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  GUARDANDO...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  COMPROMETER_LAB_AL_NOTEBOOK
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* VISTA PRINCIPAL: Muestra listado y visualizador de detalles */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Listado de Laboratorios Realizados */}
          <div className="lg:col-span-1 space-y-3">
            <div className="bg-terminal-gray/80 border border-[#222222] p-2.5 rounded text-[10px] font-mono text-terminal-green-dim font-bold flex justify-between">
              <span>LISTADO_DE_PENTESTS</span>
              <span>DRIVE: {notebook.name.toUpperCase()}</span>
            </div>

            {labs.length === 0 ? (
              <div className="glow-border bg-terminal-dark/50 p-8 rounded-lg text-center font-mono text-xs text-[#666666] italic">
                No hay laboratorios registrados en este drive.
                <br />
                <button
                  onClick={handleOpenCreate}
                  className="mt-3 text-terminal-green hover:underline cursor-pointer text-[10px] font-bold"
                >
                  [+ REGISTRAR_MÁQUINA]
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                {labs.map((lab) => {
                  const isSelected = activeLabDetail?.id === lab.id;
                  return (
                    <div
                      key={lab.id}
                      onClick={() => {
                        setActiveLabDetail(lab);
                        setAiReport(null);
                      }}
                      className={`p-3 rounded border font-mono text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-terminal-green bg-terminal-green/5'
                          : 'border-[#222222] bg-black/40 hover:border-[#333333]'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <span className="font-bold text-white truncate max-w-[130px]" title={lab.name}>
                          {lab.name}
                        </span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase border shrink-0 ${
                          lab.status === 'completado'
                            ? 'text-terminal-green border-terminal-green/20 bg-terminal-green/5'
                            : 'text-terminal-amber border-terminal-amber/20 bg-terminal-amber/5'
                        }`}>
                          {lab.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[9px] text-[#666666] mb-2">
                        <span className="bg-[#151515] border border-[#222222] px-1 py-0.2 rounded font-sans uppercase">
                          {lab.platform}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {lab.date}
                        </span>
                      </div>

                      {/* Lista de insignias de severidad */}
                      {lab.vulnerabilities && lab.vulnerabilities.length > 0 ? (
                        <div className="flex flex-wrap gap-1 items-center">
                          {lab.vulnerabilities.map((vuln, i) => (
                            <span
                              key={i}
                              className={`text-[8px] font-extrabold px-1 rounded border capitalize ${getSeverityStyle(vuln.severity)}`}
                              title={`${vuln.name}: ${vuln.severity}`}
                            >
                              {vuln.severity === 'crítica' ? 'CRIT' : vuln.severity.substring(0, 3).toUpperCase()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[9px] text-[#555555] italic">Sin vulns registradas</span>
                      )}

                      {/* Controles rápidos */}
                      <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-[#222222]/40 text-[9px]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(lab);
                          }}
                          className="text-[#888888] hover:text-terminal-green flex items-center gap-0.5"
                          title="Editar"
                        >
                          <Edit className="w-3 h-3" /> [EDIT]
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(lab.id);
                          }}
                          className="text-[#666666] hover:text-terminal-red flex items-center gap-0.5"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3 h-3" /> [DEL]
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DETALLES DEL LABORATORIO SELECCIONADO */}
          <div className="lg:col-span-2 space-y-4">
            {activeLabDetail ? (
              <div className="glow-border bg-terminal-dark/95 p-5 rounded-md space-y-5 font-mono text-xs text-white">
                <div className="flex items-center justify-between border-b border-[#222222] pb-2.5">
                  <div>
                    <h4 className="text-sm font-bold text-terminal-green uppercase flex items-center gap-1.5 glow-text">
                      <Briefcase className="w-4 h-4" /> {activeLabDetail.name}
                    </h4>
                    <span className="text-[9px] text-[#666666]">PLATAFORMA: {activeLabDetail.platform} // FECHA: {activeLabDetail.date}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleGenerateAiReport(activeLabDetail)}
                      disabled={loadingReport}
                      className="bg-terminal-green/10 border border-terminal-green text-terminal-green text-[10px] px-2.5 py-1 rounded font-bold hover:bg-terminal-green hover:text-terminal-black flex items-center gap-1 cursor-pointer transition-all"
                    >
                      {loadingReport ? (
                        <>
                          <Loader className="w-3 h-3 animate-spin" />
                          GENERANDO_REPORTE...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 animate-pulse" />
                          REPORTE_CIE_IA
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleOpenEdit(activeLabDetail)}
                      className="bg-[#151515] border border-[#333333] hover:border-terminal-green text-white text-[10px] px-2.5 py-1 rounded font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit className="w-3 h-3 text-terminal-green" />
                      EDIT
                    </button>
                  </div>
                </div>

                {/* Reporte de Cierre de IA Generado (Si existe) */}
                {aiReport && (
                  <div className="bg-terminal-black border border-terminal-green/30 p-4 rounded text-xs space-y-2.5 animate-fadeIn relative">
                    <button
                      onClick={() => setAiReport(null)}
                      className="absolute top-2.5 right-2.5 text-terminal-red hover:underline text-[9px] font-bold"
                    >
                      [CERRAR]
                    </button>
                    <div className="flex items-center gap-1.5 text-terminal-green font-bold border-b border-terminal-green-dim/10 pb-1.5 uppercase text-[10px]">
                      <Sparkles className="w-3.5 h-3.5" />
                      [INFORMACIÓN_AUDITORÍA_LLM_GEMINI]
                    </div>
                    <div className="text-terminal-green-dim leading-relaxed text-[11px] whitespace-pre-wrap">
                      {aiReport}
                    </div>
                  </div>
                )}

                {/* Notas / Write-up */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-terminal-green-dim font-bold block uppercase border-b border-[#222222] pb-1">
                    [01_CRÓNICA_Y_LOGS_DE_EXPLOTACIÓN]
                  </span>
                  <div className="bg-black/60 p-3 rounded border border-[#222222] text-[11px] whitespace-pre-wrap leading-relaxed text-[#E0E0E0] min-h-[100px] max-h-[220px] overflow-y-auto">
                    {activeLabDetail.notes ? activeLabDetail.notes : (
                      <span className="text-[#555555] italic">Ninguna nota o crónica registrada para este laboratorio.</span>
                    )}
                  </div>
                </div>

                {/* Vulnerabilidades Encontradas */}
                <div className="space-y-2.5">
                  <span className="text-[10px] text-terminal-green-dim font-bold block uppercase border-b border-[#222222] pb-1">
                    [02_INVENTARIO_AMENAZAS_Y_BRECHAS_ENCONTRADAS]
                  </span>
                  
                  {activeLabDetail.vulnerabilities && activeLabDetail.vulnerabilities.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[300px] overflow-y-auto pr-1">
                      {activeLabDetail.vulnerabilities.map((vuln, i) => (
                        <div key={i} className="border border-[#222222] bg-black/40 p-3 rounded space-y-2">
                          <div className="flex items-center justify-between gap-2 border-b border-[#222222]/50 pb-1.5">
                            <span className="font-bold text-white text-[11px] truncate" title={vuln.name}>
                              {vuln.name}
                            </span>
                            <span className={`text-[8px] font-extrabold px-1.5 rounded uppercase border shrink-0 ${getSeverityStyle(vuln.severity)}`}>
                              {vuln.severity}
                            </span>
                          </div>

                          <p className="text-[10px] text-terminal-green-dim/95 leading-normal whitespace-pre-wrap">
                            <strong className="text-white">Descripción:</strong> {vuln.description || 'Sin descripción'}
                          </p>

                          {vuln.remediation && (
                            <p className="text-[10px] text-terminal-amber/90 leading-normal border-t border-[#222222]/30 pt-1.5 whitespace-pre-wrap">
                              <strong className="text-white">Remediación:</strong> {vuln.remediation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-[#555555] italic text-center py-6 border border-dashed border-[#222222] rounded bg-black/20">
                      No se registraron vulnerabilidades para esta máquina.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="glow-border bg-terminal-dark/95 p-16 rounded-lg text-center font-mono text-xs text-[#666666] italic h-full flex flex-col justify-center items-center gap-3 min-h-[350px]">
                <ShieldAlert className="w-8 h-8 text-[#555555]" />
                <span>Selecciona un laboratorio de la izquierda para desplegar su write-up, matriz de vulnerabilidades, o para generar el informe de auditoría con la IA de Gemini.</span>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
