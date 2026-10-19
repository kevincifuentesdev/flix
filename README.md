# Flix

Repositorio unificado (monorepo) del proyecto **Flix** — plataforma de streaming de películas y series. Integra en un solo lugar tanto la aplicación web (**Frontend**) como la API REST (**Backend**), junto con la configuración para bases de datos, contenedores Docker y pipelines de CI/CD.

- **Demo desplegada:** https://flix-murex-alpha.vercel.app
- **Documentación específica por módulo:**
  - Frontend: [`frontend/README.MD`](frontend/README.MD)
  - Backend: [`backend/README.md`](backend/README.md)
  - Especificación y referencia de la API: [`backend/api-docs/README.md`](backend/api-docs/README.md) / [`backend/api-docs/openapi.json`](backend/api-docs/openapi.json)

---

## Tabla de contenido

1. [Arquitectura y tecnologías](#1-arquitectura-y-tecnologías)
2. [Estructura del repositorio](#2-estructura-del-repositorio)
3. [Requisitos](#3-requisitos)
4. [Cómo descargar el proyecto](#4-cómo-descargar-el-proyecto)
5. [Variables de entorno](#5-variables-de-entorno)
6. [Ejecución local (sin Docker)](#6-ejecución-local-sin-docker)
7. [Ejecución con Docker](#7-ejecución-con-docker)
8. [Base de datos, migraciones y datos semilla](#8-base-de-datos-migraciones-y-datos-semilla)
9. [Scripts disponibles](#9-scripts-disponibles)
10. [Pruebas end-to-end (Playwright)](#10-pruebas-end-to-end-playwright)
11. [Integración continua (Jenkins)](#11-integración-continua-jenkins)
12. [Documentación de la API](#12-documentación-de-la-api)
13. [Repositorios relacionados](#13-repositorios-relacionados)

---

## 1. Arquitectura y tecnologías

El proyecto se divide en dos aplicaciones principales que se comunican mediante HTTP y comparten servicios externos de metadatos ([TMDB](https://www.themoviedb.org/)) y streaming de video ([Mux](https://www.mux.com/)).

### 1.1. Frontend (`frontend/`)

| Tecnología | Versión | Uso |
| --- | --- | --- |
| Node.js | 22 (`node:22-alpine` / `node:22-bookworm`) | Entorno de ejecución |
| Next.js | ^16.3.1 | Framework React (App Router, salida `standalone`) |
| React / React DOM | 19.2.4 | Interfaz de usuario |
| TypeScript | ^5 | Lenguaje |
| Tailwind CSS | ^4 (`@tailwindcss/postcss`) | Estilos |
| GSAP + @gsap/react | ^3.15.0 / ^2.1.2 | Animaciones |
| Supabase (`supabase-js`, `@supabase/ssr`) | ^2.111.0 / ^0.12.3 | Base de datos y servicios adicionales |
| better-auth | ^1.7.7 | Cliente de autenticación |
| Mux (`@mux/mux-player-react`, `@mux/mux-node`) | ^3.2.0 / ^8.8.0 | Reproducción de video |
| lucide-react | ^1.26.0 | Iconos |
| date-fns, clsx, tailwind-merge | ^4.1.0, ^2.1.1, ^3.6.0 | Utilidades |
| ESLint / Prettier | ^9 / ^3.9.6 | Linter y formato de código |
| Playwright | 1.52.0 (en CI) | Pruebas end-to-end |

### 1.2. Backend (`backend/`)

| Tecnología | Versión | Uso |
| --- | --- | --- |
| Node.js | 22 (`node:22-alpine`) | Entorno de ejecución |
| TypeScript | ^7.0.2 | Lenguaje (módulos ES, `"type": "module"`) |
| Express | ^5.2.1 | Framework HTTP |
| PostgreSQL | 17 (`postgres:17-alpine`) | Base de datos relacional |
| Drizzle ORM / Drizzle Kit | ^1.0.0-rc.4 | ORM, esquema y migraciones |
| pg (node-postgres) | ^8.23.0 | Driver de PostgreSQL |
| better-auth | ^1.7.5 | Servidor de autenticación |
| @mux/mux-node | ^15.2.0 | Integración con Mux para video streaming |
| swagger-ui-express | ^5.0.1 | Documentación interactiva OpenAPI 3.0 |
| cors / dotenv | ^2.8.6 / ^18.0.1 | CORS y variables de entorno |
| tsx / nodemon | ^4.23.13 / ^3.1.14 | Ejecución y recarga en desarrollo |

---

## 2. Estructura del repositorio

```
flix/
├── backend/                         # API REST con Express, Drizzle y PostgreSQL
│   ├── api-docs/                    # Especificación OpenAPI 3.0 y guía de endpoints
│   ├── drizzle/                     # Migraciones SQL generadas por Drizzle Kit
│   ├── scripts/                     # Scripts de migración automática y datos semilla (CSV)
│   ├── src/                         # Código fuente del servidor (punto de entrada: src/index.ts)
│   ├── Dockerfile                   # Imagen multi-stage del backend
│   ├── docker-compose.yml           # Backend + PostgreSQL
│   ├── docker-compose.dev.yml       # Stack completo (backend + db + frontend)
│   ├── drizzle.config.ts            # Configuración de Drizzle Kit
│   ├── Jenkinsfile                  # Pipeline CI/CD del backend
│   └── package.json
│
├── frontend/                        # Aplicación web con Next.js (App Router)
│   ├── app/                         # Rutas y páginas
│   ├── components/                  # Componentes de interfaz de usuario
│   ├── lib/                         # Clientes de API y utilidades
│   ├── src/db/                      # Acceso a datos en el cliente/servidor
│   ├── scripts/                     # Scripts de utilidad (p. ej. test-tmdb.ts)
│   ├── supabase/migrations/         # Migraciones SQL de Supabase
│   ├── tests/                       # Pruebas end-to-end con Playwright (smoke.spec.js)
│   ├── Dockerfile                   # Imagen multi-stage del frontend (standalone)
│   ├── docker-compose.yml           # Solo el contenedor del frontend
│   ├── docker-compose.dev.yml       # Stack completo (frontend + backend + db)
│   ├── Jenkinsfile                  # Pipeline CI/CD del frontend
│   ├── next.config.ts
│   ├── playwright.config.js
│   └── package.json
│
└── README.md                        # Este archivo
```

---

## 3. Requisitos

**Para ejecutar con Docker (recomendado):**

- [Docker](https://docs.docker.com/get-docker/) y Docker Compose v2 (`docker compose`).
- Archivos `.env` configurados en `backend/.env` y `frontend/.env` (ver [sección 5](#5-variables-de-entorno)).

**Para ejecutar en local sin Docker:**

- [Node.js 22](https://nodejs.org/) y npm.
- Una instancia de [PostgreSQL 17](https://www.postgresql.org/download/) en ejecución.
- Proyecto configurado en [Supabase](https://supabase.com/).
- Credenciales de [TMDB](https://www.themoviedb.org/) y [Mux](https://www.mux.com/).

---

## 4. Cómo descargar el proyecto

### Opción A: clonar el monorepo

```bash
git clone https://github.com/kevincifuentesdev/flix.git
cd flix
```

### Opción B: descargar las imágenes desde Docker Hub

```bash
docker pull kevinmateog/flix-backend:latest
docker pull kevinmateog/flix-frontend:latest
```

---

## 5. Variables de entorno

Cada aplicación gestiona su propio archivo `.env` dentro de su respectiva carpeta (`backend/.env` y `frontend/.env`). **Ninguno de los dos archivos debe subirse al repositorio.**

### 5.1. Backend (`backend/.env`)

```env
# Servidor
PORT=3000
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

# Base de datos (para ejecución local sin Docker)
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/flix

# Autenticación (better-auth)
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<cadena-aleatoria-larga>

# TMDB
TMDB_API_KEY=<tu-api-key>
TMDB_READ_ACCESS_TOKEN=<tu-token>

# Mux
MUX_TOKEN_ID=<tu-token-id>
MUX_TOKEN_SECRET=<tu-token-secret>
PUBLIC_MUX_PLAYBACK_DOMAIN=<dominio-de-reproducción>

# PostgreSQL (usadas por docker-compose para crear la base de datos)
POSTGRES_DB=flix
POSTGRES_USER=flix_user
POSTGRES_PASSWORD=<contraseña-segura>
```

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto en el que escucha la API (por defecto `3000`). |
| `FRONTEND_URL` | URL del frontend (origen permitido por CORS). |
| `BACKEND_URL` | URL pública del backend. |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL. Con Docker Compose se construye automáticamente a partir de `POSTGRES_*`. |
| `BETTER_AUTH_URL` | URL base de better-auth (por defecto `http://localhost:3000`). |
| `BETTER_AUTH_SECRET` | Secreto para firmar sesiones (puedes generarlo con `openssl rand -base64 32`). |
| `BETTER_AUTH_TRUSTED_ORIGINS` | *(Opcional en Docker)* Orígenes confiables separados por coma (`http://localhost:5173,http://localhost:3000`). |
| `TMDB_API_KEY` / `TMDB_READ_ACCESS_TOKEN` | Credenciales de la API de TMDB. |
| `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` | Credenciales de la API de Mux. |
| `PUBLIC_MUX_PLAYBACK_DOMAIN` | Dominio de reproducción de Mux. |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Credenciales para el contenedor de PostgreSQL. |

### 5.2. Frontend (`frontend/.env`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=<url-del-proyecto-supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# TMDB
TMDB_API_KEY=<tu-api-key>
TMDB_READ_ACCESS_TOKEN=<tu-token>
TMDB_BASE_URL=https://api.themoviedb.org/3
TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p

# Mux
MUX_TOKEN_ID=<tu-token-id>
MUX_TOKEN_SECRET=<tu-token-secret>
NEXT_PUBLIC_MUX_PLAYBACK_DOMAIN=<dominio-de-reproducción>

# Aplicación
NEXT_PUBLIC_APP_URL=http://localhost:5173
BACKEND=http://localhost:3000
PORT=5173
```

| Variable | Descripción |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | URL y clave pública (`anon`) del proyecto en Supabase. |
| `TMDB_API_KEY` / `TMDB_READ_ACCESS_TOKEN` | Credenciales de la API de TMDB. |
| `TMDB_BASE_URL` / `TMDB_IMAGE_BASE_URL` | URL base de la API y de las imágenes de TMDB (`image.tmdb.org/t/p/**`). |
| `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` | Credenciales de la API de Mux. |
| `NEXT_PUBLIC_MUX_PLAYBACK_DOMAIN` | Dominio de reproducción de Mux. |
| `NEXT_PUBLIC_APP_URL` | URL pública del frontend. |
| `BACKEND` | URL del backend de Flix (`http://localhost:3000`). |
| `PORT` | Puerto del servidor frontend (por defecto `5173`). |

---

## 6. Ejecución local (sin Docker)

Para levantar todo el entorno en desarrollo necesitarás dos terminales (una para el backend y otra para el frontend), además de tener PostgreSQL activo.

### Paso 1: levantar el Backend

```bash
cd backend

# 1. Instalar dependencias
npm ci

# 2. Configurar backend/.env con DATABASE_URL apuntando a tu PostgreSQL

# 3. Aplicar migraciones y (opcionalmente) datos semilla
npx drizzle-kit migrate
node scripts/seed-data.mjs

# 4. Iniciar servidor en modo desarrollo (puerto 3000)
npm run dev
```

### Paso 2: levantar el Frontend

```bash
cd frontend

# 1. Instalar dependencias
npm ci

# 2. Configurar frontend/.env con BACKEND=http://localhost:3000

# 3. Iniciar servidor de desarrollo (puerto 5173)
npm run dev
```

- **Frontend:** `http://localhost:5173`
- **Backend (API):** `http://localhost:3000`
- **Swagger UI:** `http://localhost:3000/api-docs`

---

## 7. Ejecución con Docker

### 7.1. Por servicio individual

**Backend + PostgreSQL (`backend/docker-compose.yml`):**

```bash
cd backend
docker compose up -d
```

- Levanta PostgreSQL 17 y `kevinmateog/flix-backend`.
- Ejecuta automáticamente las migraciones (`migrate-if-needed.mjs`) y la carga de datos semilla (`seed-data.mjs`) al iniciar el contenedor.

**Frontend (`frontend/docker-compose.yml`):**

```bash
cd frontend
docker compose up -d
```

- Levanta `kevinmateog/flix-frontend` en el puerto `5173` y se conecta al backend del host mediante `host.docker.internal:3000`.

### 7.2. Stack completo (`docker-compose.dev.yml`)

Tanto `backend/docker-compose.dev.yml` como `frontend/docker-compose.dev.yml` levantan los tres contenedores (**PostgreSQL 17 + Backend + Frontend**) en una misma red, esperando a que la base de datos y el backend pasen sus respectivos `healthchecks`.

> **Nota sobre rutas de `.env` en `docker-compose.dev.yml`:** Los archivos `docker-compose.dev.yml` referencian `../flix-backend/.env` y `../flix-frontend/.env` (pensados para cuando ambos repositorios están clonados como carpetas hermanas `flix-backend/` y `flix-frontend/`). Si ejecutas desde este monorepo (`backend/` y `frontend/`), asegúrate de ajustar `env_file` a `../backend/.env` y `../frontend/.env` o crear enlaces simbólicos equivalentes.

- **Frontend:** `http://localhost:5173`
- **Backend:** `http://localhost:3000`
- **PostgreSQL:** `localhost:5432`

### 7.3. Construir las imágenes manualmente

```bash
# Construir imagen del backend
cd backend
docker build -t kevinmateog/flix-backend:latest .

# Construir imagen del frontend
cd ../frontend
docker build \
  --build-arg BACKEND=http://localhost:3000 \
  --build-arg NEXT_PUBLIC_URL=http://localhost:5173 \
  -t kevinmateog/flix-frontend:latest .
```

---

## 8. Base de datos, migraciones y datos semilla

### 8.1. PostgreSQL + Drizzle ORM (Backend)

El esquema principal se define en `backend/src/db/schema.ts` y las migraciones generadas se almacenan en `backend/drizzle/`. Los datos iniciales se encuentran en archivos CSV dentro de `backend/scripts/` (`playable-content.csv`, `my-list.csv`, `watch-history.csv`).

```bash
cd backend

# Generar una nueva migración tras modificar src/db/schema.ts
npx drizzle-kit generate

# Aplicar migraciones manualmente
npx drizzle-kit migrate

# Aplicar migraciones solo si hacen falta y poblar datos iniciales
node scripts/migrate-if-needed.mjs
node scripts/seed-data.mjs
```

### 8.2. Supabase (Frontend)

Las migraciones SQL de Supabase se encuentran en `frontend/supabase/migrations/`:

| Migración | Descripción |
| --- | --- |
| `20260725210000_profiles_table.sql` | Tabla de perfiles |
| `20260726000001_watch_history.sql` | Historial de reproducción |
| `20260726000002_my_list.sql` | Lista personal (“Mi lista”) |
| `20260726000003_profiles_region.sql` | Región en perfiles |
| `20260728000004_watch_history_unique_identity.sql` | Identidad única en el historial |
| `20260730000005_dislikes.sql` | Registro de “No me gusta” |

Para aplicarlas mediante la [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
cd frontend
supabase link --project-ref <tu-project-ref>
supabase db push
```

---

## 9. Scripts disponibles

### Backend (`cd backend`)

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor en desarrollo con `nodemon` + `tsx`. |
| `npm run build` | Compila el proyecto TypeScript a `dist/`. |
| `npm start` | Ejecuta la versión compilada (`node dist/index.js`). |

### Frontend (`cd frontend`)

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo de Next.js en el puerto `5173`. |
| `npm run build` | Compila la aplicación para producción. |
| `npm start` | Inicia el servidor de producción de Next.js. |
| `npm run lint` | Ejecuta el análisis estático con ESLint. |
| `npm run format` | Formatea el código con Prettier. |
| `npm run format:check` | Verifica el formato del código sin modificar archivos. |

---

## 10. Pruebas end-to-end (Playwright)

Las pruebas end-to-end del frontend se ubican en `frontend/tests/` (`smoke.spec.js`) y se configuran en `frontend/playwright.config.js` (usando Chromium contra `http://127.0.0.1:5173`, configurable mediante `PLAYWRIGHT_BASE_URL`).

Para ejecutarlas en local:

```bash
cd frontend

# 1. Compilar e iniciar la aplicación en el puerto 5173 (en una terminal)
npm run build
npm start   # o npm run dev

# 2. Instalar Playwright puntualmente y ejecutar las pruebas (en otra terminal)
npm install --no-save --package-lock=false --ignore-scripts @playwright/test@1.52.0
npx playwright install --with-deps chromium
npx playwright test
```

El reporte HTML queda disponible en `frontend/playwright-report/`.

---

## 11. Integración continua (Jenkins)

Tanto `backend/Jenkinsfile` como `frontend/Jenkinsfile` definen pipelines automatizados de CI/CD:

1. **Npm Install**: Instala dependencias con `npm ci` en un contenedor Node.js 22.
2. **Build**: Ejecuta `npm run build` para validar la compilación.
3. **Playwright Test** *(solo en Frontend)*: Instala Playwright + Chromium, levanta el servidor `standalone` en `127.0.0.1:5173`, espera a que `/login` responda y ejecuta los tests end-to-end.
4. **Docker Build**: Construye las imágenes `kevinmateog/flix-backend` y `kevinmateog/flix-frontend` etiquetadas con `$BUILD_NUMBER` y `latest`.
5. **Docker Push**: Publica las imágenes en Docker Hub usando la credencial `dockerHub` configurada en Jenkins.

---

## 12. Documentación de la API

El backend cuenta con documentación completa bajo el estándar **OpenAPI 3.0 (Swagger)**:

- **Swagger UI interactivo** (con el backend corriendo): `http://localhost:3000/api-docs`
- **Especificación JSON en vivo**: `http://localhost:3000/api-docs.json`
- **Archivo OpenAPI estático**: [`backend/api-docs/openapi.json`](backend/api-docs/openapi.json)
- **Guía detallada de endpoints en Markdown**: [`backend/api-docs/README.md`](backend/api-docs/README.md)

---

## 13. Repositorios relacionados

- Repositorio del Frontend: [KevinMateoG/flix-frontend](https://github.com/KevinMateoG/flix-frontend)
- Repositorio del Backend: [KevinMateoG/flix-backend](https://github.com/KevinMateoG/flix-backend)
- Proyecto base original (fork): [EmanuelGarciaR/flix](https://github.com/EmanuelGarciaR/flix)

Repositorio unificado (monorepo) del proyecto **Flix** — plataforma de streaming de películas y series. Integra en un solo lugar tanto la aplicación web (**Frontend**) como la API REST (**Backend**), junto con la configuración para bases de datos, contenedores Docker y pipelines de CI/CD.

- **Demo desplegada:** https://flix-murex-alpha.vercel.app
- **Documentación específica por módulo:**
  - Frontend: [`frontend/README.MD`](frontend/README.MD)
  - Backend: [`backend/README.md`](backend/README.md)
  - Especificación y referencia de la API: [`backend/api-docs/README.md`](backend/api-docs/README.md) / [`backend/api-docs/openapi.json`](backend/api-docs/openapi.json)

---

## Tabla de contenido

1. [Arquitectura y tecnologías](#1-arquitectura-y-tecnologías)
2. [Estructura del repositorio](#2-estructura-del-repositorio)
3. [Requisitos](#3-requisitos)
4. [Cómo descargar el proyecto](#4-cómo-descargar-el-proyecto)
5. [Variables de entorno](#5-variables-de-entorno)
6. [Ejecución local (sin Docker)](#6-ejecución-local-sin-docker)
7. [Ejecución con Docker](#7-ejecución-con-docker)
8. [Base de datos, migraciones y datos semilla](#8-base-de-datos-migraciones-y-datos-semilla)
9. [Scripts disponibles](#9-scripts-disponibles)
10. [Pruebas end-to-end (Playwright)](#10-pruebas-end-to-end-playwright)
11. [Integración continua (Jenkins)](#11-integración-continua-jenkins)
12. [Documentación de la API](#12-documentación-de-la-api)
13. [Repositorios relacionados](#13-repositorios-relacionados)

---

## 1. Arquitectura y tecnologías

El proyecto se divide en dos aplicaciones principales que se comunican mediante HTTP y comparten servicios externos de metadatos ([TMDB](https://www.themoviedb.org/)) y streaming de video ([Mux](https://www.mux.com/)).

### 1.1. Frontend (`frontend/`)

| Tecnología | Versión | Uso |
| --- | --- | --- |
| Node.js | 22 (`node:22-alpine` / `node:22-bookworm`) | Entorno de ejecución |
| Next.js | ^16.3.1 | Framework React (App Router, salida `standalone`) |
| React / React DOM | 19.2.4 | Interfaz de usuario |
| TypeScript | ^5 | Lenguaje |
| Tailwind CSS | ^4 (`@tailwindcss/postcss`) | Estilos |
| GSAP + @gsap/react | ^3.15.0 / ^2.1.2 | Animaciones |
| Supabase (`supabase-js`, `@supabase/ssr`) | ^2.111.0 / ^0.12.3 | Base de datos y servicios adicionales |
| better-auth | ^1.7.7 | Cliente de autenticación |
| Mux (`@mux/mux-player-react`, `@mux/mux-node`) | ^3.2.0 / ^8.8.0 | Reproducción de video |
| lucide-react | ^1.26.0 | Iconos |
| date-fns, clsx, tailwind-merge | ^4.1.0, ^2.1.1, ^3.6.0 | Utilidades |
| ESLint / Prettier | ^9 / ^3.9.6 | Linter y formato de código |
| Playwright | 1.52.0 (en CI) | Pruebas end-to-end |

### 1.2. Backend (`backend/`)

| Tecnología | Versión | Uso |
| --- | --- | --- |
| Node.js | 22 (`node:22-alpine`) | Entorno de ejecución |
| TypeScript | ^7.0.2 | Lenguaje (módulos ES, `"type": "module"`) |
| Express | ^5.2.1 | Framework HTTP |
| PostgreSQL | 17 (`postgres:17-alpine`) | Base de datos relacional |
| Drizzle ORM / Drizzle Kit | ^1.0.0-rc.4 | ORM, esquema y migraciones |
| pg (node-postgres) | ^8.23.0 | Driver de PostgreSQL |
| better-auth | ^1.7.5 | Servidor de autenticación |
| @mux/mux-node | ^15.2.0 | Integración con Mux para video streaming |
| swagger-ui-express | ^5.0.1 | Documentación interactiva OpenAPI 3.0 |
| cors / dotenv | ^2.8.6 / ^18.0.1 | CORS y variables de entorno |
| tsx / nodemon | ^4.23.13 / ^3.1.14 | Ejecución y recarga en desarrollo |

---

## 2. Estructura del repositorio

```
flix/
├── backend/                         # API REST con Express, Drizzle y PostgreSQL
│   ├── api-docs/                    # Especificación OpenAPI 3.0 y guía de endpoints
│   ├── drizzle/                     # Migraciones SQL generadas por Drizzle Kit
│   ├── scripts/                     # Scripts de migración automática y datos semilla (CSV)
│   ├── src/                         # Código fuente del servidor (punto de entrada: src/index.ts)
│   ├── Dockerfile                   # Imagen multi-stage del backend
│   ├── docker-compose.yml           # Backend + PostgreSQL
│   ├── docker-compose.dev.yml       # Stack completo (backend + db + frontend)
│   ├── drizzle.config.ts            # Configuración de Drizzle Kit
│   ├── Jenkinsfile                  # Pipeline CI/CD del backend
│   └── package.json
│
├── frontend/                        # Aplicación web con Next.js (App Router)
│   ├── app/                         # Rutas y páginas
│   ├── components/                  # Componentes de interfaz de usuario
│   ├── lib/                         # Clientes de API y utilidades
│   ├── src/db/                      # Acceso a datos en el cliente/servidor
│   ├── scripts/                     # Scripts de utilidad (p. ej. test-tmdb.ts)
│   ├── supabase/migrations/         # Migraciones SQL de Supabase
│   ├── tests/                       # Pruebas end-to-end con Playwright (smoke.spec.js)
│   ├── Dockerfile                   # Imagen multi-stage del frontend (standalone)
│   ├── docker-compose.yml           # Solo el contenedor del frontend
│   ├── docker-compose.dev.yml       # Stack completo (frontend + backend + db)
│   ├── Jenkinsfile                  # Pipeline CI/CD del frontend
│   ├── next.config.ts
│   ├── playwright.config.js
│   └── package.json
│
└── README.md                        # Este archivo
```

---

## 3. Requisitos

**Para ejecutar con Docker (recomendado):**

- [Docker](https://docs.docker.com/get-docker/) y Docker Compose v2 (`docker compose`).
- Archivos `.env` configurados en `backend/.env` y `frontend/.env` (ver [sección 5](#5-variables-de-entorno)).

**Para ejecutar en local sin Docker:**

- [Node.js 22](https://nodejs.org/) y npm.
- Una instancia de [PostgreSQL 17](https://www.postgresql.org/download/) en ejecución.
- Proyecto configurado en [Supabase](https://supabase.com/).
- Credenciales de [TMDB](https://www.themoviedb.org/) y [Mux](https://www.mux.com/).

---

## 4. Cómo descargar el proyecto

### Opción A: clonar el monorepo

```bash
git clone https://github.com/kevincifuentesdev/flix.git
cd flix
```

### Opción B: descargar las imágenes desde Docker Hub

```bash
docker pull kevinmateog/flix-backend:latest
docker pull kevinmateog/flix-frontend:latest
```

---

## 5. Variables de entorno

Cada aplicación gestiona su propio archivo `.env` dentro de su respectiva carpeta (`backend/.env` y `frontend/.env`). **Ninguno de los dos archivos debe subirse al repositorio.**

### 5.1. Backend (`backend/.env`)

```env
# Servidor
PORT=3000
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

# Base de datos (para ejecución local sin Docker)
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/flix

# Autenticación (better-auth)
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<cadena-aleatoria-larga>

# TMDB
TMDB_API_KEY=<tu-api-key>
TMDB_READ_ACCESS_TOKEN=<tu-token>

# Mux
MUX_TOKEN_ID=<tu-token-id>
MUX_TOKEN_SECRET=<tu-token-secret>
PUBLIC_MUX_PLAYBACK_DOMAIN=<dominio-de-reproducción>

# PostgreSQL (usadas por docker-compose para crear la base de datos)
POSTGRES_DB=flix
POSTGRES_USER=flix_user
POSTGRES_PASSWORD=<contraseña-segura>
```

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto en el que escucha la API (por defecto `3000`). |
| `FRONTEND_URL` | URL del frontend (origen permitido por CORS). |
| `BACKEND_URL` | URL pública del backend. |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL. Con Docker Compose se construye automáticamente a partir de `POSTGRES_*`. |
| `BETTER_AUTH_URL` | URL base de better-auth (por defecto `http://localhost:3000`). |
| `BETTER_AUTH_SECRET` | Secreto para firmar sesiones (puedes generarlo con `openssl rand -base64 32`). |
| `BETTER_AUTH_TRUSTED_ORIGINS` | *(Opcional en Docker)* Orígenes confiables separados por coma (`http://localhost:5173,http://localhost:3000`). |
| `TMDB_API_KEY` / `TMDB_READ_ACCESS_TOKEN` | Credenciales de la API de TMDB. |
| `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` | Credenciales de la API de Mux. |
| `PUBLIC_MUX_PLAYBACK_DOMAIN` | Dominio de reproducción de Mux. |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Credenciales para el contenedor de PostgreSQL. |

### 5.2. Frontend (`frontend/.env`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=<url-del-proyecto-supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# TMDB
TMDB_API_KEY=<tu-api-key>
TMDB_READ_ACCESS_TOKEN=<tu-token>
TMDB_BASE_URL=https://api.themoviedb.org/3
TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p

# Mux
MUX_TOKEN_ID=<tu-token-id>
MUX_TOKEN_SECRET=<tu-token-secret>
NEXT_PUBLIC_MUX_PLAYBACK_DOMAIN=<dominio-de-reproducción>

# Aplicación
NEXT_PUBLIC_APP_URL=http://localhost:5173
BACKEND=http://localhost:3000
PORT=5173
```

| Variable | Descripción |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | URL y clave pública (`anon`) del proyecto en Supabase. |
| `TMDB_API_KEY` / `TMDB_READ_ACCESS_TOKEN` | Credenciales de la API de TMDB. |
| `TMDB_BASE_URL` / `TMDB_IMAGE_BASE_URL` | URL base de la API y de las imágenes de TMDB (`image.tmdb.org/t/p/**`). |
| `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` | Credenciales de la API de Mux. |
| `NEXT_PUBLIC_MUX_PLAYBACK_DOMAIN` | Dominio de reproducción de Mux. |
| `NEXT_PUBLIC_APP_URL` | URL pública del frontend. |
| `BACKEND` | URL del backend de Flix (`http://localhost:3000`). |
| `PORT` | Puerto del servidor frontend (por defecto `5173`). |

---

## 6. Ejecución local (sin Docker)

Para levantar todo el entorno en desarrollo necesitarás dos terminales (una para el backend y otra para el frontend), además de tener PostgreSQL activo.

### Paso 1: levantar el Backend

```bash
cd backend

# 1. Instalar dependencias
npm ci

# 2. Configurar backend/.env con DATABASE_URL apuntando a tu PostgreSQL

# 3. Aplicar migraciones y (opcionalmente) datos semilla
npx drizzle-kit migrate
node scripts/seed-data.mjs

# 4. Iniciar servidor en modo desarrollo (puerto 3000)
npm run dev
```

### Paso 2: levantar el Frontend

```bash
cd frontend

# 1. Instalar dependencias
npm ci

# 2. Configurar frontend/.env con BACKEND=http://localhost:3000

# 3. Iniciar servidor de desarrollo (puerto 5173)
npm run dev
```

- **Frontend:** `http://localhost:5173`
- **Backend (API):** `http://localhost:3000`
- **Swagger UI:** `http://localhost:3000/api-docs`

---

## 7. Ejecución con Docker

### 7.1. Por servicio individual

**Backend + PostgreSQL (`backend/docker-compose.yml`):**

```bash
cd backend
docker compose up -d
```

- Levanta PostgreSQL 17 y `kevinmateog/flix-backend`.
- Ejecuta automáticamente las migraciones (`migrate-if-needed.mjs`) y la carga de datos semilla (`seed-data.mjs`) al iniciar el contenedor.

**Frontend (`frontend/docker-compose.yml`):**

```bash
cd frontend
docker compose up -d
```

- Levanta `kevinmateog/flix-frontend` en el puerto `5173` y se conecta al backend del host mediante `host.docker.internal:3000`.

### 7.2. Stack completo (`docker-compose.dev.yml`)

Tanto `backend/docker-compose.dev.yml` como `frontend/docker-compose.dev.yml` levantan los tres contenedores (**PostgreSQL 17 + Backend + Frontend**) en una misma red, esperando a que la base de datos y el backend pasen sus respectivos `healthchecks`.

> **Nota sobre rutas de `.env` en `docker-compose.dev.yml`:** Los archivos `docker-compose.dev.yml` referencian `../flix-backend/.env` y `../flix-frontend/.env` (pensados para cuando ambos repositorios están clonados como carpetas hermanas `flix-backend/` y `flix-frontend/`). Si ejecutas desde este monorepo (`backend/` y `frontend/`), asegúrate de ajustar `env_file` a `../backend/.env` y `../frontend/.env` o crear enlaces simbólicos equivalentes.

- **Frontend:** `http://localhost:5173`
- **Backend:** `http://localhost:3000`
- **PostgreSQL:** `localhost:5432`

### 7.3. Construir las imágenes manualmente

```bash
# Construir imagen del backend
cd backend
docker build -t kevinmateog/flix-backend:latest .

# Construir imagen del frontend
cd ../frontend
docker build \
  --build-arg BACKEND=http://localhost:3000 \
  --build-arg NEXT_PUBLIC_URL=http://localhost:5173 \
  -t kevinmateog/flix-frontend:latest .
```

---

## 8. Base de datos, migraciones y datos semilla

### 8.1. PostgreSQL + Drizzle ORM (Backend)

El esquema principal se define en `backend/src/db/schema.ts` y las migraciones generadas se almacenan en `backend/drizzle/`. Los datos iniciales se encuentran en archivos CSV dentro de `backend/scripts/` (`playable-content.csv`, `my-list.csv`, `watch-history.csv`).

```bash
cd backend

# Generar una nueva migración tras modificar src/db/schema.ts
npx drizzle-kit generate

# Aplicar migraciones manualmente
npx drizzle-kit migrate

# Aplicar migraciones solo si hacen falta y poblar datos iniciales
node scripts/migrate-if-needed.mjs
node scripts/seed-data.mjs
```

### 8.2. Supabase (Frontend)

Las migraciones SQL de Supabase se encuentran en `frontend/supabase/migrations/`:

| Migración | Descripción |
| --- | --- |
| `20260725210000_profiles_table.sql` | Tabla de perfiles |
| `20260726000001_watch_history.sql` | Historial de reproducción |
| `20260726000002_my_list.sql` | Lista personal (“Mi lista”) |
| `20260726000003_profiles_region.sql` | Región en perfiles |
| `20260728000004_watch_history_unique_identity.sql` | Identidad única en el historial |
| `20260730000005_dislikes.sql` | Registro de “No me gusta” |

Para aplicarlas mediante la [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
cd frontend
supabase link --project-ref <tu-project-ref>
supabase db push
```

---

## 9. Scripts disponibles

### Backend (`cd backend`)

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor en desarrollo con `nodemon` + `tsx`. |
| `npm run build` | Compila el proyecto TypeScript a `dist/`. |
| `npm start` | Ejecuta la versión compilada (`node dist/index.js`). |

### Frontend (`cd frontend`)

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo de Next.js en el puerto `5173`. |
| `npm run build` | Compila la aplicación para producción. |
| `npm start` | Inicia el servidor de producción de Next.js. |
| `npm run lint` | Ejecuta el análisis estático con ESLint. |
| `npm run format` | Formatea el código con Prettier. |
| `npm run format:check` | Verifica el formato del código sin modificar archivos. |

---

## 10. Pruebas end-to-end (Playwright)

Las pruebas end-to-end del frontend se ubican en `frontend/tests/` (`smoke.spec.js`) y se configuran en `frontend/playwright.config.js` (usando Chromium contra `http://127.0.0.1:5173`, configurable mediante `PLAYWRIGHT_BASE_URL`).

Para ejecutarlas en local:

```bash
cd frontend

# 1. Compilar e iniciar la aplicación en el puerto 5173 (en una terminal)
npm run build
npm start   # o npm run dev

# 2. Instalar Playwright puntualmente y ejecutar las pruebas (en otra terminal)
npm install --no-save --package-lock=false --ignore-scripts @playwright/test@1.52.0
npx playwright install --with-deps chromium
npx playwright test
```

El reporte HTML queda disponible en `frontend/playwright-report/`.

---

## 11. Integración continua (Jenkins)

Tanto `backend/Jenkinsfile` como `frontend/Jenkinsfile` definen pipelines automatizados de CI/CD:

1. **Npm Install**: Instala dependencias con `npm ci` en un contenedor Node.js 22.
2. **Build**: Ejecuta `npm run build` para validar la compilación.
3. **Playwright Test** *(solo en Frontend)*: Instala Playwright + Chromium, levanta el servidor `standalone` en `127.0.0.1:5173`, espera a que `/login` responda y ejecuta los tests end-to-end.
4. **Docker Build**: Construye las imágenes `kevinmateog/flix-backend` y `kevinmateog/flix-frontend` etiquetadas con `$BUILD_NUMBER` y `latest`.
5. **Docker Push**: Publica las imágenes en Docker Hub usando la credencial `dockerHub` configurada en Jenkins.

---

## 12. Documentación de la API

El backend cuenta con documentación completa bajo el estándar **OpenAPI 3.0 (Swagger)**:

- **Swagger UI interactivo** (con el backend corriendo): `http://localhost:3000/api-docs`
- **Especificación JSON en vivo**: `http://localhost:3000/api-docs.json`
- **Archivo OpenAPI estático**: [`backend/api-docs/openapi.json`](backend/api-docs/openapi.json)
- **Guía detallada de endpoints en Markdown**: [`backend/api-docs/README.md`](backend/api-docs/README.md)

---

## 13. Repositorios relacionados

- Repositorio del Frontend: [KevinMateoG/flix-frontend](https://github.com/KevinMateoG/flix-frontend)
- Repositorio del Backend: [KevinMateoG/flix-backend](https://github.com/KevinMateoG/flix-backend)
- Proyecto base original (fork): [EmanuelGarciaR/flix](https://github.com/EmanuelGarciaR/flix)

