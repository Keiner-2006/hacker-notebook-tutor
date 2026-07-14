<div align="center">
<img width="1200" alt="Hacker Notebook Tutor" src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80" />
</div>

# Hacker Notebook Tutor

Hacker Notebook Tutor es una aplicación profesional de laboratorio de ciberseguridad diseñada para gestionar notas, ejercicios y evaluaciones con asistencia avanzada de IA.

## Qué hace

- Administra notebooks de ciberseguridad y contenido técnico con persistencia en Firebase Firestore.
- Soporta autenticación de usuarios con Firebase Auth y vínculo seguro de credenciales.
- Integra un modelo de lenguaje para ayudar con explicaciones, sugerencias y generación de contenido de ataque/defensa.
- Proporciona un centro de evaluación para seguimiento de resultados, estado de laboratorio y actividades prácticas.

## Arquitectura técnica

- Frontend: React + TypeScript + Vite
- Backend local: `server.ts` con integración de LLM
- Persistencia: Firebase Firestore y Firebase Authentication
- IA: Gemini a través de `@google/genai`

## Graphify

Este proyecto incluye Graphify para analizar la estructura de código y las dependencias del proyecto. Con Graphify ahorramos tiempo evitando búsquedas manuales archivo por archivo, porque permite explorar rápidamente relaciones, nodos clave y dependencias técnicas.

## Cómo ejecutar

1. Instala dependencias:
   `npm install`
2. Configura tu entorno en `.env.local` con `GEMINI_API_KEY`, `APP_URL` y `PORT` opcional.
3. Inicia el servidor de desarrollo:
   `npm run dev`
4. Abre la app en el navegador en `http://localhost:3001` o el puerto configurado.

## Estructura clave

- `src/App.tsx` — gestión del estado global de la aplicación y carga de notebooks.
- `src/components/Login.tsx` — autenticación y gestión de inicio de sesión.
- `src/lib/db.ts` — lógica de acceso a Firestore.
- `server.ts` — endpoint local del LLM y procesamiento de solicitudes de IA.

## Por qué es útil

Hacker Notebook Tutor combina una experiencia de laboratorio moderna con un asistente de inteligencia artificial para mejorar la productividad en ciberseguridad. La integración de Firebase garantiza persistencia segura de datos, mientras que la capa de LLM aporta apoyo contextual avanzado y respuestas inteligentes.
