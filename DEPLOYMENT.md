# Public Deployment Guide

This project is deployed as two services:

- Frontend: Netlify static site from `stock-web`
- Backend: Render Python Web Service from `stock-api`

The public frontend must not call `127.0.0.1`. It must call the public Render backend URL.

## 1. GitHub

Create a GitHub repository and push the project root. Do not commit local runtime files, caches, logs, SQLite cache, `.env`, `.env.local`, `node_modules`, or `dist`.

GitHub repository:

```text
a-stock-watch-assistant
```

## 2. Render backend

Create a Render Web Service from the GitHub repository.

Settings:

```text
Root Directory: stock-api
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Environment variables:

```env
STOCK_API_PROVIDER=akshare
STOCK_API_ALLOW_MOCK_FALLBACK=true
STOCK_API_CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,https://a-stock-watch-assistant.netlify.app
```

After deployment, verify:

```text
https://<render-backend-domain>/api/health
```

Expected result includes `ok=true` and `provider=akshare`.

## 3. Netlify frontend

Netlify site has been created: `https://a-stock-watch-assistant.netlify.app`. Connect it to the GitHub repository or deploy from the project dashboard.

Settings:

```text
Base directory: stock-web
Build command: pnpm build
Publish directory: stock-web/dist
```

Environment variables:

```env
VITE_STOCK_DATA_PROVIDER=http
VITE_STOCK_API_BASE_URL=https://<render-backend-domain>/api
VITE_REFRESH_INTERVAL_MS=60000
```

Deploy the site and record the Netlify production URL.

## 4. CORS finalization

Netlify production URL is already known. Render CORS should include:

```env
STOCK_API_CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,https://a-stock-watch-assistant.netlify.app
```

Redeploy the Render backend.

## 5. Verification

Open the Netlify site and verify:

- Home page does not show `Failed to fetch`.
- Data source status shows live, fresh cache, stale cache, or fallback clearly.
- Market overview loads through the Render backend.
- Search and stock detail pages work.
- Intraday and K-line charts render after lazy loading.
- The page still states that it is only for auxiliary observation and does not constitute investment advice.

## Data and compliance limits

The production site depends on free public market data sources. Render network conditions, upstream anti-bot behavior, and public API changes may affect availability. If live data fails, the backend may serve cache or mock fallback, and the frontend must display that status explicitly. Do not present fallback or mock data as live market data.



