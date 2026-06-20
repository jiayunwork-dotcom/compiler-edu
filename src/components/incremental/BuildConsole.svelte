<script>
  import { createEventDispatcher } from 'svelte';

  export let consoleLines = [];
  export let isCompiling = false;
  export let compileStats = null;
  export let disabled = false;
  export let compileHistory = [];

  const dispatch = createEventDispatcher();

  let consoleRef = null;
  let showStatsPanel = true;

  $: if (consoleRef) {
    consoleRef.scrollTop = consoleRef.scrollHeight;
  }

  function handleFullCompile() {
    dispatch('fullCompile');
  }

  function handleIncrementalCompile() {
    dispatch('incrementalCompile');
  }

  function handleClearCache() {
    dispatch('clearCache');
  }

  function formatTime(ms) {
    return (ms / 1000).toFixed(2) + 's';
  }

  function formatTimestamp(ts) {
    const date = new Date(ts);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  function getLineClass(line) {
    const classes = ['console-line'];
    if (line.type) classes.push(`line-${line.type}`);
    if (line.animate) classes.push('line-animate');
    return classes.join(' ');
  }

  function getSavingsPercent() {
    if (!compileStats || !compileStats.fullTime || !compileStats.incrementalTime) return 0;
    return Math.round((1 - compileStats.incrementalTime / compileStats.fullTime) * 100);
  }

  function getCacheHitRate(record) {
    const total = record.filesCompiled + record.filesSkipped;
    if (total === 0) return 0;
    return Math.round((record.filesSkipped / total) * 100);
  }

  function toggleStatsPanel() {
    showStatsPanel = !showStatsPanel;
  }

  $: maxHitRate = compileHistory.length > 0 ? Math.max(...compileHistory.map(r => getCacheHitRate(r))) : 100;

  function getChartWidth() {
    if (compileHistory.length <= 1) return 30;
    return 100;
  }

  function getChartPointX(index) {
    if (compileHistory.length <= 1) return 50;
    return (index / (compileHistory.length - 1)) * 100;
  }

  function getChartPointY(hitRate) {
    return 100 - hitRate;
  }

  function getLinePath() {
    if (compileHistory.length === 0) return '';
    const points = compileHistory.map((r, i) => {
      const x = getChartPointX(i);
      const y = getChartPointY(getCacheHitRate(r));
      return `${x},${y}`;
    });
    return 'M ' + points.join(' L ');
  }

  function getAreaPath() {
    if (compileHistory.length === 0) return '';
    const points = compileHistory.map((r, i) => {
      const x = getChartPointX(i);
      const y = getChartPointY(getCacheHitRate(r));
      return `${x},${y}`;
    });
    const firstX = getChartPointX(0);
    const lastX = getChartPointX(compileHistory.length - 1);
    return `M ${firstX},100 L ${points.join(' L ')} L ${lastX},100 Z`;
  }
</script>

<div class="build-console">
  <div class="toolbar">
    <button
      class="btn btn-primary"
      on:click={handleFullCompile}
      disabled={isCompiling || disabled}
    >
      🔄 全量编译
    </button>
    <button
      class="btn btn-success"
      on:click={handleIncrementalCompile}
      disabled={isCompiling || disabled}
    >
      ⚡ 增量编译
    </button>
    <button
      class="btn btn-secondary"
      on:click={handleClearCache}
      disabled={isCompiling || disabled}
    >
      🗑️ 清除缓存
    </button>
  </div>

  <div class="console-output" bind:this={consoleRef}>
    {#if consoleLines.length === 0}
      <div class="console-placeholder">
        <p>📝 点击上方按钮开始编译</p>
        <p class="hint">全量编译：重新编译所有文件</p>
        <p class="hint">增量编译：只编译修改过的文件及其依赖</p>
      </div>
    {:else}
      {#each consoleLines as line, i}
        <div class={getLineClass(line)} style="animation-delay: {i * 0.02}s">
          <span class="line-time">{line.time ? formatTime(line.time) : ''}</span>
          <span class="line-content">
            {#if line.icon}
              <span class="line-icon">{line.icon}</span>
            {/if}
            {@html line.message}
          </span>
        </div>
      {/each}
    {/if}
  </div>

  {#if compileStats && compileStats.show}
    <div class="stats-panel">
      <div class="stats-title">
        <h4>📊 编译耗时对比</h4>
        {#if compileStats.mode === 'incremental'}
          <span class="savings-badge">节省 {getSavingsPercent()}%</span>
        {/if}
      </div>
      
      <div class="chart-container">
        <div class="chart-bars">
          <div class="bar-group">
            <div class="bar-label">全量编译</div>
            <div class="bar-wrapper">
              <div 
                class="bar bar-full"
                style="height: {compileStats.fullTime ? (compileStats.fullTime / compileStats.maxTime * 100) : 0}%"
              >
                <span class="bar-value">{compileStats.fullTime ? formatTime(compileStats.fullTime) : '-'}</span>
              </div>
            </div>
          </div>
          
          <div class="bar-group">
            <div class="bar-label">增量编译</div>
            <div class="bar-wrapper">
              <div 
                class="bar bar-incremental"
                style="height: {compileStats.incrementalTime ? (compileStats.incrementalTime / compileStats.maxTime * 100) : 0}%"
              >
                <span class="bar-value">{compileStats.incrementalTime ? formatTime(compileStats.incrementalTime) : '-'}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="chart-legend">
          <div class="legend-item">
            <span class="legend-color full"></span>
            <span>全量编译: {compileStats.filesCompiled} 个文件</span>
          </div>
          {#if compileStats.mode === 'incremental'}
            <div class="legend-item">
              <span class="legend-color incremental"></span>
              <span>增量编译: {compileStats.filesCompiled} 个文件 · 跳过 {compileStats.filesSkipped} 个</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <div class="cache-history-panel">
    <div class="panel-header" on:click={toggleStatsPanel}>
      <span class="panel-title">📈 编译缓存命中率统计</span>
      <span class="toggle-icon">{showStatsPanel ? '▼' : '▶'}</span>
    </div>
    
    {#if showStatsPanel}
      <div class="panel-content-inner">
        {#if compileHistory.length === 0}
          <div class="empty-history">
            <p>暂无编译记录</p>
            <p class="hint">运行编译后将在此显示统计信息</p>
          </div>
        {:else}
          <div class="chart-wrapper">
            <svg class="line-chart" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#10b981" stop-opacity="0.3"/>
                  <stop offset="100%" stop-color="#10b981" stop-opacity="0.02"/>
                </linearGradient>
              </defs>
              
              {#each [0, 25, 50, 75, 100] as y}
                <line x1="0" y1={100 - y} x2="100" y2={100 - y} class="grid-line" />
                <text x="-1" y={100 - y + 1} class="grid-label" font-size="3" text-anchor="end">{y}%</text>
              {/each}
              
              <path d={getAreaPath()} fill="url(#chartGradient)" />
              <path d={getLinePath()} fill="none" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="chart-line" />
              
              {#each compileHistory as record, i}
                {#if getCacheHitRate(record) >= 0}
                  <circle 
                    cx={getChartPointX(i)} 
                    cy={getChartPointY(getCacheHitRate(record))} 
                    r="2" 
                    fill="#10b981" 
                    stroke="white" 
                    stroke-width="0.8"
                    class="chart-point"
                  >
                    <title>{formatTimestamp(record.timestamp)} - 命中率 {getCacheHitRate(record)}%</title>
                  </circle>
                {/if}
              {/each}
            </svg>
            
            <div class="x-axis-labels">
              {#each compileHistory as record, i}
                <span class="x-label" style="left: {getChartPointX(i)}%">{i + 1}</span>
              {/each}
            </div>
          </div>
          
          <div class="table-wrapper">
            <table class="stats-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>时间</th>
                  <th>模式</th>
                  <th>编译数</th>
                  <th>跳过数</th>
                  <th>命中率</th>
                  <th>耗时</th>
                </tr>
              </thead>
              <tbody>
                {#each compileHistory as record, i}
                  <tr class={record.mode === 'incremental' ? 'mode-inc' : 'mode-full'}>
                    <td class="col-index">{compileHistory.length - i}</td>
                    <td>{formatTimestamp(record.timestamp)}</td>
                    <td>
                      <span class="mode-badge {record.mode}">
                        {record.mode === 'incremental' ? '增量' : '全量'}
                      </span>
                    </td>
                    <td>{record.filesCompiled}</td>
                    <td>{record.filesSkipped}</td>
                    <td>
                      <span class="hit-rate {getCacheHitRate(record) >= 50 ? 'good' : 'low'}">
                        {getCacheHitRate(record)}%
                      </span>
                    </td>
                    <td>{formatTime(record.totalTime)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .build-console {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .toolbar {
    display: flex;
    gap: 8px;
    padding: 12px;
    background: var(--color-surface-alt);
    border-radius: 8px 8px 0 0;
    border-bottom: 1px solid var(--color-border);
  }

  .btn {
    flex: 1;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
  }

  .btn-success {
    background: linear-gradient(135deg, #10b981, #34d399);
    color: white;
  }

  .btn-success:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
  }

  .btn-secondary {
    background: var(--color-surface);
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--color-border);
    color: var(--color-text);
  }

  .console-output {
    flex: 1;
    background: #1e293b;
    color: #e2e8f0;
    padding: 12px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 12px;
    line-height: 1.6;
    overflow-y: auto;
    min-height: 120px;
    max-height: 250px;
  }

  .console-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #64748b;
    text-align: center;
  }

  .console-placeholder p {
    margin: 4px 0;
  }

  .console-placeholder .hint {
    font-size: 11px;
  }

  .console-line {
    display: flex;
    gap: 8px;
    padding: 2px 0;
    opacity: 0;
    animation: fadeIn 0.3s ease forwards;
  }

  @keyframes fadeIn {
    to { opacity: 1; }
  }

  .line-time {
    color: #64748b;
    font-size: 10px;
    min-width: 50px;
    flex-shrink: 0;
  }

  .line-content {
    flex: 1;
    word-break: break-all;
  }

  .line-icon {
    margin-right: 4px;
  }

  .line-info .line-content {
    color: #94a3b8;
  }

  .line-step .line-content {
    color: #e2e8f0;
  }

  .line-lexer .line-content {
    color: #60a5fa;
  }

  .line-parser .line-content {
    color: #a78bfa;
  }

  .line-success .line-content {
    color: #34d399;
  }

  .line-error .line-content {
    color: #f87171;
  }

  .line-skip .line-content {
    color: #fbbf24;
  }

  .line-header .line-content {
    color: #f472b6;
    font-weight: 600;
    border-bottom: 1px solid #334155;
    padding-bottom: 4px;
    margin-bottom: 4px;
  }

  .line-section .line-content {
    color: #fcd34d;
    font-weight: 600;
    margin-top: 8px;
  }

  .stats-panel {
    padding: 12px;
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
  }

  .stats-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .stats-title h4 {
    margin: 0;
    font-size: 13px;
    color: var(--color-text);
  }

  .savings-badge {
    background: linear-gradient(135deg, #10b981, #34d399);
    color: white;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 12px;
  }

  .chart-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .chart-bars {
    display: flex;
    justify-content: center;
    gap: 40px;
    height: 80px;
    align-items: flex-end;
  }

  .bar-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .bar-label {
    font-size: 11px;
    color: var(--color-text-muted);
    font-weight: 600;
    order: 2;
  }

  .bar-wrapper {
    width: 60px;
    height: 60px;
    background: var(--color-surface-alt);
    border-radius: 6px 6px 0 0;
    display: flex;
    align-items: flex-end;
    overflow: hidden;
    order: 1;
  }

  .bar {
    width: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 6px;
    transition: height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
    animation: barGrow 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes barGrow {
    from { height: 0 !important; }
  }

  .bar-full {
    background: linear-gradient(180deg, #6366f1, #4f46e5);
  }

  .bar-incremental {
    background: linear-gradient(180deg, #34d399, #10b981);
  }

  .bar-value {
    color: white;
    font-size: 9px;
    font-weight: 700;
    font-family: 'Monaco', 'Menlo', monospace;
  }

  .chart-legend {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }

  .legend-color.full {
    background: linear-gradient(135deg, #6366f1, #4f46e5);
  }

  .legend-color.incremental {
    background: linear-gradient(135deg, #34d399, #10b981);
  }

  .cache-history-panel {
    border-top: 1px solid var(--color-border);
    background: var(--color-surface);
    border-radius: 0 0 8px 8px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--color-surface-alt);
    cursor: pointer;
    transition: background 0.15s;
  }

  .panel-header:hover {
    background: var(--color-border);
  }

  .panel-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text);
  }

  .toggle-icon {
    font-size: 10px;
    color: var(--color-text-muted);
    transition: transform 0.15s;
  }

  .panel-content-inner {
    padding: 12px;
    max-height: 280px;
    overflow-y: auto;
  }

  .empty-history {
    text-align: center;
    padding: 20px;
    color: var(--color-text-muted);
  }

  .empty-history p {
    margin: 4px 0;
    font-size: 12px;
  }

  .empty-history .hint {
    font-size: 11px;
    opacity: 0.7;
  }

  .chart-wrapper {
    position: relative;
    height: 120px;
    margin-bottom: 12px;
    padding-left: 28px;
  }

  .line-chart {
    width: 100%;
    height: 100px;
  }

  .grid-line {
    stroke: var(--color-border);
    stroke-width: 0.3;
    stroke-dasharray: 1, 1;
  }

  .grid-label {
    fill: var(--color-text-muted);
    font-family: 'Monaco', 'Menlo', monospace;
  }

  .chart-line {
    animation: lineDraw 0.6s ease-out;
  }

  @keyframes lineDraw {
    from {
      stroke-dasharray: 1000;
      stroke-dashoffset: 1000;
    }
    to {
      stroke-dasharray: 0;
      stroke-dashoffset: 0;
    }
  }

  .chart-point {
    transition: r 0.15s;
  }

  .chart-point:hover {
    r: 3;
  }

  .x-axis-labels {
    position: relative;
    height: 16px;
    margin-top: 2px;
  }

  .x-label {
    position: absolute;
    transform: translateX(-50%);
    font-size: 10px;
    color: var(--color-text-muted);
    font-family: 'Monaco', 'Menlo', monospace;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .stats-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  .stats-table th {
    padding: 6px 8px;
    text-align: left;
    background: var(--color-surface-alt);
    color: var(--color-text-muted);
    font-weight: 600;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  .stats-table td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  .stats-table tr.mode-inc {
    background: rgba(16, 185, 129, 0.04);
  }

  .stats-table tr.mode-full {
    background: rgba(99, 102, 241, 0.04);
  }

  .col-index {
    color: var(--color-text-muted);
    font-family: 'Monaco', 'Menlo', monospace;
  }

  .mode-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 600;
  }

  .mode-badge.incremental {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .mode-badge.full {
    background: rgba(99, 102, 241, 0.15);
    color: #6366f1;
  }

  .hit-rate {
    font-weight: 600;
    font-family: 'Monaco', 'Menlo', monospace;
  }

  .hit-rate.good {
    color: #10b981;
  }

  .hit-rate.low {
    color: #f97316;
  }
</style>
