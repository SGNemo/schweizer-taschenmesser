/** "Wetter: Stadt wählen" is offered once; "Später nicht mehr" is remembered on this device only. */
const KEY = 'tm-weather-hint';

export function isHintDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === 'off';
  } catch {
    return false;
  }
}

export function dismissHint(): void {
  try {
    localStorage.setItem(KEY, 'off');
  } catch {
    // Storage blocked: the hint shows again next time, nothing else.
  }
}
