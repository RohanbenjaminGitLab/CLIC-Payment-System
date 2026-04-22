# CLIC Campus Student Payment & Course Management System

Full-stack campus operations app: **React + Vite** frontend, **Node.js + Express** API, and **MySQL** with JWT authentication, RBAC, validation, and Render-ready deployment structure.

## Project structure

```
CLIC PaymentSystem/
├── client/                  # Frontend only
│   ├── public/
│   ├── src/
│   ├── .env.example
│   └── package.json
├── server/                  # Backend only
│   ├── migrations/          # Startup-safe DB migrations
│   ├── src/
│   ├── test/
│   ├── .env.example
│   └── package.json
├── database/                # Base schema + seed SQL
├── render.yaml              # Render blueprint (API + static frontend)
├── .gitignore
└── README.md
```

## Prerequisites

- **Node.js** 18+
- **MySQL** 8+ (or compatible)

## 1. Database setup

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS clic_campus CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p clic_campus < database/schema.sql
mysql -u root -p clic_campus < database/seed.sql
```

## 2. Backend configuration

```bash
cd server
copy .env.example .env
```

Edit `server/.env`: set `DB_PASSWORD`, `JWT_SECRET`, and optionally `CLIENT_URL`. For cross-site Render cookies, set `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=none`.

### Run migrations

```bash
cd server
npm install
npm run migrate
```

### Run API

```bash
cd server
npm install
npm run dev
```

API listens on **http://localhost:5000** (or `PORT` from `.env`). Health check: `GET http://localhost:5000/health`.

## 3. Frontend

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` to the backend.

For production build, set `VITE_API_URL` if the API is on another origin (e.g. `https://api.example.com`); otherwise leave unset and serve the API on the same host with a reverse proxy.

```bash
cd client
npm run build
npm run preview
```

You can create `client/.env.production` from `client/.env.example` for Render static hosting or any other frontend host.

## Sample logins (from seed)

| Role    | Email              | Password    |
|---------|--------------------|------------|
| Admin   | admin@clic.edu     | Admin@123  |
| Manager | manager@clic.edu | Manager@123|
| Staff   | staff@clic.edu   | Staff@123  |

Password rules for new users: **8+ characters**, uppercase, lowercase, number, special character.

## Security features (implemented)

- JWT access tokens + refresh token rotation, **HTTP-only cookies**
- **bcrypt** (12 rounds), strong password validation on registration/password change
- **Helmet**, **CORS** (credentials), **rate limiting** (login + API)
- **RBAC** middleware on routes; staff scoped data where required
- **Audit logs** (admin report) + **login history** (IP, user agent, success/failure)
- **Inactivity logout** on the client (default 30 minutes)

## API overview

- `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- `POST /api/auth/register` (admin: any role; manager: staff only)
- CRUD: `/api/courses`, `/api/batches`, `/api/students`, `/api/payments`
- `/api/dashboard/stats`, `/api/installments/alerts`, `/api/reports/*`
- `/api/settings`, `/api/reports/audit` (admin)

All `/api/*` routes expect the cookie session (or `Authorization: Bearer` for tools).

## Render deployment notes

- `render.yaml` includes:
  - a **free web service** for the backend (`server/`)
  - a **static site** for the frontend (`client/`)
- Backend start command: `npm start`
- Backend migrations run automatically at startup and can also be run manually with `npm run migrate`
- Set these backend environment variables in Render:
  - `JWT_SECRET`
  - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  - `CLIENT_URL` = your frontend Render URL
- Set these frontend environment variables in Render Static Site:
  - `VITE_API_URL` = your backend Render URL

## Free-tier hosting considerations

- No persistent upload storage is used.
- No background intervals or cron-like jobs are required.
- Overdue installment state is refreshed during startup and relevant API requests.
- Database connection pool is tuned for lower resource usage.

## Security notes

- JWT session cookies support secure cross-origin Render deployment.
- Authentication and role-based access control remain enforced on protected routes.
- Request validation has been tightened for auth, courses, batches, students, and payments.
- The backend returns controlled JSON errors for invalid requests and server failures.
