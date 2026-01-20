import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SOURCE_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/litellm/model_prices_and_context_window_backup.json';
const DIST_DIR = 'dist';

function slugify(modelName) {
  return modelName.replace(/[\/\.:]/g, '-');
}

function extractProvider(modelName) {
  if (modelName.includes('/')) {
    return modelName.split('/')[0];
  }
  if (modelName.startsWith('gpt-') || modelName.startsWith('o1') || modelName.startsWith('o3')) {
    return 'openai';
  }
  if (modelName.startsWith('claude-')) {
    return 'anthropic';
  }
  if (modelName.startsWith('gemini')) {
    return 'google';
  }
  return 'unknown';
}

function formatCost(cost) {
  if (cost === null || cost === undefined) return null;
  if (cost === 0) return '$0';
  if (cost < 0.000001) return `$${cost.toExponential(2)}`;
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(4)}`;
}

function formatCostPer1M(cost) {
  if (cost === null || cost === undefined) return null;
  const per1M = cost * 1_000_000;
  if (per1M < 0.01) return `$${per1M.toFixed(4)}`;
  return `$${per1M.toFixed(2)}`;
}

function generateDetailPageHTML(modelName, slug, buildDate) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(modelName)} Pricing - Toktab</title>
  <meta name="description" content="Current pricing data for ${escapeHtml(modelName)} - input/output token costs and context window. Free JSON API available.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      background-color: #FBF9F6;
      background-image: repeating-linear-gradient(
        135deg,
        transparent,
        transparent 10px,
        rgba(0,0,0,0.02) 10px,
        rgba(0,0,0,0.02) 20px
      );
      min-height: 100vh;
      color: #4A443C;
      line-height: 1.6;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    h1, h2, h3 {
      font-family: 'Gowun Batang', serif;
      color: #4A443C;
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      word-break: break-word;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: #4f46e5;
      text-decoration: none;
      margin-bottom: 1.5rem;
      font-weight: 500;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    .provider-badge {
      display: inline-block;
      background: #e0e7ff;
      color: #4338ca;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 1.5rem;
      text-decoration: none;
      transition: background-color 0.2s;
    }

    .provider-badge:hover {
      background: #c7d2fe;
    }

    .card {
      background: white;
      border: 1px solid #e7e5e4;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .card h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e7e5e4;
    }

    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .pricing-item {
      background: #fafaf9;
      padding: 1rem;
      border-radius: 8px;
    }

    .pricing-label {
      font-size: 0.875rem;
      color: #78716c;
      margin-bottom: 0.25rem;
    }

    .pricing-value {
      font-size: 1.25rem;
      font-weight: 600;
      color: #4f46e5;
    }

    .pricing-per-million {
      font-size: 0.875rem;
      color: #78716c;
    }

    .context-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    }

    .context-item {
      text-align: center;
      padding: 1rem;
      background: #fafaf9;
      border-radius: 8px;
    }

    .context-value {
      font-size: 1.5rem;
      font-weight: 600;
      color: #4A443C;
    }

    .context-label {
      font-size: 0.875rem;
      color: #78716c;
    }

    .loading {
      text-align: center;
      padding: 3rem;
      color: #78716c;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e7e5e4;
      border-top-color: #4f46e5;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error {
      text-align: center;
      padding: 2rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 12px;
      color: #dc2626;
    }

    .source-link {
      color: #4f46e5;
      text-decoration: none;
    }

    .source-link:hover {
      text-decoration: underline;
    }

    .url-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .url-row:last-child {
      margin-bottom: 0;
    }

    .url-label {
      font-size: 0.875rem;
      color: #78716c;
      min-width: 70px;
    }

    .url-value {
      flex: 1;
      font-family: ui-monospace, monospace;
      font-size: 0.875rem;
      background: #fafaf9;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .copy-btn {
      background: #e0e7ff;
      color: #4338ca;
      border: none;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
      white-space: nowrap;
    }

    .copy-btn:hover {
      background: #c7d2fe;
    }

    .copy-btn.copied {
      background: #ccfbf1;
      color: #0d9488;
    }

    #content { display: none; }

    .footer {
      text-align: center;
      margin-top: 3rem;
      color: #a8a29e;
      font-size: 0.875rem;
    }

    .footer a {
      color: #4f46e5;
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link" id="back-link" onclick="return goBack()">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 10H5M5 10L10 5M5 10L10 15"/>
      </svg>
      Back to Search
    </a>
    <script>
      function goBack() {
        try {
          if (document.referrer && new URL(document.referrer).origin === window.location.origin) {
            history.back();
            return false;
          }
        } catch (e) {}
        return true;
      }
    </script>

    <div id="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading model data...</p>
    </div>

    <div id="error" class="error" style="display: none;">
      <p>Failed to load model data. Please try again.</p>
    </div>

    <div id="content">
      <h1>${escapeHtml(modelName)}</h1>
      <a id="provider-badge" class="provider-badge" href="/"></a>

      <div id="pricing-section" class="card">
        <h2>Pricing</h2>
        <div id="pricing-grid" class="pricing-grid"></div>
      </div>

      <div id="context-section" class="card">
        <h2>Context Window</h2>
        <div id="context-grid" class="context-grid"></div>
      </div>

      <div id="source-section" class="card" style="display: none;">
        <h2>Source</h2>
        <p><a id="source-link" class="source-link" target="_blank" rel="noopener"></a></p>
      </div>

      <div class="card">
        <h2>URLs</h2>
        <div class="url-row">
          <span class="url-label">Page</span>
          <span class="url-value" id="page-url"></span>
          <button class="copy-btn" onclick="copyUrl('page-url', this)">Copy</button>
        </div>
        <div class="url-row">
          <span class="url-label">API</span>
          <span class="url-value" id="api-url"></span>
          <button class="copy-btn" onclick="copyUrl('api-url', this)">Copy</button>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Data sourced from <a href="https://github.com/BerriAI/litellm" target="_blank" rel="noopener">LiteLLM</a> on ${buildDate}. <a href="/about/">About this site</a>.</p>
    </div>
  </div>

  <script>
    const slug = '${slug}';
    const baseUrl = window.location.origin;
    document.getElementById('page-url').textContent = baseUrl + '/' + slug + '/';
    document.getElementById('api-url').textContent = baseUrl + '/api/' + slug;

    function copyUrl(elementId, btn) {
      const url = document.getElementById(elementId).textContent;
      navigator.clipboard.writeText(url).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    }

    function formatNumber(n) {
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
      if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
      return n.toString();
    }

    function formatCost(cost) {
      if (cost === null || cost === undefined) return null;
      if (cost === 0) return '$0';
      if (cost < 0.000001) return '$' + cost.toExponential(2);
      if (cost < 0.01) return '$' + cost.toFixed(6);
      return '$' + cost.toFixed(4);
    }

    function formatCostPer1M(cost) {
      if (cost === null || cost === undefined) return null;
      const per1M = cost * 1_000_000;
      if (per1M < 0.01) return '$' + per1M.toFixed(4);
      return '$' + per1M.toFixed(2);
    }

    function addPricingItem(grid, label, cost) {
      if (cost === null || cost === undefined) return;
      const div = document.createElement('div');
      div.className = 'pricing-item';
      div.innerHTML = \`
        <div class="pricing-label">\${label}</div>
        <div class="pricing-value">\${formatCostPer1M(cost)}</div>
        <div class="pricing-per-million">per 1M tokens</div>
      \`;
      grid.appendChild(div);
    }

    function addUnitPricingItem(grid, label, cost, unit) {
      if (cost === null || cost === undefined) return;
      const div = document.createElement('div');
      div.className = 'pricing-item';
      div.innerHTML = \`
        <div class="pricing-label">\${label}</div>
        <div class="pricing-value">$\${cost.toFixed(4)}</div>
        <div class="pricing-per-million">per \${unit}</div>
      \`;
      grid.appendChild(div);
    }

    function addContextItem(grid, label, value) {
      if (value === null || value === undefined) return;
      const div = document.createElement('div');
      div.className = 'context-item';
      div.innerHTML = \`
        <div class="context-value">\${formatNumber(value)}</div>
        <div class="context-label">\${label}</div>
      \`;
      grid.appendChild(div);
    }

    async function loadData() {
      try {
        const response = await fetch('/api/' + slug);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();

        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';

        // Provider badge
        const provider = data.litellm_provider || '${extractProvider(modelName)}';
        const providerBadge = document.getElementById('provider-badge');
        providerBadge.textContent = provider;
        providerBadge.href = '/?q=provider:' + encodeURIComponent(provider);

        // Pricing
        const pricingGrid = document.getElementById('pricing-grid');
        addPricingItem(pricingGrid, 'Input', data.input_cost_per_token);
        addPricingItem(pricingGrid, 'Output', data.output_cost_per_token);
        addPricingItem(pricingGrid, 'Cache Write', data.cache_creation_input_token_cost);
        addPricingItem(pricingGrid, 'Cache Read', data.cache_read_input_token_cost);
        addUnitPricingItem(pricingGrid, 'Input', data.input_cost_per_image, 'image');
        addUnitPricingItem(pricingGrid, 'Output', data.output_cost_per_image, 'image');
        addUnitPricingItem(pricingGrid, 'Input', data.input_cost_per_second, 'second');
        addUnitPricingItem(pricingGrid, 'Output', data.output_cost_per_second, 'second');

        if (pricingGrid.children.length === 0) {
          document.getElementById('pricing-section').style.display = 'none';
        }

        // Context Window
        const contextGrid = document.getElementById('context-grid');
        addContextItem(contextGrid, 'Max Input Tokens', data.max_input_tokens);
        addContextItem(contextGrid, 'Max Output Tokens', data.max_output_tokens);
        addContextItem(contextGrid, 'Max Tokens', data.max_tokens);

        if (contextGrid.children.length === 0) {
          document.getElementById('context-section').style.display = 'none';
        }

        // Source link
        if (data.source) {
          document.getElementById('source-section').style.display = 'block';
          const sourceLink = document.getElementById('source-link');
          sourceLink.href = data.source;
          sourceLink.textContent = data.source;
        }

      } catch (err) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        console.error(err);
      }
    }

    loadData();
  </script>
</body>
</html>`;
}

function generateIndexPageHTML(modelIndex, buildDate) {
  const indexJSON = JSON.stringify(modelIndex);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Toktab - Current LLM Pricing Data for 2000+ AI Models</title>
  <meta name="description" content="Current pricing data for 2000+ LLM models including GPT-4, Claude, Gemini, and Llama. Use the free JSON API to access pricing in your code. Updated daily.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      background-color: #FBF9F6;
      background-image: repeating-linear-gradient(
        135deg,
        transparent,
        transparent 10px,
        rgba(0,0,0,0.02) 10px,
        rgba(0,0,0,0.02) 20px
      );
      min-height: 100vh;
      color: #4A443C;
      line-height: 1.6;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    h1 {
      font-family: 'Gowun Batang', serif;
      font-size: 2.5rem;
      color: #4A443C;
      text-align: center;
      margin-bottom: 0.5rem;
    }

    h1 a {
      color: inherit;
      text-decoration: none;
    }

    h1 a:hover {
      text-decoration: underline;
    }

    .subtitle {
      text-align: center;
      color: #78716c;
      margin-bottom: 2rem;
    }

    .search-container {
      position: relative;
      margin-bottom: 2rem;
    }

    .search-input {
      width: 100%;
      padding: 1rem 1rem 1rem 3rem;
      font-size: 1.125rem;
      border: 2px solid #e7e5e4;
      border-radius: 12px;
      background: white;
      color: #4A443C;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .search-input:focus {
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    .search-icon {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: #a8a29e;
      pointer-events: none;
    }

    .results-count {
      color: #78716c;
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }

    .results {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .model-card {
      display: block;
      background: white;
      border: 1px solid #e7e5e4;
      border-radius: 12px;
      padding: 1rem 1.25rem;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .model-card:hover {
      border-color: #4f46e5;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }

    .model-name {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      color: #4A443C;
      word-break: break-word;
    }

    .model-name-text {
      flex: 1;
    }

    .model-provider {
      background: #e0e7ff;
      color: #4338ca;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-weight: 500;
      font-size: 0.875rem;
      border: none;
      font-family: inherit;
      cursor: pointer;
      transition: background-color 0.2s;
      flex-shrink: 0;
    }

    .model-provider:hover {
      background: #c7d2fe;
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #78716c;
    }

    .footer {
      text-align: center;
      margin-top: 3rem;
      color: #a8a29e;
      font-size: 0.875rem;
    }

    .footer a {
      color: #4f46e5;
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1><a href="/">Toktab</a></h1>
    <p class="subtitle">Current pricing for ${modelIndex.length.toLocaleString()} AI models</p>

    <div class="search-container">
      <svg class="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="9" cy="9" r="6"/>
        <path d="M13.5 13.5L17 17"/>
      </svg>
      <input
        type="text"
        class="search-input"
        placeholder="Search models (e.g., claude, gpt-4, llama)..."
        id="search"
        autofocus
      >
    </div>

    <p id="results-count" class="results-count"></p>
    <div id="results" class="results"></div>

    <div class="footer">
      <p>Data sourced from <a href="https://github.com/BerriAI/litellm" target="_blank" rel="noopener">LiteLLM</a> on ${buildDate}. <a href="/about/">About this site</a>.</p>
    </div>
  </div>

  <script>
    const models = ${indexJSON};
    const searchInput = document.getElementById('search');
    const resultsContainer = document.getElementById('results');
    const resultsCount = document.getElementById('results-count');
    const MAX_RESULTS = 50;

    function renderResults(filtered) {
      const toShow = filtered.slice(0, MAX_RESULTS);

      if (filtered.length === 0) {
        resultsCount.textContent = '';
        resultsContainer.innerHTML = '<div class="empty-state">No models found. Try a different search term.</div>';
        return;
      }

      resultsCount.textContent = filtered.length === 1
        ? '1 model found'
        : filtered.length <= MAX_RESULTS
          ? filtered.length + ' models found'
          : 'Showing ' + MAX_RESULTS + ' of ' + filtered.length + ' models';

      resultsContainer.innerHTML = toShow.map(m => \`
        <a href="/\${m.slug}/" class="model-card">
          <div class="model-name">
            <button class="model-provider" onclick="filterByProvider(event, '\${escapeHtml(m.provider)}')">\${escapeHtml(m.provider)}</button>
            <span class="model-name-text">\${escapeHtml(m.name)}</span>
          </div>
        </a>
      \`).join('');
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Original/canonical providers - prioritized in search results (order matters)
    const priorityProviders = [
      'anthropic', 'openai', 'gemini', 'vertex_ai', 'vertex_ai_beta',
      'vertex_ai-language-models', 'deepseek', 'mistral', 'xai'
    ];

    function sortByPriority(results) {
      return results.sort((a, b) => {
        const aIdx = priorityProviders.indexOf(a.provider.toLowerCase());
        const bIdx = priorityProviders.indexOf(b.provider.toLowerCase());
        const aPriority = aIdx !== -1;
        const bPriority = bIdx !== -1;
        if (aPriority && !bPriority) return -1;
        if (!aPriority && bPriority) return 1;
        if (aPriority && bPriority) return aIdx - bIdx;
        return a.name.localeCompare(b.name);
      });
    }

    function filterByProvider(event, provider) {
      event.preventDefault();
      event.stopPropagation();
      // Preserve existing search term when clicking provider pill
      const currentQuery = searchInput.value.trim();
      let textPart = '';
      if (currentQuery.toLowerCase().startsWith('provider:')) {
        // Extract text after existing provider filter
        const rest = currentQuery.slice(9);
        const spaceIdx = rest.indexOf(' ');
        textPart = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1).trim();
      } else {
        textPart = currentQuery;
      }
      const newQuery = textPart ? 'provider:' + provider + ' ' + textPart : 'provider:' + provider;
      searchInput.value = newQuery;
      search(newQuery, true);
    }

    function updateUrl(query) {
      const url = new URL(window.location);
      if (query) {
        url.searchParams.set('q', query);
      } else {
        url.searchParams.delete('q');
      }
      history.pushState(null, '', url);
    }

    function search(query, updateHistory = true) {
      const q = query.trim();
      if (updateHistory) {
        updateUrl(q);
      }
      if (!q) {
        resultsCount.textContent = '';
        resultsContainer.innerHTML = '';
        return;
      }

      // Check for provider: prefix (exact provider match, optionally combined with text search)
      if (q.toLowerCase().startsWith('provider:')) {
        const rest = q.slice(9);
        const spaceIdx = rest.indexOf(' ');
        const provider = (spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)).toLowerCase();
        const textQuery = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1).toLowerCase().trim();

        const filtered = models.filter(m => {
          if (m.provider.toLowerCase() !== provider) return false;
          if (textQuery && !m.name.toLowerCase().includes(textQuery)) return false;
          return true;
        });
        renderResults(sortByPriority(filtered));
        return;
      }

      // Regular contains search - prioritize original providers
      const qLower = q.toLowerCase();
      const filtered = models.filter(m =>
        m.name.toLowerCase().includes(qLower) ||
        m.provider.toLowerCase().includes(qLower)
      );
      renderResults(sortByPriority(filtered));
    }

    searchInput.addEventListener('input', (e) => search(e.target.value, true));

    window.addEventListener('popstate', () => {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q') || '';
      searchInput.value = q;
      search(q, false);
    });

    // Initial render from URL or empty
    const initialQuery = new URLSearchParams(window.location.search).get('q') || '';
    searchInput.value = initialQuery;
    search(initialQuery, false);
  </script>
</body>
</html>`;
}

function generateAboutPageHTML(modelCount, buildDate) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About - Toktab</title>
  <meta name="description" content="Learn how Toktab works and how to use the free JSON API for LLM pricing data.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      background-color: #FBF9F6;
      background-image: repeating-linear-gradient(
        135deg,
        transparent,
        transparent 10px,
        rgba(0,0,0,0.02) 10px,
        rgba(0,0,0,0.02) 20px
      );
      min-height: 100vh;
      color: #4A443C;
      line-height: 1.6;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    h1 {
      font-family: 'Gowun Batang', serif;
      font-size: 2.5rem;
      color: #4A443C;
      text-align: center;
      margin-bottom: 0.5rem;
    }

    h1 a {
      color: inherit;
      text-decoration: none;
    }

    h1 a:hover {
      text-decoration: underline;
    }

    h2 {
      font-family: 'Gowun Batang', serif;
      font-size: 1.5rem;
      color: #4A443C;
      margin-top: 2rem;
      margin-bottom: 1rem;
    }

    .subtitle {
      text-align: center;
      color: #78716c;
      margin-bottom: 2rem;
    }

    .content {
      background: white;
      border: 1px solid #e7e5e4;
      border-radius: 12px;
      padding: 2rem;
    }

    p {
      margin-bottom: 1rem;
    }

    ul {
      margin-bottom: 1rem;
      padding-left: 1.5rem;
    }

    li {
      margin-bottom: 0.5rem;
    }

    code {
      background: #f5f5f4;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-size: 0.875em;
    }

    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 1rem;
    }

    pre code {
      background: none;
      padding: 0;
      font-size: 0.875rem;
    }

    a {
      color: #4f46e5;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1><a href="/">Toktab</a></h1>
    <p class="subtitle">Keep tabs on your toks</p>

    <div class="content">
      <h2>What is Toktab?</h2>
      <p>Toktab provides current pricing data for ${modelCount.toLocaleString()} AI models from providers like OpenAI, Anthropic, Google, Mistral, and many more. The data is sourced from <a href="https://github.com/BerriAI/litellm">LiteLLM</a> and updated nightly.</p>

      <h2>How to search</h2>
      <p>Type in the search box to find models by name or provider:</p>
      <ul>
        <li><code>claude</code> &mdash; finds all models with "claude" in the name</li>
        <li><code>gpt-4</code> &mdash; finds GPT-4 models</li>
        <li><code>provider:anthropic</code> &mdash; shows only Anthropic models</li>
        <li><code>provider:openai 4o</code> &mdash; OpenAI models containing "4o"</li>
      </ul>

      <h2>JSON API</h2>
      <p>Every model has a JSON endpoint. Just add <code>/api/</code> before the model slug:</p>
      <pre><code>curl https://toktab.com/api/anthropic-claude-3-5-sonnet-20241022/</code></pre>
      <p>Returns pricing, context window, and other metadata. No authentication required.</p>

      <h2>How it's built</h2>
      <p>Toktab is a static site with no runtime dependencies:</p>
      <ul>
        <li>Node.js build script fetches data from LiteLLM and generates ${modelCount.toLocaleString()} static HTML pages</li>
        <li>GitHub Actions rebuilds nightly at 3 AM UTC</li>
        <li>Hosted on Cloudflare Pages</li>
        <li>Source code: <a href="https://github.com/tomdyson/toktab.com">github.com/tomdyson/toktab.com</a></li>
        <li>Built by <a href="https://tomd.org">Tom Dyson</a></li>
      </ul>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function build() {
  console.log('Fetching model prices from LiteLLM...');

  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Compute hash for change detection
  const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  console.log(`Source hash: ${hash.substring(0, 12)}...`);

  // Filter out sample_spec, non-model entries, and models without pricing
  const models = Object.entries(data).filter(([name, info]) => {
    if (name === 'sample_spec') return false;
    if (typeof info !== 'object' || info === null) return false;
    // Must have at least one pricing field
    const hasPricing = info.input_cost_per_token != null ||
                       info.output_cost_per_token != null ||
                       info.input_cost_per_image != null ||
                       info.input_cost_per_second != null;
    if (!hasPricing) return false;
    return true;
  });

  console.log(`Found ${models.length} models`);

  // Clean dist directory
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(path.join(DIST_DIR, 'api'), { recursive: true });

  // Build model index for search
  const modelIndex = [];

  // Generate build date
  const buildDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Process each model
  for (const [name, info] of models) {
    const slug = slugify(name);
    const provider = info.litellm_provider || extractProvider(name);
    const mode = info.mode || null;

    // Add to index
    modelIndex.push({
      name,
      slug,
      provider,
      mode
    });

    // Create API directory and write JSON
    const apiDir = path.join(DIST_DIR, 'api', slug);
    fs.mkdirSync(apiDir, { recursive: true });
    fs.writeFileSync(path.join(apiDir, 'index.html'), JSON.stringify(info, null, 2));

    // Create model detail page directory and write HTML
    const pageDir = path.join(DIST_DIR, slug);
    fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(path.join(pageDir, 'index.html'), generateDetailPageHTML(name, slug, buildDate));
  }

  // Sort index alphabetically
  modelIndex.sort((a, b) => a.name.localeCompare(b.name));

  // Write index page
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), generateIndexPageHTML(modelIndex, buildDate));

  // Write about page
  fs.mkdirSync(path.join(DIST_DIR, 'about'), { recursive: true });
  fs.writeFileSync(path.join(DIST_DIR, 'about', 'index.html'), generateAboutPageHTML(modelIndex.length, buildDate));

  // Write Cloudflare headers config
  fs.writeFileSync(path.join(DIST_DIR, '_headers'), `/api/*
  Content-Type: application/json
`);

  // Write robots.txt
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), `User-agent: *
Allow: /

Sitemap: https://toktab.com/sitemap.xml
`);

  // Write sitemap.xml
  const today = new Date().toISOString().split('T')[0];
  const sitemapUrls = [
    `  <url><loc>https://toktab.com/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>https://toktab.com/about/</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq></url>`,
    ...modelIndex.map(m => `  <url><loc>https://toktab.com/${m.slug}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>`)
  ].join('\n');
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls}
</urlset>
`);

  // Write hash file
  fs.writeFileSync('.last-build-hash', hash);

  console.log(`Build complete!`);
  console.log(`  - ${models.length} model pages`);
  console.log(`  - ${models.length} API endpoints`);
  console.log(`  - 1 index page`);
  console.log(`  - 1 about page`);
  console.log(`Output: ${DIST_DIR}/`);
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
