# 📄 Product Requirements Document (PRD): Mushin

**Versión:** 1.1  
**Estado:** Borrador / Aprobado  
**Fecha:** 21 de Noviembre, 2024

---

## 1. Resumen Ejecutivo

**Mushin** (無心) es una aplicación de escritorio minimalista impulsada por IA.  
El nombre proviene del concepto Zen de "No-Mente" o "Mente sin mente" - un estado de flujo absoluto donde la acción ocurre sin vacilación ni sobrepensamiento.

A diferencia de los editores tradicionales, su paradigma es **"Captura y Fluye"**:  
el usuario introduce información en un flujo continuo y confía en la IA para recuperar esos datos a través de un chat contextual.  
La gestión manual de las notas se relega a un segundo plano (configuración) solo para fines de depuración y mantenimiento del conocimiento.

**Propuesta de Valor:**  
Eliminar la fricción de organizar carpetas y etiquetas. Tu "segundo cerebro" se ordena solo en tu propio dispositivo, permitiéndote actuar sin detenerte a pensar en la organización.

---

## 2. Stack Tecnológico (Local Desktop)

La arquitectura prioriza la privacidad (Local-First) y la potencia del ecosistema de Python para la IA, encapsulado en una app nativa ligera.

| Componente         | Tecnología Elegida          | Justificación                                         |
|--------------------|----------------------------|-------------------------------------------------------|
| **Frontend**       | Next.js + React            | Exportación estática (SSG), gran ecosistema de UI.    |
| **Estilos**        | Tailwind CSS + Shadcn/ui   | Diseño minimalista y componentes pre-hechos.          |
| **Desktop Wrapper**| Tauri v2 (Rust)            | Binario nativo ultra-ligero, gestión de ventanas y SO.|
| **Backend Logic**  | Python Sidecar             | Proceso hijo gestionado por Tauri. Facilita uso de librerías de IA.|
| **Base de Datos**  | SQLite + sqlite-vec        | BD local en fichero con búsqueda vectorial nativa.    |
| **Motor IA**       | OpenAI API                 | GPT-4o-mini (Chat) + text-embedding-3-small.          |

---

## 3. Especificaciones Funcionales

### 3.1. Módulo de Ingesta ("The Stream")

- **Vista principal** y por defecto de la aplicación.
- **Input de Texto:** Un campo de texto central (similar a una barra de búsqueda).
- **Acción de Guardado:** Al presionar *Enter*, el texto desaparece con una animación de "absorción".
- **Feedback:** Mensaje sutil temporal (“Memoria guardada”).
- **Proceso en Background:** El texto se envía al Sidecar de Python, se vectoriza y se guarda en el archivo SQLite local.  
  > El usuario **no ve una lista de notas** aquí.

---

### 3.2. Módulo de Consulta (Chat RAG)

- **Activación:**  
   El usuario cambia el modo del input (toggle) o escribe un prefijo (ej: `?`).
- **Interacción:** Chat tipo Q&A.

#### Lógica RAG

1. El Sidecar Python busca en SQLite vectores semánticamente similares.
2. Inyecta esos fragmentos en el prompt del LLM (vía OpenAI API).
3. Genera una respuesta basada estrictamente en esos fragmentos.

- **Citas:** La respuesta debe indicar la fuente temporal (ej: “Según lo anotado el 14 de Octubre...”)

---

### 3.3. Módulo de Mantenimiento ("The Memory Vault")

- Ubicado en **Ajustes > Gestionar Memorias**. Es la única forma de ver los datos crudos.

**Visualización:**  
Tabla densa y funcional *(No estética, utilitaria)* cargada desde SQLite.

- **Campos Visibles:** Fecha, Extracto de texto, Acciones.
- **Buscador Clásico:** Búsqueda por coincidencia de texto exacta (SQL `LIKE`) para encontrar notas específicas.

**Acciones CRUD:**
- **Editar:** Modificar el texto de un recuerdo (dispara re-indexación vectorial en background).
- **Eliminar:** Borrar un recuerdo falso u obsoleto.

---

## 4. Diseño de Base de Datos (Schema)

El sistema utiliza **SQLite** con la extensión `sqlite-vec` para almacenamiento local.

### Tabla `memories`
Almacena el conocimiento del usuario.

```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY, -- UUID generado por Python/Frontend
  content TEXT NOT NULL, -- El texto original
  embedding BLOB, -- Vector serializado o formato específico de sqlite-vec (ej. Float32Array)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, -- ISO 8601
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  source_type TEXT DEFAULT 'manual' -- 'manual', 'paste', 'import'
);

-- Índices vectoriales (dependientes de la implementación de sqlite-vec)
-- CREATE VIRTUAL TABLE vec_memories USING vec0(embedding float[1536]);
```

### Tabla `chat_history` (Opcional para MVP)
Para mantener el contexto de la conversación actual.

```sql
CREATE TABLE chat_history (
  id TEXT PRIMARY KEY,
  role TEXT, -- 'user' o 'assistant'
  message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Lógica del Sistema (AI Prompting)

Este es el *System Prompt* que gobernará el comportamiento de la IA.

- **Rol:** Eres el sistema de memoria auxiliar del usuario.
- **Instrucciones:**
    - Responde basándote **EXCLUSIVAMENTE** en el apartado CONTEXTO proporcionado abajo.
    - Si la respuesta no está en el contexto, responde: `"No tengo ese dato en la memoria"`. No alucines información externa.
    - **Prioridad Temporal:** Si hay dos notas contradictorias, la más reciente (por `created_at`) es la válida, pero informa la discrepancia.
    - Sé extremadamente **conciso y directo**.

> Contexto Recuperado: `{context_chunks_with_dates}`

---

## 6. Requisitos No Funcionales

- **Latencia UI:** El guardado debe sentirse instantáneo (Optimistic UI). La indexación en Python ocurre asíncronamente.
- **Privacidad (Local-First):** Todos los datos residen en el disco del usuario (`app_data_dir`). 
  - Solo se envían a OpenAI: el texto para generar embeddings y los fragmentos relevantes durante el chat.
  - La API Key de OpenAI se almacena en el Keychain del sistema operativo (seguro).
- **Conectividad:** Requiere internet para interactuar con OpenAI. El resto de la app (guardado, búsqueda por texto, visualización) funciona offline.

---

## 7. Hoja de Ruta (Roadmap MVP)

1. **Fase 1: The Foundation (Tauri + Sidecar)**
    - Inicializar proyecto Tauri v2.
    - Configurar Python Sidecar (con `uv` o `poetry` para dependencias).
    - Implementar comunicación IPC (Rust <-> Python) y persistencia en SQLite.

2. **Fase 2: The Stream (Frontend)**
    - Interfaz de escritura y animación de "desaparición".
    - Comandos Tauri para enviar texto al Sidecar.

3. **Fase 3: The Brain (RAG Local)**
    - Implementar lógica de búsqueda vectorial en Python (`sqlite-vec`).
    - Integración con OpenAI API desde el Sidecar.
    - Interfaz de Chat.

4. **Fase 4: The Vault (Settings)**
    - CRUD de notas sobre SQLite.
