import { MESSAGE_TYPES } from '../shared/constants.js';
import { getSettings, getStats, saveSettings } from '../shared/storage.js';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing #${id}`);
  }
  return node as T;
}

function parseCsv(input: string): string[] {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

async function loadPage(): Promise<void> {
  const [settings, stats] = await Promise.all([getSettings(), getStats()]);
  el<HTMLInputElement>('subject').value = settings.topic.subject;
  el<HTMLInputElement>('subtopic').value = settings.topic.subtopic;
  el<HTMLTextAreaElement>('goal').value = settings.topic.goal || '';
  el<HTMLSelectElement>('strictness').value = settings.strictness;
  el<HTMLTextAreaElement>('allowChannels').value = settings.allowChannels.join(', ');
  el<HTMLTextAreaElement>('blockChannels').value = settings.blockChannels.join(', ');
  el<HTMLInputElement>('backendUrl').value = settings.backendUrl;
  el<HTMLInputElement>('sessionGoal').value = settings.sessionGoal;
  el<HTMLInputElement>('pomodoroMinutes').value = String(settings.pomodoroMinutes);
  el<HTMLPreElement>('syllabusSummary').textContent = settings.syllabus
    ? JSON.stringify(settings.syllabus, null, 2)
    : 'No syllabus uploaded.';
  el<HTMLDivElement>('stats').textContent = `Hidden: ${stats.hiddenCount} | Relevant shown: ${stats.shownRelevantCount} | Topic: ${stats.lastTopic || 'n/a'}`;
}

async function savePage(): Promise<void> {
  const settings = await getSettings();
  settings.topic.subject = el<HTMLInputElement>('subject').value.trim();
  settings.topic.subtopic = el<HTMLInputElement>('subtopic').value.trim();
  settings.topic.goal = el<HTMLTextAreaElement>('goal').value.trim();
  settings.strictness = el<HTMLSelectElement>('strictness').value as typeof settings.strictness;
  settings.allowChannels = parseCsv(el<HTMLTextAreaElement>('allowChannels').value);
  settings.blockChannels = parseCsv(el<HTMLTextAreaElement>('blockChannels').value);
  settings.backendUrl = el<HTMLInputElement>('backendUrl').value.trim() || 'http://127.0.0.1:8000';
  settings.sessionGoal = el<HTMLInputElement>('sessionGoal').value.trim();
  settings.pomodoroMinutes = Number(el<HTMLInputElement>('pomodoroMinutes').value) || 25;
  await saveSettings(settings);
}

el<HTMLButtonElement>('saveBtn').addEventListener('click', async () => {
  await savePage();
  await loadPage();
});

el<HTMLButtonElement>('exportBtn').addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.EXPORT_SETTINGS });
  if (!response?.ok) {
    return;
  }
  const blob = new Blob([JSON.stringify(response.payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'studytube-focus-settings.json';
  a.click();
  URL.revokeObjectURL(url);
});

el<HTMLButtonElement>('importBtn').addEventListener('click', () => {
  el<HTMLInputElement>('importFile').click();
});

el<HTMLInputElement>('importFile').addEventListener('change', async (event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) {
    return;
  }

  const file = input.files[0];
  const text = await file.text();
  const payload = JSON.parse(text);
  await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.IMPORT_SETTINGS, payload });
  await loadPage();
});

void loadPage();
