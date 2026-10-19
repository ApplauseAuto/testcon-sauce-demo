export type Direction = 'left' | 'before' | 'right' | 'after' | 'up' | 'down' | 'above' | 'below';

export type ElementNature =
  | 'any'
  | 'element'
  | 'button'
  | 'card'
  | 'checkbox'
  | 'dropdown'
  | 'image'
  | 'input'
  | 'label'
  | 'link'
  | 'multiselect'
  | 'modal'
  | 'paragraph'
  | 'radio'
  | 'select'
  | 'span'
  | 'table'
  | 'text'
  | 'textarea'
  | 'textbox'
  | 'title';

export type ElementAttributes = Record<string, string>;

export interface TableRecordCriterion {
  column: string | number;
  text: string;
}

export interface TableQuery {
  rowNumber?: number;
  columnNumber?: number;
  columnHeader?: string;
  record?: TableRecordCriterion[];
  pageNumber?: number;
  table?: ElementQuery;
}

export interface RelationQuery {
  direction: Direction;
  anchor: ElementQuery;
}

export interface ElementQuery {
  type?: ElementNature | string;
  attributes?: ElementAttributes;
  relation?: RelationQuery;
  within?: ElementQuery;
  table?: TableQuery;
}

export interface ResolveOptions {
  timeout?: number;
  strict?: boolean;
}

export interface VisualLocatorConfig {
  strict?: boolean;
  timeout?: number;
  markerAttribute?: string;
}
