import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  AnalyzeResponse,
  MeetingSummary,
  TelegramDialog,
  fetchTelegramDialogs,
  fetchTelegramHistory,
} from '../api';

type AnalyzeState = 'idle' | 'loading' | 'success' | 'error';

export default function Dashboard() {
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [analyzeState, setAnalyzeState] = useState<AnalyzeState>('idle');
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<MeetingSummary[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [telegramDialogs, setTelegramDialogs] = useState<TelegramDialog[]>([]);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [selectedTelegramPeerId, setSelectedTelegramPeerId] = useState('');

  useEffect(() => {
    void loadMeetings();
    void loadTelegramDialogs();
  }, []);

  async function loadMeetings() {
    try {
      setMeetingsLoading(true);
      const res = await api.get<MeetingSummary[]>('/meetings');
      setMeetings(res.data);
    } catch (err) {
      // non-fatal for dashboard
      console.error('Failed to load meetings', err);
    } finally {
      setMeetingsLoading(false);
    }
  }

  async function loadTelegramDialogs() {
    try {
      setTelegramLoading(true);
      const dialogs = await fetchTelegramDialogs();
      setTelegramDialogs(dialogs);
    } catch (err) {
      console.error('Failed to load telegram dialogs', err);
    } finally {
      setTelegramLoading(false);
    }
  }

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    if (!transcript.trim() && !file) return;
    setAnalyzeState('loading');
    setAnalyzeError(null);
    try {
      let res;
      if (file) {
        const form = new FormData();
        form.append('file', file);
        if (title) form.append('title', title);
        if (selectedTelegramPeerId) {
          form.append('telegram_user_id', selectedTelegramPeerId);
        }
        res = await api.post<AnalyzeResponse>('/analyze/file', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await api.post<AnalyzeResponse>('/analyze', {
          title: title || 'Untitled meeting',
          transcript,
          telegram_user_id: selectedTelegramPeerId || null,
        });
      }
      setAnalyzeState('success');
      setTranscript('');
      setTitle('');
      setFile(null);
      await loadMeetings();
      // Optionally surface insights summary in UI later.
      console.log('Analysis complete', res.data);
    } catch (err: any) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        'Failed to analyze meeting. Please try again.';
      setAnalyzeError(String(msg));
      setAnalyzeState('error');
    }
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const params: Record<string, string> = { q: search };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (ownerFilter.trim()) params.owner = ownerFilter.trim();
      if (sentimentFilter) params.sentiment = sentimentFilter;

      const res = await api.get('/search', { params });
      // map SearchResult (meeting_id, title, created_at, summary) to MeetingSummary
      const mapped = (res.data as any[]).map((item) => ({
        id: item.meeting_id,
        title: item.title,
        created_at: item.created_at,
      }));
      setSearchResults(mapped);
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setSearchLoading(false);
    }
  }

  const listToRender = searchResults.length > 0 ? searchResults : meetings;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] gap-6">
      {/* Left: Transcript / File Input */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">New Meeting Analysis</h2>
          <p className="text-sm text-slate-400">
            Paste a transcript to generate summary, action items, topics, and sentiment.
          </p>
        </div>
        <form onSubmit={handleAnalyze} className="space-y-3">
          <input
            type="text"
            placeholder="Meeting title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">
              Transcript
            </label>
            <textarea
              placeholder="Paste meeting transcript here..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={15}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="mb-2">
                  <label className="text-xs font-medium text-slate-300">
                    Telegram dialog (optional)
                  </label>
                  <select
                    value={selectedTelegramPeerId}
                    onChange={async (e) => {
                      const peerId = e.target.value;
                      setSelectedTelegramPeerId(peerId);
                      if (peerId) {
                        try {
                          const { transcript: t } = await fetchTelegramHistory(peerId);
                          if (t?.trim()) {
                            setTranscript(t);
                          }
                        } catch (err) {
                          console.error('Failed to load telegram history', err);
                        }
                      }
                    }}
                    disabled={telegramLoading || telegramDialogs.length === 0}
                    className="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                  >
                    <option value="">
                      {telegramLoading
                        ? 'Loading Telegram dialogs…'
                        : telegramDialogs.length === 0
                        ? 'No Telegram dialogs available'
                        : 'No Telegram dialog'}
                    </option>
                    {!telegramLoading &&
                      telegramDialogs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title} {d.username ? `(@${d.username})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <label className="text-xs font-medium text-slate-300">
                  Or upload a file
                </label>
                <input
                  type="file"
                  accept=".txt,.pdf,.docx"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    if (f && (f.type === 'text/plain' || f.name.toLowerCase().endsWith('.txt'))) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const text = String(ev.target?.result ?? '');
                        setTranscript(text);
                      };
                      reader.readAsText(f);
                    }
                  }}
                  className="mt-1 w-full text-xs text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Supported: <span className="font-mono">.txt</span>,{' '}
                  <span className="font-mono">.pdf</span>,{' '}
                  <span className="font-mono">.docx</span>. For{' '}
                  <span className="font-mono">.txt</span> files, the content is shown
                  above; for others, the text is extracted on the server.
                </p>
                {file && (
                  <p className="text-[11px] text-emerald-300">
                    Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                  </p>
                )}
              </div>
            </div>
            <span className="text-xs text-slate-500">
              Either paste a transcript, upload a file, or both.
            </span>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={analyzeState === 'loading' || (!transcript.trim() && !file)}
              className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {analyzeState === 'loading' ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border border-slate-200 border-t-transparent" />
                  <span>Analyzing…</span>
                </>
              ) : (
                'Analyze meeting'
              )}
            </button>
          </div>
          {analyzeError && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-2 py-1">
              {analyzeError}
            </p>
          )}
        </form>
      </section>

      {/* Right: Meetings & Search */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Meetings</h2>
            <p className="text-sm text-slate-400">
              Search decisions, API discussions, or pricing talks across meetings.
            </p>
          </div>
          {meetingsLoading && (
            <span className="text-[11px] text-slate-500">Refreshing…</span>
          )}
        </div>
        <form onSubmit={handleSearch} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder='Search e.g. "API discussion", "pricing decisions"'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
              disabled={searchLoading}
            >
              {searchLoading && (
                <span className="h-3 w-3 animate-spin rounded-full border border-slate-200 border-t-transparent" />
              )}
              <span>{searchLoading ? 'Searching…' : 'Search'}</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">From date</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">To date</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">Owner</span>
              <input
                type="text"
                placeholder="Filter by action owner"
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-400">Sentiment</span>
              <select
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
                className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Any</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
            </div>
          </div>
        </form>

        <div className="mt-2 space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {meetingsLoading && listToRender.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-8 text-sm text-slate-400">
              <span className="h-4 w-4 animate-spin rounded-full border border-slate-400 border-t-transparent" />
              <span>Loading meetings…</span>
            </div>
          )}
          {!meetingsLoading && listToRender.length === 0 && (
            <p className="text-sm text-slate-500 border border-dashed border-slate-700 rounded-md px-3 py-6 text-center">
              No meetings yet. Analyze your first transcript to get started.
            </p>
          )}
          {listToRender.map((m) => (
            <Link
              key={m.id}
              to={`/meetings/${m.id}`}
              className="block rounded-md border border-slate-800 bg-slate-900/60 px-3 py-3 hover:border-brand-500 hover:bg-slate-900 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium truncate">{m.title || 'Untitled meeting'}</div>
                  <div className="text-xs text-slate-400">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  View insights →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

