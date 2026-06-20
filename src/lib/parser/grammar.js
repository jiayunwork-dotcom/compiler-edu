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
      if (!fs) {
        result.add(sym);
        allHaveEpsilon = false;
        break;
      }
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
  
  function ensureCell(nt, t) {
    if (!table[nt]) table[nt] = {};
    if (!table[nt][t]) table[nt][t] = [];
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
        if (fs && typeof fs.has === 'function') {
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
    
    const entryInfo = {
      production: i,
      head: A,
      body,
      firstBody: [...firstBody],
      hasEpsilon: firstBody.has(EPSILON)
    };
    
    for (const t of firstBody) {
      if (t !== EPSILON) {
        ensureCell(A, t);
        table[A][t].push({ ...entryInfo, addedVia: 'first' });
      }
    }
    
    if (firstBody.has(EPSILON)) {
      const followSet = follow.get(A);
      if (followSet && followSet[Symbol.iterator]) {
        for (const t of followSet) {
          ensureCell(A, t);
          table[A][t].push({ ...entryInfo, addedVia: 'follow' });
        }
      }
    }
  }
  
  const allSymbols = new Set(symbols);
  for (const nt of nonTerminals) {
    for (const t of Object.keys(table[nt] || {})) {
      allSymbols.add(t);
    }
  }
  const allSymbolsArray = [...allSymbols];
  
  for (const nt of nonTerminals) {
    for (const t of allSymbolsArray) {
      const cell = table[nt]?.[t];
      if (cell && cell.length > 1) {
        const entries = cell;
        try {
          const diagnosis = diagnoseConflict(nt, t, entries, first, follow);
          conflicts.push({ 
            nonTerminal: nt, 
            terminal: t, 
            entries,
            diagnosis
          });
        } catch (e) {
          console.warn('Conflict diagnosis failed:', e);
          conflicts.push({
            nonTerminal: nt,
            terminal: t,
            entries,
            diagnosis: {
              type: '未知冲突',
              reason: '冲突诊断过程中出现错误，请检查文法定义。',
              suggestions: ['请尝试消除左递归、提取左因子，或改写文法使其符合LL(1)文法要求。']
            }
          });
        }
      }
    }
  }
  
  return { table, terminals: allSymbolsArray, nonTerminals, conflicts };
}

function diagnoseConflict(nonTerminal, terminal, entries, first, follow) {
  const firstFirstConflicts = [];
  const firstFollowConflicts = [];
  const followFollowConflicts = [];
  
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const e1 = entries[i];
      const e2 = entries[j];
      const prod1Str = `${e1.head} → ${e1.body.length === 0 ? EPSILON : e1.body.join(' ')}`;
      const prod2Str = `${e2.head} → ${e2.body.length === 0 ? EPSILON : e2.body.join(' ')}`;
      
      if (e1.addedVia === 'first' && e2.addedVia === 'first') {
        firstFirstConflicts.push({ prod1: prod1Str, prod2: prod2Str });
      } else if ((e1.addedVia === 'first' && e2.addedVia === 'follow') ||
                 (e1.addedVia === 'follow' && e2.addedVia === 'first')) {
        const firstProd = e1.addedVia === 'first' ? prod1Str : prod2Str;
        const followProd = e1.addedVia === 'follow' ? prod1Str : prod2Str;
        firstFollowConflicts.push({ firstProd, followProd });
      } else if (e1.addedVia === 'follow' && e2.addedVia === 'follow') {
        followFollowConflicts.push({ prod1: prod1Str, prod2: prod2Str });
      }
    }
  }
  
  let conflictType = '';
  let reason = '';
  let suggestions = [];
  
  if (firstFirstConflicts.length > 0 && firstFollowConflicts.length === 0) {
    conflictType = 'First集交集冲突';
    const pairs = firstFirstConflicts.map(c => `(${c.prod1}) 与 (${c.prod2})`).join('、');
    reason = `以下产生式的First集都包含终结符 "${terminal}"：${pairs}。`;
    suggestions = generateLeftFactoringSuggestions(nonTerminal, entries, terminal);
  } else if (firstFollowConflicts.length > 0) {
    conflictType = 'First-Follow冲突';
    const pairs = firstFollowConflicts.map(c => `产生式(${c.firstProd}) 的First集包含 "${terminal}"，而产生式(${c.followProd}) 通过Follow集引入 "${terminal}"`).join('；');
    reason = pairs;
    suggestions = generateFirstFollowSuggestions(nonTerminal, terminal, entries, first, follow);
  } else {
    conflictType = 'Follow-Follow冲突';
    const pairs = followFollowConflicts.map(c => `(${c.prod1}) 与 (${c.prod2})`).join('、');
    reason = `多个可空产生式的Follow集都包含 "${terminal}"：${pairs}。`;
    suggestions = ['考虑合并产生式，或改写文法消除多个可空候选。'];
  }
  
  return {
    type: conflictType,
    reason,
    suggestions
  };
}

function generateLeftFactoringSuggestions(nonTerminal, entries, terminal) {
  const suggestions = [];
  const bodies = entries.map(e => e.body.length === 0 ? [EPSILON] : e.body);
  
  if (bodies.length < 2) {
    return ['需要至少两个产生式才能进行左因子提取分析。'];
  }
  
  const prefixMap = new Map();
  for (const body of bodies) {
    const prefix = body.length > 0 ? body[0] : EPSILON;
    if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
    prefixMap.get(prefix).push(body.join(' ') || EPSILON);
  }
  
  const commonPrefixes = [];
  const maxLen = Math.min(...bodies.map(b => b.length));
  
  if (maxLen <= 0) {
    suggestions.push(
      `【消除公共前缀】以下产生式对输入 "${terminal}" 存在歧义，需要提取左因子或改写：`,
      ...entries.map(e => `  · ${e.head} → ${e.body.length === 0 ? EPSILON : e.body.join(' ')}`)
    );
    return suggestions;
  }
  
  for (let len = 1; len <= maxLen; len++) {
    const prefixGroups = new Map();
    for (const body of bodies) {
      const prefix = body.slice(0, len).join(' ');
      if (!prefixGroups.has(prefix)) prefixGroups.set(prefix, []);
      prefixGroups.get(prefix).push(body.join(' ') || EPSILON);
    }
    for (const [prefix, group] of prefixGroups) {
      if (group.length >= 2) {
        commonPrefixes.push({ prefix, group });
      }
    }
  }
  
  if (commonPrefixes.length > 0) {
    const best = commonPrefixes[commonPrefixes.length - 1];
    suggestions.push(
      `【提取左因子】这些产生式存在公共前缀 "${best.prefix}"，可以提取左因子：`,
      `  原产生式: ${best.group.map(g => nonTerminal + ' → ' + g).join(' | ')}`,
      `  改写为: ${nonTerminal} → ${best.prefix} ${nonTerminal}'`,
      `         ${nonTerminal}' → ${best.group.map(g => {
        const rest = g.substring(best.prefix.length).trim();
        return rest || EPSILON;
      }).join(' | ')}`
    );
  } else {
    suggestions.push(
      `【消除公共前缀】以下产生式对输入 "${terminal}" 存在歧义，需要提取左因子或改写：`,
      ...entries.map(e => `  · ${e.head} → ${e.body.length === 0 ? EPSILON : e.body.join(' ')}`)
    );
  }
  
  return suggestions;
}

function generateFirstFollowSuggestions(nonTerminal, terminal, entries, first, follow) {
  const suggestions = [];
  const firstEntries = entries.filter(e => e.addedVia === 'first');
  const followEntries = entries.filter(e => e.addedVia === 'follow');
  
  suggestions.push('First-Follow冲突的消解方案：');
  
  if (followEntries.length > 0) {
    const nullableProds = followEntries.map(e => `${e.head} → ${e.body.length === 0 ? EPSILON : e.body.join(' ')}`);
    suggestions.push(
      `【方案1: 消除ε产生式】以下产生式可推出ε，导致Follow集被引入：`,
      ...nullableProds.map(p => `  · ${p}`),
      `  可以考虑将ε产生式改写，将其展开到调用 ${nonTerminal} 的产生式中。`
    );
  }
  
  if (firstEntries.length > 0) {
    const firstProds = firstEntries.map(e => `${e.head} → ${e.body.length === 0 ? EPSILON : e.body.join(' ')}`);
    suggestions.push(
      `【方案2: 改写First集冲突的产生式】以下产生式的First集包含 "${terminal}"：`,
      ...firstProds.map(p => `  · ${p}`),
      `  可以通过提取左因子或重新设计文法来消除歧义。`
    );
  }
  
  const followSet = follow.get(nonTerminal);
  if (followSet) {
    suggestions.push(
      `【诊断信息】Follow(${nonTerminal}) = {${[...followSet].join(', ')}}`,
      `  终结符 "${terminal}" 同时出现在某产生式的First集和Follow集中。`
    );
  } else {
    suggestions.push(
      `【诊断信息】无法获取 Follow(${nonTerminal})，可能存在文法定义问题。`
    );
  }
  
  return suggestions;
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
