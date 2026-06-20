export const TOKEN_TYPES = {
  KEYWORD: '关键字',
  IDENTIFIER: '标识符',
  NUMBER: '数字字面量',
  OPERATOR: '运算符',
  SEPARATOR: '分隔符',
  STRING: '字符串'
};

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegexForRule(rule) {
  try {
    return new RegExp('^' + rule.regex);
  } catch (e) {
    console.error('无效正则:', rule.regex, e);
    return null;
  }
}

export const DEFAULT_RULES = [
  { regex: 'if|else|while|for|return|int|float|void|true|false|null', type: TOKEN_TYPES.KEYWORD, label: '关键字' },
  { regex: '[a-zA-Z_][a-zA-Z_0-9]*', type: TOKEN_TYPES.IDENTIFIER, label: '标识符' },
  { regex: '[0-9]+(\\.[0-9]+)?', type: TOKEN_TYPES.NUMBER, label: '数字' },
  { regex: '\\+|-|\\*|/|=|==|!=|<|>|<=|>=|&&|\\|\\||!', type: TOKEN_TYPES.OPERATOR, label: '运算符' },
  { regex: '\\(|\\)|\\{|\\}|;|,|\\[|\\]|:|\\.', type: TOKEN_TYPES.SEPARATOR, label: '分隔符' },
  { regex: '"[^"]*"', type: TOKEN_TYPES.STRING, label: '字符串' }
];

export function tokenize(source, rules = DEFAULT_RULES) {
  const compiledRules = rules
    .map(r => ({ ...r, regex: buildRegexForRule(r) }))
    .filter(r => r.regex !== null);
  
  const tokens = [];
  let pos = 0;
  const lineStarts = [0];
  
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') lineStarts.push(i + 1);
  }
  
  while (pos < source.length) {
    if (/\s/.test(source[pos])) {
      pos++;
      continue;
    }
    
    let longestMatch = null;
    let longestLength = 0;
    let matchedType = null;
    
    for (const rule of compiledRules) {
      const match = source.substring(pos).match(rule.regex);
      if (match && match[0].length > longestLength) {
        longestLength = match[0].length;
        longestMatch = match[0];
        matchedType = rule.type;
      }
    }
    
    const lineIdx = lineStarts.findIndex((start, idx) => 
      idx + 1 >= lineStarts.length || pos < lineStarts[idx + 1]
    );
    const col = pos - lineStarts[lineIdx] + 1;
    
    if (longestMatch) {
      tokens.push({
        type: matchedType,
        value: longestMatch,
        start: pos,
        end: pos + longestLength,
        line: lineIdx + 1,
        column: col
      });
      pos += longestLength;
    } else {
      tokens.push({
        type: 'ERROR',
        value: source[pos],
        start: pos,
        end: pos + 1,
        line: lineIdx + 1,
        column: col
      });
      pos++;
    }
  }
  
  return tokens;
}

export function createLexerStepper(source, rules = DEFAULT_RULES) {
  const compiledRules = rules
    .map(r => ({ ...r, regex: buildRegexForRule(r) }))
    .filter(r => r.regex !== null);
  
  return {
    pos: 0,
    source,
    rules: compiledRules,
    originalRules: rules,
    tokens: [],
    lastToken: null,
    currentLexeme: '',
    activeStates: compiledRules.map(r => ({
      rule: r,
      currentPos: 0,
      currentMatch: '',
      isActive: true,
      lastAcceptPos: -1,
      lastAcceptMatch: ''
    }))
  };
}

export function stepLexer(stepper) {
  if (stepper.pos >= stepper.source.length) return stepper;
  
  const ch = stepper.source[stepper.pos];
  
  if (/\s/.test(ch)) {
    stepper.pos++;
    return stepper;
  }
  
  const newStates = stepper.activeStates.map(state => {
    if (!state.isActive) return state;
    
    const newMatch = state.currentMatch + ch;
    const newState = { ...state, currentMatch: newMatch };
    
    if (state.rule.regex.test(newMatch)) {
      newState.lastAcceptPos = stepper.pos + 1;
      newState.lastAcceptMatch = newMatch;
    }
    
    const fullMatch = state.rule.regex.test(newMatch);
    const canContinue = stepper.source.substring(stepper.pos + 1).match(
      new RegExp('^' + state.originalRules[stepper.activeStates.indexOf(state)].regex)
    ) !== null || state.rule.regex.test(newMatch);
    
    if (!fullMatch && !canContinue) {
      newState.isActive = false;
    }
    
    return newState;
  });
  
  stepper.activeStates = newStates;
  stepper.currentLexeme += ch;
  stepper.pos++;
  
  const anyActive = newStates.some(s => s.isActive);
  
  if (!anyActive || stepper.pos >= stepper.source.length) {
    let bestMatch = null;
    let bestLength = 0;
    let bestType = null;
    
    for (const state of newStates) {
      if (state.lastAcceptMatch && state.lastAcceptMatch.length > bestLength) {
        bestLength = state.lastAcceptMatch.length;
        bestMatch = state.lastAcceptMatch;
        bestType = state.rule.type;
      }
    }
    
    if (!bestMatch && stepper.currentLexeme.length > 0) {
      bestMatch = stepper.currentLexeme[0];
      bestLength = 1;
      bestType = 'ERROR';
      stepper.pos -= (stepper.currentLexeme.length - 1);
    }
    
    if (bestMatch) {
      const lineIdx = Math.floor(Math.log(stepper.pos) / Math.log(10));
      stepper.lastToken = { type: bestType, value: bestMatch, length: bestLength };
      stepper.tokens.push({ type: bestType, value: bestMatch });
      
      stepper.activeStates = stepper.rules.map(r => ({
        rule: r,
        currentPos: 0,
        currentMatch: '',
        isActive: true,
        lastAcceptPos: -1,
        lastAcceptMatch: ''
      }));
      stepper.currentLexeme = '';
    }
  }
  
  return stepper;
}
