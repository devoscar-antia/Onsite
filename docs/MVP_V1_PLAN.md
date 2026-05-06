# MVP v1.0 - Portal Web de Video Analytics

## Objetivo del MVP

Construir una primera versión funcional del portal para:

1. Autenticar usuarios de forma segura.
2. Ejecutar el modelo actual de conteo sobre videos.
3. Visualizar video original, video procesado y métricas básicas.

## Alcance (IN)

- Login y registro de usuarios.
- Roles base: `admin`, `viewer`.
- Gestión de sesión con JWT (access + refresh).
- Registro de usuarios en base de datos.
- Listado de videos originales.
- Ejecución de procesamiento sobre un video con el modelo actual:
  - `models/conveyor-products/product_bag_detector.pt`
- Listado y visualización de videos procesados.
- Dashboard básico con métricas de resultado.

## Fuera de alcance por ahora (OUT)

- Múltiples modelos activos en producción (fire, first aid, people flow).
- Integración de cámaras en tiempo real.
- Notificaciones SMS o canales externos.
- Gestión avanzada de permisos por recurso.
- Alta disponibilidad y despliegue cloud.

## Arquitectura del MVP

### Componentes

- `apps/web-frontend`: interfaz React (login, dashboard, videos).
- `apps/api-backend`: API FastAPI (auth, users, videos, jobs).
- `services/cv-worker`: ejecución de inferencia (pipeline actual).
- `infra/database`: PostgreSQL y scripts SQL iniciales.

### Patrón

- Backend: `Controller -> Service -> Repository`.
- Frontend: organización por features/páginas.
- Integración asíncrona simple para jobs de procesamiento.

## Pantallas del Frontend (MVP)

1. **Login**
2. **Registro**
3. **Dashboard principal**
4. **Videos originales**
5. **Videos procesados**
6. **Ejecución de modelo (admin)**

## Endpoints API (MVP)

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`

### Videos

- `GET /api/v1/videos/originals`
- `GET /api/v1/videos/processed`
- `POST /api/v1/videos/process` (admin)

### Jobs / métricas

- `GET /api/v1/jobs`
- `GET /api/v1/jobs/{job_id}`
- `GET /api/v1/dashboard/summary`

## Modelo de datos mínimo (PostgreSQL)

- `users`
  - id, email, password_hash, role, created_at
- `sessions`
  - id, user_id, refresh_token_hash, expires_at, created_at
- `videos`
  - id, type (`original` | `processed`), path, uploaded_by, created_at
- `processing_jobs`
  - id, original_video_id, processed_video_id, model_name, status, created_by, started_at, ended_at
- `job_metrics`
  - id, job_id, total_count, video_duration_sec, processing_time_sec, created_at

## Criterios de aceptación del MVP

- Usuario puede registrarse y entrar al portal con JWT válido.
- Usuario `admin` puede lanzar procesamiento de un video original.
- Sistema genera un video procesado y lo lista en la UI.
- Dashboard muestra al menos:
  - conteo total
  - duración del video
  - estado del job
- Usuario `viewer` puede ver resultados, pero no lanzar procesos.

## Orden de implementación recomendado

1. **Base de datos + esquema inicial**
2. **Backend auth (register/login/me)**
3. **Backend videos + jobs**
4. **Conector al pipeline actual (`main.py --feature conveyor_products`)**
5. **Frontend auth**
6. **Frontend dashboard + listas de videos**
7. **Polish final + pruebas end-to-end**

## Seguridad mínima obligatoria

- Hash de contraseñas con `bcrypt`.
- Refresh tokens persistidos con hash, no en texto plano.
- Validación de entrada en todos los endpoints.
- RBAC en backend (no confiar en frontend).
- CORS restringido a dominio frontend.
- Límite de intentos de login (rate limit básico).

