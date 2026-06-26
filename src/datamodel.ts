import { readFile } from 'fs/promises';
import { join } from 'path';

export interface PropertyDefinition {
  name: string;
  type: string;
}

export interface EntityType {
  id: string;
  label?: string;
  parentId?: string;
  properties?: PropertyDefinition[];
}

export interface DataModel {
  entityTypes: EntityType[];
}

/**
 * Read _immarkus.model.json from the source directory.
 * Returns an empty model if the file is absent or unreadable.
 */
export async function loadDataModel(sourceDir: string): Promise<DataModel> {
  try {
    const raw = await readFile(join(sourceDir, '_immarkus.model.json'), 'utf-8');
    const data = JSON.parse(raw) as Partial<{ entityTypes: EntityType[] }>;
    return { entityTypes: data.entityTypes ?? [] };
  } catch {
    return { entityTypes: [] };
  }
}

/**
 * Look up an entity type by ID, merging inherited properties from the
 * parent chain (root first, so child properties override parent ones of
 * the same name).
 */
export function getEntityType(id: string, model: DataModel): EntityType | undefined {
  const type = model.entityTypes.find(e => e.id === id);
  if (!type) return undefined;
  if (!type.parentId) return type;

  // Walk up the parent chain, collecting properties outermost-first
  const chain: EntityType[] = [];
  let current: EntityType | undefined = type;
  while (current) {
    chain.unshift(current);
    current = current.parentId
      ? model.entityTypes.find(e => e.id === current!.parentId)
      : undefined;
  }

  // Merge: properties from ancestors are available, children can override
  const merged: PropertyDefinition[] = [];
  const seen = new Set<string>();
  for (const t of [...chain].reverse()) {
    for (const p of t.properties ?? []) {
      if (!seen.has(p.name)) {
        merged.push(p);
        seen.add(p.name);
      }
    }
  }

  return { ...type, properties: merged };
}

/**
 * Convert a property value to a display string based on the property type.
 * Handles arrays (multiple values) for all types.
 *
 * Types: text | number | enum | uri | range | color | external_authority
 *        measurement | geocoordinate
 */
function serializeValue(type: string, value: unknown): string {
  if (value === null || value === undefined) return '';

  if (type === 'measurement') {
    const items = Array.isArray(value) ? value : [value];
    return items
      .map((v: unknown) =>
        v && typeof v === 'object' && 'value' in v && 'unit' in v
          ? `${(v as { value: unknown; unit: unknown }).value} ${(v as { value: unknown; unit: unknown }).unit}`
          : String(v)
      )
      .join(', ');
  }

  if (type === 'geocoordinate') {
    const isNested =
      Array.isArray(value) && Array.isArray((value as unknown[])[0]);
    const coords = isNested
      ? (value as number[][])
      : ([value] as number[][]);
    return coords.map(c => `${c[0]}/${c[1]}`).join('; ');
  }

  // text, number, enum, uri, range, color, external_authority
  const items = Array.isArray(value) ? value : [value];
  return items
    .filter(v => v !== null && v !== undefined)
    .map(v =>
      typeof v === 'object' ? JSON.stringify(v) : String(v)
    )
    .join(', ');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface RawBody {
  id?: string;
  type?: string;
  purpose?: string;
  source?: string;
  properties?: Record<string, unknown>;
  value?: string;
  format?: string;
  [key: string]: unknown;
}

/**
 * Convert a single IMMARKUS annotation body to a standard W3C TextualBody
 * that IIIF viewers can render.
 *
 * - Classifying bodies (entity type tags with property values) → text/html
 * - All other bodies (plain text comments, etc.) → returned unchanged
 */
export function crosswalkBody(body: RawBody, model: DataModel): RawBody {
  if (body.purpose !== 'classifying') {
    return body;
  }

  const entityType = body.source ? getEntityType(body.source, model) : undefined;

  const entries: Array<[string, string]> = Object.entries(
    body.properties ?? {}
  ).map(([key, val]) => {
    const propDef = entityType?.properties?.find(p => p.name === key);
    const serialized = propDef
      ? serializeValue(propDef.type, val)
      : typeof val === 'object' && val !== null
        ? JSON.stringify(val)
        : String(val ?? '');
    return [key, serialized];
  });

  const label = entityType?.label ?? body.source ?? '';
  const heading = label ? `<p><em>${escapeHtml(label)}</em></p>` : '';
  const rows = entries
    .filter(([, val]) => val !== '')
    .map(
      ([key, val]) =>
        `<p><strong>${escapeHtml(key)}</strong>: <span>${escapeHtml(val)}</span></p>`
    )
    .join('');

  return {
    id: body.id,
    type: 'TextualBody',
    format: 'text/html',
    purpose: 'describing',
    value: `<div>${heading}${rows}</div>`,
  };
}

/**
 * Apply crosswalkBody to every body in a W3C annotation, returning a new
 * annotation object with standard bodies that IIIF viewers can render.
 */
export function crosswalkAnnotationBodies(
  annotation: unknown,
  model: DataModel
): unknown {
  const a = annotation as Record<string, unknown>;
  if (!a.body) return annotation;

  const bodies = Array.isArray(a.body) ? a.body : [a.body];
  const crosswalked = bodies.map(b => crosswalkBody(b as RawBody, model));

  return {
    ...a,
    body: crosswalked.length === 1 ? crosswalked[0] : crosswalked,
  };
}
