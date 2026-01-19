# LLM Costs

A static web app displaying LLM pricing data from [LiteLLM](https://github.com/BerriAI/litellm). Pre-generates 2000+ model pages at build time with nightly updates via GitHub Actions.

## Tech Stack

- **Build**: Node.js 20+ (ES modules, no dependencies)
- **Hosting**: Cloudflare Pages
- **Styling**: Signature look (warm beige background, Gowun Batang headings, Inter body, indigo accents)

## Project Structure

```
llmcosts/
├── src/
│   └── build.js              # Single build script (~800 lines)
├── dist/                     # Generated output (git-ignored)
│   ├── index.html            # Search homepage with embedded model index
│   ├── _headers              # Cloudflare headers (JSON content-type for /api/*)
│   ├── api/[slug]/index.html # Raw JSON endpoints
│   └── [slug]/index.html     # Model detail pages
├── .github/workflows/
│   └── build-and-deploy.yml  # Nightly build at 3 AM UTC
├── .last-build-hash          # SHA256 for change detection
└── package.json
```

## Commands

```bash
npm run build      # Fetch data and generate dist/
npx serve dist     # Local preview server
```

## How It Works

1. **Build script** fetches `model_prices_and_context_window_backup.json` from LiteLLM
2. Filters models without pricing data
3. Generates for each model:
   - `/api/[slug]/index.html` - JSON data (served as `application/json` via `_headers`)
   - `/[slug]/index.html` - Detail page that fetches its own API endpoint
4. Generates index page with embedded model array for client-side search

## URL Slugs

Model names are slugified: `/`, `.`, `:` become `-`

Example: `anthropic.claude-3-5-haiku-20241022-v1:0` → `anthropic-claude-3-5-haiku-20241022-v1-0`

## Search Features

- **Text search**: Matches model name or provider (e.g., `haiku`, `gpt-4`)
- **Provider filter**: `provider:anthropic` for exact provider match
- **Combined**: `provider:openai 4o` for provider + text search
- **Priority sorting**: Original providers (anthropic, openai, gemini, vertex_ai-language-models, etc.) appear first
- **URL state**: Search query synced to `?q=` parameter for history/sharing

## Priority Providers

These providers are sorted to the top of search results:
- anthropic, openai, gemini, vertex_ai, vertex_ai_beta
- vertex_ai-language-models, deepseek, mistral, xai

## Deployment

GitHub Action runs nightly:
1. Fetches source JSON, computes SHA256
2. Skips if hash matches `.last-build-hash`
3. Runs build, commits new hash
4. Deploys to Cloudflare Pages via wrangler

**Required secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
