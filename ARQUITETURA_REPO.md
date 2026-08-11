# Arquitetura do Repositório

## Decisão (2026-08-11)

O projeto usa **um único repositório GitHub** para o código da engine:

- **Repo único:** `https://github.com/criandojogodenovo-sketch/modelagemetexturizacao`
- **Diretório de trabalho:** `/home/z/my-project/modelagemetexturizacao/`
- **Branch principal:** `main`
- **Deploy:** Vercel ligada a este repo, branch `main`, auto-deploy a cada push

## Histórico do problema (resolvido)

Durante o desenvolvimento, criou-se acidentalmente uma estrutura confusa:
- O repo pai (`/home/z/my-project/`) era um clone do mesmo repo GitHub
- O "submodule" (`/home/z/my-project/modelagemetexturizacao/`) era outro clone do mesmo repo
- Ambos tinham o **mesmo remote** → pushes de um podiam sobrescrever o outro
- Isto causou perda de ficheiros `src/` duas vezes na sessão de 2026-08-10/11

## Solução aplicada

1. **Repo pai desativado:** o remote `origin` foi renomeado para `origin-DISABLED` no repo pai, pelo que já não pode fazer push. O repo pai fica apenas como arquivo local (read-only).
2. **Repo único ativo:** `/home/z/my-project/modelagemetexturizacao/` é a única fonte de verdade. Todos os commits e pushes devem ser feitos a partir daqui.
3. **Backup de segurança:** branch `backup-pre-cleanup` criada no remote com o estado anterior à limpeza.

## Como trabalhar a partir de agora

### Para fazer commit + push

```bash
# SEMPRE a partir do diretório do submodule
cd /home/z/my-project/modelagemetexturizacao

# Verificar que estamos no branch certo
git branch
# * main

# Verificar que não há ficheiros em falta
git status

# Commit + push
git add -A
git commit -m "descrição da mudança"
git push origin main
```

### NUNCA fazer

```bash
# NÃO fazer push a partir do repo pai
cd /home/z/my-project
git push origin main  # ISTO VAI FALHAR (origin foi desativado)
```

### Verificar que o deploy funcionou

Após cada push, verificar:
1. GitHub: `https://github.com/criandojogodenovo-sketch/modelagemetexturizacao/commits/main`
2. Vercel: o deploy dispara automaticamente (verificar em `https://vercel.com/dashboard`)
3. Produção: `https://modelagemetexturizacao.vercel.app`

## Verificação de integridade

Para confirmar que o repo está saudável:

```bash
# 1. src/ existe e tem ficheiros
cd /home/z/my-project/modelagemetexturizacao
git ls-files src/ | wc -l  # deve ser > 80

# 2. main.jsx existe
ls src/main.jsx

# 3. Build funciona
npm run build

# 4. Remote aponta para o repo certo
git remote -v
# origin  https://github.com/criandojogodenovo-sketch/modelagemetexturizacao.git
```

## Estrutura de ficheiros

```
/home/z/my-project/modelagemetexturizacao/    ← REPO ATIVO (único)
├── src/                                       ← código da engine
│   ├── main.jsx                              ← entry point
│   ├── App.jsx                               ← componente raiz
│   ├── components/                           ← componentes React
│   │   ├── 3d/                              ← viewport 3D
│   │   ├── panels/                          ← painéis do editor
│   │   ├── ui/                              ← componentes UI
│   │   └── home/                            ← página inicial
│   ├── store/                               ← Zustand store
│   ├── utils/                               ← utilitários (shaders, física, etc.)
│   │   ├── conects/                         ← taxonomia de Conects
│   │   ├── flirscript/                      ← interpretador FlirCode
│   │   ├── terrain/                         ← geração de terreno
│   │   └── workers/                         ← Web Workers
│   └── styles/                              ← CSS global
├── public/                                   ← assets estáticos
├── index.html                                ← HTML entry point
├── package.json                              ← dependências
├── vite.config.js                            ← config Vite
├── netlify.toml                              ← config Netlify (legacy)
├── ENGINE_DOC.md                             ← documentação da engine
└── README.md                                 ← readme principal

/home/z/my-project/                           ← REPO PAI (DESATIVADO)
├── .git/                                     ← config com origin-DISABLED
├── scripts/                                  ← scripts de teste (não tracked no submodule)
├── download/                                 ← screenshots (não tracked no submodule)
└── modelagemetexturizacao/                   ← o repo ativo (acima)
```

## Notas

- O repo pai (`/home/z/my-project/`) ainda tem os scripts de teste e screenshots que não são tracked no submodule. Estes podem ser movidos para o submodule se necessário.
- A Vercel está ligada ao repo GitHub `criandojogodenovo-sketch/modelagemetexturizacao`, branch `main`. Qualquer push para este branch dispara um deploy automático.
- O `netlify.toml` existe mas o deploy ativo é na Vercel. Pode ser removido no futuro.
