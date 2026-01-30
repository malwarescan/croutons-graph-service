/* jshint node: true, esversion: 11 */
// Rule B: Entity Persistence (Anaphora Alert)
// Detects pronoun ambiguity and suggests entity reinjection

const { extractEntities, startsWithPronoun, getPreviousTokens } = require('../engine/parser');

const PRONOUNS = /^(it|this|that|these|those|they|their|its|them|such|here|there)\b/i;
const MID_PARAGRAPH_PRONOUNS = /\b(it|this|that|these|those|they|their|its|them)\b/gi;

/**
 * Check paragraph for entity persistence issues
 * @param {Object} paragraph - Paragraph object
 * @param {Object} section - Parent section
 * @param {Array} allSections - All sections for context
 * @param {Array} documentEntities - Primary entities from document
 * @returns {Array} Array of issues
 */
function checkEntityPersistence(paragraph, section, allSections, documentEntities) {
  const issues = [];
  
  // Check paragraph-start pronouns
  if (startsWithPronoun(paragraph.text)) {
    const issue = checkParagraphStartPronoun(paragraph, section, allSections, documentEntities);
    if (issue) issues.push(issue);
  }
  
  // Check mid-paragraph pronoun density
  const densityIssue = checkPronounDensity(paragraph, section, documentEntities);
  if (densityIssue) issues.push(densityIssue);
  
  return issues;
}

/**
 * Check paragraph that starts with pronoun
 */
function checkParagraphStartPronoun(paragraph, section, allSections, documentEntities) {
  // Get previous context (last 150 tokens)
  const previousTokens = getPreviousTokens(allSections, section.id, paragraph.index, 150);
  
  // Check if any entity is mentioned in previous context
  const entityMentions = findEntityInTokens(previousTokens, documentEntities);
  
  if (entityMentions.length === 0) {
    // No entity in recent context - ERROR
    return {
      id: `entity-persistence-start-${section.id}-${paragraph.index}`,
      rule: 'entityPersistence',
      type: 'error',
      severity: 'blocking',
      location: {
        section_id: section.id,
        paragraph_index: paragraph.index,
        char_range: [paragraph.start_char, paragraph.start_char + 50]
      },
      message: 'Paragraph starts with pronoun but no entity mentioned in last 150 tokens',
      explanation: 'Chunks lose context. Start with explicit entity name.',
      score_impact: -4,
      fix: suggestEntityReplacement(paragraph, section, documentEntities)
    };
  }
  
  // Entity exists but far away - WARNING
  if (previousTokens.length > 100) {
    return {
      id: `entity-persistence-far-${section.id}-${paragraph.index}`,
      rule: 'entityPersistence',
      type: 'warning',
      severity: 'non-blocking',
      location: {
        section_id: section.id,
        paragraph_index: paragraph.index,
        char_range: [paragraph.start_char, paragraph.start_char + 50]
      },
      message: 'Paragraph starts with pronoun; entity last mentioned 100+ tokens ago',
      explanation: 'Consider repeating entity name for clarity',
      score_impact: -2,
      fix: suggestEntityReplacement(paragraph, section, documentEntities, entityMentions)
    };
  }
  
  return null;
}

/**
 * Check overall pronoun density in paragraph
 */
function checkPronounDensity(paragraph, section, documentEntities) {
  const pronouns = paragraph.text.match(MID_PARAGRAPH_PRONOUNS) || [];
  const entityMentions = countEntityMentions(paragraph.text, documentEntities);
  
  const pronounCount = pronouns.length;
  const density = pronounCount / paragraph.word_count;
  
  // High pronoun density (>10% of words) with few entity mentions
  if (density > 0.10 && entityMentions < 2) {
    return {
      id: `entity-persistence-density-${section.id}-${paragraph.index}`,
      rule: 'entityPersistence',
      type: 'warning',
      severity: 'non-blocking',
      location: {
        section_id: section.id,
        paragraph_index: paragraph.index
      },
      message: `High pronoun density: ${pronounCount} pronouns, only ${entityMentions} entity mentions`,
      explanation: 'Replace pronouns with explicit entity names for better chunk self-sufficiency',
      score_impact: -1,
      fix: {
        type: 'suggest',
        suggestion: 'Replace pronouns with specific entity names',
        action: 'manual',
        instructions: `Found pronouns: ${pronouns.slice(0, 5).join(', ')}`
      }
    };
  }
  
  return null;
}

/**
 * Find entity mentions in token array
 */
function findEntityInTokens(tokens, entities) {
  if (!tokens || tokens.length === 0 || !entities) return [];
  
  const tokensText = tokens.join(' ').toLowerCase();
  const found = [];
  
  entities.forEach(entity => {
    if (tokensText.includes(entity.toLowerCase())) {
      found.push(entity);
    }
  });
  
  return found;
}

/**
 * Count entity mentions in text
 */
function countEntityMentions(text, entities) {
  if (!text || !entities) return 0;
  
  const textLower = text.toLowerCase();
  let count = 0;
  
  entities.forEach(entity => {
    const regex = new RegExp(`\\b${entity.toLowerCase()}\\b`, 'gi');
    const matches = textLower.match(regex);
    if (matches) count += matches.length;
  });
  
  return count;
}

/**
 * Suggest entity replacement for pronoun
 */
function suggestEntityReplacement(paragraph, section, documentEntities, recentEntities = null) {
  // Determine likely entity
  let candidateEntities = recentEntities || documentEntities;
  
  // If no recent entities, use section title or document entities
  if (!candidateEntities || candidateEntities.length === 0) {
    candidateEntities = extractEntities(section.title).concat(documentEntities);
  }
  
  const topEntity = candidateEntities[0] || 'the system';
  
  // Get first pronoun
  const firstPronoun = paragraph.text.match(PRONOUNS)[0];
  
  // Generate replacement
  const originalStart = paragraph.text.substring(0, 50);
  const replacedStart = paragraph.text.replace(PRONOUNS, topEntity);
  
  return {
    type: 'replace',
    suggestion: replacedStart.substring(0, 100) + '...',
    action: 'replaceText',
    instructions: `Replace "${firstPronoun}" with "${topEntity}" or choose from: ${candidateEntities.slice(0, 3).join(', ')}`,
    candidates: candidateEntities.slice(0, 3)
  };
}

/**
 * Calculate entity persistence score
 */
function calculateEntityPersistenceScore(sections, issues) {
  // Count total paragraphs that start with pronouns
  let totalPronounStarts = 0;
  sections.forEach(section => {
    section.paragraphs.forEach(para => {
      if (startsWithPronoun(para.text)) {
        totalPronounStarts++;
      }
    });
  });
  
  if (totalPronounStarts === 0) {
    return { score: 20, max: 20, issues: 0 };
  }
  
  const persistenceIssues = issues.filter(i => i.rule === 'entityPersistence');
  const errorCount = persistenceIssues.filter(i => i.type === 'error').length;
  const warningCount = persistenceIssues.filter(i => i.type === 'warning').length;
  
  // Calculate score
  const errorPenalty = errorCount * 4;
  const warningPenalty = warningCount * 2;
  const score = Math.max(0, 20 - errorPenalty - warningPenalty);
  
  return {
    score,
    max: 20,
    issues: persistenceIssues.length,
    pronoun_starts: totalPronounStarts,
    unresolved: errorCount
  };
}

module.exports = {
  checkEntityPersistence,
  checkParagraphStartPronoun,
  checkPronounDensity,
  suggestEntityReplacement,
  calculateEntityPersistenceScore
};
