<script>
  import { onMount } from 'svelte';
  import LexerView from './components/lexer/LexerView.svelte';
  import RegexView from './components/regex/RegexView.svelte';
  import LL1View from './components/parser/LL1View.svelte';
  import LR1View from './components/parser/LR1View.svelte';
  import ToolsView from './components/tools/ToolsView.svelte';
  import TreeView from './components/tree/TreeView.svelte';
  import LevelsView from './components/levels/LevelsView.svelte';
  import SemanticView from './components/semantic/SemanticView.svelte';
  import IncrementalView from './components/incremental/IncrementalView.svelte';
  import Sidebar from './components/layout/Sidebar.svelte';
  
  let currentView = 'lexer';
  
  const modules = [
    { id: 'lexer', name: '词法分析', icon: '🔤', description: 'DFA识别、Token生成、步进模式' },
    { id: 'regex', name: '正则转自动机', icon: '🌀', description: 'Thompson构造、子集构造、DFA最小化' },
    { id: 'll1', name: 'LL(1)分析', icon: '📋', description: 'First/Follow集、预测表、栈模拟' },
    { id: 'lr1', name: 'LR(1)分析', icon: '📊', description: '项集族、Action-Goto表、分析过程' },
    { id: 'semantic', name: '语义分析', icon: '🎯', description: '符号表、类型检查、作用域可视化' },
    { id: 'incremental', name: '增量编译分析', icon: '⚡', description: '依赖图、增量重编译、缓存策略' },
    { id: 'tools', name: '文法工具', icon: '🔧', description: '左递归消除、左因子、无用符号' },
    { id: 'tree', name: '语法树', icon: '🌳', description: 'CST/AST可视化、节点折叠' },
    { id: 'levels', name: '教学关卡', icon: '🏆', description: '20个递进关卡、提示、验证' }
  ];
</script>

<div class="app">
  <Sidebar {modules} bind:currentView />
  <main class="main-content">
    {#if currentView === 'lexer'}
      <LexerView />
    {:else if currentView === 'regex'}
      <RegexView />
    {:else if currentView === 'll1'}
      <LL1View />
    {:else if currentView === 'lr1'}
      <LR1View />
    {:else if currentView === 'semantic'}
      <SemanticView />
    {:else if currentView === 'incremental'}
      <IncrementalView />
    {:else if currentView === 'tools'}
      <ToolsView />
    {:else if currentView === 'tree'}
      <TreeView />
    {:else if currentView === 'levels'}
      <LevelsView bind:currentView />
    {/if}
  </main>
</div>

<style>
  .app {
    display: flex;
    width: 100%;
    height: 100%;
  }
  
  .main-content {
    flex: 1;
    height: 100%;
    overflow: auto;
    padding: 20px;
  }
</style>
