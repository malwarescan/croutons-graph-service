/* jshint node: true, esversion: 11 */
// Croutonizer API Endpoints

const { parseDocument } = require('./engine/parser');
const { runLinter } = require('./engine/linter');
const { calculateScore } = require('./engine/scorer');

/**
 * POST /studio/pages/:id/croutonize
 * Run full lint + scoring on page content
 */
async function croutonizePage(req, res) {
  try {
    const { id } = req.params;
    
    // Build content object from request body
    const content = {
      title: req.body.title || '',
      answerBox: req.body.answerBox || '',
      sections: req.body.sections || [],
      keyFacts: req.body.keyFacts || ''
    };
    
    // Parse document into AST
    const ast = parseDocument(content);
    
    // Run linter
    const issues = await runLinter(ast);
    
    // Calculate score
    const score = calculateScore(ast, issues);
    
    // Return results
    res.json({
      ok: true,
      page_id: id,
      score,
      issues,
      ast: {
        total_words: ast.metadata.total_words,
        total_tokens: ast.metadata.total_tokens,
        section_count: ast.metadata.section_count
      }
    });
    
  } catch (error) {
    console.error('[croutonizer/croutonize] Error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}

/**
 * POST /studio/pages/:id/apply-fix/:issue_id
 * Apply auto-fix for specific issue
 */
async function applyFix(req, res) {
  try {
    const { id, issue_id } = req.params;
    
    // TODO: Implement fix application
    // For now, return the fix suggestion
    
    res.json({
      ok: true,
      message: 'Fix application not yet implemented',
      issue_id
    });
    
  } catch (error) {
    console.error('[croutonizer/apply-fix] Error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}

module.exports = {
  croutonizePage,
  applyFix
};
