/* jshint node: true, esversion: 11 */
// Page Compliance Studio - Deterministic Hashing
// Generates stable fact_id and content_hash for reproducibility

const crypto = require('crypto');

/**
 * Generate deterministic fact_id
 * Format: {domain}:{path}#{slug(subject)}-{slug(predicate)}-{shortHash(object)}
 */
function generateFactId(domain, path, subject, predicate, object, sourceUrl) {
  const slugify = (str) => {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 40);
  };
  
  const shortHash = (str) => {
    return crypto.createHash('sha256')
      .update(str || '')
      .digest('hex')
      .substring(0, 10);
  };
  
  const domainPart = domain || 'draft';
  const pathPart = (path || '/').replace(/^\/+/, '').replace(/\/+$/, '') || 'index';
  const subjectSlug = slugify(subject);
  const predicateSlug = slugify(predicate);
  const objectHash = shortHash(object);
  
  return `${domainPart}:${pathPart}#${subjectSlug}-${predicateSlug}-${objectHash}`;
}

/**
 * Generate deterministic content_hash for page
 * Hashes canonical JSON of page data (excluding timestamps)
 */
function generateContentHash(page, sections, facts) {
  // Build canonical representation
  const canonical = {
    page: {
      domain: page.domain || '',
      path: page.path || '',
      title: page.title || '',
      page_type: page.page_type || '',
      source_url: page.source_url || ''
    },
    sections: sections
      .sort((a, b) => a.order_index - b.order_index)
      .map(s => ({
        section_key: s.section_key,
        order_index: s.order_index,
        narrative_md: s.narrative_md || ''
      })),
    facts: facts
      .sort((a, b) => (a.fact_id || '').localeCompare(b.fact_id || ''))
      .map(f => ({
        fact_id: f.fact_id,
        subject: f.subject || '',
        predicate: f.predicate || '',
        object: f.object || '',
        object_type: f.object_type || '',
        evidence_text: f.evidence_text || '',
        source_url: f.source_url || ''
      }))
  };
  
  // Deterministic JSON serialization
  const json = JSON.stringify(canonical, null, 0);
  
  // SHA-256 hash
  return crypto.createHash('sha256')
    .update(json)
    .digest('hex');
}

/**
 * Generate fragment hash for evidence text
 */
function generateFragmentHash(text) {
  if (!text) return null;
  return crypto.createHash('sha256')
    .update(text)
    .digest('hex');
}

module.exports = {
  generateFactId,
  generateContentHash,
  generateFragmentHash
};
