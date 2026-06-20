import { createState, getAllStates, getAlphabet } from './utils.js';

export function minimizeDFA(dfa) {
  const steps = [];
  const allStates = getAllStates(dfa);
  const stateList = [...allStates].sort((a, b) => a.id - b.id);
  const alphabet = [...getAlphabet(allStates)];
  
  steps.push({ type: 'states', value: stateList.map(s => s.id) });
  steps.push({ type: 'alphabet', value: alphabet });
  
  let accepting = new Set(stateList.filter(s => s.isAccepting));
  let nonAccepting = new Set(stateList.filter(s => !s.isAccepting));
  
  let partitions = [];
  if (accepting.size > 0) partitions.push(accepting);
  if (nonAccepting.size > 0) partitions.push(nonAccepting);
  
  steps.push({
    type: 'initial_partition',
    groups: partitions.map(p => [...p].map(s => s.id).sort((a, b) => a - b))
  });
  
  let changed = true;
  let iteration = 0;
  while (changed) {
    changed = false;
    iteration++;
    const newPartitions = [];
    
    for (const group of partitions) {
      const groups = new Map();
      
      for (const state of group) {
        const signature = [];
        for (const symbol of alphabet) {
          let targetGroupIndex = -1;
          if (state.transitions.has(symbol)) {
            const target = [...state.transitions.get(symbol)][0];
            for (let i = 0; i < partitions.length; i++) {
              if (partitions[i].has(target)) {
                targetGroupIndex = i;
                break;
              }
            }
          }
          signature.push(targetGroupIndex);
        }
        const sigKey = signature.join(',') + '|' + (state.isAccepting ? '1' : '0');
        
        if (!groups.has(sigKey)) {
          groups.set(sigKey, new Set());
        }
        groups.get(sigKey).add(state);
      }
      
      if (groups.size > 1) {
        changed = true;
        for (const newGroup of groups.values()) {
          newPartitions.push(newGroup);
        }
      } else {
        newPartitions.push(group);
      }
    }
    
    steps.push({
      type: 'iteration',
      iteration,
      groups: newPartitions.map(p => [...p].map(s => s.id).sort((a, b) => a - b))
    });
    
    partitions = newPartitions;
  }
  
  const stateToGroup = new Map();
  partitions.forEach((group, idx) => {
    for (const state of group) {
      stateToGroup.set(state, idx);
    }
  });
  
  let minIdCounter = 0;
  const groupToState = new Map();
  const minStates = [];
  
  for (let i = 0; i < partitions.length; i++) {
    const group = partitions[i];
    const rep = [...group][0];
    const minState = createState(++minIdCounter, rep.isAccepting, rep.acceptLabel);
    minState.groupMembers = [...group].map(s => s.id).sort((a, b) => a - b);
    groupToState.set(i, minState);
    minStates.push(minState);
  }
  
  for (let i = 0; i < partitions.length; i++) {
    const group = partitions[i];
    const rep = [...group][0];
    const minState = groupToState.get(i);
    
    for (const symbol of alphabet) {
      if (rep.transitions.has(symbol)) {
        const target = [...rep.transitions.get(symbol)][0];
        const targetGroupIdx = stateToGroup.get(target);
        const targetMinState = groupToState.get(targetGroupIdx);
        minState.transitions.set(symbol, new Set([targetMinState]));
      }
    }
  }
  
  const startGroupIdx = stateToGroup.get(dfa);
  const minStart = groupToState.get(startGroupIdx);
  
  steps.push({
    type: 'complete',
    states: minStates,
    merged: partitions.map(p => [...p].map(s => s.id).sort((a, b) => a - b))
  });
  
  return { dfa: minStart, steps };
}
