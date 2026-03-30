# VFR Flight Planner

A full-stack VFR flight planning tool for Europe. Plan trips, build flight legs across waypoints, view live aeronautical data on an interactive map, and export flight plans in GPX, PLN, or FPL format.

![Tech Stack](https://img.shields.io/badge/stack-React%20%7C%20Express%20%7C%20PostgreSQL-blue)

## Features

- **Trip & flight management** — organize flights into trips, reorder with drag-and-drop
- **Interactive map** — VFR/aeronautical chart overlay (OpenFlightMaps), airports, airspaces, navaids, and reporting points
- **Leg planning** — build routes with departure, intermediate waypoints, and arrival; customize color and notes
- **Airplane profiles** — store cruise TAS, fuel consumption, and other specs per aircraft
- **Custom waypoints & markers** — save custom points and annotate the map with fuel stops, alternates, checkpoints, etc.
- **Weather** — METAR and TAF lookup per airport (proxied from aviationweather.gov)
- **Export** — download legs as GPX, MSFS PLN, or FPL
- **Trip sharing** — invite collaborators by email
- **User management** — admin panel with approval flow; first registered user becomes admin

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Leaflet, Zustand, React Query, Tailwind CSS |
| Backend | Node.js 20, Express, TypeScript |
| Database | PostgreSQL 15 with PostGIS |
| Infrastructure | Docker Compose, Helm / Kubernetes |
| Auth | JWT (httpOnly cookie, 30-day expiry) |
| Aeronautical data | [OpenAIP](https://www.openaip.net/) API |
| Chart tiles | [OpenFlightMaps](https://openflightmaps.org/) |

## Project Structure

```
flight-planner/
├── packages/
│   ├── backend/        # Express API server
│   ├── frontend/       # React SPA
│   └── shared/         # Shared TypeScript types
├── helm/               # Kubernetes Helm chart
├── docker-compose.yml          # Local dev (DB only)
├── docker-compose.prod.yml     # Full production stack
└── .env.example
```

## Getting Started (Local Development)

### Prerequisites

- Node.js 20+
- Docker & Docker Compose

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
DATABASE_URL=postgresql://fp_user:fp_pass@localhost:5432/flightplanner
OPENAIP_API_KEY=<your_openaip_api_key>
JWT_SECRET=<a_long_random_string>
PORT=3001
NODE_ENV=development
CACHE_TTL_AIRPORTS_HOURS=24
CACHE_TTL_AIRSPACES_HOURS=72
```

Get a free OpenAIP API key at [core.openaip.net](https://core.openaip.net).

### 2. Start the database

```bash
docker compose up -d
```

This starts a PostGIS 15 instance on port 5432.

### 3. Run migrations

```bash
npm run migrate --workspace=packages/backend
```

### 4. Start the dev servers

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

The first user to register is automatically granted admin role.

---

## Production Deployment

Two options are provided: Docker Compose and Kubernetes (Helm).

### Option A — Docker Compose

Build and start all services (DB + backend + frontend/nginx):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The frontend is served on port 80. Nginx proxies `/api/*` to the backend container.

Ensure your `.env` file is present with production values (especially `JWT_SECRET` and `OPENAIP_API_KEY`).

---

### Option B — Kubernetes (Helm)

#### Prerequisites

- Kubernetes cluster
- Helm 3
- `cert-manager` installed (for TLS)
- A `letsencrypt-prod` ClusterIssuer configured
- Container images built and pushed to a registry

#### 1. Build and push images

```bash
# Backend
docker build -t <your-registry>/flight-planner-backend:latest -f packages/backend/Dockerfile .
docker push <your-registry>/flight-planner-backend:latest

# Frontend
docker build -t <your-registry>/flight-planner-frontend:latest -f packages/frontend/Dockerfile .
docker push <your-registry>/flight-planner-frontend:latest
```

#### 2. Configure values

Copy and edit the production values file:

```bash
cp helm/flight-planner/values.prod.yaml helm/flight-planner/my-values.yaml
```

Key values to set:

```yaml
backend:
  image:
    repository: <your-registry>/flight-planner-backend
    tag: latest

frontend:
  image:
    repository: <your-registry>/flight-planner-frontend
    tag: latest

ingress:
  host: flightplanner.yourdomain.com

postgres:
  username: <db_user>
  password: <db_password>

openaip:
  apiKey: <your_openaip_api_key>

jwtSecret: <a_long_random_string>
```

#### 3. Deploy

```bash
helm upgrade --install flight-planner ./helm/flight-planner \
  -f helm/flight-planner/my-values.yaml \
  --namespace flight-planner \
  --create-namespace
```

Database migrations run automatically as a pre-install/pre-upgrade Helm hook before the application starts.

#### Kubernetes resources created

| Resource | Description |
|---|---|
| Deployment (backend) | 2 replicas, with optional HPA |
| Deployment (frontend) | 2 replicas, Nginx |
| StatefulSet (postgres) | PostGIS, 50Gi PVC |
| Ingress | HTTPS via cert-manager |
| Job (migrate) | Runs DB migrations on install/upgrade |
| Secret | DB credentials, JWT secret, OpenAIP key |
| ConfigMap | Non-sensitive environment config |

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `OPENAIP_API_KEY` | Yes | — | OpenAIP API key |
| `JWT_SECRET` | Yes | `dev-secret-change-in-production` | Secret for signing JWT tokens |
| `PORT` | No | `3001` | Backend server port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `CACHE_TTL_AIRPORTS_HOURS` | No | `24` | How long to cache airport data |
| `CACHE_TTL_AIRSPACES_HOURS` | No | `72` | How long to cache airspace data |

---

## Database Migrations

Migrations live in `packages/backend/src/db/migrations/` and are applied in filename order. The migration runner tracks applied migrations in a `schema_migrations` table and skips already-applied files, making it safe to run on every deploy.

To run manually:

```bash
npm run migrate --workspace=packages/backend
```

---

## License

MIT
