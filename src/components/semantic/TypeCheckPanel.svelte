<script>
  import { createEventDispatcher } from 'svelte';

  export let errors = [];
  export let selectedError = null;
  export let highlightSymbol = null;

  const dispatch = createEventDispatcher();

  function selectError(error, index) {
    selectedError = { error, index };
    dispatch('errorSelect', error);
  }

  function formatTypes(types) {
    if (!types || types.length === 0) return '-';
    return types.map(t => typeLabel(t)).join(' → ');
  }

  function typeLabel(type) {
    switch (type) {
      case 'int': return 'int';
      case 'float': return 'float';
      case 'bool': return 'bool';
      case 'void': return 'void';
      case 'unknown': return '?';
      default: return type || '?';
    }
  }

  function typeColor(type) {
    switch (type) {
      case 'int': return '#dc2626';
      case 'float': return '#ea580c';
      case 'bool': return '#7c3aed';
      case 'void': return '#64748b';
      case 'unknown': return '#94a3b8';
      default: return '#334155';
    }
  }

  function severityLabel(sev) {
    if (sev === 'warning') return '⚠️ 警告';
    return '❌ 错误';
  }

  function severityClass(sev) {
    if (sev === 'warning') return 'warning';
    return 'error';
  }

  $: errorCount = errors.filter(e => e.severity !== 'warning').length;
  $: warningCount = errors.filter(e => e.severity === 'warning').length;

  function isRelatedToHighlight(error) {
    if (!highlightSymbol) return false;
    if (error.relatedSymbol && error.relatedSymbol.nameStart === highlightSymbol.nameStart) {
      return true;
    }
    if (error.start && error.start >= highlightSymbol.nameStart && error.start <= highlightSymbol.nameEnd) {
      return true;
    }
    const msg = error.message || '';
    return msg.includes(`"${highlightSymbol.name}"`);
  }

  function isSelected(error, index) {
    return selectedError && selectedError.index === index;
  }
</script>

<div class="type-check-panel">
  <div class="summary-bar">
    <div class="summary-item errors">
      <span class="summary-icon">❌</span>
      <span class="summary-count">{errorCount}</span>
      <span class="summary-label">错误</span>
    </div>
    <div class="summary-item warnings">
      <span class="summary-icon">⚠️</span>
      <span class="summary-count">{warningCount}</span>
      <span class="summary-label">警告</span>
    </div>
    {#if errors.length === 0}
      <div class="summary-item success" style="margin-left: auto;">
        <span class="summary-icon">✅</span>
        <span>类型检查通过，未发现问题</span>
      </div>
    {/if}
    {#if highlightSymbol}
      <div class="summary-item focus-info" style="margin-left: auto;">
        <span class="summary-icon">🔍</span>
        <span>聚焦符号: <strong>{highlightSymbol.name}</strong></span>
      </div>
    {/if}
  </div>

  {#if errors.length === 0}
    <div class="empty-state">
      <div class="empty-icon">✅</div>
      <p class="empty-text">类型检查通过！</p>
      <p class="empty-hint">源代码中未发现类型错误或不兼容</p>
    </div>
  {:else}
    <div class="error-table-container">
      <table class="error-table">
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th style="width: 70px;">级别</th>
            <th style="width: 60px;">行号</th>
            <th>错误描述</th>
            <th style="width: 140px;">涉及类型</th>
          </tr>
        </thead>
        <tbody>
          {#each errors as error, idx}
            {@const related = isRelatedToHighlight(error)}
            {@const selected = isSelected(error, idx)}
            <tr class:related={related && !selected}
                class:selected-row={selected}
                on:click={() => selectError(error, idx)}>
              <td class="idx-col">{idx + 1}</td>
              <td>
                <span class="severity-badge {severityClass(error.severity)}">
                  {severityLabel(error.severity)}
                </span>
              </td>
              <td class="line-col">
                <span class="line-chip">L{error.line}</span>
              </td>
              <td class="msg-col">
                <div class="error-message">{error.message}</div>
              </td>
              <td class="types-col">
                <div class="type-tags">
                  {#each (error.types || []) as t}
                    <span class="type-tag" style="background: {typeColor(t)}22; color: {typeColor(t)}; border-color: {typeColor(t)}44;">
                      {typeLabel(t)}
                    </span>
                  {/each}
                  {#if !error.types || error.types.length === 0}
                    <span class="type-tag type-unknown">-</span>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if selectedError}
    <div class="error-detail-card">
      <div class="detail-header">
        <span class="severity-badge {severityClass(selectedError.error.severity)}" style="margin-right: 8px;">
          {severityLabel(selectedError.error.severity)}
        </span>
        <span class="detail-title">第 {selectedError.error.line} 行 - 详情</span>
      </div>
      <div class="detail-body">
        <p class="detail-message">{selectedError.error.message}</p>
        <div class="detail-meta">
          <div class="meta-item">
            <span class="meta-label">字符位置</span>
            <span class="meta-value">{selectedError.error.start} - {selectedError.error.end}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">涉及类型</span>
            <span class="meta-value">
              {(selectedError.error.types || []).map(t => typeLabel(t)).join(', ') || '无'}
            </span>
          </div>
        </div>
      </div>
      <div class="detail-hint">
        💡 点击行号可跳转到源码中的对应位置
      </div>
    </div>
  {:else if errors.length > 0}
    <div class="hint-card">
      💡 点击上方表格中的任意一条错误，可跳转到源码中的对应位置
    </div>
  {/if}
</div>

<style>
  .type-check-panel {
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

  .summary-item.errors .summary-count { color: var(--color-danger); }
  .summary-item.warnings .summary-count { color: var(--color-warning); }
  .summary-item.success { color: var(--color-success); font-weight: 500; }

  .summary-icon {
    font-size: 14px;
  }

  .summary-count {
    font-weight: 700;
    color: var(--color-text);
    font-size: 14px;
  }

  .focus-info {
    color: var(--color-primary);
    font-weight: 500;
  }

  .error-table-container {
    flex: 1;
    overflow: auto;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: white;
  }

  .error-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .error-table th {
    position: sticky;
    top: 0;
    background: var(--color-surface-alt);
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: var(--color-text-muted);
    padding: 10px 8px;
    border-bottom: 2px solid var(--color-border);
    text-align: left;
    z-index: 2;
  }

  .error-table td {
    padding: 8px;
    border-bottom: 1px solid var(--color-border);
    vertical-align: top;
  }

  .error-table tbody tr {
    cursor: pointer;
    transition: all 0.15s;
  }

  .error-table tbody tr:hover {
    background: var(--color-surface-alt);
  }

  .error-table tbody tr.related {
    background: rgba(239, 68, 68, 0.08);
  }

  .error-table tbody tr.selected-row {
    background: rgba(79, 70, 229, 0.12) !important;
    outline: 1px solid var(--color-primary);
  }

  .idx-col {
    color: var(--color-text-muted);
    font-family: monospace;
    font-weight: 600;
  }

  .severity-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
  }

  .severity-badge.error {
    background: #fee2e2;
    color: #dc2626;
  }

  .severity-badge.warning {
    background: #fef3c7;
    color: #d97706;
  }

  .line-chip {
    display: inline-block;
    padding: 2px 8px;
    background: var(--color-surface-alt);
    border-radius: 4px;
    font-family: monospace;
    font-weight: 600;
    font-size: 11px;
    color: var(--color-primary);
  }

  .msg-col .error-message {
    line-height: 1.4;
    color: var(--color-text);
  }

  .type-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }

  .type-tag {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 10px;
    font-weight: 600;
    border: 1px solid;
  }

  .type-unknown {
    background: var(--color-surface-alt);
    color: var(--color-text-muted);
    border-color: var(--color-border);
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
    border: 2px dashed #10b98144;
    border-radius: 8px;
    background: #10b98108;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.7;
  }

  .empty-text {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 4px 0;
    color: var(--color-success);
  }

  .empty-hint {
    font-size: 12px;
    margin: 0;
  }

  .error-detail-card {
    margin-top: 12px;
    padding: 12px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--color-primary);
    border-radius: 6px;
  }

  .detail-header {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-border);
  }

  .detail-title {
    font-weight: 600;
    font-size: 13px;
    color: var(--color-text);
  }

  .detail-body {
    margin-bottom: 8px;
  }

  .detail-message {
    margin: 0 0 10px 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-text);
  }

  .detail-meta {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .meta-label {
    font-size: 10px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .meta-value {
    font-size: 12px;
    font-family: monospace;
    color: var(--color-text);
    font-weight: 500;
  }

  .detail-hint {
    font-size: 11px;
    color: var(--color-primary);
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
  }

  .hint-card {
    margin-top: 12px;
    padding: 10px 12px;
    background: var(--color-surface-alt);
    border-radius: 6px;
    font-size: 12px;
    color: var(--color-text-muted);
  }
</style>
