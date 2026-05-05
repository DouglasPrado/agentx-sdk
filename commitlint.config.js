export default {
  extends: ['@commitlint/config-conventional'],
  // Dependabot escreve commits com URLs longas no body (release notes, links de comparação).
  // Não relaxa body-max-line-length pra todo mundo — só pula a validação dos commits do bot.
  ignores: [(message) => /^Signed-off-by: dependabot\[bot\]/m.test(message)],
};
