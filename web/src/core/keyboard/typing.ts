/** `<input>` types where a key press edits the value; checkboxes, buttons, sliders etc. do not. */
const NON_TEXT_INPUTS = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'range',
  'color',
  'file',
  'image',
]);

/** True for fields where a letter key is text, not a shortcut (text inputs, selects, textareas, editable content). */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'INPUT') return !NON_TEXT_INPUTS.has((el as HTMLInputElement).type);
  return ['TEXTAREA', 'SELECT'].includes(el.tagName);
}
