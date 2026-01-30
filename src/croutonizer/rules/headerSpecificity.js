/* jshint node: true, esversion: 11 */
// Rule D: Header Specificity (Query-Ready Headers / Orphaned Header Detection)
// Ensures headers are specific and help retrieval, not generic

const { extractEntities } = require('../engine/parser');

// Generic header patterns to avoid
const GENERIC_PATTERNS = [
  /^overview$/i,
  /^introduction$/i,
  /^conclusion$/i,
  /^summary$/i,
  /^the bottom line$/i,
  /^pricing$/i,
  /^benefits$/i,
  /^faq$/i,
  /^features$/i,
  /^about$/i,
  /^details$/i,
  /^more$/i,
  /^background$/i
];

// Topic keywords for technical/SEO content
const TOPIC_KEYWORDS = [
  'redirect', 'canonical', 'indexing', 'crawling', 'sitemap',
  'schema', 'structured data', 'meta', 'robots', 'seo',
  'http', 'https', 'ssl', 'tls', 'dns', 'cdn',
  '301', '302', '404', '500', 'status code',
  'link equity', 'pagerank', 'backlink', 'anchor text',
  'keyword', 'serp', 'ranking', 'organic', 'algorithm',
  'google', 'bing', 'search engine', 'crawler', 'bot'
];

// Qualifier words that add specificity
const QUALIFIERS = [
  'permanent', 'temporary', 'automatic', 'manual',
  'best', 'worst', 'common', 'rare', 'typical',
  'advanced', 'basic', 'simple', 'complex',
  'fast', 'slow', 'efficient', 'optimal',
  'correct', 'incorrect', 'proper', 'improper',
  'during', 'after', 'before', 'while',
  'migration', 'implementation', 'configuration', 'setup'
];

// Vague nouns to avoid
const VAGUE_NOUNS = [
  'things', 'stuff', 'details', 'information', 'data',
  'aspects', 'elements', 'factors', 'points', 'items'
];

/**
 * Check header specificity for all sections
 * @param {Array} sections - Array of section AST nodes
 * @returns {Array} Array of issues
 */
function checkHeaderSpecificity(sections) {
  const issues = [];
  
  sections.forEach(section => {
    // Skip Answer Box
    if (section.isAnswerBox) return;
    
    const issue = checkHeader(section);
    if (issue) issues.push(issue);
  });
  
  // Check for consecutive generic headers
  const consecutiveIssue = checkConsecutiveGeneric(sections);
  if (consecutiveIssue) issues.push(consecutiveIssue);
  
  return issues;
}

/**
 * Check individual header quality
 */
function checkHeader(section) {
  const title = section.title;
  const titleLower = title.toLowerCase();
  
  // Calculate specificity score
  const score = calculateHeaderScore(title, section);
  
  // Check if matches generic pattern
  const isGeneric = GENERIC_PATTERNS.some(pattern => pattern.test(title));
  
  if (isGeneric) {
    return {
      id: `header-specificity-generic-${section.id}`,
      rule: 'headerSpecificity',
      type: 'warning',
      severity: 'non-blocking',
      location: {
        section_id: section.id,
        header: title
      },
      message: `Header "${title}" is too generic`,
      explanation: 'Generic headers don\'t help retrieval. Be specific about what this section covers.',
      score_impact: -2,
      fix: generateHeaderSuggestion(title, section)
    };
  }
  
  // Check specificity score
  if (score.total < 0.4) {
    return {
      id: `header-specificity-low-${section.id}`,
      rule: 'headerSpecificity',
      type: 'warning',
      severity: 'non-blocking',
      location: {
        section_id: section.id,
        header: title
      },
      message: `Header "${title}" lacks specificity (score: ${Math.round(score.total * 100)}%)`,
      explanation: `Add: ${score.missing.join(', ')}`,
      score_impact: -2,
      fix: generateHeaderSuggestion(title, section)
    };
  }
  
  // Check for vague nouns
  const hasVague = VAGUE_NOUNS.some(noun => 
    new RegExp(`\\b${noun}\\b`, 'i').test(title)
  );
  
  if (hasVague) {
    return {
      id: `header-specificity-vague-${section.id}`,
      rule: 'headerSpecificity',
      type: 'warning',
      severity: 'non-blocking',
      location: {
        section_id: section.id,
        header: title
      },
      message: `Header "${title}" contains vague noun`,
      explanation: 'Replace vague nouns with specific concepts',
      score_impact: -1,
      fix: generateHeaderSuggestion(title, section)
    };
  }
  
  return null;
}

/**
 * Calculate header specificity score (0.0 to 1.0)
 */
function calculateHeaderScore(title, section) {
  let score = 0;
  const missing = [];
  const titleLower = title.toLowerCase();
  const wordCount = title.split(/\s+/).length;
  
  // Check for topic noun (0.4 points)
  const hasTopic = TOPIC_KEYWORDS.some(keyword => 
    titleLower.includes(keyword.toLowerCase())
  );
  if (hasTopic) {
    score += 0.4;
  } else {
    missing.push('topic keyword');
  }
  
  // Check for qualifier (0.4 points)
  const hasQualifier = QUALIFIERS.some(qualifier =>
    new RegExp(`\\b${qualifier}\\b`, 'i').test(title)
  );
  if (hasQualifier) {
    score += 0.4;
  } else {
    missing.push('qualifier word');
  }
  
  // Check for entity/target term from section (0.2 points)
  const entities = extractEntities(section.text);
  const hasEntity = entities.some(entity => 
    titleLower.includes(entity.toLowerCase())
  );
  if (hasEntity) {
    score += 0.2;
  } else {
    missing.push('entity from content');
  }
  
  // Length check (4-12 words preferred)
  const lengthPenalty = wordCount < 4 || wordCount > 12 ? 0.1 : 0;
  
  return {
    total: Math.max(0, score - lengthPenalty),
    components: {
      topic: hasTopic ? 0.4 : 0,
      qualifier: hasQualifier ? 0.4 : 0,
      entity: hasEntity ? 0.2 : 0,
      length_penalty: lengthPenalty
    },
    missing
  };
}

/**
 * Generate query-ready header suggestion
 */
function generateHeaderSuggestion(currentTitle, section) {
  // Extract keywords from section content
  const entities = extractEntities(section.text);
  const contentLower = section.text.toLowerCase();
  
  // Find topic keywords mentioned in content
  const topicsInContent = TOPIC_KEYWORDS.filter(keyword =>
    contentLower.includes(keyword.toLowerCase())
  );
  
  // Find qualifiers in content
  const qualifiersInContent = QUALIFIERS.filter(qualifier =>
    new RegExp(`\\b${qualifier}\\b`, 'i').test(section.text)
  );
  
  // Build suggestion
  const mainTopic = topicsInContent[0] || entities[0] || currentTitle;
  const qualifier = qualifiersInContent[0] || 'key';
  const action = detectAction(section.text);
  
  // Generate templates
  const templates = [
    `${qualifier} ${mainTopic} ${action}`,
    `How ${mainTopic} ${action}`,
    `${mainTopic} ${action} for ${detectContext(section.text)}`,
    `Understanding ${mainTopic} ${qualifier} ${action}`
  ];
  
  // Clean up templates
  const suggestions = templates
    .map(t => t.replace(/\s+/g, ' ').trim())
    .map(t => t.charAt(0).toUpperCase() + t.slice(1))
    .filter(t => t.length >= 10 && t.length <= 80);
  
  return {
    type: 'replace',
    suggestion: suggestions[0] || `${mainTopic} Implementation Guide`,
    action: 'renameHeader',
    instructions: 'Use a query-ready header that includes topic + qualifier',
    alternatives: suggestions.slice(1, 3)
  };
}

/**
 * Detect action verbs in content
 */
function detectAction(text) {
  const actions = [
    'implementation', 'configuration', 'setup', 'migration',
    'optimization', 'troubleshooting', 'monitoring', 'testing',
    'analysis', 'comparison', 'integration', 'deployment'
  ];
  
  for (const action of actions) {
    if (new RegExp(`\\b${action}\\b`, 'i').test(text)) {
      return action;
    }
  }
  
  return 'guide';
}

/**
 * Detect context (use case)
 */
function detectContext(text) {
  const contexts = [
    'SEO', 'site migration', 'URL changes', 'search engines',
    'web development', 'best practices', 'performance',
    'user experience', 'ranking', 'indexing'
  ];
  
  for (const context of contexts) {
    if (new RegExp(`\\b${context}\\b`, 'i').test(text)) {
      return context;
    }
  }
  
  return 'implementation';
}

/**
 * Check for consecutive generic headers
 */
function checkConsecutiveGeneric(sections) {
  let consecutiveCount = 0;
  const genericSections = [];
  
  sections.forEach(section => {
    if (section.isAnswerBox) return;
    
    const isGeneric = GENERIC_PATTERNS.some(pattern => 
      pattern.test(section.title)
    );
    
    if (isGeneric) {
      consecutiveCount++;
      genericSections.push(section.title);
    } else {
      consecutiveCount = 0;
    }
  });
  
  if (consecutiveCount >= 2) {
    return {
      id: 'header-specificity-consecutive',
      rule: 'headerSpecificity',
      type: 'error',
      severity: 'blocking',
      location: { section_id: 'document' },
      message: `${consecutiveCount} consecutive generic headers detected`,
      explanation: 'Multiple generic headers in a row hurt content structure',
      score_impact: -5,
      fix: {
        type: 'suggest',
        suggestion: `Rename: ${genericSections.join(', ')}`,
        action: 'manual',
        instructions: 'Make headers specific to section content'
      }
    };
  }
  
  return null;
}

/**
 * Calculate header specificity score
 */
function calculateHeaderSpecificityScore(sections, issues) {
  const regularSections = sections.filter(s => !s.isAnswerBox);
  
  if (regularSections.length === 0) {
    return { score: 15, max: 15, issues: 0 };
  }
  
  // Calculate individual header scores
  const headerScores = regularSections.map(section => {
    const score = calculateHeaderScore(section.title, section);
    return score.total;
  });
  
  const avgScore = headerScores.reduce((sum, s) => sum + s, 0) / headerScores.length;
  
  // Base score from average
  let baseScore = 15 * avgScore;
  
  // Apply issue penalties
  const headerIssues = issues.filter(i => i.rule === 'headerSpecificity');
  const errorCount = headerIssues.filter(i => i.type === 'error').length;
  const warningCount = headerIssues.filter(i => i.type === 'warning').length;
  
  const errorPenalty = errorCount * 5;
  const warningPenalty = warningCount * 2;
  
  const finalScore = Math.max(0, Math.round(baseScore - errorPenalty - warningPenalty));
  
  return {
    score: finalScore,
    max: 15,
    issues: headerIssues.length,
    avg_specificity: Math.round(avgScore * 100) + '%',
    sections_analyzed: regularSections.length
  };
}

module.exports = {
  checkHeaderSpecificity,
  checkHeader,
  calculateHeaderScore,
  generateHeaderSuggestion,
  calculateHeaderSpecificityScore
};
