/* jshint node: true, esversion: 11 */
// Croutonizer Document Parser
// Converts markdown/text into AST with sections, paragraphs, tokens

/**
 * Parse document into structured AST
 * @param {Object} content - Content object with title, sections, etc.
 * @returns {Object} Document AST
 */
function parseDocument(content) {
  const ast = {
    title: content.title || '',
    sections: [],
    entities: {
      primary: [],
      aliases: {}
    },
    facts: [],
    metadata: {
      total_words: 0,
      total_tokens: 0,
      section_count: 0
    }
  };

  // Parse Answer Box as first section if present
  if (content.answerBox) {
    ast.sections.push(parseSection({
      id: 'answer-box',
      level: 1,
      title: 'Answer Box',
      content: content.answerBox,
      isAnswerBox: true
    }));
  }

  // Parse main sections
  if (content.sections && Array.isArray(content.sections)) {
    content.sections.forEach((section, idx) => {
      if (section.heading && section.content) {
        ast.sections.push(parseSection({
          id: `section-${idx}`,
          level: 2,
          title: section.heading,
          content: section.content,
          isAnswerBox: false
        }));
      }
    });
  }

  // Calculate totals
  ast.sections.forEach(section => {
    ast.metadata.total_words += section.word_count;
    ast.metadata.total_tokens += section.token_count;
  });
  ast.metadata.section_count = ast.sections.length;

  return ast;
}

/**
 * Parse individual section into structured format
 */
function parseSection(sectionData) {
  const text = sectionData.content || '';
  const paragraphs = parseParagraphs(text);
  
  const section = {
    id: sectionData.id,
    level: sectionData.level,
    title: sectionData.title,
    text: text,
    paragraphs: paragraphs,
    word_count: countWords(text),
    token_count: estimateTokens(text),
    has_summary: detectCroutonSummary(paragraphs),
    isAnswerBox: sectionData.isAnswerBox || false
  };

  return section;
}

/**
 * Split text into paragraphs with metadata
 */
function parseParagraphs(text) {
  if (!text) return [];
  
  // Split by double newlines or single newlines followed by blank line
  const paraTexts = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  const paragraphs = [];
  let charOffset = 0;
  
  paraTexts.forEach((paraText, idx) => {
    const trimmed = paraText.trim();
    const wordCount = countWords(trimmed);
    const tokenCount = estimateTokens(trimmed);
    
    // Find actual position in original text
    const startChar = text.indexOf(trimmed, charOffset);
    const endChar = startChar + trimmed.length;
    
    paragraphs.push({
      index: idx,
      text: trimmed,
      word_count: wordCount,
      token_count: tokenCount,
      start_char: startChar >= 0 ? startChar : charOffset,
      end_char: endChar >= 0 ? endChar : charOffset + trimmed.length
    });
    
    charOffset = endChar >= 0 ? endChar : charOffset + trimmed.length;
  });
  
  return paragraphs;
}

/**
 * Count words in text
 */
function countWords(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Estimate token count (rough approximation)
 * Rule of thumb: words * 1.3 for English text
 */
function estimateTokens(text) {
  if (!text) return 0;
  const words = countWords(text);
  return Math.ceil(words * 1.3);
}

/**
 * Detect if section has Crouton Summary
 */
function detectCroutonSummary(paragraphs) {
  if (!paragraphs || paragraphs.length === 0) return false;
  
  const lastPara = paragraphs[paragraphs.length - 1];
  
  // Check for explicit "Crouton Summary:" marker
  if (lastPara.text.startsWith('Crouton Summary:')) {
    return true;
  }
  
  // Check if last paragraph is short and summary-like
  // (12-35 words, contains entity-like capitalized words)
  if (lastPara.word_count >= 12 && lastPara.word_count <= 35) {
    const hasCapitalizedWords = /[A-Z][a-z]+/.test(lastPara.text);
    if (hasCapitalizedWords) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract likely entities from text
 * Simple heuristic: capitalized words/phrases
 */
function extractEntities(text) {
  if (!text) return [];
  
  // Match capitalized words (2+ chars)
  const matches = text.match(/\b[A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,})*\b/g) || [];
  
  // Deduplicate and filter common words
  const commonWords = ['The', 'This', 'That', 'These', 'Those', 'When', 'Where', 'Why', 'How'];
  const entities = [...new Set(matches)].filter(e => !commonWords.includes(e));
  
  return entities;
}

/**
 * Check if text starts with a pronoun
 */
function startsWithPronoun(text) {
  if (!text) return false;
  
  const pronounPattern = /^(it|this|that|these|those|they|their|its|them|such|here|there)\b/i;
  return pronounPattern.test(text.trim());
}

/**
 * Find entity mentions in text window
 */
function findEntityMentions(text, entities, windowSize = 150) {
  if (!text || !entities || entities.length === 0) return [];
  
  const mentions = [];
  const textLower = text.toLowerCase();
  
  entities.forEach(entity => {
    if (textLower.includes(entity.toLowerCase())) {
      mentions.push(entity);
    }
  });
  
  return mentions;
}

/**
 * Get previous N tokens from a position
 */
function getPreviousTokens(sections, sectionId, paragraphIndex, tokenLimit = 150) {
  const tokens = [];
  let currentSection = sections.find(s => s.id === sectionId);
  if (!currentSection) return tokens;
  
  // Get text from current section up to current paragraph
  for (let i = 0; i < paragraphIndex && i < currentSection.paragraphs.length; i++) {
    const para = currentSection.paragraphs[i];
    tokens.push(...para.text.split(/\s+/));
  }
  
  // Return last N tokens
  return tokens.slice(-tokenLimit);
}

module.exports = {
  parseDocument,
  parseSection,
  parseParagraphs,
  countWords,
  estimateTokens,
  detectCroutonSummary,
  extractEntities,
  startsWithPronoun,
  findEntityMentions,
  getPreviousTokens
};
