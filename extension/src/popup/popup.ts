import { parseSyllabusFile } from '../shared/api.js';
import { MESSAGE_TYPES } from '../shared/constants.js';
import { getSettings, saveSettings } from '../shared/storage.js';

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

async function initialize(): Promise<void> {
  const settings = await getSettings();

  const subject = getElement<HTMLInputElement>('subject');
  const subtopic = getElement<HTMLInputElement>('subtopic');
  const goal = getElement<HTMLTextAreaElement>('goal');
  const strictness = getElement<HTMLSelectElement>('strictness');
  const backendUrl = getElement<HTMLInputElement>('backendUrl');
  const pomodoroMinutes = getElement<HTMLInputElement>('pomodoroMinutes');
  const sessionGoal = getElement<HTMLInputElement>('sessionGoal');

  subject.value = settings.topic.subject;
  subtopic.value = settings.topic.subtopic;
  goal.value = settings.topic.goal || '';
  strictness.value = settings.strictness;
  backendUrl.value = settings.backendUrl;
  pomodoroMinutes.value = String(settings.pomodoroMinutes || 25);
  sessionGoal.value = settings.sessionGoal || '';
}

async function saveTopicAndSettings(): Promise<void> {
  const settings = await getSettings();
  settings.topic.subject = getElement<HTMLInputElement>('subject').value.trim();
  settings.topic.subtopic = getElement<HTMLInputElement>('subtopic').value.trim();
  settings.topic.goal = getElement<HTMLTextAreaElement>('goal').value.trim();
  settings.strictness = getElement<HTMLSelectElement>('strictness').value as typeof settings.strictness;
  settings.backendUrl = getElement<HTMLInputElement>('backendUrl').value.trim() || 'http://127.0.0.1:8000';
  settings.sessionGoal = getElement<HTMLInputElement>('sessionGoal').value.trim();
  settings.pomodoroMinutes = Number(getElement<HTMLInputElement>('pomodoroMinutes').value) || 25;
  await saveSettings(settings);
}

function setupActions(): void {
  getElement<HTMLButtonElement>('saveBtn').addEventListener('click', async () => {
    await saveTopicAndSettings();
    window.close();
  });

  getElement<HTMLButtonElement>('toggleBtn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.TOGGLE_ENABLED });
    window.close();
  });

  getElement<HTMLButtonElement>('pauseBtn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PAUSE_STUDY_MODE });
    window.close();
  });

  getElement<HTMLButtonElement>('revealBtn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SHOW_TEMPORARILY });
    window.close();
  });

  getElement<HTMLButtonElement>('openOptionsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  getElement<HTMLButtonElement>('parseSyllabusBtn').addEventListener('click', async () => {
    const status = getElement<HTMLDivElement>('syllabusStatus');
    status.textContent = 'Parsing...';
    try {
      await saveTopicAndSettings();
      const settings = await getSettings();
      const input = getElement<HTMLInputElement>('syllabusFile');
      if (!input.files || !input.files.length) {
        status.textContent = 'Select a file first.';
        return;
      }
      const summary = await parseSyllabusFile(settings.backendUrl, input.files[0]);
      settings.syllabus = summary;
      await saveSettings(settings);
      status.textContent = `Parsed: ${summary.course_title || 'course summary ready'}`;
    } catch (error) {
      status.textContent = `Parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  });

  getElement<HTMLButtonElement>('startPomodoroBtn').addEventListener('click', async () => {
    await saveTopicAndSettings();
    const status = getElement<HTMLDivElement>('pomodoroStatus');
    const settings = await getSettings();
    const end = Date.now() + settings.pomodoroMinutes * 60 * 1000;
    status.textContent = `Pomodoro started (${settings.pomodoroMinutes} min)`;

    const tick = window.setInterval(() => {
      const remaining = end - Date.now();
      if (remaining <= 0) {
        clearInterval(tick);
        status.textContent = 'Pomodoro complete. Take a short break.';
        return;
      }
      const min = Math.floor(remaining / 60000);
      const sec = Math.floor((remaining % 60000) / 1000);
      status.textContent = `Remaining ${min}:${sec.toString().padStart(2, '0')}`;
    }, 1000);
  });
}

void initialize();
setupActions();
