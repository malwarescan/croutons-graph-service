/* jshint node: true, esversion: 11 */
// Rule A: Section Anchoring (U-Curve Guardrail)
// Ensures long sections have Crouton Summaries to prevent lost-in-the-middle

const { extractEntities } = require('../engine/parser');

/**
 * Check if section needs Crouton Summary and has one
 * @param {Object} section - Section AST node
 * @returns {Object|null} Issue object or null if passes
 */
function checkSectionAnchoring(section) {
  // Skip Answer Box
  if (section.isAnswerBox) return null;
  
  // Check if section is long enough to require summary
  const requiresSummary = section.token_count > 700 || section.word_count > 500;
  
  if (!requiresSummary) return null;
  
  // Check if has valid summary
  if (section.has_summary) {
    return validateSummary(section);
  }
  
  // Missing summary - create error
  return {
    id: `section-anchor-${section.id}`,
    rule: 'sectionAnchoring',
    type: 'error',
    severity: 'blocking',
    location: {
      section_id: section.id,
      paragraph_index: section.paragraphs.length - 1
    },
    message: `Section "${section.title}" is ${section.word_count} words but missing Crouton Summary`,
    explanation: 'Long sections need a summary to maintain retrieval reliability',
    score_impact: -5,
    fix: generateSummaryFix(section)
  };
}

/**
 * Validate existing summary quality
 */
function validateSummary(section) {
  const lastPara = section.paragraphs[section.paragraphs.length - 1];
  
  // Extract summary text (remove "Crouton Summary:" prefix if present)
  const summaryText = lastPara.text.replace(/^Crouton Summary:\s*/i, '');
  
  // Check for pronoun ambiguity
  const pronounPattern = /\b(it|this|that|these|those)\b/gi;
  const pronouns = summaryText.match(pronounPattern);
  
  if (pronouns && pronouns.length > 0) {
    return {
      id: `section-anchor-pronoun-${section.id}`,
      rule: 'sectionAnchoring',
      type: 'warning',
      severity: 'non-blocking',
      location: {
        section_id: section.id,
        paragraph_index: section.paragraphs.length - 1
      },
      message: `Crouton Summary contains pronouns: ${pronouns.join(', ')}`,
      explanation: 'Summaries should use explicit entity names for clarity',
      score_impact: -2,
      fix: {
        type: 'suggest',
        suggestion: improveSummary(summaryText, section),
        action: 'replaceText'
      }
    };
  }
  
  // Check for vague predicates
  const vagueWords = ['helps', 'improves', 'better', 'good', 'important'];
  const hasVague = vagueWords.some(word => summaryText.toLowerCase().includes(word));
  
  if (hasVague) {
    return {
      id: `section-anchor-vague-${section.id}`,
      rule: 'sectionAnchoring',
      type: 'warning',
      severity: 'non-blocking',
      location: {
        section_id: section.id,
        paragraph_index: section.paragraphs.length - 1
      },
      message: 'Crouton Summary contains vague predicates',
      explanation: 'Be specific: use concrete verbs and measurable outcomes',
      score_impact: -1,
      fix: {
        type: 'suggest',
        suggestion: 'Make the summary more specific with concrete details',
        action: 'manual'
      }
    };
  }
  
  return null; // Summary is good!
}

/**
 * Generate Crouton Summary fix suggestion
 */
function generateSummaryFix(section) {
  // Extract key entities from section
  const entities = extractEntities(section.text);
  const mainEntity = entities[0] || section.title.split(' ')[0];
  
  // Look for key verbs/actions
  const actionWords = extractActionWords(section.text);
  const mainAction = actionWords[0] || 'defines';
  
  // Generate suggestion
  const suggestion = `Crouton Summary: This section explains how ${mainEntity} ${mainAction} for improved implementation.`;
  
  return {
    type: 'insert',
    suggestion: suggestion,
    action: 'insertAtEnd',
    instructions: 'Add this summary at the end of the section, or write your own (12-35 words, no pronouns)'
  };
}

/**
 * Improve existing summary by replacing pronouns
 */
function improveSummary(summaryText, section) {
  const entities = extractEntities(section.text);
  const mainEntity = entities[0] || section.title;
  
  // Replace common pronouns
  let improved = summaryText
    .replace(/\bit\b/gi, mainEntity)
    .replace(/\bthis\b/gi, `this ${section.title.toLowerCase()}`)
    .replace(/\bthat\b/gi, mainEntity);
  
  return improved;
}

/**
 * Extract action words (verbs) from text
 */
function extractActionWords(text) {
  // Common action verbs in technical writing
  const actionPattern = /\b(defines|explains|describes|provides|enables|requires|supports|implements|handles|processes|manages|controls|validates|generates)\b/gi;
  const matches = text.match(actionPattern) || [];
  return [...new Set(matches.map(m => m.toLowerCase()))];
}

/**
 * Calculate section anchoring score
 * @param {Array} sections - All sections
 * @param {Array} issues - Issues from linter
 * @returns {Object} Score breakdown
 */
function calculateSectionAnchoringScore(sections, issues) {
  const requiredSections = sections.filter(s => 
    !s.isAnswerBox && (s.token_count > 700 || s.word_count > 500)
  );
  
  if (requiredSections.length === 0) {
    return { score: 20, max: 20, issues: 0 };
  }
  
  const anchorIssues = issues.filter(i => i.rule === 'sectionAnchoring');
  const errorCount = anchorIssues.filter(i => i.type === 'error').length;
  const warningCount = anchorIssues.filter(i => i.type === 'warning').length;
  
  // Calculate score
  const errorPenalty = errorCount * 5;
  const warningPenalty = warningCount * 2;
  const score = Math.max(0, 20 - errorPenalty - warningPenalty);
  
  return {
    score,
    max: 20,
    issues: anchorIssues.length,
    required: requiredSections.length,
    missing: errorCount
  };
}

module.exports = {
  checkSectionAnchoring,
  validateSummary,
  generateSummaryFix,
  calculateSectionAnchoringScore
};
