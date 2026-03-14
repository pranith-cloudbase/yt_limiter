import { ScoreResult, TopicConfig, VideoMetadata } from './types.js';
import { diceCoefficient, normalizeText, tokenize, unique } from './text.js';

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'into',
  'only',
  'learn',
  'video',
  'course'
]);

const CONCEPT_EXPANSIONS: Record<string, string[]> = {
  'linear algebra': ['matrix', 'matrices', 'vector', 'vectors', 'eigenvalue', 'eigenvector', 'determinant', 'rank', 'span', 'basis', 'orthogonal', 'svd', 'pca'],
  math: ['equation', 'proof', 'problem solving', 'calculation'],
  physics: ['force', 'motion', 'acceleration', 'dynamics', 'mechanics'],
  chemistry: ['molecule', 'reaction', 'stoichiometry', 'equilibrium']
};

function makeTopicCorpus(topic: TopicConfig, syllabusKeywords: string[]): string[] {
  const base = [topic.subject, topic.subtopic, topic.goal || '', ...syllabusKeywords];
  return unique(base.filter(Boolean).map((value) => normalizeText(value)));
}

function stemToken(token: string): string {
  return token.replace(/(ing|ed|es|s)$/g, '');
}

function expandedTopicTokens(topic: TopicConfig, syllabusKeywords: string[]): string[] {
  const normalizedSubject = normalizeText(topic.subject);
  const normalizedSubtopic = normalizeText(topic.subtopic);
  const all = [
    ...tokenize(`${topic.subject} ${topic.subtopic} ${topic.goal || ''}`),
    ...syllabusKeywords.flatMap((item) => tokenize(item))
  ];

  const expansion = [
    ...(CONCEPT_EXPANSIONS[normalizedSubtopic] || []),
    ...(CONCEPT_EXPANSIONS[normalizedSubject] || [])
  ];
  const result = [...all, ...expansion.flatMap((item) => tokenize(item))].filter((token) => !STOPWORDS.has(token));
  return unique(result.flatMap((token) => [token, stemToken(token)]).filter((token) => token.length > 2));
}

function computeKeywordMatches(videoTokens: string[], keywordTokens: string[]): string[] {
  const stems = videoTokens.map(stemToken);
  const matches: string[] = [];
  for (const token of keywordTokens) {
    if (token.length < 3 || STOPWORDS.has(token)) {
      continue;
    }
    const tokenStem = stemToken(token);
    const fuzzy = videoTokens.some((videoToken) => {
      if (videoToken === token || stemToken(videoToken) === tokenStem) {
        return true;
      }
      if (videoToken.startsWith(tokenStem) || tokenStem.startsWith(stemToken(videoToken))) {
        return tokenStem.length > 4;
      }
      return diceCoefficient(videoToken, token) > 0.82;
    });

    if (fuzzy || stems.includes(tokenStem)) {
      matches.push(token);
    }
  }
  return unique(matches);
}

function cosineSimilarity(aTokens: string[], bTokens: string[]): number {
  const aCounts = new Map<string, number>();
  const bCounts = new Map<string, number>();
  const allTokens = unique([...aTokens, ...bTokens]);

  aTokens.forEach((token) => aCounts.set(token, (aCounts.get(token) || 0) + 1));
  bTokens.forEach((token) => bCounts.set(token, (bCounts.get(token) || 0) + 1));

  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (const token of allTokens) {
    const a = aCounts.get(token) || 0;
    const b = bCounts.get(token) || 0;
    dot += a * b;
    aNorm += a * a;
    bNorm += b * b;
  }

  if (!aNorm || !bNorm) {
    return 0;
  }
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

export function localScoreVideo(
  video: VideoMetadata,
  topic: TopicConfig,
  syllabusKeywords: string[]
): ScoreResult {
  const title = normalizeText(video.title);
  const channel = normalizeText(video.channel);
  const description = normalizeText(video.description);
  const allText = `${title} ${channel} ${description}`.trim();
  const videoTokens = tokenize(allText).filter((token) => !STOPWORDS.has(token));

  const corpus = makeTopicCorpus(topic, syllabusKeywords);
  const tokenPool = expandedTopicTokens(topic, syllabusKeywords);

  const matchedKeywords = computeKeywordMatches(videoTokens, tokenPool);
  const keywordScore = Math.min(matchedKeywords.length / 8, 1);
  const semanticScore = cosineSimilarity(tokenPool, videoTokens);

  const phraseCandidates = [topic.subject, topic.subtopic, topic.goal || '', ...syllabusKeywords].filter(Boolean);
  const phraseSimilarity = phraseCandidates.length
    ? Math.max(...phraseCandidates.map((phrase) => diceCoefficient(phrase, `${video.title} ${video.description}`)))
    : 0;

  const titleBoost = matchedKeywords.some((kw) => title.includes(stemToken(kw))) ? 0.14 : 0;
  const channelPenalty = /music|gaming|shorts|meme/.test(channel) ? 0.1 : 0;

  let score = 0.34 * keywordScore + 0.41 * semanticScore + 0.22 * phraseSimilarity + titleBoost - channelPenalty;
  score = Math.max(0, Math.min(score, 1));

  let label: ScoreResult['label'];
  if (score >= 0.53) {
    label = 'relevant';
  } else if (score >= 0.3) {
    label = 'borderline';
  } else {
    label = 'irrelevant';
  }

  const reasons: string[] = [];
  if (matchedKeywords.length > 0) {
    reasons.push(`matched keyword: ${matchedKeywords[0]}`);
  }
  if (topic.subtopic && diceCoefficient(topic.subtopic, video.title) > 0.28) {
    reasons.push(`matched topic phrase: ${topic.subtopic}`);
  }
  if (semanticScore > 0.36) {
    reasons.push('semantic similarity with study focus');
  }
  if (!reasons.length) {
    reasons.push('low topical overlap with active study focus');
  }

  return {
    score,
    label,
    reasons,
    matchedKeywords
  };
}
