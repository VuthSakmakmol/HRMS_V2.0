# HRMS Enterprise Upgrade

This package contains the complete backend and frontend source from the supplied HRMS project, with enterprise infrastructure hardening applied without removing existing business modules.

## What changed

### Backend
- Added reusable pagination and response contracts under `backend/src/shared/http`.
- Added reusable async route wrapper.
- Added centralized MongoDB duplicate, validation, and cast error normalization.
- Added slow-request metrics tied to request IDs.
- Strengthened MongoDB connection pooling and reconnect state reporting.
- Preserved all existing routes, permissions, schemas, services, imports, and business calculations.

### Frontend
- Added normalized `ApiError` handling for every Axios request.
- Added client request correlation IDs.
- Added request cancellation-ready `useServerList` composable.
- Added global compact responsive PrimeVue defaults.
- Added reusable `AppPaginator`, `AppTableActions`, permission button, loading skeleton, and empty state.
- Corrected Linux case-sensitive file names and imports.
- Preserved existing module APIs and workflows.

## Run the project

### Backend
1. Copy `backend/.env.example` to `backend/.env`.
2. Fill in `MONGO_URI` and `JWT_ACCESS_SECRET`.
3. Run:

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The default frontend URL is `http://localhost:5173` and backend URL is `http://localhost:4000`.

## Production verification completed

- Frontend: `npm run build`
- Backend: syntax validation of every JavaScript file

## Scaling boundary

The frontend uses bounded pages and lazy route chunks. Actual support for 10,000 concurrent users or extremely large databases must also be verified through database indexes, Redis/shared cache, background job workers, multiple API instances, a load balancer, production monitoring, and load tests. No source-code package can honestly guarantee a fixed concurrency level without testing the deployment infrastructure and real data distribution.
