/* jshint node: true, esversion: 11 */
// Page Compliance Studio - A-J Compliance Checker
// Validates page compliance with Croutons protocol

const { getTemplate } = require('./templates');

/**
 * Generate full A-J compliance report for a page
 */
function generateComplianceReport(page, sections, facts, artifacts, template) {
  const checks = {
    A: checkEntityBound(page),
    B: checkMarkdownMirror(artifacts),
    C: checkAlternateLink(artifacts),
    D: checkFrontmatter(artifacts),
    E: checkAtomicFacts(page, facts, template),
    F: checkEvidence(facts),
    G: checkNDJSON(artifacts),
    H: { pass: null, message: 'Caching headers validation not implemented in MVP' },
    I: { pass: null, message: 'Live verification check not implemented in MVP' },
    J: { pass: null, message: 'Discovery wiring check not implemented in MVP' }
  };
  
  const issues = [];
  let passCount = 0;
  let totalChecked = 0;
  
  for (const [key, result] of Object.entries(checks)) {
    if (result.pass !== null) {
      totalChecked++;
      if (result.pass === true) {
        passCount++;
      } else {
        issues.push({
          requirement: key,
          severity: result.severity || 'error',
          message: result.message,
          fix_action: result.fix_action || 'Review requirement and fix'
        });
      }
    }
  }
  
  const score = totalChecked > 0 ? Math.round((passCount / totalChecked) * 100) : 0;
  
  return {
    score,
    status: Object.fromEntries(
      Object.entries(checks).map(([k, v]) => [k, v.pass])
    ),
    checks_run: totalChecked,
    checks_passed: passCount,
    issues
  };
}

/**
 * A: Entity-bound check
 */
function checkEntityBound(page) {
  if (!page.title || page.title.trim().length === 0) {
    return {
      pass: false,
      severity: 'error',
      message: 'Page must have a title (entity name)',
      fix_action: 'Set page title in wizard'
    };
  }
  
  if (!page.source_url || page.source_url.trim().length === 0) {
    return {
      pass: false,
      severity: 'error',
      message: 'Page must have source_url',
      fix_action: 'Set source URL in page settings'
    };
  }
  
  return { pass: true, message: 'Entity is bound (title and source_url present)' };
}

/**
 * B: Markdown mirror exists
 */
function checkMarkdownMirror(artifacts) {
  const markdown = artifacts.find(a => a.artifact_type === 'markdown');
  
  if (!markdown || !markdown.content) {
    return {
      pass: false,
      severity: 'error',
      message: 'Markdown mirror not generated',
      fix_action: 'Click "Generate Artifacts" button'
    };
  }
  
  if (markdown.content.length < 100) {
    return {
      pass: false,
      severity: 'warning',
      message: 'Markdown mirror is suspiciously short',
      fix_action: 'Add narrative and facts to sections'
    };
  }
  
  return { pass: true, message: 'Markdown mirror generated' };
}

/**
 * C: Alternate link present in head snippet
 */
function checkAlternateLink(artifacts) {
  const head = artifacts.find(a => a.artifact_type === 'head');
  
  if (!head || !head.content) {
    return {
      pass: false,
      severity: 'error',
      message: 'Head snippet not generated',
      fix_action: 'Click "Generate Artifacts" button'
    };
  }
  
  if (!head.content.includes('rel="alternate"') || !head.content.includes('type="text/markdown"')) {
    return {
      pass: false,
      severity: 'error',
      message: 'Alternate link missing from head snippet',
      fix_action: 'Regenerate artifacts or check generator logic'
    };
  }
  
  return { pass: true, message: 'Alternate link present in head snippet' };
}

/**
 * D: Frontmatter fields present
 */
function checkFrontmatter(artifacts) {
  const markdown = artifacts.find(a => a.artifact_type === 'markdown');
  
  if (!markdown || !markdown.content) {
    return {
      pass: false,
      severity: 'error',
      message: 'Markdown artifact missing',
      fix_action: 'Generate artifacts first'
    };
  }
  
  const requiredFields = ['title', 'source_url', 'source_domain', 'generated_at', 'content_hash', 'page_type'];
  const missingFields = [];
  
  for (const field of requiredFields) {
    if (!markdown.content.includes(`${field}:`)) {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length > 0) {
    return {
      pass: false,
      severity: 'error',
      message: `Missing frontmatter fields: ${missingFields.join(', ')}`,
      fix_action: 'Check markdown generator includes all required fields'
    };
  }
  
  return { pass: true, message: 'All required frontmatter fields present' };
}

/**
 * E: Atomic facts quality check
 */
function checkAtomicFacts(page, facts, template) {
  if (!template) {
    return {
      pass: false,
      severity: 'error',
      message: 'No template found for page type',
      fix_action: 'Select valid page type'
    };
  }
  
  const issues = [];
  
  // Check minimum fact counts per category
  const factsByCategory = {};
  for (const fact of facts) {
    const cat = fact.object_type || 'uncategorized';
    factsByCategory[cat] = (factsByCategory[cat] || 0) + 1;
  }
  
  const requiredCats = template.required_fact_categories || {};
  for (const [category, req] of Object.entries(requiredCats)) {
    const count = factsByCategory[category] || 0;
    const min = req.min || 0;
    if (count < min) {
      issues.push(`${req.label || category}: ${count}/${min} (need ${min - count} more)`);
    }
  }
  
  // Check for pronoun ambiguity (simple regex)
  const pronounRegex = /\b(it|this|that|they|them)\b/i;
  const ambiguousFacts = facts.filter(f => 
    pronounRegex.test(f.subject) || 
    pronounRegex.test(f.object)
  );
  
  if (ambiguousFacts.length > 0) {
    issues.push(`${ambiguousFacts.length} facts contain ambiguous pronouns (it/this/that/they)`);
  }
  
  // Check fact completeness
  const incompleteFacts = facts.filter(f => 
    !f.subject || f.subject.trim().length === 0 ||
    !f.predicate || f.predicate.trim().length === 0 ||
    !f.object || f.object.trim().length === 0
  );
  
  if (incompleteFacts.length > 0) {
    issues.push(`${incompleteFacts.length} facts have empty subject/predicate/object fields`);
  }
  
  if (issues.length > 0) {
    return {
      pass: false,
      severity: 'warning',
      message: 'Atomic facts quality issues found',
      fix_action: issues.join('; ')
    };
  }
  
  return { pass: true, message: `${facts.length} atomic facts with good quality` };
}

/**
 * F: Evidence grounding check
 */
function checkEvidence(facts) {
  const totalFacts = facts.length;
  if (totalFacts === 0) {
    return {
      pass: false,
      severity: 'error',
      message: 'No facts created',
      fix_action: 'Add atomic facts to sections'
    };
  }
  
  const groundedFacts = facts.filter(f => f.evidence_text && f.evidence_text.trim().length > 0);
  const groundingRate = groundedFacts.length / totalFacts;
  
  if (groundingRate < 0.5) {
    return {
      pass: false,
      severity: 'warning',
      message: `Only ${Math.round(groundingRate * 100)}% of facts have evidence (${groundedFacts.length}/${totalFacts})`,
      fix_action: `Add evidence_text to ${totalFacts - groundedFacts.length} facts`
    };
  }
  
  return { 
    pass: true, 
    message: `${groundedFacts.length}/${totalFacts} facts have evidence (${Math.round(groundingRate * 100)}%)` 
  };
}

/**
 * G: NDJSON validity check
 */
function checkNDJSON(artifacts) {
  const ndjson = artifacts.find(a => a.artifact_type === 'ndjson');
  
  if (!ndjson || !ndjson.content) {
    return {
      pass: false,
      severity: 'error',
      message: 'NDJSON artifact not generated',
      fix_action: 'Click "Generate Artifacts" button'
    };
  }
  
  const lines = ndjson.content.split('\n').filter(l => l.trim().length > 0);
  
  if (lines.length === 0) {
    return {
      pass: false,
      severity: 'error',
      message: 'NDJSON is empty',
      fix_action: 'Add facts to page sections'
    };
  }
  
  // Validate each line is parseable JSON
  let validLines = 0;
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.fact_id && obj.subject && obj.predicate && obj.object) {
        validLines++;
      }
    } catch (e) {
      // Invalid JSON line
    }
  }
  
  if (validLines !== lines.length) {
    return {
      pass: false,
      severity: 'error',
      message: `${lines.length - validLines} invalid JSON lines in NDJSON`,
      fix_action: 'Check NDJSON generator for syntax errors'
    };
  }
  
  return { pass: true, message: `NDJSON valid (${validLines} facts)` };
}

module.exports = {
  generateComplianceReport,
  checkEntityBound,
  checkMarkdownMirror,
  checkAlternateLink,
  checkFrontmatter,
  checkAtomicFacts,
  checkEvidence,
  checkNDJSON
};
