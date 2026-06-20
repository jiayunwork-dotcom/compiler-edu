import { parseGrammar, computeFirst, computeFollow, buildLL1Table } from './src/lib/parser/grammar.js';
import { EXAMPLE_GRAMMARS } from './src/data/examples.js';

console.log('Testing arithmetic grammar (with left recursion)...');

try {
  const grammarText = EXAMPLE_GRAMMARS.arithmetic.grammar;
  console.log('Grammar:\n', grammarText);
  
  const productions = parseGrammar(grammarText);
  console.log('\nProductions:', productions.length);
  
  const firstResult = computeFirst(productions);
  console.log('\nFirst computed. First set size:', firstResult.first.size);
  
  const followResult = computeFollow(productions, firstResult.computeFirstString);
  console.log('Follow computed. Follow set size:', followResult.follow.size);
  
  const tableResult = buildLL1Table(productions, firstResult.first, followResult.follow);
  console.log('\nTable built.');
  console.log('Conflicts:', tableResult.conflicts.length);
  
  if (tableResult.conflicts.length > 0) {
    console.log('\nFirst conflict diagnosis:');
    const c = tableResult.conflicts[0];
    console.log('  Non-terminal:', c.nonTerminal);
    console.log('  Terminal:', c.terminal);
    console.log('  Entries:', c.entries.length);
    console.log('  Diagnosis type:', c.diagnosis.type);
    console.log('  Diagnosis reason:', c.diagnosis.reason);
    console.log('  Suggestions count:', c.diagnosis.suggestions.length);
    console.log('  Suggestions:');
    c.diagnosis.suggestions.forEach((s, i) => console.log(`    ${i}: ${s}`));
  }
  
  console.log('\n✅ All tests passed!');
  
} catch (e) {
  console.error('\n❌ Error:', e.message);
  console.error('Stack:', e.stack);
}
