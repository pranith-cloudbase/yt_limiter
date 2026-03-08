import { DEFAULT_SETTINGS, DEFAULT_STATS, MESSAGE_TYPES } from '../shared/constants.js';
import { exportAllSettings, getSettings, importAllSettings, saveSettings, saveStats } from '../shared/storage.js';
import { scoreVideoWithBackend } from '../shared/api.js';
import { FeedbackVideoPayload, ScoreRequestPayload } from '../shared/types.js';
import { normalizeText, tokenize } from '../shared/text.js';

async function safeNotifyTab(tabId: number, message: unknown): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    if (messageText.includes('Receiving end does not exist')) {
      return;
    }
    console.warn('StudyTube Focus: tab message failed', messageText);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    settings: DEFAULT_SETTINGS,
    stats: DEFAULT_STATS
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MESSAGE_TYPES.TOGGLE_ENABLED) {
    void (async () => {
      const settings = await getSettings();
      settings.enabled = !settings.enabled;
      settings.paused = false;
      await saveSettings(settings);
      sendResponse({ ok: true, enabled: settings.enabled });
    })();
    return true;
  }

  if (message?.type === MESSAGE_TYPES.PAUSE_STUDY_MODE) {
    void (async () => {
      const settings = await getSettings();
      settings.paused = !settings.paused;
      await saveSettings(settings);
      sendResponse({ ok: true, paused: settings.paused });
    })();
    return true;
  }

  if (message?.type === MESSAGE_TYPES.SHOW_TEMPORARILY) {
    void (async () => {
      const settings = await getSettings();
      settings.temporaryRevealUntil = Date.now() + 60_000;
      await saveSettings(settings);
      sendResponse({ ok: true, until: settings.temporaryRevealUntil });
    })();
    return true;
  }

  if (message?.type === MESSAGE_TYPES.EXPORT_SETTINGS) {
    void (async () => {
      const payload = await exportAllSettings();
      sendResponse({ ok: true, payload });
    })();
    return true;
  }

  if (message?.type === MESSAGE_TYPES.IMPORT_SETTINGS) {
    void (async () => {
      await importAllSettings(message.payload || {});
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === MESSAGE_TYPES.REQUEST_SCORE) {
    void (async () => {
      const settings = await getSettings();
      if (settings.localOnlyMode) {
        sendResponse({ ok: false, error: 'local_only_mode' });
        return;
      }

      try {
        const payload = message.payload as ScoreRequestPayload;
        payload.feedback = settings.feedback;
        const result = await scoreVideoWithBackend(settings.backendUrl, payload);
        sendResponse({ ok: true, result });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : 'backend_error' });
      }
    })();
    return true;
  }

  if (message?.type === MESSAGE_TYPES.RECORD_FEEDBACK) {
    void (async () => {
      const payload = message.payload as FeedbackVideoPayload;
      const settings = await getSettings();
      const channel = normalizeText(payload.video_channel);
      const tokens = tokenize(`${payload.video_title} ${payload.video_description}`).slice(0, 24);

      if (payload.feedback_type === 'relevant') {
        if (channel) {
          settings.feedback.likedChannels = [...new Set([...settings.feedback.likedChannels, channel])];
          settings.feedback.dislikedChannels = settings.feedback.dislikedChannels.filter((item) => item !== channel);
        }
        for (const token of tokens) {
          settings.feedback.likedTerms[token] = (settings.feedback.likedTerms[token] || 0) + 1;
          if (settings.feedback.dislikedTerms[token]) {
            settings.feedback.dislikedTerms[token] = Math.max(0, settings.feedback.dislikedTerms[token] - 1);
          }
        }
      } else {
        if (channel) {
          settings.feedback.dislikedChannels = [...new Set([...settings.feedback.dislikedChannels, channel])];
          settings.feedback.likedChannels = settings.feedback.likedChannels.filter((item) => item !== channel);
        }
        for (const token of tokens) {
          settings.feedback.dislikedTerms[token] = (settings.feedback.dislikedTerms[token] || 0) + 1;
          if (settings.feedback.likedTerms[token]) {
            settings.feedback.likedTerms[token] = Math.max(0, settings.feedback.likedTerms[token] - 1);
          }
        }
      }

      await saveSettings(settings);
      sendResponse({ ok: true });
    })();
    return true;
  }

  return false;
});

chrome.action.onClicked.addListener(async (tab) => {
  const settings = await getSettings();
  settings.enabled = !settings.enabled;
  settings.paused = false;
  await saveSettings(settings);

  if (tab.id) {
    await safeNotifyTab(tab.id, { type: MESSAGE_TYPES.SETTINGS_UPDATED });
  }
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local' || !changes.settings) {
    return;
  }

  const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
  for (const tab of tabs) {
    if (tab.id) {
      await safeNotifyTab(tab.id, { type: MESSAGE_TYPES.SETTINGS_UPDATED });
    }
  }
});

async function updateBadge(): Promise<void> {
  const settings = await getSettings();
  if (settings.enabled && !settings.paused) {
    await chrome.action.setBadgeText({ text: 'ON' });
    await chrome.action.setBadgeBackgroundColor({ color: '#0b8457' });
  } else {
    await chrome.action.setBadgeText({ text: 'OFF' });
    await chrome.action.setBadgeBackgroundColor({ color: '#666666' });
  }
}

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') {
    void updateBadge();
  }
});

void updateBadge();

// Keep temporary reveal valid only for 60 seconds.
setInterval(() => {
  void (async () => {
    const settings = await getSettings();
    if (settings.temporaryRevealUntil && Date.now() > settings.temporaryRevealUntil) {
      settings.temporaryRevealUntil = null;
      await saveSettings(settings);
    }
  })();
}, 10_000);

void saveStats(DEFAULT_STATS);
