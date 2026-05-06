# Onsite — Conveyor Product Counter: Estructura del Proyecto

## Repositorio

```text
conveyor-product-counter/
├── apps/
│   ├── api-backend/              FastAPI backend (puerto 8000)
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── auth.py       register, login, refresh, logout
│   │   │   │   ├── videos.py     upload, process, stream, analytics, thumbnail
│   │   │   │   ├── users.py      perfil, contraseña, sesiones, admin
│   │   │   │   ├── jobs.py       estado de trabajos de procesamiento
│   │   │   │   └── deps.py       get_current_user, require_admin
│   │   │   ├── core/
│   │   │   │   ├── config.py     variables de entorno
│   │   │   │   ├── security.py   JWT, bcrypt
│   │   │   │   └── limiter.py    rate limiting (slowapi)
│   │   │   ├── db/
│   │   │   │   ├── models.py     User, Session, Video, ProcessingJob
│   │   │   │   └── database.py   SQLAlchemy engine (PostgreSQL)
│   │   │   ├── schemas/          Pydantic request/response schemas
│   │   │   ├── services/
│   │   │   │   ├── video_service.py      procesamiento, thumbnails, streaming
│   │   │   │   ├── analytics_service.py  cálculo de métricas YOLO
│   │   │   │   ├── video_db_service.py   CRUD videos y jobs
│   │   │   │   └── storage_service.py    Supabase Storage
│   │   │   └── main.py
│   │   ├── requirements.txt
│   │   └── .env.example
│   │
│   └── web-frontend-next/        Next.js 15 App Router (puerto 3000)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/login/         Página de login
│       │   │   ├── (auth)/register/      Página de registro
│       │   │   ├── api/auth/             login, logout, refresh, register (httpOnly cookies)
│       │   │   ├── api/proxy/videos/     BFF proxy — todos los endpoints de video
│       │   │   ├── api/proxy/users/me/   BFF proxy — perfil y sesiones
│       │   │   ├── api/proxy/admin/      BFF proxy — gestión de usuarios
│       │   │   ├── layout.tsx
│       │   │   └── page.tsx              Dashboard principal
│       │   ├── components/
│       │   │   ├── analytics/DashboardTab.tsx     KPIs, leaderboard, métricas
│       │   │   ├── auth/                          LoginForm, RegisterForm
│       │   │   ├── dashboard/                     Shell, Header, Sidebar
│       │   │   ├── settings/SettingsPage.tsx       Perfil, seguridad, admin users
│       │   │   ├── video/VideoAnalysisTab.tsx      Reproductor dual + análisis
│       │   │   └── ui/                            RoleBadge, Toggle, FetchStates...
│       │   ├── hooks/          useAuth, useVideoUpload
│       │   ├── lib/            api-client, api-server, auth-cookies, csrf, proxy-utils
│       │   ├── services/       videoService, analyticsService, adminService...
│       │   ├── store/          videoStore (Zustand)
│       │   └── types/          video, analytics, auth, settings
│       ├── middleware.ts        Auth guard (Edge Runtime)
│       └── next.config.ts      CSP + security headers
│
├── features/
│   └── conveyor_products/      Pipeline CV activo
│       └── pipeline.py
│
├── models/
│   └── conveyor-products/
│       └── product_bag_detector.pt   Modelo YOLO activo
│
├── assets/                     Generado en runtime — no versionado
│   ├── videos/uploaded/        Videos originales (UUID-named)
│   ├── processed_videos/       Videos con overlay YOLO
│   ├── analytics/              Cache JSON de detecciones
│   └── thumbnails/             Miniaturas JPEG
│
├── infra/
│   └── database/schema.sql
├── process_count_video.py      Subprocess entry point YOLO + ByteTrack
└── docker-compose.yml
```

## Base de Datos (PostgreSQL — Supabase)

| Tabla | Contenido |
|---|---|
| `users` | email, password_hash, role, preferences (JSON) |
| `sessions` | refresh_token_hash, expires_at, ip, ciudad, país |
| `videos` | filename, storage_key, size, duration, uploaded_by |
| `processing_jobs` | video_id, status, total_count, processing_time, error |

## Pipeline CV

1. Usuario sube video → guardado en `assets/videos/uploaded/`
2. Backend lanza subprocess `process_count_video.py`
3. YOLOv8 detecta productos frame a frame
4. ByteTrack asigna IDs persistentes entre frames
5. Conteo único = track_ids vistos en ≥4 frames (filtra ruido de re-ID)
6. Video procesado → `assets/processed_videos/`
7. Detecciones cacheadas → `assets/analytics/*.detections.json`
8. Throughput = productos_únicos / (duración_seg / 60) = productos/min

## Stack

| Capa | Tecnología |
|---|---|
| Backend | FastAPI · SQLAlchemy · PostgreSQL (Supabase) |
| CV | YOLOv8 · ByteTrack · OpenCV |
| Frontend | Next.js 15 · TypeScript · Tailwind CSS |
| Estado | TanStack Query · Zustand |
| Auth | JWT · httpOnly cookies · BFF proxy |
| Storage | Supabase Storage |

## Seguridad Implementada

- Cookies httpOnly — JWT nunca en localStorage
- BFF proxy — URL del backend nunca expuesta al browser
- CSRF double-submit en todas las mutaciones
- Rate limiting en login (10/min) y refresh (30/min)
- Middleware Edge Runtime protege todas las rutas
- Admin endpoints con `require_admin` dependency
- Registro siempre crea role=viewer — sin escalada desde cliente