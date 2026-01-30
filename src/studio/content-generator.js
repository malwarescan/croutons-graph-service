/* jshint node: true, esversion: 11 */
// AI Content Generator - Full page content generation from minimal input

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate complete page content from a topic + context
 * Returns all 12 checklist items filled out
 */
async function generateFullContent({ topic, context = '', contentType = 'blog' }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const systemPrompt = `You are an expert AEO/GEO content writer following the Croutons Protocol for LLM-ready content.

Generate COMPLETE, PRODUCTION-READY content that fills ALL sections of the 12-point writer checklist.

CRITICAL REQUIREMENTS:
1. Answer Box: EXACTLY 40-60 words, quotable by AI
2. Key Facts: 8-15 atomic statements, one per line, no pronouns
3. Sections: 3-6 H2 sections with definition + information-gain
4. FAQ: 3-5 Q&As, each answer <50 words
5. Structured asset: Table with 3+ columns OR decision rubric OR technical spec
6. Actionable closure: Implications (3-5 bullets) + Next Actions (3-5 bullets)

FACT FORMAT:
- Entity X defines Y
- Method A requires B when C
- Process D reduces E by 40%
(NO pronouns like "it", "this", "they")

OUTPUT AS VALID JSON with this structure:
{
  "title": "Specific outcome or mechanism (not generic)",
  "thesis": "One declarative sentence stating main claim",
  "answerBox": "40-60 word quotable snippet with (1) situation, (2) key claim, (3) mechanism",
  "keyFacts": "Line 1\\nLine 2\\nLine 3...",
  "sections": [
    {"heading": "H2 Title", "content": "Definition + information-gain item"}
  ],
  "structuredAsset": "Table or list in markdown format",
  "implications": "• Implication 1\\n• Implication 2\\n• Implication 3",
  "nextActions": "• Action 1\\n• Action 2\\n• Action 3",
  "first30Min": "One immediate action reader can execute",
  "relatedResources": "Parent pillar: [slug]\\nRelated: [slug]",
  "faq": [
    {"question": "Question text?", "answer": "Short answer <50 words"}
  ]
}`;

  const userPrompt = `Content Type: ${contentType}
Topic: ${topic}
${context ? `Additional Context: ${context}` : ''}

Generate complete content following the 12-point AEO/GEO checklist. Be specific, technical, and factual. Include real numbers, comparisons, and actionable information.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cost-effective
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    });

    const content = JSON.parse(completion.choices[0].message.content);
    
    console.log('[content-generator] Raw AI response:', JSON.stringify(content, null, 2));
    
    // Validate required fields
    if (!content.title || !content.answerBox || !content.keyFacts) {
      console.error('[content-generator] Missing required fields:', { 
        hasTitle: !!content.title, 
        hasAnswerBox: !!content.answerBox, 
        hasKeyFacts: !!content.keyFacts 
      });
      throw new Error('Generated content missing required fields');
    }
    
    // Ensure sections is an array
    if (!Array.isArray(content.sections)) {
      console.log('[content-generator] sections not array, converting');
      content.sections = [];
    }
    
    // Ensure FAQ is an array
    if (!Array.isArray(content.faq)) {
      console.log('[content-generator] faq not array, converting');
      content.faq = [];
    }
    
    // Ensure minimum section count
    if (content.sections.length < 3) {
      console.log('[content-generator] Adding default sections, current count:', content.sections.length);
      const defaultSections = getDefaultSections(contentType);
      content.sections = [...content.sections, ...defaultSections].slice(0, 5);
    }
    
    // Ensure minimum FAQ count
    if (content.faq.length < 3) {
      console.log('[content-generator] Adding default FAQs, current count:', content.faq.length);
      content.faq = [
        ...content.faq,
        { question: '', answer: '' },
        { question: '', answer: '' },
        { question: '', answer: '' }
      ].slice(0, 4);
    }
    
    // Ensure all optional fields have defaults
    content.structuredAsset = content.structuredAsset || '';
    content.implications = content.implications || '';
    content.nextActions = content.nextActions || '';
    content.first30Min = content.first30Min || '';
    content.relatedResources = content.relatedResources || '';
    content.thesis = content.thesis || '';
    
    console.log('[content-generator] Final content structure:', {
      hasTitle: !!content.title,
      hasThesis: !!content.thesis,
      hasAnswerBox: !!content.answerBox,
      hasKeyFacts: !!content.keyFacts,
      sectionsCount: content.sections?.length || 0,
      faqCount: content.faq?.length || 0,
      hasStructuredAsset: !!content.structuredAsset,
      hasImplications: !!content.implications,
      hasNextActions: !!content.nextActions,
      hasFirst30Min: !!content.first30Min,
      hasRelatedResources: !!content.relatedResources
    });
    
    return content;
    
  } catch (error) {
    console.error('[content-generator] Error:', error);
    throw new Error(`AI content generation failed: ${error.message}`);
  }
}

/**
 * Get default section templates based on content type
 */
function getDefaultSections(contentType) {
  const templates = {
    blog: [
      { heading: 'What Is This About?', content: 'Define the main entity or concept...' },
      { heading: 'Why This Matters', content: 'Explain the relevance and impact...' },
      { heading: 'How It Works', content: 'Describe the mechanism or process...' },
      { heading: 'Key Considerations', content: 'List important factors to know...' }
    ],
    landing: [
      { heading: 'The Problem', content: 'Describe the problem this solves...' },
      { heading: 'The Solution', content: 'Explain how this addresses it...' },
      { heading: 'How It Works', content: 'Outline the process or approach...' }
    ],
    product: [
      { heading: 'Overview', content: 'What this product does...' },
      { heading: 'Key Features', content: 'Primary capabilities and benefits...' },
      { heading: 'Technical Specifications', content: 'Detailed specs and requirements...' },
      { heading: 'Pricing & Plans', content: 'Cost structure and options...' }
    ],
    'how-to': [
      { heading: 'Prerequisites', content: 'What you need before starting...' },
      { heading: 'Step-by-Step Process', content: 'Detailed walkthrough...' },
      { heading: 'Common Issues', content: 'Troubleshooting and solutions...' }
    ],
    technical: [
      { heading: 'Architecture Overview', content: 'System design and components...' },
      { heading: 'API Reference', content: 'Endpoints and parameters...' },
      { heading: 'Implementation Guide', content: 'How to integrate...' }
    ]
  };
  
  return templates[contentType] || templates.blog;
}

module.exports = {
  generateFullContent
};
