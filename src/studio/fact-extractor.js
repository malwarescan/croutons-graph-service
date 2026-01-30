/* jshint node: true, esversion: 11 */
// AI-Powered Fact Extraction for Studio
// Extracts atomic facts from narrative content using OpenAI

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * System prompt for fact extraction
 */
const FACT_EXTRACTION_PROMPT = `You are an expert at extracting atomic facts from content for AEO/GEO optimization.

Your task is to extract clear, unambiguous, standalone facts from the provided content.

RULES FOR ATOMIC FACTS:
1. Each fact must be a complete, standalone statement
2. NO pronouns (it, this, that, they, etc.) - use explicit entity names
3. Format: Subject-Predicate-Object (who/what does/is what)
4. Be specific and concrete - avoid vague language
5. Include numbers, constraints, and qualifiers when present
6. Extract only facts explicitly stated, not implications
7. Each fact should be verifiable from the source text

GOOD EXAMPLES:
- "Croutons Protocol defines a standardized format for web content"
- "Atomic facts require explicit entity references to avoid ambiguity"
- "Evidence anchors use character offsets for precise text location"
- "The compliance score ranges from 0 to 100 based on A-J requirements"

BAD EXAMPLES (avoid these):
- "It provides better search visibility" (pronoun)
- "This is useful for developers" (vague pronoun)
- "The system works well" (vague, not specific)
- "Users benefit from the features" (implied benefit, not explicit)

OUTPUT FORMAT:
Return a JSON array of objects, each with:
{
  "subject": "Entity or concept name",
  "predicate": "Action or relationship verb",
  "object": "What the subject does/is/has",
  "object_type": "category|pricing|feature|process|requirement|metric|definition|constraint",
  "evidence_text": "Exact quote from source text that supports this fact",
  "confidence": 0.0-1.0
}

Extract 5-15 high-quality atomic facts. Prioritize clarity and specificity over quantity.`;

/**
 * Extract atomic facts from narrative content
 * 
 * @param {Object} content - Content to analyze
 * @param {string} content.title - Page title
 * @param {string} content.thesis - Main thesis/hook
 * @param {string} content.answerBox - 40-60 word summary
 * @param {Array} content.sections - Array of {heading, content} objects
 * @returns {Promise<Array>} Array of extracted facts
 */
async function extractFacts(content) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Build the content string to analyze
  let contentText = '';
  
  if (content.title) {
    contentText += `TITLE: ${content.title}\n\n`;
  }
  
  if (content.thesis) {
    contentText += `THESIS: ${content.thesis}\n\n`;
  }
  
  if (content.answerBox) {
    contentText += `ANSWER BOX (Main Summary):\n${content.answerBox}\n\n`;
  }
  
  if (content.sections && content.sections.length > 0) {
    contentText += 'SECTIONS:\n\n';
    content.sections.forEach((section, idx) => {
      if (section.heading && section.content) {
        contentText += `## ${section.heading}\n${section.content}\n\n`;
      }
    });
  }

  if (!contentText.trim()) {
    throw new Error('No content provided to extract facts from');
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: FACT_EXTRACTION_PROMPT
        },
        {
          role: 'user',
          content: `Extract atomic facts from this content:\n\n${contentText}`
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent extraction
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(response);
    const facts = parsed.facts || parsed.extracted_facts || parsed;
    
    // Validate and normalize the facts
    if (!Array.isArray(facts)) {
      throw new Error('Expected array of facts from OpenAI');
    }

    return facts
      .filter(fact => fact.subject && fact.predicate && fact.object)
      .filter(fact => fact.confidence >= 0.6) // Only high-confidence facts
      .map(fact => ({
        subject: fact.subject.trim(),
        predicate: fact.predicate.trim(),
        object: fact.object.trim(),
        object_type: fact.object_type || 'definition',
        evidence_text: fact.evidence_text?.trim() || '',
        confidence: fact.confidence || 0.8
      }));

  } catch (error) {
    console.error('Fact extraction error:', error);
    throw new Error(`Failed to extract facts: ${error.message}`);
  }
}

/**
 * Validate that a fact is properly formatted
 */
function validateFact(fact) {
  const errors = [];
  
  if (!fact.subject || fact.subject.length < 2) {
    errors.push('Subject is required and must be at least 2 characters');
  }
  
  if (!fact.predicate || fact.predicate.length < 2) {
    errors.push('Predicate is required and must be at least 2 characters');
  }
  
  if (!fact.object || fact.object.length < 2) {
    errors.push('Object is required and must be at least 2 characters');
  }
  
  // Check for pronouns (common mistake)
  const pronouns = /\b(it|this|that|these|those|they|them|he|she)\b/i;
  if (pronouns.test(fact.subject)) {
    errors.push('Subject contains a pronoun - use explicit entity name');
  }
  if (pronouns.test(fact.object)) {
    errors.push('Object contains a pronoun - be more specific');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  extractFacts,
  validateFact
};
