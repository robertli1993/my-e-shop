export const OPEN_GUIDE_EVENT = "northline:open-guide";

export function openGuide(query?: string) {
  window.dispatchEvent(new CustomEvent<string | undefined>(OPEN_GUIDE_EVENT, { detail: query }));
}
