<script>
  import { createEventDispatcher } from 'svelte';

  export let globalScope = null;
  export let allSymbols = [];
  export let selectedSymbol = null;
  export let highlightedScope = null;
  export let visibleSymbols = [];

  const dispatch = createEventDispatcher();

  let expandedScopes = new Set();

  $: renderedItems = computeRenderedItems(globalScope, expandedScopes);
  $: visibleSymbolIds = (visibleSymbols || []).filter(Boolean).map(s => s.nameStart);
  $: _temp = initExpandedScopes();

  function initExpandedScopes() {
    if (globalScope && expandedScopes.size === 0) {
      const s = new Set();
      s.add(globalScope.id);
      for (const child of globalScope.children) {
        s.add(child.id);
      }
      expandedScopes = s;
    }
    return 0;
  }

  function computeRenderedItems(root, expanded) {
    const items = [];
    if (!root) return items;

    function walk(scope, depth) {
      items.push({ type: 'scope-header', scope, depth });
      const isExpanded = expanded.has(scope.id);
      scope.symbols.forEach((sym) => {
        items.push({ type: 'symbol', symbol: sym, scope, depth: depth + 1 });
      });
      if (isExpanded && scope.children && scope.children.length > 0) {
        for (const child of scope.children) {
          walk(child, depth + 1);
        }
      }
    }

    walk(root, 0);
    return items;
  }

  function toggleScope(scope) {
    if (expandedScopes.has(scope.id)) {
      expandedScopes.delete(scope.id);
    } else {
      expandedScopes.add(scope.id);
    }
    expandedScopes = new Set(expandedScopes);
  }

  function selectSymbol(sym) {
    selectedSymbol = sym;
    dispatch('symbolSelect', sym);
  }

  function scopeKindLabel(kind) {
    switch (kind) {
      case 'global': return '🌐';
      case 'function': return 'ƒ';
      case 'block': return '📦';
      default: return '{}';
    }
  }

  function scopeKindColor(kind) {
    switch (kind) {
      case 'global': return '#4f46e5';
      case 'function': return '#0ea5e9';
      case 'block': return '#10b981';
      default: return '#64748b';
    }
  }

  function symbolKindLabel(kind) {
    switch (kind) {
      case 'function': return '函数';
      case 'variable': return '变量';
      case 'parameter': return '参数';
      default: return kind || '符号';
    }
  }

  function symbolKindBadge(kind) {
    switch (kind) {
      case 'function': return 'badge-keyword';
      case 'variable': return 'badge-identifier';
      case 'parameter': return 'badge-number';
      default: return 'badge-separator';
    }
  }

  function typeColor(type) {
    switch (type) {
      case 'int': return '#dc2626';
      case 'float': return '#ea580c';
      case 'bool': return '#7c3aed';
      case 'void': return '#64748b';
      default: return '#334155';
    }
  }

  function countAllSymbols(scope) {
    let count = scope.symbols.size;
    for (const child of scope.children) {
      count += countAllSymbols(child);
    }
    return count;
  }

  function countChildScopes(scope) {
    let count = scope.children.length;
    for (const child of scope.children) {
      count += countChildScopes(child);
    }
    return count;
  }

  $: totalSymbols = globalScope ? countAllSymbols(globalScope) : 0;
  $: totalScopes = globalScope ? 1 + countChildScopes(globalScope) : 0;

  function isScopeHighlighted(scope) {
    return highlightedScope && highlightedScope.id === scope.id;
  }

  function isSymbolVisible(sym) {
    return visibleSymbolIds.includes(sym.nameStart);
  }

  function isSymbolSelected(sym) {
    return selectedSymbol && selectedSymbol.nameStart === sym.nameStart;
  }

  function hasChildrenScopes(scope) {
    return scope.children && scope.children.length > 0;
  }

  function isExpandedFn(scope) {
    return expandedScopes.has(scope.id);
  }
</script>

<div class="symbol-table-panel">
  <div class="summary-bar">
    <div class="summary-item">
      <span class="summary-icon">📚</span>
      <span class="summary-count">{totalScopes}</span>
      <span class="summary-label">作用域</span>
    </div>
    <div class="summary-item">
      <span class="summary-icon">🏷️</span>
      <span class="summary-count">{totalSymbols}</span>
      <span class="summary-label">符号</span>
    </div>
    {#if selectedSymbol}
      <div class="summary-item selected-info">
        <span class="summary-icon">📍</span>
        <span>已选中: <strong>{selectedSymbol.name}</strong></span>
      </div>
    {/if}
  </div>

  {#if !globalScope}
    <div class="empty-state">
      <div class="empty-icon">📋</div>
      <p class="empty-text">尚无符号表数据</p>
      <p class="empty-hint">在左侧输入源代码后自动构建</p>
    </div>
  {:else}
    <div class="scope-tree">
      {#each renderedItems as item, i}
        {#if item.type === 'scope-header'}
          {@const scope = item.scope}
          {@const depth = item.depth}
          {@const isHL = isScopeHighlighted(scope)}
          {@const isExp = isExpandedFn(scope)}
          {@const hasChild = hasChildrenScopes(scope)}
          <div class="scope-node" class:scope-highlighted={isHL}>
            <div class="scope-header"
                 style="padding-left: {depth * 16 + 8}px; border-left-color: {scopeKindColor(scope.kind)};"
                 on:click={() => toggleScope(scope)}>
              <button class="toggle-btn" class:expanded={isExp}>
                {#if hasChild}
                  {isExp ? '▼' : '▶'}
                {:else}
                  <span class="toggle-placeholder">•</span>
                {/if}
              </button>
              <span class="scope-icon" style="color: {scopeKindColor(scope.kind)}">
                {scopeKindLabel(scope.kind)}
              </span>
              <span class="scope-name">{scope.name}</span>
              <span class="scope-meta">
                L{scope.line}{scope.lineEnd ? ` - L${scope.lineEnd}` : ''}
              </span>
              <span class="scope-badge">
                {scope.symbols.size} 个符号
              </span>
            </div>
          </div>
        {:else if item.type === 'symbol'}
          {@const sym = item.symbol}
          {@const depth = item.depth}
          {@const symIsSelected = isSymbolSelected(sym)}
          {@const symIsVisible = isSymbolVisible(sym)}
          <div class="symbol-row"
               class:selected={symIsSelected}
               class:visible-highlight={symIsVisible && !symIsSelected}
               style="padding-left: {depth * 16 + 36}px;"
               on:click={() => selectSymbol(sym)}>
            <span class="symbol-icon">↳</span>
            <span class="symbol-name">{sym.name}</span>
            <span class="badge {symbolKindBadge(sym.kind)}">{symbolKindLabel(sym.kind)}</span>
            <span class="symbol-type" style="color: {typeColor(sym.dataType)}">{sym.dataType}</span>
            <span class="symbol-location">L{sym.line}</span>
            {#if sym.references && sym.references.length > 0}
              <span class="ref-count" title="{sym.references.length} 处引用">
                {sym.references.length}🔗
              </span>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  {#if selectedSymbol}
    <div class="symbol-details">
      <div class="details-title">符号详情</div>
      <div class="details-grid">
        <div class="detail-label">名称</div>
        <div class="detail-value"><strong>{selectedSymbol.name}</strong></div>
        <div class="detail-label">类型</div>
        <div class="detail-value">
          <span style="color: {typeColor(selectedSymbol.dataType)}; font-weight: 600;">
            {selectedSymbol.dataType}
          </span>
        </div>
        <div class="detail-label">种类</div>
        <div class="detail-value">
          <span class="badge {symbolKindBadge(selectedSymbol.kind)}">
            {symbolKindLabel(selectedSymbol.kind)}
          </span>
        </div>
        <div class="detail-label">声明位置</div>
        <div class="detail-value">第 {selectedSymbol.line} 行, 第 {selectedSymbol.column} 列</div>
        <div class="detail-label">所属作用域</div>
        <div class="detail-value">{selectedSymbol.scope?.name || '-'}</div>
        <div class="detail-label">引用次数</div>
        <div class="detail-value">{selectedSymbol.references?.length || 0} 次</div>
      </div>
    </div>
  {/if}
</div>

<style>
  .symbol-table-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .summary-bar {
    display: flex;
    gap: 16px;
    padding: 10px 12px;
    background: var(--color-surface-alt);
    border-radius: 6px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .summary-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .summary-icon {
    font-size: 14px;
  }

  .summary-count {
    font-weight: 700;
    color: var(--color-text);
    font-size: 14px;
  }

  .selected-info {
    margin-left: auto;
    color: var(--color-primary);
    font-weight: 500;
  }

  .scope-tree {
    flex: 1;
    overflow-y: auto;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: white;
    padding: 4px 0;
  }

  .scope-node {
    transition: all 0.15s;
  }

  .scope-highlighted > .scope-header {
    background: rgba(251, 191, 36, 0.2) !important;
    border-left-width: 3px !important;
  }

  .scope-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px 6px 8px;
    cursor: pointer;
    border-left: 2px solid;
    background: transparent;
    transition: all 0.15s;
    font-size: 13px;
    user-select: none;
  }

  .scope-header:hover {
    background: var(--color-surface-alt);
  }

  .toggle-btn {
    width: 18px;
    height: 18px;
    padding: 0;
    font-size: 9px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    transition: transform 0.15s;
  }

  .toggle-btn.expanded {
    color: var(--color-primary);
  }

  .toggle-btn:hover {
    background: var(--color-border);
  }

  .toggle-placeholder {
    color: transparent;
    font-size: 12px;
  }

  .scope-icon {
    font-size: 14px;
    width: 18px;
    text-align: center;
  }

  .scope-name {
    font-weight: 600;
    color: var(--color-text);
    flex-shrink: 0;
  }

  .scope-meta {
    font-size: 11px;
    color: var(--color-text-muted);
    font-family: monospace;
  }

  .scope-badge {
    margin-left: auto;
    font-size: 10px;
    padding: 1px 8px;
    background: var(--color-surface-alt);
    border-radius: 10px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .no-symbols-hint {
    font-size: 11px;
    color: var(--color-text-muted);
    font-style: italic;
    padding: 2px 0 2px 32px;
  }

  .symbol-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px 3px 8px;
    padding-right: 8px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
    margin: 1px 4px;
    transition: all 0.1s;
    border: 1px solid transparent;
  }

  .symbol-row:hover {
    background: var(--color-surface-alt);
  }

  .symbol-row.selected {
    background: rgba(79, 70, 229, 0.15);
    border-color: var(--color-primary);
  }

  .symbol-row.visible-highlight {
    background: rgba(251, 191, 36, 0.12);
  }

  .symbol-icon {
    color: var(--color-text-muted);
    font-size: 11px;
    width: 14px;
  }

  .symbol-name {
    font-weight: 600;
    font-family: monospace;
    min-width: 60px;
  }

  .symbol-type {
    font-weight: 600;
    font-family: monospace;
    margin-left: auto;
  }

  .symbol-location {
    font-size: 10px;
    color: var(--color-text-muted);
    font-family: monospace;
  }

  .ref-count {
    font-size: 10px;
    color: var(--color-primary);
    cursor: help;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px 20px;
    color: var(--color-text-muted);
    border: 2px dashed var(--color-border);
    border-radius: 8px;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .empty-text {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 4px 0;
    color: var(--color-text);
  }

  .empty-hint {
    font-size: 12px;
    margin: 0;
  }

  .symbol-details {
    margin-top: 12px;
    padding: 12px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
  }

  .details-title {
    font-weight: 600;
    font-size: 12px;
    color: var(--color-primary);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .details-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    font-size: 12px;
  }

  .detail-label {
    color: var(--color-text-muted);
  }

  .detail-value {
    color: var(--color-text);
  }
</style>
