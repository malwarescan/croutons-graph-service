# CROUTONIZER SEMANTIC COMPILER - IMPLEMENTATION PLAN

**Goal**: Transform Studio Simple Mode into a deterministic semantic compiler that enforces mechanical extractability

**Status**: READY TO BUILD  
**Timeline**: Phase 1 (Core) = 2-3 days, Full MVP = 5-7 days

---

## ARCHITECTURE

### Core Components

```
croutonizer/
├── engine/
│   ├── parser.js           # Document → AST (sections, paragraphs, tokens)
│   ├── linter.js           # Run all 5 guardrail rules
│   ├── scorer.js           # Calculate 0-100 score with breakdown
│   └── fixer.js            # Auto-fix suggestions
├── rules/
│   ├── sectionAnchoring.js    # Rule A: U-curve guardrail
│   ├── entityPersistence.js   # Rule B: Pronoun detection
│   ├── claimEvidence.js       # Rule C: Fact mapping
│   ├── headerOptimizer.js     # Rule D: Query-ready headers
│   └── factDensity.js         # Rule E: Dead zone detection
├── extractors/
│   ├── factExtractor.js    # S-P-O extraction with evidence
│   ├── entityExtractor.js  # Primary entities + aliases
│   └── queryGenerator.js   # Query shadowing
└── ui/
    ├── compilerPanel.js    # Sidebar: score + issues
    ├── xrayPanel.js        # Live fact stream
    └── chunkSimulator.js   # 256-token chunk view
```

### Data Model

```javascript
// Document AST
{
  sections: [
    {
      id: 'uuid',
      level: 2,
      title: 'Header text',
      text: 'Full section content',
      paragraphs: [
        {
          text: 'Paragraph content',
          tokens: 150,
          start_char: 0,
          end_char: 500
        }
      ],
      word_count: 450,
      token_count: 600,
      has_summary: false
    }
  ],
  entities: {
    primary: ['Google Search', 'HTTP status codes', '301 redirect'],
    aliases: {
      'Google Search': ['Google', 'the search engine'],
      '301 redirect': ['permanent redirect', '301']
    }
  },
  facts: [
    {
      id: 'uuid',
      subject: '301 redirect',
      predicate: 'signals',
      object: 'permanent URL change to search engines',
      section_id: 'uuid',
      evidence_text: 'A 301 redirect signals...',
      start_char: 120,
      end_char: 180,
      grounded: true
    }
  ]
}

// Lint Issue
{
  id: 'uuid',
  rule: 'sectionAnchoring',
  type: 'error' | 'warning',
  severity: 'blocking' | 'non-blocking',
  location: {
    section_id: 'uuid',
    paragraph_index: 2,
    char_range: [100, 150]
  },
  message: 'Long section missing Crouton Summary',
  fix: {
    type: 'insert' | 'replace' | 'suggest',
    suggestion: 'Crouton Summary: This section explains...',
    action: 'insertAtEnd' | 'replaceText'
  },
  score_impact: -5
}

// Croutonizer Score
{
  total: 72,
  breakdown: {
    sectionAnchoring: { score: 15, max: 20, issues: 1 },
    entityPersistence: { score: 18, max: 20, issues: 2 },
    claimEvidence: { score: 12, max: 20, issues: 3 },
    headerSpecificity: { score: 10, max: 15, issues: 1 },
    factDensity: { score: 12, max: 15, issues: 2 },
    factQuality: { score: 5, max: 10, issues: 5 }
  },
  status: 'warnings', // 'clean' | 'warnings' | 'errors'
  blocking_issues: 0,
  top_fixes: [
    { issue_id: 'uuid', impact: 5, fix: 'Add Crouton Summary to Section 3' },
    { issue_id: 'uuid', impact: 4, fix: 'Replace pronoun in paragraph 5' }
  ]
}
```

---

## IMPLEMENTATION PHASES

### PHASE 1: Core Engine (Day 1-2)

**Priority**: Get deterministic linting working

#### 1.1 Document Parser
```javascript
// graph-service/src/croutonizer/engine/parser.js
function parseDocument(content) {
  // Split into sections by H2/H3
  // Extract paragraphs
  // Count tokens (simple: split by spaces * 1.3)
  // Return AST
}
```

**Tests**:
- Parse markdown with 3 sections → correct AST
- Token counts within 10% of actual
- Paragraph boundaries correct

#### 1.2 Rule A: Section Anchoring
```javascript
// graph-service/src/croutonizer/rules/sectionAnchoring.js
function checkSectionAnchoring(section) {
  if (section.token_count > 700 || section.word_count > 500) {
    const lastPara = section.paragraphs[section.paragraphs.length - 1];
    const hasSummary = lastPara.text.startsWith('Crouton Summary:') ||
                       (lastPara.text.split(' ').length < 35 && 
                        containsEntity(lastPara.text));
    
    if (!hasSummary) {
      return {
        type: 'error',
        message: `Section "${section.title}" is ${section.word_count} words but missing Crouton Summary`,
        fix: generateSummary(section)
      };
    }
  }
  return null;
}
```

#### 1.3 Rule B: Entity Persistence
```javascript
// graph-service/src/croutonizer/rules/entityPersistence.js
const PRONOUNS = /^(it|this|that|these|those|they|their|its|them|such|here|there)\b/i;

function checkEntityPersistence(paragraph, previousTokens, entities) {
  const firstWords = paragraph.text.substring(0, 50);
  
  if (PRONOUNS.test(firstWords)) {
    // Check if entity mentioned in last 150 tokens
    const hasEntity = entities.primary.some(e => 
      previousTokens.includes(e.toLowerCase())
    );
    
    if (!hasEntity) {
      return {
        type: 'error',
        message: 'Paragraph starts with pronoun but no recent entity mention',
        fix: suggestEntityReplacement(paragraph, entities)
      };
    }
  }
  return null;
}
```

#### 1.4 Scoring Engine
```javascript
// graph-service/src/croutonizer/engine/scorer.js
function calculateScore(document, issues) {
  const scores = {
    sectionAnchoring: calculateSectionScore(document, issues),
    entityPersistence: calculateEntityScore(document, issues),
    claimEvidence: calculateClaimScore(document, issues),
    headerSpecificity: calculateHeaderScore(document, issues),
    factDensity: calculateDensityScore(document, issues),
    factQuality: calculateQualityScore(document, issues)
  };
  
  const total = Object.values(scores).reduce((sum, s) => sum + s.score, 0);
  
  return {
    total,
    breakdown: scores,
    status: determineStatus(issues),
    top_fixes: rankFixesByImpact(issues)
  };
}
```

**Deliverable**: Working linter for Rules A & B + scoring

---

### PHASE 2: Fact System (Day 3)

#### 2.1 Enhanced Fact Extractor
```javascript
// graph-service/src/croutonizer/extractors/factExtractor.js
async function extractGroundedFacts(section) {
  const sentences = segmentSentences(section.text);
  const facts = [];
  
  for (const sentence of sentences) {
    // Only extract if sentence has explicit entities
    if (!hasExplicitEntity(sentence)) continue;
    
    // Try pattern matching first (fast)
    let fact = extractByPattern(sentence);
    
    // Fallback to LLM (constrained)
    if (!fact) {
      fact = await extractByLLM(sentence, {
        constraint: 'strict_grounding',
        max_tokens: 100
      });
    }
    
    // Validate grounding
    if (fact && validateGrounding(fact, section.text)) {
      facts.push({
        ...fact,
        section_id: section.id,
        evidence_text: findEvidenceSpan(fact, section.text),
        grounded: true
      });
    }
  }
  
  return facts;
}
```

#### 2.2 Entity Extractor
```javascript
// graph-service/src/croutonizer/extractors/entityExtractor.js
function extractEntities(document) {
  // Title entities
  const titleEntities = extractProperNouns(document.title);
  
  // First section entities
  const introEntities = extractProperNouns(document.sections[0].text);
  
  // Build alias map
  const aliases = buildAliasMap([...titleEntities, ...introEntities]);
  
  return {
    primary: [...titleEntities, ...introEntities],
    aliases
  };
}
```

#### 2.3 Rule C: Claim-Evidence Mapping
```javascript
// graph-service/src/croutonizer/rules/claimEvidence.js
function checkClaimEvidence(keyFacts, sections) {
  const issues = [];
  
  for (const fact of keyFacts) {
    // Check if fact is supported in any section
    const supportingSections = sections.filter(s => 
      s.text.toLowerCase().includes(fact.subject.toLowerCase()) &&
      s.text.toLowerCase().includes(fact.object.toLowerCase())
    );
    
    if (supportingSections.length === 0) {
      issues.push({
        type: 'error',
        message: `Key Fact "${fact.subject} ${fact.predicate} ${fact.object}" has no supporting section`,
        fix: 'Map this fact to a section or remove it'
      });
    } else {
      // Check distance
      const distance = calculateTokenDistance(fact, supportingSections[0]);
      if (distance > 900 && !hasBridgingReference(fact, supportingSections[0])) {
        issues.push({
          type: 'warning',
          message: 'Fact and evidence are far apart',
          fix: generateBridgingSentence(fact, supportingSections[0])
        });
      }
    }
  }
  
  return issues;
}
```

**Deliverable**: Grounded fact extraction + Claim-Evidence linting

---

### PHASE 3: Headers & Density (Day 4)

#### 3.1 Rule D: Header Optimizer
```javascript
// graph-service/src/croutonizer/rules/headerOptimizer.js
const GENERIC_HEADERS = [
  /^overview$/i, /^introduction$/i, /^conclusion$/i,
  /^summary$/i, /^the bottom line$/i, /^pricing$/i,
  /^benefits$/i, /^faq$/i
];

function checkHeaderSpecificity(section, document) {
  const header = section.title;
  
  // Check if generic
  if (GENERIC_HEADERS.some(pattern => pattern.test(header))) {
    return {
      type: 'warning',
      message: `Header "${header}" is too generic`,
      fix: suggestSpecificHeader(section, document.entities)
    };
  }
  
  // Score specificity
  const score = calculateHeaderScore(header, document.entities);
  if (score < 0.6) {
    return {
      type: 'warning',
      message: 'Header lacks specificity',
      fix: suggestSpecificHeader(section, document.entities)
    };
  }
  
  return null;
}

function suggestSpecificHeader(section, entities) {
  // Extract keywords from section
  const keywords = extractKeywords(section.text);
  
  // Find relevant entities
  const relevantEntities = entities.primary.filter(e =>
    section.text.includes(e)
  );
  
  // Generate suggestions
  return {
    suggestions: [
      `How ${relevantEntities[0]} ${keywords[0]}`,
      `${keywords[0]} for ${relevantEntities[0]}`,
      `${relevantEntities[0]} ${keywords[0]}: ${keywords[1]}`
    ]
  };
}
```

#### 3.2 Rule E: Fact Density
```javascript
// graph-service/src/croutonizer/rules/factDensity.js
function checkFactDensity(section, facts) {
  const sectionFacts = facts.filter(f => f.section_id === section.id);
  const density = (sectionFacts.length / section.word_count) * 100;
  
  const issues = [];
  
  // Check dead zones (2+ paragraphs with no facts)
  let deadZoneCount = 0;
  let consecutiveEmpty = 0;
  
  for (const para of section.paragraphs) {
    const paraFacts = sectionFacts.filter(f =>
      f.start_char >= para.start_char && f.end_char <= para.end_char
    );
    
    if (paraFacts.length === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 2) {
        deadZoneCount++;
        issues.push({
          type: 'warning',
          message: `Dead zone detected: ${consecutiveEmpty} paragraphs with no facts`,
          location: para,
          fix: 'Add explicit claims or remove fluff'
        });
      }
    } else {
      consecutiveEmpty = 0;
    }
  }
  
  // Check overall density
  if (density < 0.8) {
    issues.push({
      type: 'warning',
      message: `Low fact density: ${density.toFixed(1)} facts per 100 words (target: 0.8-2.0)`,
      fix: 'Add more specific, verifiable claims'
    });
  }
  
  return issues;
}
```

**Deliverable**: Header optimization + Density checking

---

### PHASE 4: UI Integration (Day 5)

#### 4.1 Compiler Panel Component
```vue
<!-- In studio.html -->
<div class="compiler-panel">
  <!-- Croutonizer Score -->
  <div class="score-display">
    <div class="score-number">{{ croutonizerScore.total }}</div>
    <div class="score-status">{{ croutonizerScore.status }}</div>
  </div>
  
  <!-- Breakdown -->
  <div class="score-breakdown">
    <div v-for="(cat, key) in croutonizerScore.breakdown" :key="key">
      <div class="category-name">{{ formatCategory(key) }}</div>
      <div class="category-score">{{ cat.score }}/{{ cat.max }}</div>
      <div class="progress-bar">
        <div :style="{width: (cat.score/cat.max*100) + '%'}"></div>
      </div>
      <div class="issue-count">{{ cat.issues }} issues</div>
    </div>
  </div>
  
  <!-- Issues List -->
  <div class="issues-list">
    <div v-for="issue in croutonizerIssues" :key="issue.id" 
         :class="['issue-card', issue.type]">
      <div class="issue-header">
        <span class="issue-icon">{{ issue.type === 'error' ? '❌' : '⚠️' }}</span>
        <span class="issue-title">{{ issue.message }}</span>
      </div>
      <div class="issue-location">
        Section: {{ getSectionTitle(issue.location.section_id) }}
      </div>
      <div class="issue-actions">
        <button @click="applyFix(issue)" 
                v-if="issue.fix"
                class="btn-fix">
          Apply Fix (+{{ issue.score_impact }} points)
        </button>
        <button @click="jumpToIssue(issue)" class="btn-jump">
          Jump to Location
        </button>
      </div>
    </div>
  </div>
</div>
```

#### 4.2 X-Ray Fact Stream
```vue
<div class="xray-panel">
  <h3>X-Ray Fact Stream</h3>
  <div class="fact-stats">
    <div>Total Facts: {{ extractedFacts.length }}</div>
    <div>Grounded: {{ groundedFactCount }}</div>
    <div>Density: {{ factDensity.toFixed(1) }}/100 words</div>
  </div>
  
  <div class="facts-by-section">
    <div v-for="section in sectionsWithFacts" :key="section.id">
      <h4>{{ section.title }}</h4>
      <div v-for="fact in section.facts" :key="fact.id" class="fact-card">
        <div class="fact-spo">
          <span class="subject">{{ fact.subject }}</span>
          <span class="predicate">{{ fact.predicate }}</span>
          <span class="object">{{ fact.object }}</span>
        </div>
        <div class="fact-evidence" v-if="fact.evidence_text">
          "{{ fact.evidence_text }}"
        </div>
        <div class="fact-grounded">
          {{ fact.grounded ? '✅ Grounded' : '⚠️ Ungrounded' }}
        </div>
      </div>
    </div>
  </div>
</div>
```

#### 4.3 Lint on Type (Debounced)
```javascript
let lintTimeout;

function onContentChange() {
  clearTimeout(lintTimeout);
  lintTimeout = setTimeout(async () => {
    // Parse document
    const ast = parseDocument(getCurrentContent());
    
    // Run linter
    const issues = await runLinter(ast);
    
    // Calculate score
    const score = calculateScore(ast, issues);
    
    // Update UI
    updateCompilerPanel(score, issues);
    updateXRayPanel(ast.facts);
  }, 800); // 800ms debounce
}
```

**Deliverable**: Full UI with live linting + scoring

---

### PHASE 5: Innovative Features (Day 6-7)

#### 5.1 Chunk Survival Simulator
```javascript
function simulateChunks(document) {
  const chunks = [];
  let currentChunk = '';
  let tokenCount = 0;
  
  for (const section of document.sections) {
    for (const para of section.paragraphs) {
      if (tokenCount + para.tokens > 256) {
        // Save current chunk
        chunks.push({
          text: currentChunk,
          tokens: tokenCount,
          header: section.title,
          health: evaluateChunkHealth(currentChunk, document.entities)
        });
        currentChunk = para.text;
        tokenCount = para.tokens;
      } else {
        currentChunk += '\n\n' + para.text;
        tokenCount += para.tokens;
      }
    }
  }
  
  return chunks;
}

function evaluateChunkHealth(chunkText, entities) {
  let health = 100;
  
  // Penalize if starts mid-sentence
  if (!startsWithCapital(chunkText)) health -= 20;
  
  // Penalize if has unresolved pronouns
  const pronouns = countPronouns(chunkText);
  const entityMentions = countEntityMentions(chunkText, entities);
  if (pronouns > entityMentions) health -= 15;
  
  // Reward if has facts
  const factDensity = estimateFactDensity(chunkText);
  health += factDensity * 10;
  
  return Math.max(0, Math.min(100, health));
}
```

#### 5.2 Query Shadowing
```javascript
async function generateShadowQueries(document) {
  // Extract likely queries from headers and key facts
  const queries = [];
  
  for (const section of document.sections) {
    // Convert header to question
    const question = headerToQuestion(section.title);
    queries.push({
      query: question,
      answerSection: section.id,
      confidence: 0.8
    });
  }
  
  // Generate queries from key facts
  for (const fact of document.facts) {
    const query = factToQuery(fact);
    const answerSection = findBestSection(query, document.sections);
    queries.push({
      query,
      answerSection,
      confidence: 0.6
    });
  }
  
  return queries.slice(0, 10);
}
```

#### 5.3 Evidence Anchor Mode
```javascript
async function attachEvidenceToFacts(facts, document) {
  for (const fact of facts) {
    if (fact.grounded) continue;
    
    // Find best evidence span
    const evidence = findEvidenceSpan(fact, document);
    
    if (evidence) {
      fact.evidence_text = evidence.text;
      fact.start_char = evidence.start;
      fact.end_char = evidence.end;
      fact.grounded = true;
    }
  }
  
  const groundedRate = facts.filter(f => f.grounded).length / facts.length;
  return { facts, groundedRate };
}
```

**Deliverable**: Chunk simulator + Query shadowing + Evidence mode

---

## API ENDPOINTS

```javascript
// New endpoints in graph-service/src/croutonizer/api.js

POST /studio/pages/:id/croutonize
// Run full lint + scoring
// Returns: { score, issues, facts, chunks, queries }

POST /studio/pages/:id/apply-fix/:issue_id
// Apply auto-fix for specific issue
// Returns: { updated_content, new_score }

POST /studio/pages/:id/extract-facts-grounded
// Extract facts with evidence spans
// Returns: { facts, grounded_rate }

GET /studio/pages/:id/chunk-simulation
// Get 256-token chunks with health scores
// Returns: { chunks }

GET /studio/pages/:id/shadow-queries
// Get likely user queries
// Returns: { queries }
```

---

## TESTING STRATEGY

### Unit Tests
```javascript
// test/croutonizer/rules/sectionAnchoring.test.js
describe('Section Anchoring Rule', () => {
  it('flags long section without summary', () => {
    const section = {
      title: 'How Redirects Work',
      word_count: 600,
      text: '...',
      paragraphs: [...]
    };
    const issue = checkSectionAnchoring(section);
    expect(issue.type).toBe('error');
  });
  
  it('passes section with valid summary', () => {
    const section = {
      title: 'How Redirects Work',
      word_count: 600,
      text: '... Crouton Summary: This section explains...',
      paragraphs: [...]
    };
    const issue = checkSectionAnchoring(section);
    expect(issue).toBeNull();
  });
});
```

### Integration Tests
```javascript
// test/croutonizer/integration/fullLint.test.js
describe('Full Lint Pipeline', () => {
  it('scores perfect article at 100', async () => {
    const article = loadFixture('perfect-article.md');
    const ast = parseDocument(article);
    const issues = await runLinter(ast);
    const score = calculateScore(ast, issues);
    expect(score.total).toBe(100);
  });
  
  it('identifies all issues in flawed article', async () => {
    const article = loadFixture('flawed-article.md');
    const ast = parseDocument(article);
    const issues = await runLinter(ast);
    expect(issues).toContainEqual(
      expect.objectContaining({ rule: 'sectionAnchoring' })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ rule: 'entityPersistence' })
    );
  });
});
```

---

## DEPLOYMENT CHECKLIST

- [ ] Phase 1 complete: Parser + Rules A&B + Scorer
- [ ] Phase 2 complete: Fact system + Rule C
- [ ] Phase 3 complete: Rules D&E
- [ ] Phase 4 complete: UI integration
- [ ] Phase 5 complete: Innovative features
- [ ] Unit tests passing (>90% coverage)
- [ ] Integration tests passing
- [ ] Performance: Lint completes in <2s for 2000-word article
- [ ] Railway deployment successful
- [ ] User documentation created

---

## SUCCESS METRICS

**Technical**:
- Lint accuracy: >95% (compared to manual review)
- False positive rate: <10%
- Performance: <2s for 2000 words
- Score determinism: Same input = same score every time

**User**:
- Writers can fix blocking errors in <5 min
- Average score improvement: 40+ points after fixes
- Grounded fact rate: >90%
- Time to publish: <30 min for 1500-word article

---

## NEXT STEPS

1. **Review this plan** - confirm approach
2. **Set up test fixtures** - perfect/flawed articles
3. **Implement Phase 1** - core engine
4. **Test and iterate** - get Rules A&B working perfectly
5. **Continue phases** - one at a time

**READY TO BUILD?** Say "START PHASE 1" and I'll begin implementation.
