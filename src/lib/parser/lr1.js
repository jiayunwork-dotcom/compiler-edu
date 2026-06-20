import { EPSILON, EOF, parseGrammar, getNonTerminals, getTerminals, getStartSymbol, computeFirst } from './grammar.js';

function closure(items, productions, firstMap) {
  const closureSet = new Set();
  const itemList = [...items];
  const itemStrs = new Set(items.map(itemToString));
  
  while (itemList.length > 0) {
    const item = itemList.pop();
    closureSet.add(item);
    
    const { head, body, dot, lookahead } = item;
    if (dot >= body.length) continue;
    
    const B = body[dot];
    if (!getNonTerminals(productions).includes(B)) continue;
    
    const beta = body.slice(dot + 1);
    const lookaheads = new Set();
    
    if (beta.length === 0) {
      for (const la of lookahead) {
        lookaheads.add(la);
      }
    } else {
      const firstBeta = computeFirstBeta(beta, lookahead, firstMap);
      for (const la of firstBeta) {
        if (la !== EPSILON) lookaheads.add(la);
      }
    }
    
    for (const prod of productions) {
      if (prod.head === B) {
        const newItem = {
          head: prod.head,
          body: prod.body,
          dot: 0,
          lookahead: [...lookaheads]
        };
        const s = itemToString(newItem);
        if (!itemStrs.has(s)) {
          itemStrs.add(s);
          itemList.push(newItem);
        }
      }
    }
  }
  
  return [...closureSet];
}

function computeFirstBeta(symbols, lookahead, firstMap) {
  const result = new Set();
  let allHaveEpsilon = true;
  
  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    if (firstMap.has(sym)) {
      const fs = firstMap.get(sym);
      for (const s of fs) if (s !== EPSILON) result.add(s);
      if (!fs.has(EPSILON)) {
        allHaveEpsilon = false;
        break;
      }
    } else {
      result.add(sym);
      allHaveEpsilon = false;
      break;
    }
  }
  
  if (allHaveEpsilon) {
    for (const la of lookahead) result.add(la);
  }
  
  return result;
}

function goto(items, X, productions, firstMap) {
  const moved = [];
  for (const item of items) {
    if (item.dot < item.body.length && item.body[item.dot] === X) {
      moved.push({ ...item, dot: item.dot + 1 });
    }
  }
  return closure(moved, productions, firstMap);
}

function itemToString(item) {
  const body = [...item.body];
  body.splice(item.dot, 0, '·');
  return `${item.head} → ${body.join(' ')}, [${item.lookahead.join('/')}]`;
}

export function buildLR1Items(productions) {
  const { first } = computeFirst(productions);
  const start = getStartSymbol(productions);
  
  const augmentedStart = start + "'";
  const augmented = [
    { head: augmentedStart, body: [start] },
    ...productions
  ];
  
  const initialItem = {
    head: augmentedStart,
    body: [start],
    dot: 0,
    lookahead: [EOF]
  };
  
  const initialClosure = closure([initialItem], augmented, first);
  const states = [initialClosure];
  const gotos = [];
  const stateStrings = [itemsToString(initialClosure)];
  const steps = [];
  
  steps.push({ type: 'initial', stateIndex: 0, items: [...initialClosure] });
  
  let workList = [0];
  
  while (workList.length > 0) {
    const idx = workList.shift();
    const currentItems = states[idx];
    const step = { type: 'process', stateIndex: idx, transitions: [] };
    
    const symbols = new Set();
    for (const item of currentItems) {
      if (item.dot < item.body.length) {
        symbols.add(item.body[item.dot]);
      }
    }
    
    for (const X of symbols) {
      const nextItems = goto(currentItems, X, augmented, first);
      if (nextItems.length === 0) continue;
      
      const s = itemsToString(nextItems);
      let targetIdx = stateStrings.indexOf(s);
      
      if (targetIdx === -1) {
        targetIdx = states.length;
        states.push(nextItems);
        stateStrings.push(s);
        workList.push(targetIdx);
        steps.push({ type: 'new_state', stateIndex: targetIdx, items: [...nextItems] });
      }
      
      gotos[idx] = gotos[idx] || {};
      gotos[idx][X] = targetIdx;
      step.transitions.push({ symbol: X, target: targetIdx });
    }
    
    steps.push(step);
  }
  
  return { states, gotos, augmented, start: augmentedStart, originalStart: start, steps, first };
}

function itemsToString(items) {
  return items.map(itemToString).sort().join('\n');
}

export function buildLR1Table(states, gotos, augmented, originalStart) {
  const terminals = getTerminals(augmented).filter(t => t !== EPSILON);
  const nonTerminals = getNonTerminals(augmented);
  const allTerminals = [...terminals, EOF];
  
  const action = [];
  const goTo = [];
  const conflicts = [];
  
  for (let i = 0; i < states.length; i++) {
    action[i] = {};
    goTo[i] = {};
    
    for (const t of allTerminals) action[i][t] = [];
    for (const nt of nonTerminals) goTo[i][nt] = null;
  }
  
  for (let i = 0; i < states.length; i++) {
    const items = states[i];
    
    for (const item of items) {
      if (item.dot < item.body.length) {
        const A = item.body[item.dot];
        if (terminals.includes(A) || A === EOF) {
          const j = gotos[i]?.[A];
          if (j !== undefined) {
            addUniqueAction(action[i][A], { type: 'shift', target: j });
          }
        }
      }
      
      if (item.dot >= item.body.length) {
        if (item.head === augmented[0].head) {
          if (item.lookahead.includes(EOF)) {
            addUniqueAction(action[i][EOF], { type: 'accept' });
          }
        } else {
          const prodIdx = augmented.findIndex(p =>
            p.head === item.head && arraysEqual(p.body, item.body)
          );
          for (const la of item.lookahead) {
            addUniqueAction(action[i][la], { type: 'reduce', production: prodIdx, head: item.head, body: item.body });
          }
        }
      }
    }
    
    if (gotos[i]) {
      for (const X of Object.keys(gotos[i])) {
        if (nonTerminals.includes(X)) {
          goTo[i][X] = gotos[i][X];
        }
      }
    }
  }
  
  for (let i = 0; i < states.length; i++) {
    for (const t of allTerminals) {
      if (action[i][t].length > 1) {
        const types = action[i][t].map(a => a.type);
        const hasShiftReduce = types.includes('shift') && types.includes('reduce');
        const hasReduceReduce = types.filter(t => t === 'reduce').length > 1;
        conflicts.push({
          state: i,
          terminal: t,
          entries: action[i][t],
          type: hasShiftReduce ? 'shift-reduce' : hasReduceReduce ? 'reduce-reduce' : 'other'
        });
      }
    }
  }
  
  return { action, goTo, terminals: allTerminals, nonTerminals, conflicts, augmented };
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function actionsEqual(a, b) {
  if (a.type !== b.type) return false;
  if (a.type === 'shift') return a.target === b.target;
  if (a.type === 'reduce') return a.production === b.production;
  if (a.type === 'accept') return true;
  return false;
}

function addUniqueAction(arr, action) {
  for (const existing of arr) {
    if (actionsEqual(existing, action)) return;
  }
  arr.push(action);
}

export function simulateLR1(input, table, augmented) {
  const tokens = input.split(/\s+/).filter(t => t.length > 0);
  tokens.push(EOF);
  
  const stateStack = [0];
  const symbolStack = [];
  const steps = [];
  let pos = 0;
  let accepted = false;
  let error = null;
  const history = [];
  
  while (pos < tokens.length) {
    const currentState = stateStack[stateStack.length - 1];
    const currentToken = tokens[pos];
    const entries = table.action[currentState]?.[currentToken] || [];
    
    const snapshot = {
      stateStack: [...stateStack],
      symbolStack: [...symbolStack],
      input: tokens.slice(pos),
      action: ''
    };
    
    if (entries.length === 0) {
      snapshot.action = '错误: 无可用动作';
      steps.push(snapshot);
      error = `分析失败: 状态 ${currentState} 遇到 ${currentToken} 无可用动作`;
      break;
    }
    
    const entry = entries[0];
    
    if (entry.type === 'shift') {
      snapshot.action = `移入 S${entry.target}: ${currentToken}`;
      steps.push(snapshot);
      history.push({ type: 'shift', symbol: currentToken, state: entry.target });
      stateStack.push(entry.target);
      symbolStack.push(currentToken);
      pos++;
    } else if (entry.type === 'reduce') {
      const bodyStr = entry.body.length === 0 ? EPSILON : entry.body.join(' ');
      snapshot.action = `归约 R${entry.production}: ${entry.head} → ${bodyStr}`;
      steps.push(snapshot);
      
      const children = [];
      for (let i = 0; i < entry.body.length; i++) {
        stateStack.pop();
        children.unshift(symbolStack.pop());
      }
      
      const topState = stateStack[stateStack.length - 1];
      const nextState = table.goTo[topState]?.[entry.head];
      
      history.push({
        type: 'reduce',
        symbol: entry.head,
        production: entry,
        children,
        nextState
      });
      
      stateStack.push(nextState);
      symbolStack.push(entry.head);
    } else if (entry.type === 'accept') {
      snapshot.action = '接受';
      steps.push(snapshot);
      accepted = true;
      break;
    }
  }
  
  return { steps, accepted, error, history };
}
