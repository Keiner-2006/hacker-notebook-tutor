/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || '3001');

// Inicializar el SDK de Gemini
// Usamos lazy initialization por seguridad si la key falta al inicio
let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY no configurado en las variables de entorno.');
    }
    ai = new GoogleGenAI({ 
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return ai;
}

// Middleware para parsear JSON con límite amplio para notas grandes
app.use(express.json({ limit: '10mb' }));

// --- ENDPOINTS DE LA API DE GEMINI ---

// 1. Chat interactivo con contexto de cuaderno (NotebookLM hacker style)
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { notebookName, notebookDescription, items, messages, focusOnNotebook } = req.body;
    const client = getGeminiClient();

    // Formatear el contexto del cuaderno
    let notebookContext = '';
    if (items && items.length > 0) {
      notebookContext = items.map((item: any) => {
        const syntaxStr = item.syntax ? `\nSintaxis/Comando: ${item.syntax}` : '';
        const tagsStr = item.tags && item.tags.length > 0 ? `\nTags: ${item.tags.join(', ')}` : '';
        return `[TIPO: ${item.type.toUpperCase()}] - ${item.title}\nContenido: ${item.content}${syntaxStr}${tagsStr}\n---`;
      }).join('\n');
    } else {
      notebookContext = 'El cuaderno actual está vacío. El usuario no ha agregado notas aún.';
    }

    // Configurar instrucciones del sistema según si está enfocado en el cuaderno o general
    const baseInstruction = `Eres un tutor experto en ciberseguridad, hacking ético y desarrollo seguro. Tu interfaz simula una terminal hacker avanzada.
Responde en español de forma directa, técnica, profesional y minimalista.
Usa formato Markdown compatible con terminales (bloques de código detallados, comandos con backticks, jerarquías de texto limpias).
Siempre promueve el uso ético y legal de las herramientas descritas (pentesting autorizado, educación de ciberseguridad).
Saluda o identifícate en tus mensajes como "root@terminal_tutor:~# " de manera sutil si lo consideras adecuado.`;

    const systemInstruction = focusOnNotebook 
      ? `${baseInstruction}
Estás enfocado en el cuaderno del usuario titulado "${notebookName || 'General'}".
Descripción del cuaderno: ${notebookDescription || 'Sin descripción'}.

Aquí tienes las notas, comandos y técnicas registradas en este cuaderno:
---
${notebookContext}
---
Tu prioridad absoluta es responder a las preguntas basándote en este contenido. Si te preguntan algo que no está en las notas, ayúdalos amablemente usando tu conocimiento, pero haz referencia a si está o no en su cuaderno, o cómo se relaciona con lo que ya han anotado (por ejemplo, sugiriendo cómo expandir una nota o automatizar un comando de su lista).`
      : `${baseInstruction}
Estás en modo general (ayudante global de ciberseguridad y programación). El usuario tiene un cuaderno llamado "${notebookName || 'General'}" pero en este momento te consulta de forma libre. Puedes usar todo tu conocimiento. Si es relevante, puedes mencionar cómo los comandos como nmap, netcat, etc., listados abajo se aplican al problema.
Notas del cuaderno del usuario por si las necesitas:
${notebookContext.substring(0, 3000)}`; // Limitar para ahorrar contexto en modo general

    // Mapear los mensajes de chat para el SDK de Gemini
    // El SDK espera contents en formato de objeto o strings
    // Format: [{ role: 'user' | 'model', parts: [{ text: string }] }]
    const contents = messages.map((msg: any) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, // Respuestas más precisas y técnicas
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Error en /api/gemini/chat:', error);
    res.status(500).json({ error: error.message || 'Error interno en el bot de tutoría' });
  }
});

// 2. Organizar automáticamente notas / comandos ingresados como texto libre
app.post('/api/gemini/organize', async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || rawText.trim() === '') {
      return res.status(400).json({ error: 'El contenido rawText es requerido.' });
    }

    const client = getGeminiClient();

    const systemInstruction = `Eres un procesador de texto experto en ciberseguridad, hacking ético y tecnología. 
Tu tarea es analizar el texto de apuntes o comandos que te envíe el usuario y organizarlo de manera óptima y detallada en múltiples elementos individuales.

Debes identificar y separar el contenido en diferentes elementos de la siguiente lista según corresponda:
- 'command' (Para comandos de terminal específicos como nmap, dig, whois, dirb, dnsrecon, exiftool, etc. Si el texto contiene varios comandos independientes de herramientas distintas, sepáralos en elementos individuales de tipo 'command' para que puedan filtrarse correctamente.)
- 'note' (Para conceptos generales de teoría, metodologías, definiciones como firewalls, routers, etc.)
- 'technique' (Para flujos de trabajo estructurados, metodologías de explotación, o técnicas complejas que combinan pasos).

Reglas para mejorar el contenido (Critical Improvement Rules):
1. SEPARACIÓN DE HERRAMIENTAS DISTINTAS: No juntes comandos de herramientas totalmente distintas en una sola nota. Por ejemplo, "dnsrecon", "dig" y "whois" deben ser elementos independientes de tipo 'command', de modo que cada uno aparezca de forma individual al filtrar por comandos en la aplicación.
2. COHERENCIA DE HERRAMIENTAS (AGRUPACIÓN DE INSTALACIÓN Y USO): Si una herramienta tiene comandos de instalación o preparación (por ejemplo, 'pip3 install h8mail' o 'sudo apt install aha') y también comandos de uso (por ejemplo, 'h8mail -t <EMAIL>'), NO crees tarjetas separadas. Agrúpalas todas en una única tarjeta de tipo 'command' dedicada a esa herramienta. Describe tanto el comando de instalación como las instrucciones de uso dentro del campo 'content', y pon la sintaxis del comando de uso principal en 'syntax'.
3. EXPLICACIÓN DETALLADA DE COMANDOS: Para cada elemento de tipo 'command', debes explicar detalladamente en el campo 'content' qué hace el comando, para qué sirve en Hacking Ético, y describir brevemente cada opción o parámetro utilizado (ej. qué hace '-d' en dnsrecon, o '-l' en spiderfoot). No dejes solo la sintaxis, ¡haz una definición formativa y profesional de cada parámetro!
4. DEFINICIONES AMPLIADAS: Si el apunte original de teoría es muy básico, expande y mejora la definición en el campo 'content' para que sea más clara, precisa y educativa, sin perder la esencia del apunte original. Corrige errores ortográficos y de formato.
5. SINTAXIS LIMPIA: En el campo 'syntax', pon únicamente la sintaxis limpia y ejecutable del comando con parámetros genéricos entre corchetes angulares, por ejemplo: 'dnsrecon -d <DOMINIO>' o 'spiderfoot -l <IP_O_DOMINIO>' o 'whois <DOMINIO>'. No incluyas explicaciones de texto en el campo syntax, solo el comando.

Debes estructurar tu respuesta EXACTAMENTE en el siguiente formato JSON:
{
  "items": [
    {
      "type": "note" | "command" | "technique",
      "title": "Un título corto, claro e instructivo en español",
      "content": "La explicación detallada y mejorada en formato markdown (en español). Si es un comando, explica qué hace, cómo se instala (si aplica) y el significado detallado de sus parámetros.",
      "syntax": "El comando limpio o sintaxis técnica. Para 'command' debe ser el comando a ejecutar, ej: 'dig <DOMINIO> mx'. Para 'note' u otros puede estar vacío o contener una referencia.",
      "tags": ["lista", "de", "etiquetas", "relevantes", "en", "minusculas", "como", "dns", "recon", "linux", "metodologia"]
    }
  ]
}

Responde ÚNICAMENTE con el objeto JSON válido. No uses bloques de código envolventes de markdown como \`\`\`json ... \`\`\`. Devuelve solo el JSON crudo para que pueda parsearse de inmediato.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Organiza este texto libre:\n${rawText}`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
      }
    });

    const parsedData = JSON.parse(response.text || '{}');
    res.json(parsedData);
  } catch (error: any) {
    console.error('Error en /api/gemini/organize:', error);
    res.status(500).json({ error: error.message || 'Error al procesar y organizar la nota' });
  }
});

// 3. Generar un Quiz de autoevaluación basado en metodologías de aprendizaje activo
app.post('/api/gemini/quiz', async (req, res) => {
  try {
    const { items, notebookName } = req.body;
    const client = getGeminiClient();

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Se necesitan notas en el cuaderno para generar un examen personalizado.' });
    }

    // Formatear el contenido para que el modelo lo use de base de preguntas
    const contentContext = items.map((item: any) => {
      const syntaxStr = item.syntax ? `\nSintaxis/Comando: ${item.syntax}` : '';
      return `ID: ${item.id}\nTipo: ${item.type.toUpperCase()}\nTítulo: ${item.title}\nContenido: ${item.content}${syntaxStr}\n---`;
    }).join('\n');

    const systemInstruction = `Eres un evaluador académico militar de ciberseguridad.
Tu objetivo es generar un examen de autoevaluación de exactamente 5 preguntas utilizando las mejores metodologías de aprendizaje como Active Recall (Recuerdo Activo), Spaced Repetition (Repetición Espaciada) y pruebas situacionales de Red Team / Blue Team.

Genera un examen basado estrictamente en el contenido provisto del cuaderno "${notebookName}". Las preguntas deben desafiar al usuario a recordar comandos específicos, flujos de trabajo de pentesting o conceptos críticos de seguridad que tiene en sus notas.

Debes incluir 3 tipos de preguntas:
1. 'multiple-choice' (Opción múltiple con 4 opciones limpias, ideales para recordar conceptos u opciones de comandos).
2. 'command-fill' (Completar el comando. El usuario debe adivinar el parámetro o comando que falta, genial para comandos como nmap, netcat, etc. Ej: "Para realizar un escaneo silencioso en nmap, el comando es: nmap ___ <IP>". La respuesta correcta debe ser el parámetro faltante, ej: "-sS").
3. 'active-recall' (Pregunta conceptual de respuesta corta. El usuario escribirá una explicación corta o un comando, y luego Gemini lo evaluará. Para la estructura del examen, pon la respuesta ideal en "correctAnswer").

Debes responder EXACTAMENTE con un objeto JSON con la siguiente estructura:
{
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "question": "Escribe aquí la pregunta del examen...",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correctAnswer": "Opción B",
      "explanation": "Explicación detallada de por qué es la respuesta correcta y cómo se relaciona con el aprendizaje."
    },
    {
      "id": "q2",
      "type": "command-fill",
      "question": "Escribe una pregunta de completación de comandos... (ej. ¿Qué opción de netcat se usa para escuchar puertos? nc ____ -p <puerto>)",
      "correctAnswer": "-l",
      "explanation": "La opción -l activa el modo de escucha en netcat."
    },
    {
      "id": "q3",
      "type": "active-recall",
      "question": "¿Cómo explicarías el ataque de inyección SQL a un desarrollador junior y cuál es la mitigación principal según tus notas?",
      "correctAnswer": "Explicación ideal que incluya sanitización y consultas preparadas (PreparedStatement).",
      "explanation": "El recuerdo activo te obliga a construir la respuesta, lo que consolida las sinapsis de memoria a largo plazo."
    }
  ]
}

Reglas críticas:
- Genera EXACTAMENTE 5 preguntas en total. Haz una buena mezcla de los tres tipos.
- No uses bloques de código envolventes de markdown como \`\`\`json ... \`\`\`.
- Redacta las preguntas en español con un tono estimulante, simulando un desafío de hacking/certificación (estilo OSCP o CEH).`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Genera un examen basado en este cuaderno:\n${contentContext}`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
      }
    });

    const parsedData = JSON.parse(response.text || '{}');
    res.json(parsedData);
  } catch (error: any) {
    console.error('Error en /api/gemini/quiz:', error);
    res.status(500).json({ error: error.message || 'Error al generar la autoevaluación' });
  }
});

// 4. Evaluar respuestas de tipo Active Recall (AI Grading)
app.post('/api/gemini/grade-recall', async (req, res) => {
  try {
    const { question, idealAnswer, userAnswer } = req.body;
    const client = getGeminiClient();

    const systemInstruction = `Eres un examinador de ciberseguridad robótico y objetivo.
Tu labor es calificar una respuesta corta escrita por el usuario, comparándola con la respuesta ideal del profesor.

Pregunta del Examen: "${question}"
Respuesta Ideal: "${idealAnswer}"
Respuesta del Usuario: "${userAnswer}"

Debes analizar si el usuario entiende el concepto clave, incluso si no usa las mismas palabras exactas. Sé justo pero riguroso (después de todo, un parámetro incorrecto en un comando o una falla en un script de exploit puede arruinar un pentest).

Devuelve EXACTAMENTE un objeto JSON con la siguiente estructura:
{
  "isCorrect": true o false,
  "scoreOutOf100": un número entre 0 y 100,
  "critique": "Una crítica concisa, en español, estilo terminal hacker, evaluando su precisión, felicitándolo por lo que acertó y corrigiendo de forma específica lo que falló."
}

No uses bloques de código envolventes de markdown. Devuelve solo el JSON crudo.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: 'Califica la respuesta del usuario.',
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
      }
    });

    const parsedData = JSON.parse(response.text || '{}');
    res.json(parsedData);
  } catch (error: any) {
    console.error('Error en /api/gemini/grade-recall:', error);
    res.status(500).json({ error: error.message || 'Error al calificar la respuesta activa' });
  }
});

// 5. Analizar el rendimiento total del examen y sugerir plan de estudio
app.post('/api/gemini/analyze-performance', async (req, res) => {
  try {
    const { questions, score, totalQuestions, notebookName } = req.body;
    const client = getGeminiClient();

    const quizDetails = questions.map((q: any) => {
      return `P: ${q.question}\nR. Usuario: ${q.userAnswer || 'No respondió'}\nCorrecto: ${q.isCorrect ? 'SÍ' : 'NO'}\nExplicación: ${q.explanation}\n---`;
    }).join('\n');

    const systemInstruction = `Eres el Analizador de Redes de Inteligencia y Tutor.
Tu tarea es examinar los resultados obtenidos por el hacker-alumno en su examen de autoevaluación del cuaderno "${notebookName}".
Obtuvo una puntuación de ${score}/${totalQuestions}.

Detalles del examen:
${quizDetails}

Genera un reporte de análisis detallado y un plan de acción de ciberseguridad en formato Markdown. Debe tener estilo de consola hacker:
- Una sección de diagnóstico con barras de progreso simuladas en texto (ej. [████░░░░░░] 40%) o indicadores de estado (ej. [CRÍTICO], [ALERTA], [ESTABLE]).
- Fortalezas detectadas de acuerdo a sus respuestas correctas.
- Debilidades críticas a corregir en sus comandos o teoría.
- Un mini plan de estudio/repaso personalizado para los próximos días utilizando técnicas de repetición espaciada y práctica en laboratorios.

Responde con texto de formato Markdown limpio, motivador y sumamente profesional.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: 'Genera el análisis de rendimiento de este examen.',
      config: {
        systemInstruction: systemInstruction,
      }
    });

    res.json({ analysis: response.text });
  } catch (error: any) {
    console.error('Error en /api/gemini/analyze-performance:', error);
    res.status(500).json({ error: error.message || 'Error al analizar el rendimiento del examen' });
  }
});


// 5. Sugerir detalles de vulnerabilidades para el registro de laboratorios prácticos
app.post('/api/gemini/vulnerability-suggest', async (req, res) => {
  try {
    const { vulnName } = req.body;
    if (!vulnName || vulnName.trim() === '') {
      return res.status(400).json({ error: 'El nombre de la vulnerabilidad es requerido.' });
    }

    const client = getGeminiClient();

    const systemInstruction = `Eres un analista senior de vulnerabilidades y probador de penetración.
Tu tarea es tomar el nombre o tipo de una vulnerabilidad (por ejemplo: "SQL Injection", "CVE-2021-44228", "Cross-Site Scripting (XSS)", "Default Credentials") y devolver una estructura formal, educativa y profesional en español.

Debes categorizar la severidad como una de las siguientes opciones: "baja", "media", "alta", o "crítica".
Proporciona una descripción clara y concisa en el campo 'description', y una guía de mitigación precisa y práctica en 'remediation'.

Debes estructurar tu respuesta EXACTAMENTE en el siguiente formato JSON:
{
  "name": "Nombre estandarizado o completo de la vulnerabilidad",
  "severity": "baja" | "media" | "alta" | "crítica",
  "description": "Una explicación técnica clara, concisa y profesional en español de cómo funciona la vulnerabilidad y el impacto de su explotación.",
  "remediation": "Pasos detallados y mejores prácticas de remediación/parcheo en español."
}

Responde ÚNICAMENTE con el objeto JSON válido. No uses bloques de código de markdown. Devuelve solo el JSON crudo.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Sujeto: "${vulnName}"`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.2,
      }
    });

    const parsedData = JSON.parse(response.text || '{}');
    res.json(parsedData);
  } catch (error: any) {
    console.error('Error en /api/gemini/vulnerability-suggest:', error);
    res.status(500).json({ error: error.message || 'Error al generar sugerencia de vulnerabilidad' });
  }
});

// 6. Generar reporte consolidado del laboratorio práctico (Auditoría/Cierre)
app.post('/api/gemini/lab-summarize', async (req, res) => {
  try {
    const { name, platform, date, notes, vulnerabilities } = req.body;
    const client = getGeminiClient();

    const systemInstruction = `Eres un Auditor de Seguridad de la Información Senior.
Tu tarea es revisar las notas de un laboratorio práctico de hacking ético realizado por el usuario, y generar un Reporte de Auditoría y Cierre de Laboratorio en formato Markdown en español.

El reporte debe tener un tono sumamente profesional, técnico e instructivo con estilo de consola hacker.
Debe estructurarse con:
1. UN ENCABEZADO DE SISTEMA (ej: [REPORTE DE AUDITORÍA DE SEGURIDAD - LAB: ${name.toUpperCase()}])
2. RESUMEN EJECUTIVO (Una vista general de alto nivel de lo que se probó, la plataforma [${platform}] y el estado de la evaluación).
3. MATRIZ DE RIESGOS (Un análisis en base a las vulnerabilidades encontradas: ${JSON.stringify(vulnerabilities)}. Incluye indicadores de severidad en texto de consola hacker como [CRÍTICA] o [ALTA]).
4. CONCLUSIONES TÉCNICAS Y RECOMENDACIONES (Sugerencias concretas de cómo el usuario puede consolidar el aprendizaje de esta máquina o lab, qué conceptos teóricos debería reforzar, y qué comandos o técnicas relacionados de su arsenal debería estudiar).

Responde con texto de formato Markdown limpio y sumamente profesional.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Por favor genera el reporte de cierre para el siguiente laboratorio:
Nombre: ${name}
Plataforma: ${platform}
Fecha: ${date}
Notas del Lab: ${notes}
Vulnerabilidades registradas: ${JSON.stringify(vulnerabilities)}`,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3,
      }
    });

    res.json({ summary: response.text });
  } catch (error: any) {
    console.error('Error en /api/gemini/lab-summarize:', error);
    res.status(500).json({ error: error.message || 'Error al generar reporte de cierre del laboratorio' });
  }
});


// --- INTEGRACIÓN DE VITE MIDDLEWARE ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HACK_NET] Servidor de Tutoría encendido en http://localhost:${PORT}`);
  });
}

startServer();
