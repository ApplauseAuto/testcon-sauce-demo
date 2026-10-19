import type { Direction, ElementNature, ElementQuery, TableQuery } from './types';

const directionAliases: Record<string, Direction> = {
  left: 'left',
  before: 'left',
  right: 'right',
  after: 'right',
  up: 'up',
  above: 'up',
  top: 'up',
  down: 'down',
  below: 'down',
  bottom: 'down',
};

const natureAliases: Array<[ElementNature, string[]]> = [
  ['element', ['element']],
  ['modal', ['modal dialog', 'dialog', 'modal']],
  ['card', ['card component', 'card', 'tile', 'panel']],
  ['textarea', ['text area', 'textarea']],
  ['textbox', ['input box', 'text box', 'textbox', 'field']],
  ['select', ['select box', 'select']],
  [
    'multiselect',
    ['multi select list', 'multi-select list', 'multi select', 'multi-select', 'multiselect'],
  ],
  ['dropdown', ['drop down', 'dropdown', 'combo box', 'combobox']],
  ['radio', ['radio button', 'radio']],
  ['checkbox', ['check box', 'checkbox']],
  ['title', ['heading', 'header', 'title']],
  ['paragraph', ['paragraph', 'para']],
  ['button', ['button']],
  ['image', ['image', 'img', 'picture']],
  ['label', ['label']],
  ['span', ['span']],
  ['table', ['table', 'grid']],
  ['text', ['text']],
  ['link', ['link', 'anchor']],
  ['input', ['input']],
];

const attributePattern =
  /\b(placeholder|text|alt|title|aria-label|label|name|id|value|role|test|testid|data-test|data-testid)\b\s*(?:=|:|is|as|of|containing|contains)?\s*["']([^"']+)["']/gi;

export function parseDescription(description: string): ElementQuery {
  const { description: normalizedDescription, pageNumber } = extractPageNumber(
    normalize(description),
  );
  const tableQuery = parseTableDescription(normalizedDescription, pageNumber);
  if (tableQuery) {
    return tableQuery;
  }

  const containmentMatch = splitContainment(normalizedDescription);
  if (containmentMatch) {
    const [target, container] = containmentMatch;
    return {
      ...parseDescription(target),
      within: parseDescription(container),
    };
  }

  const relationMatch =
    normalizedDescription.match(
      /^(.+?)\s+(?:to\s+the\s+)?(left|right|up|down|above|below|top|bottom)\s+of\s+(.+)$/i,
    ) ?? normalizedDescription.match(/^(.+)\s+(above|below|up|down)\s+(.+)$/i);

  if (relationMatch) {
    const [, target, direction, anchor] = relationMatch;
    return {
      ...parseElementPhrase(target),
      relation: {
        direction: directionAliases[direction.toLowerCase()],
        anchor: parseDescription(anchor),
      },
    };
  }

  return parseElementPhrase(normalizedDescription);
}

function parseTableDescription(description: string, pageNumber?: number): ElementQuery | undefined {
  let targetPhrase = description;
  const table: TableQuery = {};

  if (pageNumber !== undefined) {
    table.pageNumber = pageNumber;
  }

  const recordMatch = targetPhrase.match(/^(.+?)\s+for\s+record\s+having\s+(.+)$/i);
  if (recordMatch) {
    targetPhrase = recordMatch[1].trim();
    const record = parseRecordCriteria(recordMatch[2]);
    if (record.length === 0) {
      return undefined;
    }
    table.record = record;
  }

  const rowMatch = targetPhrase.match(/^(.+?)\s+on\s+row\s+number\s+(\d+)$/i);
  if (rowMatch) {
    targetPhrase = rowMatch[1].trim();
    table.rowNumber = Number(rowMatch[2]);
  }

  const columnMatch = targetPhrase.match(/^(.+?)\s+in\s+column\s+(?:number\s+)?(.+)$/i);
  if (columnMatch) {
    targetPhrase = columnMatch[1].trim();
    const column = parseColumnReference(columnMatch[2]);
    if (typeof column === 'number') {
      table.columnNumber = column;
    } else {
      table.columnHeader = column;
    }
  }

  if (
    !table.rowNumber &&
    !table.columnNumber &&
    !table.columnHeader &&
    !table.record &&
    table.pageNumber === undefined
  ) {
    return undefined;
  }

  return {
    ...parseElementPhrase(targetPhrase),
    table,
  };
}

function parseElementPhrase(phrase: string): ElementQuery {
  const attributes: Record<string, string> = {};
  for (const match of phrase.matchAll(attributePattern)) {
    attributes[normalizeAttributeName(match[1])] = match[2].trim();
  }

  const typePhrase = phrase.replace(/\s+with\s+.*$/i, '').trim();
  const type = detectNature(typePhrase);

  return {
    ...(type ? { type } : { type: 'any' }),
    ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
  };
}

function splitContainment(description: string): [string, string] | undefined {
  let split: [string, string] | undefined;
  const connectorPattern = /\s+(inside|within|in)\s+/gi;

  for (const match of description.matchAll(connectorPattern)) {
    if (match.index === undefined || isInsideQuotedText(description, match.index)) {
      continue;
    }

    const target = description.slice(0, match.index).trim();
    const container = description.slice(match.index + match[0].length).trim();
    if (target && container) {
      split = [target, container];
    }
  }

  return split;
}

function isInsideQuotedText(value: string, index: number): boolean {
  let activeQuote: '"' | "'" | undefined;

  for (let characterIndex = 0; characterIndex < index; characterIndex += 1) {
    const character = value[characterIndex];
    if (character !== '"' && character !== "'") {
      continue;
    }

    if (activeQuote === character && value[characterIndex - 1] !== '\\') {
      activeQuote = undefined;
    } else if (!activeQuote) {
      activeQuote = character;
    }
  }

  return activeQuote !== undefined;
}

function parseRecordCriteria(criteria: string) {
  const record: Array<{ column: string | number; text: string }> = [];
  const criterionPattern =
    /column\s+(?:number\s+)?(?:"([^"]+)"|'([^']+)'|(\d+))\s+with\s+text\s+["']([^"']+)["']/gi;

  for (const match of criteria.matchAll(criterionPattern)) {
    const columnName = match[1] ?? match[2];
    record.push({
      column: columnName ?? Number(match[3]),
      text: match[4].trim(),
    });
  }

  return record;
}

function parseColumnReference(columnReference: string): string | number {
  const trimmed = columnReference.trim();
  const quoted = trimmed.match(/^["'](.+)["']$/);
  if (quoted) {
    return quoted[1].trim();
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  return trimmed;
}

function extractPageNumber(description: string): { description: string; pageNumber?: number } {
  const pageMatch = description.match(/^(.+?)\s+(?:on|in)\s+page\s+(?:number\s+)?(\d+)$/i);
  if (!pageMatch) {
    return { description };
  }

  return {
    description: pageMatch[1].trim(),
    pageNumber: Number(pageMatch[2]),
  };
}

function detectNature(phrase: string): ElementNature | undefined {
  const normalized = stripArticles(phrase.toLowerCase());
  const aliases = natureAliases.flatMap(([nature, names]) =>
    names.map((name) => [nature, name] as const),
  );
  aliases.sort((a, b) => b[1].length - a[1].length);

  return aliases.find(([, alias]) => normalized.includes(alias))?.[0];
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripArticles(value: string): string {
  return value
    .replace(/\b(a|an|the)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAttributeName(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized === 'testid') {
    return 'data-testid';
  }

  if (normalized === 'test') {
    return 'data-test';
  }

  return normalized;
}
