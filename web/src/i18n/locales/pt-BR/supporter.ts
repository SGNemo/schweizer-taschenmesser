import type { Strings } from '@/strings';

export const supporter: Strings['supporter'] = {
  tier: { kaffee: 'Café', kuchen: 'Bolo', developer: 'Desenvolvedor' },
  section: {
    title: 'Apoiador',
    keywords: ['Doação', 'Apoiar', 'Café', 'Obrigado', 'Código', 'Ko-fi', 'Supporter'],
    intro:
      'O Nemo é gratuito e vai continuar assim: todas as funções estão abertas para todos. Se você gosta do app, pode contribuir de forma voluntária; qualquer valor ajuda. Como um pequeno agradecimento, há extras puramente cosméticos: um selo de “Obrigado” e temas de cores adicionais.',
    donate: 'Apoiar voluntariamente',
    donateHint:
      'Abre a página de pagamento no navegador. O pagamento acontece só lá; o Nemo não processa dados de pagamento.',
    codeLabel: 'Código de apoiador',
    codeHint:
      'Você recebe o código automaticamente por e-mail após a doação. Cole-o aqui; a verificação acontece só neste dispositivo.',
    codePlaceholder: 'NEMO1-…',
    paste: 'Colar',
    pasteFailed: 'Não foi possível colar. Cole o código diretamente no campo.',
    save: 'Aplicar código',
    invalid: 'Este código não confere. Verifique se ele foi copiado por completo.',
    accepted: 'Obrigado! O código foi aplicado.',
    statusTitle: 'Seu status',
    tierLabel: 'Nível',
    nameLabel: 'Nome',
    issuedLabel: 'Emitido em',
    notSupporter: 'Nenhum código inserido ainda. Tudo bem, não falta nada para você.',
    remove: 'Remover código',
    removed: 'Código removido. Você pode inseri-lo de novo a qualquer momento.',
    unrecognised:
      'Um código salvo não é reconhecido por esta versão do app. Atualize o app ou insira o código de novo.',
    sidebarBadge: 'Selo de agradecimento na barra lateral',
    sidebarBadgeHint: 'Mostra o nível discretamente abaixo do logo.',
    noMail: 'Não recebeu nada? Olhe também na pasta de spam.',
    resend: 'Reenviar código',
    contact: 'Entrar em contato',
    linkOpen: 'Abrir',
  },
  aboutRow: {
    label: 'Apoiar o Nemo',
    description: 'Voluntário, com extras cosméticos como agradecimento.',
    open: 'Saiba mais',
  },
  badge: {
    thanks: 'Obrigado',
    thanksName: (name: string) => `Obrigado, ${name}`,
  },
  palette: {
    label: 'Tema de cores',
    hintSupporter: 'Só visual; dá para voltar ao padrão a qualquer momento.',
    hintLocked:
      'Temas de cores adicionais são um pequeno agradecimento para apoiadores. Mesmo assim, dá para experimentar: um clique mostra o tema por 30 segundos.',
    standard: 'Padrão',
    names: {
      korallenriff: 'Recife de coral',
      tiefsee: 'Mar profundo',
      sand: 'Areia',
      nordlicht: 'Aurora boreal',
      monochrom: 'Monocromático',
    },
    choose: (name: string) => `Escolher o tema de cores ${name}`,
    tryOut: (name: string) => `Ver o tema de cores ${name} por 30 segundos`,
    locked: 'Para apoiadores',
    previewing: (name: string) => `Prévia: ${name}`,
    previewEnd: 'Encerrar prévia',
    accentFollows: 'O tema de cores define a cor de destaque.',
  },
  logo: {
    label: 'Logo na cor do tema',
    hint: 'O peixe assume a cor de destaque.',
    hintLocked: 'Para apoiadores.',
  },
};
