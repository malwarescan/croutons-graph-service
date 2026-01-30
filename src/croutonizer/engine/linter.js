/* jshint node: true, esversion: 11 */
// Croutonizer Linter Engine
// Runs all rules and collects issues

const { checkSectionAnchoring } = require('../rules/sectionAnchoring');
const { checkEntityPersistence } = require('../rules/entityPersistence');
const { extractEntities } = require('./parser');

/**
 * Run all linter rules on document
 * @param {Object} ast - Document AST
 * @returns {Promise<Array>} Array of issues
 */
async function runLinter(ast) {
  const issues = [];
  
  // Extract document-level entities
  const documentEntities = extractDocumentEntities(ast);
  
  // Run Rule A: Section Anchoring
  ast.sections.forEach(section => {
    const issue = checkSectionAnchoring(section);
    if (issue) issues.push(issue);
  });
  
  // Run Rule B: Entity Persistence
  ast.sections.forEach(section => {
    section.paragraphs.forEach(paragraph => {
      const paraIssues = checkEntityPersistence(
        paragraph,
        section,
        ast.sections,
        documentEntities
      );
      issues.push(...paraIssues);
    });
  });
  
  // TODO: Add Rules C, D, E when implemented
  
  return issues;
}

/**
 * Extract primary entities from document
 */
function extractDocumentEntities(ast) {
  const entities = new Set();
  
  // Extract from title
  if (ast.title) {
    extractEntities(ast.title).forEach(e => entities.add(e));
  }
  
  // Extract from Answer Box if present
  const answerBox = ast.sections.find(s => s.isAnswerBox);
  if (answerBox) {
    extractEntities(answerBox.text).forEach(e => entities.add(e));
  }
  
  // Extract from first regular section
  const firstSection = ast.sections.find(s => !s.isAnswerBox);
  if (firstSection) {
    extractEntities(firstSection.text).forEach(e => entities.add(e));
  }
  
  return Array.from(entities);
}

/**
 * Group issues by rule
 */
function groupIssuesByRule(issues) {
  const grouped = {
    sectionAnchoring: [],
    entityPersistence: [],
    claimEvidence: [],
    headerSpecificity: [],
    factDensity: [],
    factQuality: []
  };
  
  issues.forEach(issue => {
    if (grouped[issue.rule]) {
      grouped[issue.rule].push(issue);
    }
  });
  
  return grouped;
}

/**
 * Get blocking issues
 */
function getBlockingIssues(issues) {
  return issues.filter(i => i.severity === 'blocking' && i.type === 'error');
}

/**
 * Determine overall status
 */
function determineStatus(issues) {
  const blocking = getBlockingIssues(issues);
  if (blocking.length > 0) return 'errors';
  
  const warnings = issues.filter(i => i.type === 'warning');
  if (warnings.length > 0) return 'warnings';
  
  return 'clean';
}

module.exports = {
  runLinter,
  extractDocumentEntities,
  groupIssuesByRule,
  getBlockingIssues,
  determineStatus
};
