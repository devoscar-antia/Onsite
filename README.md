# Onsite — Conveyor Product Counter

Computer vision platform for detecting and counting products on industrial conveyor belts using YOLOv8 + ByteTrack.

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI · SQLAlchemy · PostgreSQL (Supabase) |
| CV Pipeline | YOLOv8 · ByteTrack · OpenCV |
| Frontend | Next.js 15 App Router · TypeScript · Tailwind CSS |
| State | TanStack Query · Zustand |
| Auth | JWT · httpOnly cookies · BFF proxy pattern |
| Storage | Supabase Storage (videos) |

## Features

- Upload video recordings from conveyor belt cameras
- YOLO v8 object detection + ByteTrack multi-object tracking
- Unique product count filtered by track persistence (≥4 frames)
- Real-time throughput metrics (products/min)
- Analytics dashboard with detection timeline and class distribution
- Admin panel: user management, role control, session invalidation
- Secure auth: httpOnly cookies, CSRF protection, rate limiting

## Project Structure

```
conveyor-product-counter/
├── apps/
│   ├── api-backend/          FastAPI backend (port 8000)
│   └── web-frontend-next/    Next.js 15 frontend (port 3000)
├── assets/                   Videos, processed output, thumbnails (gitignored)
├── models/
│   └── conveyor-products/product_bag_detector.pt
├── features/
│   └── conveyor_products/    Active CV pipeline
└── process_count_video.py    CV subprocess entry point
```

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL (or Supabase account)

### Environment Setup

**Backend** — copy and fill:
```bash
cp apps/api-backend/.env.example apps/api-backend/.env
```

Required variables:
```
DATABASE_URL=postgresql://user:password@host:5432/postgres
JWT_SECRET_KEY=your-secret-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_VIDEOS_BUCKET=videos
```

**Frontend** — create `apps/web-frontend-next/.env.local`:
```
BACKEND_URL=http://localhost:8000
JWT_SECRET=your-secret-key   # must match JWT_SECRET_KEY above
```

### Run

```bash
# Backend
cd apps/api-backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd apps/web-frontend-next
npm install
npm run dev
```

App runs at `http://localhost:3000`  
API docs at `http://localhost:8000/docs`

## How It Works

1. User uploads a conveyor belt video
2. Backend spawns YOLO subprocess via `process_count_video.py`
3. YOLOv8 detects products frame by frame; ByteTrack assigns persistent IDs
4. Unique products counted = track IDs seen in ≥4 frames (filters re-ID noise)
5. Results cached as JSON in `assets/analytics/`; processed video saved to `assets/processed_videos/`
6. Frontend streams both original and processed video side by side with live stats

## Roles

| Role | Permissions |
|---|---|
| `admin` | Full access + user management |
| `supervisor` | Upload, process, view analytics |
| `engineer` | Upload, process, view analytics |
| `analyst` | View analytics and processed videos |
| `viewer` | View only |

## License

Private — all rights reserved.