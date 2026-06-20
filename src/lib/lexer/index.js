import { regexToNFA } from '../automata/regexToNFA.js';
import { nfaToDFA } from '../automata/nfaToDFA.js';
import { getAllStates } from '../automata/utils.js';

export const TOKEN_TYPES = {
  KEYWORD: '关键字',
  IDENTIFIER: '标识符',
  NUMBER: '数字字面量',
  OPERATOR: '运算符',
  SEPARATOR: '分隔符',
  STRING: '字符串'
};

export const DEFAULT_RULES = [
  { regex: 'if|else|while|for|return|int|float|void', type: TOKEN_TYPES.KEYWORD, label: 'if/else/while/for/return/int/float/void' },
  { regex: '[a-zA-Z][a-zA-Z0-9]*', type: TOKEN_TYPES.IDENTIFIER, label: '标识符' },
  { regex: '[0-9]+(\\.[0-9]+)?', type: TOKEN_TYPES.NUMBER, label: '数字' },
  { regex: '\\+|\\-|\\*|/|=|==|!=|<|>|<=|>=|&&|\\|\\||!', type: TOKEN_TYPES.OPERATOR, label: '运算符' },
  { regex: '\\(|\\)|\\{|\\}|;|,|\\[|\\]', type: TOKEN_TYPES.SEPARATOR, label: '分隔符' },
  { regex: '"[^"]*"', type: TOKEN_TYPES.STRING, label: '字符串' }
];

export function tokenize(source, rules = DEFAULT_RULES) {
  const combinedDFA = buildCombinedDFA(rules);
  return runLexer(source, combinedDFA, rules);
}

function buildCombinedDFA(rules) {
  const individualDFAs = rules.map(rule => {
    const nfa = regexToNFA(rule.regex);
    for (const state of getAllStates(nfa.start)) {
      if (state.isAccepting) {
        state.acceptLabel = rule.type;
      }
    }
    const { dfa } = nfaToDFA(nfa);
    return { dfa, type: rule.type };
  });
  
  return individualDFAs;
}

function runLexer(source, dfas, rules) {
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
    
    for (const { dfa, type } of dfas) {
      let currentState = dfa;
      let matchEnd = pos;
      let acceptEnd = -1;
      
      if (currentState.isAccepting) {
        acceptEnd = pos;
      }
      
      while (matchEnd < source.length) {
        const ch = source[matchEnd];
        if (currentState.transitions.has(ch)) {
          currentState = [...currentState.transitions.get(ch)][0];
          matchEnd++;
          if (currentState.isAccepting) {
            acceptEnd = matchEnd;
          }
        } else {
          break;
        }
      }
      
      if (acceptEnd > pos && acceptEnd - pos > longestLength) {
        longestLength = acceptEnd - pos;
        longestMatch = source.substring(pos, acceptEnd);
        matchedType = type;
      }
    }
    
    if (longestMatch) {
      const lineIdx = lineStarts.findIndex((start, idx) => 
        idx + 1 >= lineStarts.length || pos < lineStarts[idx + 1]
      );
      const col = pos - lineStarts[lineIdx] + 1;
      
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
      const lineIdx = lineStarts.findIndex((start, idx) => 
        idx + 1 >= lineStarts.length || pos < lineStarts[idx + 1]
      );
      const col = pos - lineStarts[lineIdx] + 1;
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
  const dfas = rules.map(rule => {
    const nfa = regexToNFA(rule.regex);
    for (const state of getAllStates(nfa.start)) {
      if (state.isAccepting) {
        state.acceptLabel = rule.type;
      }
    }
    const { dfa } = nfaToDFA(nfa);
    return { dfa, type: rule.type };
  });
  
  const states = dfas.map(({ dfa, type }) => ({
    currentState: dfa,
    currentLexeme: '',
    isActive: true,
    acceptState: dfa.isAccepting,
    type
  }));
  
  return {
    pos: 0,
    source,
    states,
    dfas,
    rules,
    history: []
  };
}

export function stepLexer(stepper) {
  if (stepper.pos >= stepper.source.length) return stepper;
  
  const ch = stepper.source[stepper.pos];
  const newStates = stepper.states.map(state => {
    if (!state.isActive) return state;
    
    const newState = { ...state };
    if (state.currentState.transitions.has(ch)) {
      newState.currentState = [...state.currentState.transitions.get(ch)][0];
      newState.currentLexeme += ch;
      newState.acceptState = newState.currentState.isAccepting;
    } else {
      newState.isActive = false;
    }
    return newState;
  });
  
  const anyActive = newStates.some(s => s.isActive);
  let result;
  
  if (!anyActive) {
    let bestMatch = null;
    let bestLength = 0;
    let bestType = null;
    
    for (const state of stepper.states) {
      if (state.acceptState && state.currentLexeme.length > bestLength) {
        bestLength = state.currentLexeme.length;
        bestMatch = state.currentLexeme;
        bestType = state.type;
      }
    }
    
    if (bestMatch) {
      result = {
        ...stepper,
        states: stepper.dfas.map(({ dfa, type }) => ({
          currentState: dfa,
          currentLexeme: '',
          isActive: true,
          acceptState: dfa.isAccepting,
          type
        })),
        pos: stepper.pos,
        lastToken: { type: bestType, value: bestMatch, length: bestLength }
      };
      result.pos -= (bestLength - 1);
      return stepLexer(result);
    } else {
      const resetStates = stepper.dfas.map(({ dfa, type }) => ({
        currentState: dfa,
        currentLexeme: '',
        isActive: true,
        acceptState: dfa.isAccepting,
        type
      }));
      if (resetStates[0].currentState.transitions.has(ch)) {
        resetStates[0].currentState = [...resetStates[0].currentState.transitions.get(ch)][0];
        resetStates[0].currentLexeme = ch;
        resetStates[0].acceptState = resetStates[0].currentState.isAccepting;
      }
      return {
        ...stepper,
        pos: stepper.pos + 1,
        states: resetStates
      };
    }
  }
  
  return {
    ...stepper,
    pos: stepper.pos + 1,
    states: newStates
  };
}
