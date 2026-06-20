<script>
  import { onMount, tick } from 'svelte';
  import CodeEditor from './CodeEditor.svelte';
  import SymbolTablePanel from './SymbolTablePanel.svelte';
  import TypeCheckPanel from './TypeCheckPanel.svelte';
  import ScopeVisualPanel from './ScopeVisualPanel.svelte';
  import {
    analyzeSemantics,
    findScopeAtLine,
    getVisibleSymbols,
    checkRenameConflict,
    applyRename,
    computeVariableLifecycles,
    computeInlineTypeAnnotations
  } from '../../lib/semantic/index.js';
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

  let showRenameDialog = false;
  let renameInput = '';
  let renameError = '';

  let variableLifecycles = new Map();
  let inlineTypeAnnotations = new Map();
  let totalLines = 1;

  function runAnalysis() {
    try {
      analysisResult = analyzeSemantics(sourceCode);
      totalLines = sourceCode.split('\n').length;
      if (analysisResult && analysisResult.allScopes) {
        variableLifecycles = computeVariableLifecycles(analysisResult.allScopes, totalLines);
      } else {
        variableLifecycles = new Map();
      }
      if (analysisResult && analysisResult.ast && analysisResult.nodeTypes && analysisResult.globalScope) {
        inlineTypeAnnotations = computeInlineTypeAnnotations(
          analysisResult.ast,
          analysisResult.nodeTypes,
          analysisResult.globalScope
        );
      } else {
        inlineTypeAnnotations = new Map();
      }
      updateHighlights();
      updateCursorScope();
    } catch (e) {
      console.error('分析出错:', e);
      analysisResult = null;
      variableLifecycles = new Map();
      inlineTypeAnnotations = new Map();
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

  function handleQuickFix(newSource) {
    if (newSource && newSource !== sourceCode) {
      sourceCode = newSource;
      selectedSymbol = null;
      selectedError = null;
    }
  }

  function handleRenameRequest() {
    if (!selectedSymbol) return;
    renameInput = selectedSymbol.name;
    renameError = '';
    showRenameDialog = true;
  }

  function handleRenameConfirm() {
    if (!selectedSymbol || !renameInput.trim()) return;
    const newName = renameInput.trim();
    if (newName === selectedSymbol.name) {
      showRenameDialog = false;
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newName)) {
      renameError = '新名称格式不正确，必须以字母或下划线开头，只能包含字母、数字和下划线';
      return;
    }
    const conflict = checkRenameConflict(selectedSymbol, newName, analysisResult.allScopes);
    if (conflict.conflict) {
      renameError = conflict.message;
      return;
    }
    const newSource = applyRename(sourceCode, selectedSymbol, newName);
    sourceCode = newSource;
    selectedSymbol = null;
    showRenameDialog = false;
  }

  function handleRenameCancel() {
    showRenameDialog = false;
    renameError = '';
  }

  function handleRenameKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleRenameCancel();
    }
  }

  $: if (analysisResult && selectedSymbol) {
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
            {inlineTypeAnnotations}
            on:input={(e) => { sourceCode = e.detail; }}
            on:cursorChange={handleCursorChange}
          />
        </div>
        <div class="editor-tips">
          <span class="tip">💡 移动光标查看作用域 · 红色波浪线为类型错误 · 悬停查看错误详情 · 行尾灰色文字为类型标注</span>
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
            {variableLifecycles}
            {totalLines}
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
            on:renameRequest={handleRenameRequest}
          />
        {:else}
          <TypeCheckPanel
            errors={analysisResult?.typeErrors || []}
            {selectedError}
            highlightSymbol={selectedSymbol}
            ast={analysisResult?.ast}
            allSymbols={analysisResult?.allSymbols || []}
            {sourceCode}
            on:errorSelect={(e) => handleErrorSelect(e.detail)}
            on:quickFix={(e) => handleQuickFix(e.detail)}
          />
        {/if}
      </div>
    </div>
  </div>

  {#if showRenameDialog}
    <div class="modal-overlay" on:click={handleRenameCancel}>
      <div class="modal-dialog rename-dialog" on:click|stopPropagation>
        <div class="modal-header">
          <h4>🔄 重命名符号</h4>
          <button class="close-btn" on:click={handleRenameCancel}>✕</button>
        </div>
        <div class="modal-body">
          <div class="rename-info">
            <span class="rename-label">原符号:</span>
            <span class="rename-old-name">{selectedSymbol?.name}</span>
            <span class="rename-type-badge">{selectedSymbol?.dataType}</span>
          </div>
          <div class="form-group">
            <label>新名称:</label>
            <input
              type="text"
              bind:value={renameInput}
              placeholder="输入新的符号名称"
              on:keydown={handleRenameKeydown}
              class:input-error={renameError}
              autofocus
            />
            {#if renameError}
              <div class="field-error">⚠️ {renameError}</div>
            {/if}
          </div>
          <div class="rename-hint">
            💡 将替换声明位置和所有引用位置（共 {(selectedSymbol?.references?.length || 0) + 1} 处）
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" on:click={handleRenameCancel}>取消</button>
          <button class="btn-primary" on:click={handleRenameConfirm}>确认重命名</button>
        </div>
      </div>
    </div>
  {/if}
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

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }

  .modal-dialog {
    background: white;
    border-radius: 10px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    min-width: 420px;
    max-width: 90vw;
    overflow: hidden;
    animation: modal-in 0.2s ease-out;
  }

  @keyframes modal-in {
    from { opacity: 0; transform: translateY(-10px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .rename-dialog {
    width: 460px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface-alt);
  }

  .modal-header h4 {
    margin: 0;
    font-size: 15px;
    color: var(--color-text);
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 16px;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    line-height: 1;
  }

  .close-btn:hover {
    background: var(--color-border);
    color: var(--color-text);
  }

  .modal-body {
    padding: 18px;
  }

  .rename-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    padding: 10px 12px;
    background: var(--color-surface-alt);
    border-radius: 6px;
  }

  .rename-label {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .rename-old-name {
    font-family: monospace;
    font-weight: 700;
    font-size: 14px;
    color: var(--color-text);
  }

  .rename-type-badge {
    font-family: monospace;
    font-size: 11px;
    padding: 1px 8px;
    background: rgba(79, 70, 229, 0.1);
    color: #4f46e5;
    border-radius: 10px;
    font-weight: 600;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .form-group input {
    padding: 9px 12px;
    font-size: 14px;
    font-family: monospace;
    border: 1.5px solid var(--color-border);
    border-radius: 6px;
    outline: none;
    transition: all 0.15s;
  }

  .form-group input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
  }

  .form-group input.input-error {
    border-color: #dc2626;
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
  }

  .field-error {
    font-size: 12px;
    color: #dc2626;
    padding: 4px 0;
  }

  .rename-hint {
    margin-top: 12px;
    padding: 8px 12px;
    background: rgba(14, 165, 233, 0.06);
    border: 1px solid rgba(14, 165, 233, 0.15);
    border-radius: 6px;
    font-size: 12px;
    color: #0369a1;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 18px;
    border-top: 1px solid var(--color-border);
    background: var(--color-surface-alt);
  }

  .btn-secondary,
  .btn-primary {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }

  .btn-secondary {
    background: var(--color-surface);
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-border);
    color: var(--color-text);
  }

  .btn-primary {
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    color: white;
  }

  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
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
