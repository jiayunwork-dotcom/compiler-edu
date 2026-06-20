<script>
  import { onMount } from 'svelte';
  import { buildNFAWithSteps } from '../../lib/automata/regexToNFA.js';
  import { nfaToDFA } from '../../lib/automata/nfaToDFA.js';
  import { minimizeDFA } from '../../lib/automata/minimizeDFA.js';
  import { getAllStates, epsilonClosure, move, EPSILON } from '../../lib/automata/utils.js';
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
  
  let testString = '';
  let simStep = 0;
  let simulating = false;
  let simActiveStates = [];
  let simHighlightedStates = new Set();
  let simHighlightedEdges = new Set();
  let simAccepted = null;
  let simHistory = [];
  let simError = null;
  
  $: currentStates = (() => {
    if (phase === 'nfa' && nfaResult) {
      const step = nfaResult.steps[Math.min(nfaStepIndex, nfaResult.steps.length - 1)];
      if (step.nfa) return [...getAllStates(step.nfa.start)];
      return [...getAllStates(nfaResult.nfa.start)];
    }
    if (phase === 'dfa' && dfaResult) {
      return [...getAllStates(dfaResult.dfa)];
    }
    if (phase === 'min' && minResult) {
      return [...getAllStates(minResult.dfa)];
    }
    return [];
  })();
  
  $: currentStartState = (() => {
    if (phase === 'nfa' && nfaResult) {
      const step = nfaResult.steps[Math.min(nfaStepIndex, nfaResult.steps.length - 1)];
      if (step.nfa) return step.nfa.start;
      return nfaResult.nfa.start;
    }
    if (phase === 'dfa' && dfaResult) return dfaResult.dfa;
    if (phase === 'min' && minResult) return minResult.dfa;
    return null;
  })();
  
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
  
  function computeCurrentStates() {
    if (phase === 'nfa' && nfaResult) {
      const step = nfaResult.steps[Math.min(nfaStepIndex, nfaResult.steps.length - 1)];
      if (step.nfa) return [...getAllStates(step.nfa.start)];
      return [...getAllStates(nfaResult.nfa.start)];
    }
    if (phase === 'dfa' && dfaResult) {
      return [...getAllStates(dfaResult.dfa)];
    }
    if (phase === 'min' && minResult) {
      return [...getAllStates(minResult.dfa)];
    }
    return [];
  }
  
  function computeStartState() {
    if (phase === 'nfa' && nfaResult) {
      const step = nfaResult.steps[Math.min(nfaStepIndex, nfaResult.steps.length - 1)];
      if (step.nfa) return step.nfa.start;
      return nfaResult.nfa.start;
    }
    if (phase === 'dfa' && dfaResult) return dfaResult.dfa;
    if (phase === 'min' && minResult) return minResult.dfa;
    return null;
  }
  
  function getCurrentAutomatonStart() {
    return computeStartState();
  }
  
  function isNFA() {
    return phase === 'nfa';
  }
  
  function startSimulation() {
    if (!testString) {
      alert('请输入测试字符串');
      return;
    }
    const start = getCurrentAutomatonStart();
    if (!start) {
      alert('请先构建自动机');
      return;
    }
    
    simulating = true;
    simStep = 0;
    simAccepted = null;
    simError = null;
    simHistory = [];
    simHighlightedEdges = new Set();
    
    let initialStates;
    if (isNFA()) {
      initialStates = [...epsilonClosure(new Set([start]))];
    } else {
      initialStates = [start];
    }
    
    simActiveStates = initialStates;
    simHighlightedStates = new Set(initialStates.map(s => s.id));
    simHistory.push({
      step: 0,
      char: '(起始)',
      activeStates: [...simActiveStates],
      isAccepting: simActiveStates.some(s => s.isAccepting)
    });
  }
  
  function stepSimulation() {
    if (!simulating || simAccepted !== null) return;
    if (simStep >= testString.length) {
      simAccepted = simActiveStates.some(s => s.isAccepting);
      return;
    }
    
    const ch = testString[simStep];
    const currentActive = simActiveStates;
    const newHighlightedEdges = new Set(simHighlightedEdges);
    let nextStates = [];
    
    if (isNFA()) {
      const moved = move(new Set(currentActive), ch);
      const closure = epsilonClosure(moved);
      nextStates = [...closure];
      
      for (const from of currentActive) {
        if (from.transitions.has(ch)) {
          for (const to of from.transitions.get(ch)) {
            newHighlightedEdges.add(`${from.id}-${to.id}-${ch}`);
          }
        }
      }
      for (const s of moved) {
        const epsilonReachable = epsilonClosure(new Set([s]));
        for (const from of epsilonReachable) {
          if (from.transitions.has(EPSILON)) {
            for (const to of from.transitions.get(EPSILON)) {
              if (closure.has(to)) {
                newHighlightedEdges.add(`${from.id}-${to.id}-${EPSILON}`);
              }
            }
          }
        }
      }
    } else {
      for (const from of currentActive) {
        if (from.transitions.has(ch)) {
          const targets = [...from.transitions.get(ch)];
          nextStates.push(...targets);
          for (const to of targets) {
            newHighlightedEdges.add(`${from.id}-${to.id}-${ch}`);
          }
        }
      }
    }
    
    simHighlightedEdges = newHighlightedEdges;
    simActiveStates = nextStates;
    simHighlightedStates = new Set(nextStates.map(s => s.id));
    simStep++;
    
    simHistory.push({
      step: simStep,
      char: ch,
      activeStates: [...simActiveStates],
      isAccepting: simActiveStates.some(s => s.isAccepting)
    });
    
    if (simStep >= testString.length) {
      simAccepted = simActiveStates.some(s => s.isAccepting);
    } else if (simActiveStates.length === 0) {
      simAccepted = false;
      simError = `在位置 ${simStep}，字符 "${ch}" 无法继续转移`;
    }
  }
  
  function resetSimulation() {
    simulating = false;
    simStep = 0;
    simActiveStates = [];
    simHighlightedStates = new Set();
    simHighlightedEdges = new Set();
    simAccepted = null;
    simHistory = [];
    simError = null;
  }
  
  function runFullSimulation() {
    if (!simulating) startSimulation();
    while (simulating && simAccepted === null) {
      stepSimulation();
    }
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
  
  <div class="verification-panel">
    <div class="panel-title-small">
      <h3>🔍 反向验证 - 测试字符串匹配</h3>
    </div>
    <div class="verification-controls">
      <input 
        type="text" 
        bind:value={testString}
        placeholder="输入测试字符串，如 aabba"
        class="test-input"
      />
      {#if !simulating}
        <button on:click={startSimulation} class="primary" disabled={!regex || !testString}>开始匹配</button>
      {:else}
        <button on:click={stepSimulation} 
                disabled={simAccepted !== null || simStep >= testString.length}>
          前进一步 →
        </button>
        <button on:click={runFullSimulation} 
                disabled={simAccepted !== null}
                class="primary">全部执行</button>
        <button on:click={resetSimulation} class="danger">重置</button>
      {/if}
    </div>
    
    {#if simulating}
      <div class="simulation-status">
        <div class="sim-progress">
          <span>进度: {simStep}/{testString.length}</span>
          <span class="sim-string">
            {#each testString as ch, i}
              <span class:current={i === simStep - 1} 
                    class:done={i < simStep}
                    class:pending={i >= simStep}>
                {ch}
              </span>
            {/each}
          </span>
        </div>
        
        <div class="sim-active">
          <strong>当前活跃状态{isNFA() ? '集合' : ''}:</strong>
          {#if simActiveStates.length > 0}
            {#each simActiveStates as s}
              <span class="state-badge state-active">
                S{s.id}{s.isAccepting ? ' ✓' : ''}
              </span>
            {/each}
          {:else}
            <span class="state-badge state-empty">∅ (空集合)</span>
          {/if}
        </div>
        
        {#if simAccepted !== null}
          <div class="sim-result {simAccepted ? 'accepted' : 'rejected'}">
            {simAccepted ? '✓ 字符串被接受！' : '✗ 字符串被拒绝'}
            {#if simError}
              <div class="sim-error-detail">{simError}</div>
            {/if}
          </div>
        {/if}
        
        {#if simHistory.length > 0}
          <div class="sim-history">
            <h4>匹配步骤历史:</h4>
            <div class="history-table">
              <div class="history-row history-head">
                <span>步骤</span><span>字符</span><span>活跃状态</span><span>接受</span>
              </div>
              {#each simHistory as h}
                <div class="history-row" class:current={h.step === simStep}>
                  <span>{h.step}</span>
                  <span class="mono">{h.char}</span>
                  <span>{h.activeStates.map(s => 'S' + s.id).join(', ') || '∅'}</span>
                  <span>{h.isAccepting ? '✓' : ''}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
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
        states={currentStates}
        startState={currentStartState}
        title={phase === 'nfa' ? 'NFA状态转移图' : phase === 'dfa' ? 'DFA状态转移图' : '最小化DFA'}
        highlightedStates={simHighlightedStates}
        highlightedEdges={simHighlightedEdges}
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
  
  .verification-panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 14px 16px;
  }
  
  .panel-title-small {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  
  .panel-title-small h3 {
    margin: 0;
    font-size: 14px;
  }
  
  .verification-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .test-input {
    flex: 1;
    font-size: 14px;
    padding: 8px 12px;
  }
  
  .simulation-status {
    border-top: 1px solid var(--color-border);
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .sim-progress {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 13px;
  }
  
  .sim-string {
    display: flex;
    gap: 2px;
    font-family: monospace;
  }
  
  .sim-string span {
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 600;
  }
  
  .sim-string .done {
    background: #dbeafe;
    color: #1d4ed8;
  }
  
  .sim-string .current {
    background: #2563eb;
    color: white;
    animation: pulse 1s infinite;
  }
  
  .sim-string .pending {
    background: #f1f5f9;
    color: #64748b;
  }
  
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
  
  .sim-active {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 13px;
  }
  
  .state-badge {
    padding: 3px 10px;
    border-radius: 12px;
    font-family: monospace;
    font-size: 12px;
    font-weight: 600;
  }
  
  .state-badge.state-active {
    background: #dbeafe;
    color: #1d4ed8;
    border: 1px solid #2563eb;
  }
  
  .state-badge.state-empty {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #dc2626;
  }
  
  .sim-result {
    padding: 10px 14px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 14px;
  }
  
  .sim-result.accepted {
    background: #dcfce7;
    color: #166534;
  }
  
  .sim-result.rejected {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .sim-error-detail {
    margin-top: 4px;
    font-size: 12px;
    font-weight: 400;
    opacity: 0.9;
  }
  
  .sim-history {
    border-top: 1px solid var(--color-border);
    padding-top: 10px;
  }
  
  .sim-history h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    color: var(--color-text-muted);
  }
  
  .history-table {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 180px;
    overflow-y: auto;
    font-size: 11px;
  }
  
  .history-row {
    display: grid;
    grid-template-columns: 40px 50px 1fr 40px;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    align-items: center;
  }
  
  .history-row.history-head {
    background: var(--color-surface-alt);
    font-weight: 600;
    color: var(--color-text-muted);
  }
  
  .history-row.current {
    background: #eef2ff;
    font-weight: 600;
  }
  
  .mono {
    font-family: monospace;
  }
</style>
