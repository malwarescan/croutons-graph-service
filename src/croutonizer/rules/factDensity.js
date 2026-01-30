/* jshint node: true, esversion: 11 */
// Rule E: Fact Density + Dead Zone Detection
// Ensures content has adequate fact density and no "fluff zones"

const { countWords } = require('../engine/parser');

// Ideal fact density range (facts per 100 words)
const IDEAL_MIN = 0.8;
const IDEAL_MAX = 2.0;

// Hedge/vibe words to detect
const HEDGE_WORDS = [
  'can', 'may', 'might', 'could', 'would', 'should',
  'often', 'usually', 'generally', 'typically', 'sometimes',
  'possibly', 'probably', 'likely', 'perhaps', 'potentially'
];

const VIBE_CLAIMS = [
  /\b(better|improves?|helps?|enhances?)\b(?!\s+(?:by|to|than|with)\s+\d)/i,
  /\bpowerful\b(?!\s+(?:than|as))/i,
  /\brobust\b(?!\s+against)/i,
  /\beffective\b(?!\s+(?:at|for|in)\s+\w+ing)/i,
  /\bimportant\b(?!\s+(?:because|for|to))/i,
  /\buseful\b(?!\s+(?:for|when|because))/i
];

/**
 * Check fact density across document
 * @param {Object} ast - Document AST
 * @param {Array} extractedFacts - Facts extracted from content
 * @returns {Array} Array of issues
 */
function checkFactDensity(ast, extractedFacts = []) {
  const issues = [];
  
  // Calculate overall density
  const totalWords = ast.metadata.total_words;
  const factCount = extractedFacts.length;
  const density = totalWords > 0 ? (factCount / totalWords) * 100 : 0;
  
  // Check if density is too low
  if (density < IDEAL_MIN) {
    issues.push({
      id: 'fact-density-low',
      rule: 'factDensity',
      type: 'warning',
      severity: 'non-blocking',
      location: { section_id: 'document' },
      message: `Low fact density: ${density.toFixed(2)} facts per 100 words (target: ${IDEAL_MIN}-${IDEAL_MAX})`,
      explanation: 'Content needs more concrete, verifiable facts',
      score_impact: -3,
      fix: {
        type: 'suggest',
        suggestion: 'Add specific facts: numbers, definitions, rules, comparisons',
        action: 'manual',
        instructions: 'Convert vague statements into concrete claims'
      }
    });
  }
  
  // Check if density is too high (rare but possible)
  if (density > IDEAL_MAX * 1.5) {
    issues.push({
      id: 'fact-density-high',
      rule: 'factDensity',
      type: 'warning',
      severity: 'non-blocking',
      location: { section_id: 'document' },
      message: `Very high fact density: ${density.toFixed(2)} per 100 words`,
      explanation: 'Consider adding explanatory context between facts',
      score_impact: -1,
      fix: {
        type: 'suggest',
        suggestion: 'Add context sentences to connect facts',
        action: 'manual'
      }
    });
  }
  
  // Check for dead zones (sections with 0 facts)
  ast.sections.forEach(section => {
    if (section.isAnswerBox) return;
    
    const sectionFacts = extractedFacts.filter(fact => 
      fact.source_section_id === section.id ||
      (fact.evidence_text && section.text.toLowerCase().includes(fact.evidence_text.toLowerCase()))
    );
    
    if (section.paragraphs.length >= 2 && sectionFacts.length === 0) {
      issues.push({
        id: `fact-density-dead-zone-${section.id}`,
        rule: 'factDensity',
        type: 'warning',
        severity: 'non-blocking',
        location: {
          section_id: section.id
        },
        message: `Section "${section.title}" has no extractable facts (dead zone)`,
        explanation: 'This section may be fluff or lack concrete information',
        score_impact: -2,
        fix: {
          type: 'suggest',
          suggestion: 'Add specific facts, numbers, or definitions',
          action: 'manual',
          instructions: 'Convert general statements into verifiable claims'
        }
      });
    }
  });
  
  // Check for excessive hedging
  const hedgeIssues = checkHedging(ast);
  issues.push(...hedgeIssues);
  
  // Check for vibe claims
  const vibeIssues = checkVibeClaims(ast);
  issues.push(...vibeIssues);
  
  return issues;
}

/**
 * Check for excessive hedge words
 */
function checkHedging(ast) {
  const issues = [];
  
  ast.sections.forEach(section => {
    if (section.isAnswerBox) return;
    
    const textLower = section.text.toLowerCase();
    const wordCount = countWords(section.text);
    
    // Count hedge words
    let hedgeCount = 0;
    HEDGE_WORDS.forEach(hedge => {
      const regex = new RegExp(`\\b${hedge}\\b`, 'gi');
      const matches = textLower.match(regex);
      if (matches) hedgeCount += matches.length;
    });
    
    const hedgeDensity = hedgeCount / wordCount;
    
    // If >5% of words are hedges, flag
    if (hedgeDensity > 0.05 && hedgeCount >= 3) {
      issues.push({
        id: `fact-density-hedge-${section.id}`,
        rule: 'factDensity',
        type: 'warning',
        severity: 'non-blocking',
        location: {
          section_id: section.id
        },
        message: `Section "${section.title}" has excessive hedging (${hedgeCount} hedge words)`,
        explanation: 'Too much uncertainty language weakens factual authority',
        score_impact: -1,
        fix: {
          type: 'suggest',
          suggestion: 'Replace hedge words with definitive statements when possible',
          action: 'manual',
          instructions: `Common hedges found: ${HEDGE_WORDS.filter(h => textLower.includes(h)).slice(0, 5).join(', ')}`
        }
      });
    }
  });
  
  return issues;
}

/**
 * Check for vibe claims (vague positive statements)
 */
function checkVibeClaims(ast) {
  const issues = [];
  
  ast.sections.forEach(section => {
    if (section.isAnswerBox) return;
    
    const vibeMatches = [];
    VIBE_CLAIMS.forEach(pattern => {
      const matches = section.text.match(pattern);
      if (matches) vibeMatches.push(matches[0]);
    });
    
    if (vibeMatches.length >= 2) {
      issues.push({
        id: `fact-density-vibe-${section.id}`,
        rule: 'factDensity',
        type: 'warning',
        severity: 'non-blocking',
        location: {
          section_id: section.id
        },
        message: `Section "${section.title}" contains vague claims without specifics`,
        explanation: 'Vague positive statements need concrete objects/metrics',
        score_impact: -1,
        fix: {
          type: 'suggest',
          suggestion: 'Add specific objects: "improves rankings by 15%" not just "improves"',
          action: 'manual',
          instructions: `Found vague claims: ${vibeMatches.slice(0, 3).join(', ')}`
        }
      });
    }
  });
  
  return issues;
}

/**
 * Detect consecutive low-fact paragraphs (dead zones)
 */
function detectDeadZones(ast, extractedFacts) {
  const deadZones = [];
  
  ast.sections.forEach(section => {
    if (section.isAnswerBox) return;
    
    let consecutiveLowFact = 0;
    let zoneStart = null;
    
    section.paragraphs.forEach((para, idx) => {
      // Count facts in this paragraph
      const paraFacts = extractedFacts.filter(fact =>
        fact.evidence_text && 
        para.text.toLowerCase().includes(fact.evidence_text.toLowerCase())
      );
      
      if (paraFacts.length === 0 && para.word_count > 20) {
        if (consecutiveLowFact === 0) {
          zoneStart = idx;
        }
        consecutiveLowFact++;
      } else {
        consecutiveLowFact = 0;
      }
      
      // If 2+ consecutive paragraphs with 0 facts
      if (consecutiveLowFact >= 2) {
        deadZones.push({
          section_id: section.id,
          section_title: section.title,
          start_para: zoneStart,
          end_para: idx,
          para_count: consecutiveLowFact
        });
        consecutiveLowFact = 0; // Reset to avoid duplicate detection
      }
    });
  });
  
  return deadZones;
}

/**
 * Generate fix suggestion for fluff paragraph
 */
function generateFluffFix(paragraph, section) {
  // Extract first sentence
  const firstSentence = paragraph.text.split(/[.!?]/)[0];
  
  return {
    type: 'suggest',
    suggestion: 'Convert to explicit claim: "[Entity] [does/is/has] [specific measurable outcome]"',
    action: 'manual',
    instructions: `Current: "${firstSentence}..." → Make specific with numbers or concrete details`,
    template: {
      subject: 'Extract entity from context',
      predicate: 'Use concrete verb',
      object: 'Add measurable/specific outcome'
    }
  };
}

/**
 * Calculate fact density score
 */
function calculateFactDensityScore(ast, extractedFacts, issues) {
  // Calculate density
  const totalWords = ast.metadata.total_words;
  const factCount = extractedFacts.length;
  const density = totalWords > 0 ? (factCount / totalWords) * 100 : 0;
  
  // Score based on density band
  let bandScore = 0;
  if (density >= IDEAL_MIN && density <= IDEAL_MAX) {
    bandScore = 1.0; // Perfect band
  } else if (density < IDEAL_MIN) {
    // Linear down to 0 at 0.2 facts/100w
    bandScore = Math.max(0, density / IDEAL_MIN);
  } else if (density > IDEAL_MAX) {
    // Linear down to 0 at 3.0 facts/100w
    const overage = density - IDEAL_MAX;
    const maxOverage = 1.0; // 3.0 - 2.0
    bandScore = Math.max(0, 1 - (overage / maxOverage));
  }
  
  let baseScore = 15 * bandScore;
  
  // Detect dead zones
  const deadZones = detectDeadZones(ast, extractedFacts);
  const deadZonePenalty = Math.min(5, deadZones.length * 1);
  
  // Apply issue penalties
  const densityIssues = issues.filter(i => i.rule === 'factDensity');
  const warningCount = densityIssues.filter(i => i.type === 'warning').length;
  const warningPenalty = Math.min(5, warningCount * 1);
  
  const finalScore = Math.max(0, Math.round(baseScore - deadZonePenalty - warningPenalty));
  
  return {
    score: finalScore,
    max: 15,
    issues: densityIssues.length,
    density: density.toFixed(2),
    facts: factCount,
    words: totalWords,
    dead_zones: deadZones.length,
    band: density >= IDEAL_MIN && density <= IDEAL_MAX ? 'ideal' : (density < IDEAL_MIN ? 'low' : 'high')
  };
}

module.exports = {
  checkFactDensity,
  checkHedging,
  checkVibeClaims,
  detectDeadZones,
  calculateFactDensityScore,
  IDEAL_MIN,
  IDEAL_MAX
};
