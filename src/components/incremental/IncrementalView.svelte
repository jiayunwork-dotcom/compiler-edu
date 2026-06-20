<script>
  import { onMount } from 'svelte';
  import MultiFileEditor from './MultiFileEditor.svelte';
  import DependencyGraph from './DependencyGraph.svelte';
  import BuildConsole from './BuildConsole.svelte';
  import { INCREMENTAL_PROJECTS } from '../../data/examples.js';
  import {
    FILE_STATUS,
    buildDependencyGraph,
    detectCycle,
    topologicalSort,
    findAffectedFiles,
    determineCompileOrder,
    simulateCompileStep,
    simulateIncrementalCompile,
    generateOptimizationSuggestions
  } from '../../lib/incremental/index.js';

  let files = {};
  let fileStatuses = {};
  let fileHashes = {};
  let selectedFileId = null;
  let graph = { nodes: [], edges: [] };
  let cyclePath = [];
  let isCompiling = false;
  let compilingFileId = null;
  let compileMode = null;
  let consoleLines = [];
  let compileErrors = {};
  let compileStats = { show: false };
  let showErrorModal = false;
  let errorModalFileId = null;
  let lastFullCompileTime = 0;

  let lastCompiledSnapshots = {};
  let compileHistory = [];

  let cycleWarningVisible = false;
  let cycleWarningMessage = '';

  let debounceTimer = null;

  onMount(() => {
    loadProject('diamond_demo');
  });

  function loadProject(projectKey) {
    const project = INCREMENTAL_PROJECTS[projectKey];
    if (!project) return;

    files = JSON.parse(JSON.stringify(project.files));
    fileStatuses = {};
    fileHashes = {};
    compileErrors = {};
    consoleLines = [];
    compileStats = { show: false };
    lastFullCompileTime = 0;
    lastCompiledSnapshots = {};
    compileHistory = [];

    Object.keys(files).forEach(fileId => {
      fileStatuses[fileId] = FILE_STATUS.UNCOMPILED;
      fileHashes[fileId] = hashContent(files[fileId].content);
    });

    const fileIds = Object.keys(files);
    if (fileIds.length > 0) {
      selectedFileId = fileIds[0];
    }

    updateDependencyGraph();
  }

  function hashContent(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  function updateDependencyGraph() {
    graph = buildDependencyGraph(files);
    const cycleResult = detectCycle(graph);
    if (cycleResult.hasCycle) {
      cyclePath = cycleResult.cyclePath;
      showCycleWarning(cyclePath);
    } else {
      cyclePath = [];
      cycleWarningVisible = false;
    }
  }

  function showCycleWarning(path) {
    cycleWarningMessage = `检测到循环依赖: ${path.join(' → ')}`;
    cycleWarningVisible = true;
  }

  function handleFileChange(e) {
    if (isCompiling) return;

    const { fileId, content } = e.detail;
    const newHash = hashContent(content);

    files = {
      ...files,
      [fileId]: {
        ...files[fileId],
        content
      }
    };

    if (newHash !== fileHashes[fileId]) {
      updateFileStatusModified(fileId);
    } else if (fileStatuses[fileId] === FILE_STATUS.MODIFIED) {
      fileStatuses[fileId] = FILE_STATUS.COMPILED;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateDependencyGraph();
    }, 200);
  }

  function updateFileStatusModified(modifiedFileId) {
    const newStatuses = { ...fileStatuses };
    newStatuses[modifiedFileId] = FILE_STATUS.MODIFIED;

    const affected = findAffectedFiles([modifiedFileId], graph);
    affected.forEach(fileId => {
      if (fileId !== modifiedFileId && 
          newStatuses[fileId] !== FILE_STATUS.MODIFIED &&
          newStatuses[fileId] !== FILE_STATUS.ERROR) {
        newStatuses[fileId] = FILE_STATUS.NEEDS_RECOMPILE;
      }
    });

    fileStatuses = newStatuses;
    compileStats = { show: false };
  }

  function handleNodeClick(nodeId) {
    selectedFileId = nodeId;
    if (compileErrors[nodeId]?.length > 0) {
      errorModalFileId = nodeId;
      showErrorModal = true;
    }
  }

  function saveCurrentSnapshots() {
    const snapshots = {};
    for (const fileId of Object.keys(files)) {
      snapshots[fileId] = files[fileId].content;
    }
    lastCompiledSnapshots = snapshots;
  }

  function addCompileHistoryRecord(mode, filesCompiled, filesSkipped, totalTime) {
    const record = {
      timestamp: Date.now(),
      mode,
      filesCompiled,
      filesSkipped,
      totalTime
    };
    compileHistory = [record, ...compileHistory].slice(0, 10);
  }

  async function handleFullCompile() {
    if (isCompiling) return;
    
    const cycleResult = detectCycle(graph);
    if (cycleResult.hasCycle) {
      showCycleWarning(cycleResult.cyclePath);
      return;
    }

    isCompiling = true;
    compileMode = 'full';
    consoleLines = [];
    compileStats = { show: false };
    compileErrors = {};

    addConsoleLine({
      type: 'header',
      icon: '🚀',
      message: '开始 <strong>全量编译</strong>，将编译所有文件'
    });

    const compileOrder = determineCompileOrder(files, fileStatuses, graph, true);
    
    addConsoleLine({
      type: 'info',
      icon: '📋',
      message: `编译顺序（拓扑排序）: <code>${compileOrder.join(' → ')}</code>`
    });

    const startTime = Date.now();
    let filesCompiled = 0;

    for (const fileId of compileOrder) {
      compilingFileId = fileId;
      fileStatuses = { ...fileStatuses, [fileId]: FILE_STATUS.COMPILING };
      
      addConsoleLine({
        type: 'section',
        icon: '📁',
        message: `编译文件: <strong>${files[fileId].name}</strong>`
      });

      const success = await compileFile(fileId);
      if (success) {
        fileHashes[fileId] = hashContent(files[fileId].content);
        filesCompiled++;
      }
    }

    const totalTime = Date.now() - startTime;
    lastFullCompileTime = totalTime;
    compilingFileId = null;
    isCompiling = false;

    saveCurrentSnapshots();
    addCompileHistoryRecord('full', filesCompiled, 0, totalTime);

    addConsoleLine({
      type: 'header',
      icon: '✅',
      message: `全量编译完成，共编译 ${filesCompiled} 个文件，耗时 <strong>${(totalTime / 1000).toFixed(2)}s</strong>`
    });

    compileStats = {
      show: true,
      mode: 'full',
      fullTime: totalTime,
      incrementalTime: null,
      maxTime: totalTime,
      filesCompiled,
      filesSkipped: 0
    };
  }

  async function handleIncrementalCompile() {
    if (isCompiling) return;

    const cycleResult = detectCycle(graph);
    if (cycleResult.hasCycle) {
      showCycleWarning(cycleResult.cyclePath);
      return;
    }

    isCompiling = true;
    compileMode = 'incremental';
    consoleLines = [];
    compileStats = { show: false };

    addConsoleLine({
      type: 'header',
      icon: '⚡',
      message: '开始 <strong>增量编译</strong>，只编译修改的文件及其依赖'
    });

    const { compileOrder, skippedFiles } = simulateIncrementalCompile(files, fileStatuses, graph);
    const totalFiles = graph.nodes.length;
    
    if (compileOrder.length === 0 && skippedFiles.length > 0) {
      addConsoleLine({
        type: 'info',
        icon: '💾',
        message: '所有文件缓存有效，无需重新编译'
      });
      addCompileHistoryRecord('incremental', 0, skippedFiles.length, 0);
      isCompiling = false;
      return;
    }

    addConsoleLine({
      type: 'info',
      icon: '📋',
      message: `编译顺序（拓扑排序）: <code>${compileOrder.join(' → ')}</code>`
    });

    if (skippedFiles.length > 0) {
      addConsoleLine({
        type: 'info',
        icon: '⏭️',
        message: `跳过文件（缓存有效）: <code>${skippedFiles.join(', ')}</code>`
      });
    }

    const startTime = Date.now();
    let filesCompiled = 0;

    for (const fileId of skippedFiles) {
      fileStatuses = { ...fileStatuses, [fileId]: FILE_STATUS.SKIPPED };
      addConsoleLine({
        type: 'skip',
        icon: '⏭️',
        message: `跳过 <strong>${files[fileId].name}</strong> (缓存有效)`
      });
    }

    for (const fileId of compileOrder) {
      compilingFileId = fileId;
      fileStatuses = { ...fileStatuses, [fileId]: FILE_STATUS.COMPILING };
      
      addConsoleLine({
        type: 'section',
        icon: '📁',
        message: `编译文件: <strong>${files[fileId].name}</strong>`
      });

      const success = await compileFile(fileId);
      if (success) {
        fileHashes[fileId] = hashContent(files[fileId].content);
        filesCompiled++;
      }
    }

    const totalTime = Date.now() - startTime;
    compilingFileId = null;
    isCompiling = false;

    saveCurrentSnapshots();
    addCompileHistoryRecord('incremental', filesCompiled, skippedFiles.length, totalTime);

    addConsoleLine({
      type: 'header',
      icon: '✅',
      message: `增量编译完成，共编译 ${filesCompiled} 个文件，跳过 ${skippedFiles.length} 个，耗时 <strong>${(totalTime / 1000).toFixed(2)}s</strong>`
    });

    const maxTime = Math.max(totalTime, lastFullCompileTime || totalTime);
    compileStats = {
      show: true,
      mode: 'incremental',
      fullTime: lastFullCompileTime || totalTime * 2,
      incrementalTime: totalTime,
      maxTime: maxTime,
      filesCompiled,
      filesSkipped: skippedFiles.length
    };

    const suggestions = generateOptimizationSuggestions(graph, compileOrder, totalFiles);
    if (suggestions.length > 0) {
      addConsoleLine({
        type: 'section',
        icon: '📊',
        message: '<strong>编译优化建议</strong>'
      });
      suggestions.forEach(suggestion => {
        addConsoleLine({
          type: 'info',
          icon: '',
          message: suggestion.message
        });
      });
    }
  }

  async function compileFile(fileId) {
    const content = files[fileId].content;

    addConsoleLine({
      type: 'lexer',
      icon: '🔤',
      message: '正在进行词法分析...'
    });

    const lexerResult = await simulateCompileStep(fileId, content, 'lexer');
    addConsoleLine({
      type: 'lexer',
      icon: '✓',
      message: `词法分析完成，识别 ${lexerResult.tokens.length} 个 Token，耗时 <strong>${(lexerResult.time / 1000).toFixed(3)}s</strong>`
    });

    addConsoleLine({
      type: 'parser',
      icon: '🌳',
      message: '正在进行语法分析...'
    });

    const parserResult = await simulateCompileStep(fileId, content, 'parser');
    
    if (parserResult.success) {
      addConsoleLine({
        type: 'parser',
        icon: '✓',
        message: `语法分析完成，耗时 <strong>${(parserResult.time / 1000).toFixed(3)}s</strong>`
      });
      addConsoleLine({
        type: 'success',
        icon: '✅',
        message: `<strong>${files[fileId].name}</strong> 编译成功`
      });
      fileStatuses = { ...fileStatuses, [fileId]: FILE_STATUS.COMPILED };
      compileErrors = { ...compileErrors, [fileId]: [] };
      return true;
    } else {
      addConsoleLine({
        type: 'parser',
        icon: '✗',
        message: `语法分析发现 ${parserResult.errors.length} 个错误，耗时 <strong>${(parserResult.time / 1000).toFixed(3)}s</strong>`
      });
      
      parserResult.errors.forEach(err => {
        addConsoleLine({
          type: 'error',
          icon: '❌',
          message: `第 ${err.line} 行: ${err.message}`
        });
      });

      addConsoleLine({
        type: 'error',
        icon: '❌',
        message: `<strong>${files[fileId].name}</strong> 编译失败`
      });
      fileStatuses = { ...fileStatuses, [fileId]: FILE_STATUS.ERROR };
      compileErrors = { ...compileErrors, [fileId]: parserResult.errors };
      return false;
    }
  }

  function handleClearCache() {
    if (isCompiling) return;

    Object.keys(files).forEach(fileId => {
      fileStatuses = { ...fileStatuses, [fileId]: FILE_STATUS.UNCOMPILED };
    });
    compileErrors = {};
    consoleLines = [];
    compileStats = { show: false };
    lastFullCompileTime = 0;
    lastCompiledSnapshots = {};

    addConsoleLine({
      type: 'info',
      icon: '🗑️',
      message: '缓存已清除，所有文件状态重置为未编译'
    });
  }

  function addConsoleLine(line) {
    consoleLines = [...consoleLines, { ...line, time: Date.now() }];
  }

  function closeErrorModal() {
    showErrorModal = false;
    errorModalFileId = null;
  }
</script>

<div class="incremental-view">
  <div class="header">
    <div class="header-left">
      <h2>⚡ 增量编译分析器</h2>
      <p class="subtitle">依赖图可视化 · 增量重编译策略 · 缓存效率对比</p>
    </div>
    <div class="header-right">
      <div class="project-selector">
        <span class="label">示例项目:</span>
        <select on:change={(e) => loadProject(e.target.value)}>
          {#each Object.entries(INCREMENTAL_PROJECTS) as [key, project]}
            <option value={key}>{project.name}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  {#if cycleWarningVisible}
    <div class="cycle-warning">
      <span class="warning-icon">⚠️</span>
      <span class="warning-text">{cycleWarningMessage}</span>
      <button class="close-warning" on:click={() => cycleWarningVisible = false}>✕</button>
    </div>
  {/if}

  <div class="main-grid">
    <div class="panel editor-panel">
      <div class="panel-title">
        <h3>📝 多文件编辑器</h3>
        <span class="file-count">{Object.keys(files).length} 个文件</span>
      </div>
      <div class="panel-content">
        <MultiFileEditor
          bind:files
          bind:fileStatuses
          bind:selectedFileId
          {compileErrors}
          {lastCompiledSnapshots}
          disabled={isCompiling}
          on:fileChange={handleFileChange}
        />
      </div>
    </div>

    <div class="panel graph-panel">
      <div class="panel-title">
        <h3>🔗 依赖图可视化</h3>
        <span class="hint">拖拽节点 · 按住查看影响范围 · Shift+按住查看双向链</span>
      </div>
      <div class="panel-content">
        <DependencyGraph
          {graph}
          {fileStatuses}
          {compilingFileId}
          {cyclePath}
          {compileErrors}
          on:nodeClick={(e) => handleNodeClick(e.detail)}
        />
      </div>
      <div class="graph-legend">
        <div class="legend-item">
          <span class="legend-dot" style="background: #10b981;"></span>
          <span>已编译</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #f97316;"></span>
          <span>已修改</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #eab308;"></span>
          <span>待重编译</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #ef4444;"></span>
          <span>编译失败</span>
        </div>
      </div>
    </div>

    <div class="panel console-panel">
      <div class="panel-title">
        <h3>⚙️ 增量编译控制台</h3>
        <span class="status-badge" class:active={isCompiling}>
          {isCompiling ? '编译中...' : '就绪'}
        </span>
      </div>
      <div class="panel-content">
        <BuildConsole
          {consoleLines}
          {isCompiling}
          {compileStats}
          {compileHistory}
          disabled={cyclePath.length > 0}
          on:fullCompile={handleFullCompile}
          on:incrementalCompile={handleIncrementalCompile}
          on:clearCache={handleClearCache}
        />
      </div>
    </div>
  </div>

  {#if showErrorModal && errorModalFileId}
    <div class="modal-overlay" on:click={closeErrorModal}>
      <div class="modal-dialog" on:click|stopPropagation>
        <div class="modal-header">
          <h4>❌ {files[errorModalFileId]?.name} 编译错误</h4>
          <button class="close-btn" on:click={closeErrorModal}>✕</button>
        </div>
        <div class="modal-body">
          {#if compileErrors[errorModalFileId]?.length > 0}
            <div class="error-list">
              {#each compileErrors[errorModalFileId] as error, i}
                <div class="error-item">
                  <span class="error-number">{i + 1}</span>
                  <div class="error-content">
                    <div class="error-location">第 {error.line} 行{error.column !== undefined ? `，第 ${error.column} 列` : ''}</div>
                    <div class="error-message">{error.message}</div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p>暂无错误详情</p>
          {/if}
        </div>
        <div class="modal-footer">
          <button class="btn-primary" on:click={closeErrorModal}>关闭</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .incremental-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
    flex-wrap: wrap;
    gap: 12px;
  }

  .header-left h2 {
    margin: 0 0 4px 0;
    font-size: 1.3rem;
    background: linear-gradient(135deg, #4f46e5, #0ea5e9);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    margin: 0;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .project-selector {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .project-selector .label {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .cycle-warning {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    margin-bottom: 16px;
  }

  .warning-icon {
    font-size: 18px;
  }

  .warning-text {
    flex: 1;
    color: #dc2626;
    font-size: 13px;
    font-weight: 500;
  }

  .close-warning {
    background: transparent;
    border: none;
    color: #dc2626;
    cursor: pointer;
    font-size: 16px;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .close-warning:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .panel {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    min-height: 0;
    overflow: hidden;
  }

  .panel-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface-alt);
  }

  .panel-title h3 {
    margin: 0;
    font-size: 14px;
    color: var(--color-text);
  }

  .panel-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .file-count {
    font-size: 11px;
    color: var(--color-text-muted);
    background: var(--color-surface);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .hint {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .status-badge {
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 12px;
    background: var(--color-surface);
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .status-badge.active {
    background: rgba(99, 102, 241, 0.15);
    color: #6366f1;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .graph-legend {
    display: flex;
    justify-content: center;
    gap: 16px;
    padding: 10px 16px;
    border-top: 1px solid var(--color-border);
    background: var(--color-surface-alt);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }

  .modal-dialog {
    background: white;
    border-radius: 10px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    min-width: 450px;
    max-width: 90vw;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: modal-in 0.2s ease-out;
  }

  @keyframes modal-in {
    from { opacity: 0; transform: translateY(-10px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface-alt);
  }

  .modal-header h4 {
    margin: 0;
    font-size: 15px;
    color: var(--color-text);
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 16px;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: var(--color-border);
    color: var(--color-text);
  }

  .modal-body {
    padding: 18px;
    overflow-y: auto;
    flex: 1;
  }

  .error-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .error-item {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 8px;
  }

  .error-number {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    background: var(--color-danger);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
  }

  .error-content {
    flex: 1;
  }

  .error-location {
    font-size: 11px;
    color: var(--color-text-muted);
    margin-bottom: 4px;
  }

  .error-message {
    font-size: 13px;
    color: var(--color-text);
    font-weight: 500;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 18px;
    border-top: 1px solid var(--color-border);
    background: var(--color-surface-alt);
  }

  .btn-primary {
    padding: 8px 20px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    border: none;
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    color: white;
    transition: all 0.15s;
  }

  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
  }

  @media (max-width: 1400px) {
    .main-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-rows: 1fr 1fr;
    }
    
    .editor-panel {
      grid-column: 1;
      grid-row: 1 / 3;
    }
    
    .graph-panel {
      grid-column: 2;
      grid-row: 1;
    }
    
    .console-panel {
      grid-column: 2;
      grid-row: 2;
    }
  }

  @media (max-width: 900px) {
    .main-grid {
      grid-template-columns: 1fr;
      grid-template-rows: auto;
      overflow: auto;
    }
    
    .editor-panel,
    .graph-panel,
    .console-panel {
      grid-column: 1;
      grid-row: auto;
      min-height: 400px;
    }
  }
</style>
