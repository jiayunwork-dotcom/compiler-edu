<script>
  import { onMount } from 'svelte';
  import { parseGrammar, grammarToString } from '../../lib/parser/grammar.js';
  import { buildLR1Items, buildLR1Table, simulateLR1 } from '../../lib/parser/lr1.js';
  import { EXAMPLE_GRAMMARS } from '../../data/examples.js';
  import SyntaxTreeView from '../tree/SyntaxTreeView.svelte';
  import { buildCSTFromLR1History, buildAST } from '../../lib/tree/syntaxTree.js';
  
  let grammarText = EXAMPLE_GRAMMARS.arithmetic.grammar;
  let testInput = 'id + id * id';
  
  let productions = [];
  let itemsResult = null;
  let tableResult = null;
  let simResult = null;
  let simStep = 0;
  let showItemSteps = false;
  let selectedState = 0;
  let showTree = false;
  let treeType = 'cst';
  let cstRoot = null;
  let astRoot = null;
  
  function analyze() {
    try {
      productions = parseGrammar(grammarText);
      itemsResult = buildLR1Items(productions);
      tableResult = buildLR1Table(
        itemsResult.states, 
        itemsResult.gotos, 
        itemsResult.augmented,
        itemsResult.originalStart
      );
      simResult = null;
      simStep = 0;
      selectedState = 0;
      showTree = false;
    } catch (e) {
      console.error(e);
      alert('分析失败: ' + e.message);
    }
  }
  
  function runSimulation() {
    if (!tableResult) analyze();
    try {
      simResult = simulateLR1(testInput, tableResult, itemsResult.augmented);
      simStep = 0;
      
      if (simResult.accepted && simResult.history.length > 0) {
        cstRoot = buildCSTFromLR1History(simResult.history, itemsResult.originalStart);
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
  
  function itemToStr(item) {
    const body = [...item.body];
    body.splice(item.dot, 0, '·');
    return `${item.head} → ${body.join(' ')} , [${item.lookahead.join('/')}]`;
  }
  
  function getSuggestion(conflict) {
    if (conflict.type === 'shift-reduce') {
      return '建议: 使用优先级声明，或改写文法提升运算符优先级';
    } else if (conflict.type === 'reduce-reduce') {
      return '建议: 检查文法是否有二义性，提取左因子或消除左递归';
    }
    return '建议: 检查文法设计';
  }
  
  onMount(() => {
    analyze();
  });
</script>

<div class="view-container">
  <div class="header">
    <h2>LR(1) 语法分析器</h2>
    <div class="actions">
      <button on:click={analyze} class="primary">构建项集</button>
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
      <textarea bind:value={grammarText} class="grammar-editor" rows="7" />
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
      
      {#if tableResult?.conflicts?.length > 0}
        <div class="conflict-list">
          <h4 style="margin: 12px 0 8px; font-size: 13px; color: #dc2626;">
            检测到 {tableResult.conflicts.length} 个分析冲突
          </h4>
          {#each tableResult.conflicts as c}
            <div class="conflict-item">
              <div><strong>状态 {c.state}</strong> 遇到 <code>{c.terminal}</code>: {c.type} 冲突</div>
              <div class="conflict-suggestion">{getSuggestion(c)}</div>
              <div class="conflict-entries">
                {#each c.entries as e}
                  <span class="badge {e.type === 'shift' ? 'badge-identifier' : 'badge-operator'}">
                    {e.type === 'shift' ? `移入 S${e.target}` : 
                     e.type === 'reduce' ? `归约: ${e.head}→${e.body.join(' ')||'ε'}` :
                     '接受'}
                  </span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  
  <div class="panel">
    <div class="panel-title">
      <h3>LR(1) 项集族 ({itemsResult?.states.length || 0} 个状态)</h3>
      <button on:click={() => showItemSteps = !showItemSteps}>
        {showItemSteps ? '隐藏构建步骤' : '显示构建步骤'}
      </button>
    </div>
    
    <div class="states-row">
      <div class="state-selector">
        {#each itemsResult?.states || [] as state, idx}
          <button 
            class:selected={selectedState === idx}
            on:click={() => selectedState = idx}
          >
            I{idx}
          </button>
        {/each}
      </div>
      
      <div class="state-content">
        <h4>I{selectedState}:</h4>
        {#each itemsResult?.states?.[selectedState] || [] as item}
          <div class="lr-item">
            {itemToStr(item)}
          </div>
        {/each}
        
        {#if itemsResult?.gotos?.[selectedState]}
          <div class="goto-section">
            <h5>GOTO转移:</h5>
            {#each Object.entries(itemsResult.gotos[selectedState]) as [sym, target]}
              <span class="badge badge-identifier">
                GOTO(I{selectedState}, {sym}) = I{target}
              </span>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
  
  <div class="panel">
    <div class="panel-title">
      <h3>Action-Goto 分析表</h3>
    </div>
    <div class="table-scroll">
      {#if tableResult}
        <table class="lr-table">
          <thead>
            <tr>
              <th rowspan="2">状态</th>
              <th colspan={tableResult.terminals.length}>Action</th>
              <th colspan={tableResult.nonTerminals.filter(n => n !== itemsResult?.start).length}>Goto</th>
            </tr>
            <tr>
              {#each tableResult.terminals as t}
                <th>{t}</th>
              {/each}
              {#each tableResult.nonTerminals.filter(n => n !== itemsResult?.start) as nt}
                <th>{nt}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each itemsResult?.states || [] as state, idx}
              <tr>
                <td><strong>{idx}</strong></td>
                {#each tableResult.terminals as t}
                  {@const entries = tableResult.action[idx]?.[t] || []}
                  <td 
                    class:shift={entries.some(e => e.type === 'shift') && entries.length === 1}
                    class:reduce={entries.some(e => e.type === 'reduce') && entries.length === 1}
                    class:accept={entries.some(e => e.type === 'accept')}
                    class:conflict={entries.length > 1}
                  >
                    {#each entries as e, ei}
                      {e.type === 'shift' ? `S${e.target}` :
                       e.type === 'reduce' ? `R${e.production}` :
                       e.type === 'accept' ? 'acc' : ''}
                      {#if ei < entries.length - 1}<br />{/if}
                    {/each}
                  </td>
                {/each}
                {#each tableResult.nonTerminals.filter(n => n !== itemsResult?.start) as nt}
                  <td>{tableResult.goTo[idx]?.[nt] ?? ''}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
    <div class="legend">
      <span class="legend-item"><span class="legend-box shift"></span> 移入</span>
      <span class="legend-item"><span class="legend-box reduce"></span> 归约</span>
      <span class="legend-item"><span class="legend-box accept"></span> 接受</span>
      <span class="legend-item"><span class="legend-box conflict"></span> 冲突</span>
    </div>
  </div>
  
  {#if simResult}
    <div class="panel">
      <div class="panel-title">
        <h3>LR(1) 分析过程</h3>
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
              <th>状态栈</th>
              <th>符号栈</th>
              <th>剩余输入</th>
              <th>动作</th>
            </tr>
          </thead>
          <tbody>
            {#each simResult.steps.slice(0, simStep + 1) as step, i}
              <tr class:current={i === simStep}>
                <td>{i + 1}</td>
                <td><code>[{step.stateStack.join(',')}]</code></td>
                <td><code>{step.symbolStack.join(' ')}</code></td>
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
  
  .top-row {
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
  
  .sim-result.success { background: #dcfce7; color: #166534; }
  .sim-result.error { background: #fee2e2; color: #991b1b; }
  
  .conflict-list { display: flex; flex-direction: column; gap: 8px; }
  
  .conflict-item {
    padding: 10px 12px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    font-size: 12px;
  }
  
  .conflict-suggestion {
    margin-top: 4px;
    color: #92400e;
    font-size: 11px;
  }
  
  .conflict-entries {
    margin-top: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .states-row {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 16px;
  }
  
  .state-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-content: flex-start;
    max-width: 200px;
  }
  
  .state-selector button {
    padding: 6px 10px;
    font-size: 12px;
    font-family: monospace;
  }
  
  .state-selector button.selected {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
  
  .state-content h4 { margin-bottom: 10px; }
  
  .lr-item {
    padding: 6px 10px;
    background: var(--color-surface-alt);
    border-radius: 4px;
    margin-bottom: 4px;
    font-family: monospace;
    font-size: 12px;
  }
  
  .goto-section {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--color-border);
  }
  
  .goto-section h5 { margin-bottom: 6px; font-size: 12px; }
  
  .table-scroll { overflow-x: auto; }
  
  .lr-table {
    font-size: 11px;
    min-width: 100%;
  }
  
  .lr-table th, .lr-table td {
    padding: 4px 6px;
    min-width: 50px;
    text-align: center;
  }
  
  .lr-table td.shift { background: #dbeafe; }
  .lr-table td.reduce { background: #dcfce7; }
  .lr-table td.accept { background: #fef3c7; font-weight: 600; }
  .lr-table td.conflict { background: #fee2e2; color: #dc2626; font-weight: 600; }
  
  .legend {
    margin-top: 12px;
    display: flex;
    gap: 16px;
    font-size: 12px;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .legend-box {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    border: 1px solid var(--color-border);
  }
  
  .legend-box.shift { background: #dbeafe; }
  .legend-box.reduce { background: #dcfce7; }
  .legend-box.accept { background: #fef3c7; }
  .legend-box.conflict { background: #fee2e2; }
  
  .step-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
  }
  
  .simulation-table { overflow-x: auto; }
  
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
    font-size: 11px;
  }
  
  .view-toggle { display: flex; gap: 6px; }
  
  .view-toggle button.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
</style>
