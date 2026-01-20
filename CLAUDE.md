# LLM Costs

A static web app displaying LLM pricing data from [LiteLLM](https://github.com/BerriAI/litellm). Pre-generates 2000+ model pages at build time with nightly updates via GitHub Actions.

## Tech Stack

- **Build**: Node.js 20+ (ES modules, no dependencies)
- **Hosting**: Cloudflare Pages
- **Database**: Cloudflare D1 (SQLite) with FTS5 for fuzzy search
- **Styling**: Signature look (warm beige background, Gowun Batang headings, Inter body, indigo accents)

## Project Structure

```
toktab/
├── src/
│   └── build.js              # Single build script (~1200 lines)
├── functions/
│   └── api/
│       └── search.js         # Cloudflare Pages Function for /api/search
├── dist/                     # Generated output (git-ignored)
│   ├── index.html            # Search homepage with embedded model index
│   ├── 404.html              # Dynamic 404 with model suggestions
│   ├── openapi.json          # OpenAPI 3.1 spec for the API
│   ├── seed.sql              # D1 database schema and data
│   ├── _headers              # Cloudflare headers (JSON content-type for /api/*)
│   ├── api/[slug]/index.html # Raw JSON endpoints
│   └── [slug]/index.html     # Model detail pages
├── .github/workflows/
│   └── build-and-deploy.yml  # Nightly build at 3 AM UTC
├── wrangler.toml             # D1 database binding
├── .last-build-hash          # SHA256 for change detection
└── package.json
```

## Commands

```bash
npm run build           # Fetch data and generate dist/ + seed.sql
npm run dev             # Local dev server with D1 binding
npm run db:seed:local   # Seed local D1 database
npm run db:seed:remote  # Seed production D1 database
```

## How It Works

1. **Build script** fetches `model_prices_and_context_window_backup.json` from LiteLLM
2. Filters models without pricing data
3. Generates for each model:
   - `/api/[slug]/index.html` - JSON data (served as `application/json` via `_headers`)
   - `/[slug]/index.html` - Detail page that fetches its own API endpoint
4. Generates index page with embedded model array for client-side search
5. Generates `seed.sql` with D1 schema and FTS5 index for fuzzy search
6. Generates `404.html` that fetches suggestions from search API
7. Generates `openapi.json` OpenAPI 3.1 specification

## URL Slugs

Model names are slugified: `/`, `.`, `:` become `-`

Example: `anthropic.claude-3-5-haiku-20241022-v1:0` → `anthropic-claude-3-5-haiku-20241022-v1-0`

## Search Features

- **Text search**: Matches model name or provider (e.g., `haiku`, `gpt-4`)
- **Provider filter**: `provider:anthropic` for exact provider match
- **Combined**: `provider:openai 4o` for provider + text search
- **Priority sorting**: Original providers (anthropic, openai, gemini, vertex_ai-language-models, etc.) appear first
- **URL state**: Search query synced to `?q=` parameter for history/sharing
- **Fuzzy fallback**: When no exact matches found, calls `/api/search` for fuzzy results with "Did you mean?" heading

## Priority Providers

These providers are sorted to the top of search results, in this order:
1. anthropic, openai, gemini, vertex_ai, vertex_ai_beta
2. vertex_ai-language-models, deepseek, mistral, xai

## Search API

`GET /api/search?q={query}&limit={n}`

- Uses D1 with FTS5 trigram tokenizer for fuzzy matching
- Supports partial matches and typos (e.g., "claud" matches "claude")
- Falls back to LIKE search for queries < 3 characters
- Results ranked by BM25 relevance, with priority providers boosted

## OpenAPI Spec

Available at `https://toktab.com/openapi.json`. Documents both API endpoints:
- `GET /api/{slug}/` - Get model pricing data
- `GET /api/search?q={query}` - Fuzzy search models

## 404 Page

When users visit a non-existent model URL:
1. Static `404.html` is served (no worker invocation)
2. Client-side JS fetches `/api/search` with the failed slug
3. Displays similar model suggestions

## Deployment

GitHub Action runs nightly:
1. Fetches source JSON, computes SHA256
2. Skips if hash matches `.last-build-hash`
3. Runs build, commits new hash
4. Seeds D1 database with `seed.sql`
5. Deploys to Cloudflare Pages via wrangler

**Required secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

**D1 Database**: `toktab-models` (ID: `9e2aaf5e-cb0b-492c-aca2-9dbf9f571b31`)
