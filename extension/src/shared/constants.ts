import { ExtensionSettings, SessionStats } from './types.js';

export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  STATS: 'stats'
} as const;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  paused: false,
  strictness: 'balanced',
  topic: {
    subject: '',
    subtopic: '',
    goal: ''
  },
  syllabus: null,
  allowChannels: [],
  blockChannels: [],
  localOnlyMode: true,
  backendUrl: 'http://127.0.0.1:8000',
  temporaryRevealUntil: null,
  sessionGoal: '',
  pomodoroMinutes: 25,
  feedback: {
    likedChannels: [],
    dislikedChannels: [],
    likedTerms: {},
    dislikedTerms: {}
  }
};

export const DEFAULT_STATS: SessionStats = {
  hiddenCount: 0,
  shownRelevantCount: 0,
  lastTopic: ''
};

export const MESSAGE_TYPES = {
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  TOGGLE_ENABLED: 'TOGGLE_ENABLED',
  PAUSE_STUDY_MODE: 'PAUSE_STUDY_MODE',
  SHOW_TEMPORARILY: 'SHOW_TEMPORARILY',
  EXPORT_SETTINGS: 'EXPORT_SETTINGS',
  IMPORT_SETTINGS: 'IMPORT_SETTINGS',
  REQUEST_SCORE: 'REQUEST_SCORE',
  RECORD_FEEDBACK: 'RECORD_FEEDBACK'
} as const;
