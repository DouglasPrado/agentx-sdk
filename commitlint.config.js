export default {
  extends: ['@commitlint/config-conventional'],
  // Bots escrevem commits que não seguem conventional commits (URLs longas no body,
  // subject sem "type:"). Pula a validação só desses commits, sem relaxar as regras
  // para commits escritos por humanos.
  ignores: [
    (message) => /^Signed-off-by: dependabot\[bot\]/m.test(message),
    (message) => /Co-authored-by:.*Copilot Autofix/m.test(message),
  ],
  rules: {
    // Convenção do repo: "fix: resolve #N — descrição em português detalhada" estoura
    // os 100 chars default. Histórico do main tem múltiplos commits em 100-105 chars
    // (issues #62, #76, #77 etc). 120 acomoda o padrão sem perder legibilidade.
    'header-max-length': [2, 'always', 120],
  },
};
