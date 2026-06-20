import { EPSILON, parseGrammar, grammarToString, getNonTerminals, getTerminals, getStartSymbol, computeFirst, computeFollow } from './grammar.js';

export function eliminateLeftRecursion(productions) {
  const nonTerminals = [...getNonTerminals(productions)];
  let newProductions = [...productions];
  const steps = [];
  
  steps.push({ type: 'original', grammar: grammarToString(newProductions) });
  
  for (let i = 0; i < nonTerminals.length; i++) {
    const Ai = nonTerminals[i];
    
    for (let j = 0; j < i; j++) {
      const Aj = nonTerminals[j];
      
      const aiProductions = newProductions.filter(p => p.head === Ai);
      const ajProductions = newProductions.filter(p => p.head === Aj);
      
      const indirectRecursive = aiProductions.filter(p => p.body.length > 0 && p.body[0] === Aj);
      const nonRecursive = aiProductions.filter(p => p.body.length === 0 || p.body[0] !== Aj);
      
      if (indirectRecursive.length > 0) {
        const substitution = [];
        for (const ir of indirectRecursive) {
          for (const aj of ajProductions) {
            substitution.push({ head: Ai, body: [...aj.body, ...ir.body.slice(1)] });
          }
        }
        
        newProductions = newProductions.filter(p => p.head !== Ai);
        newProductions.push(...nonRecursive, ...substitution);
        
        steps.push({
          type: 'substitute',
          Ai, Aj,
          before: grammarToString([...indirectRecursive]),
          after: grammarToString([...substitution, ...nonRecursive]),
          grammar: grammarToString(newProductions)
        });
      }
    }
    
    const currentAi = newProductions.filter(p => p.head === Ai);
    const directLeft = currentAi.filter(p => p.body.length > 0 && p.body[0] === Ai);
    const notLeft = currentAi.filter(p => p.body.length === 0 || p.body[0] !== Ai);
    
    if (directLeft.length > 0) {
      const newSymbol = Ai + "'";
      nonTerminals.push(newSymbol);
      
      const alpha = directLeft.map(p => p.body.slice(1));
      
      const newAi = notLeft.map(p => ({
        head: Ai, body: p.body.length === 0 ? [newSymbol] : [...p.body, newSymbol]
      }));
      
      const newPrime = alpha.map(a => ({ head: newSymbol, body: [...a, newSymbol] }));
      newPrime.push({ head: newSymbol, body: [] });
      
      newProductions = newProductions.filter(p => p.head !== Ai);
      newProductions.push(...newAi, ...newPrime);
      
      steps.push({
        type: 'eliminate_direct',
        symbol: Ai,
        recursive: directLeft.map(p => grammarToString([p])),
        non_recursive: notLeft.map(p => grammarToString([p])),
        new_ai: grammarToString(newAi),
        new_prime: grammarToString(newPrime),
        grammar: grammarToString(newProductions)
      });
    }
  }
  
  steps.push({ type: 'complete', grammar: grammarToString(newProductions) });
  return { productions: newProductions, steps };
}

export function leftFactor(productions) {
  const steps = [];
  let newProductions = [...productions];
  
  steps.push({ type: 'original', grammar: grammarToString(newProductions) });
  
  let changed = true;
  while (changed) {
    changed = false;
    for (const nt of [...getNonTerminals(newProductions)]) {
      const prods = newProductions.filter(p => p.head === nt);
      if (prods.length < 2) continue;
      
      const common = findCommonPrefix(prods.map(p => p.body));
      
      if (common.length === 0) continue;
      
      const newSymbol = nt + "'";
      
      const withPrefix = prods.filter(p => {
        if (p.body.length < common.length) return false;
        for (let k = 0; k < common.length; k++) {
          if (p.body[k] !== common[k]) return false;
        }
        return true;
      });
      const withoutPrefix = prods.filter(p => {
        if (p.body.length < common.length) return true;
        for (let k = 0; k < common.length; k++) {
          if (p.body[k] !== common[k]) return true;
        }
        return false;
      });
      
      const newProductionsForNt = [
        { head: nt, body: [...common, newSymbol] },
        ...withoutPrefix
      ];
      
      const newPrime = withPrefix.map(p => ({
        head: newSymbol,
        body: p.body.slice(common.length)
      }));
      
      newProductions = newProductions.filter(p => p.head !== nt);
      newProductions.push(...newProductionsForNt, ...newPrime);
      
      steps.push({
        type: 'factor',
        symbol: nt,
        prefix: common.join(' '),
        before: grammarToString(prods),
        after: grammarToString([...newProductionsForNt, ...newPrime]),
        grammar: grammarToString(newProductions)
      });
      
      changed = true;
      break;
    }
  }
  
  steps.push({ type: 'complete', grammar: grammarToString(newProductions) });
  return { productions: newProductions, steps };
}

function findCommonPrefix(arrays) {
  if (arrays.length < 2) return [];
  let prefix = [];
  let i = 0;
  while (true) {
    if (i >= arrays[0].length) break;
    const elem = arrays[0][i];
    let allMatch = true;
    for (let j = 1; j < arrays.length; j++) {
      if (i >= arrays[j].length || arrays[j][i] !== elem) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) break;
    prefix.push(elem);
    i++;
  }
  return prefix;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function removeUselessSymbols(productions) {
  const steps = [];
  steps.push({ type: 'original', grammar: grammarToString(productions) });
  
  const start = getStartSymbol(productions);
  const generating = new Set();
  const nonTerminals = getNonTerminals(productions);
  const terminals = getTerminals(productions);
  
  let changed = true;
  while (changed) {
    changed = false;
    for (const prod of productions) {
      if (generating.has(prod.head)) continue;
      let allGen = true;
      for (const sym of prod.body) {
        if (terminals.includes(sym) || generating.has(sym)) {
          continue;
        }
        if (!nonTerminals.includes(sym)) continue;
        allGen = false;
        break;
      }
      if (allGen) {
        generating.add(prod.head);
        changed = true;
      }
    }
  }
  
  let newProductions = productions.filter(p => {
    for (const sym of p.body) {
      if (nonTerminals.includes(sym) && !generating.has(sym)) return false;
    }
    return generating.has(p.head);
  });
  
  steps.push({
    type: 'generating',
    symbols: [...generating],
    grammar: grammarToString(newProductions)
  });
  
  const reachable = new Set([start]);
  const workList = [start];
  
  while (workList.length > 0) {
    const sym = workList.pop();
    const prods = newProductions.filter(p => p.head === sym);
    for (const prod of prods) {
      for (const s of prod.body) {
        if (!reachable.has(s)) {
          reachable.add(s);
          if (nonTerminals.includes(s)) {
            workList.push(s);
          }
        }
      }
    }
  }
  
  newProductions = newProductions.filter(p => reachable.has(p.head));
  
  steps.push({
    type: 'reachable',
    symbols: [...reachable],
    grammar: grammarToString(newProductions)
  });
  
  steps.push({ type: 'complete', grammar: grammarToString(newProductions) });
  return { productions: newProductions, steps };
}

export function detectLeftRecursion(productions) {
  const direct = [];
  const nonTerminals = getNonTerminals(productions);
  
  for (const prod of productions) {
    if (prod.body.length > 0 && prod.body[0] === prod.head) {
      direct.push(prod);
    }
  }
  
  const cycles = [];
  for (let i = 0; i < nonTerminals.length; i++) {
    const Ai = nonTerminals[i];
    for (let j = i + 1; j < nonTerminals.length; j++) {
      const Aj = nonTerminals[j];
      if (canReach(Ai, Aj, productions, new Set()) && canReach(Aj, Ai, productions, new Set())) {
        cycles.push([Ai, Aj]);
      }
    }
  }
  
  return { direct, indirect: cycles };
}

function canReach(from, to, productions, visited) {
  if (visited.has(from)) return false;
  visited.add(from);
  const prods = productions.filter(p => p.head === from);
  const nonTerminals = getNonTerminals(productions);
  for (const prod of prods) {
    if (prod.body.length === 0) continue;
    const first = prod.body[0];
    if (first === to) return true;
    if (nonTerminals.includes(first) && canReach(first, to, productions, visited)) {
      return true;
    }
  }
  return false;
}

export function checkLL1Conflicts(productions) {
  const { first, computeFirstString } = computeFirst(productions);
  const { follow } = computeFollow(productions, computeFirstString);
  const nonTerminals = getNonTerminals(productions);
  const conflicts = [];
  
  for (const nt of nonTerminals) {
    const prods = productions.filter(p => p.head === nt);
    for (let i = 0; i < prods.length; i++) {
      for (let j = i + 1; j < prods.length; j++) {
        const firstI = computeFirstString(prods[i].body);
        const firstJ = computeFirstString(prods[j].body);
        const intersection = new Set([...firstI].filter(x => firstJ.has(x) && x !== EPSILON));
        if (intersection.size > 0) {
          conflicts.push({
            type: 'first_intersection',
            nonTerminal: nt,
            productions: [prods[i], prods[j]],
            symbols: [...intersection]
          });
        }
        if (firstI.has(EPSILON)) {
          const followNt = follow.get(nt);
          const conflict = new Set([...firstJ].filter(x => followNt.has(x)));
          if (conflict.size > 0) {
            conflicts.push({
              type: 'first_follow',
              nonTerminal: nt,
              productions: [prods[i], prods[j]],
              symbols: [...conflict]
            });
          }
        }
        if (firstJ.has(EPSILON)) {
          const followNt = follow.get(nt);
          const conflict = new Set([...firstI].filter(x => followNt.has(x)));
          if (conflict.size > 0) {
            conflicts.push({
              type: 'first_follow',
              nonTerminal: nt,
              productions: [prods[i], prods[j]],
              symbols: [...conflict]
            });
          }
        }
      }
    }
  }
  
  return { conflicts, first, follow, computeFirstString };
}
