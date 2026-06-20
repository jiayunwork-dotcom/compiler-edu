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
}`
};
