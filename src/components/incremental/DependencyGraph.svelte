<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { FILE_STATUS, STATUS_LABELS } from '../../lib/incremental/index.js';

  export let graph = { nodes: [], edges: [] };
  export let fileStatuses = {};
  export let compilingFileId = null;
  export let cyclePath = [];
  export let compileErrors = {};

  const dispatch = createEventDispatcher();

  let svgRef = null;
  let nodePositions = {};
  let draggingNode = null;
  let dragOffset = { x: 0, y: 0 };
  let svgWidth = 400;
  let svgHeight = 350;

  let selectedNodeId = null;
  let affectedNodes = new Set();
  let upstreamNodes = new Set();
  let downstreamNodes = new Set();
  let isShiftPressed = false;

  $: fileIds = graph.nodes || [];

  function initializePositions() {
    const width = svgWidth;
    const height = svgHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    
    const n = fileIds.length;
    if (n === 0) return;

    const newPositions = {};
    fileIds.forEach((id, i) => {
      if (!nodePositions[id]) {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        newPositions[id] = {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        };
      } else {
        newPositions[id] = nodePositions[id];
      }
    });
    nodePositions = newPositions;
  }

  $: if (fileIds.length > 0) {
    initializePositions();
  }

  function handleMouseDown(e, nodeId) {
    e.preventDefault();
    const svgRect = svgRef.getBoundingClientRect();
    const pos = nodePositions[nodeId];
    draggingNode = nodeId;
    dragOffset = {
      x: e.clientX - svgRect.left - pos.x,
      y: e.clientY - svgRect.top - pos.y
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(e) {
    if (!draggingNode || !svgRef) return;
    const svgRect = svgRef.getBoundingClientRect();
    const x = Math.max(30, Math.min(svgWidth - 30, e.clientX - svgRect.left - dragOffset.x));
    const y = Math.max(30, Math.min(svgHeight - 30, e.clientY - svgRect.top - dragOffset.y));
    nodePositions = {
      ...nodePositions,
      [draggingNode]: { x, y }
    };
  }

  function handleMouseUp() {
    draggingNode = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }

  function findUpstream(nodeId, g) {
    const { adjacencyList } = g;
    const visited = new Set();
    const result = new Set();
    
    function dfs(node) {
      if (visited.has(node)) return;
      visited.add(node);
      for (const dep of adjacencyList[node] || []) {
        if (!visited.has(dep)) {
          result.add(dep);
          dfs(dep);
        }
      }
    }
    dfs(nodeId);
    return result;
  }

  function findDownstream(nodeId, g) {
    const { reverseAdjacencyList } = g;
    const visited = new Set();
    const result = new Set();
    
    function dfs(node) {
      if (visited.has(node)) return;
      visited.add(node);
      for (const dependent of reverseAdjacencyList[node] || []) {
        if (!visited.has(dependent)) {
          result.add(dependent);
          dfs(dependent);
        }
      }
    }
    dfs(nodeId);
    return result;
  }

  function handleNodeMouseDown(e, nodeId) {
    if (draggingNode) return;
    isShiftPressed = e.shiftKey;
    selectedNodeId = nodeId;
    
    if (isShiftPressed) {
      upstreamNodes = findUpstream(nodeId, graph);
      downstreamNodes = findDownstream(nodeId, graph);
      affectedNodes = new Set([...upstreamNodes, ...downstreamNodes]);
    } else {
      affectedNodes = findDownstream(nodeId, graph);
      upstreamNodes = new Set();
      downstreamNodes = new Set();
    }
  }

  function handleNodeMouseUp() {
    selectedNodeId = null;
    affectedNodes = new Set();
    upstreamNodes = new Set();
    downstreamNodes = new Set();
    isShiftPressed = false;
  }

  function handleNodeClick(nodeId) {
    dispatch('nodeClick', nodeId);
  }

  function getNodeColor(nodeId) {
    const status = fileStatuses[nodeId] || FILE_STATUS.UNCOMPILED;
    return STATUS_LABELS[status].color;
  }

  function getNodeBgColor(nodeId) {
    if (isShiftPressed && selectedNodeId) {
      if (upstreamNodes.has(nodeId)) {
        return 'rgba(59, 130, 246, 0.2)';
      }
      if (downstreamNodes.has(nodeId)) {
        return 'rgba(239, 68, 68, 0.2)';
      }
    }
    const status = fileStatuses[nodeId] || FILE_STATUS.UNCOMPILED;
    return STATUS_LABELS[status].bgColor;
  }

  function getNodeStrokeColor(nodeId) {
    if (isShiftPressed && selectedNodeId) {
      if (upstreamNodes.has(nodeId)) {
        return '#3b82f6';
      }
      if (downstreamNodes.has(nodeId)) {
        return '#ef4444';
      }
    }
    const status = fileStatuses[nodeId] || FILE_STATUS.UNCOMPILED;
    return STATUS_LABELS[status].color;
  }

  function getNodeLabel(nodeId) {
    const status = fileStatuses[nodeId] || FILE_STATUS.UNCOMPILED;
    return STATUS_LABELS[status].text;
  }

  function isAffected(nodeId) {
    return affectedNodes.has(nodeId);
  }

  function isInCycle(edge) {
    if (cyclePath.length < 2) return false;
    for (let i = 0; i < cyclePath.length - 1; i++) {
      if (cyclePath[i] === edge.from && cyclePath[i + 1] === edge.to) {
        return true;
      }
    }
    return false;
  }

  function isUpstreamEdge(edge) {
    if (!isShiftPressed || !selectedNodeId) return false;
    return upstreamNodes.has(edge.to) && (edge.from === selectedNodeId || upstreamNodes.has(edge.from));
  }

  function isDownstreamEdge(edge) {
    if (!isShiftPressed || !selectedNodeId) return false;
    return downstreamNodes.has(edge.from) && (edge.to === selectedNodeId || downstreamNodes.has(edge.to));
  }

  function getEdgePath(edge) {
    const fromPos = nodePositions[edge.from];
    const toPos = nodePositions[edge.to];
    if (!fromPos || !toPos) return '';

    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nodeRadius = 28;
    
    const startX = fromPos.x + (dx / dist) * nodeRadius;
    const startY = fromPos.y + (dy / dist) * nodeRadius;
    const endX = toPos.x - (dx / dist) * (nodeRadius + 8);
    const endY = toPos.y - (dy / dist) * (nodeRadius + 8);

    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  function getArrowMarker(edge) {
    if (isInCycle(edge)) {
      return 'url(#arrowhead-red)';
    }
    if (isShiftPressed && selectedNodeId) {
      if (isUpstreamEdge(edge)) {
        return 'url(#arrowhead-blue)';
      }
      if (isDownstreamEdge(edge)) {
        return 'url(#arrowhead-red-chain)';
      }
    }
    return 'url(#arrowhead)';
  }

  function getEdgeColor(edge) {
    if (isInCycle(edge)) {
      return '#ef4444';
    }
    if (isShiftPressed && selectedNodeId) {
      if (isUpstreamEdge(edge)) {
        return '#3b82f6';
      }
      if (isDownstreamEdge(edge)) {
        return '#ef4444';
      }
    }
    return '#94a3b8';
  }

  function getEdgeWidth(edge) {
    if (isInCycle(edge)) return 3;
    if (isShiftPressed && selectedNodeId && (isUpstreamEdge(edge) || isDownstreamEdge(edge))) {
      return 3;
    }
    return 2;
  }

  function hasError(nodeId) {
    return compileErrors[nodeId]?.length > 0;
  }
</script>

<svg
  bind:this={svgRef}
  class="dependency-graph"
  width="100%"
  height="100%"
  viewBox="0 0 {svgWidth} {svgHeight}"
  preserveAspectRatio="xMidYMid meet"
  on:mouseleave={handleNodeMouseUp}
>
  <defs>
    <marker
      id="arrowhead"
      markerWidth="10"
      markerHeight="7"
      refX="9"
      refY="3.5"
      orient="auto"
    >
      <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
    </marker>
    <marker
      id="arrowhead-red"
      markerWidth="10"
      markerHeight="7"
      refX="9"
      refY="3.5"
      orient="auto"
    >
      <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
    </marker>
    <marker
      id="arrowhead-blue"
      markerWidth="10"
      markerHeight="7"
      refX="9"
      refY="3.5"
      orient="auto"
    >
      <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
    </marker>
    <marker
      id="arrowhead-red-chain"
      markerWidth="10"
      markerHeight="7"
      refX="9"
      refY="3.5"
      orient="auto"
    >
      <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
    </marker>
    <filter id="pulse-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  {#each graph.edges as edge}
    <path
      d={getEdgePath(edge)}
      fill="none"
      stroke={getEdgeColor(edge)}
      stroke-width={getEdgeWidth(edge)}
      marker-end={getArrowMarker(edge)}
      class="edge"
      class:cycle-edge={isInCycle(edge)}
      class:upstream-edge={isUpstreamEdge(edge)}
      class:downstream-edge={isDownstreamEdge(edge)}
    />
  {/each}

  {#each fileIds as nodeId}
    {#if nodePositions[nodeId]}
      <g
        class="node-group"
        transform="translate({nodePositions[nodeId].x}, {nodePositions[nodeId].y})"
        on:mousedown={(e) => handleMouseDown(e, nodeId)}
        on:mousedown|stopPropagation={(e) => handleNodeMouseDown(e, nodeId)}
        on:mouseup={handleNodeMouseUp}
        on:mouseleave={() => { if (!draggingNode) handleNodeMouseUp(); }}
        on:click={() => handleNodeClick(nodeId)}
        style="cursor: {draggingNode ? 'grabbing' : 'grab'}"
      >
        {#if compilingFileId === nodeId}
          <circle
            class="pulse-ring"
            r="35"
            fill="none"
            stroke={getNodeColor(nodeId)}
            stroke-width="2"
          />
          <circle
            class="pulse-ring pulse-ring-2"
            r="35"
            fill="none"
            stroke={getNodeColor(nodeId)}
            stroke-width="2"
          />
        {/if}

        <circle
          class="node-circle"
          r="28"
          fill={getNodeBgColor(nodeId)}
          stroke={getNodeStrokeColor(nodeId)}
          stroke-width="3"
          class:compiling={compilingFileId === nodeId}
          class:has-error={hasError(nodeId)}
          class:affected={isAffected(nodeId) && !isShiftPressed}
          class:selected={selectedNodeId === nodeId}
          class:upstream={isShiftPressed && upstreamNodes.has(nodeId)}
          class:downstream={isShiftPressed && downstreamNodes.has(nodeId)}
        />

        {#if selectedNodeId === nodeId && affectedNodes.size > 0}
          <g class="bubble" transform="translate(0, -55)">
            <rect
              x="-55"
              y="-15"
              width="110"
              height="24"
              rx="12"
              fill="#1e293b"
              opacity="0.95"
            />
            <text
              x="0"
              y="1"
              text-anchor="middle"
              fill="white"
              font-size="11"
              font-weight="600"
            >
              影响 {affectedNodes.size} 个文件
            </text>
          </g>
        {/if}

        {#if hasError(nodeId)}
          <text class="error-icon" x="0" y="-10" text-anchor="middle">⚠</text>
        {/if}

        <text
          class="node-text"
          x="0"
          y="5"
          text-anchor="middle"
          fill={getNodeColor(nodeId)}
        >
          {nodeId}
        </text>

        <rect
          class="status-tag"
          x="-40"
          y="-48"
          width="80"
          height="18"
          rx="9"
          fill={getNodeBgColor(nodeId)}
          stroke={getNodeStrokeColor(nodeId)}
          stroke-width="1.5"
        />
        <text
          class="status-text"
          x="0"
          y="-35"
          text-anchor="middle"
          fill={getNodeStrokeColor(nodeId)}
        >
          {getNodeLabel(nodeId)}
        </text>

        {#if hasError(nodeId)}
          <circle
            class="error-badge"
            cx="22"
            cy="-22"
            r="10"
            fill="#ef4444"
          />
          <text
            class="error-badge-text"
            x="22"
            y="-18"
            text-anchor="middle"
            fill="white"
          >
            {compileErrors[nodeId].length}
          </text>
        {/if}
      </g>
    {/if}
  {/each}
</svg>

<style>
  .dependency-graph {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 8px;
    user-select: none;
  }

  .edge {
    transition: stroke 0.3s, stroke-width 0.3s;
  }

  .cycle-edge {
    stroke-dasharray: 5, 3;
    animation: cyclePulse 1s infinite;
  }

  .upstream-edge {
    animation: edgeHighlight 0.5s ease;
  }

  .downstream-edge {
    animation: edgeHighlight 0.5s ease;
  }

  @keyframes edgeHighlight {
    from { stroke-width: 2; }
    to { stroke-width: 3; }
  }

  @keyframes cyclePulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .node-group {
    transition: transform 0.1s ease-out;
  }

  .node-circle {
    transition: all 0.3s ease;
  }

  .node-circle:hover {
    filter: brightness(1.1);
  }

  .node-circle.compiling {
    filter: url(#pulse-glow);
  }

  .node-circle.has-error {
    stroke-width: 4;
  }

  .node-circle.selected {
    stroke-width: 4;
    filter: brightness(1.15);
  }

  .node-circle.affected {
    stroke-dasharray: 5, 3;
    animation: dashAnimation 1s linear infinite;
  }

  .node-circle.upstream {
    stroke-width: 4;
  }

  .node-circle.downstream {
    stroke-width: 4;
  }

  @keyframes dashAnimation {
    to {
      stroke-dashoffset: -16;
    }
  }

  .bubble {
    animation: bubbleIn 0.2s ease-out;
    pointer-events: none;
  }

  @keyframes bubbleIn {
    from {
      opacity: 0;
      transform: translate(0, -45) scale(0.8);
    }
    to {
      opacity: 1;
      transform: translate(0, -55) scale(1);
    }
  }

  .pulse-ring {
    animation: pulse 1.5s ease-out infinite;
    transform-origin: center;
  }

  .pulse-ring-2 {
    animation-delay: 0.75s;
  }

  @keyframes pulse {
    0% {
      r: 30;
      opacity: 1;
    }
    100% {
      r: 50;
      opacity: 0;
    }
  }

  .node-text {
    font-size: 13px;
    font-weight: 700;
    font-family: 'Monaco', 'Menlo', monospace;
    pointer-events: none;
  }

  .error-icon {
    font-size: 16px;
    pointer-events: none;
  }

  .status-tag {
    transition: all 0.3s ease;
  }

  .status-text {
    font-size: 10px;
    font-weight: 600;
    pointer-events: none;
  }

  .error-badge {
    stroke: white;
    stroke-width: 2;
  }

  .error-badge-text {
    font-size: 10px;
    font-weight: 700;
    pointer-events: none;
  }
</style>
