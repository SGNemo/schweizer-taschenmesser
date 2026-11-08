import { best, head } from '../helpers';
import type { SourceDef } from '../types';
import { looksLikeMfpExercise, looksLikeMfpNutrition } from './parse';

export const source: SourceDef = {
  id: 'myfitnesspal',
  targets: [{ moduleId: 'fitness', importerId: 'file' }],
  extensions: ['csv', 'zip'],
  detect: (files) =>
    best(files, (f) => {
      const h = head(f, 2000);
      return looksLikeMfpNutrition(h) || looksLikeMfpExercise(h) ? 1 : 0;
    }),
};
