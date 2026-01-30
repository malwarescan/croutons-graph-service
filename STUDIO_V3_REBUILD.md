# Studio V3 Rebuild - CMS-First Copy/Paste Workflow

**Status**: BUILDING NOW

---

## Problem Statement

Current Studio requires writers to "copy HTML code" - this is wrong. Writers should:
1. Draft in Studio
2. Click "COPY FOR CMS"
3. Paste into any CMS
4. Publish

LLM-ready layers (JSON-LD, alternate links) should be injected by a universal connector script.

---

## Core Requirements

### 1. Multi-Format Clipboard Export
```javascript
navigator.clipboard.write([
  new ClipboardItem({
    'text/html': htmlBlob,      // Rich text paste
    'text/plain': plainBlob,    // Fallback
    'text/rtf': rtfBlob         // Optional for some editors
  })
])
```

### 2. CMS-Safe HTML Tags ONLY
- `<h1>`, `<h2>`, `<h3>`, `<p>`, `<ul>`, `<ol>`, `<li>`
- `<strong>`, `<em>`, `<blockquote>`
- `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`
- NO classes, NO inline styles, NO fragile dependencies

### 3. Required Content Blocks
- **Answer Box**: H2 "Summary" + paragraph near top
- **Query-Ready Headers**: Specific, not generic
- **Crouton Summaries**: 1-sentence anchors in long sections (>500 words)
- **FAQ**: H3 questions + P answers

### 4. Hidden Payload (Survives Paste)
```html
<div hidden data-croutons-payload='{"hash":"...","score":85,"artifacts":{...}}'>
</div>
```

### 5. Real-Time Croutonizer Guardrails

#### Guardrail 1: Sectional Anchoring
- Detect sections >500 words
- Flag if missing "Crouton Summary" sentence
- Suggest: "In short: [one-line takeaway]"

#### Guardrail 2: Entity Persistence
- Track entity mentions
- Flag pronouns when entity not mentioned in last ~150 tokens
- Suggest explicit replacement

#### Guardrail 3: Claim-Evidence Mapping
- Match Key Facts to H2 sections
- Flag if claim/evidence too far apart
- Suggest bridging sentence

#### Guardrail 4: Query-Ready Headers
- Flag generic headers: "Introduction", "Overview", "Conclusion"
- Suggest query-specific alternatives
- Example: "Overview" → "How Entity Verification Reduces Hallucinations"

#### Guardrail 5: X-Ray Fact Stream
- Show atomic facts extracted from each paragraph
- Warn if 2+ paragraphs = 0 facts ("low density")
- Display fact density score

### 6. Universal Connector Script

**One-time install** (teams add to site `<head>`):

```javascript
// croutons-connector.js
(function() {
  // Find payload in article body
  const payload = document.querySelector('[data-croutons-payload]');
  if (!payload) return;
  
  const data = JSON.parse(payload.textContent);
  
  // Inject JSON-LD
  const jsonld = document.createElement('script');
  jsonld.type = 'application/ld+json';
  jsonld.textContent = JSON.stringify(data.jsonld);
  document.head.appendChild(jsonld);
  
  // Inject alternate link
  const link = document.createElement('link');
  link.rel = 'alternate';
  link.type = 'text/markdown';
  link.href = data.artifacts.markdown_url;
  document.head.appendChild(link);
  
  // Inject meta tags
  const meta = document.createElement('meta');
  meta.name = 'croutons-hash';
  meta.content = data.hash;
  document.head.appendChild(meta);
})();
```

### 7. Table Handling

**Primary**: Real `<table>` tags
```html
<table>
  <thead>
    <tr><th>Feature</th><th>Benefit</th><th>Impact</th></tr>
  </thead>
  <tbody>
    <tr><td>Entity IDs</td><td>Disambiguation</td><td>40% reduction</td></tr>
  </tbody>
</table>
```

**Fallback**: TSV button for CMS that strip tables
```
Feature	Benefit	Impact
Entity IDs	Disambiguation	40% reduction
```

### 8. Live Compliance Checker

After publishing, writer pastes URL:
- Check if connector script injected head tags
- Verify artifact URLs resolve
- Show compliance report

---

## Implementation Plan

### Phase 1: Multi-Format Clipboard (IMMEDIATE)
- [ ] Replace "COPY AS HTML" with "COPY FOR CMS"
- [ ] Implement multi-format clipboard write
- [ ] Test in WordPress, Shopify, Webflow
- [ ] Add "COPY TABLES (TSV)" button

### Phase 2: Croutonizer Guardrails (CRITICAL)
- [ ] Build real-time sectional anchoring checker
- [ ] Implement entity persistence tracker
- [ ] Add claim-evidence mapper
- [ ] Build query-ready header suggester
- [ ] Create X-ray fact stream panel
- [ ] Show 0-100 Croutonizer Score

### Phase 3: Hidden Payload + Connector (CORE)
- [ ] Generate hidden payload JSON
- [ ] Embed in copied content
- [ ] Build universal connector script
- [ ] Add "COPY CONNECTOR SNIPPET" button
- [ ] Test payload survives CMS paste

### Phase 4: Live Checker (VERIFICATION)
- [ ] Build URL compliance checker
- [ ] Verify head tags present
- [ ] Check artifact URLs resolve
- [ ] Show pass/fail report

### Phase 5: Artifacts Auto-Generation (BACKEND)
- [ ] Host markdown mirrors
- [ ] Host NDJSON streams
- [ ] Generate JSON-LD on the fly
- [ ] Provide downloadable artifacts

---

## UX Flow (Final State)

### Writer's Experience:
1. **Draft in Studio** (real-time Croutonizer feedback)
2. **Click "COPY FOR CMS"** (multi-format clipboard)
3. **Paste into CMS** (rich text, looks perfect)
4. **Publish** (connector script handles LLM layers)
5. **Verify** (optional: paste URL for compliance check)

### Developer's Experience (One-Time):
1. **Get connector script** from Studio
2. **Add to site `<head>`** once
3. **Done** - all future articles automatically LLM-ready

---

## Technical Stack

### Frontend (Studio)
- Vue 3 (already in place)
- Clipboard API (multi-format write)
- Real-time validation (Croutonizer)

### Backend (Artifact Hosting)
- Markdown mirrors: `/v1/artifacts/:page_id/markdown`
- NDJSON streams: `/v1/artifacts/:page_id/ndjson`
- JSON-LD: `/v1/artifacts/:page_id/jsonld`

### Connector Script
- Vanilla JS (no dependencies)
- <1KB minified
- Works everywhere

---

## Success Criteria

✅ Writer never sees code  
✅ One-click copy → paste → publish  
✅ Works in all major CMS platforms  
✅ Tables paste as real tables  
✅ LLM layers injected automatically  
✅ Real-time writing feedback  
✅ Compliance verification available  

---

## Timeline

- **Phase 1** (Multi-Format Copy): 2 hours
- **Phase 2** (Croutonizer Guardrails): 6 hours
- **Phase 3** (Payload + Connector): 3 hours
- **Phase 4** (Live Checker): 2 hours
- **Phase 5** (Artifact Hosting): 3 hours

**Total**: ~16 hours of development

---

**Starting with Phase 1 NOW.**
