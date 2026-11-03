import { describe, expect, it } from 'vitest';
import { categoryIcon } from './categoryIcon';

describe('categoryIcon', () => {
  it('the default categories have their own icon by id', () => {
    expect(categoryIcon({ id: 'cat-food', name: 'Lebensmittel' })).toBe('cart');
    expect(categoryIcon({ id: 'cat-home', name: 'Wohnen' })).toBe('home');
    expect(categoryIcon({ id: 'cat-salary', name: 'Gehalt' })).toBe('wallet');
  });

  it('a renamed default keeps its icon (the id decides first)', () => {
    expect(categoryIcon({ id: 'cat-food', name: 'Essen & Trinken' })).toBe('cart');
  });

  it('own categories are matched by words in the app languages', () => {
    expect(categoryIcon({ id: 'x1', name: 'Tankstelle' })).toBe('car');
    expect(categoryIcon({ id: 'x2', name: 'Groceries' })).toBe('cart');
    expect(categoryIcon({ id: 'x3', name: 'Ahorro' })).toBe('piggy');
    expect(categoryIcon({ id: 'x4', name: 'Voyage' })).toBe('luggage');
  });

  it('anything else, and a booking without category, is neutral', () => {
    expect(categoryIcon({ id: 'x5', name: 'Xyz' })).toBe('package');
    expect(categoryIcon(undefined)).toBe('package');
  });
});
