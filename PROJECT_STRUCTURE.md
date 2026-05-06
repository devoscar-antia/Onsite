# Conveyor Product Counter - Estructura del Proyecto

## Estructura Actual del Repositorio

```text
conveyor-product-counter/
|-- apps/
|   |-- web-frontend/
|   `-- api-backend/
|-- services/
|   `-- cv-worker/
|-- infra/
|   `-- database/
|-- docs/
|   `-- MVP_V1_PLAN.md
|-- assets/
|   |-- videos/
|   |   `-- Procesamiento.mp4
|   `-- processed_videos/
|       `-- processed_count_20260426_223949.mp4
|-- models/
|   |-- conveyor-products/
|   |   `-- product_bag_detector.pt
|   |-- fire-detection/
|   |-- first-aid-safety-equipment-detection/
|   `-- people-flow-trajectory-detection/
|-- features/
|   |-- conveyor_products/
|   |-- fire_detection/
|   |-- first_aid_safety_equipment_detection/
|   `-- people_flow_trajectory/
|-- actions/
|   |-- save_db/
|   |-- sms/
|   |-- video/
|   `-- visualization/
|-- dataimages/
|   |-- obj.data
|   |-- obj.names
|   |-- train.txt
|   `-- obj_train_data/   # Anotaciones exportadas desde CVAT
|-- runs/
|   `-- bag_train_cpu_fast_v2/
|       `-- weights/
|-- bytetrack_recall.yaml
`-- process_count_video.py
```

## Núcleo del Proyecto

El núcleo del proyecto está organizado en tres dominios conceptuales:

- **models**: pesos entrenados (`.pt`) para cada capacidad de visión computacional.
- **features**: capacidades de negocio construidas sobre los modelos.
- **actions**: decisiones o salidas que se ejecutan cuando una feature genera un evento.


## Explicación de los Dominios

### 1) Models

`models/` contiene los artefactos de modelos por caso de uso:

- `models/conveyor-products/`: detección de productos en banda transportadora.
- `models/fire-detection/`: detección visual de fuego/humo.
- `models/first-aid-safety-equipment-detection/`: detección de implementos de primeros auxilios, incluyendo extintores.
- `models/people-flow-trajectory-detection/`: análisis de flujo de personas en trayectos o zonas definidas.

Modelo activo actual:

- `models/conveyor-products/product_bag_detector.pt`

Próximos modelos definidos:

- detector de fuego
- detector de implementos de primeros auxilios (incluye extintores)
- detector de flujo de personas en trayectos determinados

### 2) Features

Las features representan lo que el sistema puede hacer con la salida de los modelos.  
Feature implementada actualmente:

- **Conteo de productos por cruce de línea** en `process_count_video.py`.

Features planificadas:

- Alertas de humo/fuego.
- Verificación de disponibilidad de implementos de primeros auxilios y extintores.
- Evaluación de flujo de personas en trayectos definidos (ejemplo: pasillos de centro comercial).
- Conteo de ocupación por zonas y ventanas de tiempo.

### 3) Actions

Las actions son lo que ocurre cuando una feature detecta un evento.  
Acción actual:

- Overlay visual y salida de video procesado persistente.

Tipos de respuesta definidos:

- `actions/save_db/`: persistencia de eventos en base de datos.
- `actions/sms/`: notificación SMS ante eventos críticos.
- `actions/video/`: generación/almacenamiento de video procesado.
- `actions/visualization/`: overlays y salida visual para monitoreo.

## Pipeline de 3 Etapas

### Etapa 1 - Ingesta

Los frames de entrada se leen desde `assets/videos/` (o desde otra ruta de origen configurada).

### Etapa 2 - Percepción y Tracking

El modelo realiza detección y ByteTrack mantiene los IDs de objetos entre frames:

- Modelo de detección: `product_bag_detector.pt`
- Configuración del tracker: `bytetrack_recall.yaml`

### Etapa 3 - Lógica de Negocio y Salida

La lógica de cruce de línea valida dirección, elimina duplicados, actualiza el conteo y genera:

- Video anotado en `assets/processed_videos/`
- Diagnóstico de ejecución en logs de consola

## Expansión Recomendada de Carpetas

Para alinear la implementación con la arquitectura cuando empiece el desarrollo multi-feature, agregar:

```text
features/
|-- conveyor_products/
|-- fire_detection/
|-- first_aid_safety_equipment_detection/
`-- people_flow_trajectory/

actions/
|-- save_db/
|-- sms/
|-- video/
`-- visualization/
```

## Actualizaciones Recientes (Frontend + API)

### Frontend (`apps/web-frontend`)

- **Autenticación UI renovada (Tailwind, estilo enterprise)**:
  - `src/pages/LoginPage.tsx`: rediseño full-screen 2 columnas (panel de marca + formulario limpio), labels flotantes, estados `loading/error`, y toggle de tema.
  - `src/pages/RegisterPage.tsx`: registro multi-paso (3 pasos), timeline visual sincronizado, validaciones por paso, fuerza de contraseña y estado de éxito.
- **Estado global para videos**:
  - `src/store/videoStore.tsx`: `videos`, `selectedVideoId`, `activeTab`, cache de `detections` y `analytics`.
- **Servicios de integración API**:
  - `src/services/videoService.ts`
  - `src/services/processedService.ts`
  - `src/services/analyticsService.ts`
  - `src/services/authService.ts`
- **Hook genérico de fetch**:
  - `src/hooks/useFetch.ts`: estado `{ data, loading, error, refetch }`.
- **Componentes UI de soporte**:
  - `src/components/videos/VideoList.tsx`
  - `src/components/videos/VideoPlayer.tsx`
  - `src/components/ui/FetchStates.tsx`

### Backend (`apps/api-backend`)

- **API de videos extendida** en `app/api/videos.py`:
  - Endpoints públicos bajo `/videos` para listado, metadata, stream/descarga original y procesado.
  - Endpoint de detecciones YOLO por frame: `/videos/{id}/detections`.
  - Endpoints analíticos:
    - `/videos/{id}/analytics/summary`
    - `/videos/{id}/analytics/by-frame`
    - `/videos/{id}/analytics/class-distribution`
    - `/videos/{id}/analytics/confidence-timeline`
    - `/videos/{id}/analytics/heatmap`
  - Cache de detecciones en disco: `assets/analytics/*.detections.json`.
- **Routers registrados** en `app/main.py`:
  - `/api/v1/videos` (flujo MVP existente de upload/proceso)
  - `/videos` (consulta/analytics para frontend enterprise)
- **CORS activo** para frontend local:
  - `http://localhost:5173` y `http://127.0.0.1:5173`.

### Configuración

- `.env` frontend:
  - `apps/web-frontend/.env` con `VITE_API_URL=http://localhost:8000`

