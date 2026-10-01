import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

const BASE: { title: string; url: string; group?: string }[] = [
  { title: 'Paketverfolgung', url: 'https://paket.example.org/', group: 'Pakete' },
  { title: 'Bahnauskunft', url: 'https://bahn.example.org/', group: 'Unterwegs' },
  { title: 'Stadtwerke Kundenportal', url: 'https://stadtwerke.example.org/', group: 'Zuhause' },
  { title: 'Mediathek', url: 'https://mediathek.example.com/', group: 'Freizeit' },
  { title: 'Wetterdienst', url: 'https://wetter.example.org/', group: 'Unterwegs' },
  { title: 'Online-Bibliothek', url: 'https://bibliothek.example.org/', group: 'Freizeit' },
  { title: 'Hausverwaltung', url: 'https://hausverwaltung.example.org/', group: 'Zuhause' },
  { title: 'Fahrplan Nahverkehr', url: 'https://nahverkehr.example.org/', group: 'Unterwegs' },
  { title: 'Rezeptsammlung', url: 'https://rezepte.example.com/', group: 'Freizeit' },
  { title: 'Sendungsstatus Post', url: 'https://post.example.org/', group: 'Pakete' },
  {
    title: 'Kundenservice Internet',
    url: 'https://internet.example.org/support',
    group: 'Zuhause',
  },
  { title: 'Kartenansicht', url: 'https://karten.example.com/' },
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 6, medium: 12, large: 60 });
  return {
    link: Array.from({ length: n }, (_, i) => {
      const b = BASE[i % BASE.length]!;
      const round = Math.floor(i / BASE.length);
      return {
        id: ctx.id('launcher', 'link', i),
        data: {
          title: round === 0 ? b.title : `${b.title} ${round + 1}`,
          url: round === 0 ? b.url : `${b.url}?p=${round + 1}`,
          ...(b.group ? { group: b.group } : {}),
        },
      };
    }),
  };
}

export default { seed } satisfies SeedModule;
