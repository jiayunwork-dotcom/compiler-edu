<script>
  import { layoutTree } from '../../lib/tree/syntaxTree.js';
  export let root;
  let collapsedNodes = new Set();
  
  $: layout = root ? layoutTree(root) : { nodes: [], width: 0, height: 0 };
  
  function toggleCollapse(id) {
    const next = new Set(collapsedNodes);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    collapsedNodes = next;
  }
  
  function getVisibleChildren(node, allNodes) {
    if (collapsedNodes.has(node.id)) return [];
    return node.children.filter(cid => {
      const child = allNodes.find(n => n.id === cid);
      return child;
    });
  }
  
  function getNodeLabel(node) {
    const hasChildren = node.children && node.children.length > 0;
    if (hasChildren && collapsedNodes.has(node.id)) {
      return node.label + ' …';
    }
    return node.label;
  }
</script>

<div class="tree-view">
  <div class="tree-scroll">
    <svg width={layout.width + 60} height={layout.height + 60}>
      <g transform="translate(30, 20)">
        {#each layout.nodes as node}
          {#each getVisibleChildren(node, layout.nodes) as childId}
            {@const child = layout.nodes.find(n => n.id === childId)}
            {#if child}
              <path 
                d="M {node.x + 35} {node.y + 20} 
                   C {node.x + 35} {node.y + 45}, 
                     {child.x + 35} {child.y - 15}, 
                     {child.x + 35} {child.y}"
                stroke="#cbd5e1"
                stroke-width="1.5"
                fill="none"
              />
            {/if}
          {/each}
        {/each}
        
        {#each layout.nodes as node}
          <g on:click={() => node.children.length > 0 && toggleCollapse(node.id)} 
             style="cursor: {node.children.length > 0 ? 'pointer' : 'default'}">
            <rect 
              x={node.x} 
              y={node.y} 
              width="70" 
              height="40" 
              rx="8"
              fill={node.type === 'terminal' ? '#ecfdf5' : '#eff6ff'}
              stroke={node.type === 'terminal' ? '#10b981' : '#3b82f6'}
              stroke-width="2"
            />
            {#if node.children.length > 0}
              <circle cx={node.x + 60} cy={node.y + 34} r="8" fill="white" stroke="#64748b" stroke-width="1.5"/>
              <text x={node.x + 60} y={node.y + 38} text-anchor="middle" font-size="12" font-weight="bold" fill="#475569">
                {collapsedNodes.has(node.id) ? '+' : '−'}
              </text>
            {/if}
            <text 
              x={node.x + 35} 
              y={node.y + 18} 
              text-anchor="middle" 
              font-size="11" 
              font-weight="bold"
              fill={node.type === 'terminal' ? '#047857' : '#1d4ed8'}
            >
              {node.type}
            </text>
            <text 
              x={node.x + 35} 
              y={node.y + 32} 
              text-anchor="middle" 
              font-size="12" 
              font-weight="600"
              fill="#1e293b"
            >
              {(function() {
                const label = getNodeLabel(node);
                return label.length > 8 ? label.slice(0, 7) + '…' : label;
              })()}
            </text>
          </g>
        {/each}
      </g>
    </svg>
  </div>
  
  <div class="legend">
    <span class="legend-item"><span class="legend-box terminal"></span> 终结符 (叶子节点)</span>
    <span class="legend-item"><span class="legend-box nonterminal"></span> 非终结符 (可展开)</span>
    <span class="muted">点击非终结符节点可折叠/展开子树</span>
  </div>
</div>

<style>
  .tree-view {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .tree-scroll {
    overflow: auto;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 8px;
    border: 1px solid var(--color-border);
    max-height: 450px;
  }
  
  svg {
    display: block;
    margin: 10px auto;
  }
  
  .legend {
    display: flex;
    gap: 20px;
    padding: 10px 14px;
    background: var(--color-surface-alt);
    border-radius: 6px;
    font-size: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .legend-box {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 2px solid;
  }
  
  .legend-box.terminal {
    background: #ecfdf5;
    border-color: #10b981;
  }
  
  .legend-box.nonterminal {
    background: #eff6ff;
    border-color: #3b82f6;
  }
  
  .muted {
    color: var(--color-text-muted);
  }
</style>
