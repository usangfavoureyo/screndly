const WORD_CHARACTER_PATTERN = /[A-Za-z0-9]/;

export function stripDecorativeSingleQuotes(value: string): string {
  if (!value) {
    return '';
  }

  return value
    .replace(/[\u2018\u2019']/g, (quote, offset, text) => {
      const previous = text[offset - 1] || '';
      const next = text[offset + 1] || '';

      // Keep apostrophes that are part of a word, such as "it's" or "Lasso's".
      if (WORD_CHARACTER_PATTERN.test(previous) && WORD_CHARACTER_PATTERN.test(next)) {
        return quote;
      }

      return '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

