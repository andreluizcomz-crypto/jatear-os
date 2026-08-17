# CLAUDE.md — Jatear OS (Sistema de Controle de Ordens de Serviço)

> Arquivo de instrução permanente do projeto. Deve permanecer na raiz do repositório.
> O Claude Code lê este arquivo automaticamente no início de cada sessão.
> **Mantenha-o enxuto.** Detalhamentos longos vão para `/docs`, nunca para cá.

---

## 1. IDENTIFICAÇÃO DO PROJETO

| Item | Valor |
| --- | --- |
| **Nome do sistema** | Jatear OS — Controle de Ordens de Serviço |
| **Empresa** | Jatear Tratamento Anticorrosivo Ltda |
| **Objetivo** | Emitir, controlar, executar, inspecionar e faturar Ordens de Serviço de jateamento e pintura industrial |
| **Tipo** | Aplicação web interna (uso corporativo, não público) |
| **Projeto irmão** | Jatear LMS (`jatear-lms.web.app`) — plataforma de treinamentos |
| **Relação entre projetos** | **Independentes.** Repositórios, projetos Firebase e deploys separados. Compartilham apenas *padrões*: identidade visual, stack, arquitetura e metodologia |
| **Diretório local** | `C:\jatear-os` |
| **Idioma** | Português do Brasil em 100% da interface, documentos e comentários |

---

## 2. CONTEXTO INSTITUCIONAL (resumo operacional)

**Jatear Tratamento Anticorrosivo Ltda** — CNPJ 15.013.959/0001-39
Rua Gazania, 868 — Campos Elísios, João Monlevade/MG — CEP 35.931-193
(31) 3852-5462 | jatear@jatear.com | www.jatear.com
EPP | CNAE 25.39-0-02 | Fundada em 08/02/2012 | +13 anos de mercado
Capacidade produtiva: **até 3.300 m²/mês**

### Serviços executados (usar exatamente estes nomes no sistema)

| Código | Serviço | Referência técnica |
| --- | --- | --- |
| `JAT` | Jateamento Abrasivo | SIS 05 59 00 — Sa1, Sa2, Sa2½, Sa3 |
| `HID` | Hidrojateamento | Alta pressão, sem resíduo abrasivo |
| `ST2` | Limpeza Manual | SIS 05 59 00 — grau ST2 |
| `ST3` | Limpeza Mecânica | SIS 05 59 00 — grau ST3 |
| `PIN` | Pintura Industrial | Epóxi, poliuretano, esmalte sintético |
| `ALP` | Alpinismo Industrial | NR-35 — Trabalho em Altura |

Abrasivos: granalha de aço esférica, granalha de aço angular, óxido de alumínio.
Normas aplicáveis: **NR-6, NR-9, NR-15, NR-35**.

### Carteira de clientes (pré-cadastrar)

Gerdau, ArcelorMittal, Usiminas, Aperam, RHI Magnesita, Nova Era Silicon S/A, Kinross, Nexa Resources, Alfa Engenharia, Engecampo, MIP Engenharia, Enjatec.

### Valores que orientam decisões de produto

Segurança e Saúde no Trabalho · Qualidade e Melhoria Contínua · Foco no Cliente · Valorização das Pessoas · Sustentabilidade no Negócio · Responsabilidade Social · Fé e Espiritualidade.

> **Regra derivada:** quando houver conflito entre agilidade e segurança no desenho de um fluxo, o sistema sempre privilegia o **bloqueio seguro** (ex.: não permitir liberação de OS em altura sem registro de NR-35 válido).

---

## 3. IDENTIDADE VISUAL (obrigatória e inegociável)

| Elemento | Padrão |
| --- | --- |
| **Cor principal** | Vermelho Jatear — `#B51013` (RGB 181/16/19 · CMYK C18 M100 Y100 K15) |
| **Cores de apoio** | Branco `#FFFFFF`, Cinza-escuro `#1F1F1F`, Cinza-claro `#F5F5F5`, Cinza-borda `#E0E0E0` |
| **Cores de status** | Sucesso `#2E7D32` · Atenção `#ED6C02` · Erro `#C62828` · Informação `#0277BD` |
| **Tipografia** | **Arial** (fallback: Helvetica, sans-serif). Não usar fontes decorativas |
| **Logomarca** | Símbolo "J" em círculo vermelho + "JATEAR" em bold + "TRATAMENTO ANTICORROSIVO LTDA" |
| **Versões da logo** | Colorida (fundo claro) e branca (fundo escuro/vermelho) |
| **Ícones** | **SVG brancos** sobre fundo vermelho; SVG vermelhos ou cinza-escuro sobre fundo claro. Traço uniforme, estilo linear |
| **Cabeçalho de tela** | Barra superior vermelha `#B51013` com logo branca à esquerda |
| **Documentos gerados (PDF)** | Cabeçalho com logo + rodapé `www.jatear.com | jatear@jatear.com | (31) 3852-5462` |

**Proibido:** gradientes chamativos, sombras exageradas, emojis na interface, cores fora da paleta, ícones de bibliotecas com estilo divergente.

---

## 4. PADRÃO DE LINGUAGEM E COMUNICAÇÃO

| Contexto | Padrão |
| --- | --- |
| **Interface do sistema** | Clara, simples, objetiva. Verbos no infinitivo em botões ("Salvar", "Emitir OS") |
| **Mensagens de erro ao usuário** | Explicar o que aconteceu **e** o que fazer. Nunca exibir código de erro cru |
| **Documentos para colaboradores** | Linguagem simples e direta, uso de tópicos e listas |
| **Documentos para clientes** | Técnica e formal |
| **Terminologia** | Sempre terminologia industrial correta. **Nunca** gírias ou linguagem coloquial |
| **Respostas do assistente no chat** | Técnicas, claras, formais e **curtas** |

Termos padronizados: "Ordem de Serviço" (não "pedido"), "Colaborador" (não "funcionário"), "Cliente", "Obra/Local", "Medição", "Inspeção", "Apontamento", "Liberação".

---

## 5. STACK TÉCNICA

Idêntica à do Jatear LMS, para reaproveitamento de conhecimento e componentes.

- **Frontend:** React.js (JavaScript) com **Vite** (o Create React App foi descontinuado), React Router, Context API para autenticação/estado global
- **Backend / BaaS:** Firebase
  - Authentication (e-mail + senha)
  - Cloud Firestore (banco principal)
  - Cloud Storage (fotos, anexos, PDFs)
  - Hosting (deploy)
  - Cloud Functions (Node 20)
- **Região Firebase:** `southamerica-east1` (São Paulo) — **sempre**
- **Conta Firebase:** tijatear@gmail.com
- **Projeto Firebase (criado):** `jatear-os` → `jatear-os.web.app` — plano **Blaze**, região `southamerica-east1` (Firestore e Storage)
- **Domínio customizado:** `os.jatear.com` — registrado no Hosting e autorizado no Auth; CNAME `os → jatear-os.web.app` no **Wix** (que gerencia o DNS de jatear.com)
- **Servidor de desenvolvimento:** `npm start` → **porta 3210** (`strictPort`). Não usar as portas 3000/3001 — têm service workers antigos do LMS e do Tintas registrados no navegador
- **Usuário administrador inicial:** `andre.paiva@jatear.com` (não usar `admin@jatear.com`)
- **E-mail transacional:** **Brevo** via Nodemailer (SMTP `smtp-relay.brevo.com`, porta 587) — mesma conta do LMS
- **Geração de PDF:** biblioteca client-side (jsPDF + autotable) ou Cloud Function, conforme o caso
- **Versionamento:** **GitHub — obrigatório desde o primeiro commit**

### Regras técnicas fixas

1. **`firebase functions:config:set` está descontinuado** (encerramento em março/2027). Segredos vão para **Secret Manager**; configurações não sensíveis em `.env`.
2. **SendGrid não é opção** — plano gratuito permanente encerrado em maio/2025. Usar Brevo (300 e-mails/dia gratuitos).
3. Nunca versionar chaves, `.env` ou credenciais. `.gitignore` configurado antes do primeiro commit.
4. Regras de segurança do Firestore escritas **junto** com cada nova coleção, nunca depois.
5. Toda leitura de Firestore só ocorre **após** a resolução do estado de autenticação (evita o erro de permissão que ocorreu no LMS).

---

## 6. AMBIENTE DE DESENVOLVIMENTO

- **SO:** Windows 10
- **Terminal:** PowerShell (atenção a políticas de execução que já bloquearam o `npm`)
- **Editor:** VS Code
- **Ferramenta principal:** Claude Code (CLI)
- **Ferramenta complementar:** Claude.ai (planejamento, documentos, orientação visual)

> **Não sugerir Project IDX / Firebase Studio** — usa Gemini nativamente e não suporta Claude Code.

Comandos devem ser entregues **prontos para colar no PowerShell**, um bloco por vez, na ordem de execução.

---

## 7. METODOLOGIA DE TRABALHO (como conduzir este projeto)

### 7.1 Perfil do responsável

André Luiz — gestor da Jatear. **Dirige o desenvolvimento, não escreve código.** Conduz a execução via Claude Code e valida cada etapa por captura de tela.

### 7.2 Regras de interação — leia com atenção

1. **Fazer o mínimo possível de perguntas.** Se faltar informação, assumir a hipótese mais razoável, **executar**, e informar a premissa adotada em uma linha ao final. Perguntar apenas quando a decisão for irreversível ou envolver custo/segurança.
2. **Entregar blocos de código completos para substituição integral do arquivo.** Nunca "altere a linha 42" ou trechos parciais — isso já gerou erros de edição manual.
3. **Sempre indicar o caminho completo do arquivo** antes do bloco de código (ex.: `C:\jatear-os\src\pages\OrdemServico.jsx`).
4. **Respostas curtas e diretas, em português.** Sem introduções de papel, sem repetir contexto já conhecido, sem elogios.
5. **Passo a passo numerado** quando houver mais de uma ação. Uma ação por passo.
6. **Validação visual:** ao final de cada etapa, indicar o que deve aparecer na tela para confirmar sucesso.
7. **Carregar documentos por caminho de arquivo**, nunca colando conteúdo extenso no chat.
8. **Higiene de sessão do Claude Code:** `/clear` ao trocar de tarefa; `/compact` antes de encher a janela de contexto.
9. **Commit ao final de cada etapa concluída e testada.** Mensagem em português, no imperativo (ex.: `Adicionar módulo de emissão de OS`).
10. **Antes de alterar código existente que funciona**, confirmar que há commit anterior íntegro.

### 7.3 Ciclo padrão de desenvolvimento de um módulo

1. Definir a coleção Firestore e suas regras de segurança
2. Criar o serviço de acesso a dados (`/src/services`)
3. Criar a tela com dados simulados
4. Conectar à base real
5. Testar em `npm start`
6. Validar por captura de tela
7. Commit + push
8. Deploy (`firebase deploy`) quando a fase estiver estável

---

## 8. ESTRUTURA DE MÓDULOS DO SISTEMA

| # | Módulo | Função |
| --- | --- | --- |
| 1 | **Dashboard** | Indicadores: OS abertas, em execução, atrasadas, m² do mês, faturamento previsto |
| 2 | **Ordens de Serviço** | Emissão, edição, consulta, histórico e status |
| 3 | **Clientes** | Cadastro, contatos, obras/locais, condições comerciais |
| 4 | **Serviços e Tabela de Preços** | Catálogo dos 6 serviços, unidades (m², h, verba), preços por cliente |
| 5 | **Equipes e Colaboradores** | Alocação de equipe por OS, função, validade de treinamentos NR |
| 6 | **Execução e Apontamentos** | Diário de obra: data, equipe, horas, área executada, ocorrências |
| 7 | **Inspeção de Qualidade** | Registro de parâmetros ambientais, grau de limpeza, espessura e aderência |
| 8 | **Medição e Faturamento** | Boletim de medição, aprovação do cliente, status de faturamento |
| 9 | **Anexos e Fotos** | Registro fotográfico antes/durante/depois, documentos e ARTs |
| 10 | **Relatórios** | Relatório de OS em PDF, produtividade, m² por cliente/período |
| 11 | **Administração** | Usuários, perfis, parâmetros do sistema, logs |

---

## 9. MODELO DE DADOS (Firestore — estrutura de referência)

> **SUBSTITUÍDO:** o modelo implementado é o da **especificação funcional**
> (`docs/ESPECIFICACAO-OS.md`, seção 4) — job shop por peças, com subcoleção
> `ordens_servico/{osId}/itens`, coleções `faturamentos` e `contadores`, e
> perfis reduzidos a 4 (administrador, producao, faturamento, consulta).
> O bloco abaixo permanece apenas como referência histórica.

Coleções em **português, minúsculas, plural, com underline**.

```
clientes/{clienteId}
  razaoSocial, nomeFantasia, cnpj, contatoPrincipal, telefone, email,
  obras: [{ id, nome, endereco, responsavel, telefone }],
  ativo, criadoEm, criadoPor

servicos/{servicoId}
  codigo (JAT|HID|ST2|ST3|PIN|ALP), nome, descricao,
  unidade (m2|hora|verba), precoPadrao, ativo

ordens_servico/{osId}
  numero            // formato OS-2026-0001
  clienteId, clienteNome, obraId, obraNome
  solicitante, contatoCliente, pedidoCompraCliente
  dataAbertura, dataPrevistaInicio, dataPrevistaTermino
  status            // aberta | programada | em_execucao | paralisada |
                    // aguardando_liberacao | concluida | medida | faturada | cancelada
  itens: [{ servicoCodigo, descricao, unidade, quantidadePrevista,
            quantidadeExecutada, precoUnitario, grauLimpeza,
            esquemaPintura, espessuraEspecificada }]
  trabalhoEmAltura  // boolean -> exige NR-35 válida na equipe
  equipe: [{ colaboradorId, nome, funcao }]
  encarregadoId, valorPrevisto, valorExecutado
  observacoes, criadoPor, criadoEm, atualizadoEm

apontamentos/{apontamentoId}
  osId, data, turno, equipe[], horasTrabalhadas,
  areaExecutadaM2, servicoCodigo, condicaoClimatica,
  ocorrencias, paralisacao: { houve, motivo, horas },
  registradoPor, registradoEm

inspecoes/{inspecaoId}
  osId, data, inspetorId,
  temperaturaAmbiente, umidadeRelativa, pontoOrvalho, temperaturaSuperficie,
  grauLimpezaAferido, abrasivoUtilizado, rugosidade,
  esquemaAplicado, espessuraSecaMedida[], mediaEspessura,
  ensaioAderencia: { realizado, metodo, resultado },
  aprovado (boolean), naoConformidades, evidencias[]

medicoes/{medicaoId}
  osId, periodoInicio, periodoFim, itens[], valorTotal,
  status (rascunho | enviada | aprovada | reprovada),
  aprovadoPorCliente, dataAprovacao, notaFiscal

anexos/{anexoId}
  osId, tipo (foto_antes|foto_durante|foto_depois|documento|art|certificado),
  urlStorage, descricao, enviadoPor, enviadoEm

usuarios/{uid}
  nome, email, perfil, ativo, criadoEm, ultimoAcesso

logs/{logId}
  usuarioId, acao, entidade, entidadeId, dadosAnteriores, dataHora
```

**Storage:** `os/{osId}/{tipo}/{arquivo}`

---

## 10. REGRAS DE NEGÓCIO

1. **Numeração da OS:** `OS-AAAA-NNNN`, sequencial anual, gerada por transação atômica. Nunca reutilizar número.
2. **Fluxo de status:** `aberta → programada → em_execucao → aguardando_liberacao → concluida → medida → faturada`. Retrocesso apenas para perfil Administrador, com registro em log.
3. **Cancelamento:** exige justificativa obrigatória. OS cancelada nunca é excluída fisicamente.
4. **Trabalho em altura:** se `trabalhoEmAltura = true`, o sistema **impede** a alocação de colaborador sem NR-35 válida e bloqueia a mudança para `em_execucao`.
5. **Inspeção antes da pintura:** a temperatura da superfície deve estar **no mínimo 3 °C acima do ponto de orvalho**. Fora dessa condição, o sistema alerta e exige justificativa registrada.
6. **Conclusão de OS:** exige ao menos uma inspeção aprovada e registro fotográfico "antes" e "depois".
7. **Medição:** só pode ser gerada sobre quantidades efetivamente apontadas. Não permitir medir mais do que o executado sem aditivo registrado.
8. **Alerta de capacidade:** ao programar OS que ultrapasse 3.300 m² no mês, exibir aviso de capacidade produtiva.
9. **Exclusão:** o sistema não exclui registros operacionais. Usa `ativo = false` / status `cancelada`.
10. **Auditoria:** toda alteração em OS, medição e inspeção gera registro em `logs`.

---

## 11. PERFIS DE ACESSO

| Perfil | Permissões |
| --- | --- |
| **Administrador** | Acesso total, incluindo configurações, usuários e retrocesso de status |
| **Gestor / Coordenador** | Emite e edita OS, aprova medições, acessa todos os relatórios |
| **Encarregado de Equipe** | Consulta suas OS, registra apontamentos e anexa fotos |
| **Inspetor de Qualidade** | Registra e aprova inspeções, lança não conformidades |
| **Faturamento** | Consulta OS concluídas, gera e acompanha medições e notas |
| **Consulta** | Somente leitura, sem valores financeiros |

Padrão de credenciais alinhado ao LMS: `admin@jatear.com` como administrador inicial; senha padrão de colaborador definida no primeiro acesso, com troca obrigatória.

---

## 12. CONVENÇÕES DE CÓDIGO

```
/src
  /assets          logos, ícones SVG
  /components      componentes reutilizáveis (Botao, Card, Tabela, Modal)
  /contexts        AuthContext, e demais estados globais
  /pages           uma pasta por módulo
  /services        acesso ao Firestore (um arquivo por coleção)
  /utils           formatadores, validadores (CNPJ, datas, moeda)
  /styles          variáveis de cor e estilos globais
  firebase.js      inicialização do Firebase
```

- Componentes em **PascalCase**; funções e variáveis em **camelCase**; nomes de domínio em **português**.
- Datas armazenadas como `Timestamp` do Firestore; exibidas em `DD/MM/AAAA`.
- Valores monetários em `Number`, exibidos em `R$ 0.000,00` (pt-BR).
- Nenhuma chamada direta ao Firestore dentro de componentes de tela — sempre via `/services`.
- Variáveis de cor centralizadas em `/src/styles/variaveis.css`:
  `--jatear-vermelho: #B51013;`

---

## 13. FASES DE ENTREGA

> **STATUS (agosto/2026):** as fases 0 a 7 da especificação funcional foram
> entregues e publicadas em `jatear-os.web.app` — fundação, cadastros, OS com
> grade de itens, status e fechamento parcial, consulta com filtros e CSV,
> faturamento transacional com NF e cancelamento, recursos de campo mobile
> (fotos, offline, PWA), PDFs, dashboard, logs e administração de usuários.
> Pendências: propagação do CNAME `os.jatear.com` (com o prestador) e itens
> de V2 (seção 17 da especificação — Brevo, inspeção, portal do cliente).

| Fase | Escopo |
| --- | --- |
| **0 — Fundação** | Repositório GitHub, projeto React, Firebase configurado, `.gitignore`, autenticação, layout base com identidade visual |
| **1 — Cadastros** | Clientes/Obras, Serviços e Preços, Colaboradores, Usuários e Perfis |
| **2 — Núcleo** | Emissão e gestão de Ordens de Serviço com fluxo de status |
| **3 — Campo** | Apontamentos de execução e anexos fotográficos |
| **4 — Qualidade** | Inspeções, parâmetros ambientais e não conformidades |
| **5 — Comercial** | Medições, faturamento e relatórios em PDF |
| **6 — Refinamento** | Dashboard, notificações por e-mail (Brevo), domínio `os.jatear.com`, logs e auditoria |

Não avançar de fase sem que a anterior esteja testada, commitada e validada visualmente.

---

## 14. REGRAS DE OURO

1. Fazer o mínimo de perguntas; assumir premissas razoáveis e informá-las.
2. Entregar sempre **arquivos completos** para substituição.
3. Português em tudo. Vermelho `#B51013` e Arial em tudo.
4. Commit antes de qualquer alteração relevante.
5. Segredos no Secret Manager, nunca no repositório.
6. Segurança operacional (NR) tem precedência sobre agilidade de fluxo.
7. Não excluir dados operacionais — inativar.
8. Nada de dependências desnecessárias: manter o projeto leve e sustentável por uma equipe pequena.
9. Este arquivo é a fonte de verdade do projeto. Ao mudar uma decisão estruturante, **atualizar este arquivo no mesmo commit**.

---

*Jatear Tratamento Anticorrosivo Ltda — documento interno de projeto.*
*www.jatear.com | jatear@jatear.com | (31) 3852-5462*
