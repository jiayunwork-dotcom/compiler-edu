<script>
  import { onMount } from 'svelte';
  import { parseGrammar, computeFirst, computeFollow, buildLL1Table, simulateLL1, getStartSymbol } from '../../lib/parser/grammar.js';
  import { buildLR1Items, buildLR1Table, simulateLR1 } from '../../lib/parser/lr1.js';
  import { EXAMPLE_GRAMMARS } from '../../data/examples.js';
  import SyntaxTreeView from './SyntaxTreeView.svelte';
  import { buildCSTFromLL1History, buildCSTFromLR1History, buildAST } from '../../lib/tree/syntaxTree.js';
  
  let grammarText = EXAMPLE_GRAMMARS.arithmetic_ll1.grammar;
  let testInput = 'id + id * id';
  let parserType = 'auto';
  let result = null;
  let cstRoot = null;
  let astRoot = null;
  let treeType = 'cst';
  
  function parse() {
    try {
      const productions = parseGrammar(grammarText);
      
      if (parserType === 'll1' || parserType === 'auto') {
        try {
          const first = computeFirst(productions);
          const follow = computeFollow(productions, first.computeFirstString);
          const table = buildLL1Table(productions, first.first, follow.follow);
          
          if (table.conflicts.length === 0 || parserType === 'll1') {
            const sim = simulateLL1(testInput, productions, table.table, first.first);
            result = { type: 'LL(1)', ...sim, table };
            
            if (sim.accepted && sim.history.length > 0) {
              cstRoot = buildCSTFromLL1History(sim.history, getStartSymbol(productions));
              astRoot = buildAST(cstRoot);
            }
            return;
          }
        } catch (e) {
          if (parserType === 'll1') throw e;
        }
      }
      
      if (parserType === 'lr1' || parserType === 'auto') {
        const items = buildLR1Items(productions);
        const table = buildLR1Table(items.states, items.gotos, items.augmented, items.originalStart);
        const sim = simulateLR1(testInput, table, items.augmented);
        
        result = { type: 'LR(1)', ...sim, conflicts: table.conflicts };
        
        if (sim.accepted && sim.history.length > 0) {
          cstRoot = buildCSTFromLR1History(sim.history, items.originalStart);
          astRoot = buildAST(cstRoot);
        }
      }
    } catch (e) {
      console.error(e);
      alert('解析失败: ' + e.message);
    }
  }
  
  onMount(() => {
    parse();
  });
</script>

<div class="view-container">
  <div class="header">
    <h2>语法分析测试</h2>
    <div class="actions">
      <select bind:value={parserType}>
        <option value="auto">自动选择</option>
        <option value="ll1">LL(1) 分析</option>
        <option value="lr1">LR(1) 分析</option>
      </select>
      <button on:click={parse} class="primary">开始分析</button>
    </div>
  </div>
  
  <div class="top-row">
    <div class="panel">
      <div class="panel-title">
        <h3>文法 (BNF格式)</h3>
        <select on:change={(e) => grammarText = EXAMPLE_GRAMMARS[e.target.value].grammar}>
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
        <h3>测试输入</h3>
      </div>
      <input bind:value={testInput} class="full-width" placeholder="符号用空格分隔" />
      {#if result}
        <div class="result-box {result.accepted ? 'success' : 'error'}">
          <div class="result-header">
            <strong>{result.type}</strong>
            <span class="result-status">{result.accepted ? '✓ 成功' : '✗ 失败'}</span>
          </div>
          {#if !result.accepted}
            <div class="result-error">{result.error}</div>
          {/if}
          {#if result.conflicts?.length > 0}
            <div class="result-warning">⚠ 检测到 {result.conflicts.length} 个分析冲突</div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
  
  {#if result?.accepted && cstRoot}
    <div class="panel">
      <div class="panel-title">
        <h3>语法树</h3>
        <div class="view-toggle">
          <button on:click={() => treeType = 'cst'} class:active={treeType === 'cst'}>具体语法树 (CST)</button>
          <button on:click={() => treeType = 'ast'} class:active={treeType === 'ast'}>抽象语法树 (AST)</button>
        </div>
      </div>
      <div class="tree-compare">
        <div class="tree-section">
          <h4>{treeType === 'cst' ? '具体语法树 (CST)' : '抽象语法树 (AST)'}</h4>
          <p class="desc">
            {treeType === 'cst' 
              ? '包含所有文法符号，完整反映推导过程' 
              : '去除辅助符号和ε，只保留语义相关的结构'}
          </p>
          <SyntaxTreeView root={treeType === 'cst' ? cstRoot : astRoot} />
        </div>
      </div>
    </div>
  {/if}
  
  {#if result?.steps?.length > 0}
    <div class="panel">
      <div class="panel-title">
        <h3>分析步骤 ({result.steps.length})</h3>
      </div>
      <div class="steps-list">
        {#each result.steps as step, i}
          <div class="step-row">
            <span class="step-num">{i + 1}</span>
            <div class="step-content">
              <div class="step-action">{step.action}</div>
              {#if step.stack}
                <div class="step-detail">
                  栈: <code>{step.stack.join(' ')}</code> | 
                  输入: <code>{step.input.join(' ')}</code>
                </div>
              {:else}
                <div class="step-detail">
                  状态: <code>[{step.stateStack?.join(',')}]</code> |
                  符号: <code>{step.symbolStack?.join(' ')}</code> |
                  输入: <code>{step.input.join(' ')}</code>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
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
  }
  
  .full-width {
    width: 100%;
    font-size: 14px;
    padding: 10px;
  }
  
  .result-box {
    margin-top: 12px;
    padding: 14px;
    border-radius: 6px;
  }
  
  .result-box.success {
    background: #dcfce7;
    border: 1px solid #86efac;
  }
  
  .result-box.error {
    background: #fee2e2;
    border: 1px solid #fca5a5;
  }
  
  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  
  .result-status {
    font-weight: 600;
  }
  
  .success .result-status { color: #166534; }
  .error .result-status { color: #991b1b; }
  
  .result-error {
    font-size: 12px;
    color: #7f1d1d;
  }
  
  .result-warning {
    margin-top: 6px;
    padding: 6px 10px;
    background: #fef3c7;
    color: #92400e;
    border-radius: 4px;
    font-size: 12px;
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
  
  .tree-compare {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .tree-section h4 {
    margin-bottom: 4px;
  }
  
  .desc {
    color: var(--color-text-muted);
    font-size: 12px;
    margin-bottom: 12px;
  }
  
  .steps-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 400px;
    overflow-y: auto;
  }
  
  .step-row {
    display: flex;
    gap: 12px;
    padding: 8px 12px;
    background: var(--color-surface-alt);
    border-radius: 6px;
    align-items: flex-start;
  }
  
  .step-num {
    width: 28px;
    height: 28px;
    background: var(--color-primary);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 12px;
    flex-shrink: 0;
  }
  
  .step-action {
    font-weight: 600;
    margin-bottom: 4px;
  }
  
  .step-detail {
    font-size: 11px;
    color: var(--color-text-muted);
  }
  
  .step-detail code {
    background: white;
    padding: 1px 5px;
    border-radius: 3px;
  }
</style>
