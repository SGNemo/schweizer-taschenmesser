/** Builders for links that leave the app (opened with `getPlatform().app.openUrl`). */

/** Google Maps search for a place or address (opens the Maps app on Android). */
export function mapsUrl(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.trim())}`;
}

/** WhatsApp with a prepared text; the contact is picked inside WhatsApp (no number is needed). */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
