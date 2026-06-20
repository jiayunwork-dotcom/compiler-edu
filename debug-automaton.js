import { buildNFAWithSteps } from './src/lib/automata/regexToNFA.js';
import { getAllStates } from './src/lib/automata/utils.js';

const regex = '(a|b)*abb';
const nfaResult = buildNFAWithSteps(regex);

console.log('总步骤数:', nfaResult.steps.length);

const nfaStepIndex = 0;
console.log('当前步骤索引:', nfaStepIndex);

const step = nfaResult.steps[Math.min(nfaStepIndex, nfaResult.steps.length - 1)];
console.log('步骤类型:', step.type);
console.log('step.nfa 存在?', !!step.nfa);

let states;
if (step.nfa) {
  console.log('使用 step.nfa.start');
  states = getAllStates(step.nfa.start);
} else {
  console.log('使用 nfaResult.nfa.start');
  states = getAllStates(nfaResult.nfa.start);
}

console.log('返回的 Set size:', states.size);

const stateArr = [...states];
console.log('展开为数组长度:', stateArr.length);

if (stateArr.length > 0) {
  console.log('第一个状态 id:', stateArr[0].id);
  console.log('第一个状态 transitions:', stateArr[0].transitions);
  
  let edgeCount = 0;
  for (const s of stateArr) {
    for (const [sym, targets] of s.transitions) {
      edgeCount += targets.size;
    }
  }
  console.log('总边数:', edgeCount);
}

const start = nfaResult.nfa.start;
console.log('\n起始状态 id:', start.id);

console.log('\n模拟 computeLayout:');
const visited = new Set();
const levels = [];
const queue = [{ state: start, level: 0 }];

while (queue.length > 0) {
  const { state, level } = queue.shift();
  console.log('  处理状态 id:', state.id, 'level:', level);
  if (visited.has(state.id)) {
    console.log('    已访问，跳过');
    continue;
  }
  visited.add(state.id);
  
  if (!levels[level]) levels[level] = [];
  levels[level].push(state);
  
  for (const targets of state.transitions.values()) {
    for (const t of targets) {
      if (!visited.has(t.id)) {
        queue.push({ state: t, level: level + 1 });
      }
    }
  }
}
console.log('BFS访问到的状态数:', visited.size);
console.log('levels:', levels.map(l => l.length));
