import type { ModuleAiSchema } from '@/core/modules/types';

/**
 * Compact description for the assistant's local queries (names of fields, never values). Coordinates are
 * left out on purpose: the assistant finds places by name, kind or address, the data never leaves the device.
 */
export const aiSchema: ModuleAiSchema = {
  description:
    'Karten & Orte: gespeicherte Orte (Name, Adresse, Art) und Routen (Name, Verkehrsmittel)',
  collections: {
    place: {
      label: 'Ort',
      fields: {
        name: 'text',
        address: 'text',
        category: 'enum:home|work|shop|health|leisure|other',
        note: 'text',
        pinned: 'bool',
      },
      titleField: 'name',
      searchable: ['name', 'address', 'note'],
    },
    route: {
      label: 'Route',
      fields: {
        name: 'text',
        mode: 'enum:walk|bike|car|transit',
        note: 'text',
        pinned: 'bool',
      },
      titleField: 'name',
      searchable: ['name', 'note'],
    },
  },
};
