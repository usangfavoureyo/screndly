import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRSSCaptionExtraction,
  buildRSSFallbackCaption,
  validateGeneratedRSSCaption,
  type RSSContext,
  type RSSEventType,
} from '../services/ai.service';

type CaptionCase = {
  name: string;
  context: RSSContext;
  expectedEvent: RSSEventType;
  expectedCaptionContains: string[];
  expectedCaptionExcludes?: string[];
  expectedPrimaryOneOf?: string[];
  expectedMediaTitle?: string;
  expectedQuote?: string;
  spoilerLevelOneOf?: Array<'none' | 'low' | 'medium' | 'high'>;
};

function makeContext(input: Partial<RSSContext> & Pick<RSSContext, 'articleTitle'>): RSSContext {
  return {
    articleTitle: input.articleTitle,
    feedName: input.feedName || 'Variety',
    summary: input.summary || '',
    articleBodyClean: input.articleBodyClean || '',
    author: input.author,
    platform: 'X',
    allowedEntities: input.allowedEntities || [],
    selectedVisuals: input.selectedVisuals || [],
    tone: input.tone,
  };
}

function containsAny(value: string, options: string[]): boolean {
  const normalized = value.toLowerCase();
  return options.some((option) => normalized.includes(option.toLowerCase()));
}

const cases: CaptionCase[] = [
  {
    name: 'resolves vague reveal subject from body',
    context: makeContext({
      articleTitle: 'Marvel finally confirms what happened to a missing character after seven years',
      summary: 'The latest Daredevil story finally addresses a long-running mystery.',
      articleBodyClean: "The article identifies Bullseye and confirms the answer arrives in 'Daredevil: Born Again' as part of the MCU story.",
      allowedEntities: ['Bullseye', 'Daredevil: Born Again', 'MCU'],
    }),
    expectedEvent: 'reveal',
    expectedCaptionContains: ['Bullseye', "'Daredevil: Born Again'"],
    expectedCaptionExcludes: ['missing character', 'Marvel character'],
    expectedPrimaryOneOf: ['Bullseye', 'Daredevil: Born Again'],
    expectedMediaTitle: 'Daredevil: Born Again',
    spoilerLevelOneOf: ['low'],
  },
  {
    name: 'handles casting clearly',
    context: makeContext({
      articleTitle: 'Jodie Comer joins new monster film from A24',
      summary: "Jodie Comer is attached to star in 'The End of the Deep'.",
      articleBodyClean: "A24 is moving forward with 'The End of the Deep' and Jodie Comer will lead the cast.",
      allowedEntities: ['Jodie Comer', 'The End of the Deep', 'A24'],
    }),
    expectedEvent: 'casting',
    expectedCaptionContains: ['Jodie Comer', "'The End of the Deep'"],
    expectedPrimaryOneOf: ['Jodie Comer'],
    expectedMediaTitle: 'The End of the Deep',
  },
  {
    name: 'keeps renewal direct and factual',
    context: makeContext({
      articleTitle: "Prime Video renews 'Fallout' for Season 3",
      summary: 'The series will return for a third season.',
      articleBodyClean: "Prime Video has officially renewed 'Fallout' for Season 3.",
      allowedEntities: ['Prime Video', 'Fallout'],
    }),
    expectedEvent: 'renewal',
    expectedCaptionContains: ["'Fallout'", 'Season 3'],
    expectedPrimaryOneOf: ['Fallout'],
    expectedMediaTitle: 'Fallout',
  },
  {
    name: 'names canceled series from body',
    context: makeContext({
      articleTitle: 'Apple TV+ cancels sci-fi drama after one season',
      summary: 'The streamer has ended the drama.',
      articleBodyClean: "Apple TV+ has canceled 'Constellation' after one season.",
      allowedEntities: ['Apple TV+', 'Constellation'],
    }),
    expectedEvent: 'cancellation',
    expectedCaptionContains: ["'Constellation'"],
    expectedPrimaryOneOf: ['Constellation'],
    expectedMediaTitle: 'Constellation',
  },
  {
    name: 'uses title for development stories',
    context: makeContext({
      articleTitle: "New live-action 'Ben 10' series in development",
      summary: 'The franchise is getting a live-action adaptation.',
      articleBodyClean: "A live-action 'Ben 10' series is now in development.",
      allowedEntities: ['Ben 10'],
    }),
    expectedEvent: 'development',
    expectedCaptionContains: ["'Ben 10'"],
    expectedPrimaryOneOf: ['Ben 10'],
    expectedMediaTitle: 'Ben 10',
  },
  {
    name: 'turns vague major update into production status',
    context: makeContext({
      articleTitle: "'House of the Dragon' Season 3 gets major update",
      summary: 'Production has started on the new season.',
      articleBodyClean: "Production is now underway on 'House of the Dragon' Season 3.",
      allowedEntities: ['House of the Dragon'],
    }),
    expectedEvent: 'in_production',
    expectedCaptionContains: ['production', "'House of the Dragon'"],
    expectedPrimaryOneOf: ['House of the Dragon'],
    expectedMediaTitle: 'House of the Dragon',
  },
  {
    name: 'handles trailer stories',
    context: makeContext({
      articleTitle: "First trailer released for 'Mortal Kombat 2'",
      summary: 'Warner Bros. has debuted the first trailer.',
      articleBodyClean: "The first trailer for 'Mortal Kombat 2' is now online.",
      allowedEntities: ['Mortal Kombat 2'],
    }),
    expectedEvent: 'trailer',
    expectedCaptionContains: ['trailer', "'Mortal Kombat 2'"],
    expectedPrimaryOneOf: ['Mortal Kombat 2'],
    expectedMediaTitle: 'Mortal Kombat 2',
  },
  {
    name: 'states release timing cleanly',
    context: makeContext({
      articleTitle: "'The Black Phone 2' moves to October 2026",
      summary: 'The sequel has a new release date.',
      articleBodyClean: "'The Black Phone 2' has moved to October 2026.",
      allowedEntities: ['The Black Phone 2'],
    }),
    expectedEvent: 'release_date',
    expectedCaptionContains: ["'The Black Phone 2'", 'October 2026'],
    expectedPrimaryOneOf: ['The Black Phone 2'],
    expectedMediaTitle: 'The Black Phone 2',
  },
  {
    name: 'preserves real interview quote',
    context: makeContext({
      articleTitle: 'Jenna Ortega says fame changed how she sees acting',
      summary: 'Jenna Ortega opened up in a new interview.',
      articleBodyClean: 'Jenna Ortega said "It changed how I think about acting and privacy" during the interview.',
      allowedEntities: ['Jenna Ortega'],
    }),
    expectedEvent: 'interview_quote',
    expectedCaptionContains: ['Jenna Ortega', '"It changed how I think about acting and privacy"'],
    expectedPrimaryOneOf: ['Jenna Ortega'],
    expectedQuote: 'It changed how I think about acting and privacy',
  },
  {
    name: 'handles first look stories',
    context: makeContext({
      articleTitle: "First look at 'Clayface' revealed",
      summary: 'DC shared new images from the film.',
      articleBodyClean: "New images from 'Clayface' have been released.",
      allowedEntities: ['Clayface', 'DC'],
    }),
    expectedEvent: 'first_look',
    expectedCaptionContains: ['images', "'Clayface'"],
    expectedPrimaryOneOf: ['Clayface'],
    expectedMediaTitle: 'Clayface',
  },
  {
    name: 'summarizes box office milestone',
    context: makeContext({
      articleTitle: "'Inside Out 2' reaches another global milestone",
      summary: 'The Pixar sequel hit another box office mark.',
      articleBodyClean: "'Inside Out 2' has reached another global box office milestone.",
      allowedEntities: ['Inside Out 2'],
    }),
    expectedEvent: 'box_office',
    expectedCaptionContains: ["'Inside Out 2'", 'box office milestone'],
    expectedPrimaryOneOf: ['Inside Out 2'],
    expectedMediaTitle: 'Inside Out 2',
  },
  {
    name: 'softens spoiler-sensitive reveal',
    context: makeContext({
      articleTitle: 'Major MCU return explained in latest episode',
      summary: 'The episode clarifies a major return.',
      articleBodyClean: "The latest MCU episode explains Bullseye's return in the finale.",
      allowedEntities: ['Bullseye', 'MCU'],
    }),
    expectedEvent: 'reveal',
    expectedCaptionContains: ['Bullseye'],
    expectedCaptionExcludes: ['finale', 'survives', 'dies'],
    expectedPrimaryOneOf: ['Bullseye'],
    spoilerLevelOneOf: ['medium', 'high'],
  },
  {
    name: 'keeps reflection factual',
    context: makeContext({
      articleTitle: 'Andrew Garfield reflects on almost leaving acting',
      summary: 'The actor looked back on his career.',
      articleBodyClean: 'Andrew Garfield reflected on the period when he nearly stepped away from acting.',
      allowedEntities: ['Andrew Garfield'],
    }),
    expectedEvent: 'reflection',
    expectedCaptionContains: ['Andrew Garfield'],
    expectedPrimaryOneOf: ['Andrew Garfield'],
  },
  {
    name: 'resolves return story from body',
    context: makeContext({
      articleTitle: 'Fan-favorite actor returning for new season of fantasy hit',
      summary: 'The article names the actor and role.',
      articleBodyClean: "Tom Glynn-Carney is returning as Aegon in 'House of the Dragon'.",
      allowedEntities: ['Tom Glynn-Carney', 'Aegon', 'House of the Dragon'],
    }),
    expectedEvent: 'return',
    expectedCaptionContains: ['Tom Glynn-Carney', "'House of the Dragon'"],
    expectedPrimaryOneOf: ['Tom Glynn-Carney', 'Aegon'],
    expectedMediaTitle: 'House of the Dragon',
  },
  {
    name: 'names adaptation source material',
    context: makeContext({
      articleTitle: 'Popular game franchise getting movie adaptation',
      summary: 'The adaptation now has a title.',
      articleBodyClean: "'Elden Ring' is getting a movie adaptation.",
      allowedEntities: ['Elden Ring'],
    }),
    expectedEvent: 'development',
    expectedCaptionContains: ["'Elden Ring'"],
    expectedCaptionExcludes: ['popular game franchise'],
    expectedPrimaryOneOf: ['Elden Ring'],
    expectedMediaTitle: 'Elden Ring',
  },
];

for (const scenario of cases) {
  test(`RSS Phase 1: ${scenario.name}`, () => {
    const extraction = buildRSSCaptionExtraction(scenario.context);
    const fallbackCaption = buildRSSFallbackCaption(extraction);

    assert.equal(extraction.event_type, scenario.expectedEvent);

    if (scenario.expectedPrimaryOneOf) {
      assert.ok(
        scenario.expectedPrimaryOneOf.includes(extraction.primary_subject || ''),
        `Expected primary subject to be one of ${scenario.expectedPrimaryOneOf.join(', ')}, got ${extraction.primary_subject}`,
      );
    }

    if (scenario.expectedMediaTitle) {
      assert.equal(extraction.media_title, scenario.expectedMediaTitle);
    }

    if (scenario.expectedQuote) {
      assert.equal(extraction.direct_quote, scenario.expectedQuote);
      assert.ok(extraction.quote_speaker, 'Expected quote speaker to be resolved.');
    }

    if (scenario.spoilerLevelOneOf) {
      assert.ok(
        scenario.spoilerLevelOneOf.includes(extraction.spoiler_level || 'none'),
        `Expected spoiler level to be one of ${scenario.spoilerLevelOneOf.join(', ')}, got ${extraction.spoiler_level}`,
      );
    }

    for (const snippet of scenario.expectedCaptionContains) {
      assert.ok(
        fallbackCaption.includes(snippet),
        `Expected fallback caption to include "${snippet}". Received: ${fallbackCaption}`,
      );
    }

    for (const snippet of scenario.expectedCaptionExcludes || []) {
      assert.ok(
        !fallbackCaption.toLowerCase().includes(snippet.toLowerCase()),
        `Expected fallback caption to exclude "${snippet}". Received: ${fallbackCaption}`,
      );
    }
  });
}

test('RSS Phase 1 validation rejects vague placeholder caption when specific subject exists', () => {
  const context = makeContext({
    articleTitle: 'Marvel finally confirms what happened to a missing character after seven years',
    summary: 'The latest story identifies Bullseye.',
    articleBodyClean: "Bullseye is the specific subject in 'Daredevil: Born Again'.",
    allowedEntities: ['Bullseye', 'Daredevil: Born Again'],
  });

  const extraction = buildRSSCaptionExtraction(context);
  const result = validateGeneratedRSSCaption(
    'The MCU has confirmed what happened to a missing Marvel character.',
    context,
    extraction,
  );

  assert.equal(result.isValid, false);
  assert.ok(result.reasons.includes('vague_subject'));
});

test('RSS Phase 1 validation rejects editorial drift and quote mutation', () => {
  const context = makeContext({
    articleTitle: 'Jenna Ortega says fame changed how she sees acting',
    summary: 'The actor spoke candidly.',
    articleBodyClean: 'Jenna Ortega said "It changed how I think about acting and privacy" in the interview.',
    allowedEntities: ['Jenna Ortega'],
  });

  const extraction = buildRSSCaptionExtraction(context);
  const result = validateGeneratedRSSCaption(
    'Jenna Ortega has a huge update for fans.\n\n"It changed everything about acting for me"',
    context,
    extraction,
  );

  assert.equal(result.isValid, false);
  assert.ok(result.reasons.includes('editorial_drift'));
  assert.ok(result.reasons.includes('quote_integrity'));
});
