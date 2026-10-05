import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { migrations } from './migrations';
import { messageSchema, threadSchema } from './schema';
import { settings } from './settings';

/**
 * Chat with the built-in model or the configured providers. **No `aiSchema`, no `searchable`, no
 * data API:** the content of chats never reaches the assistant's query layer, the local API or the
 * search. What a chat may read from other modules is chosen per chat and shown before sending
 * (`context.ts`); the password vault is never part of it.
 */
const manifest: ModuleManifest = {
  id: 'chat',
  name: t.chat.meta.name,
  icon: 'sparkles',
  version: 1,
  dataApi: false,
  description: t.chat.meta.description,
  routes: [
    {
      path: '/chat',
      label: t.chat.meta.route,
      nav: true,
      component: () => import('./routes/ChatPage'),
    },
  ],
  dataSchema: {
    collections: {
      thread: { schema: threadSchema, indexes: ['pinned', 'archived'] },
      message: { schema: messageSchema, indexes: ['threadId'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'recent',
      title: t.chat.meta.widget,
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/RecentChatsWidget'),
    },
  ],
  settings,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [] },
  layout: 'content',
  area: 'knowledge',
  order: 90,
  contributions: {
    onboarding: noOnboarding,
    quickAdd: [{ id: 'chat', label: t.chat.meta.quickAdd, to: '/chat?new=1' }],
  },
};

export default manifest;
