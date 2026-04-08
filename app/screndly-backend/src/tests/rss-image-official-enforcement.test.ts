import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __rssImageSelectionTestUtils,
  type RSSImageSelectionArticle,
} from '../services/rss-image-selection.service';

const { validateImageCandidate, guessPrimarySubject } = __rssImageSelectionTestUtils;

function buildAnalysis(article: RSSImageSelectionArticle) {
  return guessPrimarySubject(article);
}

test('rejects fan art from untrusted domains', () => {
  const analysis = buildAnalysis({
    title: "'House of the Dragon' Season 3 begins filming in the UK",
    description: "Production is underway on the HBO fantasy series.",
  });

  const result = validateImageCandidate({
    title: 'House of the Dragon fan art wallpaper by DeviantArt',
    imageUrl: 'https://images.deviantart.com/house-of-the-dragon-fanart.jpg',
    imageWidth: 1920,
    imageHeight: 1080,
    domain: 'deviantart.com',
    link: 'https://deviantart.com/example',
    source: 'openai_web_search',
  }, analysis);

  assert.equal(result.approved, false);
  assert.match(result.reason || '', /untrusted|fan|illustration/i);
});

test('rejects AI-generated imagery even when entity text matches', () => {
  const analysis = buildAnalysis({
    title: "Ryan Gosling joins Shawn Levy's upcoming Star Wars film",
    description: 'Ryan Gosling is attached to star in a new Star Wars project directed by Shawn Levy.',
  });

  const result = validateImageCandidate({
    title: 'Ryan Gosling AI generated Star Wars concept portrait',
    imageUrl: 'https://example.com/ryan-gosling-ai.jpg',
    imageWidth: 1600,
    imageHeight: 2000,
    domain: 'variety.com',
    link: 'https://variety.com/fake',
    source: 'openai_web_search',
  }, analysis);

  assert.equal(result.approved, false);
  assert.match(result.reason || '', /ai-generated/i);
});

test('rejects franchise-mismatched imagery for a specific show subject', () => {
  const analysis = buildAnalysis({
    title: "'House of the Dragon' Season 3 begins filming in the UK",
    description: 'The HBO series is now in production.',
  });

  const result = validateImageCandidate({
    title: 'Game of Thrones Season 1 official still',
    imageUrl: 'https://www.hbo.com/game-of-thrones/still.jpg',
    imageWidth: 1920,
    imageHeight: 1080,
    domain: 'hbo.com',
    link: 'https://www.hbo.com/game-of-thrones',
    source: 'serper',
  }, analysis);

  assert.equal(result.approved, false);
  assert.match(result.reason || '', /subject/i);
});

test('allows official animated promotional art for animated subjects', () => {
  const analysis = buildAnalysis({
    title: "First trailer released for Pixar's 'Toy Story 5'",
    description: 'Disney and Pixar have revealed the first trailer for the animated sequel.',
  });

  const result = validateImageCandidate({
    title: 'Toy Story 5 official promo art by Disney and Pixar',
    imageUrl: 'https://www.pixar.com/toy-story-5-official-art.jpg',
    imageWidth: 1800,
    imageHeight: 1012,
    domain: 'pixar.com',
    link: 'https://www.pixar.com/toy-story-5',
    source: 'openai_web_search',
  }, analysis);

  assert.equal(result.approved, true);
});

test('rejects illustrative art for non-animated live-action stories', () => {
  const analysis = buildAnalysis({
    title: "'The Last of Us' renewed for Season 3 by HBO",
    description: 'The live-action drama will return for another season.',
  });

  const result = validateImageCandidate({
    title: 'The Last of Us digital painting concept art official look',
    imageUrl: 'https://www.hbo.com/the-last-of-us-concept-art.jpg',
    imageWidth: 1800,
    imageHeight: 1012,
    domain: 'hbo.com',
    link: 'https://www.hbo.com/the-last-of-us',
    source: 'serper',
  }, analysis);

  assert.equal(result.approved, false);
  assert.match(result.reason || '', /illustration/i);
});

