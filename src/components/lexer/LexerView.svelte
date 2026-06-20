<script>
  import { onMount } from 'svelte';
  import { tokenize, DEFAULT_RULES, TOKEN_TYPES, createLexerStepper, stepLexer } from '../../lib/lexer/index.js';
  import { DEFAULT_CODE_SAMPLES } from '../../data/examples.js';
  
  let sourceCode = DEFAULT_CODE_SAMPLES.simple;
  let tokens = [];
  let defaultTokens = [];
  let highlightRanges = [];
  let rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
  let showRules = false;
  let showCompare = false;
  
  let stepper = null;
  let stepPos = 0;
  let isStepping = false;
  let currentChar = '';
  let lastToken = null;
  let stepTokens = [];
  
  const tokenColors = {
    '关键字': '#ede9fe',
    '标识符': '#e0f2fe',
    '数字字面量': '#fee2e2',
    '运算符': '#d1fae5',
    '分隔符': '#f1f5f9',
    '字符串': '#fef3c7',
    'ERROR': '#fecaca'
  };
  
  const tokenTextColors = {
    '关键字': '#7c3aed',
    '标识符': '#0369a1',
    '数字字面量': '#dc2626',
    '运算符': '#059669',
    '分隔符': '#6b7280',
    '字符串': '#d97706',
    'ERROR': '#dc2626'
  };
  
  function analyze() {
    try {
      tokens = tokenize(sourceCode, rules);
      defaultTokens = tokenize(sourceCode, DEFAULT_RULES);
      highlightRanges = tokens.map(t => ({
        start: t.start,
        end: t.end,
        type: t.type,
        color: tokenColors[t.type] || '#f1f5f9'
      }));
      lastToken = null;
    } catch (e) {
      console.error(e);
    }
  }
  
  function tokensEqual(t1, t2) {
    if (!t1 || !t2) return false;
    return t1.type === t2.type && t1.value === t2.value;
  }
  
  function isTokenDifferent(idx, side) {
    if (side === 'default') {
      if (idx >= defaultTokens.length) return true;
      if (idx >= tokens.length) return true;
      return !tokensEqual(defaultTokens[idx], tokens[idx]);
    } else {
      if (idx >= tokens.length) return true;
      if (idx >= defaultTokens.length) return true;
      return !tokensEqual(tokens[idx], defaultTokens[idx]);
    }
  }
  
  function hasDifferences() {
    if (defaultTokens.length !== tokens.length) return true;
    for (let i = 0; i < defaultTokens.length; i++) {
      if (!tokensEqual(defaultTokens[i], tokens[i])) return true;
    }
    return false;
  }
  
  function startStepping() {
    stepper = createLexerStepper(sourceCode, rules);
    stepPos = 0;
    isStepping = true;
    stepTokens = [];
    lastToken = null;
    currentChar = sourceCode[0] || '';
  }
  
  function stepForward() {
    if (!stepper) return;
    if (stepPos >= sourceCode.length) return;
    
    const before = stepper.lastToken;
    stepper = stepLexer(stepper);
    stepPos = stepper.pos;
    
    if (stepper.lastToken && (!before || before.value !== stepper.lastToken.value)) {
      stepTokens.push(stepper.lastToken);
      lastToken = stepper.lastToken;
    }
    
    currentChar = sourceCode[stepPos] || '';
  }
  
  function stopStepping() {
    isStepping = false;
    stepper = null;
  }
  
  function addRule() {
    rules = [...rules, { regex: '', type: '标识符', label: '新规则' }];
    analyze();
  }
  
  function removeRule(idx) {
    rules = rules.filter((_, i) => i !== idx);
    analyze();
  }
  
  function updateRule(idx, field, value) {
    rules = rules.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    analyze();
  }
  
  function resetRules() {
    rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
    analyze();
  }
  
  onMount(() => {
    analyze();
  });
</script>

<div class="view-container">
  <div class="header">
    <h2>词法分析器</h2>
    <div class="actions">
      {#if !isStepping}
        <button class="primary" on:click={analyze}>开始分析</button>
        <button on:click={startStepping}>步进模式</button>
      {:else}
        <button on:click={stepForward} disabled={stepPos >= sourceCode.length}>前进一步 →</button>
        <button class="danger" on:click={stopStepping}>退出步进</button>
      {/if}
      <button on:click={() => showRules = !showRules}>
        {showRules ? '隐藏规则' : '自定义规则'}
      </button>
      <button on:click={() => showCompare = !showCompare} class:active={showCompare}>
        {showCompare ? '关闭对比' : '对比模式'}
      </button>
    </div>
  </div>
  
  <div class="content">
    <div class="left-panel">
      <div class="panel">
        <div class="panel-title">
          <h3>源代码</h3>
          <select on:change={(e) => sourceCode = DEFAULT_CODE_SAMPLES[e.target.value]}>
            <option value="simple">简单C代码</option>
            <option value="expression">算术表达式</option>
            <option value="json_style">JSON风格</option>
          </select>
        </div>
        <textarea 
          bind:value={sourceCode}
          class="code-editor"
          spellcheck="false"
          rows="18"
        />
        
        {#if isStepping}
          <div class="stepper-info">
            <div class="step-status">
              <span>位置: {stepPos}/{sourceCode.length}</span>
              <span>当前字符: <code>{currentChar || '(无)'}</code></span>
              {#if lastToken}
                <span>最近Token: 
                  <span class="badge badge-{tokenTextColors[lastToken.type] ? lastToken.type.toLowerCase().replace(/\s/g, '-') : ''}">
                    {lastToken.type} "{lastToken.value}"
                  </span>
                </span>
              {/if}
            </div>
            
            <div class="dfa-states">
              <h4>当前DFA状态</h4>
              <div class="state-list">
                {#each stepper?.states || [] as state}
                  <div class="state-item" class:inactive={!state.isActive}>
                    <span class="state-type">{state.type}</span>
                    <span class="state-lexeme">"{state.currentLexeme}"</span>
                    {#if state.acceptState}<span class="state-accept">✓可接受</span>{/if}
                    {#if !state.isActive}<span class="state-inactive">✗失活</span>{/if}
                  </div>
                {/each}
              </div>
            </div>
            
            {#if stepTokens.length > 0}
              <div class="step-tokens">
                <h4>已识别Token</h4>
                <div class="tokens-inline">
                  {#each stepTokens as t, i}
                    <span class="badge badge-{t.type.toLowerCase().replace(/\s/g, '-')}">
                      {t.value}
                    </span>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
      
      {#if showRules}
        <div class="panel">
          <div class="panel-title">
            <h3>词法规则 (正则 → Token类型)</h3>
            <div class="rule-actions">
              <button on:click={resetRules}>重置规则</button>
              <button class="primary" on:click={addRule}>+ 添加规则</button>
            </div>
          </div>
          <div class="rules-list">
            {#each rules as rule, idx}
              <div class="rule-item">
                <input 
                  type="text" 
                  value={rule.regex} 
                  placeholder="正则表达式"
                  on:input={(e) => updateRule(idx, 'regex', e.target.value)}
                />
                <select value={rule.type} on:change={(e) => updateRule(idx, 'type', e.target.value)}>
                  {#each Object.values(TOKEN_TYPES) as tt}
                    <option value={tt}>{tt}</option>
                  {/each}
                </select>
                <input 
                  type="text" 
                  value={rule.label} 
                  placeholder="标签"
                  on:input={(e) => updateRule(idx, 'label', e.target.value)}
                />
                <button class="danger" on:click={() => removeRule(idx)}>删除</button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
    
    <div class="right-panel">
      {#if !showCompare}
        <div class="panel">
          <div class="panel-title">
            <h3>Token序列 ({tokens.length})</h3>
          </div>
          <div class="token-list">
            {#if tokens.length === 0}
              <p class="muted">点击"开始分析"生成Token序列</p>
            {:else}
              {#each tokens as token}
                <div class="token-row" style="background: {tokenColors[token.type]}">
                  <span class="badge badge-{token.type.toLowerCase().replace(/\s/g, '-')}">{token.type}</span>
                  <code class="token-value">{token.value}</code>
                  <span class="token-pos">L{token.line}:C{token.column}</span>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {:else}
        <div class="panel">
          <div class="panel-title">
            <h3>Token对比 - 默认规则 vs 自定义规则</h3>
            {#if hasDifferences()}
              <span class="badge badge-string" style="background:#fef9c3;color:#854d0e">
                检测到差异
              </span>
            {:else}
              <span class="muted">当前无差异，请修改左侧自定义规则</span>
            {/if}
          </div>
          <div class="compare-container">
            <div class="compare-column">
              <div class="compare-header">默认规则 ({defaultTokens.length})</div>
              <div class="token-list">
                {#if defaultTokens.length === 0}
                  <p class="muted">无数据</p>
                {:else}
                  {#each defaultTokens as token, idx}
                    <div class="token-row" 
                         style="background: {isTokenDifferent(idx, 'default') ? '#fef9c3' : tokenColors[token.type]}">
                      <span class="badge badge-{token.type.toLowerCase().replace(/\s/g, '-')}">{token.type}</span>
                      <code class="token-value">{token.value}</code>
                      <span class="token-pos">L{token.line}:C{token.column}</span>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
            <div class="compare-column">
              <div class="compare-header">自定义规则 ({tokens.length})</div>
              <div class="token-list">
                {#if tokens.length === 0}
                  <p class="muted">无数据</p>
                {:else}
                  {#each tokens as token, idx}
                    <div class="token-row" 
                         style="background: {isTokenDifferent(idx, 'custom') ? '#fef9c3' : tokenColors[token.type]}">
                      <span class="badge badge-{token.type.toLowerCase().replace(/\s/g, '-')}">{token.type}</span>
                      <code class="token-value">{token.value}</code>
                      <span class="token-pos">L{token.line}:C{token.column}</span>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}
      
      <div class="panel">
        <div class="panel-title">
          <h3>源码高亮</h3>
        </div>
        <div class="highlighted-code">
          <pre>{#each highlightCode(sourceCode, highlightRanges, tokenTextColors) as segment}
<span style="background: {segment.bg}; color: {segment.color}; padding: 1px 2px; border-radius: 2px;">{segment.text}</span>{/each}</pre>
        </div>
      </div>
    </div>
  </div>
</div>

<script context="module">
  export function highlightCode(code, ranges, textColors) {
    const segments = [];
    let lastEnd = 0;
    
    for (const range of ranges) {
      if (range.start > lastEnd) {
        segments.push({ text: code.substring(lastEnd, range.start), bg: 'transparent', color: '#334155' });
      }
      segments.push({ 
        text: code.substring(range.start, range.end), 
        bg: range.color,
        color: textColors[range.type] || '#334155'
      });
      lastEnd = range.end;
    }
    
    if (lastEnd < code.length) {
      segments.push({ text: code.substring(lastEnd), bg: 'transparent', color: '#334155' });
    }
    
    if (segments.length === 0) {
      segments.push({ text: code, bg: 'transparent', color: '#334155' });
    }
    
    return segments;
  }
</script>

<style>
  .view-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .actions {
    display: flex;
    gap: 8px;
  }
  
  .content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    flex: 1;
    overflow: hidden;
  }
  
  .left-panel, .right-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
  }
  
  .code-editor {
    width: 100%;
    font-size: 13px;
    line-height: 1.6;
    resize: vertical;
    min-height: 200px;
  }
  
  .stepper-info {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
  }
  
  .step-status {
    display: flex;
    gap: 20px;
    margin-bottom: 16px;
    font-size: 13px;
  }
  
  .step-status code {
    background: var(--color-surface-alt);
    padding: 2px 6px;
    border-radius: 4px;
  }
  
  .dfa-states h4, .step-tokens h4 {
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--color-text-muted);
  }
  
  .state-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }
  
  .state-item {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 6px 10px;
    background: var(--color-surface-alt);
    border-radius: 4px;
    font-size: 12px;
  }
  
  .state-item.inactive {
    opacity: 0.5;
  }
  
  .state-type {
    font-weight: 600;
    color: var(--color-primary);
  }
  
  .state-lexeme {
    font-family: monospace;
    background: white;
    padding: 1px 6px;
    border-radius: 3px;
  }
  
  .state-accept {
    color: var(--color-success);
    font-size: 11px;
  }
  
  .state-inactive {
    color: var(--color-danger);
    font-size: 11px;
  }
  
  .tokens-inline {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .rules-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .rule-actions {
    display: flex;
    gap: 8px;
  }
  
  .rule-item {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .rule-item input {
    flex: 1;
    min-width: 0;
  }
  
  .token-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .token-row {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 8px 12px;
    border-radius: 6px;
  }
  
  .token-value {
    flex: 1;
    font-weight: 600;
  }
  
  .token-pos {
    font-size: 11px;
    color: var(--color-text-muted);
  }
  
  .highlighted-code pre {
    margin: 0;
    padding: 12px;
    background: var(--color-surface-alt);
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
  
  .muted {
    color: var(--color-text-muted);
    font-size: 13px;
  }
  
  .compare-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  
  .compare-column {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  
  .compare-header {
    font-weight: 600;
    font-size: 13px;
    padding: 8px 12px;
    background: var(--color-surface-alt);
    border-radius: 6px 6px 0 0;
    border-bottom: 1px solid var(--color-border);
  }
  
  .compare-column .token-list {
    max-height: 400px;
    border: 1px solid var(--color-border);
    border-top: none;
    border-radius: 0 0 6px 6px;
  }
</style>
