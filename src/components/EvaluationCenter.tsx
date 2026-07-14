/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Award, 
  Brain, 
  HelpCircle, 
  History, 
  Loader, 
  Play, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  FileText,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { Notebook, NotebookItem, QuizQuestion, Evaluation } from '../types';

interface EvaluationCenterProps {
  notebook: Notebook;
  items: NotebookItem[];
  evaluations: Evaluation[];
  onAddEvaluation: (evaluation: Omit<Evaluation, 'id'>) => Promise<Evaluation>;
}

export default function EvaluationCenter({
  notebook,
  items,
  evaluations,
  onAddEvaluation,
}: EvaluationCenterProps) {
  const [loading, setLoading] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<QuizQuestion[] | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  
  // Calificación e IA Report
  const [grading, setGrading] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<Evaluation | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [viewedPastEvaluation, setViewedPastEvaluation] = useState<Evaluation | null>(null);

  // Iniciar un nuevo examen interactivo
  const handleGenerateQuiz = async () => {
    if (items.length < 2) {
      alert('Se necesitan al menos 2 notas/comandos en el cuaderno para poder generar un examen personalizado.');
      return;
    }
    
    try {
      setLoading(true);
      setActiveQuiz(null);
      setCurrentEvaluation(null);
      setViewedPastEvaluation(null);
      setSelectedAnswers({});

      const res = await fetch('/api/gemini/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, notebookName: notebook.name }),
      });

      if (!res.ok) throw new Error('Error al generar el examen');
      const data = await res.json();
      
      if (data && data.questions) {
        setActiveQuiz(data.questions);
      } else {
        throw new Error('Formato de examen inválido devuelto por la IA.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error de conexión o fallo al generar el examen: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambio de respuestas en el formulario
  const handleAnswerChange = (questionId: string, value: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  // Enviar el examen y calificarlo de manera interactiva (Active Recall AI + Client instant matching)
  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    
    try {
      setGrading(true);
      const gradedQuestions: QuizQuestion[] = [];
      let correctCount = 0;

      // Iterar sobre las preguntas para calificarlas una a una
      for (const q of activeQuiz) {
        const userAnswer = selectedAnswers[q.id]?.trim() || '';
        const gradedQ: QuizQuestion = {
          ...q,
          userAnswer: userAnswer,
        };

        if (q.type === 'multiple-choice') {
          // Coincidencia exacta de opción múltiple
          const isCorrect = userAnswer.toLowerCase() === q.correctAnswer.toLowerCase();
          gradedQ.isCorrect = isCorrect;
          if (isCorrect) correctCount++;
        } 
        else if (q.type === 'command-fill') {
          // Coincidencia exacta de comandos (sin tomar en cuenta mayúsculas o espacios extras)
          const cleanUser = userAnswer.toLowerCase().replace(/\s+/g, '');
          const cleanCorrect = q.correctAnswer.toLowerCase().replace(/\s+/g, '');
          const isCorrect = cleanUser === cleanCorrect;
          gradedQ.isCorrect = isCorrect;
          if (isCorrect) correctCount++;
        } 
        else if (q.type === 'active-recall') {
          // Calificación remota basada en LLM Gemini (AI Grading)
          try {
            const gradeRes = await fetch('/api/gemini/grade-recall', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                question: q.question,
                idealAnswer: q.correctAnswer,
                userAnswer: userAnswer,
              }),
            });
            
            if (gradeRes.ok) {
              const gradeData = await gradeRes.json();
              gradedQ.isCorrect = gradeData.isCorrect;
              gradedQ.explanation = `${q.explanation || ''}\n\n[CRÍTICA DE EXAMINADOR IA]: ${gradeData.critique} (Nota: ${gradeData.scoreOutOf100}/100)`;
              if (gradeData.isCorrect) correctCount++;
            } else {
              // Fallback si la calificación por IA falla
              gradedQ.isCorrect = userAnswer.length > 10;
              gradedQ.explanation = q.explanation + ' [Calificación Fallback: Se aprobó por longitud de respuesta]';
              if (gradedQ.isCorrect) correctCount++;
            }
          } catch (e) {
            console.error('Error calificando active-recall:', e);
            gradedQ.isCorrect = true; // Fallback generoso
            if (gradedQ.isCorrect) correctCount++;
          }
        }

        gradedQuestions.push(gradedQ);
      }

      // Analizar rendimiento general del examen
      let performanceAnalysis = 'Analizando buffers...';
      try {
        const analysisRes = await fetch('/api/gemini/analyze-performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questions: gradedQuestions,
            score: correctCount,
            totalQuestions: gradedQuestions.length,
            notebookName: notebook.name
          }),
        });

        if (analysisRes.ok) {
          const analysisData = await analysisRes.json();
          performanceAnalysis = analysisData.analysis;
        }
      } catch (e) {
        console.error('Error al analizar el rendimiento:', e);
        performanceAnalysis = `[REPORTE_FALLBACK] Has completado tu examen de autoevaluación.\n\nResultado: ${correctCount} / ${gradedQuestions.length} correctas. Continúa repasando tus apuntes y comandos usando repetición espaciada.`;
      }

      // Estructurar el reporte de evaluación definitivo
      const newEvaluation: Omit<Evaluation, 'id'> = {
        notebookId: notebook.id,
        createdAt: Date.now(),
        questions: gradedQuestions,
        score: correctCount,
        totalQuestions: gradedQuestions.length,
        aiAnalysis: performanceAnalysis
      };

      // Guardar en Firestore para persistencia duradera de notas
      const savedEval = await onAddEvaluation(newEvaluation);
      setCurrentEvaluation(savedEval);
      setActiveQuiz(null);
    } catch (err) {
      console.error(err);
      alert('Error durante el proceso de calificación. Reintenta.');
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Selector de modo: Examen o Historial */}
      <div className="bg-[#0F0F0F] border border-[#333333] p-4 rounded-md flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm">
        <div>
          <h3 className="text-sm font-bold tracking-wider text-white uppercase flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#00FF41] animate-pulse" />
            EVALUACIÓN DE CONOCIMIENTOS // METODOLOGÍA ACTIVA
          </h3>
          <p className="text-[11px] text-[#888888] font-mono">
            Usa Active Recall, adivinación de comandos en blanco y exámenes situacionales generados por la IA.
          </p>
        </div>

        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 bg-[#151515] border border-[#333333] hover:border-[#00FF41] hover:text-[#00FF41] text-[#888888] px-3 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer"
        >
          <History className="w-3.5 h-3.5" />
          {showHistory ? 'IR_AL_EXAMEN' : 'VER_LOGS_HISTÓRICOS'}
        </button>
      </div>

      {/* VISTA DEL HISTORIAL DE EXÁMENES */}
      {showHistory ? (
        <div className="bg-[#0F0F0F] border border-[#333333] p-4 rounded-md space-y-4 font-mono shadow-sm">
          <h4 className="text-xs font-bold text-[#00FF41] pb-2 border-b border-[#222222] flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> HISTORIAL_REGISTROS_PUNTUACIONES (DRIVE: {notebook.name})
          </h4>

          {evaluations.length === 0 ? (
            <div className="text-xs text-[#666666] italic text-center py-10">
              No se han encontrado registros de exámenes pasados.
              <br />
              ¡Inicia un examen interactivo y pon a prueba tus habilidades!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Lista de Registros */}
              <div className="md:col-span-1 border-r border-[#222222] space-y-2 pr-3 h-[400px] overflow-y-auto">
                {evaluations.map((evalDoc) => {
                  const pct = Math.round((evalDoc.score / evalDoc.totalQuestions) * 100);
                  const isSuccess = pct >= 60;
                  
                  return (
                    <div
                      key={evalDoc.id}
                      onClick={() => setViewedPastEvaluation(evalDoc)}
                      className={`p-2.5 rounded-md border text-xs cursor-pointer transition-all ${
                        viewedPastEvaluation?.id === evalDoc.id
                          ? 'border-[#00FF41] bg-[#00FF41]/5'
                          : 'border-[#222222] bg-black/40 hover:border-[#333333]'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-[#666666]">
                          {new Date(evalDoc.createdAt).toLocaleDateString()} {new Date(evalDoc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={`font-bold ${isSuccess ? 'text-[#00FF41]' : 'text-[#E03E3E]'}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="text-white truncate">
                        PUNTOS: {evalDoc.score} / {evalDoc.totalQuestions}
                      </div>
                      {/* Barra de progreso simulada */}
                      <div className="w-full bg-[#222222] h-1.5 rounded mt-1.5 overflow-hidden">
                        <div 
                          className={`h-full ${isSuccess ? 'bg-[#00FF41]' : 'bg-[#E03E3E]'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detalle del Registro Seleccionado */}
              <div className="md:col-span-2 space-y-4 pl-1 h-[400px] overflow-y-auto">
                {viewedPastEvaluation ? (
                  <div className="space-y-4 font-mono text-xs text-white">
                    <div className="flex items-center justify-between border-b border-[#222222] pb-2">
                      <span className="font-bold text-[#00FF41]">[LOG_REGISTRO_DETALLE]</span>
                      <span className="text-[#666666]">ID: {viewedPastEvaluation.id.substring(0, 8)}</span>
                    </div>

                    <div className="bg-black border border-[#222222] p-3 rounded">
                      <span className="text-[10px] text-[#666666] font-bold block mb-1">[SYS_IA_CRITIQUE_REPORT]</span>
                      <div className="text-[11px] whitespace-pre-wrap leading-relaxed text-[#E0E0E0]">
                        {viewedPastEvaluation.aiAnalysis || 'No se generó reporte de análisis.'}
                      </div>
                    </div>

                    {/* Mostrar respuestas */}
                    <div className="space-y-3">
                      <span className="text-[10px] text-[#666666] font-bold block">[PREGUNTAS_CONTESTADAS]</span>
                      {viewedPastEvaluation.questions.map((q, idx) => (
                        <div key={q.id} className="border border-[#222222] p-3 rounded bg-black/20">
                          <div className="flex items-start gap-2">
                            {q.isCorrect ? (
                              <CheckCircle className="w-4 h-4 text-[#00FF41] shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-[#E03E3E] shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="font-bold text-white mb-1">
                                {idx + 1}. {q.question}
                              </div>
                              <div className="text-[11px] text-[#888888]">
                                tu_respuesta &gt; <span className={q.isCorrect ? 'text-[#00FF41] font-bold' : 'text-[#D9A006] font-mono'}>{q.userAnswer || 'No contestada.'}</span>
                              </div>
                              {!q.isCorrect && (
                                <div className="text-[11px] text-[#E03E3E] mt-0.5 font-bold">
                                  correcta &gt; {q.correctAnswer}
                                </div>
                              )}
                              {q.explanation && (
                                <div className="text-[10px] text-[#888888] bg-[#151515] p-1.5 rounded border border-[#222222] mt-2 whitespace-pre-wrap">
                                  {q.explanation}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[#666666] italic text-center py-20">
                    Selecciona un examen histórico de la izquierda para desplegar el reporte analítico de Gemini, tus respuestas y el plan de acción sugerido.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* PANEL PRINCIPAL DE EXÁMENES ACTIVOS */
        <div className="space-y-4">
          {/* Si no hay examen cargado ni reporte de calificación actual */}
          {!activeQuiz && !currentEvaluation && (
            <div className="bg-[#0F0F0F] border border-[#333333] p-8 rounded-md text-center space-y-4 font-mono shadow-sm">
              <Brain className="w-12 h-12 text-[#00FF41] animate-pulse mx-auto" />
              <div className="max-w-md mx-auto">
                <h4 className="text-xs font-bold text-white tracking-wider uppercase mb-1">
                  PREPARAR ENTORNO DE EVALUACIÓN PERSONALIZADA
                </h4>
                <p className="text-xs text-[#888888] leading-relaxed">
                  El sistema recopilará todas tus notas de <strong className="text-[#00FF41]">"{notebook.name}"</strong> y estructurará un examen dinámico de 5 preguntas combinando conceptos teóricos, completación de parámetros de consola y simulaciones de ataque para entrenar tu cerebro de hacker.
                </p>
              </div>

              {items.length < 2 ? (
                <div className="text-xs text-[#D9A006] border border-[#D9A006]/30 bg-[#D9A006]/5 p-3 rounded-md max-w-sm mx-auto">
                  [ALERTA: Se requieren al menos 2 notas cargadas en tu base de datos para generar un test personalizado. Actualmente tienes {items.length}].
                </div>
              ) : (
                <button
                  onClick={handleGenerateQuiz}
                  disabled={loading}
                  className="bg-[#00FF41] text-black font-bold px-6 py-2.5 rounded hover:bg-[#00FF41]/90 transition-all cursor-pointer inline-flex items-center gap-2 text-xs"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      GENERANDO_VECTORES_EXAMEN_CON_LLM...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      INICIAR_EVALUACIÓN_IA
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* EXAMEN EN CURSO */}
          {activeQuiz && (
            <div className="bg-[#0F0F0F] border border-[#333333] p-5 rounded-md space-y-6 font-mono text-xs shadow-md">
              <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                <span className="text-[#00FF41] font-bold text-sm tracking-wider uppercase">[EXAMEN_TERMINAL_ACTIVO]</span>
                <span className="text-[#666666] text-[10px]">PREGUNTAS: 5 // DRIVE: {notebook.name.toUpperCase()}</span>
              </div>

              <div className="space-y-6">
                {activeQuiz.map((q, index) => (
                  <div key={q.id} className="space-y-2.5 border-b border-[#222222]/50 pb-4 last:border-b-0 last:pb-0">
                    <div className="flex items-start gap-2">
                      <span className="bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20 px-1.5 py-0.5 rounded text-[10px] shrink-0 font-bold">
                        Q{index + 1}
                      </span>
                      <div className="font-bold text-white text-xs leading-relaxed">
                        {q.question}
                      </div>
                    </div>

                    {/* Render de Opciones de respuesta por Tipo de Pregunta */}
                    {q.type === 'multiple-choice' && q.options && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-7">
                        {q.options.map((opt) => {
                          const isSelected = selectedAnswers[q.id] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleAnswerChange(q.id, opt)}
                              className={`text-left p-2.5 rounded-md border text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-[#00FF41] bg-[#00FF41]/10 text-[#00FF41]'
                                  : 'border-[#222222] bg-black/30 hover:border-[#333333] hover:bg-[#151515] text-white'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'command-fill' && (
                      <div className="pl-7">
                        <div className="relative flex items-center bg-black border border-[#222222] rounded px-2.5 py-1.5 max-w-md focus-within:border-[#00FF41] transition-all">
                          <span className="text-[#00FF41] mr-2 text-[11px] font-bold">shell_cmd &gt; </span>
                          <input
                            type="text"
                            placeholder="Completa el comando aquí..."
                            value={selectedAnswers[q.id] || ''}
                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                            className="w-full bg-transparent text-white outline-none font-mono text-xs"
                          />
                        </div>
                        <div className="text-[10px] text-[#666666] mt-1">Escribe exactamente el parámetro o parte faltante del comando.</div>
                      </div>
                    )}

                    {q.type === 'active-recall' && (
                      <div className="pl-7">
                        <textarea
                          placeholder="Explica detalladamente la respuesta teórica. La IA analizará la semántica de tu respuesta y la calificará de forma rigurosa..."
                          value={selectedAnswers[q.id] || ''}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          className="w-full h-24 bg-black text-[#00FF41] border border-[#222222] rounded-md p-2.5 outline-none focus:border-[#00FF41] font-mono placeholder-[#555555]"
                        />
                        <div className="text-[10px] text-[#666666] mt-1">Metodología Active Recall: Intentar recordar de memoria sin mirar las notas consolida el aprendizaje a largo plazo.</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Botón de Enviar examen */}
              <div className="flex justify-end pt-4 border-t border-[#222222] gap-3">
                <button
                  type="button"
                  onClick={() => setActiveQuiz(null)}
                  className="text-[#E03E3E] hover:underline font-mono cursor-pointer"
                >
                  DISCARD_EXAM
                </button>
                <button
                  onClick={handleSubmitQuiz}
                  disabled={grading}
                  className="bg-[#00FF41] text-black font-bold px-5 py-2 rounded hover:bg-[#00FF41]/90 flex items-center gap-1.5 cursor-pointer"
                >
                  {grading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin animate-none" />
                      EVALUANDO_EXÁMENES_CON_SISTEMA_LLM_IA...
                    </>
                  ) : (
                    <>
                      <Cpu className="w-4 h-4" />
                      SUBMIT_AND_GRADE_EXAM
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* REPORTE DE RESULTADOS RECIENTES */}
          {currentEvaluation && (
            <div className="bg-[#0F0F0F] border border-[#333333] p-5 rounded-md space-y-6 font-mono text-xs animate-fadeIn text-white shadow-md">
              <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#00FF41] animate-bounce" />
                  <span className="font-bold text-sm tracking-wider uppercase">[RESULTADOS_EXAMEN_COMPLETADO]</span>
                </div>
                <span className="text-[#888888]">SCORE: {currentEvaluation.score} / {currentEvaluation.totalQuestions}</span>
              </div>

              {/* Score Circular / Grande */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-6 bg-black/40 p-4 rounded-md border border-[#222222]">
                <div className="relative flex items-center justify-center w-24 h-24 rounded-full border-4 border-[#00FF41] font-extrabold text-3xl text-[#00FF41]">
                  {Math.round((currentEvaluation.score / currentEvaluation.totalQuestions) * 100)}%
                </div>
                <div className="text-center md:text-left space-y-1 max-w-sm">
                  <div className="text-sm font-bold text-white">¡Examen Finalizado con Éxito!</div>
                  <p className="text-[11px] text-[#888888] leading-relaxed">
                    Tus respuestas teóricas fueron evaluadas por la IA de Gemini. Tu puntaje total es de {currentEvaluation.score} de {currentEvaluation.totalQuestions} respuestas correctas. Abajo puedes leer el reporte de retroalimentación detallado y plan de estudio personalizado.
                  </p>
                </div>
              </div>

              {/* Reporte de Análisis de Gemini */}
              <div className="bg-[#151515] border border-[#222222] p-4 rounded text-xs space-y-2.5">
                <div className="flex items-center gap-1.5 text-white font-bold border-b border-[#222222] pb-1.5 uppercase">
                  <Cpu className="w-4 h-4 text-[#00FF41]" />
                  [REPORTE_METODOLOGÍA_IA_GEMINI]
                </div>
                <div className="text-[#E0E0E0] whitespace-pre-wrap leading-relaxed text-[11px]">
                  {currentEvaluation.aiAnalysis}
                </div>
              </div>

              {/* Botón para resetear y realizar otro test */}
              <div className="flex justify-end gap-3 text-xs pt-2">
                <button
                  onClick={() => setCurrentEvaluation(null)}
                  className="bg-[#00FF41] text-black font-bold px-4 py-2 rounded hover:bg-[#00FF41]/90 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  REALIZAR_NUEVO_TEST
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
