import type { Strings } from '@/strings';

export const notifications: Strings['notifications'] = {
  summary: (count: number, titles: string[]) => ({
    title: `Mais lembretes · ${count}`,
    body: titles.slice(0, 3).join(' · ') + (titles.length > 3 ? ' …' : ''),
  }),
  title: 'Notificações',
  intro:
    'Os lembretes aparecem como notificação enquanto o app está aberto ou em segundo plano. Sem push, nada chega com o app fechado; o que venceu nesse meio-tempo aparece no sino ao abrir. Com push (veja abaixo) eles chegam também nesse caso.',
  introAndroid:
    'No Android, o app entrega os lembretes ao sistema para que cheguem também com o app fechado. Funciona se o Nemo puder enviar notificações e usar “Alarmes e lembretes” e o uso da bateria não estiver restrito (Configurações → Apps → Nemo).',
  introDesktop:
    'Os lembretes aparecem como notificação enquanto o Nemo está em execução, também em segundo plano ou na bandeja do sistema. Com o app encerrado eles não chegam; o que venceu nesse meio-tempo aparece no sino na próxima abertura.',
  enable: 'Ativar notificações',
  granted: 'Ativadas',
  denied: 'Bloqueadas – permita nas configurações do navegador para esta página.',
  default: 'Ainda não ativadas',
  unsupported: 'Não é compatível com este navegador.',
  test: 'Enviar notificação de teste',
  testBody: 'Está funcionando.',
  push: {
    title: 'Push com o app fechado',
    intro:
      'Opcional: o seu servidor de sincronização envia lembretes por Web Push, mesmo com o app fechado. Para isso, o app envia ao seu servidor as notificações das próximas duas semanas (título e texto) – com criptografia de ponta a ponta, só criptografadas.',
    state: {
      unsupported: 'Este navegador não é compatível com Web Push.',
      'needs-sync':
        'O push precisa da conexão com o seu servidor de sincronização (Configurações → Sincronização).',
      denied: 'As notificações estão bloqueadas – permita nas configurações do navegador.',
      off: 'Desligado',
      on: 'Ativo neste dispositivo',
    } as Record<string, string>,
    enable: 'Ativar push',
    disable: 'Desativar push',
    test: 'Enviar teste pelo servidor',
    testSent: 'Enviado – a notificação deve aparecer em instantes.',
    testFailed: 'O servidor não conseguiu enviar (serviço de push inacessível?).',
    errors: {
      unauthorized: 'O Token do servidor de sincronização foi recusado.',
      network: 'O servidor de sincronização está inacessível.',
      server: 'O servidor de sincronização relatou um erro (ele está atualizado?).',
      'subscribe-failed':
        'Não foi possível criar a inscrição. O push precisa de HTTPS e de um navegador com serviço de push.',
      denied: 'As notificações não foram permitidas.',
      unsupported: 'Este navegador não é compatível com Web Push.',
      'needs-sync': 'Conecte-se primeiro ao servidor de sincronização.',
    } as Record<string, string>,
  },
};
