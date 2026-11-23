/**
 * Crisp custom SVG vector icons for スワイプ・ランデブー！ (Zero OS emojis)
 */

function svg(body: string, cls = 'ui-ico', viewBox = '0 0 24 24'): string {
  return `<svg class="${cls}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}

export const ICONS = {
  play: (cls = 'ui-ico') =>
    svg(
      `<path d="M7.5 5.2L19.2 12L7.5 18.8V5.2Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
      cls
    ),
  pause: (cls = 'ui-ico') =>
    svg(
      `<rect x="6" y="5" width="4.2" height="14" rx="1.4" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4" fill="currentColor"/>`,
      cls
    ),
  heart: (cls = 'ui-ico') =>
    svg(
      `<path d="M12 20.4C12 20.4 3.5 15.1 3.5 9.2C3.5 6.4 5.7 4.2 8.4 4.2C10 4.2 11.4 5.1 12 6.3C12.6 5.1 14 4.2 15.6 4.2C18.3 4.2 20.5 6.4 20.5 9.2C20.5 15.1 12 20.4 12 20.4Z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`,
      cls
    ),
  cross: (cls = 'ui-ico') =>
    svg(
      `<path d="M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>`,
      cls
    ),
  music: (cls = 'ui-ico') =>
    svg(
      `<path d="M9 17.5V7.2L19 5.5V15.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor"/><circle cx="16.5" cy="15.5" r="2.5" fill="currentColor"/>`,
      cls
    ),
  musicOff: (cls = 'ui-ico') =>
    svg(
      `<path d="M9 17.5V7.2L19 5.5V15.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/><circle cx="6.5" cy="17.5" r="2.3" fill="currentColor" opacity="0.45"/><circle cx="16.5" cy="15.5" r="2.3" fill="currentColor" opacity="0.45"/><path d="M4 4L20 20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`,
      cls
    ),
  sound: (cls = 'ui-ico') =>
    svg(
      `<path d="M4.5 9.5H8.5L13.5 5.2V18.8L8.5 14.5H4.5V9.5Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M16.8 8.6C18.1 9.8 18.8 10.9 18.8 12C18.8 13.1 18.1 14.2 16.8 15.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M19.5 6.2C21.2 7.8 22 9.8 22 12C22 14.2 21.2 16.2 19.5 17.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
      cls
    ),
  soundOff: (cls = 'ui-ico') =>
    svg(
      `<path d="M4.5 9.5H8.5L13.5 5.2V18.8L8.5 14.5H4.5V9.5Z" fill="currentColor" opacity="0.5"/><path d="M16.5 9.2L21.5 14.2M21.5 9.2L16.5 14.2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
      cls
    ),
  home: (cls = 'ui-ico') =>
    svg(
      `<path d="M4 11.2L12 4.5L20 11.2V19.2C20 19.8 19.5 20.2 18.9 20.2H14.6V14.5H9.4V20.2H5.1C4.5 20.2 4 19.8 4 19.2V11.2Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
      cls
    ),
  help: (cls = 'ui-ico') =>
    svg(
      `<circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="2.2"/><path d="M9.4 9.3C9.7 7.9 10.8 7.1 12.2 7.1C13.8 7.1 14.9 8.1 14.9 9.5C14.9 10.7 14 11.3 13 11.9C12.3 12.3 12 12.8 12 13.7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16.9" r="1.25" fill="currentColor"/>`,
      cls
    ),
  trophy: (cls = 'ui-ico') =>
    svg(
      `<path d="M7.5 4.5H16.5V10C16.5 12.5 14.5 14.5 12 14.5C9.5 14.5 7.5 12.5 7.5 10V4.5Z" fill="currentColor"/><path d="M7.5 6.5H4.8C4.8 9.2 5.9 11 7.6 11.3M16.5 6.5H19.2C19.2 9.2 18.1 11 16.4 11.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 14.5V18.2M8.5 19.5H15.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
      cls
    ),
  flame: (cls = 'ui-ico') =>
    svg(
      `<path d="M12.5 3C12.5 3 17.8 6.8 17.8 12.4C17.8 16.4 15.2 19.8 11.8 19.8C8.3 19.8 6.2 17 6.2 13.8C6.2 11.1 7.7 9 9.2 7.8C9.2 9.8 10.4 10.8 11.2 10.8C10.8 8.2 11.2 5.2 12.5 3Z" fill="currentColor"/>`,
      cls
    ),
  sparkle: (cls = 'ui-ico') =>
    svg(
      `<path d="M12 2.5L14.4 9.6L21.5 12L14.4 14.4L12 21.5L9.6 14.4L2.5 12L9.6 9.6L12 2.5Z" fill="currentColor"/>`,
      cls
    ),
  alert: (cls = 'ui-ico') =>
    svg(
      `<path d="M12 3.5L21 19.5H3L12 3.5Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9.4V13.8" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.2" fill="#ffffff"/>`,
      cls
    ),
  burst: (cls = 'ui-ico') =>
    svg(
      `<path d="M12 2.5L14.5 7.5L20 5.5L17.4 10.8L22 14L16.5 15.5L17.5 21L12.5 17.8L8.2 21.2L8.8 15.6L3 14.5L7.4 11L4.6 6L10.1 7.7L12 2.5Z" fill="currentColor"/>`,
      cls
    ),
  shield: (cls = 'ui-ico') =>
    svg(
      `<path d="M12 3L19.5 6V11.8C19.5 16.4 16.2 19.8 12 21.2C7.8 19.8 4.5 16.4 4.5 11.8V6L12 3Z" fill="currentColor"/><path d="M9 12.2L11.2 14.4L15.6 9.8" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
      cls
    ),
  eye: (cls = 'ui-ico') =>
    svg(
      `<path d="M2.5 12C4.6 7.8 8 5.8 12 5.8C16 5.8 19.4 7.8 21.5 12C19.4 16.2 16 18.2 12 18.2C8 18.2 4.6 16.2 2.5 12Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/>`,
      cls
    ),
  runner: (cls = 'ui-ico') =>
    svg(
      `<circle cx="12" cy="5.2" r="2.6" fill="currentColor"/><path d="M7.5 12.2L10.5 9.8H14.2L16.8 12.5M10.5 9.8L9.6 15.2L6.8 19.5M13.5 10.2L14.2 15.4L17.5 19.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
      cls
    ),
  retry: (cls = 'ui-ico') =>
    svg(
      `<path d="M19.5 12A7.5 7.5 0 1 1 17.3 6.7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M17.8 3.5V7.5H13.8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
      cls
    ),
  chevronLeft: (cls = 'ui-ico') =>
    svg(
      `<path d="M15 5.5L8.5 12L15 18.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
      cls
    ),
  chevronRight: (cls = 'ui-ico') =>
    svg(
      `<path d="M9 5.5L15.5 12L9 18.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
      cls
    ),
  swipeIcon: (cls = 'ui-ico') =>
    svg(
      `<rect x="6" y="3" width="12" height="18" rx="2.5" stroke="currentColor" stroke-width="2.2"/><path d="M10.5 17.5H13.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15 10.5H21M18.5 8L21 10.5L18.5 13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
      cls
    ),
  roadIcon: (cls = 'ui-ico') =>
    svg(
      `<path d="M7.5 3.5L3.5 20.5M16.5 3.5L20.5 20.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M12 5V8.5M12 11.5V14.5M12 17.5V20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
      cls
    ),
  bolt: (cls = 'ui-ico') =>
    svg(
      `<path d="M13.5 2.5L5.5 13.2H11.5L10.5 21.5L18.5 10.8H12.5L13.5 2.5Z" fill="currentColor"/>`,
      cls
    ),
  book: (cls = 'ui-ico') =>
    svg(
      `<path d="M4.5 5.5C4.5 4.7 5.2 4 6 4H11.5V19.5H6C5.2 19.5 4.5 18.8 4.5 18V5.5Z" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/><path d="M19.5 5.5C19.5 4.7 18.8 4 18 4H12.5V19.5H18C18.8 19.5 19.5 18.8 19.5 18V5.5Z" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/>`,
      cls
    ),
};
