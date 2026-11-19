/**
 * Today's ranking. With NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set, scores go
 * to the `scores` table (schema and row-level security in docs/RANKING.md) over Supabase's REST
 * API. Without them, a local list in this browser stands in, so the screen works offline.
 * Only a nickname, the score and the title are stored: no face, no image.
 */
export interface RankEntry {
  nickname: string;
  score: number;
  title: string;
  created_at: string;
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const rankingIsShared = Boolean(URL_ && KEY);
const LOCAL = 'naughty-list:ranking';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export function cleanNickname(s: string) {
  return s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
}

export async function submitScore(e: Omit<RankEntry, 'created_at'>) {
  const entry = { ...e, nickname: cleanNickname(e.nickname) || '익명의 악동' };
  if (rankingIsShared) {
    const res = await fetch(`${URL_}/rest/v1/scores`, {
      method: 'POST',
      headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error(`순위 저장 실패 (${res.status})`);
    return;
  }
  const list = readLocal();
  list.push({ ...entry, created_at: new Date().toISOString() });
  try {
    localStorage.setItem(LOCAL, JSON.stringify(list.slice(-200)));
  } catch {
    // storage unavailable: the ranking just won't persist
  }
}

export async function todaysTop(limit = 10): Promise<RankEntry[]> {
  if (rankingIsShared) {
    const q = `select=nickname,score,title,created_at&created_at=gte.${encodeURIComponent(startOfToday())}&order=score.desc&limit=${limit}`;
    const res = await fetch(`${URL_}/rest/v1/scores?${q}`, { headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` } });
    if (!res.ok) throw new Error(`순위 불러오기 실패 (${res.status})`);
    return res.json();
  }
  const since = startOfToday();
  return readLocal()
    .filter((e) => e.created_at >= since)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function readLocal(): RankEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL) ?? '[]');
  } catch {
    return [];
  }
}
