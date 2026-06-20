export const EXAMPLE_GRAMMARS = {
  arithmetic: {
    name: '算术表达式文法',
    description: '带优先级和结合性的算术表达式文法',
    grammar: `E → E + T | E - T | T
T → T * F | T / F | F
F → ( E ) | id | num`
  },
  arithmetic_ll1: {
    name: '算术表达式(LL(1))',
    description: '消除左递归后的LL(1)算术表达式文法',
    grammar: `E → T E'
E' → + T E' | - T E' | ε
T → F T'
T' → * F T' | / F T' | ε
F → ( E ) | id | num`
  },
  minic: {
    name: 'Mini-C子集',
    description: '包含if/while/赋值/函数调用的简化C文法',
    grammar: `Program → StmtList
StmtList → Stmt ; StmtList | Stmt
Stmt → Assign | IfStmt | WhileStmt | Block | FuncCall
Assign → id = Expr
IfStmt → if ( Expr ) Stmt ElseOpt
ElseOpt → else Stmt | ε
WhileStmt → while ( Expr ) Stmt
Block → { StmtList }
FuncCall → id ( ArgList )
ArgList → Expr , ArgList | Expr | ε
Expr → Expr + Term | Expr - Term | Term
Term → Term * Factor | Term / Factor | Factor
Factor → id | num | ( Expr ) | FuncCall`
  },
  json: {
    name: 'JSON文法',
    description: 'JSON数据格式文法',
    grammar: `Value → Object | Array | String | Number | true | false | null
Object → { Members }
Members → Pair , Members | Pair | ε
Pair → String : Value
Array → [ Elements ]
Elements → Value , Elements | Value | ε`
  },
  regex: {
    name: '正则表达式文法',
    description: '正则表达式本身的文法定义',
    grammar: `Regex → Alt
Alt → Alt | Seq | Seq
Seq → Seq Atom | Atom
Atom → Atom * | Atom + | Atom ? | Prim
Prim → ( Regex ) | Char | ε`
  },
  simple_expr: {
    name: '简单表达式',
    description: '最简单的表达式文法，适合教学演示',
    grammar: `E → E + E | E * E | ( E ) | id`
  }
};

export const DEFAULT_CODE_SAMPLES = {
  simple: `int x = 42;
float y = 3.14;
if (x > 0) {
  return x + y;
}`,
  expression: `3 + 4 * 2 / ( 1 - 5 )`,
  json_style: `{
  "name": "test",
  "value": 123,
  "items": [1, 2, 3]
}`,
  semantic_demo1: `// 示例1: 基础变量声明、函数与作用域
int global_count = 100;
float global_pi = 3.14159;

int add(int a, int b) {
  int result = a + b;
  return result;
}

float calculate_area(float radius) {
  float pi = 3.14159;
  float area = pi * radius * radius;
  return area;
}

int main() {
  int x = 10;
  int y = 20;
  int sum = add(x, y);
  float r = 5.5;
  float a = calculate_area(r);
  bool positive = (sum > 0);
  return 0;
}`,
  semantic_demo2: `// 示例2: 包含多种类型错误的演示代码
int x = 42;
float y = 3.14;
bool flag = true;

// 错误1: bool不能参与算术运算
int error1 = x + flag;

// 错误2: 不能将float赋给int
int error2 = y;

// 错误3: 函数参数类型不匹配
float square(float num) {
  return num * num;
}
int z = square(flag);

// 错误4: if条件必须是bool
if (x) {
  int w = 1;
}

// 错误5: 未定义的变量
int result = undefined_var + 1;

// 正确: int与float运算结果为float(隐式提升)
float mixed = x + y;`,
  semantic_demo3: `// 示例3: 嵌套作用域与变量遮蔽演示
int level0 = 0;

void scope_demo() {
  int level1 = 1;
  float shared = 1.5;

  if (level1 > 0) {
    int level2 = 2;
    float shared = 2.5;
    {
      int level3 = 3;
      float shared = 3.5;
      bool ok = true;
    }
  }

  while (level1 < 5) {
    int loop_var = level1 * 2;
    level1 = level1 + 1;
  }
}

void outer() {
  int a = 10;
  {
    int a = 20;
    int b = a + 1;
  }
  int c = a + 1;
}`
};

export const INCREMENTAL_PROJECTS = {
  diamond_demo: {
    name: '菱形依赖示例',
    description: 'A依赖B和C，B和C都依赖D',
    files: {
      'main': {
        name: 'main.c',
        content: `// 主程序入口
import { compute } from logic;
import { print } from utils;

int main() {
  int x = 10;
  int y = 20;
  int result = compute(x, y);
  print(result);
  return 0;
}`
      },
      'logic': {
        name: 'logic.c',
        content: `// 业务逻辑模块
import { add } from math;
import { multiply } from math;

int compute(int a, int b) {
  int sum = add(a, b);
  int product = multiply(a, b);
  return add(sum, product);
}`
      },
      'utils': {
        name: 'utils.c',
        content: `// 工具函数模块
import { format } from math;

void print(int value) {
  int formatted = format(value);
  // 输出格式化后的值
  int output = formatted;
}`
      },
      'math': {
        name: 'math.c',
        content: `// 数学基础库
int add(int a, int b) {
  return a + b;
}

int multiply(int a, int b) {
  return a * b;
}

int format(int num) {
  if (num < 0) {
    return num * -1;
  }
  return num;
}`
      }
    }
  }
};
