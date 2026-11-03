# News – proposal (not built)

The news module is retired ([decisions/modules.md](../decisions/modules.md)); its tables stay only so old backups restore. `core/io/feed.ts` and `core/net/fetchPublic.ts` are kept. If it returns, as an optional module:

- **Head:** newspaper masthead (serif headline, date), `identity.type: 'serif'`; reserved block "newspaper head" in [MODULE-IDENTITY](../design/MODULE-IDENTITY.md).
- **Feeds** with categories; magazine view with one large lead item; reader mode through `fetchPublic(kind: 'page')` + `parseReadable`; read/unread; muted terms (device-local).
- **Save → Merkliste** with `bus.emit('bookmark.requested', { title, url, kind: 'read', tags })` (kind and tags are supported now).
- **Optional daily summary:** headlines only, on a click (never article text, never automatic).
- **Privacy:** no `aiSchema`; article text never reaches a model; feeds are public addresses only.
- **Needs a decision:** lifting the retirement (`validateRetired`), new `news_*` collections (`db:bump`), sync of read state.
