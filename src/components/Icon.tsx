import type { CSSProperties } from 'react';
import { NODE_TYPE_META, type NodeType } from '../domain/types';

const ICONS = {
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"></path>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"></path>',
  chevronDown: '<path d="M6 9l6 6 6-6"></path>',
  chevronRight: '<path d="M9 6l6 6-6 6"></path>',
  undo: '<path d="M9 7L4 12l5 5M4 12h10a6 6 0 010 12"></path>',
  redo: '<path d="M15 7l5 5-5 5M20 12H10a6 6 0 000 12"></path>',
  minus: '<path d="M5 12h14"></path>',
  plus: '<path d="M12 5v14M5 12h14"></path>',
  fit: '<path d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4"></path>',
  save: '<path d="M12 4v11M8 11l4 4 4-4M5 20h14"></path>',
  download: '<path d="M12 4v11M8 11l4 4 4-4M5 20h14"></path>',
  close: '<path d="M6 6l12 12M18 6L6 18"></path>',
  trash: '<path d="M5 7h14M9 7V4h6v3M7 7l1 14h8l1-14"></path>',
  alias:
    '<rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="14" width="6" height="6" rx="1"></rect><path d="M10 7h4a3 3 0 013 3v4"></path>',
  more: '<circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle>',
  world:
    '<circle cx="7" cy="7" r="3"></circle><circle cx="17" cy="6" r="2"></circle><circle cx="15" cy="17" r="3"></circle><path d="M9.7 8.3l5.4-1.6M8.5 9.5l4.8 5.2"></path>',
  nodes:
    '<rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="14" width="6" height="6" rx="1"></rect><path d="M10 7h4a3 3 0 013 3v4"></path>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="M4 17l5-4 3 3 3-2 5 4"></path>',
  file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5"></path>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"></path>',
  keyboard:
    '<rect x="3" y="6" width="18" height="12" rx="2"></rect><path d="M7 10h.01M11 10h.01M15 10h.01M18 10h.01M8 14h8"></path>',
  info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path>',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.5,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

export function TypeIcon({
  type,
  size = 16,
  className,
}: {
  type: NodeType;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      dangerouslySetInnerHTML={{ __html: NODE_TYPE_META[type].icon }}
    />
  );
}
