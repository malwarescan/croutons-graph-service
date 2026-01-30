/* jshint node: true, esversion: 11 */
// Page Compliance Studio - Artifact Generators
// Generates markdown, NDJSON, JSON-LD, and head snippets

const { generateContentHash, generateFragmentHash } = require('./hashing');

/**
 * Generate Markdown Mirror with v1.1 frontmatter
 */
function generateMarkdown(page, sections, facts) {
  const contentHash = generateContentHash(page, sections, facts);
  
  // Strict frontmatter
  let markdown = '---\n';
  markdown += `title: "${page.title}"\n`;
  markdown += `source_url: "${page.source_url || page.path}"\n`;
  markdown += `source_domain: "${page.domain || 'draft'}"\n`;
  markdown += `generated_at: "${new Date().toISOString()}"\n`;
  markdown += `content_hash: "${contentHash}"\n`;
  markdown += `page_type: "${page.page_type}"\n`;
  markdown += `generated_by: "croutons-studio-v1"\n`;
  markdown += '---\n\n';
  
  // H1 title
  markdown += `# ${page.title}\n\n`;
  
  // Render sections in order
  const sortedSections = sections.sort((a, b) => a.order_index - b.order_index);
  
  for (const section of sortedSections) {
    markdown += `## ${section.heading}\n\n`;
    
    if (section.narrative_md) {
      markdown += `${section.narrative_md}\n\n`;
    }
    
    // Get facts for this section
    const sectionFacts = facts.filter(f => f.section_id === section.id);
    
    if (sectionFacts.length > 0) {
      markdown += `### Atomic Facts\n\n`;
      for (const fact of sectionFacts) {
        markdown += `- ${fact.subject} ${fact.predicate} ${fact.object}`;
        if (fact.evidence_text) {
          markdown += ` [evidence: "${fact.evidence_text.substring(0, 60)}..."]`;
        }
        markdown += '\n';
      }
      markdown += '\n';
    }
  }
  
  return markdown;
}

/**
 * Generate NDJSON facts stream (page-level)
 */
function generateNDJSON(page, facts) {
  const lines = facts.map(fact => {
    const obj = {
      fact_id: fact.fact_id,
      subject: fact.subject,
      predicate: fact.predicate,
      object: fact.object,
      object_type: fact.object_type || 'text',
      source_url: fact.source_url || page.source_url,
      source_domain: page.domain || 'draft',
      evidence_text: fact.evidence_text || null,
      fragment_hash: fact.fragment_hash || null,
      generated_at: new Date().toISOString()
    };
    
    return JSON.stringify(obj);
  });
  
  return lines.join('\n');
}

/**
 * Generate JSON-LD schema
 */
function generateJSONLD(page, facts) {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': []
  };
  
  // Always add WebPage
  schema['@graph'].push({
    '@type': 'WebPage',
    '@id': page.source_url || page.path,
    'url': page.source_url || page.path,
    'name': page.title,
    'inLanguage': 'en-US'
  });
  
  // Add entity schema based on page type
  if (page.page_type === 'home') {
    schema['@graph'].push({
      '@type': 'Organization',
      '@id': `https://${page.domain || 'draft'}/#organization`,
      'name': page.title
    });
  }
  
  if (page.page_type === 'landing' || page.page_type === 'product_marketing') {
    schema['@graph'].push({
      '@type': 'Service',
      '@id': `https://${page.domain || 'draft'}/#service`,
      'name': page.title
    });
  }
  
  if (page.page_type === 'product') {
    schema['@graph'].push({
      '@type': 'Product',
      '@id': `https://${page.domain || 'draft'}/#product`,
      'name': page.title
    });
  }
  
  if (page.page_type === 'blog') {
    schema['@graph'].push({
      '@type': 'Article',
      '@id': page.source_url || page.path,
      'headline': page.title
    });
  }
  
  // Add FAQPage if FAQ facts exist
  const faqFacts = facts.filter(f => 
    f.object_type === 'faq_answer' || 
    f.predicate === 'has FAQ answer'
  );
  
  if (faqFacts.length > 0) {
    schema['@graph'].push({
      '@type': 'FAQPage',
      'mainEntity': faqFacts.map(f => ({
        '@type': 'Question',
        'name': f.subject,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': f.object
        }
      }))
    });
  }
  
  return JSON.stringify(schema, null, 2);
}

/**
 * Generate HTML head snippet with alternate link
 */
function generateHeadSnippet(page, contentHash) {
  const mirrorPath = computeMirrorPath(page.path);
  const mirrorUrl = `https://md.${page.domain || 'draft'}${mirrorPath}`;
  
  let snippet = `<!-- Croutons Machine-Readable Alternate -->\n`;
  snippet += `<link rel="alternate" type="text/markdown" href="${mirrorUrl}">\n`;
  snippet += `<meta name="croutons-content-hash" content="${contentHash}">`;
  
  return snippet;
}

/**
 * Compute mirror path from URL path
 * / -> /index.md
 * /about/ -> /about.md
 * /en-us/x/y/ -> /en-us/x/y.md
 */
function computeMirrorPath(urlPath) {
  let path = (urlPath || '/').trim();
  
  // Strip query and fragment
  path = path.split('?')[0].split('#')[0];
  
  // Normalize trailing slashes
  path = path.replace(/\/+$/, '');
  
  if (path === '' || path === '/') {
    return '/index.md';
  }
  
  // Remove leading slash, add .md
  path = path.replace(/^\/+/, '');
  return `/${path}.md`;
}

module.exports = {
  generateMarkdown,
  generateNDJSON,
  generateJSONLD,
  generateHeadSnippet,
  computeMirrorPath
};
