import { parseGrammar, computeFirst, computeFollow, buildLL1Table } from './src/lib/parser/grammar.js';
import { EXAMPLE_GRAMMARS } from './src/data/examples.js';

console.log('=== 测试 computeFollow 的不同参数类型 ===\n');

try {
  const grammarText = EXAMPLE_GRAMMARS.arithmetic.grammar;
  const productions = parseGrammar(grammarText);
  console.log('Productions:', productions.length);
  
  const firstResult = computeFirst(productions);
  console.log('First set size:', firstResult.first.size);
  console.log('computeFirstString type:', typeof firstResult.computeFirstString);
  
  console.log('\n--- 测试1: 传入函数参数 ---');
  try {
    const followResult1 = computeFollow(productions, firstResult.computeFirstString);
    console.log('✓ 成功，Follow set size:', followResult1.follow.size);
  } catch (e) {
    console.log('✗ 失败:', e.message);
  }
  
  console.log('\n--- 测试2: 传入 Map 参数 ---');
  try {
    const followResult2 = computeFollow(productions, firstResult.first);
    console.log('✓ 成功，Follow set size:', followResult2.follow.size);
  } catch (e) {
    console.log('✗ 失败:', e.message);
  }
  
  console.log('\n--- 测试3: 验证两种方式结果一致 ---');
  const followResult1 = computeFollow(productions, firstResult.computeFirstString);
  const followResult2 = computeFollow(productions, firstResult.first);
  
  let resultsMatch = true;
  for (const [nt, set1] of followResult1.follow) {
    const set2 = followResult2.follow.get(nt);
    if (!set2 || set1.size !== set2.size) {
      resultsMatch = false;
      break;
    }
    for (const s of set1) {
      if (!set2.has(s)) {
        resultsMatch = false;
        break;
      }
    }
  }
  
  if (resultsMatch) {
    console.log('✓ 两种方式结果一致');
  } else {
    console.log('✗ 两种方式结果不一致');
  }
  
  console.log('\n--- 测试4: 传入无效参数 ---');
  try {
    const followResult3 = computeFollow(productions, 'invalid');
    console.log('✗ 应该抛出错误但没有');
  } catch (e) {
    console.log('✓ 正确抛出错误:', e.message);
  }
  
  console.log('\n--- 测试5: 完整流程（使用 Map 参数）---');
  try {
    const tableResult = buildLL1Table(productions, firstResult.first, followResult2.follow);
    console.log('✓ 预测分析表构建成功');
    console.log('  非终结符:', tableResult.nonTerminals.length);
    console.log('  终结符:', tableResult.terminals.length);
    console.log('  冲突:', tableResult.conflicts.length);
  } catch (e) {
    console.log('✗ 失败:', e.message);
    console.log('  Stack:', e.stack);
  }
  
  console.log('\n=== 所有测试完成 ===');
  
} catch (e) {
  console.error('\n❌ 致命错误:', e.message);
  console.error('Stack:', e.stack);
}
