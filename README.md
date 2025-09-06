<div align="center">

# Journey Schedule

An itinerary planner for organizing your day.

<p>
  <a href="https://react.dev"><img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=000" /></a>
  <a href="https://nodejs.org/"><img alt="Node.js" src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=fff" /></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=fff" /></a>
  <a href="https://vitejs.dev/"><img alt="Vite" src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=fff" /></a>
  <a href="https://expressjs.com/"><img alt="Express" src="https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=fff" /></a>
  <a href="https://www.prisma.io/"><img alt="Prisma" src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=fff" /></a>
  <a href="https://www.postgresql.org/"><img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=fff" /></a>
  <a href="https://www.docker.com/"><img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=fff" /></a>
  <a href="#theme"><img alt="Theme" src="https://img.shields.io/badge/Theme-Light%20%2F%20Dark%20%2F%20Auto-8B5CF6?logo=apple&logoColor=fff" /></a>
</p>

</div>

## Features

- Drag to move (5-min grid), resize bottom edge to change end time (min 15 min) on the day calendar
- Tap a free slot to open a bottom sheet to add an item on that time
- Auto duration from departure/arrival, readable day timeline list
- Mobile-first: two pages with bottom tabs; date picker with Previous / Today / Next buttons
- Theme switch (Light / Dark / Auto). Subtle 3D background in Light, emphasized in Dark

## Stack / Structure

- Frontend: React + TypeScript + Vite (`frontend/`)
- Backend: Express + Prisma (`backend/`)
- DB: PostgreSQL (`docker-compose.yml`)

```
journey-schedule-app/
├─ backend/            # API / Prisma schema
├─ frontend/           # React client
├─ docker-compose.yml  # PostgreSQL (local)
└─ README.md
```

## Quick Start

1) Start DB

```bash
docker compose up -d
```

2) Backend (API)

```bash
cd backend
cp .env.example .env  # edit values as needed
npm install
npm run prisma:generate
npm run prisma:migrate   # first time only
npm run dev              # http://localhost:4000
```

3) Frontend

```bash
cd frontend
npm install
npm run dev  # http://localhost:5173 (/api proxied to http://localhost:4000)
```

Health check:

```bash
curl http://localhost:4000/api/health
```

### Google Sign-In (optional)

1) Create an OAuth Client (Web) in Google Cloud Console and get the Client ID
   - Credentials → Create Credentials → OAuth Client ID → Application type: Web
   - Authorized JavaScript origins: `http://localhost:5173`
2) Set environment variables
   - Add `GOOGLE_CLIENT_ID` and `JWT_SECRET` to `backend/.env`
   - Add `VITE_GOOGLE_CLIENT_ID` to the frontend runtime (e.g. `.env.local`)
3) Migration (add User model)
   - `cd backend && npx prisma migrate dev --name add_user_auth`

After starting, sign in via the “Sign in with Google” button on the header.

## Routes / Pages

- Timeline list: `/day/YYYY-MM-DD`
- Day calendar: `/calendar/YYYY-MM-DD`
- Switch pages with the bottom tabs. Use the date picker and the Previous / Today / Next buttons to move across days.
 - Shared view: append `?owner=OWNER_SLUG` to view a day shared by another user, e.g. `/calendar/2025-09-06?owner=ab12cdEF`（下部タブで一覧へ切替可）

## Usage (Highlights)

- Add item (calendar): tap a free grid → enter departure/arrival, times and notes → Add
- Move item (calendar): drag the event (5-min step)
- Resize item (calendar): drag the bottom edge (min 15 min)
- Edit item (list): click “Edit” to update the same fields
- Theme: toggle cycles “Auto → Light → Dark” on header

## Secrets (not committed)

- Put secrets in `.env` and keep out of Git (already in `.gitignore`)
- For sharing defaults, update `backend/.env.example`, and each developer creates their own `.env`
- Example: `DATABASE_URL=postgresql://journey:journey@localhost:5432/journey?schema=public`

## Deployment

- Frontend: Vercel (Root Directory: `frontend/`)
  - API proxy: `/api/*` → Render backend via `frontend/vercel.json`
  - Env: `VITE_GOOGLE_CLIENT_ID`
- Backend (API): Render Web Service (Node)
  - Build: `npm ci --include=dev && npm run prisma:generate && npm run build`
  - Start: `npx prisma migrate deploy && npm start`
  - Env: `DATABASE_URL` (Neon; use pooling/`sslmode=require`), `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `NODE_ENV=production`
- Database: Neon (PostgreSQL 15+)
  - Use pooled connection (PgBouncer) and `sslmode=require`

Notes
- Vercel rewrites `/api/*` to Render so cookies work same-origin. See `frontend/vercel.json`.
- Server stores times in UTC; UI renders wall-clock times consistently across regions.

## Server Commands

— DB (PostgreSQL / Docker Compose)

- Start: `docker compose up -d`
- Stop: `docker compose stop`
- Remove: `docker compose down`
- Logs: `docker compose logs -f db`

— API (backend)

- Dev: `cd backend && npm run dev`
- Prod: `cd backend && npm run build && npm start`
- Health: `curl http://localhost:4000/api/health`

— Frontend

- Dev: `cd frontend && npm run dev`
- Build: `cd frontend && npm run build`
- Preview: `cd frontend && npm run preview`

## API Overview (MVP)

- `GET /api/day?date=YYYY-MM-DD` Get a day’s schedule and items
- `GET /api/day?date=YYYY-MM-DD&owner=OWNER_SLUG` Get another user's shared schedule (slug-based, preferred; requires share)
- `GET /api/day?date=YYYY-MM-DD&ownerId=USER_ID` Legacy: same as above with numeric id
- `POST /api/day` `{ date, title?, notes? }` Create/update the day’s theme
- `POST /api/item` `{ date, title, startTime(HH:mm), endTime?, kind?, departurePlace?, arrivalPlace?, notes?, ownerSlug?, ownerId? }` Create item (if `ownerSlug`/`ownerId` is set and you have edit permission, adds to that owner's day)
- `PUT /api/item/:id` Update item (edit allowed if you are owner or have share edit permission)
- `DELETE /api/item/:id` Delete item (ditto)

### Auth

- `POST /api/auth/google` body `{ idToken }` Verify Google ID Token and issue a JWT cookie
- `GET /api/me` Current user info
- `POST /api/logout` Logout (clear cookie)

### Sharing (New)

- `GET /api/share/day?date=YYYY-MM-DD` List shares for your day (owner only)
- `POST /api/share/day` body `{ date, email, canEdit? }` Share your day to a user by email (the user must have signed-in at least once)
- `DELETE /api/share/day?date=YYYY-MM-DD&userId=ID` Revoke a user’s access
- `GET /api/shared/day/list?date=YYYY-MM-DD` Owners who shared their day with you (for the date)

#### Invite Links (for users not yet logged-in)

- `POST /api/share/day/invite` body `{ date, canEdit?, email?, ttlHours? }` Create an invite link (token). If `email` is set, the invite can only be accepted by a user with that email.
- `GET /api/share/day/invites?date=YYYY-MM-DD` List invites you created for that day
- `DELETE /api/share/day/invite/:id` Revoke an invite
- `GET /api/share/invite/:token` Public metadata of an invite (no auth)
- `POST /api/share/invite/:token/accept` Accept the invite (requires login); grants share permission and returns `{ ownerId, date }`

Client
- Invite accept page: `/invite/:token` (prompts login if needed, then accepts and redirects)

Notes
- Prefer slug-based links. To view another user's shared schedule, call `GET /api/day` with `owner=OWNER_SLUG` and the same `date`.
- To add an item to a shared day you have edit permission for, call `POST /api/item` with `ownerSlug` set to the owner's public slug.
- Apply DB migrations after pulling:
  - Local: `cd backend && npx prisma migrate dev --name add_sharing && npx prisma migrate dev --name add_share_invites`
  - Prod: `npx prisma migrate deploy`

## Theme

- Theme switch: Light / Dark / Auto (toggle on header)
- Auto follows OS preference. Subtle 3D objects in Light, stronger in Dark (react-three-fiber)

## Roadmap

- Side-by-side overlapping events (Google Calendar-like)
- Recurring items, templates, share/print
- Auth/User management, offline (PWA)
