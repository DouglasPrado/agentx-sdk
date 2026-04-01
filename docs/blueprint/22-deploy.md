# Deploy e Ambientes

> O Pure Agent é uma biblioteca TypeScript, não um serviço deployável. Esta seção documenta os ambientes de uso e a estratégia de distribuição do pacote.

---

## Ambientes

| Ambiente | Objetivo | Configuração | Observações |
| -------- | -------- | ------------ | ----------- |
| Dev | Desenvolvimento e testes locais | SQLite `:memory:` ou arquivo local, `deterministic: true` opcional | `import { Agent } from './src/agent'` |
| Test (CI) | Testes automatizados | SQLite `:memory:`, `deterministic: true` (seed/temp fixos) | `tsc --noEmit` + testes com cenários do PRD |
| Prod | Uso pela aplicação host em produção | SQLite `~/.agent/data.db` (configurável), WAL mode | Lib embutida no processo Node.js do consumidor |

---

## Estratégia de Distribuição

| Aspecto | Escolha |
| ------- | ------- |
| **Runtime** | Node.js 18+ (fetch nativo, dynamic import) |
| **Formato** | Pacote TypeScript importável (`src/agent/index.ts` re-exports) |
| **Persistência** | SQLite via `better-sqlite3` — arquivo único, zero config |
| **Configuração** | Via `AgentConfig` (Zod schema) no código — sem arquivos de config externos |
| **Segredos** | API key via `AgentConfig.apiKey` — passada programaticamente pelo consumidor |

---

## Configuração por Ambiente

| Parâmetro | Dev | Test | Prod |
| --------- | --- | ---- | ---- |
| `storage.inMemory` | `true` ou `false` | `true` | `false` |
| `storage.path` | `./dev.db` | N/A (memory) | `~/.agent/data.db` |
| `deterministic` | Opcional | `true` | `false` |
| `costPolicy` | Permissivo | Restritivo (low limits) | Conforme uso |
| `debug.enabled` | `true` | `false` | `false` (ou `minimal`) |

---

## Rollback

> Como o Pure Agent é uma biblioteca, "rollback" significa reverter para uma versão anterior do pacote.

- **Estratégia:** Pin de versão no `package.json` do consumidor
- **Compatibilidade:** Interfaces plugáveis (`MemoryStore`, `VectorStore`) são contratos estáveis
- **Dados:** Schema do SQLite usa migrations — rollback de schema pode requerer recriar o banco

---

## Checklist Pré-Produção

- [ ] `tsc --noEmit` sem erros
- [ ] Todos os 9 cenários de verificação do PRD passando
- [ ] Zero imports de fora de `src/agent/`
- [ ] ≤ 4 dependências em `dependencies`
- [ ] `npm audit` sem vulnerabilidades críticas
- [ ] CostPolicy configurado e testado
- [ ] Performance validada: overhead < 50ms, busca vetorial < 100ms para 50K vetores
- [ ] Documentação de API atualizada
