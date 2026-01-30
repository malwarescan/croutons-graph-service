/* jshint node: true, esversion: 11 */
// Croutonizer Scoring Engine
// Calculates 0-100 score with breakdown

const { calculateSectionAnchoringScore } = require('../rules/sectionAnchoring');
const { calculateEntityPersistenceScore } = require('../rules/entityPersistence');
const { calculateClaimEvidenceScore } = require('../rules/claimEvidence');
const { determineStatus, getBlockingIssues } = require('./linter');

/**
 * Calculate Croutonizer Score (0-100)
 * @param {Object} ast - Document AST
 * @param {Array} issues - Issues from linter
 * @param {Array} keyFacts - Key facts (optional)
 * @returns {Object} Score with breakdown
 */
function calculateScore(ast, issues, keyFacts = []) {
  const breakdown = {
    sectionAnchoring: calculateSectionAnchoringScore(ast.sections, issues),
    entityPersistence: calculateEntityPersistenceScore(ast.sections, issues),
    claimEvidence: calculateClaimEvidenceScore(ast, keyFacts, issues),
    headerSpecificity: calculateHeaderScore(ast.sections, issues),
    factDensity: calculateDensityScore(ast, issues),
    factQuality: calculateQualityScore(ast, issues)
  };
  
  // Calculate total
  const total = Object.values(breakdown).reduce((sum, cat) => sum + cat.score, 0);
  
  // Get top fixes
  const topFixes = rankFixesByImpact(issues).slice(0, 5);
  
  return {
    total: Math.round(total),
    breakdown,
    status: determineStatus(issues),
    blocking_issues: getBlockingIssues(issues).length,
    top_fixes: topFixes
  };
}

// Claim-Evidence scoring is now imported from claimEvidence.js rule

/**
 * Calculate Header Specificity score (Rule D)
 * Placeholder until Rule D is implemented
 */
function calculateHeaderScore(sections, issues) {
  // TODO: Implement when Rule D is ready
  const headerIssues = issues.filter(i => i.rule === 'headerSpecificity');
  
  if (headerIssues.length === 0) {
    return { score: 15, max: 15, issues: 0 };
  }
  
  const warningCount = headerIssues.filter(i => i.type === 'warning').length;
  const score = Math.max(0, 15 - (warningCount * 2));
  
  return {
    score,
    max: 15,
    issues: headerIssues.length
  };
}

/**
 * Calculate Fact Density score (Rule E)
 * Placeholder until Rule E is implemented
 */
function calculateDensityScore(ast, issues) {
  // TODO: Implement when Rule E is ready
  const densityIssues = issues.filter(i => i.rule === 'factDensity');
  
  if (densityIssues.length === 0) {
    return { score: 15, max: 15, issues: 0 };
  }
  
  const warningCount = densityIssues.filter(i => i.type === 'warning').length;
  const score = Math.max(0, 15 - (warningCount * 2));
  
  return {
    score,
    max: 15,
    issues: densityIssues.length
  };
}

/**
 * Calculate Fact Quality score (Rule F)
 * Based on extracted facts
 */
function calculateQualityScore(ast, issues) {
  const facts = ast.facts || [];
  
  if (facts.length === 0) {
    return { score: 0, max: 10, issues: 0, message: 'No facts extracted yet' };
  }
  
  // Count valid facts
  const validFacts = facts.filter(fact => {
    // Check for pronouns
    if (/\b(it|this|that|these|those)\b/i.test(fact.subject) ||
        /\b(it|this|that|these|those)\b/i.test(fact.object)) {
      return false;
    }
    
    // Check for grounding
    if (fact.grounded === false) return false;
    
    return true;
  });
  
  const validRatio = validFacts.length / facts.length;
  const score = Math.round(10 * validRatio);
  
  return {
    score,
    max: 10,
    issues: facts.length - validFacts.length,
    valid_facts: validFacts.length,
    total_facts: facts.length
  };
}

/**
 * Rank fixes by impact (score improvement potential)
 */
function rankFixesByImpact(issues) {
  return issues
    .filter(i => i.fix && i.score_impact)
    .sort((a, b) => Math.abs(b.score_impact) - Math.abs(a.score_impact))
    .map(issue => ({
      issue_id: issue.id,
      impact: Math.abs(issue.score_impact),
      fix: issue.message,
      type: issue.type,
      suggestion: issue.fix.suggestion || issue.fix.instructions
    }));
}

module.exports = {
  calculateScore,
  rankFixesByImpact
};
