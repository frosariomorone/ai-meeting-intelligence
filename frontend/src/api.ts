import axios from 'axios';

const baseURL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('meetmind-token');
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ActionItem {
  task: string;
  owner: string;
  deadline: string;
}

export interface TopicSegment {
  topic: string;
  start: string;
  end: string;
  summary: string;
}

export interface SpeakerSentiment {
  speaker: string;
  sentiment: string;
}

export interface SentimentBlock {
  overall: string;
  per_speaker: SpeakerSentiment[];
}

export interface MeetingInsights {
  summary: string;
  key_points: string[];
  action_items: ActionItem[];
  decisions: string[];
  topics: TopicSegment[];
  sentiment: SentimentBlock;
}

export interface AnalyzeResponse {
  meeting_id: string;
  insights: MeetingInsights;
}

export interface MeetingSummary {
  id: string;
  title: string;
  created_at: string;
}

export interface MeetingDetail {
  id: string;
  title: string;
  created_at: string;
  raw_transcript: string;
  insights: MeetingInsights;
}

export interface MeetingChatResponse {
  answer: string;
}

export interface TelegramDialog {
  id: string;
  username?: string;
  title: string;
  type?: string;
}

export interface TelegramHistoryResponse {
  transcript: string;
}

export async function fetchTelegramDialogs() {
  const res = await api.get<TelegramDialog[]>('/telegram/dialogs');
  return res.data;
}

export async function fetchTelegramHistory(peerId: string, limit = 200) {
  const res = await api.get<TelegramHistoryResponse>('/telegram/history', {
    params: { peer_id: peerId, limit },
  });
  return res.data;
}

export async function updateMeetingTitle(id: string, title: string) {
  const res = await api.patch<MeetingDetail>(`/meetings/${id}/title`, { title });
  return res.data;
}

export async function chatWithMeeting(id: string, question: string) {
  const res = await api.post<MeetingChatResponse>(`/meetings/${id}/chat`, {
    question,
  });
  return res.data;
}

