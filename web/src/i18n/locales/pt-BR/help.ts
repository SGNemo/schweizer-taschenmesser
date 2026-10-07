import type { Strings } from '@/strings';

export const help: Strings['help'] = {
  label: 'Ajuda',
  sync: 'O servidor de sincronização é o seu próprio pequeno servidor, que mantém os dados de vários dispositivos em dia. Se quiser, os dados ficam com criptografia de ponta a ponta: o servidor só vê valores ilegíveis, e só os seus dispositivos conhecem a frase secreta.',
  aiLocal:
    'Um pequeno modelo de linguagem roda só neste dispositivo e entende frases que as regras fixas não conhecem – sem Token, sem internet. Ele só é baixado com a sua permissão (você vê antes o tamanho, a origem e a soma de verificação) e verifica o download sozinho.',
  aiWrite:
    'O Nemo sempre mostra primeiro uma prévia das entradas reconhecidas; nada é salvo sem a sua confirmação. Aqui você define se e onde o assistente pode sugerir entradas.',
  aiCloudWrite:
    'Primeiro o Nemo tenta com regras fixas, depois (se configurado) com o modelo local – as duas opções são gratuitas e não saem do dispositivo. Só se nenhuma bastar e você permitir aqui, a frase vai com a data e os nomes de campo dos módulos (nunca as suas entradas) para um provedor de IA.',
  aiAskMissing:
    'Ligado: se faltar, por exemplo, a data de vencimento, a prévia pergunta. Desligado: essas frases não são sugeridas como entrada.',
  aiRouter:
    'Vários provedores de IA ficam em uma ordem. O app pergunta ao primeiro disponível; se ele estiver sobrecarregado, inacessível ou no limite, passa para o próximo. Só a sua pergunta e um esquema curto são enviados, nunca os seus dados.',
  updateChannel:
    '“Estável” oferece só versões finais. “Beta” também mostra versões prévias, com novidades mais cedo, mas menos testadas. Antes de cada atualização o app faz uma cópia de segurança.',
  vault:
    'O Cofre é criptografado com a sua senha mestra, que não é salva em lugar nenhum. Se você esquecê-la, ninguém consegue recuperar as entradas – nem nós. Por isso, guarde-a em um lugar seguro.',
  startData:
    'O assistente lê textos ou arquivos e mostra primeiro uma prévia. Só depois da sua confirmação algo é salvo, e cada importação pode ser desfeita por inteiro.',
  localApi:
    'A interface escuta só neste computador (127.0.0.1) e não serve para nada sem chave de acesso. Cada acesso recebe só as permissões que você marcar. Importações chegam primeiro como prévia no app. Ela nunca alcança o Cofre (Senhas), as configurações nem as chaves.',
  connectors:
    'As conexões só leem, não mudam nada no serviço. Os dados de acesso ficam no armazenamento de chaves deste dispositivo e nunca são sincronizados nem incluídos em backups. E-mails são analisados só no seu dispositivo e nunca enviados a uma IA.',
};
