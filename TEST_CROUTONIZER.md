# CROUTONIZER TEST GUIDE

## Test Article: 301 Redirects for SEO

### Title
```
How 301 Redirects Pass Link Equity During Site Migrations
```

### Answer Box (40-60 words)
```
A 301 redirect is a server-side permanent redirect that signals search engines a page has moved permanently. It passes approximately 90-99% of link equity to the new URL and maintains rankings during domain changes or URL restructuring.
```

### Key Facts (Subject | Predicate | Object)
```
301 redirect | signals | permanent URL change to search engines
301 redirect | passes | 90-99% of link equity to new URL
302 redirect | indicates | temporary URL change
Redirect chains | reduce | link equity transfer efficiency
Google Search Console | tracks | redirect implementation errors
```

### Section 1: What is a 301 Redirect
```
A 301 redirect is a server-side redirect that tells browsers and search engines that a page has moved permanently. This HTTP status code is crucial for SEO during site migrations.

When a user or search engine bot requests the old URL, the server responds with a 301 status code and the new URL location. The browser then automatically loads the new URL without user interaction.

The 301 redirect differs from a 302 redirect which signals a temporary move. Search engines treat these differently - 301 redirects transfer link equity while 302 redirects do not.

Crouton Summary: A 301 redirect uses HTTP status codes to signal permanent URL changes while maintaining link equity transfer.
```

### Section 2: How Link Equity Transfer Works
```
Link equity, also called "link juice," refers to the SEO value passed from one page to another through hyperlinks. When a 301 redirect is implemented, search engines pass most of this value to the new URL.

Google's John Mueller confirmed that 301 redirects pass approximately 90-99% of link equity to the target URL. The small loss accounts for the redirect hop itself.

Redirect chains occur when URL A redirects to URL B which redirects to URL C. Each hop in the chain reduces link equity transfer. Google recommends avoiding chains longer than 3-5 redirects.

Crouton Summary: 301 redirects preserve 90-99% of link equity during URL changes, but redirect chains reduce transfer efficiency.
```

### Section 3: Implementation Best Practices
```
Implementing 301 redirects requires server-side configuration. The most common methods include .htaccess files for Apache servers, nginx configuration files, or server-side code in PHP, Python, or Node.js.

For .htaccess implementation, use the RewriteEngine and RewriteRule directives. For nginx, use the return 301 directive in the server block. For WordPress sites, plugins like Redirection provide user-friendly interfaces.

Google Search Console provides redirect tracking tools. The URL Inspection tool shows redirect chains and implementation errors. The Coverage report identifies pages returning 301 status codes.

Testing is critical - verify redirects work for both www and non-www versions, HTTP and HTTPS protocols, and trailing slash variations. Use online redirect checkers or browser developer tools to confirm proper 301 status codes.

Crouton Summary: 301 redirect implementation requires server-side configuration and thorough testing across URL variations to maintain SEO value.
```

---

## EXPECTED CROUTONIZER RESULTS

### Phase 1 (Rules A & B) - Should Pass

**Rule A - Section Anchoring**: ✅ PASS
- Section 1: 140 words → No summary needed
- Section 2: 145 words → No summary needed  
- Section 3: 160 words → No summary needed
- All sections have Crouton Summaries ✅

**Rule B - Entity Persistence**: ✅ PASS
- No paragraph-start pronouns ✅
- Explicit entities throughout ✅
- Expected Score: 20/20

**Expected Phase 1 Score: 40/40**

---

### Phase 2 (Rule C) - Should Pass

**Rule C - Claim-Evidence Mapping**: ✅ PASS
- 5 Key Facts defined ✅
- Fact 1 ("301 redirect signals permanent") → mapped to Section 1 ✅
- Fact 2 ("passes 90-99%") → mapped to Section 2 ✅
- Fact 3 ("302 redirect temporary") → mapped to Section 1 ✅
- Fact 4 ("chains reduce equity") → mapped to Section 2 ✅
- Fact 5 ("Search Console tracks") → mapped to Section 3 ✅
- No multi-hop risks (all <900 tokens) ✅
- Bridging references present ✅

**Expected Phase 2 Score: 20/20**

---

### FLAWED VERSION (For Testing Error Detection)

#### Flawed Section 1 (Rule B violation)
```
A 301 redirect is a server-side redirect. It tells browsers and search engines that a page has moved permanently. This HTTP status code is crucial for SEO during site migrations.

When a user or bot requests the old URL, the server responds with a 301 status code. It includes the new URL location. The browser then automatically loads it without user interaction.

This differs from a 302 redirect which signals a temporary move. They are treated differently by search engines - one type transfers link equity while the other does not.
```

**Expected Issues**:
- ❌ ERROR: Paragraph 2 starts with "It tells" (pronoun start, no entity)
- ❌ ERROR: Paragraph 3 starts with "It includes" (pronoun start)
- ❌ ERROR: Paragraph 4 starts with "This differs" (pronoun start)
- ❌ ERROR: Paragraph 4 ends with "They are treated" (pronoun, vague)

#### Flawed Key Facts (Rule C violation)
```
301 redirect | is important for | SEO
Redirects | help | search engines
```

**Expected Issues**:
- ❌ ERROR: Only 2 Key Facts (should have 3+)
- ❌ ERROR: Fact 1 has vague predicate "is important for"
- ❌ ERROR: Fact 2 has vague object "help search engines"

---

## MANUAL TEST STEPS

### 1. Wait for Railway Deploy
```bash
# Check deployment status (wait ~2-3 minutes after commit)
curl -s https://graph.croutons.ai/studio | grep -q "Studio" && echo "✅ Deployed" || echo "❌ Not ready"
```

### 2. Test Perfect Article
```bash
# Save test data to file
cat > test-perfect.json << 'EOF'
{
  "title": "How 301 Redirects Pass Link Equity During Site Migrations",
  "answerBox": "A 301 redirect is a server-side permanent redirect...",
  "sections": [
    {
      "heading": "What is a 301 Redirect",
      "content": "A 301 redirect is a server-side redirect... Crouton Summary: A 301 redirect uses HTTP status codes..."
    },
    {
      "heading": "How Link Equity Transfer Works",
      "content": "Link equity, also called link juice... Crouton Summary: 301 redirects preserve 90-99%..."
    },
    {
      "heading": "Implementation Best Practices",
      "content": "Implementing 301 redirects... Crouton Summary: 301 redirect implementation requires..."
    }
  ],
  "keyFacts": "301 redirect | signals | permanent URL change\n301 redirect | passes | 90-99% of link equity\n302 redirect | indicates | temporary URL change\nRedirect chains | reduce | link equity transfer\nGoogle Search Console | tracks | redirect errors"
}
EOF

# Test (replace YOUR_API_KEY)
curl -X POST https://graph.croutons.ai/studio/pages/test-123/croutonize \
  -H "Content-Type: application/json" \
  -H "x-studio-key: YOUR_API_KEY" \
  -d @test-perfect.json

# Expected: Score 60-80% (Rules A, B, C working, D-F placeholders)
```

### 3. Test Flawed Article
```bash
# Test with pronoun errors
curl -X POST https://graph.croutons.ai/studio/pages/test-456/croutonize \
  -H "Content-Type: application/json" \
  -H "x-studio-key: YOUR_API_KEY" \
  -d '{
    "title": "301 Redirects",
    "answerBox": "It is important for SEO",
    "sections": [{
      "heading": "Overview",
      "content": "It helps websites. This is useful. They improve rankings."
    }],
    "keyFacts": ""
  }'

# Expected: Score 20-40% with many errors
```

---

## WHAT TO LOOK FOR

### ✅ Success Indicators

**Perfect Article**:
- Score: 60-80%
- Status: "clean" or "warnings"
- Blocking issues: 0
- Rule A score: 20/20
- Rule B score: 20/20
- Rule C score: 15-20/20 (depends on evidence spans)
- Issues: 0-5 warnings max

**Flawed Article**:
- Score: 20-40%
- Status: "errors"
- Blocking issues: 3-8
- Multiple pronoun errors flagged
- Missing Key Facts error
- Fix suggestions provided

### ❌ Failure Indicators

- Server error (500)
- Score calculation wrong
- Rules not detecting issues
- No fix suggestions
- Determinism failure (same input → different score)

---

## QUICK SMOKE TEST (In Studio UI)

### Step 1: Create Page
1. Go to https://graph.croutons.ai/studio
2. Enter API key: `[YOUR_STUDIO_API_KEY]`
3. Click "New Page"
4. Paste perfect article content

### Step 2: Run Croutonizer
1. Click "💾 Save Content"
2. Click "🔍 Run Semantic Compiler"
3. Wait 2-3 seconds

### Step 3: Verify Results
- Score displays: 60-80%
- Status: "CLEAN" or "WARNINGS"
- Issues panel shows 0-5 items
- Each issue has:
  - Clear message
  - Explanation
  - Fix suggestion
  - Score impact

### Step 4: Test Fix Workflow
1. Introduce pronoun error: Change "A 301 redirect" to "It"
2. Save & re-run
3. Verify:
  - Score drops by ~4 points
  - Error appears with exact location
  - Fix suggests entity replacement

---

## REGRESSION TESTS

### Test 1: Determinism
- Run same article 3 times → same score every time

### Test 2: Score Math
- Perfect article (no issues) → 60-80% (Rules A+B+C = 60, D-F placeholders)
- Remove 1 Crouton Summary → -5 points
- Add 1 pronoun-start paragraph → -4 points
- Remove all Key Facts → -20 points

### Test 3: Edge Cases
- Empty content → should not crash
- Single section → should work
- Very long section (2000 words) → should require summary
- 20+ Key Facts → should handle gracefully

---

## NEXT: PHASE 3

Once Phase 2 verified, proceed to:
- Rule D: Header Specificity (15 points)
- Rule E: Fact Density (15 points)

Target: 90-100% scores for perfect articles.
