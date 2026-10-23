const USER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex-shrink:0;color:var(--primary,#5abfeb)"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z"/></svg>`;

export function attachMitarbeiterDragPreview(event, label) {
  if (!event?.dataTransfer?.setDragImage || typeof document === 'undefined') return;

  const ghost = document.createElement('div');
  ghost.style.cssText = [
    'position: fixed',
    'top: -1000px',
    'left: -1000px',
    'z-index: 99999',
    'display: inline-flex',
    'align-items: center',
    'gap: 6px',
    'padding: 4px 10px',
    'border-radius: 6px',
    'background: var(--tile-bg, #ffffff)',
    'color: var(--text, #111827)',
    'border: 1.5px solid var(--primary, #5abfeb)',
    'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16)',
    'font-family: -apple-system, BlinkMacSystemFont, "San Francisco", Helvetica, Arial, sans-serif',
    'font-size: 12px',
    'font-weight: 600',
    'line-height: 1.25',
    'white-space: nowrap',
    'pointer-events: none',
  ].join(';');

  const iconWrap = document.createElement('span');
  iconWrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;';
  iconWrap.innerHTML = USER_ICON_SVG;

  const nameSpan = document.createElement('span');
  nameSpan.textContent = String(label || 'Mitarbeiter').trim();

  ghost.appendChild(iconWrap);
  ghost.appendChild(nameSpan);
  document.body.appendChild(ghost);

  event.dataTransfer.setDragImage(ghost, 0, 0);

  setTimeout(() => {
    ghost.remove();
  }, 0);
}
