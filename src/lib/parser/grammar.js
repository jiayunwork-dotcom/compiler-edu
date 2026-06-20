export const EPSILON = 'ε';
export const EOF = '$';

export function parseGrammar(text) {
  const productions = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  for (const line of lines) {
    const arrowMatch = line.match(/^([A-Za-z_][A-Za-z_0-9']*)\s*(?:→|->|:|::=)\s*(.+)$/);
    if (!arrowMatch) continue;
    
    const nonTerminal = arrowMatch[1];
    const alternatives = arrowMatch[2].split('|').map(a => a.trim());
    
    for (const alt of alternatives) {
      if (alt.length === 0 || alt === EPSILON) {
        productions.push({ head: nonTerminal, body: [] });
      } else {
        const symbols = alt.split(/\s+/).filter(s => s.length > 0);
        productions.push({ head: nonTerminal, body: symbols });
      }
    }
  }
  
  return productions;
}

export function grammarToString(productions) {
  const groups = new Map();
  for (const p of productions) {
    if (!groups.has(p.head)) {
      groups.set(p.head, []);
    }
    groups.get(p.head).push(p.body.length === 0 ? EPSILON : p.body.join(' '));
  }
  
  const lines = [];
  for (const [head, bodies] of groups) {
    lines.push(`${head} → ${bodies.join(' | ')}`);
  }
  return lines.join('\n');
}

export function getNonTerminals(productions) {
  const nts = new Set();
  for (const p of productions) {
    nts.add(p.head);
  }
  return [...nts];
}

export function getTerminals(productions) {
  const nts = new Set(getNonTerminals(productions));
  const terminals = new Set();
  for (const p of productions) {
    for (const sym of p.body) {
      if (!nts.has(sym) && sym !== EPSILON) {
        terminals.add(sym);
      }
    }
  }
  return [...terminals];
}

export function isNonTerminal(sym, productions) {
  return getNonTerminals(productions).includes(sym);
}

export function getStartSymbol(productions) {
  return productions.length > 0 ? productions[0].head : null;
}

export function computeFirst(productions) {
  const first = new Map();
  const nonTerminals = getNonTerminals(productions);
  const terminals = getTerminals(productions);
  const steps = [];
  
  for (const t of terminals) {
    first.set(t, new Set([t]));
  }
  for (const nt of nonTerminals) {
    first.set(nt, new Set());
  }
  first.set(EPSILON, new Set([EPSILON]));
  
  steps.push({ type: 'init', first: snapshotFirst(first) });
  
  let changed = true;
  let iteration = 0;
  
  while (changed) {
    changed = false;
    iteration++;
    const iterationSteps = [];
    
    for (const prod of productions) {
      const A = prod.head;
      const body = prod.body;
      const before = new Set(first.get(A));
      
      if (body.length === 0) {
        first.get(A).add(EPSILON);
      } else {
        let allHaveEpsilon = true;
        for (let i = 0; i < body.length; i++) {
          const Xi = body[i];
          const firstXi = first.get(Xi) || new Set([Xi]);
          
          for (const sym of firstXi) {
            if (sym !== EPSILON) {
              first.get(A).add(sym);
            }
          }
          
          if (!firstXi.has(EPSILON)) {
            allHaveEpsilon = false;
            break;
          }
        }
        if (allHaveEpsilon) {
          first.get(A).add(EPSILON);
        }
      }
      
      if (setsDiffer(before, first.get(A))) {
        changed = true;
        iterationSteps.push({
          production: `${A} → ${body.length === 0 ? EPSILON : body.join(' ')}`,
          before: [...before].sort(),
          after: [...first.get(A)].sort()
        });
      }
    }
    
    steps.push({ type: 'iteration', iteration, changes: iterationSteps, first: snapshotFirst(first) });
  }
  
  steps.push({ type: 'complete', first: snapshotFirst(first) });
  
  function computeFirstString(symbols) {
    const result = new Set();
    if (symbols.length === 0) {
      result.add(EPSILON);
      return result;
    }
    
    let allHaveEpsilon = true;
    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      const fs = first.get(sym);
      for (const s of fs) {
        if (s !== EPSILON) result.add(s);
      }
      if (!fs.has(EPSILON)) {
        allHaveEpsilon = false;
        break;
      }
    }
    if (allHaveEpsilon) result.add(EPSILON);
    return result;
  }
  
  return { first, steps, computeFirstString };
}

export function computeFollow(productions, firstSet) {
  const follow = new Map();
  const nonTerminals = getNonTerminals(productions);
  const start = getStartSymbol(productions);
  const steps = [];
  
  for (const nt of nonTerminals) {
    follow.set(nt, new Set());
  }
  follow.get(start).add(EOF);
  
  steps.push({ type: 'init', follow: snapshotFollow(follow) });
  
  let changed = true;
  let iteration = 0;
  
  while (changed) {
    changed = false;
    iteration++;
    const iterationSteps = [];
    
    for (const prod of productions) {
      const A = prod.head;
      const body = prod.body;
      
      for (let i = 0; i < body.length; i++) {
        const B = body[i];
        if (!nonTerminals.includes(B)) continue;
        
        const before = new Set(follow.get(B));
        const beta = body.slice(i + 1);
        
        if (beta.length === 0) {
          for (const s of follow.get(A)) {
            follow.get(B).add(s);
          }
        } else {
          const firstBeta = firstSet(beta);
          for (const s of firstBeta) {
            if (s !== EPSILON) follow.get(B).add(s);
          }
          if (firstBeta.has(EPSILON)) {
            for (const s of follow.get(A)) {
              follow.get(B).add(s);
            }
          }
        }
        
        if (setsDiffer(before, follow.get(B))) {
          changed = true;
          iterationSteps.push({
            symbol: B,
            production: `${A} → ${body.join(' ')}`,
            before: [...before].sort(),
            after: [...follow.get(B)].sort()
          });
        }
      }
    }
    
    steps.push({ type: 'iteration', iteration, changes: iterationSteps, follow: snapshotFollow(follow) });
  }
  
  steps.push({ type: 'complete', follow: snapshotFollow(follow) });
  return { follow, steps };
}

function snapshotFirst(first) {
  const map = {};
  for (const [k, v] of first) {
    map[k] = [...v].sort();
  }
  return map;
}

function snapshotFollow(follow) {
  const map = {};
  for (const [k, v] of follow) {
    map[k] = [...v].sort();
  }
  return map;
}

function setsDiffer(a, b) {
  if (a.size !== b.size) return true;
  for (const x of a) if (!b.has(x)) return true;
  return false;
}

export function buildLL1Table(productions, first, follow) {
  const nonTerminals = getNonTerminals(productions);
  const terminals = getTerminals(productions);
  const symbols = [...terminals, EOF];
  const table = {};
  const conflicts = [];
  
  for (const nt of nonTerminals) {
    table[nt] = {};
    for (const t of symbols) {
      table[nt][t] = [];
    }
  }
  
  for (let i = 0; i < productions.length; i++) {
    const prod = productions[i];
    const A = prod.head;
    const body = prod.body;
    
    let firstBody;
    if (body.length === 0) {
      firstBody = new Set([EPSILON]);
    } else {
      firstBody = new Set();
      let allHaveEpsilon = true;
      for (const sym of body) {
        const fs = first.get(sym);
        if (fs) {
          for (const s of fs) if (s !== EPSILON) firstBody.add(s);
          if (!fs.has(EPSILON)) { allHaveEpsilon = false; break; }
        } else {
          firstBody.add(sym);
          allHaveEpsilon = false;
          break;
        }
      }
      if (allHaveEpsilon) firstBody.add(EPSILON);
    }
    
    for (const t of firstBody) {
      if (t !== EPSILON) {
        table[A][t].push({ production: i, head: A, body });
      }
    }
    
    if (firstBody.has(EPSILON)) {
      for (const t of follow.get(A)) {
        table[A][t].push({ production: i, head: A, body });
      }
    }
  }
  
  for (const nt of nonTerminals) {
    for (const t of symbols) {
      if (table[nt][t].length > 1) {
        conflicts.push({ nonTerminal: nt, terminal: t, entries: table[nt][t] });
      }
    }
  }
  
  return { table, terminals: symbols, nonTerminals, conflicts };
}

export function simulateLL1(input, productions, table, first) {
  const tokens = input.split(/\s+/).filter(t => t.length > 0);
  tokens.push(EOF);
  const start = getStartSymbol(productions);
  const stack = [EOF, start];
  const steps = [];
  let pos = 0;
  let accepted = false;
  let error = null;
  
  const history = [];
  
  while (pos < tokens.length) {
    const top = stack[stack.length - 1];
    const current = tokens[pos];
    
    const snapshot = {
      stack: [...stack].reverse(),
      input: tokens.slice(pos),
      action: ''
    };
    
    if (top === EOF && current === EOF) {
      snapshot.action = '接受';
      steps.push(snapshot);
      accepted = true;
      break;
    }
    
    if (top === current) {
      snapshot.action = `匹配 ${current}`;
      steps.push(snapshot);
      history.push({ type: 'match', symbol: current });
      stack.pop();
      pos++;
      continue;
    }
    
    const nonTerminals = getNonTerminals(productions);
    if (nonTerminals.includes(top)) {
      const entries = table[top]?.[current] || [];
      if (entries.length === 0) {
        snapshot.action = `错误: 无法展开 ${top} 对输入 ${current}`;
        steps.push(snapshot);
        error = `分析失败: 在位置 ${pos}, 栈顶 ${top} 无法处理输入 ${current}`;
        break;
      }
      if (entries.length > 1) {
        snapshot.action = `冲突: ${top} 有多个产生式`;
        steps.push(snapshot);
        error = '分析失败: 预测分析表有冲突';
        break;
      }
      
      const entry = entries[0];
      snapshot.action = `展开: ${top} → ${entry.body.length === 0 ? EPSILON : entry.body.join(' ')}`;
      steps.push(snapshot);
      
      history.push({ type: 'expand', symbol: top, production: entry, children: entry.body });
      
      stack.pop();
      for (let i = entry.body.length - 1; i >= 0; i--) {
        stack.push(entry.body[i]);
      }
    } else {
      snapshot.action = `错误: 期望 ${top}, 得到 ${current}`;
      steps.push(snapshot);
      error = `分析失败: 期望 ${top}, 但得到 ${current}`;
      break;
    }
  }
  
  return { steps, accepted, error, history };
}
