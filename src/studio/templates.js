/* jshint node: true, esversion: 11 */
// Page Compliance Studio - Page Type Templates
// Defines required sections, anchors, facts, and schema per page type

const PAGE_TEMPLATES = {
  home: {
    name: 'Home Page',
    required_sections: [
      { key: 'intro', heading: 'What We Do', anchor: 'intro' },
      { key: 'definition', heading: 'What {{entity}} Is', anchor: 'definition' },
      { key: 'capabilities', heading: 'What We Offer', anchor: 'capabilities' },
      { key: 'process', heading: 'How It Works', anchor: 'process' },
      { key: 'policies', heading: 'Key Policies', anchor: 'policies' }
    ],
    required_anchors: ['intro', 'definition', 'capabilities', 'process', 'policies'],
    required_fact_categories: {
      definition: { min: 2, label: 'Definition facts' },
      capability: { min: 3, label: 'Capability facts' },
      policy: { min: 2, label: 'Policy facts' }
    },
    required_schema_types: ['WebPage', 'Organization']
  },
  
  landing: {
    name: 'Landing Page',
    required_sections: [
      { key: 'overview', heading: 'Overview', anchor: 'overview' },
      { key: 'value_prop', heading: 'Why Choose Us', anchor: 'value-prop' },
      { key: 'process', heading: 'How It Works', anchor: 'process' },
      { key: 'pricing', heading: 'Pricing', anchor: 'pricing' }
    ],
    required_anchors: ['overview', 'value-prop', 'process', 'pricing'],
    required_fact_categories: {
      value_proposition: { min: 2, label: 'Value proposition facts' },
      pricing: { min: 1, label: 'Pricing facts' }
    },
    required_schema_types: ['WebPage', 'Service']
  },
  
  product: {
    name: 'Product Page',
    required_sections: [
      { key: 'overview', heading: 'Product Overview', anchor: 'overview' },
      { key: 'features', heading: 'Key Features', anchor: 'features' },
      { key: 'specs', heading: 'Specifications', anchor: 'specs' },
      { key: 'pricing', heading: 'Pricing', anchor: 'pricing' },
      { key: 'eligibility', heading: 'Eligibility', anchor: 'eligibility' }
    ],
    required_anchors: ['overview', 'features', 'specs', 'pricing', 'eligibility'],
    required_fact_categories: {
      definition: { min: 1, label: 'Definition facts' },
      feature: { min: 3, label: 'Feature facts' },
      specification: { min: 2, label: 'Specification facts' },
      pricing: { min: 1, label: 'Pricing facts' },
      constraint: { min: 1, label: 'Constraint facts' }
    },
    required_schema_types: ['WebPage', 'Product']
  },
  
  product_marketing: {
    name: 'Product Marketing Page',
    required_sections: [
      { key: 'intro', heading: 'Introduction', anchor: 'intro' },
      { key: 'benefits', heading: 'Benefits', anchor: 'benefits' },
      { key: 'use_cases', heading: 'Use Cases', anchor: 'use-cases' },
      { key: 'comparison', heading: 'Comparison', anchor: 'comparison' }
    ],
    required_anchors: ['intro', 'benefits', 'use-cases', 'comparison'],
    required_fact_categories: {
      benefit: { min: 3, label: 'Benefit facts' },
      use_case: { min: 2, label: 'Use case facts' }
    },
    required_schema_types: ['WebPage', 'Product']
  },
  
  faq: {
    name: 'FAQ Page',
    required_sections: [
      { key: 'intro', heading: 'Frequently Asked Questions', anchor: 'intro' },
      { key: 'faq_list', heading: 'Questions & Answers', anchor: 'faq' }
    ],
    required_anchors: ['intro', 'faq'],
    required_fact_categories: {
      faq_answer: { min: 5, label: 'FAQ answers' }
    },
    required_schema_types: ['WebPage', 'FAQPage']
  },
  
  blog: {
    name: 'Blog Post',
    required_sections: [
      { key: 'intro', heading: 'Introduction', anchor: 'intro' },
      { key: 'body', heading: 'Main Content', anchor: 'content' },
      { key: 'conclusion', heading: 'Conclusion', anchor: 'conclusion' }
    ],
    required_anchors: ['intro', 'content', 'conclusion'],
    required_fact_categories: {
      claim: { min: 3, label: 'Claims' }
    },
    required_schema_types: ['WebPage', 'Article']
  }
};

function getTemplate(pageType) {
  return PAGE_TEMPLATES[pageType] || null;
}

function getAllTemplates() {
  return Object.keys(PAGE_TEMPLATES).map(key => ({
    key,
    ...PAGE_TEMPLATES[key]
  }));
}

module.exports = {
  PAGE_TEMPLATES,
  getTemplate,
  getAllTemplates
};
