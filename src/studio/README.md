# Page Compliance Studio - Internal Tool

**Purpose**: Guided UI for creating compliant pages with auto-generated artifacts

**Access**: Internal only - requires `STUDIO_API_KEY` environment variable

---

## Quick Start

### 1. Set API Key (Railway)

```bash
railway variables --set "STUDIO_API_KEY=your-secret-key-here" --service graph-service
railway redeploy --service graph-service --yes
```

### 2. Access Studio

```
https://graph.croutons.ai/studio
```

Enter your API key when prompted.

---

## Features

### Wizard
- Choose from 6 page type templates
- Auto-generates required sections
- Sets up compliance requirements

### Builder
- Edit narrative for each section
- Add atomic facts (subject-predicate-object triples)
- Live validation warnings

### Preview
- View generated artifacts:
  - Markdown mirror (with v1.1 frontmatter)
  - NDJSON facts stream
  - JSON-LD schema
  - HTML head snippet
- Copy or download each artifact

### Compliance
- A-J protocol checklist
- Pass/fail per requirement
- Specific fix actions

---

## Page Types

| Type | Use Case | Required Sections |
|------|----------|-------------------|
| home | Homepage | Intro, Definition, Capabilities, Process, Policies |
| landing | Marketing landing | Overview, Value Prop, Process, Pricing |
| product | Product detail | Overview, Features, Specs, Pricing, Eligibility |
| product_marketing | Product marketing | Intro, Benefits, Use Cases, Comparison |
| faq | FAQ page | Intro, Q&A |
| blog | Blog post | Intro, Body, Conclusion |

---

## API Endpoints

All endpoints require `x-studio-key` header.

```
GET    /studio/templates              # List templates
GET    /studio/pages                  # List pages
POST   /studio/pages                  # Create page
GET    /studio/pages/:id              # Get page details
PUT    /studio/pages/:id/sections     # Update sections
PUT    /studio/pages/:id/facts        # Update facts
POST   /studio/pages/:id/generate     # Generate artifacts
GET    /studio/pages/:id/compliance   # Get compliance report
GET    /studio/pages/:id/artifacts/:type  # Download artifact
DELETE /studio/pages/:id              # Delete page
```

---

## Deterministic Hashing

### fact_id Format
```
{domain}:{path}#{subject-slug}-{predicate-slug}-{object-hash}
```

Example:
```
nrlc.ai:pricing#nrlc-ai-provides-flood-barrier-3f2a8c9b1e
```

### content_hash
SHA-256 of canonical JSON representation:
- Page metadata (domain, path, title, page_type, source_url)
- Sections (ordered by order_index)
- Facts (ordered by fact_id)

Excludes timestamps → identical content = identical hash

---

## Compliance Checks (A-J)

**Implemented in MVP**:
- ✅ A: Entity-bound (title and source_url present)
- ✅ B: Markdown mirror generated
- ✅ C: Alternate link in head snippet
- ✅ D: Frontmatter fields complete
- ✅ E: Atomic facts quality (minimum counts, no pronouns)
- ✅ F: Evidence grounding rate
- ✅ G: NDJSON validity

**Not Verified in MVP** (marked as null):
- ⏳ H: Caching headers (requires live HTTP check)
- ⏳ I: Verification gating (requires domain verification integration)
- ⏳ J: Discovery wiring (requires sitemap/discovery integration)

---

## Workflow

1. **Create**: Use wizard to create page from template
2. **Author**: Fill in narrative and atomic facts for each section
3. **Validate**: Check compliance scoreboard for issues
4. **Fix**: Address any failing checks
5. **Generate**: Create artifacts (markdown/NDJSON/JSON-LD/head)
6. **Export**: Download artifacts for deployment
7. **Deploy**: Implement alternate link + schema on live site
8. **Verify**: Use existing dashboard to verify protocol compliance

---

## Database Tables

- `studio_pages` - Page metadata
- `studio_sections` - Section content
- `studio_facts` - Atomic facts
- `studio_artifacts` - Generated outputs
- `studio_templates` - Page type configs

All use CASCADE DELETE → deleting a page removes all related data.

---

## Example Workflow

```bash
# 1. Create home page
POST /studio/pages
{
  "domain": "example.com",
  "path": "/",
  "page_type": "home",
  "title": "Example Company",
  "source_url": "https://example.com/"
}

# 2. Update sections
PUT /studio/pages/{id}/sections
{
  "sections": [
    {
      "id": "...",
      "narrative_md": "Example Company provides..."
    }
  ]
}

# 3. Add facts
PUT /studio/pages/{id}/facts
{
  "facts": [
    {
      "section_id": "...",
      "subject": "Example Company",
      "predicate": "provides",
      "object": "enterprise software solutions"
    }
  ]
}

# 4. Generate artifacts
POST /studio/pages/{id}/generate

# 5. Get compliance
GET /studio/pages/{id}/compliance

# 6. Download markdown
GET /studio/pages/{id}/artifacts/markdown
```

---

## Security

- All Studio endpoints require API key authentication
- API key stored in `STUDIO_API_KEY` environment variable
- Frontend stores key in localStorage (clear browser data to logout)
- No public access - internal tool only

---

## Next Steps (Post-MVP)

1. Evidence picker UI (select text snippets from canonical extraction)
2. Live HTTP header verification (H requirement)
3. CI/CD linter integration
4. Domain verification integration (I requirement)
5. Scheduled compliance monitoring (J requirement)
