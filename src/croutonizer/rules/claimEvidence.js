/* jshint node: true, esversion: 11 */
// Rule C: Claim-Evidence Mapping (Logical Bridging / Multi-Hop Fix)
// Ensures Key Facts map to supporting sections with evidence

const { countWords, estimateTokens } = require('../engine/parser');

/**
 * Check if Key Facts are properly mapped to supporting sections
 * @param {Object} ast - Document AST
 * @param {Array} keyFacts - Array of key fact objects
 * @returns {Array} Array of issues
 */
function checkClaimEvidence(ast, keyFacts) {
  if (!keyFacts || keyFacts.length === 0) {
    return [{
      id: 'claim-evidence-no-facts',
      rule: 'claimEvidence',
      type: 'error',
      severity: 'blocking',
      location: { section_id: 'metadata' },
      message: 'No Key Facts defined',
      explanation: 'Every article needs at least 3 Key Facts for LLM citations',
      score_impact: -20,
      fix: {
        type: 'suggest',
        suggestion: 'Add Key Facts in Subject-Predicate-Object format',
        action: 'manual',
        instructions: 'Use "Extract Facts" button to generate from narrative'
      }
    }];
  }

  const issues = [];

  // Check each Key Fact for mapping and evidence
  keyFacts.forEach((fact, idx) => {
    // Check if fact has supporting section
    const mapping = checkFactMapping(fact, ast);
    if (!mapping.found) {
      issues.push({
        id: `claim-evidence-unmapped-${idx}`,
        rule: 'claimEvidence',
        type: 'error',
        severity: 'blocking',
        location: { fact_index: idx },
        message: `Key Fact "${truncateFact(fact)}" has no supporting section`,
        explanation: 'Each Key Fact must be explained in detail in at least one section',
        score_impact: -5,
        fix: {
          type: 'map',
          suggestion: `Map this fact to a section that discusses ${extractSubject(fact)}`,
          action: 'selectSection',
          fact_id: fact.id || idx
        }
      });
    } else {
      // Check distance (multi-hop risk)
      const distanceIssue = checkMultiHopDistance(fact, mapping, ast);
      if (distanceIssue) issues.push(distanceIssue);

      // Check for bridging reference
      const bridgingIssue = checkBridgingReference(fact, mapping, ast);
      if (bridgingIssue) issues.push(bridgingIssue);
    }

    // Check for evidence span
    const evidenceIssue = checkEvidenceSpan(fact, ast);
    if (evidenceIssue) issues.push(evidenceIssue);
  });

  // Check if conclusion restates key facts
  const conclusionIssue = checkConclusionRestatement(keyFacts, ast);
  if (conclusionIssue) issues.push(conclusionIssue);

  return issues;
}

/**
 * Check if fact is mentioned in any section
 */
function checkFactMapping(fact, ast) {
  const subject = extractSubject(fact);
  const predicate = extractPredicate(fact);
  
  if (!subject) return { found: false };

  // Search sections for mentions of subject
  for (let i = 0; i < ast.sections.length; i++) {
    const section = ast.sections[i];
    
    // Skip Answer Box for mapping (it's where claims are introduced)
    if (section.isAnswerBox) continue;

    const sectionTextLower = section.text.toLowerCase();
    const subjectLower = subject.toLowerCase();
    const predicateLower = predicate ? predicate.toLowerCase() : '';

    // Check if both subject and predicate appear
    if (sectionTextLower.includes(subjectLower)) {
      if (!predicate || sectionTextLower.includes(predicateLower)) {
        return {
          found: true,
          section_id: section.id,
          section_index: i,
          section_title: section.title
        };
      }
    }
  }

  return { found: false };
}

/**
 * Check multi-hop distance between claim and support
 */
function checkMultiHopDistance(fact, mapping, ast) {
  // Find where fact is first introduced (Answer Box or intro)
  const answerBox = ast.sections.find(s => s.isAnswerBox);
  const introSection = ast.sections.find(s => !s.isAnswerBox);
  
  let claimLocation = 0; // Start of document
  let claimTokens = 0;

  if (answerBox) {
    claimTokens = answerBox.token_count;
  } else if (introSection) {
    claimTokens = introSection.token_count;
  }

  // Find support section location
  const supportSection = ast.sections.find(s => s.id === mapping.section_id);
  if (!supportSection) return null;

  // Calculate token distance
  let supportLocation = 0;
  for (let i = 0; i < mapping.section_index; i++) {
    supportLocation += ast.sections[i].token_count;
  }

  const distance = supportLocation - claimTokens;

  // If distance > 900 tokens, flag multi-hop risk
  if (distance > 900) {
    return {
      id: `claim-evidence-distance-${mapping.section_id}`,
      rule: 'claimEvidence',
      type: 'warning',
      severity: 'non-blocking',
      location: {
        section_id: mapping.section_id,
        fact: truncateFact(fact)
      },
      message: `Fact support is ${distance} tokens away from claim`,
      explanation: 'Large gaps between claim and evidence hurt multi-hop retrieval',
      score_impact: -2,
      fix: generateBridgingSuggestion(fact, supportSection)
    };
  }

  return null;
}

/**
 * Check for bridging reference in distant section
 */
function checkBridgingReference(fact, mapping, ast) {
  const supportSection = ast.sections.find(s => s.id === mapping.section_id);
  if (!supportSection) return null;

  const subject = extractSubject(fact);
  
  // Look for explicit bridging phrases
  const bridgingPatterns = [
    /as mentioned earlier/i,
    /as discussed above/i,
    /this applies to/i,
    /returning to/i,
    /building on/i,
    /as stated in/i
  ];

  const hasBridging = bridgingPatterns.some(pattern => 
    pattern.test(supportSection.text)
  );

  if (!hasBridging && mapping.section_index > 2) {
    return {
      id: `claim-evidence-bridging-${mapping.section_id}`,
      rule: 'claimEvidence',
      type: 'warning',
      severity: 'non-blocking',
      location: {
        section_id: mapping.section_id,
        paragraph_index: 0
      },
      message: `Section "${supportSection.title}" discusses fact but lacks bridging reference`,
      explanation: 'Add a sentence connecting this section back to the main claim',
      score_impact: -1,
      fix: generateBridgingSuggestion(fact, supportSection)
    };
  }

  return null;
}

/**
 * Generate bridging sentence suggestion
 */
function generateBridgingSuggestion(fact, section) {
  const subject = extractSubject(fact);
  const predicate = extractPredicate(fact);
  
  const suggestions = [
    `This section applies the ${subject} ${predicate || 'concept'} defined earlier.`,
    `Returning to ${subject}: ${section.title.toLowerCase()} demonstrates this principle.`,
    `Building on the ${subject} claim, this section explains implementation.`
  ];

  return {
    type: 'insert',
    suggestion: suggestions[0],
    action: 'insertAtStart',
    instructions: 'Add a bridging sentence at the start of this section',
    alternatives: suggestions
  };
}

/**
 * Check if fact has evidence span
 */
function checkEvidenceSpan(fact, ast) {
  // Check if fact has evidence_text or source_section_id
  if (fact.evidence_text || fact.source_section_id) {
    return null; // Has evidence
  }

  // No evidence span
  return {
    id: `claim-evidence-span-${fact.id}`,
    rule: 'claimEvidence',
    type: 'warning',
    severity: 'non-blocking',
    location: { fact_id: fact.id },
    message: `Fact "${truncateFact(fact)}" has no evidence span`,
    explanation: 'Facts should point to exact text in narrative for grounding',
    score_impact: -1,
    fix: {
      type: 'suggest',
      suggestion: 'Use "Extract Facts" to auto-generate evidence spans',
      action: 'extract',
      fact_id: fact.id
    }
  };
}

/**
 * Check if conclusion restates key facts
 */
function checkConclusionRestatement(keyFacts, ast) {
  // Find conclusion section (last non-answer-box section)
  const regularSections = ast.sections.filter(s => !s.isAnswerBox);
  if (regularSections.length === 0) return null;

  const conclusion = regularSections[regularSections.length - 1];
  
  // Check if conclusion title suggests it's a conclusion
  const conclusionTitles = /conclusion|summary|takeaway|bottom line|final/i;
  if (!conclusionTitles.test(conclusion.title)) {
    return null; // Not a conclusion section
  }

  // Check if any key facts are mentioned in conclusion
  const conclusionText = conclusion.text.toLowerCase();
  let mentionedCount = 0;

  keyFacts.forEach(fact => {
    const subject = extractSubject(fact);
    if (subject && conclusionText.includes(subject.toLowerCase())) {
      mentionedCount++;
    }
  });

  const mentionRatio = mentionedCount / keyFacts.length;

  if (mentionRatio < 0.5) {
    return {
      id: 'claim-evidence-conclusion',
      rule: 'claimEvidence',
      type: 'warning',
      severity: 'non-blocking',
      location: {
        section_id: conclusion.id
      },
      message: `Conclusion only restates ${mentionedCount}/${keyFacts.length} Key Facts`,
      explanation: 'Good conclusions explicitly restate main claims for retrieval',
      score_impact: -2,
      fix: {
        type: 'suggest',
        suggestion: 'Add a sentence summarizing each Key Fact',
        action: 'manual',
        instructions: `Mention: ${keyFacts.map(extractSubject).filter(Boolean).slice(0, 3).join(', ')}`
      }
    };
  }

  return null;
}

/**
 * Extract subject from fact (various formats)
 */
function extractSubject(fact) {
  if (typeof fact === 'string') {
    // Parse "Subject | Predicate | Object" format
    const parts = fact.split('|').map(p => p.trim());
    return parts[0] || '';
  }
  return fact.subject || fact.entity || '';
}

/**
 * Extract predicate from fact
 */
function extractPredicate(fact) {
  if (typeof fact === 'string') {
    const parts = fact.split('|').map(p => p.trim());
    return parts[1] || '';
  }
  return fact.predicate || fact.relation || '';
}

/**
 * Truncate fact for display
 */
function truncateFact(fact) {
  const str = typeof fact === 'string' ? fact : `${fact.subject || ''} ${fact.predicate || ''} ${fact.object || ''}`;
  return str.length > 60 ? str.substring(0, 60) + '...' : str;
}

/**
 * Calculate claim-evidence score
 */
function calculateClaimEvidenceScore(ast, keyFacts, issues) {
  if (!keyFacts || keyFacts.length === 0) {
    return { score: 0, max: 20, issues: 1, message: 'No facts defined' };
  }

  const claimIssues = issues.filter(i => i.rule === 'claimEvidence');
  
  // Calculate mapped facts
  const mappedFacts = keyFacts.filter(fact => {
    const mapping = checkFactMapping(fact, ast);
    return mapping.found;
  });

  const mappedRatio = mappedFacts.length / keyFacts.length;
  
  // Base score from mapping
  let baseScore = 20 * mappedRatio;

  // Apply penalties
  const errorCount = claimIssues.filter(i => i.type === 'error').length;
  const warningCount = claimIssues.filter(i => i.type === 'warning').length;
  
  const errorPenalty = errorCount * 5;
  const warningPenalty = warningCount * 0.5; // Smaller penalty for distance/bridging
  
  const score = Math.max(0, Math.round(baseScore - errorPenalty - warningPenalty));

  return {
    score,
    max: 20,
    issues: claimIssues.length,
    mapped: mappedFacts.length,
    total: keyFacts.length
  };
}

module.exports = {
  checkClaimEvidence,
  checkFactMapping,
  checkMultiHopDistance,
  checkBridgingReference,
  calculateClaimEvidenceScore,
  extractSubject,
  extractPredicate
};
