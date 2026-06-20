<script>
  import { onMount, tick } from 'svelte';
  import CodeEditor from './CodeEditor.svelte';
  import SymbolTablePanel from './SymbolTablePanel.svelte';
  import TypeCheckPanel from './TypeCheckPanel.svelte';
  import ScopeVisualPanel from './ScopeVisualPanel.svelte';
  import { analyzeSemantics, findScopeAtLine, getVisibleSymbols } from '../../lib/semantic/index.js';
  import { DEFAULT_CODE_SAMPLES } from '../../data/examples.js';

  let sourceCode = DEFAULT_CODE_SAMPLES.semantic_demo1;

  let analysisResult = null;
  let debounceTimer = null;

  let selectedSymbol = null;
  let highlightedScope = null;
  let selectedError = null;
  let flashingSymbol = null;
  let flashingTimer = null;

  let activeTab = 'symbol';
  let cursorPos = { line: 1, column: 1 };
  let editorRef = null;

  let highlightRanges = [];
  let errorRanges = [];
  let visibleSymbols = [];

  function runAnalysis() {
    try {
      analysisResult = analyzeSemantics(sourceCode);
      updateHighlights();
      updateCursorScope();
    } catch (e) {
      console.error('分析出错:', e);
      analysisResult = null;
    }
  }

  $: sourceCode, scheduleAnalysis();

  function scheduleAnalysis() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      runAnalysis();
    }, 150);
  }

  function updateHighlights() {
    if (!analysisResult) {
      highlightRanges = [];
      errorRanges = [];
      return;
    }

    errorRanges = (analysisResult.allErrors || []).map(err => ({
      start: err.start || 0,
      end: (err.end || err.start || 0) + 1,
      message: err.message || '',
      severity: err.severity || 'error',
      line: err.line || 1
    }));

    const ranges = [];

    if (selectedSymbol) {
      ranges.push({
        start: selectedSymbol.nameStart,
        end: selectedSymbol.nameEnd,
        kind: 'declaration',
        id: `sym-${selectedSymbol.nameStart}`
      });
      if (selectedSymbol.references && selectedSymbol.references.length > 0) {
        for (const ref of selectedSymbol.references) {
          ranges.push({
            start: ref.start,
            end: ref.end,
            kind: 'reference',
            id: `sym-${selectedSymbol.nameStart}`
          });
        }
      }
    }

    if (visibleSymbols && visibleSymbols.length > 0) {
      for (const sym of visibleSymbols) {
        if (!selectedSymbol || sym.nameStart !== selectedSymbol.nameStart) {
          ranges.push({
            start: sym.nameStart,
            end: sym.nameEnd,
            kind: 'visible',
            id: `vis-${sym.nameStart}`
          });
        }
      }
    }

    highlightRanges = ranges;
  }

  function updateCursorScope() {
    if (!analysisResult || !analysisResult.allScopes) return;
    const scope = findScopeAtLine(analysisResult.allScopes, cursorPos.line);
    if (scope) {
      highlightedScope = scope;
      visibleSymbols = Array.from(getVisibleSymbols(scope).values());
    } else {
      highlightedScope = analysisResult.globalScope;
      visibleSymbols = Array.from(getVisibleSymbols(highlightedScope).values());
    }
    updateHighlights();
  }

  function handleCursorChange(e) {
    cursorPos = { line: e.detail.line, column: e.detail.column };
    updateCursorScope();
  }

  function handleSymbolSelect(sym) {
    selectedSymbol = sym;
    flashSymbol(sym);
    updateHighlights();
    if (editorRef && sym && sym.references && sym.references.length > 0) {
      const firstRef = sym.references[0];
      editorRef.selectRange(firstRef.start, firstRef.end);
    } else if (editorRef && sym) {
      editorRef.setCursorPosition(sym.line, sym.column);
    }
  }

  function flashSymbol(sym) {
    flashingSymbol = sym;
    if (flashingTimer) clearTimeout(flashingTimer);
    flashingTimer = setTimeout(() => {
      flashingSymbol = null;
    }, 2500);
  }

  function handleErrorSelect(error) {
    selectedError = error;
    if (editorRef && error) {
      const start = error.start || 0;
      const end = (error.end !== undefined && error.end > start) ? error.end : start + 1;
      editorRef.focusAndSelect(start, end, error.line || 1);
    }
  }

  function handleScopeSelect(scope) {
    highlightedScope = scope;
    visibleSymbols = Array.from(getVisibleSymbols(scope).values());
    if (editorRef) {
      editorRef.setCursorPosition(scope.line, 1);
      cursorPos = { line: scope.line, column: 1 };
    }
    updateHighlights();
  }

  $: if (analysisResult && selectedSymbol) {
    // reactive side effect handled in functions above
  }

  function loadSample(key) {
    sourceCode = DEFAULT_CODE_SAMPLES[key] || sourceCode;
    selectedSymbol = null;
    selectedError = null;
  }

  onMount(() => {
    runAnalysis();
  });
</script>

<div class="semantic-view">
  <div class="header">
    <div class="header-left">
      <h2>🎯 语义分析器</h2>
      <p class="subtitle">符号表构建 · 类型检查 · 作用域可视化</p>
    </div>
    <div class="header-right">
      <div class="sample-selector">
        <span class="sample-label">示例代码:</span>
        <select on:change={(e) => loadSample(e.target.value)}>
          <option value="semantic_demo1">示例1: 基础声明与函数</option>
          <option value="semantic_demo2">示例2: 类型错误演示</option>
          <option value="semantic_demo3">示例3: 嵌套作用域</option>
        </select>
      </div>
    </div>
  </div>

  <div class="main-grid">
    <div class="editor-section">
      <div class="panel">
        <div class="panel-title">
          <h3>📝 源代码编辑器</h3>
          <div class="status-indicators">
            {#if analysisResult}
              <span class="status-ok" title="分析完成">✓ 已分析</span>
            {/if}
            <span class="cursor-pos">行 {cursorPos.line}, 列 {cursorPos.column}</span>
          </div>
        </div>
        <div class="editor-wrapper">
          <CodeEditor
            bind:this={editorRef}
            bind:value={sourceCode}
            {highlightRanges}
            {errorRanges}
            on:input={(e) => { sourceCode = e.detail; }}
            on:cursorChange={handleCursorChange}
          />
        </div>
        <div class="editor-tips">
          <span class="tip">💡 移动光标查看作用域 · 红色波浪线为类型错误 · 悬停查看错误详情</span>
        </div>
      </div>

      <div class="panel scope-panel-section">
        <div class="panel-title">
          <h3>🗺️ 作用域可视化</h3>
          <div class="sub-meta">
            {#if highlightedScope}
              <span class="scope-label">
                <strong>{highlightedScope.name}</strong>
              </span>
            {/if}
          </div>
        </div>
        <div class="scope-visual-wrapper">
          <ScopeVisualPanel
            globalScope={analysisResult?.globalScope}
            allScopes={analysisResult?.allScopes || []}
            {highlightedScope}
            {flashingSymbol}
            on:scopeSelect={(e) => handleScopeSelect(e.detail)}
          />
        </div>
      </div>
    </div>

    <div class="panels-section">
      <div class="tabs-bar">
        <button
          class="tab-btn"
          class:active={activeTab === 'symbol'}
          on:click={() => activeTab = 'symbol'}>
          📋 符号表
          <span class="tab-count">{analysisResult?.allSymbols?.length || 0}</span>
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === 'type'}
          on:click={() => activeTab = 'type'}>
          🔍 类型检查
          {#if (analysisResult?.typeErrors?.length || 0) > 0}
            <span class="tab-count error-count">{analysisResult.typeErrors.length}</span>
          {/if}
        </button>
      </div>

      <div class="tab-content-wrapper">
        {#if activeTab === 'symbol'}
          <SymbolTablePanel
            globalScope={analysisResult?.globalScope}
            allSymbols={analysisResult?.allSymbols || []}
            {selectedSymbol}
            {highlightedScope}
            visibleSymbols={visibleSymbols}
            on:symbolSelect={(e) => handleSymbolSelect(e.detail)}
          />
        {:else}
          <TypeCheckPanel
            errors={analysisResult?.typeErrors || []}
            {selectedError}
            highlightSymbol={selectedSymbol}
            on:errorSelect={(e) => handleErrorSelect(e.detail)}
          />
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .semantic-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
    flex-wrap: wrap;
    gap: 12px;
  }

  .header-left h2 {
    margin: 0 0 4px 0;
    font-size: 1.3rem;
    background: linear-gradient(135deg, #4f46e5, #0ea5e9);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    margin: 0;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .sample-selector {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sample-label {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: 16px;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .editor-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: hidden;
    min-height: 0;
  }

  .panels-section {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .editor-wrapper {
    height: 58%;
    min-height: 0;
  }

  .scope-panel-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .scope-visual-wrapper {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .scope-visual-wrapper :global(.scope-visual-panel) {
    height: 100%;
  }

  .status-indicators {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .status-ok {
    font-size: 11px;
    padding: 2px 8px;
    background: rgba(16, 185, 129, 0.1);
    color: #059669;
    border-radius: 4px;
    font-weight: 600;
  }

  .cursor-pos {
    font-size: 11px;
    padding: 2px 8px;
    background: var(--color-surface-alt);
    color: var(--color-text-muted);
    border-radius: 4px;
    font-family: monospace;
  }

  .editor-tips {
    margin-top: 8px;
    padding: 6px 10px;
    background: rgba(79, 70, 229, 0.04);
    border-radius: 4px;
    font-size: 11px;
    color: var(--color-primary);
  }

  .tip {
    color: var(--color-text-muted);
  }

  .tabs-bar {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--color-surface-alt);
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-muted);
    transition: all 0.15s;
    cursor: pointer;
  }

  .tab-btn:hover {
    color: var(--color-text);
    background: var(--color-surface);
  }

  .tab-btn.active {
    background: var(--color-surface);
    color: var(--color-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .tab-count {
    font-size: 10px;
    padding: 1px 7px;
    background: var(--color-surface-alt);
    border-radius: 10px;
    font-weight: 600;
  }

  .error-count {
    background: rgba(239, 68, 68, 0.15) !important;
    color: #dc2626 !important;
  }

  .tab-content-wrapper {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .scope-label {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .scope-label strong {
    color: var(--color-primary);
  }

  @media (max-width: 1100px) {
    .main-grid {
      grid-template-columns: 1fr;
      overflow: auto;
    }

    .editor-section {
      min-height: 500px;
    }

    .panels-section {
      min-height: 400px;
    }
  }
</style>
