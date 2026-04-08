import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRSSImageAnalysisText,
  getDefaultImageSourcePolicy,
  policyAllowsArticleFallback,
  type RSSImageSelectionArticle,
} from '../services/rss-image-selection.service';

function makeArticle(input: Partial<RSSImageSelectionArticle> & Pick<RSSImageSelectionArticle, 'title'>): RSSImageSelectionArticle {
  return {
    title: input.title,
    description: input.description,
    contentHtml: input.contentHtml,
    author: input.author,
    generatedCaption: input.generatedCaption,
    fallbackImages: input.fallbackImages || [],
  };
}

test('RSS Phase 2: image analysis text includes generated caption and cleaned body context', () => {
  const article = makeArticle({
    title: "First trailer released for 'The Matrix Resurrections'",
    description: 'Warner Bros. has released the first trailer.',
    generatedCaption: "First trailer released for 'The Matrix Resurrections' 🎬",
    author: 'Deadline',
    contentHtml: `<p>The article confirms the trailer for <strong>'The Matrix Resurrections'</strong>.</p>
      <p>Warner Bros. is launching the film in theaters.</p>`,
  });

  const analysisText = buildRSSImageAnalysisText(article);

  assert.match(analysisText, /Generated Caption: First trailer released for 'The Matrix Resurrections'/);
  assert.match(analysisText, /Article Body: The article confirms the trailer for 'The Matrix Resurrections'\./);
  assert.doesNotMatch(analysisText, /<strong>/);
});

test('RSS Phase 2: TMDB-enabled policy defaults to tmdb_preferred without branded fallback', () => {
  const policy = getDefaultImageSourcePolicy({
    tmdbEnabled: true,
    serperEnabled: true,
  });

  assert.equal(policy.mode, 'tmdb_preferred');
  assert.equal(policy.allow_article_fallback, true);
  assert.equal(policy.allow_article_if_tmdb_missing, true);
  assert.equal(policy.allow_article_if_low_confidence_match, false);
  assert.equal(policy.allow_branded_fallback, false);
  assert.equal(policyAllowsArticleFallback(policy), true);
});

test('RSS Phase 2: non-TMDB default remains mixed but branded fallback stays disabled', () => {
  const policy = getDefaultImageSourcePolicy({
    tmdbEnabled: false,
    serperEnabled: true,
  });

  assert.equal(policy.mode, 'mixed');
  assert.equal(policy.allow_article_fallback, true);
  assert.equal(policy.allow_article_if_tmdb_missing, true);
  assert.equal(policy.allow_article_if_low_confidence_match, true);
  assert.equal(policy.allow_branded_fallback, false);
});

test('RSS Phase 2: article fallback helper rejects strict mode', () => {
  assert.equal(policyAllowsArticleFallback({
    mode: 'tmdb_strict',
    allow_article_fallback: true,
    allow_article_if_tmdb_missing: true,
    allow_article_if_low_confidence_match: true,
    allow_branded_fallback: false,
  }), false);
});
