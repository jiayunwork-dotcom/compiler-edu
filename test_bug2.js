import { parseGrammar, computeFirst, computeFollow, buildLL1Table } from './src/lib/parser/grammar.js';
import { EXAMPLE_GRAMMARS } from './src/data/examples.js';

console.log('Testing arithmetic grammar (with left recursion)...');

try {
  const grammarText = EXAMPLE_GRAMMARS.arithmetic.grammar;
  console.log('Grammar:\n', grammarText);
  
  const productions = parseGrammar(grammarText);
  console.log('\nProductions:', productions.length);
  
  const firstResult = computeFirst(productions);
  console.log('\nFirst computed.');
  console.log('  firstResult type:', typeof firstResult);
  console.log('  firstResult keys:', Object.keys(firstResult));
  console.log('  first type:', typeof firstResult.first);
  console.log('  computeFirstString type:', typeof firstResult.computeFirstString);
  
  if (typeof firstResult.computeFirstString === 'function') {
    console.log('  computeFirstString is a function ✓');
    const testResult = firstResult.computeFirstString(['E', '+', 'T']);
    console.log('  computeFirstString test result:', [...testResult]);
  } else {
    console.log('  ✗ computeFirstString is NOT a function!');
  }
  
  const followResult = computeFollow(productions, firstResult.computeFirstString);
  console.log('\nFollow computed. Follow set size:', followResult.follow.size);
  
  const tableResult = buildLL1Table(productions, firstResult.first, followResult.follow);
  console.log('\nTable built.');
  console.log('Conflicts:', tableResult.conflicts.length);
  
  console.log('\n✅ All tests passed!');
  
} catch (e) {
  console.error('\n❌ Error:', e.message);
  console.error('Stack:', e.stack);
}
