# 오늘의 순위 (Supabase)

환경 변수 두 개가 있으면 순위가 Supabase에 저장되고 모두가 같은 순위를 본다. 없으면 각 브라우저 안의 로컬 순위로 동작한다.

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

로컬 개발은 `.env.local`에, 배포는 Vercel 프로젝트 환경 변수에 넣는다. anon 키는 공개용 키라 브라우저에 노출돼도 되지만, 아래 정책으로 할 수 있는 일을 '읽기'와 '추가'로만 막는다.

## 테이블과 정책 (SQL Editor에서 실행)

```sql
create table public.scores (
  id bigint generated always as identity primary key,
  nickname text not null check (char_length(nickname) between 1 and 12),
  score integer not null check (score between 0 and 6000),
  title text not null check (char_length(title) <= 20),
  created_at timestamptz not null default now()
);

alter table public.scores enable row level security;

create policy "anyone can read scores" on public.scores
  for select using (true);

create policy "anyone can add a score" on public.scores
  for insert with check (true);

create index scores_today on public.scores (created_at desc, score desc);
```

수정·삭제 정책은 없으므로 브라우저에서는 점수를 바꾸거나 지울 수 없다. 점수 조작을 완전히 막지는 못한다(개인 작품 범위에서 감수). 얼굴이나 이미지는 저장하지 않는다.
