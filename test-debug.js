import { tokenize, DEFAULT_RULES } from './src/lib/lexer/index.js';
import { buildNFAWithSteps } from './src/lib/automata/regexToNFA.js';
import { getAllStates } from './src/lib/automata/utils.js';
import { parseGrammar, computeFirst, computeFollow, getTerminals, getNonTerminals } from './src/lib/parser/grammar.js';
import { buildLR1Items, buildLR1Table } from './src/lib/parser/lr1.js';

console.log('=== 测试1: 词法分析 ===');
const code = `int x = 42;`;
const tokens = tokenize(code, DEFAULT_RULES);
console.log('输入代码:', code);
console.log('Token数量:', tokens.length);
console.log('Tokens:', tokens);

console.log('\n=== 测试2: 正则转NFA ===');
const regex = '(a|b)*abb';
const result = buildNFAWithSteps(regex);
console.log('正则:', regex);
console.log('NFA状态数:', getAllStates(result.nfa.start).size);
console.log('步骤数:', result.steps.length);

console.log('\n=== 测试3: LL(1) First/Follow集 ===');
const grammarText = `E → T E'
E' → + T E' | ε
T → F T'
T' → * F T' | ε
F → ( E ) | id`;
const prods = parseGrammar(grammarText);
console.log('产生式数量:', prods.length);
console.log('非终结符:', getNonTerminals(prods));
console.log('终结符:', getTerminals(prods));

const firstResult = computeFirst(prods);
console.log('\nFirst集:');
for (const [k, v] of firstResult.first) {
  console.log(`  First(${k}) = {${[...v].join(', ')}}`);
}

const followResult = computeFollow(prods, firstResult.computeFirstString);
console.log('\nFollow集:');
for (const [k, v] of followResult.follow) {
  console.log(`  Follow(${k}) = {${[...v].join(', ')}}`);
}

console.log('\n=== 测试4: LR(1) ===');
const lrGrammar = `E → E + T | T
T → T * F | F
F → ( E ) | id`;
const lrProds = parseGrammar(lrGrammar);
const itemsResult = buildLR1Items(lrProds);
console.log('LR(1)状态数:', itemsResult.states.length);

const tableResult = buildLR1Table(
  itemsResult.states,
  itemsResult.gotos,
  itemsResult.augmented,
  itemsResult.originalStart
);
console.log('冲突数:', tableResult.conflicts.length);
for (const c of tableResult.conflicts.slice(0, 3)) {
  console.log('  冲突:', c.state, c.terminal, c.type, c.entries.length, '个条目');
  console.log('    条目:', c.entries.map(e => `${e.type}:${e.target || e.production}`).join(', '));
}
