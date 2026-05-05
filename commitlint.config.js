export default {
  extends: ['@commitlint/config-conventional'],
  // Dependabot escreve commits com URLs longas no body (release notes, links de comparação).
  // Não relaxa body-max-line-length pra todo mundo — só pula a validação dos commits do bot.
  ignores: [(message) => /^Signed-off-by: dependabot\[bot\]/m.test(message)],
  rules: {
    // Convenção do repo: "fix: resolve #N — descrição em português detalhada" estoura
    // os 100 chars default. Histórico do main tem múltiplos commits em 100-105 chars
    // (issues #62, #76, #77 etc). 120 acomoda o padrão sem perder legibilidade.
    'header-max-length': [2, 'always', 120],
  },
};
