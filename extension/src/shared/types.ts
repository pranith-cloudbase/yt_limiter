export type Strictness = 'strict' | 'balanced' | 'explore';

export interface TopicConfig {
  subject: string;
  subtopic: string;
  goal?: string;
}

export interface FeedbackProfile {
  likedChannels: string[];
  dislikedChannels: string[];
  likedTerms: Record<string, number>;
  dislikedTerms: Record<string, number>;
}

export interface SyllabusSummary {
  course_title: string;
  units: string[];
  keywords: string[];
  summary: string;
  focus_topics: string[];
}

export interface ExtensionSettings {
  enabled: boolean;
  paused: boolean;
  strictness: Strictness;
  topic: TopicConfig;
  syllabus: SyllabusSummary | null;
  allowChannels: string[];
  blockChannels: string[];
  localOnlyMode: boolean;
  backendUrl: string;
  temporaryRevealUntil: number | null;
  sessionGoal: string;
  pomodoroMinutes: number;
  feedback: FeedbackProfile;
}

export interface VideoMetadata {
  title: string;
  channel: string;
  description: string;
}

export interface ScoreResult {
  score: number;
  label: 'relevant' | 'borderline' | 'irrelevant';
  reasons: string[];
  matchedKeywords: string[];
}

export interface SessionStats {
  hiddenCount: number;
  shownRelevantCount: number;
  lastTopic: string;
}

export interface ScoreRequestPayload {
  topic: string;
  subtopic: string;
  goal: string;
  syllabus_keywords: string[];
  video_title: string;
  video_channel: string;
  video_description: string;
  feedback?: FeedbackProfile;
}

export interface ScoreResponsePayload {
  score: number;
  label: 'relevant' | 'borderline' | 'irrelevant';
  reasons: string[];
  model_used?: string;
}

export interface FeedbackVideoPayload {
  video_title: string;
  video_channel: string;
  video_description: string;
  feedback_type: 'relevant' | 'irrelevant';
}

export interface StorageShape {
  settings: ExtensionSettings;
  stats: SessionStats;
}
