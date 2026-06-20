<script>
  export let modules;
  export let currentView;
</script>

<aside class="sidebar">
  <div class="logo">
    <h1>Compiler Edu</h1>
    <p>编译器前端教学工具</p>
  </div>
  
  <nav class="nav">
    {#each modules as mod}
      <button 
        class="nav-item"
        class:active={currentView === mod.id}
        on:click={() => currentView = mod.id}
      >
        <span class="icon">{mod.icon}</span>
        <div class="nav-text">
          <div class="nav-name">{mod.name}</div>
          <div class="nav-desc">{mod.description}</div>
        </div>
      </button>
    {/each}
  </nav>
  
  <div class="sidebar-footer">
    <p>📚 交互式学习平台</p>
  </div>
</aside>

<style>
  .sidebar {
    width: 260px;
    background: var(--color-bg-dark);
    color: white;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }
  
  .logo {
    padding: 24px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .logo h1 {
    font-size: 1.4rem;
    background: linear-gradient(135deg, #818cf8, #06b6d4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .logo p {
    color: #94a3b8;
    font-size: 12px;
    margin: 4px 0 0 0;
  }
  
  .nav {
    flex: 1;
    padding: 12px 10px;
    overflow-y: auto;
  }
  
  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    margin-bottom: 4px;
    background: transparent;
    border: none;
    color: #cbd5e1;
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .nav-item:hover {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }
  
  .nav-item.active {
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.4), rgba(14, 165, 233, 0.4));
    color: white;
    border: 1px solid rgba(129, 140, 248, 0.3);
  }
  
  .icon {
    font-size: 22px;
    width: 30px;
    text-align: center;
  }
  
  .nav-name {
    font-weight: 600;
    font-size: 14px;
  }
  
  .nav-desc {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 2px;
  }
  
  .nav-item.active .nav-desc {
    color: #c7d2fe;
  }
  
  .sidebar-footer {
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 12px;
    color: #94a3b8;
  }
  
  .sidebar-footer p {
    margin: 0;
  }
</style>
