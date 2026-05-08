# Changelog

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
