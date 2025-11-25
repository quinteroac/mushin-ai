# 🛠️ Resumen de Inicialización del Proyecto

Este documento registra los comandos ejecutados para establecer la arquitectura base de **Mushin** (Tauri + Next.js + Python Sidecar).

## 1. Prerrequisitos e Instalación de Herramientas

Instalación de **Bun** (Gestor de paquetes y runtime rápido) en Windows.

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
$env:PATH += ";C:\Users\puert\.bun\bin"
```

Instalación de **Rust** (Necesario para compilar Tauri).

```powershell
# Descarga e instalación automática del toolchain estable
Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "rustup-init.exe"; .\rustup-init.exe -y
$env:PATH += ";$env:USERPROFILE\.cargo\bin"
```

## 2. Inicialización del Frontend (Next.js)

Creación de la aplicación Next.js con App Router, TypeScript y Tailwind.

```bash
# Se usó --yes para configuración no interactiva
bun create next-app app --typescript --tailwind --eslint --no-src-dir --import-alias "@/*" --app --no-turbopack --yes
```

## 3. Inicialización de Tauri (Desktop Wrapper)

Integración de Tauri v2 dentro del directorio `app/`.

```bash
cd app
bun add -D @tauri-apps/cli@latest

# Inicialización con parámetros CI para evitar prompts
# --frontend-dist out: Carpeta de exportación estática de Next.js
# --dev-url: URL del servidor de desarrollo de Next.js
./node_modules/.bin/tauri init --ci --app-name mushin --window-title Mushin --frontend-dist out --dev-url http://localhost:3000 --before-build-command "bun run build" --before-dev-command "bun run dev"
```

## 4. Inicialización del Backend (Python Sidecar)

Configuración del entorno Python usando `uv` para gestión rápida de dependencias.

```bash
cd .. # Volver a la raíz
mkdir python-backend
cd python-backend
uv init

# Instalación de dependencias clave
uv add fastapi uvicorn sqlite-vec
```

## 5. Integración de Desarrollo

Configuración para ejecutar Frontend, Tauri y Backend simultáneamente.

```bash
cd ../app
bun add -D concurrently
```

Se modificó `app/package.json` para incluir el script `dev:all`:

```json
"scripts": {
  "dev:all": "concurrently \"npm:tauri dev\" \"cd ../python-backend && uv run main.py\""
}
```

## Cómo ejecutar el proyecto

Desde el directorio `app/`:

```bash
bun run dev:all
```

