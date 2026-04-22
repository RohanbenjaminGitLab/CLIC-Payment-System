# CLIC Campus Student Payment & Course Management System

Full-stack campus operations app: **React + Tailwind** frontend, **Node.js + Express** API, **MySQL** database, **JWT + bcrypt** authentication with **RBAC** (Admin / Manager / Staff).

## Folder structure

```
CLIC PaymentSystem/
├── client/                 # React (Vite) + Tailwind CSS
│   ├── src/
│   │   ├── api.js          # Fetch helper (cookies + refresh)
│   │   ├── context/        # Auth context
│   │   ├── components/     # Layout, Sidebar, Navbar
│   │   ├── pages/          # Feature screens
│   │   ├── hooks/          # Inactivity logout
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── server/                 # Express API
│   ├── src/
│   │   ├── index.js
│   │   ├── config/db.js
│   │   ├── routes/index.js
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
├── database/
│   ├── schema.sql
│   └── seed.sql
├── .env.example
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
copy ..\\.env.example .env
```

Edit `server/.env`: set `DB_PASSWORD`, `JWT_SECRET` (long random string), and optionally `CLIENT_URL` (default `http://localhost:5173`). Never commit real `.env` files.

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

You can create `client/.env.production` from `client/.env.example` for Vercel deployment.

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

## Production notes

- Set `COOKIE_SECURE=true` and serve over HTTPS.
- Use a strong `JWT_SECRET` and restrict MySQL user privileges.
- Put the API behind a reverse proxy (nginx, etc.) and tune rate limits.
- Recommended free hosting:
  - Frontend: **Vercel**
  - Backend: **Render**
- Set `CLIENT_URL` on Render to your Vercel frontend URL.
- Set `VITE_API_URL` on Vercel to your Render backend URL.
- The frontend includes a 404 route and a fallback 500 error screen; the backend returns JSON 404/500 responses.
- Do not run the legacy root migration scripts during hosting; the backend already executes startup migrations in `server/src/index.js`.
