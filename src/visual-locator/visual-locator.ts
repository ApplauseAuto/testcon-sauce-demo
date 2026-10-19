import type { Frame, Locator, Page } from '@playwright/test';
import { parseDescription } from './description-parser';
import type {
  Direction,
  ElementQuery,
  ResolveOptions,
  TableQuery,
  VisualLocatorConfig,
} from './types';

const DEFAULT_TIMEOUT = 5_000;
const DEFAULT_MARKER_ATTRIBUTE = 'data-visual-locator-id';

type CandidateSummary = {
  tag: string;
  type?: string | null;
  text: string;
  score: number;
};

type ResolveResult =
  | {
      found: true;
      markerValue: string;
      summary: CandidateSummary;
    }
  | {
      found: false;
      reason: string;
      candidates: CandidateSummary[];
    };

type BrowserResolveArgs = {
  query: ElementQuery;
  markerAttribute: string;
  markerValue: string;
  strict: boolean;
};

export class VisualLocator {
  constructor(
    private readonly page: Page,
    private readonly config: VisualLocatorConfig = {},
  ) {}

  async find(description: string | ElementQuery, options: ResolveOptions = {}): Promise<Locator> {
    const query = typeof description === 'string' ? parseDescription(description) : description;
    const timeout = options.timeout ?? this.config.timeout ?? DEFAULT_TIMEOUT;
    const strict = options.strict ?? this.config.strict ?? true;
    const markerAttribute = this.config.markerAttribute ?? DEFAULT_MARKER_ATTRIBUTE;

    if (query.table) {
      return this.findTableElement(description, query, { timeout, strict, markerAttribute });
    }

    const markerValue = `vl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const deadline = Date.now() + timeout;
    let resolved: ResolveResult | undefined;

    while (Date.now() <= deadline) {
      const frameResult = await this.resolveInFrames(query, markerAttribute, markerValue, strict);
      resolved = frameResult.result;
      if (resolved.found && 'frame' in frameResult) {
        return frameResult.frame.locator(`[${markerAttribute}="${resolved.markerValue}"]`);
      }

      await this.page.waitForTimeout(Math.min(100, Math.max(0, deadline - Date.now())));
    }

    throw new Error(formatResolutionError(description, resolved?.found ? undefined : resolved));
  }

  async click(description: string | ElementQuery, options: ResolveOptions = {}): Promise<void> {
    await (await this.find(description, options)).click();
  }

  async dragAndDrop(
    sourceDescription: string | ElementQuery,
    targetDescription: string | ElementQuery,
    options: ResolveOptions = {},
  ): Promise<void> {
    const source = await this.find(sourceDescription, options);
    const target = await this.find(targetDescription, options);
    await source.hover();
    await this.page.mouse.down();
    await target.hover();
    await this.page.mouse.up();
  }

  async fill(
    description: string | ElementQuery,
    value: string,
    options: ResolveOptions = {},
  ): Promise<void> {
    await (await this.find(description, options)).fill(value);
  }

  async selectOption(
    description: string | ElementQuery,
    value: string | string[],
    options: ResolveOptions = {},
  ) {
    const locator = await this.find(description, options);
    const values = Array.isArray(value) ? value : [value];
    const elementInfo = await locator.evaluate((element) => ({
      tagName: element.tagName.toLowerCase(),
      role: element.getAttribute('role'),
      ariaExpanded: element.getAttribute('aria-expanded'),
    }));

    if (elementInfo.tagName === 'select') {
      try {
        return await locator.selectOption(value);
      } catch (error) {
        if (values.every((option) => typeof option === 'string')) {
          return locator.selectOption(values.map((label) => ({ label })));
        }

        throw error;
      }
    }

    if (elementInfo.role === 'combobox' || elementInfo.ariaExpanded !== null) {
      for (const option of values) {
        await locator.click();
        await this.clickVisibleOption(option, options);
      }

      return [];
    }

    for (const option of values) {
      await this.clickOptionInside(locator, option, options);
    }

    return [];
  }

  async selectOptions(
    description: string | ElementQuery,
    values: string[],
    options: ResolveOptions = {},
  ) {
    return this.selectOption(description, values, options);
  }

  private async clickVisibleOption(optionText: string, options: ResolveOptions): Promise<void> {
    const timeout = options.timeout ?? this.config.timeout ?? DEFAULT_TIMEOUT;
    const deadline = Date.now() + timeout;
    const selector = '[role="option"], [role="menuitem"], [role="listitem"], li, button';

    while (Date.now() <= deadline) {
      for (const frame of this.page.frames()) {
        const option = frame.locator(selector).filter({ hasText: optionText }).last();
        if (await option.isVisible().catch(() => false)) {
          await option.click();
          return;
        }
      }

      await this.page.waitForTimeout(Math.min(100, Math.max(0, deadline - Date.now())));
    }

    throw new Error(`Unable to find visible option "${optionText}".`);
  }

  private async clickOptionInside(
    container: Locator,
    optionText: string,
    options: ResolveOptions,
  ): Promise<void> {
    const timeout = options.timeout ?? this.config.timeout ?? DEFAULT_TIMEOUT;
    const option = container
      .locator('button, [role="option"], [role="checkbox"], [role="menuitem"], label, li')
      .filter({ hasText: optionText })
      .first();

    await option.waitFor({ state: 'visible', timeout });
    await option.click();
  }

  private async findTableElement(
    description: string | ElementQuery,
    query: ElementQuery,
    options: { timeout: number; strict: boolean; markerAttribute: string },
  ): Promise<Locator> {
    const { timeout, strict, markerAttribute } = options;
    const deadline = Date.now() + timeout;
    const markerValue = `vl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let resolved: ResolveResult | undefined;

    if (query.table?.pageNumber !== undefined) {
      const reachedPage = await this.goToTablePage(query.table.pageNumber, deadline);
      if (!reachedPage) {
        throw new Error(
          formatResolutionError(description, {
            found: false,
            reason: `Unable to navigate to requested table page ${query.table.pageNumber}.`,
            candidates: [],
          }),
        );
      }

      resolved = await this.resolveUntilDeadline(
        query,
        markerAttribute,
        markerValue,
        strict,
        deadline,
      );
      if (resolved?.found) {
        return this.page.locator(`[${markerAttribute}="${resolved.markerValue}"]`);
      }

      throw new Error(
        formatResolutionError(
          description,
          withReason(
            resolved,
            `No matching table element was found on requested page ${query.table.pageNumber}. Other pages were not scanned because a page number was specified.`,
          ),
        ),
      );
    }

    if (!query.table?.record || query.table.record.length === 0) {
      resolved = await this.resolveUntilDeadline(
        query,
        markerAttribute,
        markerValue,
        strict,
        deadline,
      );
      if (resolved?.found) {
        return this.page.locator(`[${markerAttribute}="${resolved.markerValue}"]`);
      }

      throw new Error(formatResolutionError(description, resolved?.found ? undefined : resolved));
    }

    const visitedPageSignatures = new Set<string>();
    while (Date.now() <= deadline) {
      resolved = await this.page.evaluate(resolveVisualElement, {
        query,
        markerAttribute,
        markerValue,
        strict,
      });
      if (resolved.found) {
        return this.page.locator(`[${markerAttribute}="${resolved.markerValue}"]`);
      }

      const signature = await this.page.evaluate(tablePageSignature);
      if (visitedPageSignatures.has(signature)) {
        break;
      }
      visitedPageSignatures.add(signature);

      const advanced = await this.clickNextTablePage(deadline);
      if (!advanced) {
        break;
      }

      await this.page.waitForTimeout(Math.min(250, Math.max(0, deadline - Date.now())));
    }

    throw new Error(
      formatResolutionError(
        description,
        withReason(resolved, 'No matching table record was found on any scanned page.'),
      ),
    );
  }

  private async resolveUntilDeadline(
    query: ElementQuery,
    markerAttribute: string,
    markerValue: string,
    strict: boolean,
    deadline: number,
  ): Promise<ResolveResult | undefined> {
    let resolved: ResolveResult | undefined;

    while (Date.now() <= deadline) {
      resolved = await this.page.evaluate(resolveVisualElement, {
        query,
        markerAttribute,
        markerValue,
        strict,
      });
      if (resolved.found) {
        return resolved;
      }

      await this.page.waitForTimeout(Math.min(100, Math.max(0, deadline - Date.now())));
    }

    return resolved;
  }

  private async goToTablePage(pageNumber: number, deadline: number): Promise<boolean> {
    while (Date.now() <= deadline) {
      const currentPage = await this.page.evaluate(currentTablePageNumber);
      if (currentPage === pageNumber) {
        return true;
      }

      const clicked = await this.page.evaluate(clickTablePageControl, {
        type: 'page' as const,
        pageNumber,
      });
      if (!clicked) {
        return false;
      }

      await this.page.waitForTimeout(100);
    }

    return false;
  }

  private async clickNextTablePage(deadline: number): Promise<boolean> {
    if (Date.now() > deadline) {
      return false;
    }

    return this.page.evaluate(clickTablePageControl, { type: 'next' as const });
  }

  private async resolveInFrames(
    query: ElementQuery,
    markerAttribute: string,
    markerValue: string,
    strict: boolean,
  ): Promise<
    | { frame: Frame; result: Extract<ResolveResult, { found: true }> }
    | { result: Extract<ResolveResult, { found: false }> }
  > {
    let lastResult: Extract<ResolveResult, { found: false }> | undefined;

    for (const frame of this.page.frames()) {
      try {
        const result = await frame.evaluate(resolveVisualElement, {
          query,
          markerAttribute,
          markerValue,
          strict,
        });
        if (result.found) {
          return { frame, result };
        }

        lastResult = result;
      } catch {
        // Detached or inaccessible frames should not prevent other frames from being searched.
      }
    }

    return {
      result: lastResult ?? {
        found: false,
        reason: 'No accessible frame returned a matching element.',
        candidates: [],
      },
    };
  }
}

export function visual(page: Page, config?: VisualLocatorConfig): VisualLocator {
  return new VisualLocator(page, config);
}

function formatResolutionError(
  description: string | ElementQuery,
  result?: Extract<ResolveResult, { found: false }>,
) {
  const requested = typeof description === 'string' ? description : JSON.stringify(description);
  const candidates = (result?.candidates ?? [])
    .slice(0, 5)
    .map(
      (candidate) =>
        `- <${candidate.tag}> ${candidate.type ?? ''} "${candidate.text}" score=${candidate.score}`,
    )
    .join('\n');

  return [
    `Unable to resolve visual element: ${requested}`,
    result?.reason ?? 'Timed out before the browser returned a resolution result.',
    candidates ? `Nearest candidates:\n${candidates}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');
}

function withReason(
  result: ResolveResult | undefined,
  reason: string,
): Extract<ResolveResult, { found: false }> {
  if (result?.found === false) {
    return { ...result, reason };
  }

  return { found: false, reason, candidates: [] };
}

function resolveVisualElement({
  query,
  markerAttribute,
  markerValue,
  strict,
}: BrowserResolveArgs): ResolveResult {
  type Rect = {
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };

  type Candidate = {
    element: Element;
    rect: Rect;
    tag: string;
    type?: string | null;
    text: string;
    score: number;
  };

  const allElements = collectAllElements(document).filter(isVisible);

  const candidates = resolveCandidates(query);

  if (candidates.length === 0) {
    return {
      found: false,
      reason: 'No visible elements matched the requested type, attributes, and visual relation.',
      candidates: collectCandidates({ type: query.type ?? 'any' })
        .slice(0, 5)
        .map(toSummary),
    };
  }

  candidates.sort((a, b) => a.score - b.score);
  if (strict && candidates.length > 1 && candidates[0].score === candidates[1].score) {
    return {
      found: false,
      reason:
        'The description matched more than one element with the same score. Add nearby anchor text or attributes.',
      candidates: candidates.slice(0, 5).map(toSummary),
    };
  }

  candidates[0].element.setAttribute(markerAttribute, markerValue);
  return {
    found: true,
    markerValue,
    summary: toSummary(candidates[0]),
  };

  function resolveCandidates(elementQuery: ElementQuery): Candidate[] {
    if (elementQuery.table) {
      return resolveTableCandidates(elementQuery, elementQuery.table);
    }

    if (elementQuery.within) {
      return resolveWithinCandidates(elementQuery, elementQuery.within);
    }

    if (elementQuery.relation) {
      return resolveRelativeCandidates(
        elementQuery,
        elementQuery.relation.direction,
        elementQuery.relation.anchor,
      );
    }

    return collectCandidates(elementQuery);
  }

  function resolveRelativeCandidates(
    targetQuery: ElementQuery,
    direction: Direction,
    anchorQuery: ElementQuery,
  ): Candidate[] {
    const targetCandidates = collectCandidates({ ...targetQuery, relation: undefined });
    const anchorCandidates = collectCandidates(anchorQuery);
    const relativeCandidates: Candidate[] = [];

    for (const target of targetCandidates) {
      for (const anchor of anchorCandidates) {
        const score = directionalScore(target.rect, anchor.rect, direction);
        if (Number.isFinite(score)) {
          relativeCandidates.push({
            ...target,
            score: target.score + anchor.score + score,
          });
        }
      }
    }

    return relativeCandidates;
  }

  function resolveWithinCandidates(
    targetQuery: ElementQuery,
    containerQuery: ElementQuery,
  ): Candidate[] {
    const targetCandidates = resolveCandidates({ ...targetQuery, within: undefined });
    const containerCandidates = resolveCandidates(containerQuery);
    const containedCandidates: Candidate[] = [];

    for (const target of targetCandidates) {
      for (const container of containerCandidates) {
        if (
          target.element !== container.element &&
          isComposedDescendantOf(target.element, container.element)
        ) {
          containedCandidates.push({
            ...target,
            score: target.score + container.score + containmentScore(target.rect, container.rect),
          });
        }
      }
    }

    return containedCandidates;
  }

  function resolveTableCandidates(targetQuery: ElementQuery, tableQuery: TableQuery): Candidate[] {
    const tableCandidates = collectCandidates(tableQuery.table ?? { type: 'table' });
    const tableMatches: Candidate[] = [];

    for (const tableCandidate of tableCandidates) {
      const table = tableCandidate.element;
      const rows = dataRows(table);
      const headerMap = tableHeaders(table);
      const rowIndexes = matchingRowIndexes(rows, headerMap, tableQuery);

      for (const rowIndex of rowIndexes) {
        const row = rows[rowIndex];
        const searchRoot = tableSearchRoot(row, headerMap, tableQuery);
        if (!searchRoot) {
          continue;
        }

        const searchElements = [searchRoot, ...collectAllElements(searchRoot)].filter(isVisible);
        for (const candidateElement of searchElements) {
          const candidate = toCandidate(candidateElement, {
            ...targetQuery,
            table: undefined,
            relation: undefined,
            within: undefined,
          });
          if (candidate) {
            tableMatches.push({
              ...candidate,
              score: candidate.score + rowIndex,
            });
          }
        }
      }
    }

    return tableMatches;
  }

  function collectCandidates(elementQuery: ElementQuery): Candidate[] {
    return allElements
      .map((element) => toCandidate(element, elementQuery))
      .filter((candidate): candidate is Candidate => candidate !== null);
  }

  function dataRows(table: Element): HTMLTableRowElement[] {
    if (table.tagName.toLowerCase() === 'table') {
      const bodyRows = Array.from(table.querySelectorAll('tbody tr')).filter(
        isVisible,
      ) as HTMLTableRowElement[];
      if (bodyRows.length > 0) {
        return bodyRows;
      }

      return Array.from(table.querySelectorAll('tr')).filter(
        (row) => isVisible(row) && row.querySelectorAll('td').length > 0,
      ) as HTMLTableRowElement[];
    }

    return Array.from(table.querySelectorAll('[role="row"]')).filter(
      (row) => isVisible(row) && row.querySelector('[role="cell"], [role="gridcell"]'),
    ) as HTMLTableRowElement[];
  }

  function tableHeaders(table: Element): Map<string, number> {
    const headers = new Map<string, number>();
    const headerCells =
      table.tagName.toLowerCase() === 'table'
        ? Array.from(table.querySelectorAll('thead th, tr:first-child th'))
        : Array.from(table.querySelectorAll('[role="columnheader"]'));

    headerCells.forEach((cell, index) => {
      const text = normalize(readableText(cell));
      if (text) {
        headers.set(text, index);
      }
    });

    return headers;
  }

  function matchingRowIndexes(
    rows: HTMLTableRowElement[],
    headers: Map<string, number>,
    tableQuery: TableQuery,
  ): number[] {
    if (tableQuery.rowNumber !== undefined) {
      const rowIndex = tableQuery.rowNumber - 1;
      return rowIndex >= 0 && rowIndex < rows.length ? [rowIndex] : [];
    }

    if (!tableQuery.record || tableQuery.record.length === 0) {
      return rows.map((_, index) => index);
    }

    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) =>
        tableQuery.record?.every((criterion) => {
          const columnIndex = columnIndexFor(headers, criterion.column);
          return (
            columnIndex !== undefined &&
            normalize(cellText(row, columnIndex)).includes(normalize(criterion.text))
          );
        }),
      )
      .map(({ index }) => index);
  }

  function tableSearchRoot(
    row: HTMLTableRowElement,
    headers: Map<string, number>,
    tableQuery: TableQuery,
  ): Element | undefined {
    const column = tableQuery.columnNumber ?? tableQuery.columnHeader;
    if (column === undefined) {
      return row;
    }

    const columnIndex = columnIndexFor(headers, column);
    if (columnIndex === undefined) {
      return undefined;
    }

    return rowCells(row)[columnIndex];
  }

  function columnIndexFor(
    headers: Map<string, number>,
    column: string | number,
  ): number | undefined {
    if (typeof column === 'number') {
      return column > 0 ? column - 1 : undefined;
    }

    const normalizedColumn = normalize(column);
    if (headers.has(normalizedColumn)) {
      return headers.get(normalizedColumn);
    }

    for (const [header, index] of headers.entries()) {
      if (header.includes(normalizedColumn) || normalizedColumn.includes(header)) {
        return index;
      }
    }

    return undefined;
  }

  function cellText(row: HTMLTableRowElement, columnIndex: number): string {
    return readableText(rowCells(row)[columnIndex] ?? row);
  }

  function rowCells(row: Element): Element[] {
    const htmlCells = Array.from(row.querySelectorAll(':scope > th, :scope > td'));
    if (htmlCells.length > 0) {
      return htmlCells;
    }

    return Array.from(
      row.querySelectorAll('[role="cell"], [role="gridcell"], [role="columnheader"]'),
    );
  }

  function toCandidate(element: Element, elementQuery: ElementQuery): Candidate | null {
    const natureScore = matchNature(element, elementQuery.type ?? 'any');
    if (!Number.isFinite(natureScore)) {
      return null;
    }

    const attributeScore = matchAttributes(element, elementQuery.attributes ?? {});
    if (!Number.isFinite(attributeScore)) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    return {
      element,
      rect: {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
      },
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute('type'),
      text: readableText(element),
      score: natureScore + attributeScore,
    };
  }

  function matchNature(element: Element, nature: string): number {
    const tagName = element.tagName.toLowerCase();
    const role = attr(element, 'role');
    const inputType = attr(element, 'type')?.toLowerCase() ?? 'text';

    switch (nature) {
      case 'any':
      case 'element':
        return 100;
      case 'button':
        return tagName === 'button' ||
          role === 'button' ||
          inputType === 'button' ||
          inputType === 'submit'
          ? 0
          : Infinity;
      case 'card':
        return isCard(element, tagName, role) ? 0 : Infinity;
      case 'checkbox':
        return (tagName === 'input' && inputType === 'checkbox') || role === 'checkbox'
          ? 0
          : Infinity;
      case 'dropdown':
      case 'select':
        return tagName === 'select' || role === 'combobox' || role === 'listbox' ? 0 : Infinity;
      case 'image':
        return tagName === 'img' || role === 'img' ? 0 : Infinity;
      case 'input':
        return tagName === 'input' ? 0 : Infinity;
      case 'label':
        return tagName === 'label' || role === 'label' ? 0 : Infinity;
      case 'link':
        return tagName === 'a' || role === 'link' ? 0 : Infinity;
      case 'multiselect':
        return isMultiSelect(element) ? 0 : Infinity;
      case 'modal':
        return tagName === 'dialog' || role === 'dialog' || attr(element, 'aria-modal') === 'true'
          ? 0
          : Infinity;
      case 'paragraph':
        return tagName === 'p' ? 0 : Infinity;
      case 'radio':
        return (tagName === 'input' && inputType === 'radio') || role === 'radio' ? 0 : Infinity;
      case 'table':
        return tagName === 'table' || role === 'table' || role === 'grid' ? 0 : Infinity;
      case 'span':
        return tagName === 'span' ? 0 : Infinity;
      case 'text':
        return isTextElement(element, tagName) ? 0 : Infinity;
      case 'textarea':
        return tagName === 'textarea' ? 0 : Infinity;
      case 'textbox':
        return isTextbox(element, tagName, inputType, role) ? 0 : Infinity;
      case 'title':
        return /^h[1-6]$/.test(tagName) ||
          role === 'heading' ||
          hasClass(element, 'title') ||
          attr(element, 'data-test') === 'title'
          ? 0
          : Infinity;
      default:
        return tagName === nature.toLowerCase() || role === nature.toLowerCase() ? 0 : Infinity;
    }
  }

  function isTextbox(
    element: Element,
    tagName: string,
    inputType: string,
    role: string | null,
  ): boolean {
    const textInputTypes = new Set([
      'date',
      'datetime-local',
      'email',
      'month',
      'number',
      'password',
      'search',
      'tel',
      'text',
      'time',
      'url',
      'week',
    ]);

    return (
      tagName === 'textarea' ||
      role === 'textbox' ||
      element.getAttribute('contenteditable') === 'true' ||
      (tagName === 'input' && textInputTypes.has(inputType))
    );
  }

  function isMultiSelect(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    const role = attr(element, 'role');
    if (
      (tagName === 'select' && (element as HTMLSelectElement).multiple) ||
      role === 'listbox' ||
      role === 'group'
    ) {
      return true;
    }

    return (
      !element.querySelector('label') &&
      element.querySelectorAll('button, [role="option"], [role="checkbox"]').length > 1
    );
  }

  function isCard(element: Element, tagName: string, role: string | null): boolean {
    const cardHints = [
      role,
      attr(element, 'class'),
      attr(element, 'id'),
      attr(element, 'data-test'),
      attr(element, 'data-testid'),
      attr(element, 'data-component'),
      attr(element, 'data-card'),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return tagName === 'article' || role === 'article' || /\b(card|tile|panel)\b/.test(cardHints);
  }

  function isTextElement(element: Element, tagName: string): boolean {
    const textTags = new Set(['p', 'span', 'div', 'strong', 'em', 'small', 'li', 'dt', 'dd']);
    return textTags.has(tagName) && normalize(readableText(element)).length > 0;
  }

  function matchAttributes(element: Element, attributes: Record<string, string>): number {
    let score = 0;

    for (const [name, expectedValue] of Object.entries(attributes)) {
      const actualValue = attributeValue(element, name);
      if (!actualValue) {
        return Infinity;
      }

      const actual = normalize(actualValue);
      const expected = normalize(expectedValue);
      if (actual === expected) {
        score += 0;
      } else if (actual.includes(expected)) {
        score += 10;
      } else {
        return Infinity;
      }
    }

    return score;
  }

  function attributeValue(element: Element, name: string): string {
    const normalizedName = name.toLowerCase();

    if (normalizedName === 'text') {
      return readableText(element);
    }

    if (normalizedName === 'label') {
      return associatedLabelText(element);
    }

    return attr(element, normalizedName) ?? '';
  }

  function associatedLabelText(element: Element): string {
    const id = attr(element, 'id');
    const directLabels =
      'labels' in element ? Array.from((element as HTMLInputElement).labels ?? []) : [];
    const explicitLabels = id
      ? Array.from(document.querySelectorAll(`label[for="${cssEscape(id)}"]`))
      : [];
    const ariaLabelledBy = (attr(element, 'aria-labelledby') ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((labelId) => document.getElementById(labelId)?.textContent ?? '');

    return [...directLabels, ...explicitLabels]
      .map((label) => label.textContent ?? '')
      .concat(ariaLabelledBy)
      .join(' ');
  }

  function directionalScore(target: Rect, anchor: Rect, direction: Direction): number {
    const normalizedDirection =
      direction === 'above' ? 'up' : direction === 'below' ? 'down' : direction;
    const verticalOverlap = overlap(target.top, target.bottom, anchor.top, anchor.bottom);
    const horizontalOverlap = overlap(target.left, target.right, anchor.left, anchor.right);
    const horizontalOffset = Math.abs(target.centerX - anchor.centerX);
    const verticalOffset = Math.abs(target.centerY - anchor.centerY);

    switch (normalizedDirection) {
      case 'right':
        if (target.centerX <= anchor.centerX) return Infinity;
        return (
          Math.max(0, target.left - anchor.right) + verticalOffset * 2 + (verticalOverlap ? 0 : 500)
        );
      case 'left':
        if (target.centerX >= anchor.centerX) return Infinity;
        return (
          Math.max(0, anchor.left - target.right) + verticalOffset * 2 + (verticalOverlap ? 0 : 500)
        );
      case 'down':
        if (target.centerY <= anchor.centerY) return Infinity;
        return (
          Math.max(0, target.top - anchor.bottom) +
          horizontalOffset * 2 +
          (horizontalOverlap ? 0 : 500)
        );
      case 'up':
        if (target.centerY >= anchor.centerY) return Infinity;
        return (
          Math.max(0, anchor.top - target.bottom) +
          horizontalOffset * 2 +
          (horizontalOverlap ? 0 : 500)
        );
      default:
        return Infinity;
    }
  }

  function containmentScore(target: Rect, container: Rect): number {
    return (
      Math.abs(target.centerX - container.centerX) * 0.01 +
      Math.abs(target.centerY - container.centerY) * 0.01 +
      Math.max(0, target.width * target.height) * 0.00001
    );
  }

  function collectAllElements(root: Document | ShadowRoot | Element): Element[] {
    const elements = Array.from(root.querySelectorAll('*'));
    const composedElements: Element[] = [];

    for (const element of elements) {
      composedElements.push(element);
      const shadowRoot = (element as HTMLElement).shadowRoot;
      if (shadowRoot) {
        composedElements.push(...collectAllElements(shadowRoot));
      }
    }

    return composedElements;
  }

  function isComposedDescendantOf(element: Element, ancestor: Element): boolean {
    let current: Node | null = element;

    while (current) {
      if (current === ancestor) {
        return true;
      }

      const parent: Node | null = current.parentNode;
      if (parent) {
        current = parent;
        continue;
      }

      const root = current.getRootNode();
      current = root instanceof ShadowRoot ? root.host : null;
    }

    return false;
  }

  function isVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0'
    );
  }

  function readableText(element: Element): string {
    const textContent = (element as HTMLElement).innerText ?? element.textContent ?? '';
    const values = [
      textContent,
      attr(element, 'aria-label'),
      attr(element, 'placeholder'),
      attr(element, 'alt'),
      'value' in element ? String((element as HTMLInputElement).value ?? '') : '',
    ];

    return values.filter(Boolean).join(' ');
  }

  function toSummary(candidate: Candidate): CandidateSummary {
    return {
      tag: candidate.tag,
      type: candidate.type,
      text: normalize(candidate.text).slice(0, 120),
      score: Math.round(candidate.score * 100) / 100,
    };
  }

  function overlap(startA: number, endA: number, startB: number, endB: number): boolean {
    return Math.max(startA, startB) <= Math.min(endA, endB);
  }

  function normalize(value: string): string {
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function attr(element: Element, name: string): string | null {
    return element.getAttribute(name);
  }

  function hasClass(element: Element, className: string): boolean {
    return element.classList.contains(className);
  }

  function cssEscape(value: string): string {
    if ('CSS' in window && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }

    return value.replace(/["\\]/g, '\\$&');
  }
}

function tablePageSignature(): string {
  const visibleTableText = Array.from(
    document.querySelectorAll('table, [role="table"], [role="grid"]'),
  )
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0'
      );
    })
    .map((element) => (element as HTMLElement).innerText ?? element.textContent ?? '')
    .join('|');

  return visibleTableText.replace(/\s+/g, ' ').trim().toLowerCase();
}

function currentTablePageNumber(): number | undefined {
  const pageControls = visiblePaginationControls();
  const selectedControl = pageControls.find((control) => {
    const ariaCurrent = control.getAttribute('aria-current');
    return (
      ariaCurrent === 'page' ||
      control.getAttribute('aria-selected') === 'true' ||
      control.classList.contains('active') ||
      control.classList.contains('selected') ||
      control.getAttribute('data-active') === 'true'
    );
  });

  const selectedPage = selectedControl ? Number(controlText(selectedControl)) : Number.NaN;
  return Number.isFinite(selectedPage) ? selectedPage : undefined;

  function visiblePaginationControls(): Element[] {
    return Array.from(document.querySelectorAll('button, a, [role="button"]')).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0'
      );
    });
  }

  function controlText(element: Element): string {
    return ((element as HTMLElement).innerText || element.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

function clickTablePageControl(args: { type: 'next' | 'page'; pageNumber?: number }): boolean {
  const controls = visiblePaginationControls().filter((control) => !isDisabledControl(control));
  const target =
    args.type === 'page'
      ? controls.find((control) => controlText(control) === String(args.pageNumber))
      : controls.find((control) => {
          const text = controlText(control).toLowerCase();
          const label = [
            control.getAttribute('aria-label'),
            control.getAttribute('title'),
            control.getAttribute('data-test'),
            control.getAttribute('id'),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return (
            text === 'next' ||
            text === '>' ||
            text === '›' ||
            text === '»' ||
            /\bnext\b/.test(label)
          );
        });

  if (!target) {
    return false;
  }

  (target as HTMLElement).click();
  return true;

  function visiblePaginationControls(): Element[] {
    return Array.from(document.querySelectorAll('button, a, [role="button"]')).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0'
      );
    });
  }

  function controlText(element: Element): string {
    return ((element as HTMLElement).innerText || element.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isDisabledControl(element: Element): boolean {
    return (
      element.hasAttribute('disabled') ||
      element.getAttribute('aria-disabled') === 'true' ||
      element.classList.contains('disabled')
    );
  }
}
