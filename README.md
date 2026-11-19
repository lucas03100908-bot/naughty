# NAUGHTY LIST

웹캠으로 머리를 추적해 화면 너머의 스노우볼을 들여다보는 인터랙티브 작품. 규칙과 범위는 `CLAUDE.md`를 따른다.

## 실행

```bash
npm install
npm run dev -- --port 3100
```

브라우저에서 http://localhost:3100 을 연다. 웹캠은 `localhost` 또는 HTTPS에서만 열린다.

| 명령 | 하는 일 |
| --- | --- |
| `npm run assets` | `assets/source/*.glb` → `public/models/*.glb` (원본은 git에 없음) |
| `node scripts/check-snow.mts` | 눈 시뮬레이션 수치 검사 (기울이기·흔들기·질량 보존) |

## 조작 (M1)

- **카메라:** 머리를 움직이면 시점이 바뀌고, 첫 화면에서 도리도리하면 눈이 흩날린다.
- **마우스:** 이동 = 시점, 빠르게 좌우로 흔들기 = 흔들기(첫 화면).
- **D:** 디버그 패널 열고 닫기.

## 폰트

Adobe Fonts 킷 두 개를 `app/layout.tsx`에서 불러온다. `yyp5ndl`(olivia, 영문 타이틀)은 CSS로, `qxr4vmu`(jjblackrose, 한글 제목·자막)는 동적 서브셋이라 스크립트로 불러온다. 동적 서브셋은 페이지에 있는 글자만 받기 때문에, 나중에 나오는 자막과 캔버스에 그리는 명판·공유 이미지 글자는 `src/ui/GlyphPrimer.tsx`가 보이지 않게 미리 깔아 둔다. 새 한글 문구를 추가하면 `src/ui/copy.ts`에 넣는다.

## 소리

파일 없이 Web Audio로 만든다(`src/audio/sound.ts`). 오르골은 Jingle Bells 후렴(1857년, 저작권 만료). 처음 클릭할 때 켜지고(브라우저 정책), 전환 영상이 나오는 동안은 쉰다. 왼쪽 위 버튼으로 끄고, 그 선택은 이 브라우저에 기억된다.

## 순위 (선택)

`.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 넣으면 오늘의 순위가 공유된다. 없으면 브라우저별 로컬 순위로 동작한다. 테이블 만들기는 `docs/RANKING.md`.

## 문서

- `docs/TUNING.md`: 튜닝 값의 의미
- `docs/ASSETS.md`: 에셋 처리와 IP 정리 기록
- `docs/BACKLOG.md`: 범위 밖 아이디어
- `docs/CHECKLIST-M1.md` ~ `M3.md`: 사람이 직접 확인할 항목
- `docs/RANKING.md`: Supabase 순위 설정
