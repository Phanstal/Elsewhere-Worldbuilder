export const NODE_TYPES = [
  'Place',
  'Building',
  'Map',
  'Character',
  'Faction',
  'Species',
  'Object',
  'Event',
  'Timeline',
  'Concept',
  'System',
  'Culture',
  'Category',
  'Image',
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export type NodeGroupId = 'space' | 'entities' | 'lore' | 'media';

export interface NodeTypeMeta {
  type: NodeType;
  group: NodeGroupId;
  icon: string;
  defaultWidth: number;
  defaultHeight: number;
  resizable: boolean;
}

export const NODE_GROUPS: { id: NodeGroupId; label: string; types: NodeType[] }[] = [
  { id: 'space', label: '01 — Space', types: ['Place', 'Building', 'Map'] },
  { id: 'entities', label: '02 — Entities', types: ['Character', 'Faction', 'Species', 'Object'] },
  {
    id: 'lore',
    label: '03 — Lore',
    types: ['Event', 'Timeline', 'Concept', 'System', 'Culture', 'Category'],
  },
  { id: 'media', label: '04 — Media', types: ['Image'] },
];

export const NODE_TYPE_META: Record<NodeType, NodeTypeMeta> = {
  Place: {
    type: 'Place',
    group: 'space',
    icon: '<path d="M12 21s6-5.1 6-11a6 6 0 10-12 0c0 5.9 6 11 6 11z"></path><circle cx="12" cy="10" r="2"></circle>',
    defaultWidth: 560,
    defaultHeight: 360,
    resizable: true,
  },
  Building: {
    type: 'Building',
    group: 'space',
    icon: '<path d="M4 21V8l8-5 8 5v13M8 21v-5h8v5M8 10h2M14 10h2"></path>',
    defaultWidth: 164,
    defaultHeight: 112,
    resizable: false,
  },
  Map: {
    type: 'Map',
    group: 'space',
    icon: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zM9 3v15M15 6v15"></path>',
    defaultWidth: 178,
    defaultHeight: 116,
    resizable: false,
  },
  Character: {
    type: 'Character',
    group: 'entities',
    icon: '<circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20a6.5 6.5 0 0113 0"></path>',
    defaultWidth: 104,
    defaultHeight: 104,
    resizable: false,
  },
  Faction: {
    type: 'Faction',
    group: 'entities',
    icon: '<path d="M12 3l8 4v5c0 4.8-3.4 7.8-8 9-4.6-1.2-8-4.2-8-9V7l8-4z"></path>',
    defaultWidth: 154,
    defaultHeight: 88,
    resizable: false,
  },
  Species: {
    type: 'Species',
    group: 'entities',
    icon: '<path d="M12 21c4-3 7-7 7-12-4 0-7 2-8 6M12 21c-3-3-5-6-5-10 3 0 5 2 6 5M12 21v-7"></path>',
    defaultWidth: 118,
    defaultHeight: 94,
    resizable: false,
  },
  Object: {
    type: 'Object',
    group: 'entities',
    icon: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9"></path>',
    defaultWidth: 112,
    defaultHeight: 82,
    resizable: false,
  },
  Event: {
    type: 'Event',
    group: 'lore',
    icon: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"></path>',
    defaultWidth: 174,
    defaultHeight: 46,
    resizable: false,
  },
  Timeline: {
    type: 'Timeline',
    group: 'lore',
    icon: '<path d="M4 12h16M7 8v8M12 6v12M17 9v6"></path>',
    defaultWidth: 190,
    defaultHeight: 52,
    resizable: false,
  },
  Concept: {
    type: 'Concept',
    group: 'lore',
    icon: '<path d="M9 18h6M10 21h4M8.3 14.5A6 6 0 1115.7 14.5c-.8.6-1.2 1.3-1.2 2.5h-5c0-1.2-.4-1.9-1.2-2.5z"></path>',
    defaultWidth: 154,
    defaultHeight: 42,
    resizable: false,
  },
  System: {
    type: 'System',
    group: 'lore',
    icon: '<circle cx="12" cy="12" r="3"></circle><circle cx="12" cy="12" r="8" stroke-dasharray="2 3"></circle><path d="M12 4V2M20 12h2M12 20v2M4 12H2"></path>',
    defaultWidth: 146,
    defaultHeight: 88,
    resizable: false,
  },
  Culture: {
    type: 'Culture',
    group: 'lore',
    icon: '<path d="M4 20h16M6 17h12M7 8h10v9H7V8zM5 8l7-5 7 5M10 11v3M14 11v3"></path>',
    defaultWidth: 152,
    defaultHeight: 76,
    resizable: false,
  },
  Category: {
    type: 'Category',
    group: 'lore',
    icon: '<rect x="3.5" y="5" width="17" height="14" rx="2" stroke-dasharray="3 2"></rect><path d="M8 9h8M8 13h5"></path>',
    defaultWidth: 480,
    defaultHeight: 300,
    resizable: true,
  },
  Image: {
    type: 'Image',
    group: 'media',
    icon: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="M4 17l5-4 3 3 3-2 5 4"></path>',
    defaultWidth: 150,
    defaultHeight: 108,
    resizable: false,
  },
};

export function nodeTypeMeta(type: NodeType): NodeTypeMeta {
  return NODE_TYPE_META[type];
}

export function isNodeType(value: string): value is NodeType {
  return (NODE_TYPES as readonly string[]).includes(value);
}

export interface WorldNode {
  id: number;
  title: string;
  type: NodeType;
  x: number;
  y: number;
  description: string;
  width?: number;
  height?: number;
  sourceId?: number;
}

export interface Relation {
  id: number;
  from: number;
  to: number;
  name: string;
}

export interface World {
  format: 'elsew';
  version: 1;
  id: string;
  name: string;
  updatedAt: string;
  nodes: WorldNode[];
  relations: Relation[];
}

export interface WorldSummary {
  id: string;
  name: string;
  updatedAt: string;
  nodeCount: number;
}
