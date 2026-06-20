import { tokenize, DEFAULT_RULES } from './src/lib/lexer/index.js';
import { buildNFAWithSteps } from './src/lib/automata/regexToNFA.js';
import { getAllStates } from './src/lib/automata/utils.js';

console.log('=== 问题1: 多行词法分析 ===');
const multiLineCode = `int x = 42;
float y = 3.14;
if (x > 0) {
  return x + y;
}`;
console.log('输入代码:');
console.log(multiLineCode);
console.log('\nTokens:');
const tokens = tokenize(multiLineCode, DEFAULT_RULES);
for (const t of tokens) {
  console.log(`  L${t.line}:C${t.column} [${t.type}] "${t.value}" (pos ${t.start}-${t.end})`);
}

console.log('\n\n=== 问题2: 正则转自动机状态 ===');
const regex = '(a|b)*abb';
const result = buildNFAWithSteps(regex);
console.log('总步骤数:', result.steps.length);
for (let i = 0; i < result.steps.length; i++) {
  const step = result.steps[i];
  console.log(`\n步骤 ${i}: type=${step.type}`);
  if (step.type === 'postfix') {
    console.log(`  value: ${step.value}`);
    console.log(`  has nfa? ${!!step.nfa}`);
  } else {
    console.log(`  has nfa? ${!!step.nfa}`);
    if (step.nfa) {
      try {
        const states = getAllStates(step.nfa.start);
        console.log(`  states count: ${states.size}`);
      } catch (e) {
        console.log(`  ERROR getting states: ${e.message}`);
      }
    }
  }
}

console.log('\n最终NFA:');
try {
  const finalStates = getAllStates(result.nfa.start);
  console.log('  states count:', finalStates.size);
  let edgeCount = 0;
  for (const s of finalStates) {
    for (const [sym, targets] of s.transitions) {
      edgeCount += targets.size;
    }
  }
  console.log('  edge count:', edgeCount);
} catch (e) {
  console.log('  ERROR:', e.message);
}
