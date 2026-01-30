/* jshint node: true, esversion: 11 */
// Page Compliance Studio - API Routes
// Internal-only endpoints with API key authentication

const { pool } = require('../../db');
const { getTemplate, getAllTemplates } = require('./templates');
const { generateFactId, generateContentHash } = require('./hashing');
const { generateMarkdown, generateNDJSON, generateJSONLD, generateHeadSnippet } = require('./generators');
const { generateComplianceReport } = require('./compliance');
const { extractFacts } = require('./fact-extractor');

/**
 * Auth middleware - Require STUDIO_API_KEY
 */
function requireStudioAuth(req, res, next) {
  const apiKey = req.headers['x-studio-key'] || req.query.api_key;
  const expectedKey = process.env.STUDIO_API_KEY;
  
  if (!expectedKey) {
    return res.status(500).json({ ok: false, error: 'Studio API key not configured' });
  }
  
  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ ok: false, error: 'Unauthorized - valid x-studio-key required' });
  }
  
  next();
}

/**
 * GET /studio/pages - List all pages
 */
async function listPages(req, res) {
  try {
    const { domain, page_type, status, search } = req.query;
    
    let query = 'SELECT * FROM studio_pages WHERE 1=1';
    const params = [];
    
    if (domain) {
      params.push(domain);
      query += ` AND domain = $${params.length}`;
    }
    
    if (page_type) {
      params.push(page_type);
      query += ` AND page_type = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (title ILIKE $${params.length} OR path ILIKE $${params.length})`;
    }
    
    query += ' ORDER BY updated_at DESC LIMIT 100';
    
    const result = await pool.query(query, params);
    
    res.json({
      ok: true,
      count: result.rows.length,
      data: result.rows
    });
    
  } catch (error) {
    console.error('[studio/pages] Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

/**
 * POST /studio/pages - Create new page from template
 */
async function createPage(req, res) {
  try {
    const { domain, path, page_type, title, source_url } = req.body;
    
    if (!path || !page_type || !title) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Required fields: path, page_type, title' 
      });
    }
    
    const template = getTemplate(page_type);
    if (!template) {
      return res.status(400).json({ 
        ok: false, 
        error: `Invalid page_type: ${page_type}` 
      });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create page
      const pageResult = await client.query(
        `INSERT INTO studio_pages (domain, path, page_type, title, source_url, status)
         VALUES ($1, $2, $3, $4, $5, 'draft')
         RETURNING *`,
        [domain, path, page_type, title, source_url || `https://${domain || 'draft'}${path}`]
      );
      
      const page = pageResult.rows[0];
      
      // Auto-generate sections from template
      // First, add heading column if it doesn't exist
      await client.query(`
        ALTER TABLE studio_sections 
        ADD COLUMN IF NOT EXISTS heading TEXT
      `).catch(() => {}); // Ignore if column already exists
      
      const sections = [];
      for (let i = 0; i < template.required_sections.length; i++) {
        const sectionDef = template.required_sections[i];
        const sectionResult = await client.query(
          `INSERT INTO studio_sections (page_id, section_key, heading, order_index, narrative_md)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [page.id, sectionDef.key, sectionDef.heading, i, '']
        );
        sections.push(sectionResult.rows[0]);
      }
      
      await client.query('COMMIT');
      
      res.json({
        ok: true,
        page,
        sections,
        template: template.required_sections
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[studio/pages/create] Error:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({ 
        ok: false, 
        error: 'Page already exists for this domain+path' 
      });
    }
    
    res.status(500).json({ ok: false, error: error.message });
  }
}

/**
 * GET /studio/pages/:id - Get page with sections and facts
 */
async function getPage(req, res) {
  try {
    const { id } = req.params;
    
    const pageResult = await pool.query(
      'SELECT * FROM studio_pages WHERE id = $1',
      [id]
    );
    
    if (pageResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Page not found' });
    }
    
    const page = pageResult.rows[0];
    
    const sectionsResult = await pool.query(
      'SELECT * FROM studio_sections WHERE page_id = $1 ORDER BY order_index',
      [id]
    );
    
    const factsResult = await pool.query(
      'SELECT * FROM studio_facts WHERE page_id = $1 ORDER BY created_at',
      [id]
    );
    
    const artifactsResult = await pool.query(
      'SELECT * FROM studio_artifacts WHERE page_id = $1',
      [id]
    );
    
    const template = getTemplate(page.page_type);
    
    res.json({
      ok: true,
      page,
      sections: sectionsResult.rows,
      facts: factsResult.rows,
      artifacts: artifactsResult.rows,
      template
    });
    
  } catch (error) {
    console.error('[studio/pages/:id] Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

/**
 * PUT /studio/pages/:id/sections - Update sections
 */
async function updateSections(req, res) {
  try {
    const { id } = req.params;
    const { sections } = req.body;
    
    if (!Array.isArray(sections)) {
      return res.status(400).json({ ok: false, error: 'sections must be an array' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const section of sections) {
        await client.query(
          `UPDATE studio_sections 
           SET narrative_md = $1, updated_at = NOW()
           WHERE id = $2 AND page_id = $3`,
          [section.narrative_md || '', section.id, id]
        );
      }
      
      await client.query('COMMIT');
      
      res.json({ ok: true, updated: sections.length });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[studio/pages/:id/sections] Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

/**
 * PUT /studio/pages/:id/facts - Update facts
 */
async function updateFacts(req, res) {
  try {
    const { id } = req.params;
    const { facts } = req.body;
    
    if (!Array.isArray(facts)) {
      return res.status(400).json({ ok: false, error: 'facts must be an array' });
    }
    
    // Get page info for fact_id generation
    const pageResult = await pool.query(
      'SELECT domain, path, source_url FROM studio_pages WHERE id = $1',
      [id]
    );
    
    if (pageResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Page not found' });
    }
    
    const page = pageResult.rows[0];
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const fact of facts) {
        // Generate deterministic fact_id
        const factId = fact.fact_id || generateFactId(
          page.domain,
          page.path,
          fact.subject,
          fact.predicate,
          fact.object,
          fact.source_url || page.source_url
        );
        
        await client.query(
          `INSERT INTO studio_facts (
            page_id, section_id, fact_id, subject, predicate, object, 
            object_type, evidence_text, source_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (page_id, fact_id) 
           DO UPDATE SET 
             subject = EXCLUDED.subject,
             predicate = EXCLUDED.predicate,
             object = EXCLUDED.object,
             object_type = EXCLUDED.object_type,
             evidence_text = EXCLUDED.evidence_text,
             source_url = EXCLUDED.source_url,
             updated_at = NOW()`,
          [
            id,
            fact.section_id || null,
            factId,
            fact.subject,
            fact.predicate,
            fact.object,
            fact.object_type || 'text',
            fact.evidence_text || null,
            fact.source_url || page.source_url
          ]
        );
      }
      
      await client.query('COMMIT');
      
      res.json({ ok: true, updated: facts.length });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[studio/pages/:id/facts] Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

/**
 * POST /studio/pages/:id/generate - Generate all artifacts
 */
async function generateArtifacts(req, res) {
  try {
    const { id } = req.params;
    
    // Fetch page, sections, facts
    const pageResult = await pool.query('SELECT * FROM studio_pages WHERE id = $1', [id]);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Page not found' });
    }
    
    const page = pageResult.rows[0];
    
    const sectionsResult = await pool.query(
      'SELECT * FROM studio_sections WHERE page_id = $1 ORDER BY order_index',
      [id]
    );
    
    const factsResult = await pool.query(
      'SELECT * FROM studio_facts WHERE page_id = $1',
      [id]
    );
    
    const sections = sectionsResult.rows;
    const facts = factsResult.rows;
    
    // Generate artifacts
    const markdown = generateMarkdown(page, sections, facts);
    const ndjson = generateNDJSON(page, facts);
    const jsonld = generateJSONLD(page, facts);
    const contentHash = generateContentHash(page, sections, facts);
    const headSnippet = generateHeadSnippet(page, contentHash);
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Store artifacts
      await client.query(
        `INSERT INTO studio_artifacts (page_id, artifact_type, content, content_hash)
         VALUES ($1, 'markdown', $2, $3)
         ON CONFLICT (page_id, artifact_type) DO UPDATE SET 
           content = EXCLUDED.content, 
           content_hash = EXCLUDED.content_hash, 
           generated_at = NOW()`,
        [id, markdown, contentHash]
      );
      
      await client.query(
        `INSERT INTO studio_artifacts (page_id, artifact_type, content, content_hash)
         VALUES ($1, 'ndjson', $2, $3)
         ON CONFLICT (page_id, artifact_type) DO UPDATE SET 
           content = EXCLUDED.content, 
           content_hash = EXCLUDED.content_hash, 
           generated_at = NOW()`,
        [id, ndjson, contentHash]
      );
      
      await client.query(
        `INSERT INTO studio_artifacts (page_id, artifact_type, content, content_hash)
         VALUES ($1, 'jsonld', $2, $3)
         ON CONFLICT (page_id, artifact_type) DO UPDATE SET 
           content = EXCLUDED.content, 
           content_hash = EXCLUDED.content_hash, 
           generated_at = NOW()`,
        [id, jsonld, contentHash]
      );
      
      await client.query(
        `INSERT INTO studio_artifacts (page_id, artifact_type, content, content_hash)
         VALUES ($1, 'head', $2, $3)
         ON CONFLICT (page_id, artifact_type) DO UPDATE SET 
           content = EXCLUDED.content, 
           content_hash = EXCLUDED.content_hash, 
           generated_at = NOW()`,
        [id, headSnippet, contentHash]
      );
      
      // Update page content_hash
      await client.query(
        'UPDATE studio_pages SET content_hash = $1, updated_at = NOW() WHERE id = $2',
        [contentHash, id]
      );
      
      await client.query('COMMIT');
      
      res.json({
        ok: true,
        content_hash: contentHash,
        artifacts: {
          markdown: { length: markdown.length, hash: contentHash },
          ndjson: { lines: ndjson.split('\n').filter(l => l.trim()).length },
          jsonld: { length: jsonld.length },
          head: { length: headSnippet.length }
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[studio/pages/:id/generate] Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

/**
 * GET /studio/pages/:id/compliance - Get A-J compliance report
 */
async function getCompliance(req, res) {
  try {
    const { id } = req.params;
    
    // Fetch all data
    const pageResult = await pool.query('SELECT * FROM studio_pages WHERE id = $1', [id]);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Page not found' });
    }
    
    const page = pageResult.rows[0];
    const template = getTemplate(page.page_type);
    
    const sectionsResult = await pool.query(
      'SELECT * FROM studio_sections WHERE page_id = $1 ORDER BY order_index',
      [id]
    );
    
    const factsResult = await pool.query(
      'SELECT * FROM studio_facts WHERE page_id = $1',
      [id]
    );
    
    const artifactsResult = await pool.query(
      'SELECT * FROM studio_artifacts WHERE page_id = $1',
      [id]
    );
    
    // Generate compliance report
    const report = generateComplianceReport(
      page,
      sectionsResult.rows,
      factsResult.rows,
      artifactsResult.rows,
      template
    );
    
    res.json({
      ok: true,
      page_id: id,
      domain: page.domain,
      path: page.path,
      ...report
    });
    
  } catch (error) {
    console.error('[studio/pages/:id/compliance] Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

/**
 * GET /studio/pages/:id/artifacts/:type - Download artifact
 */
async function getArtifact(req, res) {
  try {
    const { id, type } = req.params;
    
    const validTypes = ['markdown', 'ndjson', 'jsonld', 'head'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        ok: false, 
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}` 
      });
    }
    
    const result = await pool.query(
      `SELECT a.*, p.domain, p.path 
       FROM studio_artifacts a
       JOIN studio_pages p ON a.page_id = p.id
       WHERE a.page_id = $1 AND a.artifact_type = $2`,
      [id, type]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Artifact not found. Generate artifacts first.' 
      });
    }
    
    const artifact = result.rows[0];
    
    // Set content type based on artifact type
    const contentTypes = {
      markdown: 'text/markdown',
      ndjson: 'application/x-ndjson',
      jsonld: 'application/ld+json',
      head: 'text/html'
    };
    
    const extensions = {
      markdown: 'md',
      ndjson: 'ndjson',
      jsonld: 'jsonld',
      head: 'html'
    };
    
    const pathSlug = (artifact.path || 'index').replace(/^\/+/, '').replace(/\//g, '-');
    const filename = `${artifact.domain || 'draft'}-${pathSlug}.${extensions[type]}`;
    
    res.setHeader('Content-Type', contentTypes[type]);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(artifact.content);
    
  } catch (error) {
    console.error('[studio/pages/:id/artifacts/:type] Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

/**
 * GET /studio/templates - Get all page type templates
 */
function getTemplates(req, res) {
  try {
    const templates = getAllTemplates();
    res.json({ ok: true, templates });
  } catch (error) {
    console.error('[studio/templates] Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

/**
 * POST /studio/pages/:id/extract-facts - AI-powered fact extraction
 */
async function extractFactsFromContent(req, res) {
  try {
    const { id } = req.params;
    
    // Fetch page data
    const pageResult = await pool.query('SELECT * FROM studio_pages WHERE id = $1', [id]);
    if (pageResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Page not found' });
    }
    
    const page = pageResult.rows[0];
    
    // Fetch sections
    const sectionsResult = await pool.query(
      'SELECT * FROM studio_sections WHERE page_id = $1 ORDER BY order_index',
      [id]
    );
    
    // Build content object for extraction
    const content = {
      title: page.title,
      thesis: req.body.thesis || '',
      answerBox: req.body.answerBox || '',
      sections: sectionsResult.rows.map(s => ({
        heading: s.heading,
        content: s.narrative_md || ''
      }))
    };
    
    // Extract facts using AI
    const extractedFacts = await extractFacts(content);
    
    res.json({
      ok: true,
      page_id: id,
      facts: extractedFacts,
      count: extractedFacts.length,
      message: `Extracted ${extractedFacts.length} atomic facts from narrative content`
    });
    
  } catch (error) {
    console.error('[studio/pages/:id/extract-facts] Error:', error);
    res.status(500).json({ 
      ok: false, 
      error: error.message,
      hint: error.message.includes('OPENAI_API_KEY') 
        ? 'Configure OPENAI_API_KEY in environment variables' 
        : 'Check server logs for details'
    });
  }
}

/**
 * DELETE /studio/pages/:id - Delete page and all related data
 */
async function deletePage(req, res) {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM studio_pages WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Page not found' });
    }
    
    res.json({ ok: true, deleted: result.rows[0] });
    
  } catch (error) {
    console.error('[studio/pages/:id/delete] Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

module.exports = {
  requireStudioAuth,
  listPages,
  createPage,
  getPage,
  updateSections,
  updateFacts,
  extractFactsFromContent,
  generateArtifacts,
  getCompliance,
  getArtifact,
  getTemplates,
  deletePage
};
