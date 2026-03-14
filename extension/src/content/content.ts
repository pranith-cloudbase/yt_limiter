import { MESSAGE_TYPES } from '../shared/constants.js';
import { getSettings, getStats, saveStats } from '../shared/storage.js';
import { localScoreVideo } from '../shared/scoring.js';
import { ExtensionSettings, ScoreResult, VideoMetadata } from '../shared/types.js';

const BADGE_ID = 'studytube-floating-badge';
const CARD_SELECTOR = [
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-compact-playlist-renderer',
  'ytd-compact-radio-renderer',
  'yt-lockup-view-model'
].join(',');

const WATCH_PAGE_PATH = '/watch';
const SEARCH_PAGE_PATH = '/results';
let observer: MutationObserver | null = null;
let debounceTimer: number | null = null;

interface DecoratedCard {
  card: Element;
  score: ScoreResult;
}

function isContextInvalidated(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Extension context invalidated');
}

function runSafely(task: () => Promise<void>): void {
  void task().catch((error) => {
    if (isContextInvalidated(error)) {
      if (observer) {
        observer.disconnect();
      }
      return;
    }
    console.error('StudyTube Focus content error', error);
  });
}

function debounce(fn: () => void, delay = 250): void {
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(fn, delay);
}

function isWatchPage(): boolean {
  return window.location.pathname.startsWith(WATCH_PAGE_PATH);
}

function isSearchPage(): boolean {
  return window.location.pathname.startsWith(SEARCH_PAGE_PATH);
}

function ensureFloatingBadge(settings: ExtensionSettings): void {
  let badge = document.getElementById(BADGE_ID);
  if (!settings.enabled || settings.paused) {
    if (badge) {
      badge.remove();
    }
    return;
  }

  if (!badge) {
    badge = document.createElement('div');
    badge.id = BADGE_ID;
    badge.className = 'studytube-floating-badge';
    document.body.appendChild(badge);
  }

  const topic = `${settings.topic.subject} ${settings.topic.subtopic}`.trim();
  badge.textContent = topic ? `Study Mode ON: ${topic}` : 'Study Mode ON';
}

function textContentFrom(el: Element | null): string {
  return (el?.textContent || '').trim();
}

function getCardLink(card: Element): string {
  const href = (card.querySelector('a#thumbnail, a#video-title, a#video-title-link') as HTMLAnchorElement | null)?.href || '';
  return href;
}

function isSidebarCard(card: Element): boolean {
  return Boolean(card.closest('#secondary, #secondary-inner, #related, ytd-watch-next-secondary-results-renderer'));
}

function getCandidateCards(): Element[] {
  const selectors = CARD_SELECTOR;

  if (isWatchPage()) {
    return Array.from(
      new Set(
        Array.from(
          document.querySelectorAll(
            [
              `#secondary ${selectors}`,
              `#secondary-inner ${selectors}`,
              `#related ${selectors}`,
              `ytd-watch-next-secondary-results-renderer ${selectors}`,
              `ytd-watch-flexy ${selectors}`
            ].join(', ')
          )
        ).filter((card) => isSidebarCard(card))
      )
    );
  }

  if (isSearchPage()) {
    return Array.from(document.querySelectorAll(`ytd-search ${selectors}, ytd-two-column-search-results-renderer ${selectors}`));
  }

  return Array.from(
    document.querySelectorAll(
      `ytd-browse ${selectors}, ytd-rich-grid-renderer ${selectors}, ytd-two-column-browse-results-renderer ${selectors}`
    )
  );
}

function extractVideoMetadata(card: Element): VideoMetadata {
  const titleEl = card.querySelector(
    '#video-title, a#video-title, h3 a, #video-title-link, .yt-lockup-metadata-view-model__title, .yt-lockup-metadata-view-model__title span'
  );
  const channelEl = card.querySelector(
    'ytd-channel-name #text, #channel-name a, #byline a, #text.ytd-channel-name, .yt-content-metadata-view-model__metadata-row:first-child span.yt-content-metadata-view-model__metadata-text'
  );
  const descriptionEl = card.querySelector(
    '#description-text, #metadata-line, yt-formatted-string#description-text, .yt-content-metadata-view-model__metadata-row:nth-child(2)'
  );
  const titleFallback =
    (titleEl as HTMLElement | null)?.getAttribute('title') ||
    (card as HTMLElement).getAttribute('title') ||
    (card.querySelector('a#thumbnail, a#video-title, a#video-title-link') as HTMLElement | null)?.getAttribute('aria-label') ||
    (card.querySelector('.yt-lockup-metadata-view-model__title') as HTMLElement | null)?.getAttribute('aria-label') ||
    (card.querySelector('#dismissible') as HTMLElement | null)?.getAttribute('aria-label') ||
    '';

  return {
    title: textContentFrom(titleEl) || titleFallback,
    channel: textContentFrom(channelEl),
    description: textContentFrom(descriptionEl)
  };
}

function shouldSkipCard(card: Element): boolean {
  if (card.closest('ytd-watch-metadata')) {
    return true;
  }
  if (card.closest('ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, feed-ad-metadata-view-model')) {
    return true;
  }
  if (isWatchPage()) {
    const currentUrl = new URL(window.location.href);
    const currentVideoId = currentUrl.searchParams.get('v');
    const cardHref = getCardLink(card);
    if (currentVideoId && cardHref.includes(`v=${currentVideoId}`)) {
      return true;
    }
  }
  return false;
}

function applyCardState(card: Element, score: ScoreResult, settings: ExtensionSettings): void {
  card.classList.remove('studytube-hidden', 'studytube-blurred', 'studytube-collapsed');

  const existingBadge = card.querySelector('.studytube-relevant-badge');
  if (existingBadge) {
    existingBadge.remove();
  }
  const existingReason = card.querySelector('.studytube-reason');
  if (existingReason) {
    existingReason.remove();
  }

  const channel = (card.querySelector('#channel-name a, #byline a')?.textContent || '').trim().toLowerCase();
  const isAllow = settings.allowChannels.some((allowed) => channel.includes(allowed.toLowerCase()));
  const isBlocked = settings.blockChannels.some((blocked) => channel.includes(blocked.toLowerCase()));

  const temporaryReveal = Boolean(settings.temporaryRevealUntil && Date.now() < settings.temporaryRevealUntil);
  const irrelevant = score.label === 'irrelevant' && !isAllow;

  if (isBlocked) {
    card.classList.add('studytube-hidden');
    return;
  }

  if (temporaryReveal || !settings.enabled || settings.paused) {
    return;
  }

  if (settings.strictness === 'strict' && irrelevant) {
    card.classList.add('studytube-hidden');
  }

  if (settings.strictness === 'balanced' && irrelevant) {
    card.classList.add('studytube-blurred', 'studytube-collapsed');
  }

  if (settings.strictness === 'explore' && irrelevant) {
    card.classList.add('studytube-collapsed');
    const warning = document.createElement('div');
    warning.className = 'studytube-reason';
    warning.textContent = 'Lower priority: outside current focus topic';
    card.appendChild(warning);
  }

  if (score.label !== 'irrelevant') {
    const badge = document.createElement('div');
    badge.className = 'studytube-relevant-badge';
    badge.textContent = `Relevant to ${settings.topic.subtopic || settings.topic.subject || 'study topic'}`;
    card.appendChild(badge);

    const reason = document.createElement('div');
    reason.className = 'studytube-reason';
    reason.textContent = score.reasons[0] || 'Topical overlap detected';
    card.appendChild(reason);
  }

  // Sidebar cards are compact; collapsing them too hard makes the column jump.
  if (isSidebarCard(card) && card.classList.contains('studytube-collapsed') && !card.classList.contains('studytube-hidden')) {
    card.classList.remove('studytube-collapsed');
  }
}

async function scoreCard(card: Element, settings: ExtensionSettings): Promise<ScoreResult> {
  const metadata = extractVideoMetadata(card);

  if (!metadata.title) {
    return {
      score: 0,
      label: 'irrelevant',
      reasons: ['missing title metadata'],
      matchedKeywords: []
    };
  }

  const localScore = localScoreVideo(metadata, settings.topic, settings.syllabus?.keywords || []);

  if (settings.localOnlyMode) {
    return localScore;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.REQUEST_SCORE,
      payload: {
        topic: settings.topic.subject,
        subtopic: settings.topic.subtopic,
        goal: settings.topic.goal || '',
        syllabus_keywords: settings.syllabus?.keywords || [],
        video_title: metadata.title,
        video_channel: metadata.channel,
        video_description: metadata.description
      }
    });

    if (!response?.ok) {
      return localScore;
    }

    return {
      score: response.result.score,
      label: response.result.label,
      reasons: response.result.reasons,
      matchedKeywords: localScore.matchedKeywords
    };
  } catch {
    return localScore;
  }
}

async function scoreAndRender(): Promise<void> {
  const settings = await getSettings();
  ensureFloatingBadge(settings);

  if ((!settings.topic.subject && !settings.topic.subtopic) || !settings.enabled || settings.paused) {
    const cards = getCandidateCards();
    cards.forEach((card) => {
      card.classList.remove('studytube-hidden', 'studytube-blurred', 'studytube-collapsed');
    });
    return;
  }

  const cards = getCandidateCards().filter((card) => !shouldSkipCard(card));

  const decorated: DecoratedCard[] = [];
  for (const card of cards) {
    const score = await scoreCard(card, settings);
    decorated.push({ card, score });
  }

  decorated.sort((a, b) => b.score.score - a.score.score);

  let hiddenCount = 0;
  let relevantShownCount = 0;

  for (const { card, score } of decorated) {
    applyCardState(card, score, settings);
    if (card.classList.contains('studytube-hidden')) {
      hiddenCount += 1;
    }
    if (score.label !== 'irrelevant') {
      relevantShownCount += 1;
    }
  }

  const stats = await getStats();
  stats.hiddenCount += hiddenCount;
  stats.shownRelevantCount += relevantShownCount;
  stats.lastTopic = `${settings.topic.subject} ${settings.topic.subtopic}`.trim();
  await saveStats(stats);
}

function startObserver(): void {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver(() => {
    debounce(() => {
      runSafely(scoreAndRender);
    }, 350);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function setupNavigationListener(): void {
  const eventNames = ['yt-navigate-finish', 'popstate'];
  eventNames.forEach((eventName) => {
    window.addEventListener(eventName, () => {
      debounce(() => {
        if (isWatchPage()) {
          // Never hide the currently watched video area.
        }
        runSafely(scoreAndRender);
      }, 400);
    });
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === MESSAGE_TYPES.SETTINGS_UPDATED) {
    debounce(() => {
      runSafely(scoreAndRender);
    }, 200);
  }
});

startObserver();
setupNavigationListener();
runSafely(scoreAndRender);
