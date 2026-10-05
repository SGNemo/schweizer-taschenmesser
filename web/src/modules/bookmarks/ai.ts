import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description: 'Merkliste: Links, Lesen, Ansehen, Orte, Ideen mit Tags und Erledigt-Status',
  collections: {
    item: {
      label: 'Merkzettel',
      fields: {
        title: 'text',
        url: 'text',
        kind: 'enum:link|read|watch|place|idea|other',
        tags: 'tags',
        note: 'text',
        done: 'bool',
      },
      titleField: 'title',
      searchable: ['title', 'url', 'note', 'tags'],
    },
  },
  actions: {
    create: {
      kind: 'create',
      collection: 'item',
      label: 'Merkzettel anlegen',
      description: 'Link, Lesestoff, Film, Ort oder Idee merken',
      fields: ['title', 'url', 'kind', 'tags', 'note'],
      required: ['title'],
      parse: {
        keywords: ['lesezeichen', 'merkzettel', 'merken', 'merke', 'ansehen', 'anschauen'],
        fallback: 'url',
        values: {
          kind: {
            read: ['lesen', 'artikel', 'buch'],
            watch: ['film', 'serie', 'ansehen', 'anschauen'],
            place: ['ort', 'restaurant'],
            idea: ['idee'],
          },
        },
      },
      examples: [
        {
          input: 'Lesezeichen https://example.org/rezept Rezept Linsensuppe',
          output: { title: 'Rezept Linsensuppe', url: 'https://example.org/rezept' },
        },
      ],
    },
    done: {
      kind: 'transition',
      collection: 'item',
      label: 'Merkzettel erledigt',
      description: 'Als gelesen/gesehen markieren',
      set: { done: true },
      parse: { keywords: ['gelesen', 'gesehen', 'angesehen'] },
      examples: [
        {
          input: 'Rezept Linsensuppe gelesen',
          target: 'Rezept Linsensuppe',
          output: { done: true },
        },
      ],
    },
    delete: {
      kind: 'delete',
      collection: 'item',
      label: 'Merkzettel löschen',
      description: 'Merkzettel löschen',
      examples: [
        {
          input: 'Lösche das Lesezeichen Rezept Linsensuppe',
          target: 'Rezept Linsensuppe',
          output: {},
        },
      ],
    },
  },
};
