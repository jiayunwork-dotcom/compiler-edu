<script>
  import { onMount } from 'svelte';
  import { parseGrammar, grammarToString, computeFirst, computeFollow, buildLL1Table, simulateLL1, getStartSymbol } from '../../lib/parser/grammar.js';
  import { EXAMPLE_GRAMMARS } from '../../data/examples.js';
  import SyntaxTreeView from '../tree/SyntaxTreeView.svelte';
  import { buildCSTFromLL1History, buildAST, layoutTree } from '../../lib/tree/syntaxTree.js';
  
  let grammarText = EXAMPLE_GRAMMARS.arithmetic_ll1.grammar;
  let testInput = 'id + id * id';
  
  let productions = [];
  let firstResult = null;
  let followResult = null;
  let tableResult = null;
  let simResult = null;
  let simStep = 0;
  let showFirstSteps = false;
  let showFollowSteps = false;
  let showTree = false;
  let treeType = 'cst';
  let cstRoot = null;
  let astRoot = null;
  
  let tooltipData = null;
  let tooltipStyle = {};
  
  function getConflictDiagnosis(nt, t) {
    if (!tableResult?.conflicts) return null;
    return tableResult.conflicts.find(c => c.nonTerminal === nt && c.terminal === t);
  }
  
  function showTooltip(event, nt, t) {
    const conflict = getConflictDiagnosis(nt, t);
    if (!conflict) return;
    tooltipData = conflict;
    const rect = event.target.getBoundingClientRect();
    tooltipStyle = {
      left: rect.left + 'px',
      top: (rect.bottom + 8) + 'px'
    };
  }
  
  function hideTooltip() {
    tooltipData = null;
  }
  
  function analyze() {
    try {
      productions = parseGrammar(grammarText);
      firstResult = computeFirst(productions);
      followResult = computeFollow(productions, firstResult.computeFirstString);
      tableResult = buildLL1Table(productions, firstResult.first, followResult.follow);
      simResult = null;
      simStep = 0;
      showTree = false;
    } catch (e) {
      console.error(e);
      alert('文法解析失败: ' + e.message);
    }
  }
  
  function runSimulation() {
    if (!tableResult) analyze();
    try {
      simResult = simulateLL1(testInput, productions, tableResult.table, firstResult.first);
      simStep = 0;
      
      if (simResult.accepted && simResult.history.length > 0) {
        cstRoot = buildCSTFromLL1History(simResult.history, getStartSymbol(productions));
        astRoot = buildAST(cstRoot);
      }
    } catch (e) {
      console.error(e);
    }
  }
  
  function setExample(key) {
    grammarText = EXAMPLE_GRAMMARS[key].grammar;
    analyze();
  }
  
  onMount(() => {
    analyze();
  });
</script>

<div class="view-container">
  <div class="header">
    <h2>LL(1) 语法分析器</h2>
    <div class="actions">
      <button on:click={analyze} class="primary">分析文法</button>
      <button on:click={runSimulation}>运行分析</button>
      <button on:click={() => showTree = !showTree} disabled={!simResult?.accepted}>
        {showTree ? '隐藏语法树' : '显示语法树'}
      </button>
    </div>
  </div>
  
  <div class="top-row">
    <div class="panel">
      <div class="panel-title">
        <h3>文法 (BNF格式)</h3>
        <select on:change={(e) => setExample(e.target.value)}>
          <option value="">选择示例...</option>
          {#each Object.entries(EXAMPLE_GRAMMARS) as [key, g]}
            <option value={key}>{g.name}</option>
          {/each}
        </select>
      </div>
      <textarea bind:value={grammarText} class="grammar-editor" rows="8" />
    </div>
    
    <div class="panel">
      <div class="panel-title">
        <h3>测试输入 (用空格分隔符号)</h3>
      </div>
      <input bind:value={testInput} class="full-width" placeholder="例如: id + id * id" />
      {#if simResult}
        <div class="sim-result {simResult.accepted ? 'success' : 'error'}">
          {simResult.accepted ? '✓ 分析成功！' : '✗ ' + simResult.error}
        </div>
      {/if}
    </div>
  </div>
  
  <div class="sets-row">
    <div class="panel">
      <div class="panel-title">
        <h3>First 集</h3>
        <button on:click={() => showFirstSteps = !showFirstSteps}>
          {showFirstSteps ? '隐藏步骤' : '展开计算过程'}
        </button>
      </div>
      {#if firstResult}
        <div class="sets-grid">
          {#each Object.entries(firstResult.steps[firstResult.steps.length - 1].first) as [sym, set]}
            {#if /[A-Z]/.test(sym[0])}
              <div class="set-item">
                <strong>First({sym})</strong> = {'{' + set.join(', ') + '}'}
              </div>
            {/if}
          {/each}
        </div>
        
        {#if showFirstSteps}
          <div class="steps-detail">
            {#each firstResult.steps as step, i}
              {#if step.type === 'iteration' && step.changes.length > 0}
                <div class="step-block">
                  <strong>迭代 {step.iteration}:</strong>
                  {#each step.changes as c}
                    <div class="change-row">
                      <code>{c.production}</code>
                      {c.before.join(',')} → {c.after.join(',')}
                    </div>
                  {/each}
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      {/if}
    </div>
    
    <div class="panel">
      <div class="panel-title">
        <h3>Follow 集</h3>
        <button on:click={() => showFollowSteps = !showFollowSteps}>
          {showFollowSteps ? '隐藏步骤' : '展开计算过程'}
        </button>
      </div>
      {#if followResult}
        <div class="sets-grid">
          {#each Object.entries(followResult.steps[followResult.steps.length - 1].follow) as [sym, set]}
            <div class="set-item">
              <strong>Follow({sym})</strong> = {'{' + set.join(', ') + '}'}
            </div>
          {/each}
        </div>
        
        {#if showFollowSteps}
          <div class="steps-detail">
            {#each followResult.steps as step, i}
              {#if step.type === 'iteration' && step.changes.length > 0}
                <div class="step-block">
                  <strong>迭代 {step.iteration}:</strong>
                  {#each step.changes as c}
                    <div class="change-row">
                      {c.symbol}: <code>{c.production}</code>
                    </div>
                  {/each}
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </div>
  
  <div class="panel">
    <div class="panel-title">
      <h3>LL(1) 预测分析表</h3>
      {#if tableResult?.conflicts?.length > 0}
        <span class="badge badge-string" style="background:#fee2e2;color:#dc2626">
          {tableResult.conflicts.length} 个冲突
        </span>
      {/if}
    </div>
    
    {#if tableResult}
      <div class="table-scroll">
        <table class="parse-table">
          <thead>
            <tr>
              <th>非终结符</th>
              {#each tableResult.terminals as t}
                <th>{t}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each tableResult.nonTerminals as nt}
              <tr>
                <td><strong>{nt}</strong></td>
                {#each tableResult.terminals as t}
                  {@const entries = tableResult.table[nt][t]}
                  {@const isConflict = entries.length > 1}
                  <td class:conflict={isConflict}
                      on:mouseenter={(e) => isConflict && showTooltip(e, nt, t)}
                      on:mouseleave={hideTooltip}>
                    {#each entries as e, ei}
                      {e.head} → {e.body.length === 0 ? 'ε' : e.body.join(' ')}
                      {#if ei < entries.length - 1}<br />{/if}
                    {/each}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
  
  {#if simResult}
    <div class="panel">
      <div class="panel-title">
        <h3>分析过程模拟</h3>
        <div class="step-controls">
          <button on:click={() => simStep = Math.max(0, simStep - 1)} disabled={simStep <= 0}>← 上一步</button>
          <span>{simStep + 1}/{simResult.steps.length}</span>
          <button on:click={() => simStep = Math.min(simResult.steps.length - 1, simStep + 1)} disabled={simStep >= simResult.steps.length - 1}>下一步 →</button>
        </div>
      </div>
      
      <div class="simulation-table">
        <table>
          <thead>
            <tr>
              <th>步骤</th>
              <th>分析栈 (栈顶→栈底)</th>
              <th>剩余输入</th>
              <th>动作</th>
            </tr>
          </thead>
          <tbody>
            {#each simResult.steps.slice(0, simStep + 1) as step, i}
              <tr class:current={i === simStep}>
                <td>{i + 1}</td>
                <td><code>{step.stack.join(' ')}</code></td>
                <td><code>{step.input.join(' ')}</code></td>
                <td>{step.action}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
  
  {#if showTree && cstRoot}
    <div class="panel">
      <div class="panel-title">
        <h3>语法树</h3>
        <div class="view-toggle">
          <button on:click={() => treeType = 'cst'} class:active={treeType === 'cst'}>具体语法树 (CST)</button>
          <button on:click={() => treeType = 'ast'} class:active={treeType === 'ast'}>抽象语法树 (AST)</button>
        </div>
      </div>
      <SyntaxTreeView root={treeType === 'cst' ? cstRoot : astRoot} />
    </div>
  {/if}
</div>

{#if tooltipData}
  <div class="conflict-tooltip" style={tooltipStyle}>
    <div class="tooltip-header">
      <strong>⚠️ LL(1) 冲突诊断</strong>
    </div>
    <div class="tooltip-section">
      <div class="tooltip-label">冲突位置:</div>
      <div class="tooltip-value">
        非终结符 {tooltipData.nonTerminal} × 终结符 "{tooltipData.terminal}"</div>
    </div>
    <div class="tooltip-section">
      <div class="tooltip-label">冲突类型:</div>
      <div class="tooltip-value conflict-type">{tooltipData.diagnosis.type}</div>
    </div>
    <div class="tooltip-section">
      <div class="tooltip-label">冲突原因:</div>
      <div class="tooltip-value">{tooltipData.diagnosis.reason}</div>
    </div>
    <div class="tooltip-section">
      <div class="tooltip-label">冲突产生式:</div>
      <div class="tooltip-value">
        {#each tooltipData.entries as e}
          <div>· {e.head} → {e.body.length === 0 ? 'ε' : e.body.join(' ')}
            <span class="via-{e.addedVia}">[{e.addedVia === 'first' ? 'First集' : 'Follow集'}]</span>
          </div>
        {/each}
      </div>
    </div>
    <div class="tooltip-section suggestions">
      <div class="tooltip-label">消解建议:</div>
      <div class="tooltip-value">
        {#each tooltipData.diagnosis.suggestions as s}
          <div class="suggestion-line">{s}</div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .view-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    overflow-y: auto;
    padding-bottom: 20px;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .actions {
    display: flex;
    gap: 8px;
  }
  
  .top-row, .sets-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  
  .grammar-editor {
    width: 100%;
    font-size: 13px;
    line-height: 1.8;
    font-family: monospace;
    resize: vertical;
  }
  
  .full-width {
    width: 100%;
    font-size: 14px;
    padding: 10px;
  }
  
  .sim-result {
    margin-top: 12px;
    padding: 10px 14px;
    border-radius: 6px;
    font-weight: 600;
  }
  
  .sim-result.success {
    background: #dcfce7;
    color: #166534;
  }
  
  .sim-result.error {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .sets-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  
  .set-item {
    padding: 8px 10px;
    background: var(--color-surface-alt);
    border-radius: 4px;
    font-size: 12px;
  }
  
  .steps-detail {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .step-block {
    padding: 8px 10px;
    background: #f8fafc;
    border-left: 3px solid var(--color-primary-light);
    border-radius: 4px;
    font-size: 12px;
  }
  
  .change-row {
    padding: 2px 0;
  }
  
  .change-row code {
    background: white;
    padding: 1px 6px;
    border-radius: 3px;
    margin-right: 8px;
  }
  
  .table-scroll {
    overflow-x: auto;
  }
  
  .parse-table {
    font-size: 11px;
    min-width: 100%;
  }
  
  .parse-table td {
    padding: 4px 6px;
    font-size: 11px;
    min-width: 80px;
  }
  
  .parse-table td.conflict {
    background: #fee2e2 !important;
    color: #dc2626;
    font-weight: 600;
  }
  
  .step-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
  }
  
  .simulation-table {
    overflow-x: auto;
  }
  
  .simulation-table table {
    width: 100%;
    font-size: 12px;
  }
  
  .simulation-table tr.current {
    background: #eef2ff;
    font-weight: 600;
  }
  
  .simulation-table code {
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 3px;
  }
  
  .view-toggle {
    display: flex;
    gap: 6px;
  }
  
  .view-toggle button.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
  
  .parse-table td.conflict {
    cursor: help;
    position: relative;
  }
  
  .conflict-tooltip {
    position: fixed;
    z-index: 1000;
    background: white;
    border: 1px solid #dc2626;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    padding: 12px 14px;
    max-width: 420px;
    font-size: 12px;
    line-height: 1.6;
  }
  
  .tooltip-header {
    font-size: 13px;
    color: #dc2626;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #fee2e2;
  }
  
  .tooltip-section {
    margin-bottom: 8px;
  }
  
  .tooltip-section:last-child {
    margin-bottom: 0;
  }
  
  .tooltip-label {
    font-weight: 600;
    color: #374151;
    margin-bottom: 2px;
  }
  
  .tooltip-value {
    color: #1f2937;
    white-space: pre-wrap;
    font-family: monospace;
  }
  
  .conflict-type {
    color: #dc2626;
    font-weight: 600;
  }
  
  .via-first {
    color: #7c3aed;
    font-size: 10px;
    margin-left: 4px;
  }
  
  .via-follow {
    color: #0369a1;
    font-size: 10px;
    margin-left: 4px;
  }
  
  .suggestions .suggestion-line {
    padding: 3px 0;
    border-bottom: 1px solid #f1f5f9;
  }
  
  .suggestions .suggestion-line:last-child {
    border-bottom: none;
  }
</style>
