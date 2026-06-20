<script>
  import { createEventDispatcher } from 'svelte';

  export let globalScope = null;
  export let allScopes = [];
  export let highlightedScope = null;
  export let flashingSymbol = null;

  const dispatch = createEventDispatcher();

  let collapsedScopes = new Set();

  $: renderedItems = computeRenderedItems(globalScope, collapsedScopes);

  function computeRenderedItems(root, collapsed) {
    const items = [];
    if (!root) return items;

    function walk(scope, depth) {
      items.push({ type: 'scope', scope, depth });
      const isCollapsed = collapsed.has(scope.id);
      if (!isCollapsed && scope.children && scope.children.length > 0) {
        for (const child of scope.children) {
          walk(child, depth + 1);
        }
      }
    }

    walk(root, 0);
    return items;
  }

  function toggleCollapse(scope, e) {
    if (e) e.stopPropagation();
    if (collapsedScopes.has(scope.id)) {
      collapsedScopes.delete(scope.id);
    } else {
      collapsedScopes.add(scope.id);
    }
    collapsedScopes = new Set(collapsedScopes);
  }

  function selectScope(scope) {
    dispatch('scopeSelect', scope);
  }

  function scopeKindLabel(kind) {
    switch (kind) {
      case 'global': return '全局作用域';
      case 'function': return '函数';
      case 'block': return '块';
      default: return '作用域';
    }
  }

  function scopeColor(kind) {
    const colors = {
      global: { bg: 'rgba(79, 70, 229, 0.08)', border: '#4f46e5', text: '#4338ca' },
      function: { bg: 'rgba(14, 165, 233, 0.10)', border: '#0ea5e9', text: '#0369a1' },
      block: { bg: 'rgba(16, 185, 129, 0.10)', border: '#10b981', text: '#047857' }
    };
    return colors[kind] || colors.block;
  }

  function isHighlighted(scope) {
    return highlightedScope && highlightedScope.id === scope.id;
  }

  function hasSymbolFlashing(scope) {
    if (!flashingSymbol) return false;
    return scope.id === flashingSymbol.scope?.id;
  }

  function isCollapsed(scope) {
    return collapsedScopes.has(scope.id);
  }

  function hasChildren(scope) {
    return scope.children && scope.children.length > 0;
  }
</script>

<div class="scope-visual-panel">
  <div class="summary-bar">
    <div class="legend">
      <span class="legend-title">图例:</span>
      <span class="legend-item">
        <span class="legend-box" style="background: rgba(79,70,229,0.08); border-color: #4f46e5;"></span>
        全局
      </span>
      <span class="legend-item">
        <span class="legend-box" style="background: rgba(14,165,233,0.10); border-color: #0ea5e9;"></span>
        函数
      </span>
      <span class="legend-item">
        <span class="legend-box" style="background: rgba(16,185,129,0.10); border-color: #10b981;"></span>
        块
      </span>
    </div>
    {#if highlightedScope}
      <div class="current-scope">
        当前作用域: <strong>{highlightedScope.name}</strong>
        <span class="line-range">(L{highlightedScope.line}{highlightedScope.lineEnd ? ` - L${highlightedScope.lineEnd}` : ''})</span>
      </div>
    {/if}
  </div>

  {#if !globalScope}
    <div class="empty-state">
      <div class="empty-icon">🗺️</div>
      <p class="empty-text">暂无作用域数据</p>
      <p class="empty-hint">源码分析后将在此显示作用域嵌套图</p>
    </div>
  {:else}
    <div class="treemap-container">
      {#each renderedItems as item, i (item.scope.id + '-' + i)}
        {@const scope = item.scope}
        {@const depth = item.depth}
        {@const colors = scopeColor(scope.kind)}
        {@const hl = isHighlighted(scope)}
        {@const flashing = hasSymbolFlashing(scope)}
        {@const collapsed = isCollapsed(scope)}
        {@const hasChild = hasChildren(scope)}
        <div class="scope-rect scope-{scope.kind}"
             class:scope-highlighted={hl}
             class:scope-flashing={flashing}
             style="border-color: {colors.border}; background: {colors.bg}; margin-left: {depth * 12}px;"
             on:click={() => selectScope(scope)}>
          <div class="scope-header-row">
            <div class="scope-title" style="color: {colors.text};">
              <span class="scope-kind-dot" style="background: {colors.border};"></span>
              <span class="scope-name-text">{scope.name}</span>
              <span class="scope-kind-tag">{scopeKindLabel(scope.kind)}</span>
            </div>
            <div class="scope-actions">
              {#if scope.symbols && scope.symbols.size > 0}
                <span class="scope-sym-count">{scope.symbols.size} 符号</span>
              {/if}
              {#if hasChild}
                <button class="collapse-btn" on:click={(e) => toggleCollapse(scope, e)} title={collapsed ? '展开' : '折叠'}>
                  {collapsed ? '⊞ 展开' : '⊟ 折叠'}
                </button>
              {/if}
            </div>
          </div>
          <div class="scope-line-info">
            L{scope.line}{scope.lineEnd ? ` - L${scope.lineEnd}` : ''}
          </div>

          {#if scope.symbols && scope.symbols.size > 0}
            <div class="scope-symbols-mini">
              {#each Array.from(scope.symbols.values()) as sym (sym.nameStart)}
                <span class="mini-symbol"
                      class:mini-sym-flashing={flashingSymbol && flashingSymbol.nameStart === sym.nameStart}
                      title="{sym.name}: {sym.dataType} ({sym.kind})">
                  <span class="mini-sym-name">{sym.name}</span>
                  <span class="mini-sym-type">{sym.dataType}</span>
                </span>
              {/each}
            </div>
          {/if}

          {#if collapsed && hasChild}
            <div class="collapsed-hint">
              + {scope.children.length} 个子作用域已折叠
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="tip-bar">
    💡 提示: 在源码中移动光标可高亮对应作用域 · 点击矩形可选中 · 使用 ⊞/⊟ 按钮折叠展开
  </div>
</div>

<style>
  .scope-visual-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .summary-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--color-surface-alt);
    border-radius: 6px;
    margin-bottom: 12px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .legend-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--color-text);
  }

  .legend-box {
    width: 14px;
    height: 14px;
    border: 1.5px solid;
    border-radius: 3px;
  }

  .current-scope {
    font-size: 12px;
    color: var(--color-text-muted);
    background: white;
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid var(--color-border);
  }

  .current-scope strong {
    color: var(--color-primary);
  }

  .line-range {
    font-family: monospace;
    color: var(--color-text-muted);
    font-weight: normal;
  }

  .treemap-container {
    flex: 1;
    overflow: auto;
    padding: 8px;
    background: #fafbfc;
    border: 1px solid var(--color-border);
    border-radius: 6px;
  }

  .scope-rect {
    border: 1.5px solid;
    border-radius: 6px;
    padding: 8px 10px;
    margin: 6px 0;
    transition: all 0.2s;
    cursor: pointer;
    position: relative;
  }

  .scope-global {
    border-width: 2px;
  }

  .scope-rect:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }

  .scope-highlighted {
    outline: 2px solid #fbbf24 !important;
    outline-offset: 1px;
    box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.2) !important;
    animation: scope-pulse 1.5s ease-in-out infinite;
  }

  @keyframes scope-pulse {
    0%, 100% { box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.2); }
    50% { box-shadow: 0 0 0 6px rgba(251, 191, 36, 0.35); }
  }

  .scope-flashing {
    animation: scope-flash 0.5s ease-in-out 3;
  }

  @keyframes scope-flash {
    0%, 100% { box-shadow: none; }
    50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.4); outline: 2px solid #ef4444; }
  }

  .scope-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .scope-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-size: 12px;
    min-width: 0;
  }

  .scope-kind-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .scope-name-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .scope-kind-tag {
    font-size: 9px;
    padding: 1px 6px;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 8px;
    font-weight: 500;
    color: var(--color-text-muted);
    border: 1px solid rgba(0, 0, 0, 0.06);
    flex-shrink: 0;
  }

  .scope-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .scope-sym-count {
    font-size: 10px;
    padding: 1px 7px;
    background: white;
    border-radius: 8px;
    color: var(--color-text-muted);
    border: 1px solid rgba(0, 0, 0, 0.06);
    font-weight: 500;
  }

  .collapse-btn {
    padding: 1px 8px;
    font-size: 10px;
    min-height: 0;
    line-height: 1.4;
    background: white;
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-family: inherit;
  }

  .collapse-btn:hover {
    background: var(--color-surface-alt);
    color: var(--color-primary);
    border-color: var(--color-primary-light);
  }

  .scope-line-info {
    font-size: 10px;
    font-family: monospace;
    color: var(--color-text-muted);
    margin-bottom: 6px;
    opacity: 0.7;
  }

  .scope-symbols-mini {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .mini-symbol {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 5px 1px 7px;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 10px;
    transition: all 0.2s;
    cursor: help;
  }

  .mini-symbol:hover {
    border-color: var(--color-primary-light);
    background: rgba(79, 70, 229, 0.05);
  }

  .mini-sym-flashing {
    animation: symbol-flash 0.4s ease-in-out 4;
  }

  @keyframes symbol-flash {
    0%, 100% { background: white; border-color: var(--color-border); }
    50% { background: rgba(239, 68, 68, 0.15); border-color: #ef4444; transform: scale(1.1); }
  }

  .mini-sym-name {
    font-family: monospace;
    font-weight: 600;
    color: var(--color-text);
  }

  .mini-sym-type {
    font-family: monospace;
    font-size: 9px;
    padding: 0 4px;
    background: var(--color-surface-alt);
    border-radius: 3px;
    color: var(--color-text-muted);
  }

  .collapsed-hint {
    margin-top: 6px;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 4px;
    font-size: 10px;
    color: var(--color-text-muted);
    font-style: italic;
    border: 1px dashed rgba(0, 0, 0, 0.08);
    display: inline-block;
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

  .tip-bar {
    margin-top: 10px;
    padding: 8px 12px;
    background: rgba(79, 70, 229, 0.05);
    border-radius: 6px;
    font-size: 11px;
    color: var(--color-primary);
    border: 1px solid rgba(79, 70, 229, 0.1);
    line-height: 1.5;
  }
</style>
