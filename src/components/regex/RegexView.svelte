<script>
  import { onMount } from 'svelte';
  import { buildNFAWithSteps } from '../../lib/automata/regexToNFA.js';
  import { nfaToDFA } from '../../lib/automata/nfaToDFA.js';
  import { minimizeDFA } from '../../lib/automata/minimizeDFA.js';
  import { getAllStates } from '../../lib/automata/utils.js';
  import AutomatonGraph from '../common/AutomatonGraph.svelte';
  
  let regex = '(a|b)*abb';
  let phase = 'nfa';
  let nfaResult = null;
  let dfaResult = null;
  let minResult = null;
  let stepIndex = 0;
  let nfaStepIndex = 0;
  let dfaStepIndex = 0;
  let minStepIndex = 0;
  
  function convert() {
    try {
      nfaResult = buildNFAWithSteps(regex);
      stepIndex = 0;
      nfaStepIndex = 0;
      dfaResult = null;
      minResult = null;
      phase = 'nfa';
    } catch (e) {
      console.error('NFA构建失败:', e);
      alert('正则表达式解析失败，请检查语法');
    }
  }
  
  function goToDFA() {
    if (!nfaResult) return;
    dfaResult = nfaToDFA(nfaResult.nfa);
    dfaStepIndex = 0;
    phase = 'dfa';
  }
  
  function goToMinimize() {
    if (!dfaResult) return;
    minResult = minimizeDFA(dfaResult.dfa);
    minStepIndex = 0;
    phase = 'min';
  }
  
  function getCurrentStates() {
    if (phase === 'nfa' && nfaResult) {
      const step = nfaResult.steps[Math.min(nfaStepIndex, nfaResult.steps.length - 1)];
      if (step.nfa) return getAllStates(step.nfa.start);
      return getAllStates(nfaResult.nfa.start);
    }
    if (phase === 'dfa' && dfaResult) {
      return getAllStates(dfaResult.dfa);
    }
    if (phase === 'min' && minResult) {
      return getAllStates(minResult.dfa);
    }
    return new Set();
  }
  
  function getStartState() {
    if (phase === 'nfa' && nfaResult) {
      const step = nfaResult.steps[Math.min(nfaStepIndex, nfaResult.steps.length - 1)];
      if (step.nfa) return step.nfa.start;
      return nfaResult.nfa.start;
    }
    if (phase === 'dfa' && dfaResult) return dfaResult.dfa;
    if (phase === 'min' && minResult) return minResult.dfa;
    return null;
  }
  
  onMount(() => {
    convert();
  });
</script>

<div class="view-container">
  <div class="header">
    <h2>正则 → 自动机转换</h2>
    <div class="actions">
      <button on:click={convert} class="primary">构建NFA</button>
      <button on:click={goToDFA} disabled={!nfaResult}>NFA → DFA</button>
      <button on:click={goToMinimize} disabled={!dfaResult}>DFA最小化</button>
    </div>
  </div>
  
  <div class="input-row">
    <input 
      type="text" 
      bind:value={regex}
      placeholder="输入正则表达式，如 (a|b)*abb"
      class="regex-input"
    />
  </div>
  
  <div class="phase-tabs">
    <button class:active={phase === 'nfa'} on:click={() => phase = 'nfa'} disabled={!nfaResult}>
      ① NFA (Thompson构造)
    </button>
    <button class:active={phase === 'dfa'} on:click={() => phase = 'dfa'} disabled={!dfaResult}>
      ② DFA (子集构造)
    </button>
    <button class:active={phase === 'min'} on:click={() => phase = 'min'} disabled={!minResult}>
      ③ 最小化DFA
    </button>
  </div>
  
  <div class="main-content">
    <div class="graph-panel">
      <AutomatonGraph 
        states={[...getCurrentStates()]}
        startState={getStartState()}
        title={phase === 'nfa' ? 'NFA状态转移图' : phase === 'dfa' ? 'DFA状态转移图' : '最小化DFA'}
      />
    </div>
    
    <div class="side-panel">
      {#if phase === 'nfa' && nfaResult}
        <div class="panel">
          <div class="panel-title">
            <h3>Thompson构造步骤</h3>
            <div class="step-controls">
              <button on:click={() => nfaStepIndex = Math.max(0, nfaStepIndex - 1)} disabled={nfaStepIndex <= 0}>← 上一步</button>
              <span>{nfaStepIndex + 1}/{nfaResult.steps.length}</span>
              <button on:click={() => nfaStepIndex = Math.min(nfaResult.steps.length - 1, nfaStepIndex + 1)} disabled={nfaStepIndex >= nfaResult.steps.length - 1}>下一步 →</button>
            </div>
          </div>
          <div class="step-content">
            {#each nfaResult.steps.slice(0, nfaStepIndex + 1) as step, i}
              <div class="step-item" class:current={i === nfaStepIndex}>
                {#if step.type === 'postfix'}
                  <strong>后缀表达式:</strong> <code>{step.value}</code>
                {:else if step.type === 'build'}
                  <strong>构建:</strong> 基本NFA片段 <code>{step.op}</code>
                {:else if step.type === 'union'}
                  <strong>选择操作(|):</strong> 合并两个NFA
                {:else if step.type === 'concat'}
                  <strong>连接操作(.):</strong> 串接两个NFA
                {:else if step.type === 'star'}
                  <strong>闭包操作(*):</strong> 添加回边
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
      
      {#if phase === 'dfa' && dfaResult}
        <div class="panel">
          <div class="panel-title">
            <h3>子集构造步骤</h3>
            <div class="step-controls">
              <button on:click={() => dfaStepIndex = Math.max(0, dfaStepIndex - 1)} disabled={dfaStepIndex <= 0}>← 上一步</button>
              <span>{dfaStepIndex + 1}/{dfaResult.steps.length}</span>
              <button on:click={() => dfaStepIndex = Math.min(dfaResult.steps.length - 1, dfaStepIndex + 1)} disabled={dfaStepIndex >= dfaResult.steps.length - 1}>下一步 →</button>
            </div>
          </div>
          <div class="step-content">
            {#each dfaResult.steps.slice(0, dfaStepIndex + 1) as step, i}
              <div class="step-item" class:current={i === dfaStepIndex}>
                {#if step.type === 'alphabet'}
                  <strong>字母表:</strong> {step.value.join(', ')}
                {:else if step.type === 'initial'}
                  <strong>初始状态:</strong> S{step.state.id} = {step.nfaIds}
                  <div class="closure-detail">ε-闭包: {step.closure.join(', ')}</div>
                {:else if step.type === 'process'}
                  <strong>处理状态 S{step.state.id}:</strong>
                  {#each step.transitions as t}
                    <div class="transition-detail">
                      读入 <code>{t.symbol}</code>: 
                      move → {t.moved.join(', ') || '∅'}, 
                      ε-闭包 → {t.closure.join(', ') || '∅'} 
                      → S{t.target.id}
                    </div>
                  {/each}
                {:else if step.type === 'new_state'}
                  <strong>新增状态:</strong> S{step.stateIndex}
                {:else if step.type === 'complete'}
                  <strong>完成:</strong> 共 {step.states.length} 个状态
                {/if}
              </div>
            {/each}
          </div>
          
          <div class="subset-table">
            <h4>子集对应表</h4>
            <table>
              <tr>
                <th>DFA状态</th>
                <th>NFA状态集合</th>
                <th>接受</th>
              </tr>
              {#each dfaResult.states as state, idx}
                <tr>
                  <td><strong>S{state.id}</strong></td>
                  <td>{state.nfaStates ? [...state.nfaStates].map(s => s.id).sort((a,b)=>a-b).join(',') : '-'}</td>
                  <td>{state.isAccepting ? '✓' : ''}</td>
                </tr>
              {/each}
            </table>
          </div>
        </div>
      {/if}
      
      {#if phase === 'min' && minResult}
        <div class="panel">
          <div class="panel-title">
            <h3>Hopcroft最小化步骤</h3>
            <div class="step-controls">
              <button on:click={() => minStepIndex = Math.max(0, minStepIndex - 1)} disabled={minStepIndex <= 0}>← 上一步</button>
              <span>{minStepIndex + 1}/{minResult.steps.length}</span>
              <button on:click={() => minStepIndex = Math.min(minResult.steps.length - 1, minStepIndex + 1)} disabled={minStepIndex >= minResult.steps.length - 1}>下一步 →</button>
            </div>
          </div>
          <div class="step-content">
            {#each minResult.steps.slice(0, minStepIndex + 1) as step, i}
              <div class="step-item" class:current={i === minStepIndex}>
                {#if step.type === 'states'}
                  <strong>所有状态:</strong> {step.value.join(', ')}
                {:else if step.type === 'alphabet'}
                  <strong>字母表:</strong> {step.value.join(', ')}
                {:else if step.type === 'initial_partition'}
                  <strong>初始划分:</strong>
                  {#each step.groups as g, gi}
                    <div class="group">组{gi + 1}: {g.join(', ')}</div>
                  {/each}
                {:else if step.type === 'iteration'}
                  <strong>迭代 {step.iteration}:</strong>
                  {#each step.groups as g, gi}
                    <div class="group">组{gi + 1}: {g.join(', ')}</div>
                  {/each}
                {:else if step.type === 'complete'}
                  <strong>完成最小化!</strong>
                  {#each step.merged as g, gi}
                    <div class="group">S{gi + 1} = {g.join(', ')}</div>
                  {/each}
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .view-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 16px;
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
  
  .input-row {
    display: flex;
    gap: 12px;
  }
  
  .regex-input {
    flex: 1;
    font-size: 14px;
    padding: 10px 14px;
  }
  
  .phase-tabs {
    display: flex;
    gap: 8px;
  }
  
  .phase-tabs button {
    padding: 10px 20px;
    border-radius: 8px 8px 0 0;
    border-bottom: none;
  }
  
  .phase-tabs button.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
  
  .main-content {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 16px;
    flex: 1;
    overflow: hidden;
  }
  
  .graph-panel, .side-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  
  .side-panel {
    gap: 16px;
    overflow-y: auto;
  }
  
  .step-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
  }
  
  .step-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .step-item {
    padding: 10px 12px;
    background: var(--color-surface-alt);
    border-radius: 6px;
    font-size: 12px;
    border-left: 3px solid var(--color-border);
  }
  
  .step-item.current {
    background: #eef2ff;
    border-left-color: var(--color-primary);
  }
  
  .step-item code {
    background: white;
    padding: 1px 6px;
    border-radius: 3px;
  }
  
  .closure-detail, .transition-detail {
    margin-top: 4px;
    padding-left: 12px;
    font-size: 11px;
    color: var(--color-text-muted);
  }
  
  .group {
    padding: 4px 0 4px 12px;
    font-size: 11px;
  }
  
  .subset-table {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
  }
  
  .subset-table h4 {
    margin-bottom: 8px;
    font-size: 13px;
  }
</style>
