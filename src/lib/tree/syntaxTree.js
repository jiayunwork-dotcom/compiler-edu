let nextId = 0;

export function buildCSTFromLL1History(history, startSymbol) {
  nextId = 0;
  const root = createNode(startSymbol, 'nonterminal');
  
  const expandStack = [];
  let histIdx = 0;
  
  function expand(node) {
    while (histIdx < history.length) {
      const action = history[histIdx];
      if (action.type === 'match') {
        const leaf = createNode(action.symbol, 'terminal');
        node.children.push(leaf);
        histIdx++;
        return;
      } else if (action.type === 'expand') {
        node.expandedProduction = `${action.symbol} → ${action.children.length === 0 ? 'ε' : action.children.join(' ')}`;
        for (const child of action.children) {
          const childNode = createNode(child, isTerminal(child) ? 'terminal' : 'nonterminal');
          node.children.push(childNode);
        }
        histIdx++;
        for (let i = 0; i < node.children.length; i++) {
          const c = node.children[i];
          if (c.type === 'nonterminal') {
            expand(c);
          }
        }
        return;
      } else {
        histIdx++;
      }
    }
  }
  
  expand(root);
  return root;
}

export function buildCSTFromLR1History(history, startSymbol) {
  nextId = 0;
  const stack = [];
  
  for (const action of history) {
    if (action.type === 'shift') {
      stack.push(createNode(action.symbol, 'terminal'));
    } else if (action.type === 'reduce') {
      const children = [];
      for (let i = 0; i < action.children.length; i++) {
        children.unshift(stack.pop());
      }
      const node = createNode(action.symbol, 'nonterminal');
      node.expandedProduction = `${action.symbol} → ${children.length === 0 ? 'ε' : children.map(c => c.label).join(' ')}`;
      node.children = children;
      stack.push(node);
    }
  }
  
  return stack[0] || createNode(startSymbol, 'nonterminal');
}

export function buildAST(cstRoot) {
  nextId = 0;
  
  function transform(node) {
    if (node.type === 'terminal') {
      return { ...node, id: nextId++ };
    }
    
    const simplified = [];
    for (const child of node.children) {
      if (isUsefulNonTerminal(child.label) || child.type === 'terminal') {
        simplified.push(transform(child));
      } else {
        const sub = transform(child);
        if (sub.children && sub.children.length > 0) {
          simplified.push(...sub.children);
        }
      }
    }
    
    return {
      id: nextId++,
      label: node.label,
      type: node.type,
      production: node.expandedProduction,
      children: simplified
    };
  }
  
  return transform(cstRoot);
}

function isTerminal(sym) {
  return /^[a-z0-9+\-*/(){};,=<>!&|]/.test(sym) || 
         sym === 'ε' || sym === '$' ||
         sym === '+' || sym === '-' || sym === '*' || sym === '/' ||
         sym === '(' || sym === ')' || sym === '{' || sym === '}' ||
         sym === ';' || sym === ',' || sym === '=' ||
         /^[0-9]/.test(sym);
}

function isUsefulNonTerminal(label) {
  const useful = ['E', 'E\'\'\'\'', 'T', 'T\'', 'F', 'Expr', 'Stmt', 'IfStmt', 'WhileStmt', 'Assign', 'FuncCall', 'Term', 'Factor', 'Primary'];
  return useful.some(u => label.startsWith(u));
}

function createNode(label, type) {
  return {
    id: nextId++,
    label,
    type,
    children: []
  };
}

export function layoutTree(root, options = {}) {
  const nodeWidth = options.nodeWidth || 70;
  const nodeHeight = options.nodeHeight || 40;
  const hGap = options.hGap || 30;
  const vGap = options.vGap || 60;
  
  const layout = [];
  let maxX = 0;
  let maxY = 0;
  
  function calculatePositions(node, depth, offset) {
    let x = offset;
    const y = depth * (nodeHeight + vGap);
    
    if (node.children && node.children.length > 0) {
      let childOffset = x;
      const positions = [];
      
      for (const child of node.children) {
        const pos = calculatePositions(child, depth + 1, childOffset);
        positions.push(pos);
        childOffset = pos.maxX + hGap;
      }
      
      const leftmost = positions[0].x;
      const rightmost = positions[positions.length - 1].x;
      x = (leftmost + rightmost) / 2;
      
      maxX = Math.max(maxX, x + nodeWidth);
      maxY = Math.max(maxY, y + nodeHeight);
      
      layout.push({
        id: node.id,
        label: node.label,
        type: node.type,
        production: node.production,
        x,
        y,
        children: node.children.map(c => c.id)
      });
      
      return { x, maxX: childOffset - hGap, maxY: y };
    } else {
      maxX = Math.max(maxX, x + nodeWidth);
      maxY = Math.max(maxY, y + nodeHeight);
      
      layout.push({
        id: node.id,
        label: node.label,
        type: node.type,
        production: node.production,
        x,
        y,
        children: []
      });
      
      return { x, maxX: x + nodeWidth, maxY: y };
    }
  }
  
  const result = calculatePositions(root, 0, 0);
  return {
    nodes: layout,
    width: Math.max(maxX, 200),
    height: Math.max(maxY, 100)
  };
}
