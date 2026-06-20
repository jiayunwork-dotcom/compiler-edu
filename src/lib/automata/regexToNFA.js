import { createState, addTransition, EPSILON } from './utils.js';

let stateCounter = 0;
function nextState() {
  return createState(++stateCounter);
}
function resetStateCounter() {
  stateCounter = 0;
}

export function regexToNFA(regex) {
  resetStateCounter();
  const postfix = regexToPostfix(regex);
  const nfa = buildNFAFromPostfix(postfix);
  return nfa;
}

function regexToPostfix(regex) {
  const output = [];
  const operators = [];
  const precedence = { '|': 1, '.': 2, '*': 3, '+': 3, '?': 3 };
  const expanded = expandRegex(regex);
  
  for (let i = 0; i < expanded.length; i++) {
    const c = expanded[i];
    if (isOperand(c)) {
      output.push(c);
    } else if (c === '(') {
      operators.push(c);
    } else if (c === ')') {
      while (operators.length > 0 && operators[operators.length - 1] !== '(') {
        output.push(operators.pop());
      }
      operators.pop();
    } else {
      while (operators.length > 0 && operators[operators.length - 1] !== '(' &&
             precedence[operators[operators.length - 1]] >= precedence[c]) {
        output.push(operators.pop());
      }
      operators.push(c);
    }
  }
  while (operators.length > 0) {
    output.push(operators.pop());
  }
  return output;
}

function expandRegex(regex) {
  const result = [];
  for (let i = 0; i < regex.length; i++) {
    const c = regex[i];
    result.push(c);
    if (i + 1 < regex.length) {
      const next = regex[i + 1];
      if ((isOperand(c) && (isOperand(next) || next === '(')) ||
          (c === '*' || c === '+' || c === '?' || c === ')') && (isOperand(next) || next === '(')) {
        result.push('.');
      }
    }
  }
  return result.join('');
}

function isOperand(c) {
  return c !== '|' && c !== '.' && c !== '*' && c !== '+' && c !== '?' && c !== '(' && c !== ')';
}

function buildNFAFromPostfix(postfix) {
  const stack = [];
  for (const c of postfix) {
    if (isOperand(c)) {
      stack.push(buildSingle(c));
    } else if (c === '|') {
      const b = stack.pop();
      const a = stack.pop();
      stack.push(buildUnion(a, b));
    } else if (c === '.') {
      const b = stack.pop();
      const a = stack.pop();
      stack.push(buildConcat(a, b));
    } else if (c === '*') {
      const a = stack.pop();
      stack.push(buildStar(a));
    } else if (c === '+') {
      const a = stack.pop();
      stack.push(buildPlus(a));
    } else if (c === '?') {
      const a = stack.pop();
      stack.push(buildOptional(a));
    }
  }
  const nfa = stack.pop();
  nfa.accept.isAccepting = true;
  return nfa;
}

function buildSingle(symbol) {
  const start = nextState();
  const accept = nextState();
  addTransition(start, symbol, accept);
  return { start, accept };
}

function buildUnion(a, b) {
  const start = nextState();
  const accept = nextState();
  addTransition(start, EPSILON, a.start);
  addTransition(start, EPSILON, b.start);
  addTransition(a.accept, EPSILON, accept);
  addTransition(b.accept, EPSILON, accept);
  return { start, accept };
}

function buildConcat(a, b) {
  addTransition(a.accept, EPSILON, b.start);
  return { start: a.start, accept: b.accept };
}

function buildStar(a) {
  const start = nextState();
  const accept = nextState();
  addTransition(start, EPSILON, a.start);
  addTransition(start, EPSILON, accept);
  addTransition(a.accept, EPSILON, a.start);
  addTransition(a.accept, EPSILON, accept);
  return { start, accept };
}

function buildPlus(a) {
  const start = nextState();
  const accept = nextState();
  addTransition(start, EPSILON, a.start);
  addTransition(a.accept, EPSILON, a.start);
  addTransition(a.accept, EPSILON, accept);
  return { start, accept };
}

function buildOptional(a) {
  const start = nextState();
  const accept = nextState();
  addTransition(start, EPSILON, a.start);
  addTransition(start, EPSILON, accept);
  addTransition(a.accept, EPSILON, accept);
  return { start, accept };
}

export function buildNFAWithSteps(regex) {
  const steps = [];
  resetStateCounter();
  const postfix = regexToPostfix(regex);
  steps.push({ type: 'postfix', value: postfix.join('') });
  
  const stack = [];
  let stepIndex = 0;
  for (const c of postfix) {
    if (isOperand(c)) {
      stack.push(buildSingle(c));
      steps.push({ type: 'build', op: c, nfa: stack[stack.length - 1] });
    } else if (c === '|') {
      const b = stack.pop();
      const a = stack.pop();
      stack.push(buildUnion(a, b));
      steps.push({ type: 'union', nfa: stack[stack.length - 1] });
    } else if (c === '.') {
      const b = stack.pop();
      const a = stack.pop();
      stack.push(buildConcat(a, b));
      steps.push({ type: 'concat', nfa: stack[stack.length - 1] });
    } else if (c === '*') {
      const a = stack.pop();
      stack.push(buildStar(a));
      steps.push({ type: 'star', nfa: stack[stack.length - 1] });
    }
    stepIndex++;
  }
  const final = stack.pop();
  final.accept.isAccepting = true;
  return { nfa: final, steps };
}
