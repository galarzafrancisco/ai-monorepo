/** What a search result opens. */
export enum SearchResultType {
  TASK = 'task',
  CONTEXT_BLOCK = 'context_block',
  /** Found through its state memory: the block where the thread keeps its goal and progress. */
  THREAD = 'thread',
  TOOL = 'tool',
  AGENT = 'agent',
  PROJECT = 'project',
}

/** How a result was found. */
export enum SearchStrategy {
  /** Full-text match on the title, tags or text. */
  KEYWORD = 'keyword',
  /** The title looks like the query, allowing for typos and partial words. */
  FUZZY_TITLE = 'fuzzy_title',
  /** A passage means something close to the query. */
  SEMANTIC = 'semantic',
}

/** Which part of the item matched best, and so what the excerpt shows. */
export enum SearchMatchField {
  /** The title matched; the excerpt is the start of the item. */
  TITLE = 'title',
  /** A passage of the item's own text matched. */
  CONTENT = 'content',
  /** A comment on the task matched. */
  COMMENT = 'comment',
}
