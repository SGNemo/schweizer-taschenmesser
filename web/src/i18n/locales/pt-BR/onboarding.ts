import type { Strings } from '@/strings';

export const onboarding: Strings['onboarding'] = {
  button: 'Configurar dados iniciais',
  title: (module: string) => `Dados iniciais: ${module}`,
  chooseIntro:
    'De onde devem vir os primeiros registros? Nada é salvo antes de você confirmar a prévia.',
  skip: 'Pular',
  skipHint: 'Depois você encontra o assistente de novo nas configurações do módulo.',
  back: 'Voltar',
  preview: 'Mostrar prévia',
  parsing: 'Lendo …',
  chooseFile: 'Escolher arquivo …',
  fileChosen: (name: string) => `Arquivo: ${name}`,
  textLabel: 'Uma linha = um registro',
  pickTemplates: 'Escolher sugestões',
  noInput: 'Digite alguma coisa.',
  nothingFound: 'Nenhum registro foi reconhecido.',
  fileTooLarge: 'O arquivo é grande demais (no máximo 10 MB).',
  readError: 'Não foi possível ler o arquivo.',
  previewTitle: 'Prévia',
  previewIntro: 'Aqui você vê o que seria salvo. Desmarque os registros que você não quer.',
  found: (n: number) => (n <= 1 ? `${n} registro reconhecido` : `${n} registros reconhecidos`),
  selectAll: 'Selecionar todos',
  selectNone: 'Desmarcar todos',
  duplicate: 'Já existe',
  change: 'Alteração',
  unchanged: 'Sem alteração',
  invalid: 'Não importável',
  importN: (n: number) => (n <= 1 ? `Importar ${n} registro` : `Importar ${n} registros`),
  importing: 'Salvando …',
  imported: (n: number) =>
    n <= 1 ? `${n} registro foi importado.` : `${n} registros foram importados.`,
  undo: 'Desfazer importação',
  undone: (removed: number, kept: number) =>
    kept > 0
      ? `${removed} ${removed <= 1 ? 'registro removido' : 'registros removidos'}. ${kept} ${kept <= 1 ? 'foi editado nesse meio-tempo e foi mantido' : 'foram editados nesse meio-tempo e foram mantidos'}.`
      : `${removed} ${removed <= 1 ? 'registro removido' : 'registros removidos'}.`,
  close: 'Fechar',
  recent: 'Importados recentemente',
  recentEntry: (source: string, n: number, date: string) =>
    `${source} · ${n} ${n <= 1 ? 'registro' : 'registros'} · ${date}`,
  recentUndone: 'desfeito',
  errors: {
    'unknown-collection': 'A importação não combina com este módulo.',
    'nothing-selected': 'Nada selecionado.',
    fallback: 'Não deu certo.',
  } as Record<string, string>,
  add: 'Adicionar',
  required: 'Preencha este campo.',

  mail: {
    hint: 'Só com conta do Google conectada (Configurações → Conexões). As sugestões vêm do remetente, assunto, data e linha de prévia; você confirma cada uma.',
    invoices: 'Reconhecer faturas em e-mails',
    subscriptions: 'Reconhecer assinaturas em e-mails',
    contracts: 'Reconhecer contratos em e-mails',
    calendar: 'Reconhecer eventos e ingressos em e-mails',
    source: (url: string) => `Reconhecido em um e-mail: ${url}`,
    dueUnclear: 'Vencimento não reconhecido – confira',
    startUnclear: 'Data da cobrança estimada – confira',
    noAmount: (n: number) =>
      n <= 1
        ? `${n} fatura sem valor reconhecível foi ignorada.`
        : `${n} faturas sem valor reconhecível foram ignoradas.`,
    noEnd: 'Fim do contrato não reconhecido',
    notice: (days: number) => `Prazo de cancelamento de ${days} ${days <= 1 ? 'dia' : 'dias'}`,
  },
  ics: {
    exdate: (n: number) =>
      n <= 1
        ? `${n} evento recorrente tinha dias de exceção (dias pulados); essas exceções não são importadas.`
        : `${n} eventos recorrentes tinham dias de exceção (dias pulados); essas exceções não são importadas.`,
    rruleUnsupported: (n: number) =>
      n <= 1
        ? `${n} evento tem uma repetição que este app não conhece; ele é importado como evento único.`
        : `${n} eventos têm uma repetição que este app não conhece; eles são importados como eventos únicos.`,
    override: (n: number) =>
      n <= 1
        ? `${n} evento alterado de uma série foi ignorado.`
        : `${n} eventos alterados de uma série foram ignorados.`,
    cancelled: (n: number) =>
      n <= 1 ? `${n} evento cancelado foi ignorado.` : `${n} eventos cancelados foram ignorados.`,
    invalid: (n: number) =>
      n <= 1
        ? `${n} evento sem data válida foi ignorado.`
        : `${n} eventos sem data válida foram ignorados.`,
  },
  lines: (skipped: number) =>
    skipped <= 1
      ? `${skipped} linha não foi reconhecida.`
      : `${skipped} linhas não foram reconhecidas.`,
  calendar: {
    ics: 'Arquivo de calendário (.ics)',
    icsHint:
      'Exporte seu calendário (por exemplo, Google Agenda, Outlook, Thunderbird) como arquivo .ics e escolha-o aqui.',
  },
  todos: {
    text: 'Colar tarefas',
    textHint: 'Cole uma lista de um app de notas ou de uma mensagem: uma linha por tarefa.',
    placeholder: 'Organizar documentos do imposto\nLigar para o dentista\nConsertar a bicicleta',
    list: 'Nesta lista',
  },
  reminders: {
    textDetail: 'hoje, 09:00',
    templates: 'Modelos de lembretes comuns',
    templatesHint:
      'Escolha do que o app deve lembrar você. Horários e dias podem ser mudados depois.',
    text: 'Colar lembretes',
    textHint: 'Uma linha por lembrete; vale a partir de hoje às 09:00 e pode ser ajustado depois.',
    placeholder: 'Trocar os pneus\nComprar presente para a mamãe',
    rent: ['Pagar o aluguel', 'todo mês no dia 1'],
    trash: ['Colocar o lixo para fora', 'toda semana, domingo 19:00 – ajuste o dia depois'],
    insurance: [
      'Comparar seguro do carro',
      'todo ano em 1º de novembro (prazo de troca geralmente 30/11)',
    ],
    energy: ['Revisar contrato de luz e gás', 'todo ano em 1º de setembro'],
    tax: ['Juntar documentos do imposto', 'todo ano em 1º de junho'],
    dentist: ['Marcar revisão no dentista', 'a cada 6 meses'],
    smoke: ['Testar detector de fumaça', 'todo ano em 1º de janeiro'],
    statements: ['Conferir extratos bancários', 'todo mês no dia 1'],
  },
  finance: {
    account: 'Criar conta com saldo inicial',
    accountHint: 'Para mais uma conta. A conta existente você altera em Finanças → Contas.',
    name: 'Nome da conta',
    balance: 'Saldo hoje',
    balanceHint: (sample: string) => `por exemplo, ${sample} – se for negativo, com “-”.`,
    badBalance: (sample: string) => `Digite um valor como ${sample}.`,
    bank: 'Importar extrato (CSV ou CAMT)',
    bankHint:
      'No internet banking, exporte as movimentações (por exemplo, “CSV-CAMT” ou “CAMT”) e escolha o arquivo aqui. O arquivo só é lido neste dispositivo.',
    bankAccount: 'Lançar na conta',
    noAccounts: 'Crie uma conta primeiro.',
    bankFormat:
      'O formato do arquivo não foi reconhecido. Espera-se um arquivo CSV com data do lançamento e valor ou um arquivo CAMT (XML).',
    bankSkipped: (n: number) =>
      n <= 1
        ? `${n} linha sem data ou valor válido foi ignorada.`
        : `${n} linhas sem data ou valor válido foram ignoradas.`,
    bankTruncated: (n: number) => `Só os primeiros ${n} lançamentos são mostrados.`,
  },
  invoices: {
    form: 'Registrar fatura em aberto',
    payee: 'Emissor',
    amount: 'Valor',
    due: 'Vence em',
    reference: 'Referência (opcional)',
    badAmount: (sample: string) => `Digite um valor como ${sample}.`,
    badDate: 'Digite uma data como 15.03.2026.',
  },
  subscriptions: {
    form: 'Registrar assinatura',
    name: 'Nome',
    amount: 'Preço por cobrança',
    rhythm: 'Frequência',
    monthly: 'mensal',
    quarterly: 'trimestral',
    yearly: 'anual',
    next: 'Próxima cobrança em',
    notice: 'Prazo de cancelamento em dias (opcional)',
    badAmount: (sample: string) => `Digite um valor como ${sample}.`,
    badDate: 'Digite uma data como 15.03.2026.',
    badNotice: 'Digite um número inteiro.',
    bank: 'Reconhecer assinaturas no extrato',
    bankHint:
      'Escolha um extrato (CSV ou CAMT, de preferência de um ano). O app procura cobranças regulares com o mesmo valor e sugere como assinatura. O arquivo só é lido neste dispositivo.',
    bankFormat:
      'O formato do arquivo não foi reconhecido. Espera-se um arquivo CSV com data do lançamento e valor ou um arquivo CAMT (XML).',
    bankNone:
      'Nenhuma cobrança regular foi encontrada. Para reconhecer, são necessárias pelo menos três cobranças iguais em intervalos parecidos.',
    seen: (n: number, last: string) =>
      `${n} ${n <= 1 ? 'cobrança' : 'cobranças'}, a última em ${last}`,
  },
  bookmarks: {
    html: 'Marcadores do navegador (HTML)',
    htmlHint:
      'Exporte os marcadores do seu navegador como arquivo HTML (Chrome/Edge: Gerenciador de favoritos → ⋮ → Exportar favoritos). Os nomes das pastas viram tags.',
    text: 'Colar links',
    textHint: 'Um link por linha, opcionalmente com um título antes.',
    placeholder: 'https://example.org/artigo\nTrilha bonita https://example.org/trilha',
  },
  birthdays: {
    text: 'Colar aniversários',
    textHint: 'Uma linha por pessoa: nome e data, com ou sem ano.',
    placeholder: 'Ana Exemplo 15.03.1985\nTio Marcos 02.11.\n24.12. Vovó',
  },
  lists: {
    text: 'Colar lista de compras',
    textHint: 'Um item por linha; quantidades como “2 leites” são reconhecidas.',
    placeholder: '2 leites\nPão\n500 g farinha',
    templates: 'Modelos de lista de bagagem',
    templatesHint: 'Listas prontas para viagens comuns; você pode mudá-las depois.',
    packingKind: 'Lista de bagagem',
    weekend: {
      name: 'Viagem de fim de semana',
      note: 'Duas noites, trem e bagagem de mão',
      items: [
        'Escova de dentes',
        'Carregador',
        'Capa de chuva',
        'Roupa extra',
        'Passagem de trem',
        'Fones de ouvido',
        'Óculos de sol',
        'Livro',
      ],
    },
    camping: {
      name: 'Camping',
      note: 'Três dias no lago',
      items: [
        'Barraca',
        'Saco de dormir',
        'Isolante térmico',
        'Fogareiro',
        'Lanterna de cabeça',
        'Repelente',
        'Galão de água',
        'Canivete',
        'Sacos de lixo',
        'Protetor solar',
      ],
    },
    beach: {
      name: 'Férias na praia',
      note: '',
      items: [
        'Roupa de banho',
        'Toalha de praia',
        'Chinelos',
        'Chapéu',
        'Passaporte',
        'Kit de remédios',
      ],
    },
    ski: {
      name: 'Fim de semana de esqui',
      note: '',
      items: [
        'Jaqueta de esqui',
        'Luvas',
        'Óculos de esqui',
        'Roupa térmica',
        'Passe de esqui',
        'Protetor labial',
      ],
    },
  },
};
