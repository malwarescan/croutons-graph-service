-- Migration: Add Page Compliance Studio tables
-- Created: 2026-01-29
-- Purpose: Internal tool for guided page authoring with A-J compliance

-- studio_pages: Core page drafts
CREATE TABLE IF NOT EXISTS studio_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255),
  path VARCHAR(500) NOT NULL,
  page_type VARCHAR(50) NOT NULL, -- home, landing, product, product_marketing, faq, blog
  title TEXT NOT NULL,
  source_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'draft', -- draft, ready, published
  content_hash VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(domain, path)
);

-- studio_sections: Page content sections
CREATE TABLE IF NOT EXISTS studio_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES studio_pages(id) ON DELETE CASCADE,
  section_key VARCHAR(100) NOT NULL,
  order_index INTEGER NOT NULL,
  narrative_md TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- studio_facts: Atomic facts per section
CREATE TABLE IF NOT EXISTS studio_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES studio_pages(id) ON DELETE CASCADE,
  section_id UUID REFERENCES studio_sections(id) ON DELETE SET NULL,
  fact_id VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  object_type VARCHAR(50),
  evidence_text TEXT,
  source_url VARCHAR(500),
  fragment_hash VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(page_id, fact_id)
);

-- studio_artifacts: Generated outputs
CREATE TABLE IF NOT EXISTS studio_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES studio_pages(id) ON DELETE CASCADE,
  artifact_type VARCHAR(50) NOT NULL, -- markdown, ndjson, jsonld, head
  content TEXT NOT NULL,
  content_hash VARCHAR(64),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(page_id, artifact_type)
);

-- studio_templates: Page type configurations
CREATE TABLE IF NOT EXISTS studio_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type VARCHAR(50) UNIQUE NOT NULL,
  config_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_studio_pages_domain ON studio_pages(domain);
CREATE INDEX IF NOT EXISTS idx_studio_pages_status ON studio_pages(status);
CREATE INDEX IF NOT EXISTS idx_studio_sections_page_id ON studio_sections(page_id);
CREATE INDEX IF NOT EXISTS idx_studio_sections_order ON studio_sections(page_id, order_index);
CREATE INDEX IF NOT EXISTS idx_studio_facts_page_id ON studio_facts(page_id);
CREATE INDEX IF NOT EXISTS idx_studio_facts_section_id ON studio_facts(section_id);
CREATE INDEX IF NOT EXISTS idx_studio_artifacts_page_id ON studio_artifacts(page_id);

-- Update trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_studio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_studio_pages_updated_at
  BEFORE UPDATE ON studio_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_studio_updated_at();

CREATE TRIGGER trigger_studio_sections_updated_at
  BEFORE UPDATE ON studio_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_studio_updated_at();

CREATE TRIGGER trigger_studio_facts_updated_at
  BEFORE UPDATE ON studio_facts
  FOR EACH ROW
  EXECUTE FUNCTION update_studio_updated_at();

-- Insert default templates (will be detailed in code)
INSERT INTO studio_templates (page_type, config_json) VALUES
('home', '{
  "name": "Home Page",
  "required_sections": [
    {"key": "intro", "heading": "What We Do", "anchor": "intro"},
    {"key": "definition", "heading": "What [Company] Is", "anchor": "definition"},
    {"key": "capabilities", "heading": "What We Offer", "anchor": "capabilities"},
    {"key": "process", "heading": "How It Works", "anchor": "process"},
    {"key": "policies", "heading": "Key Policies", "anchor": "policies"}
  ],
  "required_anchors": ["intro", "definition", "capabilities", "process", "policies"],
  "required_fact_categories": {"definition": 2, "capability": 3, "policy": 2},
  "required_schema_types": ["WebPage", "Organization"]
}'::jsonb),
('landing', '{
  "name": "Landing Page",
  "required_sections": [
    {"key": "overview", "heading": "Overview", "anchor": "overview"},
    {"key": "value_prop", "heading": "Why Choose Us", "anchor": "value-prop"},
    {"key": "process", "heading": "How It Works", "anchor": "process"},
    {"key": "pricing", "heading": "Pricing", "anchor": "pricing"}
  ],
  "required_anchors": ["overview", "value-prop", "process", "pricing"],
  "required_fact_categories": {"value_proposition": 2, "pricing": 1},
  "required_schema_types": ["WebPage", "Service"]
}'::jsonb),
('product', '{
  "name": "Product Page",
  "required_sections": [
    {"key": "overview", "heading": "Product Overview", "anchor": "overview"},
    {"key": "features", "heading": "Key Features", "anchor": "features"},
    {"key": "specs", "heading": "Specifications", "anchor": "specs"},
    {"key": "pricing", "heading": "Pricing", "anchor": "pricing"},
    {"key": "eligibility", "heading": "Eligibility", "anchor": "eligibility"}
  ],
  "required_anchors": ["overview", "features", "specs", "pricing", "eligibility"],
  "required_fact_categories": {"definition": 1, "feature": 3, "specification": 2, "pricing": 1, "constraint": 1},
  "required_schema_types": ["WebPage", "Product"]
}'::jsonb),
('product_marketing', '{
  "name": "Product Marketing Page",
  "required_sections": [
    {"key": "intro", "heading": "Introduction", "anchor": "intro"},
    {"key": "benefits", "heading": "Benefits", "anchor": "benefits"},
    {"key": "use_cases", "heading": "Use Cases", "anchor": "use-cases"},
    {"key": "comparison", "heading": "Comparison", "anchor": "comparison"}
  ],
  "required_anchors": ["intro", "benefits", "use-cases", "comparison"],
  "required_fact_categories": {"benefit": 3, "use_case": 2},
  "required_schema_types": ["WebPage", "Product"]
}'::jsonb),
('faq', '{
  "name": "FAQ Page",
  "required_sections": [
    {"key": "intro", "heading": "Frequently Asked Questions", "anchor": "intro"},
    {"key": "faq_list", "heading": "Questions & Answers", "anchor": "faq"}
  ],
  "required_anchors": ["intro", "faq"],
  "required_fact_categories": {"faq_answer": 5},
  "required_schema_types": ["WebPage", "FAQPage"]
}'::jsonb),
('blog', '{
  "name": "Blog Post",
  "required_sections": [
    {"key": "intro", "heading": "Introduction", "anchor": "intro"},
    {"key": "body", "heading": "Main Content", "anchor": "content"},
    {"key": "conclusion", "heading": "Conclusion", "anchor": "conclusion"}
  ],
  "required_anchors": ["intro", "content", "conclusion"],
  "required_fact_categories": {"claim": 3},
  "required_schema_types": ["WebPage", "Article"]
}'::jsonb)
ON CONFLICT (page_type) DO NOTHING;
