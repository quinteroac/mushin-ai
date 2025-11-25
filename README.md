# 🧠 Mushin

Minimal notepad powered by AI -- a frictionless, local-first "second brain".  
Capture thoughts in a stream, retrieve them via contextual chat. No folders, no tags, no clutter.

---

## ✨ Features

- **"Stream" Input**: Write anything — every line is captured and stored without manual organization.
- **AI Chat Retrieval (RAG)**: Ask questions or recall information via a chat interface backed by semantic search.
- **Local-First Privacy**: All data is kept private, using a local SQLite database with vector search.
- **Fast, Minimal UI**: Focused, distraction-free design for rapid note capture and review.

---

## 🚀 Getting Started

To run the app locally:

```bash
cd app
npm install
npm run dev
```

Or use your package manager of choice (`yarn dev`, `pnpm dev`, etc).

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🖥️ Tech Stack

- **Frontend**: Next.js (app directory) + Tailwind CSS + Shadcn/ui
- **Desktop Wrapper**: Tauri v2 (Rust)
- **Backend/AI**: Python sidecar process
- **DB**: SQLite (with vector search via `sqlite-vec`)
- **Model**: OpenAI API (GPT-4o-mini, text-embedding-3-small)

---

## 📝 Usage

- Start the app — the main input acts like a capture bar.
- Hit Enter to save a thought.
- Toggle to Chat/RAG mode (`?` prefix or switch) to ask questions and retrieve related notes via AI.

No manual note management — just flow.

---

## 🛠️ Development

- Edit UI in `app/` (main page: `app/app/page.tsx`)
- Python sidecar and DB logic are found under `python-backend/` and `app/src-tauri/`
- Uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) for font optimization (Geist)

---

## 📚 Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [Tauri Docs](https://tauri.app/v2/guides/)
- [Shadcn/ui](https://ui.shadcn.com/)

---

## ⚡ Deployment

The app is intended for **local use** (desktop, with Tauri).  
Web deployment possible, but disables local AI integration and loses privacy guarantees.

---

## 🧩 Contributions

PRs & discussions are welcome!

