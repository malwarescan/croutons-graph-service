/* jshint node: true, esversion: 11 */
// Rule F: Fact Quality Validation
// Ensures facts are properly formatted, grounded, and citation-ready

// Vague predicates that need specific objects
const VAGUE_PREDICATES = [
  'helps', 'improves', 'supports', 'enhances', 'enables',
  'provides', 'offers', 'gives', 'allows', 'facilitates'
];

// Pronouns that should never appear in facts
const PRONOUNS = /\b(it|this|that|these|those|they|them|their|he|she|his|her)\b/i;

/**
 * Validate all facts in document
 * @param {Array} facts - Array of fact objects
 * @returns {Array} Array of issues
 */
function checkFactQuality(facts) {
  if (!facts || facts.length === 0) {
    return []; // No facts to validate
  }
  
  const issues = [];
  
  facts.forEach((fact, idx) => {
    // Validate fact structure
    const structureIssues = validateFactStructure(fact, idx);
    issues.push(...structureIssues);
    
    // Check for pronouns
    const pronounIssue = checkPronouns(fact, idx);
    if (pronounIssue) issues.push(pronounIssue);
    
    // Validate predicate
    const predicateIssue = checkPredicate(fact, idx);
    if (predicateIssue) issues.push(predicateIssue);
    
    // Check grounding
    const groundingIssue = checkGrounding(fact, idx);
    if (groundingIssue) issues.push(groundingIssue);
  });
  
  return issues;
}

/**
 * Validate basic fact structure (S-P-O format)
 */
function validateFactStructure(fact, index) {
  const issues = [];
  
  // Check subject
  if (!fact.subject || fact.subject.trim().length < 2) {
    issues.push({
      id: `fact-quality-structure-subject-${index}`,
      rule: 'factQuality',
      type: 'error',
      severity: 'blocking',
      location: {
        fact_index: index,
        field: 'subject'
      },
      message: `Fact ${index + 1}: Subject is missing or too short`,
      explanation: 'Every fact needs a clear subject (entity or concept)',
      score_impact: -2,
      fix: {
        type: 'suggest',
        suggestion: 'Add explicit entity name (2+ characters)',
        action: 'manual'
      }
    });
  }
  
  // Check predicate
  if (!fact.predicate || fact.predicate.trim().length < 2) {
    issues.push({
      id: `fact-quality-structure-predicate-${index}`,
      rule: 'factQuality',
      type: 'error',
      severity: 'blocking',
      location: {
        fact_index: index,
        field: 'predicate'
      },
      message: `Fact ${index + 1}: Predicate is missing or too short`,
      explanation: 'Every fact needs a clear predicate (action or relationship)',
      score_impact: -2,
      fix: {
        type: 'suggest',
        suggestion: 'Add concrete verb or relationship',
        action: 'manual'
      }
    });
  }
  
  // Check object
  if (!fact.object || fact.object.trim().length < 2) {
    issues.push({
      id: `fact-quality-structure-object-${index}`,
      rule: 'factQuality',
      type: 'error',
      severity: 'blocking',
      location: {
        fact_index: index,
        field: 'object'
      },
      message: `Fact ${index + 1}: Object is missing or too short`,
      explanation: 'Every fact needs a clear object (what the subject does/is/has)',
      score_impact: -2,
      fix: {
        type: 'suggest',
        suggestion: 'Add specific outcome or value',
        action: 'manual'
      }
    });
  }
  
  return issues;
}

/**
 * Check for pronouns in subject or object
 */
function checkPronouns(fact, index) {
  const subjectHasPronoun = PRONOUNS.test(fact.subject || '');
  const objectHasPronoun = PRONOUNS.test(fact.object || '');
  
  if (subjectHasPronoun || objectHasPronoun) {
    const location = subjectHasPronoun ? 'subject' : 'object';
    const value = subjectHasPronoun ? fact.subject : fact.object;
    
    return {
      id: `fact-quality-pronoun-${index}`,
      rule: 'factQuality',
      type: 'error',
      severity: 'blocking',
      location: {
        fact_index: index,
        field: location
      },
      message: `Fact ${index + 1}: Contains pronoun in ${location}: "${value}"`,
      explanation: 'Facts must use explicit entity names, not pronouns',
      score_impact: -2,
      fix: {
        type: 'replace',
        suggestion: 'Replace pronoun with explicit entity name',
        action: 'manual',
        instructions: `Change "${value}" to specific entity (e.g., "301 redirect", "Google Search Console")`
      }
    };
  }
  
  return null;
}

/**
 * Validate predicate quality
 */
function checkPredicate(fact, index) {
  const predicate = (fact.predicate || '').toLowerCase().trim();
  
  // Check for compound predicates (multiple verbs)
  const verbCount = predicate.split(/\s+and\s+|\s+or\s+|,/).length;
  if (verbCount > 1) {
    return {
      id: `fact-quality-compound-${index}`,
      rule: 'factQuality',
      type: 'warning',
      severity: 'non-blocking',
      location: {
        fact_index: index,
        field: 'predicate'
      },
      message: `Fact ${index + 1}: Compound predicate detected`,
      explanation: 'Split compound facts into separate facts (one claim per fact)',
      score_impact: -1,
      fix: {
        type: 'suggest',
        suggestion: 'Split into multiple facts, one predicate each',
        action: 'manual',
        instructions: `"${fact.subject} | ${predicate} | ${fact.object}" → Split at "and/or"`
      }
    };
  }
  
  // Check for vague predicates
  const isVague = VAGUE_PREDICATES.some(vague => 
    predicate.includes(vague.toLowerCase())
  );
  
  if (isVague) {
    // Check if object is specific/measurable
    const objectText = (fact.object || '').toLowerCase();
    const hasNumber = /\d/.test(objectText);
    const hasMeasure = /\b(by|to|than|percent|%|x|times|ratio)\b/.test(objectText);
    const isSpecific = hasNumber || hasMeasure || objectText.length > 30;
    
    if (!isSpecific) {
      return {
        id: `fact-quality-vague-${index}`,
        rule: 'factQuality',
        type: 'warning',
        severity: 'non-blocking',
        location: {
          fact_index: index,
          field: 'predicate'
        },
        message: `Fact ${index + 1}: Vague predicate "${predicate}" needs specific object`,
        explanation: 'Vague predicates need measurable outcomes',
        score_impact: -1,
        fix: {
          type: 'suggest',
          suggestion: 'Add specific measurement or comparison to object',
          action: 'manual',
          instructions: `"${fact.subject} improves X" → "${fact.subject} improves X by 15-20%"`
        }
      };
    }
  }
  
  return null;
}

/**
 * Check fact grounding (evidence exists)
 */
function checkGrounding(fact, index) {
  // Skip if grounding explicitly marked as valid
  if (fact.grounded === true || fact.evidence_text) {
    return null;
  }
  
  // Check if grounding explicitly failed
  if (fact.grounded === false) {
    return {
      id: `fact-quality-ungrounded-${index}`,
      rule: 'factQuality',
      type: 'error',
      severity: 'blocking',
      location: {
        fact_index: index
      },
      message: `Fact ${index + 1}: Not grounded in source text`,
      explanation: 'This fact cannot be verified from the narrative content',
      score_impact: -2,
      fix: {
        type: 'suggest',
        suggestion: 'Remove fact or add supporting text to narrative',
        action: 'manual',
        instructions: 'Facts must be explicitly stated in the content'
      }
    };
  }
  
  // No evidence span provided (warning, not blocking)
  return {
    id: `fact-quality-no-evidence-${index}`,
    rule: 'factQuality',
    type: 'warning',
    severity: 'non-blocking',
    location: {
      fact_index: index
    },
    message: `Fact ${index + 1}: No evidence span provided`,
    explanation: 'Facts should reference exact text for grounding',
    score_impact: -0.5,
    fix: {
      type: 'suggest',
      suggestion: 'Use "Extract Facts" to auto-generate evidence spans',
      action: 'extract'
    }
  };
}

/**
 * Calculate fact quality score
 */
function calculateFactQualityScore(facts, issues) {
  if (!facts || facts.length === 0) {
    return { 
      score: 0, 
      max: 10, 
      issues: 0, 
      message: 'No facts to validate' 
    };
  }
  
  // Already calculated in scorer.js using this rule's issues
  // This is a helper for standalone usage
  const qualityIssues = issues.filter(i => i.rule === 'factQuality');
  
  const factsWithIssues = new Set();
  qualityIssues.forEach(issue => {
    if (issue.location && issue.location.fact_index !== undefined) {
      factsWithIssues.add(issue.location.fact_index);
    }
  });
  
  const validFacts = facts.length - factsWithIssues.size;
  const validRatio = validFacts / facts.length;
  
  const score = Math.round(10 * validRatio);
  
  return {
    score,
    max: 10,
    issues: qualityIssues.length,
    valid_facts: validFacts,
    total_facts: facts.length,
    quality_rate: Math.round(validRatio * 100) + '%'
  };
}

module.exports = {
  checkFactQuality,
  validateFactStructure,
  checkPronouns,
  checkPredicate,
  checkGrounding,
  calculateFactQualityScore
};
