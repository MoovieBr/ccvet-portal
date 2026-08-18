# Portal CCVET

Portal da CCVET Capacitação Veterinária — landing page e portal do aluno,
sobre Firebase (Hosting, Auth, Firestore, Storage e Cloud Functions).

Projeto Firebase: `ccvet-41f5d` · Domínio: `ccvetitajai.com`

## Estrutura

```
public/            # servido pelo Hosting (landing + build do portal)
portal-app/        # fonte do portal (Vite + React) → build em public/portal/
functions/         # Cloud Functions (Node 20)
firestore.rules    # permissões por papel e por seção
storage.rules      # apostilas em PDF
```

## Como funciona

**Papéis** ficam em custom claims do Auth (`admin`, `staff`, `aluno`). A equipe
tem permissões por seção (`modulos`, `avisos`, `cronograma`, `links`, `alunos`,
`financeiro`, `turmas`, `presenca`) guardadas em `staff/{uid}.perms`.

**Operações privilegiadas passam por uma fila.** A organização bloqueia
endpoints públicos, então em vez de funções chamáveis o painel grava um
documento em `tarefas/` e o trigger `processaTarefa` executa e devolve o
resultado no mesmo documento. É também por isso que a conciliação de
pagamentos é uma função agendada em vez de um webhook da Asaas.

**Turmas** organizam os alunos. Encerrar uma turma grava `acessoConteudo:
false` em todos os alunos dela, e as regras bloqueiam módulos e apostilas a
partir daí — certificado e financeiro continuam acessíveis.

**Certificado** é liberado à mão pela coordenação: o curso tem aulas
presenciais e práticas que o portal não tem como verificar.

**Financeiro** usa a Asaas. Salvar um plano cria a série de cobranças inteira
(parcelamento nativo), e `sincronizarPagamentos` roda a cada 15 minutos para
dar baixa nas parcelas pagas e emitir a NFS-e.

## Rodar

```bash
npm --prefix portal-app run dev        # portal contra o Emulator Suite
firebase emulators:start               # Auth, Firestore, Storage, Functions

npm --prefix portal-app run build      # escreve em public/portal/
firebase deploy                        # hosting + rules + functions
```

## Segredos

`MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` e `ASAAS_API_KEY` vivem no Secret Manager e
são declarados no `runWith({ secrets: [...] })` das functions. Nunca no código.

A chave da Asaas em uso é de **sandbox** (contém `_hmlg_`); a troca para
produção é só substituir o segredo. O código escolhe a URL da API pela chave.
