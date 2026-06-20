export const FILE_STATUS = {
  UNCOMPILED: 'uncompiled',
  COMPILED: 'compiled',
  MODIFIED: 'modified',
  NEEDS_RECOMPILE: 'needs_recompile',
  COMPILING: 'compiling',
  ERROR: 'error',
  SKIPPED: 'skipped'
};

export const STATUS_LABELS = {
  [FILE_STATUS.UNCOMPILED]: { text: '未编译', color: '#94a3b8', bgColor: 'rgba(148, 163, 184, 0.15)' },
  [FILE_STATUS.COMPILED]: { text: '已编译', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' },
  [FILE_STATUS.MODIFIED]: { text: '已修改', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)' },
  [FILE_STATUS.NEEDS_RECOMPILE]: { text: '待重编译', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)' },
  [FILE_STATUS.COMPILING]: { text: '编译中', color: '#6366f1', bgColor: 'rgba(99, 102, 241, 0.15)' },
  [FILE_STATUS.ERROR]: { text: '编译失败', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
  [FILE_STATUS.SKIPPED]: { text: '跳过', color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)' }
};

export function parseImports(fileContent) {
  const importRegex = /^import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]?([^'";\n]+)['"]?\s*;?\s*$/gm;
  const imports = [];
  let match;

  while ((match = importRegex.exec(fileContent)) !== null) {
    const functionNames = match[1].split(',').map(s => s.trim()).filter(s => s);
    const fileName = match[2].trim();
    imports.push({
      functions: functionNames,
      from: fileName,
      raw: match[0],
      line: fileContent.substring(0, match.index).split('\n').length
    });
  }

  return imports;
}

export function buildDependencyGraph(files) {
  const nodes = Object.keys(files);
  const edges = [];
  const adjacencyList = {};
  const reverseAdjacencyList = {};

  nodes.forEach(node => {
    adjacencyList[node] = [];
    reverseAdjacencyList[node] = [];
  });

  for (const [fileId, fileData] of Object.entries(files)) {
    const imports = parseImports(fileData.content);
    for (const imp of imports) {
      const targetId = imp.from;
      if (nodes.includes(targetId) && targetId !== fileId) {
        if (!adjacencyList[fileId].includes(targetId)) {
          adjacencyList[fileId].push(targetId);
          edges.push({ from: fileId, to: targetId, functions: imp.functions });
        }
        if (!reverseAdjacencyList[targetId].includes(fileId)) {
          reverseAdjacencyList[targetId].push(fileId);
        }
      }
    }
  }

  return {
    nodes,
    edges,
    adjacencyList,
    reverseAdjacencyList
  };
}

export function detectCycle(graph) {
  const { nodes, adjacencyList } = graph;
  const visited = new Set();
  const recStack = new Set();
  const cyclePath = [];

  function dfs(node, path) {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    for (const neighbor of adjacencyList[node]) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, path)) {
          return true;
        }
      } else if (recStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        for (let i = cycleStart; i < path.length; i++) {
          cyclePath.push(path[i]);
        }
        cyclePath.push(neighbor);
        return true;
      }
    }

    recStack.delete(node);
    path.pop();
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node)) {
      if (dfs(node, [])) {
        return { hasCycle: true, cyclePath };
      }
    }
  }

  return { hasCycle: false, cyclePath: [] };
}

export function topologicalSort(graph) {
  const { nodes, adjacencyList } = graph;
  const inDegree = {};
  const result = [];
  const queue = [];

  nodes.forEach(node => {
    inDegree[node] = 0;
  });

  nodes.forEach(node => {
    adjacencyList[node].forEach(neighbor => {
      inDegree[neighbor]++;
    });
  });

  nodes.forEach(node => {
    if (inDegree[node] === 0) {
      queue.push(node);
    }
  });

  while (queue.length > 0) {
    const node = queue.shift();
    result.push(node);

    adjacencyList[node].forEach(neighbor => {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    });
  }

  if (result.length !== nodes.length) {
    return null;
  }

  return result.reverse();
}

export function findAffectedFiles(modifiedFiles, graph) {
  const { reverseAdjacencyList } = graph;
  const affected = new Set();
  const visited = new Set();

  function dfs(node) {
    if (visited.has(node)) return;
    visited.add(node);
    affected.add(node);

    reverseAdjacencyList[node].forEach(dependent => {
      dfs(dependent);
    });
  }

  modifiedFiles.forEach(file => {
    dfs(file);
  });

  return Array.from(affected);
}

export function determineCompileOrder(files, fileStatuses, graph, isFullCompile = false) {
  const topoOrder = topologicalSort(graph);
  if (!topoOrder) return [];

  if (isFullCompile) {
    return topoOrder;
  }

  const modifiedFiles = Object.entries(fileStatuses)
    .filter(([_, status]) => status === FILE_STATUS.MODIFIED)
    .map(([fileId]) => fileId);

  const affectedFiles = findAffectedFiles(modifiedFiles, graph);

  return topoOrder.filter(fileId => {
    const status = fileStatuses[fileId];
    return affectedFiles.includes(fileId) || 
           status === FILE_STATUS.UNCOMPILED || 
           status === FILE_STATUS.ERROR ||
           status === FILE_STATUS.MODIFIED ||
           status === FILE_STATUS.NEEDS_RECOMPILE;
  });
}

export function simulateCompileStep(fileId, fileContent, step) {
  return new Promise((resolve) => {
    const delay = 200 + Math.random() * 300;
    setTimeout(() => {
      if (step === 'lexer') {
        const tokens = tokenize(fileContent);
        resolve({ success: true, tokens, time: delay });
      } else if (step === 'parser') {
        const result = parse(fileContent);
        resolve({ ...result, time: delay });
      }
    }, delay);
  });
}

function tokenize(content) {
  const tokens = [];
  const keywords = ['int', 'float', 'bool', 'void', 'if', 'else', 'while', 'return', 'import', 'from', 'true', 'false'];
  const tokenRegex = /\s*([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+\.?[0-9]*|[+\-*/=<>!&|;(),{}]|"[^"]*"|'[^']*')/g;
  let match;
  let line = 1;
  let pos = 0;

  while ((match = tokenRegex.exec(content)) !== null) {
    const value = match[1];
    const newlines = (match[0].match(/\n/g) || []).length;
    line += newlines;
    
    if (value === '\n' || value === '\r\n') continue;

    let type = 'identifier';
    if (keywords.includes(value)) type = 'keyword';
    else if (/^[0-9]+\.?[0-9]*$/.test(value)) type = 'number';
    else if (/^[+\-*/=<>!&|]+$/.test(value)) type = 'operator';
    else if (/^[;(),{}]$/.test(value)) type = 'separator';
    else if (/^["'].*["']$/.test(value)) type = 'string';

    tokens.push({ type, value, line, pos });
    pos += match[0].length;
  }

  return tokens;
}

function parse(content) {
  const lines = content.split('\n');
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import')) {
      const importMatch = line.match(/^import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]?([^'";\n]+)['"]?\s*;?\s*$/);
      if (!importMatch) {
        errors.push({
          line: i + 1,
          message: 'import 语句格式错误，应为: import { func1, func2 } from filename',
          column: 0
        });
      }
    } else if (line.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(.*\)\s*\{?$/) && !line.includes('=')) {
      const funcMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)\s*\{?$/);
      if (!funcMatch) {
        errors.push({
          line: i + 1,
          message: '函数声明格式错误',
          column: 0
        });
      }
    } else if (line.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=/) && !line.includes('(')) {
      const varMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
      if (!varMatch) {
        errors.push({
          line: i + 1,
          message: '变量声明格式错误',
          column: 0
        });
      }
    }
  }

  const bracketStack = [];
  let totalChars = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '{') bracketStack.push({ line: i + 1, column: j });
      else if (char === '}') {
        if (bracketStack.length === 0) {
          errors.push({
            line: i + 1,
            message: '多余的右大括号 "}"',
            column: j
          });
        } else {
          bracketStack.pop();
        }
      }
    }
    totalChars += line.length + 1;
  }

  while (bracketStack.length > 0) {
    const unclosed = bracketStack.pop();
    errors.push({
      line: unclosed.line,
      message: '缺少右大括号 "}"',
      column: unclosed.column
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, ast: { type: 'Program', body: [] } };
}

export function simulateFullCompile(files, fileStatuses, graph) {
  const compileOrder = determineCompileOrder(files, fileStatuses, graph, true);
  return compileOrder;
}

export function simulateIncrementalCompile(files, fileStatuses, graph) {
  const compileOrder = determineCompileOrder(files, fileStatuses, graph, false);
  const skippedFiles = topologicalSort(graph).filter(f => !compileOrder.includes(f));
  return { compileOrder, skippedFiles };
}

export function findHighDependencyFiles(graph, threshold = 3) {
  const { reverseAdjacencyList, nodes } = graph;
  const result = [];
  for (const node of nodes) {
    const dependents = reverseAdjacencyList[node] || [];
    if (dependents.length > threshold) {
      result.push({ fileId: node, dependentCount: dependents.length });
    }
  }
  return result;
}

export function findDeepDependencyChains(graph, maxDepth = 3) {
  const { adjacencyList, nodes } = graph;
  const deepChains = [];
  const visited = new Set();
  const path = [];

  function dfs(node) {
    visited.add(node);
    path.push(node);

    if (path.length > maxDepth + 1) {
      const chainPath = [...path];
      const exists = deepChains.some(existing => 
        existing.length === chainPath.length && 
        existing.every((v, i) => v === chainPath[i])
      );
      if (!exists) {
        deepChains.push(chainPath);
      }
    }

    for (const neighbor of adjacencyList[node] || []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      }
    }

    path.pop();
    visited.delete(node);
  }

  for (const node of nodes) {
    if (adjacencyList[node]?.length > 0) {
      dfs(node);
    }
  }

  if (deepChains.length === 0) return [];

  deepChains.sort((a, b) => b.length - a.length);
  const uniqueChains = [];
  const seen = new Set();
  for (const chain of deepChains) {
    const key = chain.join('->');
    if (!seen.has(key)) {
      seen.add(key);
      uniqueChains.push(chain);
    }
    if (uniqueChains.length >= 3) break;
  }
  return uniqueChains;
}

export function generateOptimizationSuggestions(graph, compileOrder, totalFiles) {
  const suggestions = [];

  const highDepFiles = findHighDependencyFiles(graph, 3);
  for (const { fileId, dependentCount } of highDepFiles) {
    suggestions.push({
      type: 'split',
      message: `💡 考虑将 <strong>${fileId}</strong> 拆分为更细粒度的模块以减少级联重编译（当前被 ${dependentCount} 个文件直接依赖）`
    });
  }

  if (totalFiles > 0 && compileOrder.length / totalFiles > 0.6) {
    suggestions.push({
      type: 'scope',
      message: `⚠️ 本次修改影响范围过大（编译 ${compileOrder.length}/${totalFiles} 个文件，占比 ${Math.round(compileOrder.length / totalFiles * 100)}%），建议检查是否可以缩小接口变更范围`
    });
  }

  const deepChains = findDeepDependencyChains(graph, 3);
  for (const chain of deepChains) {
    suggestions.push({
      type: 'chain',
      message: `🔗 依赖链过深（${chain.join(' → ')}，深度 ${chain.length - 1} 层），考虑引入中间抽象层`
    });
  }

  return suggestions;
}
