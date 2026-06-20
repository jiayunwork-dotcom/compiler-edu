<script>
  import { onMount } from 'svelte';
  import { parseGrammar, grammarToString, computeFirst, computeFollow } from '../../lib/parser/grammar.js';
  import { 
    eliminateLeftRecursion, 
    leftFactor, 
    removeUselessSymbols, 
    detectLeftRecursion,
    checkLL1Conflicts
  } from '../../lib/parser/grammarTools.js';
  import { EXAMPLE_GRAMMARS } from '../../data/examples.js';
  
  let grammarText = EXAMPLE_GRAMMARS.arithmetic.grammar;
  let productions = [];
  let detectionResult = null;
  let transformResult = null;
  let currentTool = 'detect';
  let conflictResult = null;
  
  function parse() {
    productions = parseGrammar(grammarText);
  }
  
  function detect() {
    parse();
    detectionResult = detectLeftRecursion(productions);
    currentTool = 'detect';
  }
  
  function eliminate() {
    parse();
    transformResult = eliminateLeftRecursion(productions);
    currentTool = 'eliminate';
  }
  
  function factor() {
    parse();
    transformResult = leftFactor(productions);
    currentTool = 'factor';
  }
  
  function removeUseless() {
    parse();
    transformResult = removeUselessSymbols(productions);
    currentTool = 'useless';
  }
  
  function checkConflicts() {
    parse();
    conflictResult = checkLL1Conflicts(productions);
    currentTool = 'conflicts';
  }
  
  function applyTransform() {
    if (transformResult) {
      grammarText = grammarToString(transformResult.productions);
    }
  }
  
  function setExample(key) {
    grammarText = EXAMPLE_GRAMMARS[key].grammar;
  }
  
  onMount(() => {
    detect();
  });
</script>

<div class="view-container">
  <div class="header">
    <h2>文法辅助工具</h2>
    <div class="actions">
      <button on:click={detect}>检测左递归</button>
      <button on:click={eliminate} class="primary">消除左递归</button>
      <button on:click={factor}>提取左因子</button>
      <button on:click={removeUseless}>删除无用符号</button>
      <button on:click={checkConflicts}>检查LL(1)冲突</button>
    </div>
  </div>
  
  <div class="top-section">
    <div class="panel">
      <div class="panel-title">
        <h3>输入文法</h3>
        <select on:change={(e) => setExample(e.target.value)}>
          <option value="">选择示例...</option>
          {#each Object.entries(EXAMPLE_GRAMMARS) as [key, g]}
            <option value={key}>{g.name}</option>
          {/each}
        </select>
      </div>
      <textarea bind:value={grammarText} class="grammar-editor" rows="10" />
    </div>
    
    {#if currentTool === 'detect' && detectionResult}
      <div class="panel">
        <div class="panel-title">
          <h3>左递归检测结果</h3>
        </div>
        {#if detectionResult.direct.length === 0 && detectionResult.indirect.length === 0}
          <div class="result-success">✓ 未检测到左递归</div>
        {:else}
          {#if detectionResult.direct.length > 0}
            <h4>直接左递归 ({detectionResult.direct.length}):</h4>
            {#each detectionResult.direct as p}
              <div class="bad-production">
                <code>{p.head} → {p.body.join(' ') || 'ε'}</code>
              </div>
            {/each}
          {/if}
          
          {#if detectionResult.indirect.length > 0}
            <h4 style="margin-top: 12px;">间接左递归环路:</h4>
            {#each detectionResult.indirect as cycle}
              <div class="bad-production">
                <code>{cycle.join(' ⇒ ... ⇒ ')}</code>
              </div>
            {/each}
          {/if}
        {/if}
      </div>
    {/if}
    
    {#if currentTool === 'conflicts' && conflictResult}
      <div class="panel">
        <div class="panel-title">
          <h3>LL(1) 冲突检测</h3>
        </div>
        {#if conflictResult.conflicts.length === 0}
          <div class="result-success">✓ 无LL(1)冲突，该文法满足LL(1)条件</div>
        {:else}
          {#each conflictResult.conflicts as c}
            <div class="conflict-detail">
              <div class="conflict-title">
                <strong>{c.type === 'first_intersection' ? 'First集相交' : 'First/Follow冲突'}</strong>
                在 <code>{c.nonTerminal}</code>
              </div>
              <div class="conflict-prods">
                {#each c.productions as p}
                  <code>{p.head} → {p.body.join(' ') || 'ε'}</code>
                {/each}
              </div>
              <div class="conflict-symbols">
                冲突符号: {'{' + c.symbols.join(', ') + '}'}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    {/if}
    
    {#if (currentTool === 'eliminate' || currentTool === 'factor' || currentTool === 'useless') && transformResult}
      <div class="panel">
        <div class="panel-title">
          <h3>变换结果</h3>
          <button class="primary" on:click={applyTransform}>应用到输入</button>
        </div>
        <div class="step-walker">
          {#each transformResult.steps as step}
            <div class="step-block">
              {#if step.type === 'original'}
                <h4>原始文法:</h4>
              {:else if step.type === 'eliminate_direct'}
                <h4>消除直接左递归: {step.symbol}</h4>
                <div class="step-desc">
                  递归: {#each step.recursive as r} <code>{r}</code> {/each}
                </div>
              {:else if step.type === 'substitute'}
                <h4>代入: {step.Ai} ← {step.Aj}</h4>
              {:else if step.type === 'factor'}
                <h4>提取左因子: {step.symbol}</h4>
                <div class="step-desc">公共前缀: <code>{step.prefix}</code></div>
              {:else if step.type === 'generating'}
                <h4>可产生符号:</h4>
                <div class="step-desc">{'{' + step.symbols.join(', ') + '}'}</div>
              {:else if step.type === 'reachable'}
                <h4>可达符号:</h4>
                <div class="step-desc">{'{' + step.symbols.join(', ') + '}'}</div>
              {:else if step.type === 'complete'}
                <h4>✓ 最终结果:</h4>
              {/if}
              <pre class="grammar-preview">{step.grammar}</pre>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
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
    flex-wrap: wrap;
    gap: 10px;
  }
  
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  .top-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  
  .grammar-editor {
    width: 100%;
    font-size: 13px;
    line-height: 1.8;
    font-family: monospace;
  }
  
  .result-success {
    padding: 16px;
    background: #dcfce7;
    color: #166534;
    border-radius: 6px;
    font-weight: 600;
    text-align: center;
  }
  
  .bad-production {
    padding: 8px 12px;
    background: #fee2e2;
    border-left: 3px solid #ef4444;
    border-radius: 4px;
    margin-bottom: 6px;
  }
  
  .bad-production code {
    font-weight: 600;
  }
  
  .conflict-detail {
    padding: 12px;
    background: #fef3c7;
    border-left: 3px solid #f59e0b;
    border-radius: 6px;
    margin-bottom: 10px;
  }
  
  .conflict-title {
    margin-bottom: 6px;
  }
  
  .conflict-prods {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 6px 0;
  }
  
  .conflict-prods code {
    background: white;
    padding: 4px 8px;
    border-radius: 4px;
  }
  
  .conflict-symbols {
    font-size: 12px;
    color: #92400e;
  }
  
  .step-walker {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 500px;
    overflow-y: auto;
  }
  
  .step-block {
    padding: 12px;
    background: var(--color-surface-alt);
    border-radius: 6px;
  }
  
  .step-block h4 {
    margin-bottom: 8px;
    font-size: 13px;
  }
  
  .step-desc {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-bottom: 6px;
  }
  
  .grammar-preview {
    margin: 0;
    padding: 10px 12px;
    background: white;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.8;
  }
</style>
