// ==================== Token Types ====================
export const TOKEN_TYPE = {
  INT: 'INT',
  FLOAT: 'FLOAT',
  BOOL: 'BOOL',
  VOID: 'VOID',
  RETURN: 'RETURN',
  IF: 'IF',
  ELSE: 'ELSE',
  WHILE: 'WHILE',
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  IDENTIFIER: 'IDENTIFIER',
  NUMBER: 'NUMBER',
  FLOAT_NUMBER: 'FLOAT_NUMBER',
  PLUS: 'PLUS',
  MINUS: 'MINUS',
  STAR: 'STAR',
  SLASH: 'SLASH',
  ASSIGN: 'ASSIGN',
  EQ: 'EQ',
  NEQ: 'NEQ',
  LT: 'LT',
  GT: 'GT',
  LE: 'LE',
  GE: 'GE',
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  LBRACE: 'LBRACE',
  RBRACE: 'RBRACE',
  SEMICOLON: 'SEMICOLON',
  COMMA: 'COMMA',
  EOF: 'EOF',
  ERROR: 'ERROR'
};

const KEYWORDS = {
  'int': TOKEN_TYPE.INT,
  'float': TOKEN_TYPE.FLOAT,
  'bool': TOKEN_TYPE.BOOL,
  'void': TOKEN_TYPE.VOID,
  'return': TOKEN_TYPE.RETURN,
  'if': TOKEN_TYPE.IF,
  'else': TOKEN_TYPE.ELSE,
  'while': TOKEN_TYPE.WHILE,
  'true': TOKEN_TYPE.TRUE,
  'false': TOKEN_TYPE.FALSE
};

// ==================== Lexer ====================
export function createLexer(source) {
  return {
    source,
    pos: 0,
    line: 1,
    column: 1,
    startPos: 0,
    startLine: 1,
    startColumn: 1
  };
}

function peekChar(lexer, offset = 0) {
  return lexer.source[lexer.pos + offset] || '\0';
}

function advanceChar(lexer) {
  const ch = lexer.source[lexer.pos];
  lexer.pos++;
  if (ch === '\n') {
    lexer.line++;
    lexer.column = 1;
  } else {
    lexer.column++;
  }
  return ch;
}

function skipWhitespaceAndComments(lexer) {
  while (lexer.pos < lexer.source.length) {
    const ch = peekChar(lexer);
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      advanceChar(lexer);
    } else if (ch === '/' && peekChar(lexer, 1) === '/') {
      while (lexer.pos < lexer.source.length && peekChar(lexer) !== '\n') {
        advanceChar(lexer);
      }
    } else if (ch === '/' && peekChar(lexer, 1) === '*') {
      advanceChar(lexer);
      advanceChar(lexer);
      while (lexer.pos < lexer.source.length) {
        if (peekChar(lexer) === '*' && peekChar(lexer, 1) === '/') {
          advanceChar(lexer);
          advanceChar(lexer);
          break;
        }
        advanceChar(lexer);
      }
    } else {
      break;
    }
  }
}

function makeToken(lexer, type, value = null) {
  return {
    type,
    value: value !== null ? value : lexer.source.substring(lexer.startPos, lexer.pos),
    line: lexer.startLine,
    column: lexer.startColumn,
    start: lexer.startPos,
    end: lexer.pos
  };
}

function readNumber(lexer) {
  const startPos = lexer.pos;
  let isFloat = false;
  while (lexer.pos < lexer.source.length && /[0-9]/.test(peekChar(lexer))) {
    advanceChar(lexer);
  }
  if (peekChar(lexer) === '.' && /[0-9]/.test(peekChar(lexer, 1))) {
    isFloat = true;
    advanceChar(lexer);
    while (lexer.pos < lexer.source.length && /[0-9]/.test(peekChar(lexer))) {
      advanceChar(lexer);
    }
  }
  const value = lexer.source.substring(startPos, lexer.pos);
  return makeToken(lexer, isFloat ? TOKEN_TYPE.FLOAT_NUMBER : TOKEN_TYPE.NUMBER, value);
}

function readIdentifier(lexer) {
  const startPos = lexer.pos;
  while (lexer.pos < lexer.source.length && /[a-zA-Z0-9_]/.test(peekChar(lexer))) {
    advanceChar(lexer);
  }
  const word = lexer.source.substring(startPos, lexer.pos);
  const type = KEYWORDS[word] || TOKEN_TYPE.IDENTIFIER;
  return makeToken(lexer, type, word);
}

export function nextToken(lexer) {
  skipWhitespaceAndComments(lexer);
  lexer.startPos = lexer.pos;
  lexer.startLine = lexer.line;
  lexer.startColumn = lexer.column;

  if (lexer.pos >= lexer.source.length) {
    return makeToken(lexer, TOKEN_TYPE.EOF, '');
  }

  const ch = peekChar(lexer);

  if (/[a-zA-Z_]/.test(ch)) {
    return readIdentifier(lexer);
  }

  if (/[0-9]/.test(ch)) {
    return readNumber(lexer);
  }

  advanceChar(lexer);

  switch (ch) {
    case '+': return makeToken(lexer, TOKEN_TYPE.PLUS, '+');
    case '-': return makeToken(lexer, TOKEN_TYPE.MINUS, '-');
    case '*': return makeToken(lexer, TOKEN_TYPE.STAR, '*');
    case '/': return makeToken(lexer, TOKEN_TYPE.SLASH, '/');
    case '=':
      if (peekChar(lexer) === '=') { advanceChar(lexer); return makeToken(lexer, TOKEN_TYPE.EQ, '=='); }
      return makeToken(lexer, TOKEN_TYPE.ASSIGN, '=');
    case '!':
      if (peekChar(lexer) === '=') { advanceChar(lexer); return makeToken(lexer, TOKEN_TYPE.NEQ, '!='); }
      return makeToken(lexer, TOKEN_TYPE.NOT, '!');
    case '<':
      if (peekChar(lexer) === '=') { advanceChar(lexer); return makeToken(lexer, TOKEN_TYPE.LE, '<='); }
      return makeToken(lexer, TOKEN_TYPE.LT, '<');
    case '>':
      if (peekChar(lexer) === '=') { advanceChar(lexer); return makeToken(lexer, TOKEN_TYPE.GE, '>='); }
      return makeToken(lexer, TOKEN_TYPE.GT, '>');
    case '&':
      if (peekChar(lexer) === '&') { advanceChar(lexer); return makeToken(lexer, TOKEN_TYPE.AND, '&&'); }
      break;
    case '|':
      if (peekChar(lexer) === '|') { advanceChar(lexer); return makeToken(lexer, TOKEN_TYPE.OR, '||'); }
      break;
    case '(': return makeToken(lexer, TOKEN_TYPE.LPAREN, '(');
    case ')': return makeToken(lexer, TOKEN_TYPE.RPAREN, ')');
    case '{': return makeToken(lexer, TOKEN_TYPE.LBRACE, '{');
    case '}': return makeToken(lexer, TOKEN_TYPE.RBRACE, '}');
    case ';': return makeToken(lexer, TOKEN_TYPE.SEMICOLON, ';');
    case ',': return makeToken(lexer, TOKEN_TYPE.COMMA, ',');
  }

  return makeToken(lexer, TOKEN_TYPE.ERROR, ch);
}

export function tokenizeAll(source) {
  const lexer = createLexer(source);
  const tokens = [];
  while (true) {
    const token = nextToken(lexer);
    tokens.push(token);
    if (token.type === TOKEN_TYPE.EOF || token.type === TOKEN_TYPE.ERROR) break;
  }
  return tokens;
}

// ==================== AST Node Types ====================
export const NODE_TYPE = {
  PROGRAM: 'PROGRAM',
  VAR_DECL: 'VAR_DECL',
  FUNC_DECL: 'FUNC_DECL',
  PARAM: 'PARAM',
  BLOCK: 'BLOCK',
  ASSIGN: 'ASSIGN',
  RETURN_STMT: 'RETURN_STMT',
  IF_STMT: 'IF_STMT',
  WHILE_STMT: 'WHILE_STMT',
  EXPR_STMT: 'EXPR_STMT',
  BINARY_EXPR: 'BINARY_EXPR',
  UNARY_EXPR: 'UNARY_EXPR',
  CALL_EXPR: 'CALL_EXPR',
  NUMBER_LITERAL: 'NUMBER_LITERAL',
  BOOL_LITERAL: 'BOOL_LITERAL',
  IDENTIFIER: 'IDENTIFIER'
};

// ==================== Parser (Recursive Descent) ====================
export class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.errors = [];
  }

  current() {
    return this.tokens[this.pos];
  }

  peek(offset = 1) {
    return this.tokens[this.pos + offset] || this.tokens[this.tokens.length - 1];
  }

  consume() {
    return this.tokens[this.pos++];
  }

  check(type) {
    return this.current().type === type;
  }

  match(...types) {
    if (types.includes(this.current().type)) {
      return this.consume();
    }
    return null;
  }

  expect(type, message = null) {
    if (this.check(type)) {
      return this.consume();
    }
    const token = this.current();
    this.errors.push({
      line: token.line,
      column: token.column,
      message: message || `期望 ${type}, 但遇到 ${token.value || token.type}`,
      start: token.start,
      end: token.end
    });
    return token;
  }

  parse() {
    return this.parseProgram();
  }

  parseProgram() {
    const declarations = [];
    const start = this.current().start;
    while (!this.check(TOKEN_TYPE.EOF)) {
      const decl = this.parseDeclaration();
      if (decl) declarations.push(decl);
      else this.consume();
    }
    return {
      type: NODE_TYPE.PROGRAM,
      declarations,
      start,
      end: this.tokens[this.tokens.length - 1].end
    };
  }

  parseDeclaration() {
    const typeToken = this.match(TOKEN_TYPE.INT, TOKEN_TYPE.FLOAT, TOKEN_TYPE.BOOL, TOKEN_TYPE.VOID);
    if (!typeToken) {
      if (this.check(TOKEN_TYPE.IDENTIFIER)) {
        return this.parseStatement();
      }
      return null;
    }

    const dataType = typeToken.value;
    const idToken = this.current();

    if (this.check(TOKEN_TYPE.IDENTIFIER) && this.peek(1).type === TOKEN_TYPE.LPAREN) {
      return this.parseFunctionDeclaration(dataType, idToken);
    }

    return this.parseVariableDeclaration(dataType);
  }

  parseVariableDeclaration(dataType) {
    const idToken = this.expect(TOKEN_TYPE.IDENTIFIER, '期望变量名');
    const name = idToken.value;
    let initExpr = null;

    if (this.match(TOKEN_TYPE.ASSIGN)) {
      initExpr = this.parseExpression();
    }

    this.expect(TOKEN_TYPE.SEMICOLON, '期望 ";"');

    return {
      type: NODE_TYPE.VAR_DECL,
      dataType,
      name,
      initExpr,
      line: idToken.line,
      column: idToken.column,
      nameStart: idToken.start,
      nameEnd: idToken.end,
      start: idToken.start,
      end: this.tokens[this.pos - 1].end
    };
  }

  parseFunctionDeclaration(returnType, idToken) {
    const funcId = this.expect(TOKEN_TYPE.IDENTIFIER, '期望函数名');
    this.expect(TOKEN_TYPE.LPAREN, '期望 "("');
    const params = [];

    if (!this.check(TOKEN_TYPE.RPAREN)) {
      params.push(this.parseParameter());
      while (this.match(TOKEN_TYPE.COMMA)) {
        params.push(this.parseParameter());
      }
    }

    this.expect(TOKEN_TYPE.RPAREN, '期望 ")"');
    const body = this.parseBlock();

    return {
      type: NODE_TYPE.FUNC_DECL,
      returnType,
      name: funcId.value,
      params,
      body,
      line: funcId.line,
      column: funcId.column,
      nameStart: funcId.start,
      nameEnd: funcId.end,
      start: idToken.start,
      end: body ? body.end : this.tokens[this.pos - 1].end
    };
  }

  parseParameter() {
    const typeToken = this.match(TOKEN_TYPE.INT, TOKEN_TYPE.FLOAT, TOKEN_TYPE.BOOL);
    if (!typeToken) {
      const errTok = this.current();
      this.errors.push({ line: errTok.line, message: '期望参数类型', start: errTok.start, end: errTok.end });
      return null;
    }
    const dataType = typeToken.value;
    const idToken = this.expect(TOKEN_TYPE.IDENTIFIER, '期望参数名');
    return {
      type: NODE_TYPE.PARAM,
      dataType,
      name: idToken.value,
      line: idToken.line,
      column: idToken.column,
      nameStart: idToken.start,
      nameEnd: idToken.end,
      start: typeToken.start,
      end: idToken.end
    };
  }

  parseBlock() {
    const lBrace = this.match(TOKEN_TYPE.LBRACE);
    if (!lBrace) {
      const errTok = this.current();
      this.errors.push({ line: errTok.line, message: '期望 "{"', start: errTok.start, end: errTok.end });
      return { type: NODE_TYPE.BLOCK, statements: [], start: errTok.start, end: errTok.end, line: errTok.line };
    }

    const start = lBrace.start;
    const statements = [];

    while (!this.check(TOKEN_TYPE.RBRACE) && !this.check(TOKEN_TYPE.EOF)) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }

    const rBrace = this.expect(TOKEN_TYPE.RBRACE, '期望 "}"');
    return {
      type: NODE_TYPE.BLOCK,
      statements,
      start,
      end: rBrace.end,
      line: lBrace.line,
      lineEnd: rBrace.line
    };
  }

  parseStatement() {
    if (this.check(TOKEN_TYPE.INT) || this.check(TOKEN_TYPE.FLOAT) || this.check(TOKEN_TYPE.BOOL) || this.check(TOKEN_TYPE.VOID)) {
      return this.parseDeclaration();
    }
    if (this.check(TOKEN_TYPE.LBRACE)) {
      return this.parseBlock();
    }
    if (this.match(TOKEN_TYPE.RETURN)) {
      const returnTok = this.tokens[this.pos - 1];
      let expr = null;
      if (!this.check(TOKEN_TYPE.SEMICOLON)) {
        expr = this.parseExpression();
      }
      this.expect(TOKEN_TYPE.SEMICOLON, '期望 ";"');
      return {
        type: NODE_TYPE.RETURN_STMT,
        expr,
        start: returnTok.start,
        end: this.tokens[this.pos - 1].end,
        line: returnTok.line
      };
    }
    if (this.match(TOKEN_TYPE.IF)) {
      const ifTok = this.tokens[this.pos - 1];
      this.expect(TOKEN_TYPE.LPAREN, '期望 "("');
      const condition = this.parseExpression();
      this.expect(TOKEN_TYPE.RPAREN, '期望 ")"');
      const thenBranch = this.parseStatement();
      let elseBranch = null;
      if (this.match(TOKEN_TYPE.ELSE)) {
        elseBranch = this.parseStatement();
      }
      return {
        type: NODE_TYPE.IF_STMT,
        condition,
        thenBranch,
        elseBranch,
        start: ifTok.start,
        end: elseBranch ? elseBranch.end : (thenBranch ? thenBranch.end : this.tokens[this.pos - 1].end),
        line: ifTok.line
      };
    }
    if (this.match(TOKEN_TYPE.WHILE)) {
      const whileTok = this.tokens[this.pos - 1];
      this.expect(TOKEN_TYPE.LPAREN, '期望 "("');
      const condition = this.parseExpression();
      this.expect(TOKEN_TYPE.RPAREN, '期望 ")"');
      const body = this.parseStatement();
      return {
        type: NODE_TYPE.WHILE_STMT,
        condition,
        body,
        start: whileTok.start,
        end: body ? body.end : this.tokens[this.pos - 1].end,
        line: whileTok.line
      };
    }

    return this.parseAssignOrExprStatement();
  }

  parseAssignOrExprStatement() {
    const startTok = this.current();
    const expr = this.parseExpression();
    if (expr && expr.type === NODE_TYPE.IDENTIFIER && this.match(TOKEN_TYPE.ASSIGN)) {
      const assignTok = this.tokens[this.pos - 1];
      const value = this.parseExpression();
      this.expect(TOKEN_TYPE.SEMICOLON, '期望 ";"');
      return {
        type: NODE_TYPE.ASSIGN,
        target: expr,
        value,
        start: expr.start,
        end: this.tokens[this.pos - 1].end,
        line: startTok.line,
        assignStart: assignTok.start,
        assignEnd: assignTok.end
      };
    }
    this.expect(TOKEN_TYPE.SEMICOLON, '期望 ";"');
    return {
      type: NODE_TYPE.EXPR_STMT,
      expr,
      start: startTok.start,
      end: this.tokens[this.pos - 1].end,
      line: startTok.line
    };
  }

  parseExpression() {
    return this.parseOrExpr();
  }

  parseOrExpr() {
    let left = this.parseAndExpr();
    while (this.match(TOKEN_TYPE.OR)) {
      const op = this.tokens[this.pos - 1];
      const right = this.parseAndExpr();
      left = {
        type: NODE_TYPE.BINARY_EXPR,
        operator: '||',
        left,
        right,
        start: left.start,
        end: right.end,
        line: op.line,
        opStart: op.start,
        opEnd: op.end
      };
    }
    return left;
  }

  parseAndExpr() {
    let left = this.parseEqualityExpr();
    while (this.match(TOKEN_TYPE.AND)) {
      const op = this.tokens[this.pos - 1];
      const right = this.parseEqualityExpr();
      left = {
        type: NODE_TYPE.BINARY_EXPR,
        operator: '&&',
        left,
        right,
        start: left.start,
        end: right.end,
        line: op.line,
        opStart: op.start,
        opEnd: op.end
      };
    }
    return left;
  }

  parseEqualityExpr() {
    let left = this.parseRelationalExpr();
    while (true) {
      const op = this.match(TOKEN_TYPE.EQ, TOKEN_TYPE.NEQ);
      if (!op) break;
      const right = this.parseRelationalExpr();
      left = {
        type: NODE_TYPE.BINARY_EXPR,
        operator: op.value,
        left,
        right,
        start: left.start,
        end: right.end,
        line: op.line,
        opStart: op.start,
        opEnd: op.end
      };
    }
    return left;
  }

  parseRelationalExpr() {
    let left = this.parseAdditiveExpr();
    while (true) {
      const op = this.match(TOKEN_TYPE.LT, TOKEN_TYPE.GT, TOKEN_TYPE.LE, TOKEN_TYPE.GE);
      if (!op) break;
      const right = this.parseAdditiveExpr();
      left = {
        type: NODE_TYPE.BINARY_EXPR,
        operator: op.value,
        left,
        right,
        start: left.start,
        end: right.end,
        line: op.line,
        opStart: op.start,
        opEnd: op.end
      };
    }
    return left;
  }

  parseAdditiveExpr() {
    let left = this.parseMultiplicativeExpr();
    while (true) {
      const op = this.match(TOKEN_TYPE.PLUS, TOKEN_TYPE.MINUS);
      if (!op) break;
      const right = this.parseMultiplicativeExpr();
      left = {
        type: NODE_TYPE.BINARY_EXPR,
        operator: op.value,
        left,
        right,
        start: left.start,
        end: right.end,
        line: op.line,
        opStart: op.start,
        opEnd: op.end
      };
    }
    return left;
  }

  parseMultiplicativeExpr() {
    let left = this.parseUnaryExpr();
    while (true) {
      const op = this.match(TOKEN_TYPE.STAR, TOKEN_TYPE.SLASH);
      if (!op) break;
      const right = this.parseUnaryExpr();
      left = {
        type: NODE_TYPE.BINARY_EXPR,
        operator: op.value,
        left,
        right,
        start: left.start,
        end: right.end,
        line: op.line,
        opStart: op.start,
        opEnd: op.end
      };
    }
    return left;
  }

  parseUnaryExpr() {
    const op = this.match(TOKEN_TYPE.MINUS, TOKEN_TYPE.NOT);
    if (op) {
      const operand = this.parseUnaryExpr();
      return {
        type: NODE_TYPE.UNARY_EXPR,
        operator: op.value,
        operand,
        start: op.start,
        end: operand.end,
        line: op.line
      };
    }
    return this.parsePrimaryExpr();
  }

  parsePrimaryExpr() {
    const token = this.current();

    if (this.match(TOKEN_TYPE.NUMBER)) {
      return {
        type: NODE_TYPE.NUMBER_LITERAL,
        value: token.value,
        dataType: 'int',
        start: token.start,
        end: token.end,
        line: token.line
      };
    }

    if (this.match(TOKEN_TYPE.FLOAT_NUMBER)) {
      return {
        type: NODE_TYPE.NUMBER_LITERAL,
        value: token.value,
        dataType: 'float',
        start: token.start,
        end: token.end,
        line: token.line
      };
    }

    if (this.match(TOKEN_TYPE.TRUE, TOKEN_TYPE.FALSE)) {
      return {
        type: NODE_TYPE.BOOL_LITERAL,
        value: token.value,
        dataType: 'bool',
        start: token.start,
        end: token.end,
        line: token.line
      };
    }

    if (this.match(TOKEN_TYPE.LPAREN)) {
      const expr = this.parseExpression();
      this.expect(TOKEN_TYPE.RPAREN, '期望 ")"');
      return expr;
    }

    if (this.check(TOKEN_TYPE.IDENTIFIER)) {
      const idTok = this.consume();
      if (this.match(TOKEN_TYPE.LPAREN)) {
        const args = [];
        if (!this.check(TOKEN_TYPE.RPAREN)) {
          args.push(this.parseExpression());
          while (this.match(TOKEN_TYPE.COMMA)) {
            args.push(this.parseExpression());
          }
        }
        const rParen = this.expect(TOKEN_TYPE.RPAREN, '期望 ")"');
        return {
          type: NODE_TYPE.CALL_EXPR,
          callee: idTok.value,
          args,
          start: idTok.start,
          end: rParen.end,
          line: idTok.line,
          nameStart: idTok.start,
          nameEnd: idTok.end
        };
      }
      return {
        type: NODE_TYPE.IDENTIFIER,
        name: idTok.value,
        start: idTok.start,
        end: idTok.end,
        line: idTok.line,
        column: idTok.column
      };
    }

    const errTok = this.consume();
    this.errors.push({
      line: errTok.line,
      message: `意外的符号: ${errTok.value}`,
      start: errTok.start,
      end: errTok.end
    });

    return {
      type: NODE_TYPE.IDENTIFIER,
      name: errTok.value,
      start: errTok.start,
      end: errTok.end,
      line: errTok.line
    };
  }
}

export function parseSource(source) {
  const tokens = tokenizeAll(source);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  return {
    ast,
    tokens,
    parseErrors: parser.errors
  };
}

// ==================== Symbol Table & Scope ====================
let scopeIdCounter = 0;

export function createScope(parent, name, kind = 'block', line = 1) {
  return {
    id: ++scopeIdCounter,
    name,
    kind,
    parent,
    children: [],
    symbols: new Map(),
    line,
    lineEnd: line
  };
}

export function defineSymbol(scope, name, dataType, kind, node) {
  const symbol = {
    name,
    dataType,
    kind,
    scope,
    line: node?.line || 1,
    column: node?.column || 1,
    nameStart: node?.nameStart ?? node?.start ?? 0,
    nameEnd: node?.nameEnd ?? node?.end ?? 0,
    references: [],
    declaration: node
  };
  scope.symbols.set(name, symbol);
  return symbol;
}

export function lookupSymbol(scope, name) {
  let current = scope;
  while (current) {
    if (current.symbols.has(name)) {
      return current.symbols.get(name);
    }
    current = current.parent;
  }
  return null;
}

export function lookupInScope(scope, name) {
  return scope.symbols.get(name) || null;
}

export function getScopeChain(scope) {
  const chain = [];
  let current = scope;
  while (current) {
    chain.unshift(current);
    current = current.parent;
  }
  return chain;
}

export function getVisibleSymbols(scope) {
  const visible = new Map();
  const chain = getScopeChain(scope);
  for (const s of chain) {
    for (const [name, sym] of s.symbols) {
      if (!visible.has(name)) {
        visible.set(name, sym);
      }
    }
  }
  return visible;
}

// ==================== Symbol Table Builder ====================
export function buildSymbolTable(ast) {
  const errors = [];
  const globalScope = createScope(null, '全局作用域', 'global', 1);
  let currentScope = globalScope;
  const allScopes = [globalScope];
  const allSymbols = [];
  const identifierRefs = [];

  function enterScope(name, kind, line) {
    const scope = createScope(currentScope, name, kind, line);
    currentScope.children.push(scope);
    currentScope = scope;
    allScopes.push(scope);
    return scope;
  }

  function leaveScope(node) {
    if (node && node.type === NODE_TYPE.BLOCK) {
      currentScope.lineEnd = node.lineEnd || currentScope.line;
    }
    if (currentScope.parent) {
      currentScope = currentScope.parent;
    }
  }

  function addReference(identNode, scope) {
    const sym = lookupSymbol(scope, identNode.name);
    identifierRefs.push({
      name: identNode.name,
      start: identNode.start,
      end: identNode.end,
      line: identNode.line,
      column: identNode.column,
      symbol: sym,
      resolved: !!sym
    });
    if (sym) {
      sym.references.push({
        start: identNode.start,
        end: identNode.end,
        line: identNode.line,
        column: identNode.column
      });
    }
    return sym;
  }

  function visitVarDecl(node) {
    if (lookupInScope(currentScope, node.name)) {
      errors.push({
        line: node.line,
        message: `符号 "${node.name}" 在此作用域中已声明`,
        start: node.nameStart,
        end: node.nameEnd,
        type: 'duplicate'
      });
    } else {
      const sym = defineSymbol(currentScope, node.name, node.dataType, 'variable', node);
      allSymbols.push(sym);
    }
    if (node.initExpr) {
      visitExpr(node.initExpr);
    }
  }

  function visitFuncDecl(node) {
    if (lookupInScope(globalScope, node.name)) {
      errors.push({
        line: node.line,
        message: `函数 "${node.name}" 已被声明`,
        start: node.nameStart,
        end: node.nameEnd,
        type: 'duplicate'
      });
    } else {
      const funcSym = defineSymbol(globalScope, node.name, node.returnType, 'function', node);
      funcSym.paramTypes = node.params.map(p => p?.dataType || 'int');
      funcSym.params = node.params;
      allSymbols.push(funcSym);
    }

    enterScope(`函数 ${node.name}`, 'function', node.line);

    for (const param of node.params || []) {
      if (!param) continue;
      if (lookupInScope(currentScope, param.name)) {
        errors.push({
          line: param.line,
          message: `参数 "${param.name}" 重复声明`,
          start: param.nameStart,
          end: param.nameEnd,
          type: 'duplicate'
        });
      } else {
        const sym = defineSymbol(currentScope, param.name, param.dataType, 'parameter', param);
        allSymbols.push(sym);
      }
    }

    if (node.body) {
      visitBlock(node.body, true);
    }

    leaveScope();
  }

  function visitBlock(node, isFuncBody = false) {
    if (!isFuncBody) {
      enterScope(`块 L${node.line}`, 'block', node.line);
    } else {
      currentScope.line = node.line;
    }
    for (const stmt of node.statements) {
      visitStmt(stmt);
    }
    currentScope.lineEnd = node.lineEnd || currentScope.line;
    if (!isFuncBody) {
      leaveScope(node);
    }
  }

  function visitStmt(node) {
    if (!node) return;
    switch (node.type) {
      case NODE_TYPE.VAR_DECL:
        visitVarDecl(node);
        break;
      case NODE_TYPE.FUNC_DECL:
        visitFuncDecl(node);
        break;
      case NODE_TYPE.BLOCK:
        visitBlock(node);
        break;
      case NODE_TYPE.ASSIGN:
        if (node.target.type === NODE_TYPE.IDENTIFIER) {
          addReference(node.target, currentScope);
        }
        if (node.value) visitExpr(node.value);
        break;
      case NODE_TYPE.RETURN_STMT:
        if (node.expr) visitExpr(node.expr);
        break;
      case NODE_TYPE.IF_STMT:
        if (node.condition) visitExpr(node.condition);
        if (node.thenBranch) visitStmt(node.thenBranch);
        if (node.elseBranch) visitStmt(node.elseBranch);
        break;
      case NODE_TYPE.WHILE_STMT:
        if (node.condition) visitExpr(node.condition);
        if (node.body) visitStmt(node.body);
        break;
      case NODE_TYPE.EXPR_STMT:
        if (node.expr) visitExpr(node.expr);
        break;
    }
  }

  function visitExpr(node) {
    if (!node) return;
    switch (node.type) {
      case NODE_TYPE.IDENTIFIER:
        addReference(node, currentScope);
        break;
      case NODE_TYPE.BINARY_EXPR:
        visitExpr(node.left);
        visitExpr(node.right);
        break;
      case NODE_TYPE.UNARY_EXPR:
        visitExpr(node.operand);
        break;
      case NODE_TYPE.CALL_EXPR:
        const calleeSym = lookupSymbol(globalScope, node.callee);
        identifierRefs.push({
          name: node.callee,
          start: node.nameStart,
          end: node.nameEnd,
          line: node.line,
          symbol: calleeSym,
          resolved: !!calleeSym,
          isCall: true
        });
        if (calleeSym) {
          calleeSym.references.push({
            start: node.nameStart,
            end: node.nameEnd,
            line: node.line,
            isCall: true
          });
        }
        for (const arg of node.args) {
          visitExpr(arg);
        }
        break;
    }
  }

  if (ast && ast.declarations) {
    for (const decl of ast.declarations) {
      visitStmt(decl);
    }
  }

  globalScope.lineEnd = (ast && ast.endLine) || globalScope.lineEnd;

  return {
    globalScope,
    allScopes,
    allSymbols,
    identifierRefs,
    errors
  };
}

// ==================== Type Checker ====================
const NUMERIC_TYPES = ['int', 'float'];
const ARITHMETIC_OPS = ['+', '-', '*', '/'];
const RELATIONAL_OPS = ['<', '>', '<=', '>='];
const EQUALITY_OPS = ['==', '!='];
const LOGICAL_OPS = ['&&', '||'];

function typesCompatible(target, source) {
  if (target === source) return true;
  if (target === 'float' && source === 'int') return true;
  return false;
}

function resultTypeOfArithmetic(t1, t2) {
  if (t1 === 'float' || t2 === 'float') return 'float';
  return 'int';
}

export function typeCheck(ast, symbolTableResult) {
  const errors = [];
  const { globalScope, identifierRefs } = symbolTableResult;

  const nodeTypes = new Map();

  function getExprType(node) {
    return nodeTypes.get(node) || 'unknown';
  }

  function setExprType(node, type) {
    nodeTypes.set(node, type);
  }

  function findScopeForLine(line) {
    let best = globalScope;
    function search(scope) {
      if (scope.line <= line && line <= (scope.lineEnd || 99999)) {
        if (scope.line >= best.line) best = scope;
      }
      for (const child of scope.children) search(child);
    }
    search(globalScope);
    return best;
  }

  function resolveIdentifier(node, scope) {
    const ref = identifierRefs.find(
      r => r.start === node.start && r.end === node.end
    );
    return ref ? ref.symbol : null;
  }

  function checkExpr(node, scope) {
    if (!node) return 'unknown';

    switch (node.type) {
      case NODE_TYPE.NUMBER_LITERAL:
        setExprType(node, node.dataType);
        return node.dataType;

      case NODE_TYPE.BOOL_LITERAL:
        setExprType(node, 'bool');
        return 'bool';

      case NODE_TYPE.IDENTIFIER: {
        const sym = resolveIdentifier(node, scope);
        if (!sym) {
          errors.push({
            line: node.line,
            message: `未定义的标识符 "${node.name}"`,
            start: node.start,
            end: node.end,
            types: ['unknown'],
            severity: 'error'
          });
          setExprType(node, 'unknown');
          return 'unknown';
        }
        setExprType(node, sym.dataType);
        return sym.dataType;
      }

      case NODE_TYPE.UNARY_EXPR: {
        const operandType = checkExpr(node.operand, scope);
        if (node.operator === '!') {
          if (operandType !== 'bool') {
            errors.push({
              line: node.line,
              message: `逻辑非运算符 "!" 要求操作数为bool类型，实际为 ${operandType}`,
              start: node.start,
              end: node.operand ? node.operand.end : node.end,
              types: [operandType],
              severity: 'error'
            });
          }
          setExprType(node, 'bool');
          return 'bool';
        }
        if (node.operator === '-') {
          if (!NUMERIC_TYPES.includes(operandType)) {
            errors.push({
              line: node.line,
              message: `取负运算符 "-" 要求操作数为数值类型(int/float)，实际为 ${operandType}`,
              start: node.start,
              end: node.operand ? node.operand.end : node.end,
              types: [operandType],
              severity: 'error'
            });
            setExprType(node, 'unknown');
            return 'unknown';
          }
          setExprType(node, operandType);
          return operandType;
        }
        setExprType(node, operandType);
        return operandType;
      }

      case NODE_TYPE.BINARY_EXPR: {
        const leftType = checkExpr(node.left, scope);
        const rightType = checkExpr(node.right, scope);
        const op = node.operator;

        if (ARITHMETIC_OPS.includes(op)) {
          if (!NUMERIC_TYPES.includes(leftType)) {
            errors.push({
              line: node.left ? node.left.line : node.line,
              message: `算术运算符 "${op}" 的左操作数必须是数值类型(int/float)，实际为 ${leftType}`,
              start: node.left ? node.left.start : node.opStart,
              end: node.left ? node.left.end : node.opEnd,
              types: [leftType, rightType],
              severity: 'error'
            });
            setExprType(node, 'unknown');
            return 'unknown';
          }
          if (!NUMERIC_TYPES.includes(rightType)) {
            errors.push({
              line: node.right ? node.right.line : node.line,
              message: `算术运算符 "${op}" 的右操作数必须是数值类型(int/float)，实际为 ${rightType}`,
              start: node.right ? node.right.start : node.opStart,
              end: node.right ? node.right.end : node.opEnd,
              types: [leftType, rightType],
              severity: 'error'
            });
            setExprType(node, 'unknown');
            return 'unknown';
          }
          const result = resultTypeOfArithmetic(leftType, rightType);
          setExprType(node, result);
          return result;
        }

        if (RELATIONAL_OPS.includes(op)) {
          if (!NUMERIC_TYPES.includes(leftType)) {
            errors.push({
              line: node.left ? node.left.line : node.line,
              message: `比较运算符 "${op}" 的左操作数必须是数值类型，实际为 ${leftType}`,
              start: node.left ? node.left.start : node.opStart,
              end: node.left ? node.left.end : node.opEnd,
              types: [leftType, rightType],
              severity: 'error'
            });
          }
          if (!NUMERIC_TYPES.includes(rightType)) {
            errors.push({
              line: node.right ? node.right.line : node.line,
              message: `比较运算符 "${op}" 的右操作数必须是数值类型，实际为 ${rightType}`,
              start: node.right ? node.right.start : node.opStart,
              end: node.right ? node.right.end : node.opEnd,
              types: [leftType, rightType],
              severity: 'error'
            });
          }
          setExprType(node, 'bool');
          return 'bool';
        }

        if (EQUALITY_OPS.includes(op)) {
          const leftOk = NUMERIC_TYPES.includes(leftType) || leftType === 'bool';
          const rightOk = NUMERIC_TYPES.includes(rightType) || rightType === 'bool';
          if (!leftOk || !rightOk) {
            errors.push({
              line: node.line,
              message: `"${op}" 不支持在 ${leftType} 和 ${rightType} 之间进行比较`,
              start: node.opStart,
              end: node.opEnd,
              types: [leftType, rightType],
              severity: 'error'
            });
          } else if (leftType !== rightType && !(leftType === 'bool' && rightType === 'bool')) {
            if (!(NUMERIC_TYPES.includes(leftType) && NUMERIC_TYPES.includes(rightType))) {
              errors.push({
                line: node.line,
                message: `"${op}" 比较的两个操作数类型不兼容: ${leftType} vs ${rightType}`,
                start: node.opStart,
                end: node.opEnd,
                types: [leftType, rightType],
                severity: 'warning'
              });
            }
          }
          setExprType(node, 'bool');
          return 'bool';
        }

        if (LOGICAL_OPS.includes(op)) {
          if (leftType !== 'bool' && leftType !== 'unknown') {
            errors.push({
              line: node.left ? node.left.line : node.line,
              message: `逻辑运算符 "${op}" 的左操作数必须是bool类型，实际为 ${leftType}`,
              start: node.left ? node.left.start : node.opStart,
              end: node.left ? node.left.end : node.opEnd,
              types: [leftType, rightType],
              severity: 'error'
            });
          }
          if (rightType !== 'bool' && rightType !== 'unknown') {
            errors.push({
              line: node.right ? node.right.line : node.line,
              message: `逻辑运算符 "${op}" 的右操作数必须是bool类型，实际为 ${rightType}`,
              start: node.right ? node.right.start : node.opStart,
              end: node.right ? node.right.end : node.opEnd,
              types: [leftType, rightType],
              severity: 'error'
            });
          }
          setExprType(node, 'bool');
          return 'bool';
        }

        setExprType(node, 'unknown');
        return 'unknown';
      }

      case NODE_TYPE.CALL_EXPR: {
        const funcSym = lookupSymbol(globalScope, node.callee);
        const argTypes = node.args.map(a => checkExpr(a, scope));

        if (!funcSym) {
          errors.push({
            line: node.line,
            message: `调用未定义的函数 "${node.callee}"`,
            start: node.nameStart,
            end: node.nameEnd,
            types: argTypes,
            severity: 'error'
          });
          setExprType(node, 'unknown');
          return 'unknown';
        }

        if (funcSym.kind !== 'function') {
          errors.push({
            line: node.line,
            message: `"${node.callee}" 不是一个函数，不能被调用`,
            start: node.nameStart,
            end: node.nameEnd,
            types: [funcSym.dataType, ...argTypes],
            severity: 'error'
          });
          setExprType(node, 'unknown');
          return 'unknown';
        }

        const expected = funcSym.paramTypes || [];
        if (node.args.length !== expected.length) {
          errors.push({
            line: node.line,
            message: `函数 "${node.callee}" 期望 ${expected.length} 个参数，实际传入 ${node.args.length} 个`,
            start: node.nameStart,
            end: node.end,
            types: [...expected, ...argTypes],
            severity: 'error'
          });
        } else {
          for (let i = 0; i < expected.length; i++) {
            if (!typesCompatible(expected[i], argTypes[i])) {
              errors.push({
                line: node.args[i] ? node.args[i].line : node.line,
                message: `第 ${i + 1} 个参数类型不兼容: 期望 ${expected[i]}，实际为 ${argTypes[i]}`,
                start: node.args[i] ? node.args[i].start : node.start,
                end: node.args[i] ? node.args[i].end : node.end,
                types: [expected[i], argTypes[i]],
                severity: 'error'
              });
            }
          }
        }

        setExprType(node, funcSym.dataType);
        return funcSym.dataType;
      }
    }

    setExprType(node, 'unknown');
    return 'unknown';
  }

  function checkStmt(node, scope) {
    if (!node) return;

    let stmtScope = scope;
    if (node.type === NODE_TYPE.BLOCK) {
      const blockScope = scope.children.find(c => c.line === node.line && c.kind === 'block') || scope;
      stmtScope = blockScope;
    }

    switch (node.type) {
      case NODE_TYPE.VAR_DECL:
        if (node.initExpr) {
          const initType = checkExpr(node.initExpr, stmtScope);
          if (!typesCompatible(node.dataType, initType) && initType !== 'unknown') {
            errors.push({
              line: node.initExpr.line,
              message: `不能将${initType}类型的值用于初始化${node.dataType}类型变量 "${node.name}"`,
              start: node.initExpr.start,
              end: node.initExpr.end,
              types: [node.dataType, initType],
              severity: 'error'
            });
          }
        }
        break;

      case NODE_TYPE.ASSIGN:
        if (node.target.type === NODE_TYPE.IDENTIFIER) {
          const targetSym = resolveIdentifier(node.target, stmtScope);
          const valueType = checkExpr(node.value, stmtScope);
          if (targetSym) {
            if (!typesCompatible(targetSym.dataType, valueType) && valueType !== 'unknown') {
              errors.push({
                line: node.line,
                message: `不能将${valueType}赋给${targetSym.dataType}类型变量 "${node.target.name}"`,
                start: node.value ? node.value.start : node.assignStart,
                end: node.value ? node.value.end : node.assignEnd,
                types: [targetSym.dataType, valueType],
                severity: 'error',
                relatedSymbol: targetSym
              });
            }
          }
        }
        break;

      case NODE_TYPE.IF_STMT:
        const condType = checkExpr(node.condition, stmtScope);
        if (condType !== 'bool' && condType !== 'unknown') {
          errors.push({
            line: node.condition ? node.condition.line : node.line,
            message: `if条件必须是bool类型，实际为 ${condType}`,
            start: node.condition ? node.condition.start : node.start,
            end: node.condition ? node.condition.end : node.end,
            types: [condType],
            severity: 'error'
          });
        }
        checkStmt(node.thenBranch, stmtScope);
        checkStmt(node.elseBranch, stmtScope);
        break;

      case NODE_TYPE.WHILE_STMT:
        const whileCondType = checkExpr(node.condition, stmtScope);
        if (whileCondType !== 'bool' && whileCondType !== 'unknown') {
          errors.push({
            line: node.condition ? node.condition.line : node.line,
            message: `while条件必须是bool类型，实际为 ${whileCondType}`,
            start: node.condition ? node.condition.start : node.start,
            end: node.condition ? node.condition.end : node.end,
            types: [whileCondType],
            severity: 'error'
          });
        }
        checkStmt(node.body, stmtScope);
        break;

      case NODE_TYPE.BLOCK:
        for (const stmt of node.statements) {
          checkStmt(stmt, stmtScope);
        }
        break;

      case NODE_TYPE.RETURN_STMT:
        if (node.expr) {
          const retType = checkExpr(node.expr, stmtScope);
          let funcScope = stmtScope;
          while (funcScope && funcScope.kind !== 'function') {
            funcScope = funcScope.parent;
          }
          if (funcScope && funcScope.parent === globalScope) {
            const funcSym = Array.from(globalScope.symbols.values()).find(
              s => s.kind === 'function' && s.declaration && s.declaration.body
                && s.declaration.body.start <= node.start && node.start <= s.declaration.body.end
            );
            if (funcSym && !typesCompatible(funcSym.dataType, retType) && retType !== 'unknown') {
              errors.push({
                line: node.line,
                message: `返回值类型不兼容: 函数声明返回 ${funcSym.dataType}，实际返回 ${retType}`,
                start: node.expr.start,
                end: node.expr.end,
                types: [funcSym.dataType, retType],
                severity: 'error'
              });
            }
          }
        }
        break;

      case NODE_TYPE.EXPR_STMT:
        checkExpr(node.expr, stmtScope);
        break;

      case NODE_TYPE.FUNC_DECL:
        const funcScope2 = globalScope.children.find(c => c.name === `函数 ${node.name}`);
        if (funcScope2 && node.body) {
          for (const stmt of node.body.statements) {
            checkStmt(stmt, funcScope2);
          }
        }
        break;
    }
  }

  if (ast && ast.declarations) {
    for (const decl of ast.declarations) {
      checkStmt(decl, globalScope);
    }
  }

  for (const symError of symbolTableResult.errors) {
    errors.push({
      ...symError,
      severity: 'error'
    });
  }

  return {
    errors,
    nodeTypes
  };
}

// ==================== Main Entry Point ====================
export function analyzeSemantics(source) {
  scopeIdCounter = 0;
  const { ast, tokens, parseErrors } = parseSource(source);
  const symbolResult = buildSymbolTable(ast);
  const typeResult = typeCheck(ast, symbolResult);

  const categorizedParseErrors = parseErrors.map(e => ({
    ...e,
    severity: 'error',
    types: [],
    category: 'syntax'
  }));

  const categorizedTypeErrors = typeResult.errors.map(e => ({
    ...e,
    category: e.category || 'type'
  }));

  const allErrors = [
    ...categorizedParseErrors,
    ...categorizedTypeErrors
  ];

  const totalLines = source.split('\n').length;
  if (symbolResult.globalScope) {
    symbolResult.globalScope.lineEnd = totalLines;
  }

  return {
    ast,
    tokens,
    parseErrors: categorizedParseErrors,
    ...symbolResult,
    typeErrors: categorizedTypeErrors,
    nodeTypes: typeResult.nodeTypes,
    allErrors
  };
}

export function findScopeAtLine(scopes, line) {
  let best = scopes[0];
  let bestDepth = -1;

  function depthOf(scope) {
    let d = 0;
    let s = scope;
    while (s) { d++; s = s.parent; }
    return d;
  }

  for (const scope of scopes) {
    const startLine = scope.line;
    const endLine = scope.lineEnd || 99999;
    if (line >= startLine && line <= endLine) {
      const d = depthOf(scope);
      if (d > bestDepth) {
        bestDepth = d;
        best = scope;
      }
    }
  }
  return best;
}

// ==================== Rename Refactoring ====================
export function checkRenameConflict(symbol, newName, allScopes) {
  if (!symbol || !symbol.scope) return { conflict: false };
  const scope = symbol.scope;
  if (scope.symbols.has(newName)) {
    const existing = scope.symbols.get(newName);
    if (existing.nameStart !== symbol.nameStart) {
      return {
        conflict: true,
        message: `作用域"${scope.name}"中已存在符号"${newName}"（声明于第${existing.line}行）`,
        existing
      };
    }
  }
  return { conflict: false };
}

export function applyRename(source, symbol, newName) {
  const ranges = [];
  ranges.push({ start: symbol.nameStart, end: symbol.nameEnd });
  if (symbol.references) {
    for (const ref of symbol.references) {
      ranges.push({ start: ref.start, end: ref.end });
    }
  }
  ranges.sort((a, b) => b.start - a.start);
  let result = source;
  for (const r of ranges) {
    result = result.substring(0, r.start) + newName + result.substring(r.end);
  }
  return result;
}

// ==================== Quick Fix Suggestions ====================
export function generateQuickFixes(error, ast, allSymbols, source) {
  const fixes = [];
  const msg = error.message || '';
  const types = error.types || [];

  if (msg.includes('不能将') && msg.includes('赋给') && msg.includes('类型变量')) {
    const assignMatch = msg.match(/不能将(\w+)(?:类型的值)?(?:用于初始化)?赋给(\w+)类型变量\s*"([^"]+)"/);
    if (assignMatch) {
      const srcType = assignMatch[1];
      const dstType = assignMatch[2];
      const varName = assignMatch[3];
      fixes.push({
        id: 'add-cast',
        label: `添加强制类型转换 (${dstType})`,
        description: `在值前添加 (${dstType}) 进行强制转换`,
        apply: () => applyAddCast(source, error, dstType)
      });
      const targetSym = allSymbols.find(s => s.name === varName);
      if (targetSym && targetSym.kind === 'variable') {
        fixes.push({
          id: 'change-var-type',
          label: `将变量声明改为${srcType}`,
          description: `修改"${varName}"的声明类型为${srcType}`,
          apply: () => applyChangeVarType(source, targetSym, srcType)
        });
      }
    }
  }

  if (msg.includes('不能将') && msg.includes('用于初始化')) {
    const initMatch = msg.match(/不能将(\w+)类型的值用于初始化(\w+)类型变量\s*"([^"]+)"/);
    if (initMatch) {
      const srcType = initMatch[1];
      const dstType = initMatch[2];
      const varName = initMatch[3];
      fixes.push({
        id: 'add-cast-init',
        label: `添加强制类型转换 (${dstType})`,
        description: `在初始化值前添加 (${dstType}) 进行强制转换`,
        apply: () => applyAddCast(source, error, dstType)
      });
      const targetSym = allSymbols.find(s => s.name === varName);
      if (targetSym && targetSym.kind === 'variable') {
        fixes.push({
          id: 'change-var-type-init',
          label: `将变量声明改为${srcType}`,
          description: `修改"${varName}"的声明类型为${srcType}`,
          apply: () => applyChangeVarType(source, targetSym, srcType)
        });
      }
    }
  }

  if (msg.includes('个参数类型不兼容')) {
    const argMatch = msg.match(/第\s*(\d+)\s*个参数类型不兼容:\s*期望\s*(\w+)\s*，实际为\s*(\w+)/);
    if (argMatch) {
      const argIdx = parseInt(argMatch[1]) - 1;
      const expectedType = argMatch[2];
      const actualType = argMatch[3];
      fixes.push({
        id: 'add-cast-arg',
        label: `添加类型转换 (${expectedType})`,
        description: `在第${argIdx + 1}个参数前添加强制转换`,
        apply: () => applyAddCast(source, error, expectedType)
      });
      const funcSym = allSymbols.find(s =>
        s.kind === 'function' &&
        s.declaration &&
        s.declaration.params &&
        s.declaration.params[argIdx]
      );
      if (funcSym && funcSym.declaration && funcSym.declaration.params) {
        const paramNode = funcSym.declaration.params[argIdx];
        if (paramNode) {
          fixes.push({
            id: 'change-param-type',
            label: `修改函数声明的参数类型为${actualType}`,
            description: `将第${argIdx + 1}个参数类型从${expectedType}改为${actualType}`,
            apply: () => applyChangeParamType(source, paramNode, actualType)
          });
        }
      }
    }
  }

  if (msg.includes('算术运算符') && (msg.includes('左操作数') || msg.includes('右操作数'))) {
    if (types.length >= 2) {
      const badType = types.find(t => t !== 'int' && t !== 'float');
      if (badType) {
        fixes.push({
          id: 'convert-operand-to-float',
          label: `将操作数转换为float`,
          description: `对操作数添加强制类型转换 (float)`,
          apply: () => applyAddCast(source, error, 'float')
        });
      }
    }
  }

  if (msg.includes('if条件必须是bool') || msg.includes('while条件必须是bool')) {
    const condType = types[0];
    if (condType && condType !== 'bool') {
      fixes.push({
        id: 'add-compare-zero',
        label: `添加比较运算 "!= 0"`,
        description: `将条件表达式改为 != 0 转换为布尔值`,
        apply: () => applyAddCompare(source, error)
      });
    }
  }

  if (msg.includes('未定义的标识符')) {
    const undefMatch = msg.match(/未定义的标识符\s*"([^"]+)"/);
    if (undefMatch) {
      const undefinedName = undefMatch[1];
      fixes.push({
        id: 'declare-variable',
        label: `声明变量 int ${undefinedName}`,
        description: `在当前位置之前声明变量`,
        apply: () => applyDeclareVar(source, error, undefinedName, 'int')
      });
    }
  }

  if (msg.includes('返回值类型不兼容')) {
    const retMatch = msg.match(/函数声明返回\s*(\w+)\s*，实际返回\s*(\w+)/);
    if (retMatch) {
      const declaredType = retMatch[1];
      const actualType = retMatch[2];
      fixes.push({
        id: 'add-cast-return',
        label: `添加返回值类型转换 (${declaredType})`,
        description: `对返回值添加强制类型转换`,
        apply: () => applyAddCast(source, error, declaredType)
      });
      fixes.push({
        id: 'change-return-type',
        label: `将函数返回类型改为${actualType}`,
        description: `修改函数声明的返回类型`,
        apply: () => applyChangeFunctionReturnType(source, error, ast, actualType)
      });
    }
  }

  return fixes;
}

function applyAddCast(source, error, castType) {
  if (!error || error.start === undefined) return source;
  const exprStart = error.start;
  return source.substring(0, exprStart) + `(${castType})` + source.substring(exprStart);
}

function applyChangeVarType(source, targetSym, newType) {
  if (!targetSym || !targetSym.declaration) return source;
  const decl = targetSym.declaration;
  const typeStart = decl.start;
  const typeEnd = targetSym.nameStart;
  const lineStart = source.lastIndexOf('\n', typeStart - 1) + 1;
  const lineEnd = source.indexOf('\n', typeStart) === -1 ? source.length : source.indexOf('\n', typeStart);
  const lineContent = source.substring(lineStart, lineEnd);
  const typeMatch = lineContent.match(/^\s*(int|float|bool|void)/);
  if (typeMatch) {
    const actualStart = lineStart + typeMatch.index;
    const actualEnd = actualStart + typeMatch[1].length;
    return source.substring(0, actualStart) + newType + source.substring(actualEnd);
  }
  return source;
}

function applyChangeParamType(source, paramNode, newType) {
  if (!paramNode || paramNode.start === undefined) return source;
  const typeStart = paramNode.start;
  const lineStart = source.lastIndexOf('\n', typeStart - 1) + 1;
  const lineEnd = source.indexOf('\n', typeStart) === -1 ? source.length : source.indexOf('\n', typeStart);
  const lineContent = source.substring(lineStart, lineEnd);
  const typeMatch = lineContent.match(/(int|float|bool)/);
  if (typeMatch) {
    const actualStart = lineStart + typeMatch.index;
    const actualEnd = actualStart + typeMatch[1].length;
    return source.substring(0, actualStart) + newType + source.substring(actualEnd);
  }
  return source;
}

function applyAddCompare(source, error) {
  if (!error || error.end === undefined) return source;
  return source.substring(0, error.end) + ' != 0' + source.substring(error.end);
}

function applyDeclareVar(source, error, varName, varType) {
  if (!error || error.start === undefined) return source;
  const lineStart = source.lastIndexOf('\n', error.start - 1) + 1;
  const whitespaceMatch = source.substring(lineStart, error.start).match(/^\s*/);
  const indent = whitespaceMatch ? whitespaceMatch[0] : '';
  return source.substring(0, lineStart) + `${indent}${varType} ${varName};\n` + source.substring(lineStart);
}

function applyChangeFunctionReturnType(source, error, ast, newType) {
  if (!error || error.start === undefined || !ast) return source;
  const errorLine = error.line || 1;
  let targetFunc = null;
  function findFunc(declarations) {
    for (const decl of declarations) {
      if (decl.type === NODE_TYPE.FUNC_DECL) {
        const funcStart = decl.line;
        const bodyEnd = decl.body ? decl.body.lineEnd : 99999;
        if (errorLine >= funcStart && errorLine <= bodyEnd) {
          targetFunc = decl;
          return true;
        }
      }
    }
    return false;
  }
  findFunc(ast.declarations || []);
  if (targetFunc) {
    const typeStart = targetFunc.start;
    const lineContent = source.substring(source.lastIndexOf('\n', typeStart - 1) + 1, targetFunc.nameStart);
    const typeMatch = lineContent.match(/(int|float|bool|void)/);
    if (typeMatch) {
      const actualStart = source.lastIndexOf('\n', typeStart - 1) + 1 + typeMatch.index;
      const actualEnd = actualStart + typeMatch[1].length;
      return source.substring(0, actualStart) + newType + source.substring(actualEnd);
    }
  }
  return source;
}

// ==================== Variable Lifecycle ====================
export function computeVariableLifecycles(allScopes, totalLines) {
  const result = new Map();
  for (const scope of allScopes) {
    const vars = [];
    scope.symbols.forEach((sym, name) => {
      if (sym.kind === 'variable' || sym.kind === 'parameter') {
        const declaredLine = sym.line;
        let lastRefLine = null;
        if (sym.references && sym.references.length > 0) {
          lastRefLine = sym.references.reduce((max, r) => Math.max(max, r.line || 0), 0);
        }
        const isUnused = !lastRefLine || lastRefLine <= 0;
        const scopeEnd = scope.lineEnd || totalLines;
        const endLine = lastRefLine && lastRefLine > declaredLine
          ? Math.min(lastRefLine, scopeEnd)
          : declaredLine;
        vars.push({
          symbol: sym,
          name,
          dataType: sym.dataType,
          kind: sym.kind,
          declaredLine,
          lastRefLine: lastRefLine || declaredLine,
          isUnused,
          startLine: declaredLine,
          endLine
        });
      }
    });
    result.set(scope.id, vars);
  }
  return result;
}

// ==================== Inline Type Annotations ====================
export function computeInlineTypeAnnotations(ast, nodeTypes, globalScope) {
  const annotations = [];
  function walkStmts(stmts, scope) {
    if (!stmts) return;
    for (const stmt of stmts) {
      walkStmt(stmt, scope);
    }
  }
  function walkStmt(node, scope) {
    if (!node) return;
    let stmtScope = scope;
    if (node.type === NODE_TYPE.BLOCK) {
      const blockScope = scope.children.find(c => c.line === node.line && c.kind === 'block') || scope;
      stmtScope = blockScope;
    }
    switch (node.type) {
      case NODE_TYPE.VAR_DECL:
        annotations.push({
          line: node.line,
          kind: 'variable',
          type: node.dataType,
          name: node.name
        });
        if (node.initExpr) walkExpr(node.initExpr, stmtScope);
        break;
      case NODE_TYPE.FUNC_DECL:
        const funcScope = globalScope.children.find(c => c.name === `函数 ${node.name}`);
        if (funcScope && node.body) {
          for (const p of node.params || []) {
            if (p) {
              annotations.push({
                line: p.line,
                kind: 'parameter',
                type: p.dataType,
                name: p.name
              });
            }
          }
          if (node.body && node.body.statements) {
            walkStmts(node.body.statements, funcScope);
          }
        }
        break;
      case NODE_TYPE.BLOCK:
        walkStmts(node.statements, stmtScope);
        break;
      case NODE_TYPE.IF_STMT:
        if (node.condition) walkExpr(node.condition, stmtScope);
        walkStmt(node.thenBranch, stmtScope);
        walkStmt(node.elseBranch, stmtScope);
        break;
      case NODE_TYPE.WHILE_STMT:
        if (node.condition) walkExpr(node.condition, stmtScope);
        walkStmt(node.body, stmtScope);
        break;
      case NODE_TYPE.RETURN_STMT:
        if (node.expr) walkExpr(node.expr, stmtScope);
        break;
      case NODE_TYPE.ASSIGN:
        if (node.value) walkExpr(node.value, stmtScope);
        break;
      case NODE_TYPE.EXPR_STMT:
        if (node.expr) walkExpr(node.expr, stmtScope);
        break;
    }
  }
  function walkExpr(node, scope) {
    if (!node) return;
    if (node.type === NODE_TYPE.CALL_EXPR) {
      const callType = nodeTypes.get(node);
      if (callType) {
        annotations.push({
          line: node.line,
          kind: 'call',
          type: callType,
          name: node.callee,
          start: node.start,
          end: node.end
        });
      }
      for (const arg of node.args || []) {
        walkExpr(arg, scope);
      }
    } else if (node.type === NODE_TYPE.BINARY_EXPR) {
      walkExpr(node.left, scope);
      walkExpr(node.right, scope);
    } else if (node.type === NODE_TYPE.UNARY_EXPR) {
      walkExpr(node.operand, scope);
    }
  }
  if (ast && ast.declarations) {
    walkStmts(ast.declarations, globalScope);
  }
  const lineMap = new Map();
  for (const ann of annotations) {
    if (!lineMap.has(ann.line)) {
      lineMap.set(ann.line, []);
    }
    lineMap.get(ann.line).push(ann);
  }
  return lineMap;
}
