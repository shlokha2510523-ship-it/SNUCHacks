# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Consumer Electronics Marketing Intelligence Platform — competitive analysis tool styled like Spotify Wrapped.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: Replit AI Integrations (OpenAI gpt-5.2)
- **Frontend**: React + Vite, Tailwind CSS, Recharts, Framer Motion, React Hook Form

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── marketing-intel/    # React + Vite frontend (Spotify Wrapped-style dashboard)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   ├── integrations-openai-ai-server/  # OpenAI server-side integration
│   └── integrations-openai-ai-react/   # OpenAI React hooks
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml     
├── tsconfig.base.json      
├── tsconfig.json           
└── package.json            
```

## Key Features

- **Company Setup**: Enter your electronics brand + 1-4 competitors
- **AI Scraping Simulation**: Website UX, social media metrics, ad analysis, product feature scores
- **Competitive Analysis**: AI-powered ranking across 10 metrics (Battery, Camera, Gaming, Durability, Sustainability, AI Features, Social, Ads, Website UX, Pricing)
- **Spotify Wrapped UI**: Cinematic rank reveals, animated metric bars, full-screen section cards
- **Reasons for Failure**: AI-consolidated failure analysis with severity levels
- **Missed Opportunities**: Effort/impact rated opportunities
- **Marketing Trends**: Industry trends, competitor shifts, whitespace mapping
- **Action Plan**: Immediate/Short-term/Long-term prioritized actions
- **Quick Fix**: One-button AI improvement for ad captions, Instagram bios, CTAs

## API Routes

- `GET /api/companies` — list company sets
- `POST /api/companies` — create company set
- `GET /api/companies/:id` — get detail with analysis
- `POST /api/companies/:id/scrape` — trigger website/social/ad scraping
- `POST /api/companies/:id/analyze` — trigger AI competitive analysis
- `GET /api/companies/:id/rankings` — get metric rankings
- `GET /api/companies/:id/action-plan` — get action plan
- `GET /api/companies/:id/trends` — get trends data
- `POST /api/companies/:id/quick-fix` — AI fix for ad copy/bios

## Database Schema

- `company_sets` — a set of companies to compare (status: pending/scraping/analyzing/complete/error)
- `companies` — individual companies with scraped data stored as JSONB
- `analysis_results` — AI-generated competitive analysis (rankings, failures, opportunities, action plan, trends) as JSONB

## Environment Variables

- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI proxy URL (auto-set)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI key (auto-set)
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `PORT` — Assigned port per service

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. Run typecheck from root: `pnpm run typecheck`.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build`
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server with AI-powered competitive analysis routes.

- Entry: `src/index.ts`
- App setup: `src/app.ts`
- Routes: `src/routes/companies.ts` — all company/analysis/quick-fix routes
- Services: `src/services/scraper.ts`, `src/services/ai-analysis.ts`
- `pnpm --filter @workspace/api-server run dev`

### `artifacts/marketing-intel` (`@workspace/marketing-intel`)

React + Vite frontend. Spotify Wrapped-style marketing intelligence dashboard.

- `pnpm --filter @workspace/marketing-intel run dev`
- Pages: Home (landing), Setup (company input), Report (full Wrapped-style results)

### `lib/db` (`@workspace/db`)

Database layer. Tables: `company_sets`, `companies`, `analysis_results`.

- `pnpm --filter @workspace/db run push` — push schema changes
