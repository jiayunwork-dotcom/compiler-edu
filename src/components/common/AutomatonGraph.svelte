<script>
  export let states = [];
  export let startState = null;
  export let title = '自动机';
  
  $: layout = computeLayout(states, startState);
  
  function computeLayout(stateSet, start) {
    if (!stateSet || stateSet.length === 0) return { nodes: [], edges: [], width: 400, height: 200 };
    
    const visited = new Set();
    const levels = [];
    const queue = start ? [{ state: start, level: 0 }] : [{ state: stateSet[0], level: 0 }];
    const stateLevel = new Map();
    const levelOrder = new Map();
    
    while (queue.length > 0) {
      const { state, level } = queue.shift();
      if (visited.has(state.id)) continue;
      visited.add(state.id);
      
      if (!levels[level]) levels[level] = [];
      levels[level].push(state);
      stateLevel.set(state.id, level);
      levelOrder.set(state.id, levels[level].length);
      
      for (const targets of state.transitions.values()) {
        for (const t of targets) {
          if (!visited.has(t.id)) {
            queue.push({ state: t, level: level + 1 });
          }
        }
      }
    }
    
    for (const s of stateSet) {
      if (!visited.has(s.id)) {
        const level = levels.length;
        if (!levels[level]) levels[level] = [];
        levels[level].push(s);
        stateLevel.set(s.id, level);
        levelOrder.set(s.id, levels[level].length);
      }
    }
    
    const nodeWidth = 60;
    const nodeHeight = 40;
    const hGap = 100;
    const vGap = 80;
    
    const nodes = [];
    const maxPerLevel = Math.max(...levels.map(l => l.length), 1);
    
    for (let lvl = 0; lvl < levels.length; lvl++) {
      const levelStates = levels[lvl];
      const totalWidth = levelStates.length * nodeWidth + (levelStates.length - 1) * hGap;
      const startX = Math.max(0, (maxPerLevel * nodeWidth + (maxPerLevel - 1) * hGap - totalWidth) / 2);
      
      for (let i = 0; i < levelStates.length; i++) {
        const s = levelStates[i];
        nodes.push({
          id: s.id,
          state: s,
          x: startX + i * (nodeWidth + hGap) + nodeWidth / 2,
          y: lvl * (nodeHeight + vGap) + nodeHeight / 2 + 20,
          isAccepting: s.isAccepting,
          isStart: s === start
        });
      }
    }
    
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const edges = [];
    const seenEdges = new Set();
    
    for (const s of stateSet) {
      const from = nodeMap.get(s.id);
      if (!from) continue;
      
      for (const [symbol, targets] of s.transitions) {
        for (const t of targets) {
          const to = nodeMap.get(t.id);
          if (!to) continue;
          
          const edgeKey = `${s.id}-${t.id}-${symbol}`;
          const reverseKey = `${t.id}-${s.id}-${symbol}`;
          
          if (seenEdges.has(edgeKey)) continue;
          seenEdges.add(edgeKey);
          
          let selfLoop = false;
          let curved = false;
          
          if (s.id === t.id) {
            selfLoop = true;
          } else if (seenEdges.has(reverseKey)) {
            curved = true;
          }
          
          edges.push({
            from, to, symbol,
            selfLoop,
            curved,
            curvedDir: from.x < to.x ? 1 : -1
          });
        }
      }
    }
    
    const width = maxPerLevel * nodeWidth + (maxPerLevel - 1) * hGap + 80;
    const height = levels.length * (nodeHeight + vGap) + 60;
    
    return { nodes, edges, width: Math.max(width, 400), height: Math.max(height, 200) };
  }
  
  function edgePath(from, to, selfLoop, curved, curvedDir) {
    if (selfLoop) {
      return `M ${from.x} ${from.y - 18} 
              C ${from.x - 30} ${from.y - 50}, 
                ${from.x + 30} ${from.y - 50}, 
                ${from.x} ${from.y - 18}`;
    }
    
    if (curved) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / dist;
      const ny = dx / dist;
      const midX = (from.x + to.x) / 2 + nx * curvedDir * 30;
      const midY = (from.y + to.y) / 2 + ny * curvedDir * 30;
      return `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;
    }
    
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }
  
  function labelPos(from, to, selfLoop, curved, curvedDir) {
    if (selfLoop) {
      return { x: from.x, y: from.y - 55 };
    }
    if (curved) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / dist;
      const ny = dx / dist;
      return { 
        x: (from.x + to.x) / 2 + nx * curvedDir * 30, 
        y: (from.y + to.y) / 2 + ny * curvedDir * 30 - 8 
      };
    }
    return { 
      x: (from.x + to.x) / 2, 
      y: (from.y + to.y) / 2 - 8 
    };
  }
</script>

<div class="automaton-panel">
  <div class="panel-title">
    <h3>{title}</h3>
    <span class="muted">{layout.nodes.length} 个状态, {layout.edges.length} 条转移</span>
  </div>
  <div class="graph-container">
    <svg width={layout.width} height={layout.height} viewBox="0 0 {layout.width} {layout.height}">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
        </marker>
      </defs>
      
      {#if startState}
        <path 
          d="M 10 {layout.nodes[0]?.y || 40} L {layout.nodes[0]?.x - 22 || 30} {layout.nodes[0]?.y || 40}"
          stroke="#475569"
          stroke-width="2"
          fill="none"
          marker-end="url(#arrow)"
        />
      {/if}
      
      {#each layout.edges as edge}
        <path 
          d={edgePath(edge.from, edge.to, edge.selfLoop, edge.curved, edge.curvedDir)}
          stroke="#475569"
          stroke-width="1.5"
          fill="none"
          marker-end="url(#arrow)"
        />
        {@const lp = labelPos(edge.from, edge.to, edge.selfLoop, edge.curved, edge.curvedDir)}
        <rect 
          x={lp.x - 8} 
          y={lp.y - 10} 
          width="16" 
          height="16" 
          rx="3"
          fill="white"
          stroke="#cbd5e1"
        />
        <text x={lp.x} y={lp.y + 2} text-anchor="middle" font-size="11" fill="#1e293b" font-family="monospace">
          {edge.symbol}
        </text>
      {/each}
      
      {#each layout.nodes as node}
        <circle 
          cx={node.x} 
          cy={node.y} 
          r="22" 
          fill={node.isAccepting ? '#f0fdf4' : 'white'}
          stroke={node.isAccepting ? '#22c55e' : '#475569'}
          stroke-width={node.isAccepting ? '3' : '2'}
        />
        {#if node.isAccepting}
          <circle cx={node.x} cy={node.y} r="17" fill="none" stroke="#22c55e" stroke-width="1.5" />
        {/if}
        <text x={node.x} y={node.y + 4} text-anchor="middle" font-size="13" font-weight="600" fill="#1e293b">
          S{node.id}
        </text>
      {/each}
    </svg>
  </div>
</div>

<style>
  .automaton-panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .graph-container {
    flex: 1;
    overflow: auto;
    background: linear-gradient(to bottom right, #f8fafc, #f1f5f9);
    border-radius: 6px;
    min-height: 200px;
  }
  
  svg {
    display: block;
    margin: 20px auto;
  }
  
  .muted {
    font-size: 12px;
    color: var(--color-text-muted);
  }
</style>
