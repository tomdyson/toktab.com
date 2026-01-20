# Toktab

Current pricing data for 2000+ AI models. Live at [toktab.com](https://toktab.com).

## Features

- Search by model name or provider
- Filter by provider with `provider:anthropic` syntax
- JSON API for every model (no auth required)
- Updated nightly from [LiteLLM](https://github.com/BerriAI/litellm)

## JSON API

Every model has a JSON endpoint at `/api/[slug]/`:

```bash
curl https://toktab.com/api/anthropic-claude-3-5-sonnet-20241022/
```

## Development

```bash
npm run build      # Fetch data and generate dist/
npx serve dist     # Local preview server
```

## How it works

A single Node.js build script (`src/build.js`) fetches pricing data from LiteLLM and generates:

- Static HTML pages for each model
- JSON API endpoints
- Search index embedded in the homepage

No runtime dependencies. Hosted on Cloudflare Pages with nightly rebuilds via GitHub Actions.

## License

MIT
