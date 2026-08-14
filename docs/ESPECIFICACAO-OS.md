# ESPECIFICAÇÃO FUNCIONAL — Jatear OS

> Documento complementar ao `CLAUDE.md`. Local definitivo: `C:\jatear-os\docs\ESPECIFICACAO-OS.md`
> Em caso de conflito, o `CLAUDE.md` prevalece em identidade visual, stack e metodologia.
> Este documento prevalece em **modelo de dados, fluxo e regras de negócio da OS**.

---

## 1. OBJETIVO E ESCOPO

Sistema para controlar Ordens de Serviço de tratamento anticorrosivo **por peça recebida**, do recebimento ao faturamento, com **fechamento parcial** (faturar apenas os itens concluídos) e **filtros amplos** para geração de faturamento por cliente e período.

**No escopo (v1):**
- Cadastro de clientes, subclientes e tabela de preços
- Cadastro de serviços
- Abertura e edição de OS com numeração automática editável
- Grade de itens (peças) por OS, com serviços por item
- Controle de status por item e conclusão parcial
- Filtro avançado, geração de faturamento e marcação de itens faturados
- Relatórios em PDF e exportação CSV
- **Uso em celular como PWA responsiva instalável** (seção 13)

**Fora do escopo da v1** (ver seção 17): inspeção de qualidade formal, apontamento de horas por colaborador, controle de NR por colaborador, portal do cliente.

---

## 2. PREMISSAS ADOTADAS

1. O negócio é **job shop por peças** (recebe, trata, devolve), não obra por m² de campo. O modelo de dados desta especificação **substitui** o modelo de `ordens_servico` do `CLAUDE.md` seção 9.
2. Um item (peça) pode receber **um ou mais serviços**. Ex.: "Jateamento e pintura duas demãos" é um único serviço cadastrado, mas o sistema aceita combinações.
3. A cobrança pode ser por **m², kg, peça, hora ou verba** — a unidade vem do serviço e é editável no item.
4. O **subcliente** é um campo do cabeçalho da OS (cliente final do cliente), com lista sugerida por cliente e digitação livre permitida.
5. Peso e área são informados por unidade e multiplicados pela quantidade; ambos podem ficar em branco.
6. Faturamento **não emite nota fiscal**. Gera o documento de faturamento e registra o número da NF manualmente depois.
7. Sistema de uso interno, poucos usuários simultâneos, prioridade em simplicidade e velocidade de digitação.
8. **A aplicação roda em celular como PWA responsiva** — mesmo código React, mesmo deploy, sem app nativo e sem loja de aplicativos. Não haverá React Native nem base de código separada.

---

## 3. TERMINOLOGIA

| Termo | Significado |
| --- | --- |
| **OS** | Ordem de Serviço — documento de entrada de um lote de peças de um cliente |
| **Item** | Peça ou grupo de peças idênticas dentro da OS |
| **Subcliente** | Cliente final do cliente (obra/destino da peça) |
| **Serviço** | Tratamento aplicado ao item (jateamento, pintura etc.) |
| **Fechamento parcial** | Conclusão/faturamento de parte dos itens sem encerrar a OS |
| **Faturamento** | Agrupamento de itens concluídos, por cliente e período, para cobrança |

---

## 4. MODELO DE DADOS (Firestore)

Coleções em português, minúsculas, plural. Datas em `Timestamp`. Valores em `Number`.

### 4.1 `clientes/{clienteId}`

```
razaoSocial          string  obrigatório
nomeFantasia         string
cnpj                 string  validado, único
inscricaoEstadual    string
endereco             { logradouro, numero, bairro, cidade, uf, cep }
contatoPrincipal     string
telefone             string
email                string
subclientes          array   [{ id, nome, observacao, ativo }]
tabelaPrecos         array   [{ servicoCodigo, unidade, preco }]
prazoPadraoDias      number  usado para sugerir data prevista de entrega
ativo                boolean default true
criadoEm, criadoPor, atualizadoEm, atualizadoPor
```

### 4.2 `servicos/{servicoId}`

```
codigo               string  único, maiúsculo (ex.: JAT, PIN, JP1, JP2)
nome                 string
descricao            string
unidadePadrao        string  m2 | kg | peca | hora | verba
precoPadrao          number
demaos               number  0 | 1 | 2
grauLimpezaPadrao    string  Sa1 | Sa2 | Sa2.5 | Sa3 | ST2 | ST3 | null
ativo                boolean
ordem                number  ordem de exibição
```

**Carga inicial obrigatória:**

| Código | Nome | Unidade padrão | Demãos |
| --- | --- | --- | --- |
| `JAT` | Jateamento | m2 | 0 |
| `PIN` | Pintura | m2 | 1 |
| `JP1` | Jateamento e Pintura — 1 demão | m2 | 1 |
| `JP2` | Jateamento e Pintura — 2 demãos | m2 | 2 |

Demais serviços do `CLAUDE.md` (HID, ST2, ST3, ALP) podem ser cadastrados pela tela, sem carga inicial.

### 4.3 `ordens_servico/{osId}`

```
numero               string  editável, único. Formato OS-AAAA-NNNN
numeroSequencial     number  usado para ordenação
ano                  number
clienteId, clienteNome
subclienteNome       string
pedidoCompraCliente  string
solicitante          string
contatoCliente       string
dataAbertura         Timestamp  default hoje
dataPrevistaEntrega  Timestamp  sugerida por prazoPadraoDias do cliente
status               string  derivado (ver 6.2)
statusFaturamento    string  nao_faturada | parcial | faturada
totais               { qtdItens, itensConcluidos, itensFaturados,
                       pesoTotalKg, areaTotalM2, valorTotal, valorFaturado, valorAFaturar }
observacoes          string
motivoCancelamento   string
criadoPor, criadoEm, atualizadoPor, atualizadoEm
```

`status` e `totais` são **campos derivados**, recalculados a cada alteração de item, dentro da mesma transação.

### 4.4 `ordens_servico/{osId}/itens/{itemId}` — subcoleção

Subcoleção (não array) porque a OS pode ter dezenas ou centenas de itens com status independente.
Campos do cabeçalho são **desnormalizados** no item para permitir consulta global por `collectionGroup`.

```
osId, osNumero, clienteId, clienteNome, subclienteNome   // desnormalizados
sequencia            number  1..n, dentro da OS
descricao            string  nome da peça — obrigatório
codigoPeca           string  código/tag do cliente
quantidade           number  default 1
pesoUnitarioKg       number
pesoTotalKg          number  = quantidade × pesoUnitarioKg (calculado)
areaUnitariaM2       number
areaTotalM2          number  = quantidade × areaUnitariaM2 (calculado)
dataRecebimento      Timestamp  obrigatório
dataPrevistaEntrega  Timestamp
dataConclusao        Timestamp  preenchida ao concluir
dataEntrega          Timestamp  preenchida ao entregar
servicos             array   [{ servicoCodigo, servicoNome, unidade,
                                quantidadeCobrada, precoUnitario, valor,
                                esquemaPintura, corRal, espessuraEspecificada }]
valorTotalItem       number  soma de servicos[].valor
status               string  recebido | em_execucao | concluido | entregue | faturado | cancelado
faturado             boolean default false
faturamentoId        string  null enquanto não faturado
notaFiscal           string
observacoes          string  texto livre, até 500 caracteres — especificidades do
                             serviço daquela peça (ex.: "mascarar rosca",
                             "não pintar face interna", "peça com trinca no recebimento")
fotos                array   [{ tipo: antes|depois, urlStorage, enviadoEm }]
criadoEm, atualizadoEm, atualizadoPor
```

**Cálculo de `quantidadeCobrada`:** sugerida automaticamente conforme a unidade —
`m2` → `areaTotalM2` · `kg` → `pesoTotalKg` · `peca` → `quantidade` · `hora`/`verba` → digitação manual.
Sempre **editável** pelo usuário.

### 4.5 `faturamentos/{faturamentoId}`

```
numero               string  FAT-AAAA-NNNN, sequencial anual
clienteId, clienteNome
subclienteNome       string  opcional, quando o filtro for de um único subcliente
periodoInicio, periodoFim   Timestamp
criterioData         string  recebimento | conclusao | entrega
itens                array   [{ osId, osNumero, itemId, sequencia, descricao,
                                quantidade, pesoTotalKg, areaTotalM2,
                                servicos: [{ codigo, unidade, quantidadeCobrada, precoUnitario, valor }],
                                valorTotalItem }]
qtdItens             number
pesoTotalKg, areaTotalM2, valorTotal   number
status               string  emitido | cancelado
notaFiscal           string
dataNotaFiscal       Timestamp
observacoes          string
geradoPor, geradoEm, canceladoPor, canceladoEm, motivoCancelamento
```

O faturamento guarda **cópia congelada** dos valores no momento da geração. Alteração posterior de preço no item não altera o faturamento emitido.

### 4.6 `contadores/{contadorId}`

```
// contadorId = "os_2026" ou "fat_2026"
prefixo              string  OS | FAT
ano                  number
ultimoNumero         number
```

### 4.7 `usuarios/{uid}` e `logs/{logId}`

Conforme `CLAUDE.md` seção 9, sem alteração.

### 4.8 Storage

`os/{osId}/{itemId}/{tipo}/{arquivo}` — `tipo` = `antes` | `depois` | `documento`

---

## 5. NUMERAÇÃO

1. **OS:** formato `OS-AAAA-NNNN` (ex.: `OS-2026-0001`), gerado por **transação atômica** sobre `contadores/os_{ano}`.
2. O campo `numero` é **editável** pelo usuário na abertura e na edição da OS.
3. Ao salvar com número editado, o sistema:
   - valida o formato `OS-AAAA-NNNN`;
   - valida **unicidade** (consulta `where numero == valor`);
   - se o número editado for maior que `ultimoNumero`, **atualiza o contador** para evitar colisão futura;
   - registra a alteração em `logs`.
4. Número de OS **nunca é reutilizado**, mesmo após cancelamento.
5. **Faturamento:** `FAT-AAAA-NNNN`, mesma mecânica, **não editável**.

---

## 6. FLUXO DE STATUS

### 6.1 Status do item

```
recebido → em_execucao → concluido → entregue → faturado
                              ↓
                          cancelado (com justificativa)
```

- `concluido` exige `dataConclusao`.
- `entregue` exige `dataEntrega`. **Etapa opcional**: o item pode ser faturado a partir de `concluido`.
- `faturado` é atribuído **apenas** pela rotina de geração de faturamento — nunca manualmente.
- Retrocesso de status: somente perfil Administrador, com registro em log. Item `faturado` só retrocede se o faturamento for cancelado.

### 6.2 Status da OS — **derivado, nunca digitado**

| Condição dos itens | Status da OS |
| --- | --- |
| Nenhum item ou todos `recebido` | `aberta` |
| Ao menos um item em `em_execucao`/`concluido`/`entregue` e nem todos faturados | `em_execucao` |
| Todos os itens `concluido`/`entregue`/`cancelado`, nenhum faturado | `concluida` |
| Parte dos itens `faturado` | `parcialmente_faturada` |
| Todos os itens não cancelados `faturado` | `faturada` |
| OS cancelada manualmente | `cancelada` |

**Fechamento parcial:** é o comportamento padrão. Não existe ação "fechar OS" bloqueante — a OS fecha sozinha quando todos os itens fecham. Existe apenas a ação manual **"Encerrar OS"**, que cancela os itens restantes com justificativa.

---

## 7. REGRAS DE NEGÓCIO

1. Item sem `descricao` e sem `dataRecebimento` não pode ser salvo.
2. Item sem serviço lançado **não pode ser concluído**.
3. Item com serviço sem `precoUnitario` **não pode ser faturado** — aparece no filtro com alerta "sem preço".
4. Preço sugerido: `clientes.tabelaPrecos` para o serviço → se não houver, `servicos.precoPadrao`. Sempre editável no item.
5. Não é permitido faturar item já faturado (`faturado = true`). Consulta feita dentro da transação.
6. Geração de faturamento é **transacional**: cria `faturamentos/{id}`, marca cada item com `faturado = true`, `faturamentoId`, `status = faturado`, e recalcula os totais das OS envolvidas. Falha em qualquer etapa desfaz tudo.
7. **Cancelamento de faturamento:** exige justificativa; devolve os itens para `status = concluido`, `faturado = false`, `faturamentoId = null`. O faturamento fica com `status = cancelado` e **não é excluído**.
8. Um faturamento contém itens de **um único cliente**. Pode conter itens de várias OS e vários subclientes.
9. Não excluir registros operacionais — usar `ativo = false`, `status = cancelado`.
10. Toda alteração em OS, item e faturamento gera registro em `logs`.
11. Item com `dataPrevistaEntrega` vencida e status diferente de `entregue`/`faturado` é marcado como **atrasado** (cálculo em tela, não persistido).
12. Alteração do cliente da OS é bloqueada depois que existir item faturado.

---

## 8. TELAS

### 8.1 Dashboard
Cartões: OS abertas · Itens em execução · Itens concluídos a faturar (qtd e R$) · Itens atrasados · m² e kg do mês · Faturado no mês.
Cada cartão é um atalho que abre a Consulta de Itens já filtrada.

### 8.2 Clientes
Lista com busca por razão social/CNPJ. Cadastro com abas: **Dados**, **Subclientes**, **Tabela de Preços**.

### 8.3 Serviços
Lista simples com código, nome, unidade padrão, preço padrão, ativo. Edição em modal.

### 8.4 Ordem de Serviço — Cabeçalho
Campos: número (pré-preenchido e editável), cliente (busca), subcliente (select com digitação livre), pedido de compra, solicitante, data de abertura, data prevista de entrega, observações.
Rodapé fixo com totais: itens, peso, m², valor total, valor a faturar.

### 8.5 Ordem de Serviço — Grade de itens
Tabela editável em linha, otimizada para digitação rápida:

`Seq | Descrição | Cód. peça | Qtd | Peso un. (kg) | Área un. (m²) | Serviço | Qtd cobrada | Preço un. | Valor | Recebimento | Prev. entrega | Observações | Status | Ações`

Requisitos:
- **Coluna Observações** em toda linha de item: campo de texto livre, editável direto na grade, para registrar especificidades do serviço daquela peça. Exibir truncado com reticências na grade e completo em `tooltip`; expandir em `textarea` ao clicar. Ícone indicador na linha quando houver conteúdo. Preenchimento opcional.
- Botões **Adicionar item**, **Duplicar linha**, **Importar CSV** (colunas conforme cabeçalho acima).
- Ação em lote **Aplicar observação** aos itens selecionados.
- Seleção múltipla com ações em lote: alterar status, definir data de conclusão, definir data prevista de entrega, aplicar serviço, aplicar preço.
- Ao mudar item para `concluido`, preencher `dataConclusao` com a data atual (editável).
- Linha de item faturado fica **bloqueada para edição** e sinalizada com o número do faturamento.
- Totalizadores no rodapé da grade.
- **No celular a grade vira lista de cartões** — ver seção 13.3.

### 8.6 Consulta de Itens (tela central de operação)
Filtro avançado (seção 9) + tabela de resultados + totais + ações: **Gerar faturamento**, **Exportar CSV**, **Exportar PDF**.

### 8.7 Faturamentos
Lista com número, cliente, período, qtd de itens, valor, NF, status. Detalhe com os itens congelados, botões **PDF**, **Registrar NF**, **Cancelar faturamento**.

### 8.8 Administração
Usuários e perfis, parâmetros, consulta de logs.

---

## 9. FILTRO E RELATÓRIO — DETALHAMENTO

A Consulta de Itens opera sobre `collectionGroup('itens')`.

### 9.1 Filtros disponíveis

| Filtro | Tipo |
| --- | --- |
| Cliente | seleção múltipla |
| Subcliente | seleção múltipla (dependente do cliente) |
| Número da OS | texto / intervalo |
| Descrição, código da peça ou observações | texto livre |
| Serviço | seleção múltipla |
| Status do item | múltipla: recebido, em execução, concluído, entregue, faturado, cancelado |
| **Situação de faturamento** | **Em aberto (não faturado)** · **Faturado** · **Todos** |
| Período | data inicial e final |
| **Critério da data** | recebimento · conclusão · entrega · faturamento |
| Número do faturamento | texto |
| Nota fiscal | texto |
| Somente atrasados | checkbox |
| Somente com preço pendente | checkbox |
| Faixa de valor | mínimo / máximo |

### 9.2 Filtros pré-definidos (botões rápidos)
`A faturar` · `Em aberto` · `Atrasados` · `Faturado no mês` · `Sem preço`

### 9.3 Resultado
Colunas: OS · Seq · Descrição · Cliente · Subcliente · Serviço · Qtd · Peso · m² · Valor · Recebimento · Conclusão · Observações · Status · Faturamento · NF.
A coluna Observações é ocultável e entra na busca por texto livre e na exportação CSV.
Ordenação por qualquer coluna. Totalizadores de qtd, peso, m² e valor sempre visíveis.
Seleção por linha, por página e "selecionar tudo do filtro".

### 9.4 Geração de faturamento a partir do filtro
1. Usuário filtra por cliente + período + situação **Em aberto** + status `concluido`/`entregue`.
2. Seleciona os itens (ou "selecionar tudo").
3. Clica em **Gerar faturamento**. O sistema valida: cliente único, nenhum item já faturado, todos com preço.
4. Tela de conferência com totais → confirmar.
5. Transação grava o faturamento e marca os itens.
6. Ao final, **os itens deixam de aparecer no filtro "Em aberto"** e passam a aparecer em "Faturado".

### 9.5 Relatórios em PDF
- **OS impressa** — cabeçalho do cliente, lista de itens, serviços, **observações de cada item**, totais, campo de assinatura.
- **Romaneio de entrega** — itens selecionados, peso e quantidade, campo de recebimento.
- **Relatório de faturamento** — agrupado por OS e por subcliente, com totais.
- **Relatório gerencial de período** — m², kg e valor por cliente/serviço.

Todos com cabeçalho de logo e rodapé `www.jatear.com | jatear@jatear.com | (31) 3852-5462`.

---

## 10. ÍNDICES FIRESTORE NECESSÁRIOS

Collection group `itens`:
- `clienteId ASC, faturado ASC, dataConclusao ASC`
- `clienteId ASC, status ASC, dataRecebimento ASC`
- `faturado ASC, dataPrevistaEntrega ASC`
- `osNumero ASC, sequencia ASC`
- `faturamentoId ASC`

Coleção `ordens_servico`: `clienteId ASC, dataAbertura DESC` · `status ASC, dataAbertura DESC`
Coleção `faturamentos`: `clienteId ASC, geradoEm DESC`

Criar cada índice **junto** com a consulta que o exige.

---

## 11. PERFIS DE ACESSO (simplificados)

| Perfil | Permissões |
| --- | --- |
| **Administrador** | Tudo, inclusive retrocesso de status, cancelamento de faturamento e usuários |
| **Produção** | Cria e edita OS e itens, altera status até `entregue`, anexa fotos. Não vê valores |
| **Faturamento** | Consulta tudo, gera e cancela faturamento, registra NF. Não altera status de produção |
| **Consulta** | Somente leitura, sem valores financeiros |

Regras do Firestore escritas junto com cada coleção. Nenhuma leitura antes da resolução do `AuthContext`.

---

## 12. VALIDAÇÕES DE INTERFACE

- CNPJ validado com dígito verificador.
- Datas em `DD/MM/AAAA`; valores em `R$ 0.000,00` (pt-BR).
- Peso com 2 casas, área com 2 casas, preço com 2 casas.
- Mensagem de erro explicando **o que houve e o que fazer**, sem código cru.
- Nenhum emoji na interface. Vermelho `#B51013`, Arial, ícones SVG lineares.

---

## 13. MOBILE E RESPONSIVIDADE

### 13.1 Estratégia

**PWA (Progressive Web App) responsiva**, com o mesmo código React e o mesmo deploy do Firebase Hosting. O usuário acessa `os.jatear.com` no navegador do celular e usa **"Adicionar à tela de início"** para instalar o ícone. Não há app nativo, loja de aplicativos nem código duplicado.

Justificativa: uma única base de código, deploy único, atualização instantânea para todos os aparelhos, custo zero de manutenção adicional.

### 13.2 Breakpoints

| Faixa | Dispositivo | Layout |
| --- | --- | --- |
| `< 768px` | Celular | Coluna única, navegação inferior, cartões no lugar de tabelas |
| `768px – 1024px` | Tablet | Duas colunas, tabelas com rolagem horizontal |
| `> 1024px` | Desktop | Layout completo, tabelas densas |

Definir os breakpoints em `/src/styles/variaveis.css`. **Desenvolver mobile-first**: o CSS base é o do celular; `min-width` amplia para telas maiores.

### 13.3 Adaptação por tela

| Tela | Comportamento no celular |
| --- | --- |
| **Login** | Campos em coluna única, botão de largura total |
| **Dashboard** | Cartões empilhados, um por linha |
| **Consulta de itens** | Lista de cartões: descrição, OS, cliente, status, valor. Filtro abre em painel deslizante (*bottom sheet*), não fica fixo na tela |
| **OS — cabeçalho** | Formulário em coluna única; totais em barra fixa no rodapé |
| **OS — itens** | **Lista de cartões**, um por item, com descrição, quantidade, serviço, status e ícone de observação. Toque no cartão abre a edição em tela cheia. Sem edição em linha no celular |
| **Clientes / Serviços** | Lista simples; cadastro em tela cheia |
| **Faturamento e Relatórios** | Acessíveis, mas **otimizados para desktop**. No celular, permitir consultar e baixar o PDF; a geração de faturamento exibe aviso recomendando o desktop |

### 13.4 Padrões de interface móvel

- **Navegação inferior fixa** com no máximo 5 destinos: Início · OS · Itens · Faturamento · Menu. Ícones SVG lineares brancos sobre `#B51013`.
- Área de toque mínima de **44 × 44 px** em todo botão, ícone e linha clicável.
- Inputs com `font-size: 16px` — abaixo disso o iOS aplica zoom automático ao focar o campo.
- `inputmode="decimal"` em peso, área, quantidade e preço; `inputmode="numeric"` em datas digitadas — abre o teclado numérico direto.
- Ação principal de cada tela em **botão flutuante** no canto inferior direito (ex.: "Adicionar item").
- Confirmações em *bottom sheet*, nunca em `alert()` do navegador.
- Sem `hover` como único recurso de descoberta — tudo deve ser alcançável por toque.
- Tabelas remanescentes usam rolagem horizontal com a primeira coluna fixa; **nunca** reduzir a fonte para caber.

### 13.5 Câmera e fotos

- Upload de foto do item por `<input type="file" accept="image/*" capture="environment">` — abre a câmera traseira direto.
- **Compressão obrigatória no cliente antes do upload**, via `canvas`: redimensionar para no máximo 1600 px no lado maior e exportar em JPEG com qualidade 0,8. Sem biblioteca adicional.
- Exibir barra de progresso do upload e permitir cancelar.
- Miniatura na lista, imagem completa em tela cheia ao tocar.

### 13.6 Funcionamento com sinal fraco

- Ativar a **persistência offline do Firestore** (`enableIndexedDbPersistence` / `persistentLocalCache`) na inicialização em `src/firebase.js`. Consultas já lidas continuam disponíveis e as gravações entram em fila até o sinal voltar.
- Exibir **indicador de "sem conexão"** na barra superior quando `navigator.onLine === false`.
- Não bloquear a interface durante gravação: gravar otimista e sinalizar pendência.
- Restrição a documentar: a persistência só funciona em **uma aba por vez**; tratar o erro `failed-precondition` sem quebrar a aplicação.

### 13.7 Instalação como aplicativo

- `public/manifest.json`: `name` "Jatear OS", `short_name` "Jatear OS", `display: standalone`, `theme_color: #B51013`, `background_color: #FFFFFF`, `orientation: portrait`.
- Ícones em 192 px e 512 px (logo Jatear em fundo branco) e `apple-touch-icon` 180 px.
- `<meta name="theme-color" content="#B51013">` e `viewport` com `viewport-fit=cover`.
- Respeitar `env(safe-area-inset-bottom)` na navegação inferior — necessário em iPhone com barra de gestos.
- Service worker apenas para *cache* do *app shell*. **Não** implementar sincronização offline customizada — o Firestore já resolve.

### 13.8 Validação

Testar em **Chrome Android** e **Safari iOS**, em pelo menos um aparelho real. Validar: instalação pelo ícone, login persistente, criação de item, upload de foto pela câmera e comportamento com dados móveis desligados.

---

## 14. FASES DE ENTREGA

| Fase | Escopo | Critério de aceite visual |
| --- | --- | --- |
| **0 — Fundação** | GitHub, React, Firebase, `.gitignore`, autenticação, **layout base responsivo mobile-first**, navegação inferior no celular, `manifest.json` e ícones | Login funcional no desktop **e no celular**, com barra vermelha e logo |
| **1 — Cadastros** | Clientes + subclientes + tabela de preços; Serviços com carga inicial | Cliente e 4 serviços cadastrados e listados |
| **2 — OS e itens** | Cabeçalho com numeração editável + grade de itens com serviços e totais + **lista de cartões no celular** | OS `OS-2026-0001` com 3 itens e totais corretos nas duas telas |
| **3 — Status e fechamento parcial** | Status por item, status derivado da OS, ações em lote | OS com 3 itens onde 1 está concluído e a OS aparece "em execução" |
| **4 — Consulta e filtros** | `collectionGroup`, filtro completo, totalizadores, exportação CSV, **filtro em painel deslizante no celular** | Filtro "A faturar" retornando apenas itens concluídos não faturados |
| **5 — Faturamento** | Geração transacional, marcação de itens, cancelamento, registro de NF | Item faturado desaparece de "Em aberto" e aparece em "Faturado" |
| **6 — Campo (mobile)** | Foto pela câmera com compressão, persistência offline do Firestore, indicador de conexão, instalação como PWA | Foto tirada pelo celular aparece no item; app instalado na tela de início |
| **7 — PDF e refinamento** | OS impressa, romaneio, relatório de faturamento, dashboard, logs | PDF com logo e rodapé institucional |

Não avançar de fase sem teste, commit e validação por captura de tela.

---

## 15. CRITÉRIOS DE ACEITE GERAIS

1. Abrir OS com 50 itens e faturar apenas 20 deles, permanecendo 30 em aberto.
2. Filtrar por cliente + período de conclusão + "Em aberto" e gerar faturamento em uma ação.
3. Cancelar um faturamento e ver os itens retornarem para "Em aberto".
4. Editar o número da OS e receber bloqueio ao repetir um número existente.
5. Totais de peso, m² e valor conferindo entre grade, consulta e PDF.
6. **Pelo celular**: abrir a OS, concluir um item, registrar observação e anexar foto da câmera, sem rolagem horizontal e sem zoom manual.

---

## 16. SUGESTÕES INCORPORADAS (baixo custo, alto ganho)

1. **Importação de itens por CSV** e **duplicar linha** — indispensável para OS com dezenas de peças.
2. **Romaneio de entrega** em PDF, com campo de assinatura do transportador.
3. **Peso como unidade de cobrança** (`kg`), além de m² — comum em jateamento de peças.
4. **Observações por item**, com busca por texto livre e saída na OS impressa.
5. **Indicador de atraso** por item e cartão no dashboard.
6. **Congelamento de valores** no faturamento, para não reescrever histórico.
7. **Registro de NF** no faturamento, para conciliação com o contábil.
8. **Ações em lote** na grade de itens (concluir vários de uma vez).
9. **Alerta de item sem preço**, evitando faturamento incompleto.
10. **Perfis reduzidos a 4**, mantendo a operação simples.
11. **Exportação CSV** em toda consulta — resolve relatórios não previstos sem novo desenvolvimento.
12. **Foto antes/depois por item**, opcional, como prova de execução — tirada direto da câmera do celular.
13. **PWA responsiva com persistência offline**, para uso no pátio e na oficina sem depender de sinal estável.

> **Decisão do responsável:** **não implementar etiquetas com QR Code** — em nenhuma fase.

---

## 17. SUGESTÕES PARA V2 (não implementar agora)

- Inspeção de qualidade formal (ponto de orvalho, espessura, aderência) vinculada ao item.
- Controle de validade de NR-35 e bloqueio de alocação (regra do `CLAUDE.md` seção 10.4).
- Apontamento de horas por colaborador e custo por OS.
- Consumo de tinta e abrasivo por OS.
- Notificação por e-mail (Brevo) ao concluir OS ou emitir faturamento.
- Portal de consulta para o cliente.
- Notificação *push* no celular para itens atrasados.

---

*Jatear Tratamento Anticorrosivo Ltda — documento interno de projeto.*
*www.jatear.com | jatear@jatear.com | (31) 3852-5462*
