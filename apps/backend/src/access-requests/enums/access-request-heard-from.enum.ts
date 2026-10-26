/**
 * Answer to "Where did you hear about Taico?" on the public /join form.
 * Stored as these stable machine-readable values; labels live in the UI.
 * Adding a value is safe (column is varchar). Never rename or reuse a value:
 * existing rows keep it.
 */
export enum AccessRequestHeardFrom {
  X = 'x',
  LINKEDIN = 'linkedin',
  WORD_OF_MOUTH = 'word_of_mouth',
  CONFERENCE_TSHIRT = 'conference_tshirt',
  OTHER = 'other',
}
