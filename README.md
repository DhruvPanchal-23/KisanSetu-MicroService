# KisanSetu

A JavaScript application with a React + Vite frontend and Node.js + Express services for authentication, farms, weather and the API gateway. Accounts and farms persist in MongoDB when configured, or SQLite by default. Reports and random demo seeding also run in JavaScript.

## MongoDB Atlas setup

1. In Atlas, select Cluster0 → Connect → Drivers → Node.js. Create a database user with read/write access to the `kisansetu` database and allow your current public IP in Network Access.
2. Copy the connection string into your existing root `.env`. Replace its username and password placeholders with the **database user's** credentials; URL-encode special characters in the password (`@` becomes `%40`). Keep your existing `JWT_SECRET`.

```dotenv
MONGODB_URI="mongodb+srv://DB_USERNAME:DB_PASSWORD@YOUR_CLUSTER.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB=kisansetu
```

3. Run `npm.cmd run db:check` to verify connectivity. Never put the URI in React code or commit `.env`. [Atlas connection instructions](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).
4. For existing Docker data, migrate before restarting the application against Atlas:

```powershell
docker compose stop
docker compose --profile tools run --rm --build mongo-migrate
# Continue only after migration succeeds:
docker compose up -d --build --wait
docker compose exec -T frontend nginx -s reload
```

Migration preserves numeric IDs, password hashes, farm ownership and creation dates, refuses conflicting destination records, and leaves source SQLite volumes intact. Keep services stopped during migration. For existing local Node data, stop `npm run dev`, run `npm.cmd run db:migrate`, then restart it. For a fresh installation with no existing records, skip migration.

Auth and farm services use the same `MONGODB_DB`, with `users`, `farms` and ID `counters` collections. An empty URI keeps SQLite enabled; an invalid configured URI stops startup instead of silently switching databases. Your current public IP must remain allowed in Atlas; update the access list if your network changes.

## Start with Docker

Requires Docker Desktop with its engine running.

1. Keep your existing `.env` if you already configured the project. Otherwise copy `.env.example` to `.env` and set `JWT_SECRET` to a random secret of at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
2. Run `docker compose up -d --build --wait` from the project root.
3. Open **http://localhost:3000** and register or sign in.

The gateway is at http://localhost:8000, its health check at `/health`, and its route reference at `/docs`. Internal services are available only on the Compose network. The existing `auth-data` and `farm-data` volumes, account passwords, farm IDs and saved farms are retained. `docker compose down` stops the project without deleting those volumes.

Docker explicitly sets `PORT=8000` and `HOST=0.0.0.0` for each Node service. Their shared startup reads `process.env.PORT`; the individual default ports below apply when running outside Docker without a `PORT` override. The Docker frontend is served by Nginx on container port 80, published on localhost:3000.

## Start with Node.js

Requires **Node.js 24+**. Run these commands from the project root in PowerShell:

```powershell
npm.cmd ci
npm.cmd run setup
# Keep your existing .env; configure JWT_SECRET first if starting fresh.
npm.cmd run dev
```

Open **http://localhost:5173**. One command starts React and all four Node services. Press **Ctrl+C** to stop them. If Docker is running, stop it with `docker compose down` first to free port 8000.

`npm.cmd start` starts only the backend. `npm.cmd run build` creates the frontend production build. `npm.cmd run setup` installs frontend dependencies; the root and frontend each have their own lockfile.

Local development creates databases in `auth-service/storage/auth.db` and `farm-service/storage/farms.db`. Docker stores its databases in named volumes, so local development and Docker have separate records.

| Service | Local port | Environment |
| --- | --- | --- |
| gateway | 8000 | `AUTH_URL`, `FARM_URL`, `WEATHER_URL`, `CORS_ORIGINS` |
| auth-service | 8001 | `JWT_SECRET`, `DATABASE_PATH` |
| farm-service | 8002 | `AUTH_URL`, `DATABASE_PATH` |
| weather-service | 8003 | No API key required |

Each service supports `PORT` and `HOST`. Local startup loads `.env` and sets the internal URLs automatically. To start a service manually, use `node --env-file=.env auth-service/main.js` (or another service path) from the project root. Shared startup uses `Number(process.env.PORT) || defaultPort` and defaults to host `0.0.0.0`; the local launcher explicitly sets `HOST=127.0.0.1`. The frontend defaults to `/api`, proxied by Vite or Nginx; `VITE_API_URL` can override its API base at build time.

## Features

React's API address defaults to `/api`. For local Vite development, copy `frontend/.env.example` to `frontend/.env` and restart Vite after changes. For Docker, set `VITE_API_URL` in the root `.env` and rebuild with `docker compose up -d --build --no-deps frontend`. The default works through both proxies; a separate API host must include `/api` (for example `https://api.example.com/api`) and allow the frontend origin through `CORS_ORIGINS`. Vite embeds this public address at build time; never put database credentials in frontend environment variables.

- Register and sign in with Argon2id password hashes and eight-hour signed JWTs. Sign-out clears session storage; expired tokens require a new login.
- Create, view, edit and delete farms. Every protected request verifies the account and restricts access to its own farms.
- Click any farm card, or focus its farm-name link and press Enter, to open that farm's page. View all saved information and weather, edit the details, confirm deletion, or download its PDF report directly from this page. Card actions also remain available in the farm list.
- View current weather and a three-day [Open-Meteo forecast](https://open-meteo.com/en/docs) for the farm coordinates. Forecast dates use the farm's timezone. Weather failures preserve access to farm data.
- Open **Analytics** from the menu to see total acreage, crop varieties, and area breakdowns by crop and soil type using your saved farms.
- Open **Farm Report** from the menu to view your farms and their saved added dates, then download each farm's PDF report. Reports include matching synthetic weather and irrigation examples from `farm-service/seeds/india_weather_irrigation_2024_2025.json`.
- Choose **Download PDF** on a card or farm page to download a real `.pdf` file containing saved farm details, area in acres and hectares, coordinates, crop, soil type and timestamps. Reports match the full state name in the farm location and its added date to the seed; dates outside 2024–2025 use the latest available same-calendar-day reference. Soil mismatches are identified and do not produce a farm water-volume calculation. These synthetic examples are labeled separately from live weather. See [seed documentation](farm-service/seeds/README.md). Reports require the farm owner's account and work without weather access. PDFKit generates the report in JavaScript, with bundled open fonts for Latin and Devanagari text.
- Responsive React dashboard, account forms, farm dialogs, and loading, empty and error states.

## API

| Method | Gateway endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | `{name, email, password}` -> token and user |
| POST | `/api/auth/login` | `{email, password}` -> token and user |
| GET | `/api/auth/me` | Current user |
| GET / POST | `/api/farms` | List / create farms |
| GET / PUT / DELETE | `/api/farms/{id}` | View / update / delete an owned farm |
| GET | `/api/farms/{id}/report` | Download an owned farm's PDF report (`application/pdf`) |
| GET | `/api/dashboard/{id}` | Owned farm, weather and optional warning |

Protected requests use `Authorization: Bearer TOKEN`. Farm fields are `name`, `location`, `latitude`, `longitude`, `area_acres`, `crop` and `soil_type`. Supported crops: Rice, Wheat, Maize, Cotton, Sugarcane, Soybean. Soils: Alluvial, Black, Red, Loamy, Sandy, Clay. No AI/ML datasets or models are required.

## Generate random demo farms

Create an account in the app first, then run this from the project root with your registered email:

```powershell
docker compose exec farm-service node farm-service/seed.js --url http://gateway:8000 --email you@example.com --count 5 --seed 42
```

Enter the account password when prompted. Demo farms are added through the existing authenticated API. The command never changes or deletes existing farms. Counts from 1 to 100 are supported. Repeating a seed skips matching demo names; omit `--seed` for a new random batch. Coordinates, crops and soils are synthetic testing examples.

For a locally running Node backend:

```powershell
npm.cmd run seed -- --email you@example.com --count 5 --seed 42
```

The seed command also accepts `KISANSETU_TOKEN` as an environment variable for non-interactive use. Do not pass passwords on the command line.

## Checks

```powershell
npm.cmd test
npm.cmd --prefix frontend test
npm.cmd run build
npm.cmd run test:pdf
```

Tests use isolated Node child processes, temporary SQLite databases and a weather fixture. They cover login, validation, owner-only farm CRUD, parsed PDF downloads, Unicode and long report fields, regenerated reports after edits, weather failure handling, repeatable seeding, and accessible card/dialog markup. They do not change your Docker accounts or farms. `test:pdf` generates example reports and page PNGs in the ignored `test-results/pdf/` folder for visual review; PDF.js and its canvas renderer are development dependencies.

## Deployment scope

This is a local MVP. SQLite suits one instance of each data service. Before public deployment, configure HTTPS, login rate limiting at the ingress, secret management, database backups, dependency updates and monitoring. Sign-out clears the client token; issued JWTs remain valid until expiry. Review Open-Meteo's terms for commercial use.
