#!/usr/bin/env node
/* jshint node: true, esversion: 11 */
// Local test script for Croutonizer

const { parseDocument } = require('./src/croutonizer/engine/parser');
const { runLinter } = require('./src/croutonizer/engine/linter');
const { calculateScore } = require('./src/croutonizer/engine/scorer');

console.log('\n🧪 CROUTONIZER LOCAL TEST\n');

// Test 1: Perfect Article
console.log('TEST 1: Perfect Article (should score high)\n');

const perfectContent = {
  title: 'How 301 Redirects Pass Link Equity',
  answerBox: 'A 301 redirect signals a permanent URL change and passes 90-99% of link equity.',
  sections: [
    {
      heading: 'What is a 301 Redirect',
      content: 'A 301 redirect is a server-side redirect that tells search engines a page moved permanently. Google Search Console tracks these redirects.\n\nCrouton Summary: A 301 redirect uses HTTP status codes to signal permanent URL changes.'
    },
    {
      heading: 'Link Equity Transfer',
      content: 'Link equity passes through 301 redirects at approximately 90-99% efficiency according to Google documentation. Redirect chains reduce this transfer rate.\n\nCrouton Summary: 301 redirects preserve 90-99% of link equity but redirect chains reduce efficiency.'
    }
  ],
  keyFacts: `301 redirect | signals | permanent URL change
301 redirect | passes | 90-99% of link equity
Redirect chains | reduce | link equity transfer
Google Search Console | tracks | redirect implementation`
};

runTest('Perfect Article', perfectContent);

// Test 2: Flawed Article
console.log('\n---\n\nTEST 2: Flawed Article (should have many errors)\n');

const flawedContent = {
  title: 'Redirects',
  answerBox: 'It is important for SEO. This helps rankings.',
  sections: [
    {
      heading: 'Overview',
      content: 'It helps websites. This improves performance. They benefit from implementation. Such changes drive results. The system works effectively. ' + 'Lorem ipsum '.repeat(100) // Long section without summary
    }
  ],
  keyFacts: '' // No facts
};

runTest('Flawed Article', flawedContent);

async function runTest(name, content) {
  try {
    // Parse Key Facts
    let keyFacts = [];
    if (content.keyFacts) {
      keyFacts = content.keyFacts
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && line.includes('|'))
        .map((line, idx) => {
          const parts = line.split('|').map(p => p.trim());
          return {
            id: `fact-${idx}`,
            subject: parts[0] || '',
            predicate: parts[1] || '',
            object: parts[2] || ''
          };
        });
    }

    // Parse document
    const ast = parseDocument(content);
    ast.facts = keyFacts;
    
    // Run linter
    const issues = await runLinter(ast, keyFacts);
    
    // Calculate score
    const score = calculateScore(ast, issues, keyFacts);
    
    // Display results
    console.log(`📊 SCORE: ${score.total}/100`);
    console.log(`📈 STATUS: ${score.status.toUpperCase()}`);
    console.log(`⚠️  BLOCKING ISSUES: ${score.blocking_issues}`);
    console.log(`\nBreakdown:`);
    console.log(`  - Section Anchoring:  ${score.breakdown.sectionAnchoring.score}/${score.breakdown.sectionAnchoring.max}`);
    console.log(`  - Entity Persistence: ${score.breakdown.entityPersistence.score}/${score.breakdown.entityPersistence.max}`);
    console.log(`  - Claim-Evidence:     ${score.breakdown.claimEvidence.score}/${score.breakdown.claimEvidence.max}`);
    console.log(`  - Header Specificity: ${score.breakdown.headerSpecificity.score}/${score.breakdown.headerSpecificity.max}`);
    console.log(`  - Fact Density:       ${score.breakdown.factDensity.score}/${score.breakdown.factDensity.max}`);
    console.log(`  - Fact Quality:       ${score.breakdown.factQuality.score}/${score.breakdown.factQuality.max}`);
    
    if (issues.length > 0) {
      console.log(`\n🔧 ISSUES FOUND: ${issues.length}`);
      issues.slice(0, 5).forEach((issue, idx) => {
        console.log(`\n  ${idx + 1}. ${issue.type === 'error' ? '❌' : '⚠️'} ${issue.message}`);
        console.log(`     ${issue.explanation}`);
        if (issue.fix) {
          console.log(`     💡 Fix: ${issue.fix.suggestion || issue.fix.instructions}`);
        }
        console.log(`     Impact: ${issue.score_impact} points`);
      });
      if (issues.length > 5) {
        console.log(`\n  ...and ${issues.length - 5} more issues`);
      }
    } else {
      console.log(`\n✅ NO ISSUES FOUND`);
    }
    
    if (score.top_fixes && score.top_fixes.length > 0) {
      console.log(`\n🎯 TOP FIXES:`);
      score.top_fixes.forEach((fix, idx) => {
        console.log(`  ${idx + 1}. [+${fix.impact} pts] ${fix.fix}`);
      });
    }
    
  } catch (error) {
    console.error(`❌ TEST FAILED: ${error.message}`);
    console.error(error.stack);
  }
}

console.log('\n✅ Tests complete!\n');
