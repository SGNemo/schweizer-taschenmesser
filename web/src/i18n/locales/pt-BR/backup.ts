import type { Strings } from '@/strings';

export const backup: Strings['backup'] = {
  deletedCount: (n: number) => ` (+${n} ${n <= 1 ? 'excluído' : 'excluídos'})`,
  title: 'Backup',
  intro:
    'Salve todos os dados em um arquivo ou restaure um backup. Dados de acesso (token de sincronização, chaves) nunca entram no backup.',
  export: 'Baixar backup',
  exported: 'Backup baixado.',
  file: 'Arquivo de backup',
  mode: 'Restauração',
  merge: 'Mesclar',
  mergeHint: 'Nada se perde; em caso de conflito, vale a alteração mais recente.',
  replace: 'Substituir',
  replaceHint: 'O backup vira o estado atual: registros que não estão no backup são excluídos.',
  doImport: 'Importar',
  contains: (records: number, tables: number) =>
    `${records} ${records <= 1 ? 'registro' : 'registros'} em ${tables} ${tables <= 1 ? 'tabela' : 'tabelas'}`,
  confirmTitle: 'Substituir pelo backup?',
  confirmText:
    'Todos os registros que não estão no backup serão excluídos – também nos outros dispositivos, assim que sincronizarem.',
  done: (records: number, removed: number) =>
    removed > 0
      ? `${records} ${records <= 1 ? 'registro restaurado' : 'registros restaurados'}, ${removed} ${removed <= 1 ? 'removido' : 'removidos'}.`
      : `${records} ${records <= 1 ? 'registro restaurado' : 'registros restaurados'}.`,
  encryptedExport: 'Exportar criptografado',
  encryptedExported: 'Backup criptografado baixado.',
  exportHint:
    'Recomendado: exportar criptografado (Argon2id, AES-256). O backup normal contém todos os registros em texto puro.',
  exportPassphrase: 'Senha do backup',
  exportPassphraseHint:
    'Pelo menos 8 caracteres. Sem esta senha, o backup não pode ser aberto – não há como redefini-la.',
  passphraseTooShort: 'A senha precisa de pelo menos 8 caracteres.',
  openPassphrase: 'Senha do backup',
  unlock: 'Abrir',
  verify: 'Verificar backup',
  verifyHint:
    'Verifica o arquivo e faz uma restauração de teste em um banco de dados temporário. Seus dados não são tocados.',
  verifying: 'Verificando…',
  verifyOk: 'O backup está em ordem e pode ser restaurado.',
  verifyFailed: 'O backup não está em ordem.',
  verifyExported: (when: string) => `Criado em ${when}`,
  verifyTotals: (records: number, tombstones: number) =>
    `${records} ${records <= 1 ? 'registro' : 'registros'}, ${tombstones} ${tombstones <= 1 ? 'marcação de exclusão' : 'marcações de exclusão'}`,
  skippedOnRestore: (n: number) =>
    n === 1
      ? '1 tabela do arquivo não é mais conhecida por esta versão do app (ex.: módulos antigos como Compras, Listas de bagagem ou Hábitos) e não será restaurada.'
      : `${n} tabelas do arquivo não são mais conhecidas por esta versão do app (ex.: módulos antigos como Compras, Listas de bagagem ou Hábitos) e não serão restauradas.`,
  verifySkipped: (n: number) =>
    n <= 1
      ? `${n} tabela vem de outra versão do app e será ignorada.`
      : `${n} tabelas vêm de outra versão do app e serão ignoradas.`,
  steps: {
    format: 'Formato do arquivo',
    checksum: 'Soma de verificação (SHA-256)',
    decrypt: 'Descriptografia',
    structure: 'Conteúdo válido',
    restore: 'Restauração de teste',
    counts: 'Quantidade por módulo confere',
  } as Record<string, string>,
  stepStatus: { ok: 'ok', failed: 'Erro', skipped: '–' } as Record<string, string>,
  core: 'Configurações',
  previewTitle: 'O que acontece na restauração',
  previewRow: (module: string, added: number, replaced: number, removed: number) =>
    `${module}: ${added} ${added <= 1 ? 'novo' : 'novos'}, ${replaced} ${replaced <= 1 ? 'substituído' : 'substituídos'}${removed > 0 ? `, ${removed} ${removed <= 1 ? 'excluído' : 'excluídos'}` : ''}`,
  previewTotals: (added: number, replaced: number, removed: number) =>
    `Total: ${added} ${added <= 1 ? 'adicionado' : 'adicionados'}, ${replaced} ${replaced <= 1 ? 'substituído' : 'substituídos'}, ${removed} ${removed <= 1 ? 'excluído' : 'excluídos'}.`,
  previewNothing: 'Nada muda.',
  safetyNote:
    'Antes, o app cria automaticamente uma cópia de segurança dos seus dados atuais. Se algo falhar, tudo fica como estava.',
  restoring: 'Restaurando…',
  autoTitle: 'Backups automáticos',
  autoIntro:
    'O app faz backups criptografados regularmente na sua pasta de dados e guarda as cópias mais recentes. A senha fica no armazenamento de chaves do dispositivo.',
  autoUnsupported: 'Backups automáticos só existem no app instalado (Windows, Android).',
  autoEnable: 'Fazer backup automático',
  autoInterval: 'Frequência',
  autoDaily: 'Diário',
  autoWeekly: 'Semanal',
  autoKeep: 'Número de cópias',
  autoPassphrase: 'Senha dos backups automáticos',
  autoPassphraseSet: 'Senha salva. Digite uma nova senha para substituí-la.',
  autoPassphraseHint:
    'Pelo menos 8 caracteres. Anote-a: sem a senha, as cópias não podem ser abertas.',
  autoSavePassphrase: 'Salvar senha',
  autoRunNow: 'Fazer backup agora',
  autoLast: 'Último backup',
  autoNever: 'nenhum ainda',
  autoLastFailed: 'O último backup falhou.',
  autoNeedPassphrase: 'Primeiro defina uma senha.',
  autoCreated: 'Backup criado.',
  autoFiles: 'Cópias existentes',
  autoNoFiles: 'Nenhuma cópia ainda.',
  autoUse: 'Abrir',
  autoSaveAs: 'Salvar como…',
  errors: {
    'not-json': 'O arquivo não é um JSON válido.',
    'wrong-format': 'Este não é um arquivo de backup do Nemo.',
    'newer-version': 'O backup vem de uma versão mais nova do app.',
    invalid: 'O arquivo de backup está danificado.',
    'passphrase-required': 'Este backup é criptografado. Digite a senha.',
    'wrong-passphrase': 'Senha incorreta – ou o arquivo foi alterado.',
    'checksum-mismatch':
      'A soma de verificação não confere: o arquivo está danificado ou incompleto.',
    'restore-failed': 'A restauração de teste falhou.',
    'count-mismatch': 'Faltam registros após a restauração de teste.',
    'safety-failed': 'Não foi possível criar a cópia de segurança. Nada foi alterado.',
    'safety-cancelled': 'Sem cópia de segurança, nada é restaurado. Nada foi alterado.',
    'restore-error': 'A restauração falhou. Nada foi alterado.',
  } as Record<string, string>,
};
