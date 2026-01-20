// Search API endpoint using D1 with FTS5
// GET /api/search?q={query}&limit={n}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || url.searchParams.get('q') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

  // Handle empty query
  if (!query.trim()) {
    return jsonResponse({
      results: [],
      query: '',
      count: 0,
      error: 'Query parameter required (use ?q=your+search)'
    }, 400);
  }

  try {
    if (!env.DB) {
      return jsonResponse({
        results: [],
        query,
        count: 0,
        error: 'Database not configured'
      }, 500);
    }
    const results = await searchModels(env.DB, query, limit);
    return jsonResponse({
      results,
      query,
      count: results.length
    });
  } catch (error) {
    console.error('Search error:', error);
    return jsonResponse({
      results: [],
      query,
      count: 0,
      error: 'Search failed'
    }, 500);
  }
}

async function searchModels(db, query, limit) {
  const sanitizedQuery = sanitizeQuery(query);

  // For very short queries (< 3 chars), trigram won't work well
  // Fall back to LIKE search
  if (sanitizedQuery.length < 3) {
    return likeSearch(db, sanitizedQuery, limit);
  }

  // Try FTS5 search first
  try {
    const { results } = await db.prepare(`
      SELECT
        m.name,
        m.slug,
        m.provider,
        m.mode,
        m.input_cost_per_token,
        m.output_cost_per_token,
        bm25(models_fts) as rank,
        CASE
          WHEN m.provider IN ('anthropic', 'openai', 'gemini', 'vertex_ai', 'vertex_ai_beta') THEN 0
          WHEN m.provider IN ('vertex_ai-language-models', 'deepseek', 'mistral', 'xai') THEN 1
          ELSE 2
        END as provider_priority
      FROM models_fts
      JOIN models m ON models_fts.rowid = m.id
      WHERE models_fts MATCH ?
      ORDER BY provider_priority, rank
      LIMIT ?
    `).bind(sanitizedQuery, limit).all();

    return results || [];
  } catch (ftsError) {
    console.error('FTS search failed, falling back to LIKE:', ftsError);
    return likeSearch(db, sanitizedQuery, limit);
  }
}

async function likeSearch(db, query, limit) {
  const pattern = `%${query}%`;
  const { results } = await db.prepare(`
    SELECT
      name,
      slug,
      provider,
      mode,
      input_cost_per_token,
      output_cost_per_token,
      CASE
        WHEN provider IN ('anthropic', 'openai', 'gemini', 'vertex_ai', 'vertex_ai_beta') THEN 0
        WHEN provider IN ('vertex_ai-language-models', 'deepseek', 'mistral', 'xai') THEN 1
        ELSE 2
      END as provider_priority
    FROM models
    WHERE name LIKE ? COLLATE NOCASE
       OR slug LIKE ? COLLATE NOCASE
       OR provider LIKE ? COLLATE NOCASE
    ORDER BY provider_priority, name
    LIMIT ?
  `).bind(pattern, pattern, pattern, limit).all();

  return results || [];
}

function sanitizeQuery(query) {
  // Remove FTS5 special characters that could break the query
  // Hyphens are FTS5 operators (NOT), so replace with spaces
  // This means "gpt-4" becomes "gpt 4" which matches via trigrams
  return query
    .replace(/['"{}()^*:\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      'Access-Control-Allow-Origin': '*'
    }
  });
}
