# Changelog

## [0.7.6](https://github.com/DouglasPrado/agentx-sdk/compare/v0.7.5...v0.7.6) (2026-05-14)


### Bug Fixes

* **memory-paths:** reject dangling symlinks in validateMemoryPathResolved ([#215](https://github.com/DouglasPrado/agentx-sdk/issues/215)) ([d6e2405](https://github.com/DouglasPrado/agentx-sdk/commit/d6e24056f5afc58202a09d7c8829378d236000b9))
* resolve [#211](https://github.com/DouglasPrado/agentx-sdk/issues/211) — sanitizar nomes e descrições MCP para prevenir prompt injection ([09072a3](https://github.com/DouglasPrado/agentx-sdk/commit/09072a33c9d166d05f091d8ff96f7c888f60aa03))
* resolve [#212](https://github.com/DouglasPrado/agentx-sdk/issues/212) — validar comando stdio contra allowedStdioCommands ([6413650](https://github.com/DouglasPrado/agentx-sdk/commit/6413650ac90ae86a3d7d9c298e9e1de6289a813d))
* resolve [#218](https://github.com/DouglasPrado/agentx-sdk/issues/218) — atribuir _db apenas após migração bem-sucedida ([7e786d1](https://github.com/DouglasPrado/agentx-sdk/commit/7e786d11115bd78b652734877a79e3f3d60b9134))
* resolve [#219](https://github.com/DouglasPrado/agentx-sdk/issues/219) — rastrear e abortar forks em background ao destruir Agent ([f55a83a](https://github.com/DouglasPrado/agentx-sdk/commit/f55a83aba6fc444233a3d6a68f4b897c4169c4fb))
* resolve [#220](https://github.com/DouglasPrado/agentx-sdk/issues/220) — isolar turnsSinceExtraction e surfacedMemories por thread ([d6789cc](https://github.com/DouglasPrado/agentx-sdk/commit/d6789cc4aa8e32ff0a6696c38f1a95cbcf698b07))
* resolve [#221](https://github.com/DouglasPrado/agentx-sdk/issues/221) — validar contagem de embeddings após chamada à API ([03c4111](https://github.com/DouglasPrado/agentx-sdk/commit/03c411171cc44e0c9a9b49ca9d68a6295aedb8b4))
* resolve [#236](https://github.com/DouglasPrado/agentx-sdk/issues/236) — bloqueia endereço IPv6 unspecified [::]  no SSRF guard ([#242](https://github.com/DouglasPrado/agentx-sdk/issues/242)) ([0297e72](https://github.com/DouglasPrado/agentx-sdk/commit/0297e72de296bbd0da038ad51a4b7daeaa61549a))
* resolve [#237](https://github.com/DouglasPrado/agentx-sdk/issues/237) — strip Unicode bidi/zero-width/tag chars em sanitizeForPrompt ([#243](https://github.com/DouglasPrado/agentx-sdk/issues/243)) ([f160b38](https://github.com/DouglasPrado/agentx-sdk/commit/f160b382397c0501d9837a31180a5bf998f8bb42))
* resolve [#239](https://github.com/DouglasPrado/agentx-sdk/issues/239) — remove dead-code '::1' (sem colchetes) no SSRF guard ([#245](https://github.com/DouglasPrado/agentx-sdk/issues/245)) ([9486997](https://github.com/DouglasPrado/agentx-sdk/commit/948699780882836dfe26455aa172b0be2ebd45fe))
* sanitiza nome de tool MCP antes de inserir no system prompt (closes [#248](https://github.com/DouglasPrado/agentx-sdk/issues/248)) ([#250](https://github.com/DouglasPrado/agentx-sdk/issues/250)) ([f0c20c8](https://github.com/DouglasPrado/agentx-sdk/commit/f0c20c80527b8e7a5fa4d8a653fd0bdab3b5ed3f))
* **ssrf-guard:** block missing IANA reserved ranges ([#213](https://github.com/DouglasPrado/agentx-sdk/issues/213)) ([8e687cc](https://github.com/DouglasPrado/agentx-sdk/commit/8e687cc3705f3b5a907c40bc34ff929bf10abfd4))
* stripa tag &lt;system-reminder&gt; de abertura em injections de contexto (closes [#249](https://github.com/DouglasPrado/agentx-sdk/issues/249)) ([#251](https://github.com/DouglasPrado/agentx-sdk/issues/251)) ([579bce9](https://github.com/DouglasPrado/agentx-sdk/commit/579bce9ca4a3100272f39f80581a68658b446072))
* **tool-executor,skill-manager:** pass real recentMessages to validate/match contexts ([#214](https://github.com/DouglasPrado/agentx-sdk/issues/214)) ([7c95114](https://github.com/DouglasPrado/agentx-sdk/commit/7c95114f0a054a0ce66bc917226269a3f167d910))
* **vitest:** add resolve alias agentx-sdk → src/index.ts (closes [#188](https://github.com/DouglasPrado/agentx-sdk/issues/188)) ([#234](https://github.com/DouglasPrado/agentx-sdk/issues/234)) ([a81f397](https://github.com/DouglasPrado/agentx-sdk/commit/a81f397875d92a2f27eb09b133c21b033c3875a5))

## [0.7.5](https://github.com/DouglasPrado/agentx-sdk/compare/v0.7.4...v0.7.5) (2026-05-11)


### Bug Fixes

* bloqueia symlink path traversal em readMemory/deleteMemory (closes [#171](https://github.com/DouglasPrado/agentx-sdk/issues/171)) ([#176](https://github.com/DouglasPrado/agentx-sdk/issues/176)) ([45f43ef](https://github.com/DouglasPrado/agentx-sdk/commit/45f43efd6f88c9eec48d3464584d1db31b42e7da))
* file tools usam process.cwd() como raiz padrão quando workingDir é omitido (closes [#189](https://github.com/DouglasPrado/agentx-sdk/issues/189)) ([#192](https://github.com/DouglasPrado/agentx-sdk/issues/192)) ([ebb920a](https://github.com/DouglasPrado/agentx-sdk/commit/ebb920afa6e0aaacbbf3b0761f8fda5ccc442cbe))
* guard em LLMClient.embed() para json.data ausente/inválido (closes [#172](https://github.com/DouglasPrado/agentx-sdk/issues/172)) ([#177](https://github.com/DouglasPrado/agentx-sdk/issues/177)) ([099a477](https://github.com/DouglasPrado/agentx-sdk/commit/099a47709fd0140a091bb80fa2f2075f3f110c8c))
* guard url obrigatória em transport=auto (closes [#164](https://github.com/DouglasPrado/agentx-sdk/issues/164)) ([#167](https://github.com/DouglasPrado/agentx-sdk/issues/167)) ([284debe](https://github.com/DouglasPrado/agentx-sdk/commit/284debe0640a9fb2360cd6338c176ffd9e700782))
* invalida searchCache após ingest() no KnowledgeManager (closes [#170](https://github.com/DouglasPrado/agentx-sdk/issues/170)) ([#175](https://github.com/DouglasPrado/agentx-sdk/issues/175)) ([3e9b2e0](https://github.com/DouglasPrado/agentx-sdk/commit/3e9b2e0bc997848e0095b7558916ca39ad0602ea))
* override fast-uri &gt;=3.1.2 (closes [#163](https://github.com/DouglasPrado/agentx-sdk/issues/163)) ([#166](https://github.com/DouglasPrado/agentx-sdk/issues/166)) ([d1d03c0](https://github.com/DouglasPrado/agentx-sdk/commit/d1d03c036a5046a5c50192056168a0649f01ff14))
* remove viés de recência em SQLiteVectorStore.search() (closes [#173](https://github.com/DouglasPrado/agentx-sdk/issues/173)) ([#178](https://github.com/DouglasPrado/agentx-sdk/issues/178)) ([53fdf29](https://github.com/DouglasPrado/agentx-sdk/commit/53fdf2978c7abf27b4296ae80904673ced15b142))
* sanitiza &lt;/system-reminder&gt; do conteúdo de injeções em context-builder (closes [#191](https://github.com/DouglasPrado/agentx-sdk/issues/191)) ([#194](https://github.com/DouglasPrado/agentx-sdk/issues/194)) ([fb01c2c](https://github.com/DouglasPrado/agentx-sdk/commit/fb01c2c8a81de276aa89c9b6aaa680d996201f43))
* SSRF guard bloqueia prefixo NAT64 64:ff9b::/96 (closes [#190](https://github.com/DouglasPrado/agentx-sdk/issues/190)) ([#193](https://github.com/DouglasPrado/agentx-sdk/issues/193)) ([ed0a052](https://github.com/DouglasPrado/agentx-sdk/commit/ed0a052aa10bdc9b62a678f7171ee7c7c49e4189))
* valida alinhamento do buffer Float32Array (closes [#165](https://github.com/DouglasPrado/agentx-sdk/issues/165)) ([#168](https://github.com/DouglasPrado/agentx-sdk/issues/168)) ([c8579f4](https://github.com/DouglasPrado/agentx-sdk/commit/c8579f42bb2f3ac5201251548fb60dcb8f81f984))
* valida comprimento de embeddings antes do map em KnowledgeManager.ingest() (closes [#174](https://github.com/DouglasPrado/agentx-sdk/issues/174)) ([#179](https://github.com/DouglasPrado/agentx-sdk/issues/179)) ([83427b8](https://github.com/DouglasPrado/agentx-sdk/commit/83427b80fd42b24522b68d28ebaab2d14e9310e3))

## [0.7.4](https://github.com/DouglasPrado/agentx-sdk/compare/v0.7.3...v0.7.4) (2026-05-08)


### Bug Fixes

* aplica metachar guard incondicionalmente no BashTool (closes [#140](https://github.com/DouglasPrado/agentx-sdk/issues/140)) ([#146](https://github.com/DouglasPrado/agentx-sdk/issues/146)) ([ef8b0f9](https://github.com/DouglasPrado/agentx-sdk/commit/ef8b0f9a6950ab3913a0db891959f62afffd955b))
* bloqueia CGNAT 100.64.0.0/10 no ssrf-guard (closes [#141](https://github.com/DouglasPrado/agentx-sdk/issues/141)) ([#147](https://github.com/DouglasPrado/agentx-sdk/issues/147)) ([1c98525](https://github.com/DouglasPrado/agentx-sdk/commit/1c9852558ee706623d24cc8ccc986ba4ed7bf59a))
* bump hono override para &gt;=4.12.16 (closes [#143](https://github.com/DouglasPrado/agentx-sdk/issues/143)) ([#149](https://github.com/DouglasPrado/agentx-sdk/issues/149)) ([37bc316](https://github.com/DouglasPrado/agentx-sdk/commit/37bc31634fd80a104c7c817e4ae86a91c281d8b6))
* canonicaliza rootDir em assertSafePath para evitar falso positivo com symlink (closes [#157](https://github.com/DouglasPrado/agentx-sdk/issues/157)) ([#161](https://github.com/DouglasPrado/agentx-sdk/issues/161)) ([176edf5](https://github.com/DouglasPrado/agentx-sdk/commit/176edf5ba1732fcbecd1116538cb1067b4346fce))
* corrige falsos positivos no filtro ReDoS do GrepTool (closes [#145](https://github.com/DouglasPrado/agentx-sdk/issues/145)) ([#151](https://github.com/DouglasPrado/agentx-sdk/issues/151)) ([eb72789](https://github.com/DouglasPrado/agentx-sdk/commit/eb72789cdef4cc1331e7be496d12551fcd9f124d))
* delimitadores nonce-based em memory-extractor para prevenir prompt injection (closes [#155](https://github.com/DouglasPrado/agentx-sdk/issues/155)) ([#159](https://github.com/DouglasPrado/agentx-sdk/issues/159)) ([99b0029](https://github.com/DouglasPrado/agentx-sdk/commit/99b00295dd4c70e5d3022786a7e605660b6e4019))
* guarda explícita para choices[] vazio em llm-client.chat() (closes [#154](https://github.com/DouglasPrado/agentx-sdk/issues/154)) ([#158](https://github.com/DouglasPrado/agentx-sdk/issues/158)) ([5b5fa6f](https://github.com/DouglasPrado/agentx-sdk/commit/5b5fa6f8c1bc2460029ee26e310de690e983b1b9))
* guards explícitos para command/url em MCPAdapter (closes [#142](https://github.com/DouglasPrado/agentx-sdk/issues/142)) ([#148](https://github.com/DouglasPrado/agentx-sdk/issues/148)) ([7992ea4](https://github.com/DouglasPrado/agentx-sdk/commit/7992ea492097da0e62fca147dab66252295eccd3))
* limite de 10 MB no FileWrite para prevenir exaustão de disco (closes [#156](https://github.com/DouglasPrado/agentx-sdk/issues/156)) ([#160](https://github.com/DouglasPrado/agentx-sdk/issues/160)) ([b4af1af](https://github.com/DouglasPrado/agentx-sdk/commit/b4af1af3dbd22a9e38e32db21696efc8feec2a2f))
* StreamingToolExecutor usa logger injetável em vez de console.warn (closes [#144](https://github.com/DouglasPrado/agentx-sdk/issues/144)) ([#150](https://github.com/DouglasPrado/agentx-sdk/issues/150)) ([848c69d](https://github.com/DouglasPrado/agentx-sdk/commit/848c69dd4b7f40bfc12b44a90aae25aca14046e9))

## [0.7.3](https://github.com/DouglasPrado/agentx-sdk/compare/v0.7.2...v0.7.3) (2026-05-06)


### Bug Fixes

* **ci:** socket-issues evita duplicatas dentro do mesmo run ([#134](https://github.com/DouglasPrado/agentx-sdk/issues/134)) ([2add661](https://github.com/DouglasPrado/agentx-sdk/commit/2add6617c185de3f663ea16f13f83bc3408303bd))
* **ci:** socket-issues usa .data[] (formato real do socket scan view) ([#130](https://github.com/DouglasPrado/agentx-sdk/issues/130)) ([86b5f5a](https://github.com/DouglasPrado/agentx-sdk/commit/86b5f5abb8b340293b988ea3f46180d670c60608))
