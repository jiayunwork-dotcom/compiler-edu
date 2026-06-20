export const LEVELS = [
  {
    id: 1,
    title: '识别简单Token',
    module: 'lexer',
    description: '理解词法分析的基本概念，识别源代码中的关键字、标识符和数字。',
    objective: '分析给定代码，识别所有Token并正确分类。',
    initialCode: `int main() {
  int x = 42;
  return x;
}`,
    task: '点击"开始分析"，观察Token序列并识别出关键字、标识符和数字字面量。',
    hints: [
      '关键字是语言预定义的词，如 int、return 等',
      '标识符是用户定义的名字，如 main、x',
      '数字字面量是直接写的数值，如 42'
    ],
    validation: { type: 'tokens', count: 14, types: ['关键字', '标识符', '数字字面量', '分隔符', '运算符'] }
  },
  {
    id: 2,
    title: '词法规则定义',
    module: 'lexer',
    description: '学习如何用正则表达式定义词法规则。',
    objective: '为十六进制数字编写正则表达式规则。',
    initialRules: [
      { regex: '[a-zA-Z][a-zA-Z0-9]*', type: '标识符', label: '标识符' },
      { regex: '[0-9]+', type: '数字字面量', label: '十进制数' },
      { regex: '0x[0-9a-fA-F]+', type: '数字字面量', label: '十六进制数' }
    ],
    testCode: `x = 0xFF;
y = 123;
z = 0x1a3;`,
    task: '确保十六进制数字（如0xFF、0x1a3）被正确识别为数字字面量。',
    hints: [
      '0x 是十六进制前缀',
      '十六进制数字包含 0-9, a-f, A-F',
      '使用 + 表示一个或多个'
    ],
    validation: { type: 'hex_tokens' }
  },
  {
    id: 3,
    title: '贪心匹配策略',
    module: 'lexer',
    description: '理解最长匹配（贪心匹配）原则。',
    objective: '观察逐字符步进时，DFA如何找到最长匹配。',
    initialCode: `ifx = 123;
iffy = 456;`,
    task: '使用步进模式，观察为什么 ifx 被识别为标识符而不是关键字if加标识符x。',
    hints: [
      '词法分析器总是选择最长的匹配',
      'ifx 作为一个整体匹配标识符规则',
      '如果在if后停止，就不是最长匹配了'
    ],
    validation: { type: 'greedy' }
  },
  {
    id: 4,
    title: '简单正则表达式',
    module: 'regex',
    description: '学习基础正则表达式语法：字符、连接、选择、闭包。',
    objective: '将正则表达式 a(b|c)* 转换为NFA。',
    initialRegex: 'a(b|c)*',
    task: '输入正则表达式并观察转换过程，理解每一步的构造。',
    hints: [
      '连接用点(.)表示，虽然通常省略',
      '| 表示选择（或）',
      '* 表示Kleene闭包（0次或多次）'
    ],
    validation: { type: 'regex_nfa' }
  },
  {
    id: 5,
    title: 'Thompson构造法',
    module: 'regex',
    description: '深入理解从正则表达式到NFA的Thompson构造算法。',
    objective: '将正则表达式 (a|b)*abb 转换为NFA。',
    initialRegex: '(a|b)*abb',
    task: '逐步观察Thompson构造如何组合基本的NFA片段。',
    hints: [
      '每个符号对应一个基本NFA',
      '连接操作是串接两个NFA',
      '选择操作创建新起点和终点，用ε连接',
      '闭包操作添加回边和ε跳变'
    ],
    validation: { type: 'thompson' }
  },
  {
    id: 6,
    title: '子集构造法',
    module: 'regex',
    description: '学习如何将NFA转换为DFA的子集构造算法。',
    objective: '将给定的NFA转换为等价的DFA。',
    initialRegex: '(a|b)*ab',
    task: '观察ε闭包计算和状态合并过程。',
    hints: [
      'ε闭包包含所有通过ε边可达的状态',
      '每个DFA状态对应一个NFA状态集合',
      '字母表上的每个符号需要计算move和闭包'
    ],
    validation: { type: 'subset_construction' }
  },
  {
    id: 7,
    title: 'DFA最小化',
    module: 'regex',
    description: '学习Hopcroft算法进行DFA状态最小化。',
    objective: '观察等价状态的合并过程。',
    initialRegex: 'a*b*a*b*',
    task: '观察Hopcroft算法如何划分等价类并合并状态。',
    hints: [
      '初始划分：接受状态和非接受状态',
      '根据转移状态的等价性细分',
      '不可区分的状态可以合并'
    ],
    validation: { type: 'dfa_minimize' }
  },
  {
    id: 8,
    title: 'First集计算',
    module: 'll1',
    description: '学习计算文法符号的First集合。',
    objective: '为算术表达式文法计算所有非终结符的First集。',
    initialGrammar: `E → T E'
E' → + T E' | ε
T → F T'
T' → * F T' | ε
F → ( E ) | id`,
    task: '展开递归步骤，验证First(E)、First(T)、First(F)等结果。',
    hints: [
      '终结符的First集是它自身',
      '如果产生式以终结符开头，将其加入',
      '如果所有符号都能推导出ε，则将ε加入'
    ],
    validation: { type: 'first_set' }
  },
  {
    id: 9,
    title: 'Follow集计算',
    module: 'll1',
    description: '学习计算非终结符的Follow集合。',
    objective: '为算术表达式文法计算所有非终结符的Follow集。',
    initialGrammar: `E → T E'
E' → + T E' | ε
T → F T'
T' → * F T' | ε
F → ( E ) | id`,
    task: '展开递归步骤，验证Follow(E)、Follow(T)等结果。',
    hints: [
      '$加入开始符号的Follow集',
      'A→αBβ 中，将First(β)除ε外加入Follow(B)',
      'A→αB 或 β可推导出ε，将Follow(A)加入Follow(B)'
    ],
    validation: { type: 'follow_set' }
  },
  {
    id: 10,
    title: '构建LL(1)预测表',
    module: 'll1',
    description: '基于First和Follow集构建LL(1)预测分析表。',
    objective: '为算术表达式文法构建无冲突的预测分析表。',
    initialGrammar: `E → T E'
E' → + T E' | ε
T → F T'
T' → * F T' | ε
F → ( E ) | id`,
    task: '检查预测分析表是否存在冲突，并验证填入的产生式。',
    hints: [
      '产生式 A→α 填入 First(α) 中的每个终结符',
      '如果 α 可推导出ε，还需填入 Follow(A) 中的每个终结符',
      '同一格有多个产生式就是LL(1)冲突'
    ],
    validation: { type: 'll1_table' }
  },
  {
    id: 11,
    title: 'LL(1)分析模拟',
    module: 'll1',
    description: '模拟LL(1)分析栈的工作过程。',
    objective: '使用预测分析表分析输入串 id + id * id。',
    initialGrammar: `E → T E'
E' → + T E' | ε
T → F T'
T' → * F T' | ε
F → ( E ) | id`,
    testInput: 'id + id * id',
    task: '逐步推进分析过程，理解栈操作、匹配和展开的含义。',
    hints: [
      '栈顶是终结符且匹配输入时弹出并前进',
      '栈顶是非终结符时查表展开',
      '栈中只剩 $ 且输入也读完时接受'
    ],
    validation: { type: 'll1_simulate' }
  },
  {
    id: 12,
    title: '检测左递归',
    module: 'tools',
    description: '识别文法中的直接左递归和间接左递归。',
    objective: '检测给定文法中的左递归。',
    initialGrammar: `E → E + T | T
T → T * F | F
F → ( E ) | id`,
    task: '观察检测结果，找出哪些产生式是左递归的。',
    hints: [
      '直接左递归：A → Aα',
      '间接左递归：A ⇒+ Aα 经过多步推导',
      '左递归会导致LL(1)分析无限循环'
    ],
    validation: { type: 'detect_left_recursion' }
  },
  {
    id: 13,
    title: '消除左递归',
    module: 'tools',
    description: '学习消除直接左递归和间接左递归的方法。',
    objective: '消除文法中的左递归使其满足LL(1)条件。',
    initialGrammar: `E → E + T | E - T | T
T → T * F | T / F | F
F → ( E ) | id`,
    task: '应用左递归消除算法，观察修改前后的产生式对比。',
    hints: [
      'A → Aα | β 改写为 A → βA\' 和 A\' → αA\' | ε',
      '间接左递归需要先按顺序展开',
      '消除后应该没有产生式以自身开头'
    ],
    validation: { type: 'eliminate_left_recursion' }
  },
  {
    id: 14,
    title: '提取左因子',
    module: 'tools',
    description: '学习提取公共左因子的文法变换方法。',
    objective: '为if语句文法提取左因子消除回溯。',
    initialGrammar: `Stmt → if ( Expr ) Stmt
Stmt → if ( Expr ) Stmt else Stmt
Stmt → other
Expr → true | false`,
    task: '观察左因子提取前后的文法变化。',
    hints: [
      'A → αβ1 | αβ2 改写为 A → αA\' 和 A\' → β1 | β2',
      '公共前缀可能出现在任意位置',
      '提取后每个产生式的First集互不相交'
    ],
    validation: { type: 'left_factor' }
  },
  {
    id: 15,
    title: 'LR(0)和LR(1)项',
    module: 'lr1',
    description: '理解LR项和展望符的概念。',
    objective: '观察闭包(Closure)计算中如何添加LR(1)项。',
    initialGrammar: `E → E + T | T
T → T * F | F
F → ( E ) | id`,
    task: '展开项集族的构建过程，观察GOTO函数的转移。',
    hints: [
      'LR(0)项：在产生式体中加点表示当前位置',
      'LR(1)项 = LR(0)项 + 展望符集合',
      '展望符决定何时可以归约'
    ],
    validation: { type: 'lr1_items' }
  },
  {
    id: 16,
    title: '构建LR(1)分析表',
    module: 'lr1',
    description: '构建Action-Goto分析表。',
    objective: '为算术表达式文法生成完整的LR(1)分析表。',
    initialGrammar: `E → E + T | T
T → T * F | F
F → ( E ) | id`,
    task: '观察分析表中的移入、归约、接受动作，检查是否有冲突。',
    hints: [
      'Action表：状态×终结符，有移位/归约/接受/错误',
      'Goto表：状态×非终结符，记录转移状态',
      '蓝色是移入，绿色是归约，金色是接受'
    ],
    validation: { type: 'lr1_table' }
  },
  {
    id: 17,
    title: 'LR(1)分析模拟',
    module: 'lr1',
    description: '模拟LR(1)分析器的双栈工作过程。',
    objective: '分析输入串 id + id * id。',
    initialGrammar: `E → E + T | T
T → T * F | F
F → ( E ) | id`,
    testInput: 'id + id * id',
    task: '逐步推进分析，理解状态栈和符号栈的配合。',
    hints: [
      '状态栈记录状态，符号栈记录已识别的文法符号',
      '移入动作：将输入和新状态压栈',
      '归约动作：弹出r个符号，按产生式归约后GOTO转移'
    ],
    validation: { type: 'lr1_simulate' }
  },
  {
    id: 18,
    title: '处理分析冲突',
    module: 'lr1',
    description: '识别并理解移入-归约冲突和归约-归约冲突。',
    objective: '观察二义性文法产生的冲突并学习解决方法。',
    initialGrammar: `E → E + E
E → E * E
E → ( E )
E → id`,
    testInput: 'id + id * id',
    task: '观察冲突标注，思考如何通过优先级和结合性解决。',
    hints: [
      '二义性文法会导致分析冲突',
      '*优先级高于+可以解决移入归约冲突',
      '左结合可以通过先归约解决'
    ],
    validation: { type: 'lr1_conflict' }
  },
  {
    id: 19,
    title: '语法树可视化',
    module: 'tree',
    description: '理解具体语法树(CST)和抽象语法树(AST)的区别。',
    objective: '对比同一输入的CST和AST视图。',
    initialGrammar: `E → T E'
E' → + T E' | ε
T → F T'
T' → * F T' | ε
F → ( E ) | id`,
    testInput: 'id + id * id',
    task: '切换CST和AST视图，观察简化过程。',
    hints: [
      'CST包含所有文法符号，包括ε和辅助非终结符',
      'AST去掉了无关的语法细节',
      'AST更适合后续的语义分析'
    ],
    validation: { type: 'syntax_tree' }
  },
  {
    id: 20,
    title: '综合挑战：自定义分析',
    module: 'custom',
    description: '综合运用所学知识处理一个完整的例子。',
    objective: '为自定义文法选择合适的分析方法并验证。',
    initialGrammar: `S → if E then S else S | if E then S | a
E → b`,
    testInput: 'if b then if b then a else a',
    task: '分析文法问题，使用工具修复，然后成功解析测试串。',
    hints: [
      '这个文法有二义性（悬空else问题）',
      '尝试提取左因子或使用LR方法',
      '检查是否满足LL(1)条件，或使用LR(1)'
    ],
    validation: { type: 'custom_parse' }
  }
];

export function getLevel(id) {
  return LEVELS.find(l => l.id === id);
}

export function getLevelsByModule(moduleName) {
  return LEVELS.filter(l => l.module === moduleName);
}
