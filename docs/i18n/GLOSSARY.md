# Glossary – UI terms in five languages

German is the source (`web/src/strings.ts`). Use these terms everywhere in the catalogs (`web/src/i18n/locales/<lang>/`) so the same thing always has the same name. Missing a term? Add it here in the same PR as the text.

## Tone
| Language | Address | Style |
|---|---|---|
| Deutsch | du | friendly, short, calm; no guilt, no pressure (see `docs/design/FOCUS-WORDING.md`) |
| English | you (informal) | plain, short sentences; British spelling for words like "colour", "favourite" |
| Español | tú | neutral Spanish (no regionalisms) |
| Français | vous | polite but warm; "vous" is the usual app register in French |
| Português (Brasil) | você | Brazilian Portuguese, informal |

## Never translate
Nemo, Ko-fi, brand and product names (Google, Gmail, Outlook, Nextcloud, Claude, OpenAI, Gemini, Groq, OpenRouter, Mistral, Ollama, Tailscale, WebView2, Brave, Chrome, Edge, Windows, Android, GitHub, Hugging Face), technical tokens (PWA, APK, API, MCP, ICS, JSON, CSV, QR, TOTP, UUID, Base64, URL, HTTPS, Token, VAPID, Argon2id, AES-256), file names, codes, placeholders (`${…}`), keyboard keys inside shortcuts and the typed confirmation word `LÖSCHEN` (the app checks exactly this word). Keyboard modifier: German "Strg" is "Ctrl" in the other languages.

Examples of what a person types into **Schnell erfassen**, the **AI bar** ("Eintragen per KI") or the **calculator** stay in German: those parsers only understand German for now. Translate the explanation around them.

## Areas and modules
| Deutsch | English | Español | Français | Português (Brasil) |
|---|---|---|---|---|
| Übersicht | Overview | Resumen | Vue d'ensemble | Visão geral |
| Planen | Plan | Planificar | Planifier | Planejar |
| Geld | Money | Dinero | Argent | Dinheiro |
| Haushalt | Household | Hogar | Maison | Casa |
| Wissen | Knowledge | Conocimiento | Savoir | Conhecimento |
| Tresor | Vault | Bóveda | Coffre-fort | Cofre |
| System | System | Sistema | Système | Sistema |
| Kalender | Calendar | Calendario | Calendrier | Calendário |
| ToDos | To-dos | Tareas | Tâches | Tarefas |
| Finanzen | Finances | Finanzas | Finances | Finanças |
| Rechnungen | Invoices | Facturas | Factures | Faturas |
| Abos | Subscriptions | Suscripciones | Abonnements | Assinaturas |
| Budgets & Sparziele | Budgets & savings goals | Presupuestos y metas de ahorro | Budgets et objectifs d'épargne | Orçamentos e metas de economia |
| Notizen | Notes | Notas | Notes | Notas |
| Zettel (pinned note) | Scratchpad | Bloc rápido | Bloc-notes | Rascunho |
| Merkliste | Saved | Guardados | Enregistrés | Salvos |
| Lesezeichen | Bookmarks | Marcadores | Signets | Marcadores |
| Listen | Lists | Listas | Listes | Listas |
| Einkauf / Packliste / Checkliste | Shopping / Packing list / Checklist | Compra / Lista de equipaje / Lista de control | Courses / Liste de bagages / Liste de contrôle | Compras / Lista de bagagem / Checklist |
| Vorräte | Pantry | Despensa | Provisions | Despensa |
| Personen | People | Personas | Personnes | Pessoas |
| Unterlagen | Documents | Documentos | Documents | Documentos |
| Accounts (password vault) | Passwords | Contraseñas | Mots de passe | Senhas |
| Dieser PC | This PC | Este PC | Ce PC | Este PC |
| Chat | Chat | Chat | Chat | Chat |
| Werkzeuge | Tools | Herramientas | Outils | Ferramentas |

## App terms
| Deutsch | English | Español | Français | Português (Brasil) |
|---|---|---|---|---|
| Modul-Bibliothek | Module library | Biblioteca de módulos | Bibliothèque de modules | Biblioteca de módulos |
| Widget | widget | widget | widget | widget |
| Favoriten | Favourites | Favoritos | Favoris | Favoritos |
| Einstellungen | Settings | Ajustes | Paramètres | Configurações |
| Einrichtung / Einrichtungsassistent | Setup / setup assistant | Configuración inicial / asistente | Configuration / assistant de configuration | Configuração / assistente de configuração |
| Startdaten | Starter data | Datos iniciales | Données de départ | Dados iniciais |
| Befehlspalette | Command palette | Paleta de comandos | Palette de commandes | Paleta de comandos |
| Schnell erfassen / Schnellerfassung | Quick capture | Captura rápida | Saisie rapide | Captura rápida |
| Jetzt wichtig | Important now | Importante ahora | Important maintenant | Importante agora |
| Jetzt dran | Up next | Ahora toca | À faire maintenant | Agora |
| Als Nächstes | Next | Lo siguiente | Ensuite | A seguir |
| Fokusmodus | Focus mode | Modo concentración | Mode concentration | Modo foco |
| Eingang (to-do inbox) | Inbox | Bandeja de entrada | Boîte de réception | Caixa de entrada |
| Irgendwann | Someday | Algún día | Un jour | Algum dia |
| Erinnerung | Reminder | Recordatorio | Rappel | Lembrete |
| Termin | Event | Evento | Événement | Evento |
| Benachrichtigung | Notification | Notificación | Notification | Notificação |
| Ruhezeit | Quiet hours | Horas de silencio | Heures calmes | Horário de silêncio |
| Sync / Synchronisation | Sync | Sincronización | Synchronisation | Sincronização |
| Sync-Server | Sync server | Servidor de sincronización | Serveur de synchronisation | Servidor de sincronização |
| Ende-zu-Ende-Verschlüsselung | End-to-end encryption | Cifrado de extremo a extremo | Chiffrement de bout en bout | Criptografia de ponta a ponta |
| Passphrase | Passphrase | Frase de contraseña | Phrase secrète | Frase secreta |
| Backup | Backup | Copia de seguridad | Sauvegarde | Backup |
| Wiederherstellen | Restore | Restaurar | Restaurer | Restaurar |
| KI / KI-Assistent | AI / AI assistant | IA / asistente de IA | IA / assistant IA | IA / assistente de IA |
| Anbieter (AI) | Provider | Proveedor | Fournisseur | Provedor |
| Eintragen per KI | Add with AI | Añadir con IA | Ajouter avec l'IA | Adicionar com IA |
| Lokales Modell | Local model | Modelo local | Modèle local | Modelo local |
| Lokale Schnittstelle | Local interface | Interfaz local | Interface locale | Interface local |
| Zugang (API access) | Access | Acceso | Accès | Acesso |
| Verbindungen / Connector | Connections | Conexiones | Connexions | Conexões |
| Supporter / Unterstützer | Supporter | Colaborador | Soutien | Apoiador |
| Supporter-Code | Supporter code | Código de colaborador | Code de soutien | Código de apoiador |
| Dev-Preview | Dev preview | Dev preview | Dev preview | Dev preview |
| Lesehilfe | Reading aid | Ayuda de lectura | Aide à la lecture | Ajuda de leitura |
| Darstellung | Appearance | Apariencia | Apparence | Aparência |
| Farbschema / Akzent | Colour scheme / accent | Esquema de color / acento | Thème de couleurs / accent | Esquema de cores / destaque |
| Rückgängig | Undo | Deshacer | Annuler | Desfazer |
| Anlegen / Hinzufügen | Add | Añadir | Ajouter | Adicionar |
| Löschen | Delete | Eliminar | Supprimer | Excluir |
| Fällig / überfällig | Due / overdue | Vence / vencido | À échéance / en retard | Vence / atrasado |
| Abbuchung | Charge | Cargo | Prélèvement | Cobrança |
| Kündigungsfrist | Notice period | Plazo de cancelación | Délai de résiliation | Prazo de cancelamento |
| Buchung | Transaction | Movimiento | Opération | Lançamento |
| Konto (finance) | Account | Cuenta | Compte | Conta |
| Kategorie | Category | Categoría | Catégorie | Categoria |
| Sparziel | Savings goal | Meta de ahorro | Objectif d'épargne | Meta de economia |
| Geschenkidee | Gift idea | Idea de regalo | Idée cadeau | Ideia de presente |
| Laufwerk | Drive | Unidad | Lecteur | Unidade |
| Papierkorb | Recycle bin | Papelera | Corbeille | Lixeira |
