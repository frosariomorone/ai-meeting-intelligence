import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, MeetingDetail, updateMeetingTitle, chatWithMeeting } from '../api';

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatAnswer, setChatAnswer] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void load();

    async function load() {
      try {
        setLoading(true);
        const res = await api.get<MeetingDetail>(`/meetings/${id}`);
        setMeeting(res.data);
        setTitleDraft(res.data.title || '');
        setError(null);
      } catch (err: any) {
        console.error(err);
        const msg =
          err?.response?.data?.detail ?? err?.message ?? 'Failed to load meeting.';
        setError(String(msg));
      } finally {
        setLoading(false);
      }
    }
  }, [id]);

  if (loading) {
    return <div className="text-sm text-slate-400">Loading meeting…</div>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Link to="/" className="text-xs text-brand-500 hover:underline">
          ← Back to dashboard
        </Link>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!meeting) return null;

  const { insights } = meeting;

  function buildMarkdownExport(m: MeetingDetail): string {
    const lines: string[] = [];
    lines.push(`# ${m.title || 'Untitled meeting'}`);
    lines.push('');
    lines.push(`Date: ${new Date(m.created_at).toLocaleString()}`);
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(insights.summary || 'No summary available.');
    lines.push('');
    lines.push('## Key points');
    lines.push('');
    if (insights.key_points?.length) {
      for (const point of insights.key_points) {
        lines.push(`- ${point}`);
      }
    } else {
      lines.push('_No key points extracted._');
    }
    lines.push('');
    lines.push('## Action items');
    lines.push('');
    if (insights.action_items?.length) {
      for (const a of insights.action_items) {
        const owner = a.owner ? ` | Owner: ${a.owner}` : '';
        const deadline = a.deadline ? ` | Deadline: ${a.deadline}` : '';
        lines.push(`- ${a.task}${owner}${deadline}`);
      }
    } else {
      lines.push('_No action items identified._');
    }
    lines.push('');
    lines.push('## Decisions');
    lines.push('');
    if (insights.decisions?.length) {
      for (const d of insights.decisions) {
        lines.push(`- ${d}`);
      }
    } else {
      lines.push('_No explicit decisions captured._');
    }
    lines.push('');
    lines.push('## Topics');
    lines.push('');
    if (insights.topics?.length) {
      for (const t of insights.topics) {
        const range =
          t.start || t.end ? ` (${t.start || 'start'} – ${t.end || 'end'})` : '';
        lines.push(`- **${t.topic}**${range}: ${t.summary}`);
      }
    } else {
      lines.push('_No topics detected._');
    }
    lines.push('');
    lines.push('## Sentiment');
    lines.push('');
    lines.push(`- Overall: **${insights.sentiment?.overall || 'Unknown'}**`);
    if (insights.sentiment?.per_speaker?.length) {
      for (const s of insights.sentiment.per_speaker) {
        lines.push(`- ${s.speaker}: ${s.sentiment}`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('### Raw transcript');
    lines.push('');
    lines.push('```');
    lines.push(m.raw_transcript || '');
    lines.push('```');
    return lines.join('\n');
  }

  async function handleCopyMarkdown() {
    if (!meeting) return;
    try {
      const text = buildMarkdownExport(meeting);
      await navigator.clipboard.writeText(text);
      setExportMessage('Copied meeting as Markdown to clipboard.');
      setTimeout(() => setExportMessage(null), 3000);
    } catch {
      setExportMessage('Failed to copy to clipboard.');
      setTimeout(() => setExportMessage(null), 3000);
    }
  }

  function handleDownloadJson() {
    if (!meeting) return;
    const blob = new Blob([JSON.stringify(meeting, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (meeting.title || 'meeting')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    a.download = `${safeTitle || 'meeting'}-insights.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link to="/" className="text-xs text-brand-500 hover:underline">
            ← Back to dashboard
          </Link>
          <div className="mt-2 flex items-center gap-2">
            {editingTitle ? (
              <>
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  className="min-w-[240px] rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  className="rounded-md bg-brand-600 px-2 py-1 text-xs text-white"
                  onClick={async () => {
                    if (!id) return;
                    try {
                      const updated = await updateMeetingTitle(id, titleDraft || 'Untitled meeting');
                      setMeeting(updated);
                      setEditingTitle(false);
                    } catch (err) {
                      console.error('Failed to update title', err);
                    }
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200"
                  onClick={() => {
                    setTitleDraft(meeting.title || '');
                    setEditingTitle(false);
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold">
                  {meeting.title || 'Untitled meeting'}
                </h1>
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline"
                  onClick={() => setEditingTitle(true)}
                >
                  Edit
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {new Date(meeting.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-800"
            >
              Copy as Markdown
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-700"
            >
              Download JSON
            </button>
          </div>
          {exportMessage && (
            <span className="text-[10px] text-emerald-300">{exportMessage}</span>
          )}
        </div>
      </div>

      {/* Inline AI chat about this meeting */}
      <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Ask this meeting</h2>
          <p className="text-[10px] text-slate-500">
            Example: &quot;What did John say about pricing?&quot;
          </p>
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!id || !chatInput.trim()) return;
            try {
              setChatLoading(true);
              setChatError(null);
              const res = await chatWithMeeting(id, chatInput.trim());
              setChatAnswer(res.answer);
            } catch (err: any) {
              console.error('Chat failed', err);
              const msg =
                err?.response?.data?.detail ??
                err?.message ??
                'Failed to ask question.';
              setChatError(String(msg));
            } finally {
              setChatLoading(false);
            }
          }}
        >
          <input
            type="text"
            placeholder='Ask a question about this meeting...'
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={chatLoading || !chatInput.trim()}
            className="mt-2 sm:mt-0 inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {chatLoading && (
              <span className="h-3 w-3 animate-spin rounded-full border border-slate-200 border-t-transparent" />
            )}
            <span>{chatLoading ? 'Thinking…' : 'Ask'}</span>
          </button>
        </form>
        {chatError && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-2 py-1">
            {chatError}
          </p>
        )}
        {chatAnswer && !chatError && (
          <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 whitespace-pre-wrap">
            {chatAnswer}
          </div>
        )}
      </section>

      {/* Summary */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-2">
        <h2 className="text-sm font-semibold">Summary</h2>
        <p className="text-sm text-slate-200 whitespace-pre-wrap">
          {insights.summary || 'No summary available.'}
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)] gap-4">
        <div className="space-y-4">
          {/* Key points */}
          <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-2">
            <h3 className="text-sm font-semibold">Key points</h3>
            {insights.key_points?.length ? (
              <ul className="list-disc list-inside text-sm text-slate-200 space-y-1">
                {insights.key_points.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">No key points extracted.</p>
            )}
          </section>

          {/* Topics timeline */}
          <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <h3 className="text-sm font-semibold">Topics (timeline)</h3>
            {insights.topics?.length ? (
              <ol className="space-y-3 text-sm">
                {insights.topics.map((t, idx) => (
                  <li key={idx} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-brand-500 flex-shrink-0" />
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">{t.topic}</div>
                        <div className="text-[10px] text-slate-500">
                          {t.start || t.end
                            ? `${t.start || 'start'} – ${t.end || 'end'}`
                            : null}
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 whitespace-pre-wrap">
                        {t.summary}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-slate-500">No topics detected.</p>
            )}
          </section>
        </div>

        <div className="space-y-4">
          {/* Action items */}
          <section className="rounded-lg border border-emerald-700/60 bg-emerald-950/20 p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Action items
            </h3>
            {insights.action_items?.length ? (
              <ul className="space-y-2 text-sm">
                {insights.action_items.map((a, idx) => (
                  <li
                    key={idx}
                    className="rounded-md border border-emerald-800/60 bg-emerald-950/40 px-3 py-2"
                  >
                    <div className="font-medium">{a.task}</div>
                    <div className="mt-1 text-xs text-emerald-100 space-x-3">
                      {a.owner && <span>Owner: {a.owner}</span>}
                      {a.deadline && <span>Deadline: {a.deadline}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-emerald-200/70">No action items identified.</p>
            )}
          </section>

          {/* Decisions */}
          <section className="rounded-lg border border-sky-700/60 bg-sky-950/20 p-4 space-y-2">
            <h3 className="text-sm font-semibold">Decisions</h3>
            {insights.decisions?.length ? (
              <ul className="list-disc list-inside text-sm text-sky-100 space-y-1">
                {insights.decisions.map((d, idx) => (
                  <li key={idx}>{d}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-sky-200/70">No explicit decisions captured.</p>
            )}
          </section>

          {/* Sentiment */}
          <section className="rounded-lg border border-fuchsia-700/60 bg-fuchsia-950/20 p-4 space-y-3">
            <h3 className="text-sm font-semibold">Sentiment</h3>
            <p className="text-sm">
              Overall tone:{' '}
              <span className="font-medium text-fuchsia-200">
                {insights.sentiment?.overall || 'Unknown'}
              </span>
            </p>
            {insights.sentiment?.per_speaker?.length ? (
              <ul className="space-y-1 text-xs text-fuchsia-100">
                {insights.sentiment.per_speaker.map((s, idx) => (
                  <li key={idx}>
                    <span className="font-medium">{s.speaker}</span> – {s.sentiment}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-fuchsia-200/70">
                No per-speaker sentiment breakdown available.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Raw transcript with highlight note */}
      <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Transcript</h3>
          <p className="text-[10px] text-slate-500">
            Future enhancement: click action items or topics to jump to exact lines here.
          </p>
        </div>
        <pre className="text-xs text-slate-200 whitespace-pre-wrap max-h-80 overflow-y-auto bg-slate-950/60 rounded-md px-3 py-2 border border-slate-900">
{meeting.raw_transcript}
        </pre>
      </section>
    </div>
  );
}

