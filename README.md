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
|---------|--------------------|--- ---------|
| Admin   | admin@clic.edu     | Admin@123 |
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

## 🚀 Free Hosting Deployment Guide (Optimized)

To save resources on free hosting, this project is now configured as a **Monolith**: the backend server serves both the API and the Frontend.

### 1. Database (Crucial)
Render's free tier doesn't include MySQL. You **must** use an external provider. Recommended options:
- **Aiven for MySQL** (Free tier, highly reliable)
- **Clever Cloud** (Free MySQL addon)

### 2. Full-Stack Deployment (Render)
1. Create a new **Web Service** on Render.
2. Connect your GitHub repository.
3. **DO NOT** set a Root Directory (leave it as the project root).
4. Render will automatically detect the settings from `render.yaml`.
5. Add these **Environment Variables**:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `JWT_SECRET` (Random string)
   - `NODE_ENV=production`
   - `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`
6. Click **Deploy**.

### ⚡ Why this is better for Free Hosting:
- **Single Service**: You only need to manage ONE Render service.
- **No CORS Issues**: Since the frontend and backend are on the same URL, you won't have CORS or Cookie issues.
- **Faster Loading**: The frontend is served instantly by the backend.


## Security notes

- JWT session cookies support secure cross-origin Render deployment.
- Authentication and role-based access control remain enforced on protected routes.
- Request validation has been tightened for auth, courses, batches, students, and payments.
- The backend returns controlled JSON errors for invalid requests and server failures.

