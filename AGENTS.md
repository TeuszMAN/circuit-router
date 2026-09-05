# Circuit Router — convenções para agentes de código

Jogo de quebra-cabeça de lógica digital em grid (mobile-first). O dono/PO: Mateus (TeuszMAN). Docs e commits em PT-BR; código em inglês.

## Regras de commit (OBRIGATÓRIAS)
- Mensagens: Conventional Commits em PT-BR (feat, fix, refactor, chore, docs, test, style, perf), imperativo curto. Ex.: `feat(core): implementa propagação de sinal com detecção de ciclos`.
- 1 tarefa = 1 commit. Nada além da mensagem no corpo: **proibido** trailer Co-Authored-By, "Generated with", assinaturas etc.
- Autor: sempre a identidade do git local (`TeuszMAN <mateuszman.contato@gmail.com>`). Nunca use `--author`, nunca `git config` de autor.
- Implementadores **nunca** executam `git push` — quem publica é o supervisor da operação noturna.
- Rodar a suíte de testes antes de commitar (npm test / npx jest / conforme a fase).

## Arquitetura e docs
- Decisões registradas em `docs/ADR-0001-*.md` (aceitas pelo PO).
- Spec do sistema: `docs/SDD.md` — siga-a; atualize-a se mudar o design.
- Estrutura de pastas e fronteiras de arquivo: ver SDD/ADR. Respeite a área da sua tarefa (não edite arquivos de outra área).

## Produto
- Nome do jogo: **Circuit Router** (não usar "Logic Router" em código novo).
- Foco mobile/touch-first; PWA conforme ADR.
