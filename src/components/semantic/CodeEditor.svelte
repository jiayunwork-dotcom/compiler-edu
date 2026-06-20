<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  export let value = '';
  export let highlightRanges = [];
  export let errorRanges = [];
  export let inlineTypeAnnotations = new Map();
  export let cursorLine = 1;
  export let cursorColumn = 1;

  const dispatch = createEventDispatcher();

  let textareaRef = null;
  let lineNumbers = [];
  let hoveredError = null;
  let tooltipVisible = false;
  let tooltipX = 0;
  let tooltipY = 0;
  let tooltipMessage = '';

  function handleSelectionChange() {
    if (document.activeElement === textareaRef) {
      updateCursorPosition();
    }
  }

  onMount(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
  });

  onDestroy(() => {
    document.removeEventListener('selectionchange', handleSelectionChange);
  });

  $: {
    const lines = value.split('\n');
    lineNumbers = Array.from({ length: lines.length }, (_, i) => i + 1);
  }

  function handleInput(e) {
    value = e.target.value;
    dispatch('input', value);
    updateCursorPosition();
  }

  function handleKeyDown(e) {
    setTimeout(updateCursorPosition, 0);
  }

  function updateCursorPosition() {
    if (!textareaRef) return;
    const pos = textareaRef.selectionStart;
    const before = value.substring(0, pos);
    const lines = before.split('\n');
    cursorLine = lines.length;
    cursorColumn = lines[lines.length - 1].length + 1;
    dispatch('cursorChange', { line: cursorLine, column: cursorColumn, position: pos });
  }

  function handleKeyUp(e) {
    updateCursorPosition();
  }

  function handleClick(e) {
    updateCursorPosition();
  }

  function handleSelect() {
    updateCursorPosition();
  }

  function handleMouseMove(e) {
    const errors = errorRanges;
    if (!textareaRef || errors.length === 0) {
      tooltipVisible = false;
      return;
    }

    const rect = textareaRef.getBoundingClientRect();
    const textX = e.clientX - rect.left;
    const textY = e.clientY - rect.top;

    const style = window.getComputedStyle(textareaRef);
    const lineHeight = parseFloat(style.lineHeight) || 20.8;
    const paddingTop = parseFloat(style.paddingTop) || 8;
    const paddingLeft = parseFloat(style.paddingLeft) || 10;
    const charWidth = 8;

    const line = Math.floor((textY - paddingTop) / lineHeight) + 1;
    if (line < 1 || line > lineNumbers.length) {
      tooltipVisible = false;
      return;
    }

    const lines = value.split('\n');
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

  export function setCursorPosition(line, column = 1) {
    if (!textareaRef) return;
    const lines = value.split('\n');
    let pos = 0;
    for (let i = 0; i < Math.min(line - 1, lines.length); i++) {
      pos += lines[i].length + 1;
    }
    pos += Math.min(column - 1, (lines[line - 1] || '').length);
    textareaRef.focus();
    textareaRef.setSelectionRange(pos, pos);
    textareaRef.scrollTop = Math.max(0, (line - 5) * 20);
    updateCursorPosition();
  }

  export function selectRange(start, end) {
    if (!textareaRef) return;
    textareaRef.focus();
    textareaRef.setSelectionRange(start, end);
    const before = value.substring(0, start);
    const line = before.split('\n').length;
    textareaRef.scrollTop = Math.max(0, (line - 5) * 20);
  }

  export function focusAndSelect(start, end, targetLine) {
    if (!textareaRef) return;
    textareaRef.focus();
    requestAnimationFrame(() => {
      if (!textareaRef) return;
      textareaRef.setSelectionRange(start, end);
      const scrollLine = targetLine > 0 ? targetLine : (value.substring(0, start).split('\n').length);
      textareaRef.scrollTop = Math.max(0, (scrollLine - 3) * 20);
      updateCursorPosition();
    });
  }

  function isPositionInRanges(pos, ranges) {
    return ranges.some(r => pos >= r.start && pos < r.end);
  }

  function getClassForPos(pos) {
    const classes = [];
    for (const r of highlightRanges) {
      if (pos >= r.start && pos < r.end) {
        classes.push(`hl-${r.kind || 'default'}`);
        if (r.id) classes.push(`hlid-${r.id}`);
      }
    }
    for (const r of errorRanges) {
      if (pos >= r.start && pos < r.end) {
        classes.push('has-error');
        if (r.severity === 'warning') classes.push('warning-squiggle');
        else classes.push('error-squiggle');
      }
    }
    return classes.join(' ');
  }

  function buildHighlightedSegments(source, hlRanges, errRanges) {
    if ((!hlRanges || hlRanges.length === 0) &&
        (!errRanges || errRanges.length === 0)) {
      return [{ text: source, classes: '' }];
    }

    const allRanges = [
      ...(hlRanges || []).map(r => ({ ...r, type: 'hl' })),
      ...(errRanges || []).map(r => ({ ...r, type: 'err' }))
    ];

    const events = [];
    for (const r of allRanges) {
      events.push({ pos: r.start, type: 'start', range: r });
      events.push({ pos: r.end, type: 'end', range: r });
    }
    events.sort((a, b) => a.pos - b.pos);

    const segments = [];
    let currentPos = 0;
    const activeHL = new Set();
    const activeErr = new Set();

    for (const ev of events) {
      if (ev.pos > currentPos) {
        const classes = [];
        for (const r of activeHL) {
          classes.push(`hl-${r.kind || 'default'}`);
          if (r.id) classes.push(`hlid-${r.id}`);
        }
        if (activeErr.size > 0) {
          const hasWarning = [...activeErr].some(r => r.severity === 'warning');
          classes.push('has-error');
          classes.push(hasWarning ? 'warning-squiggle' : 'error-squiggle');
        }
        segments.push({
          text: source.substring(currentPos, ev.pos),
          classes: classes.join(' ')
        });
        currentPos = ev.pos;
      }
      if (ev.type === 'start') {
        if (ev.range.type === 'hl') activeHL.add(ev.range);
        else activeErr.add(ev.range);
      } else {
        if (ev.range.type === 'hl') activeHL.delete(ev.range);
        else activeErr.delete(ev.range);
      }
    }

    if (currentPos < source.length) {
      const classes = [];
      for (const r of activeHL) {
        classes.push(`hl-${r.kind || 'default'}`);
        if (r.id) classes.push(`hlid-${r.id}`);
      }
      if (activeErr.size > 0) {
        const hasWarning = [...activeErr].some(r => r.severity === 'warning');
        classes.push('has-error');
        classes.push(hasWarning ? 'warning-squiggle' : 'error-squiggle');
      }
      segments.push({
        text: source.substring(currentPos),
        classes: classes.join(' ')
      });
    }

    return segments;
  }

  function getLineAnnotation(lineNum) {
    const anns = inlineTypeAnnotations.get(lineNum);
    if (!anns || anns.length === 0) return null;
    var annList = anns;
    const parts = [];
    for (const ann of annList) {
      if (ann.kind === 'variable' || ann.kind === 'parameter') {
        parts.push(`${ann.name}: ${ann.type}`);
      } else if (ann.kind === 'call') {
        parts.push(`${ann.name}()→${ann.type}`);
      }
    }
    if (parts.length === 0) return null;
    return '// : ' + parts.join(' | ');
  }

  $: highlightedSegments = buildHighlightedSegments(value, highlightRanges, errorRanges);
  $: displayLines = buildDisplayLines(value, highlightedSegments, inlineTypeAnnotations);

  function buildDisplayLines(source, segments, annotations) {
    const lines = source.split('\n');
    const result = [];
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      result.push({
        lineNum,
        content: lines[i],
        annotation: getLineAnnotation(lineNum)
      });
    }
    return result;
  }
</script>

<div class="code-editor-container" on:mousemove={handleMouseMove} on:mouseleave={handleMouseLeave}>
  <div class="line-numbers">
    {#each lineNumbers as n}
      <div class="line-number" class:active-line={n === cursorLine}>{n}</div>
    {/each}
  </div>

  <div class="editor-area">
    <div class="code-highlight-layer">
      <pre><code>{#each highlightedSegments as seg}
<span class="{seg.classes}">{seg.text}</span>{/each}</code></pre>
    </div>

    <div class="inline-annotations-layer">
      <pre class="annotations-pre"><code>{#each displayLines as dl}
<span class="annotation-line">
  <span class="annotation-content-spacer">{dl.content || '\u00A0'}</span>
  {#if dl.annotation}
    <span class="inline-type-annotation">{dl.annotation}</span>
  {/if}
</span>{/each}</code></pre>
    </div>

    <textarea
      bind:this={textareaRef}
      bind:value={value}
      spellcheck="false"
      on:input={handleInput}
      on:keydown={handleKeyDown}
      on:keyup={handleKeyUp}
      on:click={handleClick}
      on:select={handleSelect}
      class="code-textarea"
    />

    {#if tooltipVisible}
      <div class="error-tooltip" style="left: {tooltipX}px; top: {tooltipY}px;">
        {tooltipMessage}
      </div>
    {/if}
  </div>
</div>

<style>
  .code-editor-container {
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 200px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    overflow: hidden;
    background: white;
    position: relative;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
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
  }

  .line-number.active-line {
    color: var(--color-primary);
    font-weight: 600;
    background: rgba(79, 70, 229, 0.08);
    margin: 0 -10px;
    padding: 0 10px;
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

  .inline-annotations-layer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 8px 10px;
    pointer-events: none;
    overflow: hidden;
    z-index: 2;
  }

  .annotations-pre {
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

  .annotations-pre code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    display: block;
  }

  .annotation-line {
    display: block;
    position: relative;
    white-space: pre;
  }

  .annotation-content-spacer {
    visibility: hidden;
    white-space: pre;
  }

  .inline-type-annotation {
    display: inline-block;
    padding-left: 12px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 500;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-style: normal;
    visibility: visible !important;
    opacity: 0.9;
    letter-spacing: 0.1px;
    white-space: nowrap;
    position: absolute;
    left: 100%;
    top: 0;
  }

  .inline-type-annotation:hover {
    color: #64748b;
    opacity: 1;
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
  }

  .code-textarea:focus {
    box-shadow: none;
    border-color: transparent;
  }

  .hl-default {
    background: rgba(79, 70, 229, 0.18);
    border-radius: 2px;
    padding: 0 1px;
  }

  .hl-declaration {
    background: rgba(16, 185, 129, 0.25);
    border-bottom: 2px solid #10b981;
    border-radius: 2px;
    padding: 0 1px;
  }

  .hl-reference {
    background: rgba(14, 165, 233, 0.22);
    border-radius: 2px;
    padding: 0 1px;
  }

  .hl-visible {
    background: rgba(251, 191, 36, 0.2);
    border-radius: 2px;
    padding: 0 1px;
  }

  .hl-error-related {
    background: rgba(239, 68, 68, 0.15);
    border-radius: 2px;
    padding: 0 1px;
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

  .warning-squiggle {
    text-decoration: underline;
    text-decoration-color: #f59e0b;
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
</style>
