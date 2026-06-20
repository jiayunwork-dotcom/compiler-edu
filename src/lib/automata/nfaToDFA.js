import { createState, epsilonClosure, move, getAlphabet, statesToIdSet, getAllStates } from './utils.js';

let dfaStateCounter = 0;

function nextDFAState(nfaStates, isAccepting = false, acceptLabel = null) {
  const state = createState(++dfaStateCounter, isAccepting, acceptLabel);
  state.nfaStates = nfaStates;
  return state;
}

function resetDFACounter() {
  dfaStateCounter = 0;
}

export function nfaToDFA(nfa) {
  resetDFACounter();
  const steps = [];
  const alphabet = getAlphabet(getAllStates(nfa.start));
  steps.push({ type: 'alphabet', value: [...alphabet] });
  
  const startClosure = epsilonClosure(new Set([nfa.start]));
  const startDFA = nextDFAState(startClosure, [...startClosure].some(s => s.isAccepting));
  if (startDFA.isAccepting) {
    const acceptState = [...startClosure].find(s => s.isAccepting);
    if (acceptState) startDFA.acceptLabel = acceptState.acceptLabel;
  }
  
  const dfaStates = [startDFA];
  const unmarked = [startDFA];
  const stateMap = new Map();
  stateMap.set(statesToIdSet(startClosure), startDFA);
  
  steps.push({
    type: 'initial',
    state: startDFA,
    nfaIds: statesToIdSet(startClosure),
    closure: [...startClosure].map(s => s.id).sort((a, b) => a - b)
  });
  
  while (unmarked.length > 0) {
    const current = unmarked.pop();
    const step = {
      type: 'process',
      state: current,
      transitions: []
    };
    
    for (const symbol of alphabet) {
      const moved = move(current.nfaStates, symbol);
      const closure = epsilonClosure(moved);
      
      if (closure.size === 0) continue;
      
      const key = statesToIdSet(closure);
      let targetState;
      
      if (stateMap.has(key)) {
        targetState = stateMap.get(key);
      } else {
        const isAccepting = [...closure].some(s => s.isAccepting);
        targetState = nextDFAState(closure, isAccepting);
        if (isAccepting) {
          const acceptState = [...closure].find(s => s.isAccepting);
          if (acceptState) targetState.acceptLabel = acceptState.acceptLabel;
        }
        stateMap.set(key, targetState);
        dfaStates.push(targetState);
        unmarked.push(targetState);
      }
      
      current.transitions.set(symbol, new Set([targetState]));
      step.transitions.push({
        symbol,
        fromNfa: [...current.nfaStates].map(s => s.id).sort((a, b) => a - b),
        moved: [...moved].map(s => s.id).sort((a, b) => a - b),
        closure: [...closure].map(s => s.id).sort((a, b) => a - b),
        target: targetState
      });
    }
    steps.push(step);
  }
  
  steps.push({ type: 'complete', states: dfaStates });
  return { dfa: startDFA, steps, stateMap, alphabet: [...alphabet] };
}

export function dfaToTable(dfa, alphabet) {
  const allStates = getAllStates(dfa);
  const stateList = [...allStates].sort((a, b) => a.id - b.id);
  const table = [];
  for (const state of stateList) {
    const row = { state, isAccepting: state.isAccepting };
    for (const symbol of alphabet) {
      if (state.transitions.has(symbol)) {
        row[symbol] = [...state.transitions.get(symbol)][0];
      } else {
        row[symbol] = null;
      }
    }
    table.push(row);
  }
  return table;
}
