export const EPSILON = 'ε';

export function createState(id, isAccepting = false, acceptLabel = null) {
  return {
    id,
    isAccepting,
    acceptLabel,
    transitions: new Map()
  };
}

export function addTransition(state, symbol, targetState) {
  if (!state.transitions.has(symbol)) {
    state.transitions.set(symbol, new Set());
  }
  state.transitions.get(symbol).add(targetState);
}

export function epsilonClosure(states) {
  const closure = new Set(states);
  const stack = [...states];
  while (stack.length > 0) {
    const state = stack.pop();
    if (state.transitions.has(EPSILON)) {
      for (const next of state.transitions.get(EPSILON)) {
        if (!closure.has(next)) {
          closure.add(next);
          stack.push(next);
        }
      }
    }
  }
  return closure;
}

export function move(states, symbol) {
  const result = new Set();
  for (const state of states) {
    if (state.transitions.has(symbol)) {
      for (const next of state.transitions.get(symbol)) {
        result.add(next);
      }
    }
  }
  return result;
}

export function getAlphabet(states) {
  const alphabet = new Set();
  for (const state of states) {
    for (const symbol of state.transitions.keys()) {
      if (symbol !== EPSILON) {
        alphabet.add(symbol);
      }
    }
  }
  return alphabet;
}

export function getAllStates(startState) {
  const visited = new Set();
  const stack = [startState];
  while (stack.length > 0) {
    const state = stack.pop();
    if (visited.has(state)) continue;
    visited.add(state);
    for (const targets of state.transitions.values()) {
      for (const target of targets) {
        if (!visited.has(target)) {
          stack.push(target);
        }
      }
    }
  }
  return visited;
}

export function statesToIdSet(states) {
  const ids = [...states].map(s => s.id).sort((a, b) => a - b);
  return '{' + ids.join(',') + '}';
}
