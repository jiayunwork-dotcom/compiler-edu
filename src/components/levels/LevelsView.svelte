<script>
  import { LEVELS, getLevelsByModule } from '../../data/levels.js';
  import { onMount } from 'svelte';
  import LexerView from '../lexer/LexerView.svelte';
  import RegexView from '../regex/RegexView.svelte';
  import LL1View from '../parser/LL1View.svelte';
  import LR1View from '../parser/LR1View.svelte';
  import ToolsView from '../tools/ToolsView.svelte';
  import TreeView from '../tree/TreeView.svelte';
  
  export let currentView;
  
  let selectedLevel = null;
  let completedLevels = new Set(JSON.parse(localStorage.getItem('completedLevels') || '[]'));
  let showHints = false;
  let currentHintIdx = 0;
  let filterModule = 'all';
  
  function selectLevel(level) {
    selectedLevel = level;
    showHints = false;
    currentHintIdx = 0;
  }
  
  function markComplete() {
    if (!selectedLevel) return;
    const next = new Set(completedLevels);
    next.add(selectedLevel.id);
    completedLevels = next;
    localStorage.setItem('completedLevels', JSON.stringify([...next]));
  }
  
  function nextLevel() {
    if (!selectedLevel) return;
    const idx = LEVELS.findIndex(l => l.id === selectedLevel.id);
    if (idx < LEVELS.length - 1) {
      selectedLevel = LEVELS[idx + 1];
      showHints = false;
      currentHintIdx = 0;
    }
  }
  
  function prevLevel() {
    if (!selectedLevel) return;
    const idx = LEVELS.findIndex(l => l.id === selectedLevel.id);
    if (idx > 0) {
      selectedLevel = LEVELS[idx - 1];
      showHints = false;
      currentHintIdx = 0;
    }
  }
  
  function showNextHint() {
    if (!selectedLevel) return;
    if (currentHintIdx < selectedLevel.hints.length - 1) {
      currentHintIdx++;
    }
    showHints = true;
  }
  
  function filteredLevels() {
    if (filterModule === 'all') return LEVELS;
    return getLevelsByModule(filterModule);
  }
  
  function isUnlocked(level) {
    if (level.id === 1) return true;
    return completedLevels.has(level.id - 1);
  }
  
  const moduleNames = {
    all: '全部模块',
    lexer: '词法分析',
    regex: '正则与自动机',
    ll1: 'LL(1)分析',
    lr1: 'LR(1)分析',
    tools: '文法工具',
    tree: '语法树',
    custom: '综合挑战'
  };
  
  onMount(() => {
    selectedLevel = LEVELS[0];
  });
</script>

<div class="levels-view">
  {#if !selectedLevel}
    <div class="welcome">
      <h2>🎯 编译器前端教学关卡</h2>
      <p class="subtitle">20个递进关卡，从零掌握编译原理核心技术</p>
      
      <div class="progress-bar">
        <div class="progress-fill" style="width: {(completedLevels.size / LEVELS.length * 100)}%"></div>
        <span class="progress-text">{completedLevels.size} / {LEVELS.length} 完成</span>
      </div>
      
      <div class="filter-row">
        <span>筛选模块:</span>
        {#each Object.entries(moduleNames) as [key, name]}
          <button class:active={filterModule === key} on:click={() => filterModule = key}>{name}</button>
        {/each}
      </div>
      
      <div class="level-grid">
        {#each filteredLevels() as level}
          <div 
            class="level-card"
            class:completed={completedLevels.has(level.id)}
            class:locked={!isUnlocked(level)}
            on:click={() => isUnlocked(level) && selectLevel(level)}
          >
            <div class="level-num">{level.id}</div>
            <div class="level-info">
              <h4>{level.title}</h4>
              <p class="level-desc">{level.description}</p>
              <div class="level-tags">
                <span class="badge badge-identifier">{moduleNames[level.module]}</span>
                {#if completedLevels.has(level.id)}
                  <span class="badge badge-operator">✓ 已完成</span>
                {/if}
                {#if !isUnlocked(level)}
                  <span class="badge badge-string">🔒 锁定</span>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="level-detail">
      <div class="level-header">
        <button class="back-btn" on:click={() => selectedLevel = null}>← 返回关卡列表</button>
        <div class="level-nav">
          <button on:click={prevLevel} disabled={selectedLevel.id === 1}>上一关</button>
          <span class="level-title-badge">关卡 {selectedLevel.id}/{LEVELS.length}</span>
          <button on:click={nextLevel} disabled={selectedLevel.id === LEVELS.length}>下一关</button>
        </div>
      </div>
      
      <div class="level-mission panel">
        <div class="mission-header">
          <div>
            <h2>🎯 {selectedLevel.title}</h2>
            <p class="mission-desc">{selectedLevel.description}</p>
          </div>
          <div class="mission-actions">
            {#if !completedLevels.has(selectedLevel.id)}
              <button class="success" on:click={markComplete}>✓ 标记完成</button>
            {:else}
              <span class="completed-badge">✓ 已完成</span>
            {/if}
          </div>
        </div>
        
        <div class="mission-content">
          <div class="task-box">
            <strong>📌 任务目标:</strong>
            <p>{selectedLevel.objective}</p>
          </div>
          <div class="task-box">
            <strong>💡 操作指引:</strong>
            <p>{selectedLevel.task}</p>
          </div>
        </div>
        
        <div class="hints-section">
          <div class="hints-header">
            <strong>❓ 提示系统</strong>
            <button on:click={showNextHint}>显示提示 ({currentHintIdx + (showHints ? 1 : 0)}/{selectedLevel.hints.length})</button>
          </div>
          {#if showHints}
            <div class="hints-list">
              {#each selectedLevel.hints.slice(0, currentHintIdx + 1) as hint, i}
              <div class="hint-item">
                <span class="hint-num">提示{i + 1}</span>
                <span class="hint-text">{hint}</span>
              </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      
      <div class="module-hint">
        💡 本关对应模块: <strong>{moduleNames[selectedLevel.module]}</strong> — 
        点击左侧导航栏切换到对应模块开始练习
      </div>
      
      <div class="quick-nav">
        <button on:click={() => currentView = selectedLevel.module === 'custom' ? 'tree' : selectedLevel.module}>
          跳转到「{moduleNames[selectedLevel.module]}」模块 →
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .levels-view {
    height: 100%;
    overflow-y: auto;
  }
  
  .welcome {
    max-width: 1000px;
    margin: 0 auto;
  }
  
  .welcome h2 {
    margin-bottom: 8px;
  }
  
  .subtitle {
    color: var(--color-text-muted);
    margin-bottom: 24px;
  }
  
  .progress-bar {
    position: relative;
    height: 32px;
    background: var(--color-surface-alt);
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 24px;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
    border-radius: 16px;
    transition: width 0.3s;
  }
  
  .progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-weight: 600;
    font-size: 13px;
    color: var(--color-text);
  }
  
  .filter-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  
  .filter-row button {
    padding: 6px 14px;
    font-size: 12px;
  }
  
  .filter-row button.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
  
  .level-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 14px;
  }
  
  .level-card {
    display: flex;
    gap: 14px;
    padding: 16px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .level-card:hover:not(.locked) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: var(--color-primary-light);
  }
  
  .level-card.completed {
    background: #f0fdf4;
    border-color: #86efac;
  }
  
  .level-card.locked {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .level-num {
    width: 44px;
    height: 44px;
    background: var(--color-primary);
    color: white;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 18px;
    flex-shrink: 0;
  }
  
  .level-card.completed .level-num {
    background: var(--color-success);
  }
  
  .level-info h4 {
    margin-bottom: 4px;
  }
  
  .level-desc {
    color: var(--color-text-muted);
    font-size: 12px;
    margin: 0 0 8px 0;
  }
  
  .level-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  
  .level-detail {
    max-width: 900px;
    margin: 0 auto;
  }
  
  .level-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 10px;
  }
  
  .back-btn {
    padding: 8px 16px;
  }
  
  .level-nav {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .level-title-badge {
    padding: 6px 16px;
    background: var(--color-surface-alt);
    border-radius: 20px;
    font-weight: 600;
    font-size: 13px;
  }
  
  .mission-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  
  .mission-header h2 {
    margin-bottom: 6px;
  }
  
  .mission-desc {
    color: var(--color-text-muted);
    margin: 0;
  }
  
  .completed-badge {
    padding: 8px 16px;
    background: #dcfce7;
    color: #166534;
    border-radius: 6px;
    font-weight: 600;
    font-size: 13px;
  }
  
  .mission-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }
  
  .task-box {
    padding: 12px 14px;
    background: var(--color-surface-alt);
    border-radius: 6px;
    font-size: 13px;
  }
  
  .task-box strong {
    display: block;
    margin-bottom: 4px;
  }
  
  .task-box p {
    margin: 0;
    color: var(--color-text-muted);
  }
  
  .hints-section {
    padding: 14px;
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 8px;
  }
  
  .hints-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  
  .hints-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .hint-item {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  
  .hint-num {
    padding: 3px 10px;
    background: white;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    color: #92400e;
    flex-shrink: 0;
  }
  
  .hint-text {
    font-size: 13px;
    color: #78350f;
  }
  
  .module-hint {
    margin: 16px 0;
    padding: 12px 16px;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 6px;
    font-size: 13px;
  }
  
  .quick-nav {
    text-align: center;
  }
  
  .quick-nav button {
    padding: 12px 28px;
    font-size: 14px;
    font-weight: 600;
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
  
  .quick-nav button:hover {
    background: #4338ca;
  }
</style>
