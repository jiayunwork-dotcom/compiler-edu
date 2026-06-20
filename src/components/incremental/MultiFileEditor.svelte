<script>
  import { createEventDispatcher } from 'svelte';
  import { FILE_STATUS, STATUS_LABELS } from '../../lib/incremental/index.js';

  export let files = {};
  export let fileStatuses = {};
  export let selectedFileId = null;
  export let compileErrors = {};
  export let disabled = false;
  export let lastCompiledSnapshots = {};

  const dispatch = createEventDispatcher();

  let editorRef = null;
  let lineNumbers = [];
  let hoveredError = null;
  let tooltipVisible = false;
  let tooltipX = 0;
  let tooltipY = 0;
  let tooltipMessage = '';
  let showDiffView = false;
  let diffFileId = null;

  $: {
    const content = files[selectedFileId]?.content || '';
    const lines = content.split('\n');
    lineNumbers = Array.from({ length: lines.length }, (_, i) => i + 1);
  }

  $: selectedContent = files[selectedFileId]?.content || '';
  $: selectedErrors = compileErrors[selectedFileId] || [];

  function handleFileSelect(fileId) {
    selectedFileId = fileId;
  }

  function handleInput(e) {
    if (disabled) return;
    const newContent = e.target.value;
    dispatch('fileChange', { fileId: selectedFileId, content: newContent });
  }

  function getStatusBadge(fileId) {
    const status = fileStatuses[fileId] || FILE_STATUS.UNCOMPILED;
    return STATUS_LABELS[status];
  }

  function hasChanges(fileId) {
    const current = files[fileId]?.content || '';
    const snapshot = lastCompiledSnapshots[fileId];
    if (snapshot === undefined) return false;
    return current !== snapshot;
  }

  function toggleDiff(fileId, e) {
    e.stopPropagation();
    if (showDiffView && diffFileId === fileId) {
      showDiffView = false;
      diffFileId = null;
    } else {
      showDiffView = true;
      diffFileId = fileId;
      selectedFileId = fileId;
    }
  }

  function closeDiff() {
    showDiffView = false;
    diffFileId = null;
  }

  function computeDiff(oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const result = [];
    let i = 0;
    let j = 0;

    while (i < oldLines.length && j < newLines.length) {
      if (oldLines[i] === newLines[j]) {
        result.push({ type: 'same', oldLine: i + 1, newLine: j + 1, content: oldLines[i] });
        i++;
        j++;
      } else {
        let foundMatch = false;
        for (let lookAhead = 1; lookAhead < Math.min(5, oldLines.length - i, newLines.length - j); lookAhead++) {
          if (oldLines[i + lookAhead] === newLines[j]) {
            for (let k = 0; k < lookAhead; k++) {
              result.push({ type: 'deleted', oldLine: i + 1, newLine: null, content: oldLines[i] });
              i++;
            }
            foundMatch = true;
            break;
          }
          if (oldLines[i] === newLines[j + lookAhead]) {
            for (let k = 0; k < lookAhead; k++) {
              result.push({ type: 'added', oldLine: null, newLine: j + 1, content: newLines[j] });
              j++;
            }
            foundMatch = true;
            break;
          }
        }
        if (!foundMatch) {
          result.push({ type: 'modified', oldLine: i + 1, newLine: j + 1, oldContent: oldLines[i], newContent: newLines[j] });
          i++;
          j++;
        }
      }
    }

    while (i < oldLines.length) {
      result.push({ type: 'deleted', oldLine: i + 1, newLine: null, content: oldLines[i] });
      i++;
    }

    while (j < newLines.length) {
      result.push({ type: 'added', oldLine: null, newLine: j + 1, content: newLines[j] });
      j++;
    }

    return result;
  }

  $: diffLines = showDiffView && diffFileId
    ? computeDiff(lastCompiledSnapshots[diffFileId] || '', files[diffFileId]?.content || '')
    : [];

  function buildHighlightedSegments(source, errRanges) {
    if (!errRanges || errRanges.length === 0) {
      return [{ text: source, classes: '' }];
    }

    const allRanges = errRanges.map(r => ({ ...r, type: 'err' }));
    const events = [];
    for (const r of allRanges) {
      events.push({ pos: r.start, type: 'start', range: r });
      events.push({ pos: r.end, type: 'end', range: r });
    }
    events.sort((a, b) => a.pos - b.pos);

    const segments = [];
    let currentPos = 0;
    const activeErr = new Set();

    for (const ev of events) {
      if (ev.pos > currentPos) {
        const classes = [];
        if (activeErr.size > 0) {
          classes.push('has-error');
          classes.push('error-squiggle');
        }
        segments.push({
          text: source.substring(currentPos, ev.pos),
          classes: classes.join(' ')
        });
        currentPos = ev.pos;
      }
      if (ev.type === 'start') {
        activeErr.add(ev.range);
      } else {
        activeErr.delete(ev.range);
      }
    }

    if (currentPos < source.length) {
      const classes = [];
      if (activeErr.size > 0) {
        classes.push('has-error');
        classes.push('error-squiggle');
      }
      segments.push({
        text: source.substring(currentPos),
        classes: classes.join(' ')
      });
    }

    return segments;
  }

  function getErrorRanges() {
    if (!selectedErrors || selectedErrors.length === 0) return [];
    const content = selectedContent;
    const lines = content.split('\n');
    const ranges = [];

    for (const err of selectedErrors) {
      const lineNum = err.line - 1;
      if (lineNum >= 0 && lineNum < lines.length) {
        let start = 0;
        for (let i = 0; i < lineNum; i++) {
          start += lines[i].length + 1;
        }
        const end = start + lines[lineNum].length;
        ranges.push({
          start,
          end,
          message: err.message,
          line: err.line,
          column: err.column || 0
        });
      }
    }

    return ranges;
  }

  function handleMouseMove(e) {
    const errors = getErrorRanges();
    if (!editorRef || errors.length === 0) {
      tooltipVisible = false;
      return;
    }

    const rect = editorRef.getBoundingClientRect();
    const textX = e.clientX - rect.left;
    const textY = e.clientY - rect.top;

    const style = window.getComputedStyle(editorRef);
    const lineHeight = parseFloat(style.lineHeight) || 20.8;
    const paddingTop = parseFloat(style.paddingTop) || 8;
    const paddingLeft = parseFloat(style.paddingLeft) || 10;
    const charWidth = 8;

    const line = Math.floor((textY - paddingTop) / lineHeight) + 1;
    if (line < 1 || line > lineNumbers.length) {
      tooltipVisible = false;
      return;
    }

    const lines = selectedContent.split('\n');
    const lineStart = lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0);
    const col = Math.max(0, Math.floor((textX - paddingLeft) / charWidth));
    const charPos = lineStart + Math.min(col, lines[line - 1].length);

    const error = errors.find(err => charPos >= err.start && charPos <= err.end);
    if (error) {
      hoveredError = error;
      tooltipVisible = true;
      tooltipX = e.clientX - rect.left + 12;
      tooltipY = textY - 20;
      tooltipMessage = error.message;
    } else {
      tooltipVisible = false;
      hoveredError = null;
    }
  }

  function handleMouseLeave() {
    tooltipVisible = false;
    hoveredError = null;
  }

  $: errorRanges = getErrorRanges();
  $: highlightedSegments = buildHighlightedSegments(selectedContent, errorRanges);
</script>

<div class="multi-file-editor">
  <div class="tabs-bar">
    {#each Object.entries(files) as [fileId, fileData]}
      <button
        class="tab-btn"
        class:active={selectedFileId === fileId}
        on:click={() => handleFileSelect(fileId)}
        disabled={disabled}
      >
        <span class="tab-name">{fileData.name}</span>
        {#if fileStatuses[fileId] && fileStatuses[fileId] !== FILE_STATUS.UNCOMPILED}
          <span 
            class="status-dot"
            style="background: {getStatusBadge(fileId).color}"
            title={getStatusBadge(fileId).text}
          />
        {/if}
        {#if lastCompiledSnapshots[fileId] !== undefined}
          <button
            class="diff-btn {hasChanges(fileId) ? 'has-changes' : ''}"
            on:click={(e) => toggleDiff(fileId, e)}
            title={hasChanges(fileId) ? '查看变更差异' : '无变更'}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        {/if}
        {#if compileErrors[fileId]?.length > 0}
          <span class="error-count">{compileErrors[fileId].length}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if selectedFileId && files[selectedFileId]}
    <div class="editor-container" on:mousemove={handleMouseMove} on:mouseleave={handleMouseLeave}>
      <div class="file-info">
        <span class="file-label">📄 {files[selectedFileId].name}</span>
        <div class="file-info-right">
          {#if showDiffView && diffFileId === selectedFileId}
            <button class="close-diff-btn" on:click={closeDiff}>
              ✕ 关闭对比
            </button>
          {/if}
          <span 
            class="status-badge"
            style="background: {getStatusBadge(selectedFileId).bgColor}; color: {getStatusBadge(selectedFileId).color};"
          >
            {getStatusBadge(selectedFileId).text}
          </span>
        </div>
      </div>

      {#if showDiffView && diffFileId === selectedFileId}
        <div class="diff-view">
          <div class="diff-header">
            <span class="diff-title">
              🔍 变更差异对比
              <span class="diff-subtitle">（左侧：上次编译快照 · 右侧：当前内容）</span>
            </span>
          </div>
          <div class="diff-content">
            <div class="diff-panel diff-old">
              <div class="diff-panel-header">上次编译</div>
              <div class="diff-lines">
                {#each diffLines as line, idx}
                  {#if line.type === 'same' || line.type === 'deleted' || line.type === 'modified'}
                    <div 
                      class="diff-line diff-line-old 
                        {line.type === 'deleted' ? 'line-deleted' : ''} 
                        {line.type === 'modified' ? 'line-modified' : ''}"
                    >
                      <span class="diff-line-num">{line.oldLine || ''}</span>
                      <pre class="diff-line-content">{line.type === 'modified' ? line.oldContent : line.content}</pre>
                    </div>
                  {:else}
                    <div class="diff-line diff-line-empty">
                      <span class="diff-line-num"></span>
                      <pre class="diff-line-content"></pre>
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
            <div class="diff-divider"></div>
            <div class="diff-panel diff-new">
              <div class="diff-panel-header">当前编辑</div>
              <div class="diff-lines">
                {#each diffLines as line, idx}
                  {#if line.type === 'same' || line.type === 'added' || line.type === 'modified'}
                    <div 
                      class="diff-line diff-line-new 
                        {line.type === 'added' ? 'line-added' : ''} 
                        {line.type === 'modified' ? 'line-modified' : ''}"
                    >
                      <span class="diff-line-num">{line.newLine || ''}</span>
                      <pre class="diff-line-content">{line.type === 'modified' ? line.newContent : line.content}</pre>
                    </div>
                  {:else}
                    <div class="diff-line diff-line-empty">
                      <span class="diff-line-num"></span>
                      <pre class="diff-line-content"></pre>
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          </div>
          <div class="diff-legend">
            <span class="legend-item"><span class="legend-color legend-added"></span>新增行</span>
            <span class="legend-item"><span class="legend-color legend-deleted"></span>删除行</span>
            <span class="legend-item"><span class="legend-color legend-modified"></span>修改行</span>
          </div>
        </div>
      {:else}
        <div class="code-editor">
          <div class="line-numbers">
            {#each lineNumbers as n}
              <div class="line-number">{n}</div>
            {/each}
          </div>

          <div class="editor-area">
            <div class="code-highlight-layer">
              <pre><code>{#each highlightedSegments as seg}
<span class="{seg.classes}">{seg.text}</span>{/each}</code></pre>
            </div>

            <textarea
              bind:this={editorRef}
              value={selectedContent}
              spellcheck="false"
              on:input={handleInput}
              class="code-textarea"
              disabled={disabled}
            />

            {#if tooltipVisible}
              <div class="error-tooltip" style="left: {tooltipX}px; top: {tooltipY}px;">
                {tooltipMessage}
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <div class="editor-tips">
        <span class="tip">💡 import 格式: <code>import {'{'} func1, func2 {'}'} from filename</code> · 修改文件后节点变为橙色，依赖它的文件变为黄色</span>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p>请选择一个文件进行编辑</p>
    </div>
  {/if}
</div>

<style>
  .multi-file-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .tabs-bar {
    display: flex;
    gap: 2px;
    padding: 8px 8px 0 8px;
    background: var(--color-surface-alt);
    border-radius: 8px 8px 0 0;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--color-border);
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 6px 6px 0 0;
    transition: all 0.15s;
    position: relative;
    margin-bottom: -1px;
  }

  .tab-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.5);
    color: var(--color-text);
  }

  .tab-btn.active {
    background: var(--color-surface);
    color: var(--color-primary);
    border: 1px solid var(--color-border);
    border-bottom-color: var(--color-surface);
  }

  .tab-name {
    font-family: 'Monaco', 'Menlo', monospace;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  .diff-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.15s;
  }

  .diff-btn:hover {
    background: rgba(99, 102, 241, 0.1);
    color: #6366f1;
  }

  .diff-btn.has-changes {
    color: #f97316;
    animation: diffGlow 1.5s ease-in-out infinite;
  }

  .diff-btn.has-changes:hover {
    background: rgba(249, 115, 22, 0.1);
    color: #f97316;
  }

  @keyframes diffGlow {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .error-count {
    background: var(--color-danger);
    color: white;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 10px;
    font-weight: 600;
  }

  .editor-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-top: none;
    border-radius: 0 0 8px 8px;
    min-height: 0;
    overflow: hidden;
  }

  .file-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--color-surface-alt);
    border-bottom: 1px solid var(--color-border);
  }

  .file-info-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .file-label {
    font-size: 12px;
    color: var(--color-text-muted);
    font-family: 'Monaco', 'Menlo', monospace;
  }

  .close-diff-btn {
    padding: 4px 10px;
    font-size: 11px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-surface);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .close-diff-btn:hover {
    background: var(--color-danger);
    color: white;
    border-color: var(--color-danger);
  }

  .status-badge {
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 12px;
    font-weight: 600;
  }

  .code-editor {
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }

  .line-numbers {
    flex-shrink: 0;
    background: var(--color-surface-alt);
    border-right: 1px solid var(--color-border);
    padding: 8px 10px;
    text-align: right;
    user-select: none;
    color: var(--color-text-muted);
    font-size: 12px;
    line-height: 1.6;
    min-width: 40px;
    overflow-y: auto;
  }

  .line-number {
    font-family: 'Monaco', 'Menlo', monospace;
  }

  .editor-area {
    flex: 1;
    position: relative;
    min-width: 0;
  }

  .code-highlight-layer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 8px 10px;
    pointer-events: none;
    overflow: hidden;
    z-index: 1;
  }

  .code-highlight-layer pre {
    margin: 0;
    padding: 0;
    background: transparent;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre;
    word-wrap: normal;
    overflow: visible;
    color: transparent;
  }

  .code-highlight-layer code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  .code-textarea {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 0;
    background: transparent;
    color: #0f172a;
    font-size: 13px;
    line-height: 1.6;
    resize: none;
    outline: none;
    z-index: 3;
    caret-color: #4f46e5;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  .code-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .code-textarea:focus {
    box-shadow: none;
    border-color: transparent;
  }

  .has-error {
    position: relative;
  }

  .error-squiggle {
    text-decoration: underline;
    text-decoration-color: #ef4444;
    text-decoration-style: wavy;
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
  }

  .error-tooltip {
    position: absolute;
    background: #1e293b;
    color: white;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 100;
    pointer-events: none;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    max-width: 320px;
    white-space: normal;
    border: 1px solid #334155;
  }

  .error-tooltip::before {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 10px;
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid #1e293b;
  }

  .diff-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .diff-header {
    padding: 10px 16px;
    background: rgba(99, 102, 241, 0.06);
    border-bottom: 1px solid var(--color-border);
  }

  .diff-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text);
  }

  .diff-subtitle {
    font-size: 11px;
    font-weight: 400;
    color: var(--color-text-muted);
  }

  .diff-content {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
  }

  .diff-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .diff-panel-header {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    background: var(--color-surface-alt);
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-muted);
  }

  .diff-old .diff-panel-header {
    border-right: 1px solid var(--color-border);
  }

  .diff-lines {
    flex: 1;
    overflow-y: auto;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 12px;
    line-height: 1.6;
  }

  .diff-line {
    display: flex;
    align-items: stretch;
    min-height: 20px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  }

  .diff-line-num {
    flex-shrink: 0;
    width: 40px;
    padding: 0 8px;
    text-align: right;
    color: var(--color-text-muted);
    background: var(--color-surface-alt);
    border-right: 1px solid var(--color-border);
    user-select: none;
    font-size: 11px;
  }

  .diff-line-content {
    flex: 1;
    margin: 0;
    padding: 0 10px;
    white-space: pre;
    overflow-x: auto;
    color: #0f172a;
  }

  .diff-line-empty {
    background: var(--color-surface-alt);
    opacity: 0.5;
  }

  .diff-line-old.line-deleted .diff-line-content {
    background: rgba(239, 68, 68, 0.12);
  }

  .diff-line-old.line-deleted {
    background: rgba(239, 68, 68, 0.08);
  }

  .diff-line-new.line-added .diff-line-content {
    background: rgba(16, 185, 129, 0.12);
  }

  .diff-line-new.line-added {
    background: rgba(16, 185, 129, 0.08);
  }

  .diff-line-old.line-modified .diff-line-content {
    background: rgba(249, 115, 22, 0.12);
  }

  .diff-line-old.line-modified {
    background: rgba(249, 115, 22, 0.08);
  }

  .diff-line-new.line-modified .diff-line-content {
    background: rgba(59, 130, 246, 0.12);
  }

  .diff-line-new.line-modified {
    background: rgba(59, 130, 246, 0.08);
  }

  .diff-divider {
    width: 1px;
    background: var(--color-border);
    flex-shrink: 0;
  }

  .diff-legend {
    display: flex;
    gap: 16px;
    padding: 8px 16px;
    background: var(--color-surface-alt);
    border-top: 1px solid var(--color-border);
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .diff-legend .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-color {
    width: 16px;
    height: 12px;
    border-radius: 2px;
  }

  .legend-added {
    background: rgba(16, 185, 129, 0.4);
  }

  .legend-deleted {
    background: rgba(239, 68, 68, 0.4);
  }

  .legend-modified {
    background: linear-gradient(90deg, rgba(249, 115, 22, 0.4) 0%, rgba(59, 130, 246, 0.4) 100%);
  }

  .editor-tips {
    padding: 8px 12px;
    background: rgba(79, 70, 229, 0.04);
    border-top: 1px solid var(--color-border);
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .tip code {
    background: var(--color-surface-alt);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 10px;
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    font-size: 14px;
  }
</style>
