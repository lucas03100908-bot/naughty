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

- **카메라:** 머리를 움직이면 시점이 바뀌고, 고개를 갸웃하면 눈이 흐르고, 도리도리하면 눈이 흩날린다.
- **마우스:** 이동 = 시점, Shift + 좌우 = 기울이기, 빠르게 좌우로 흔들기 = 흔들기.
- **D:** 디버그 패널 열고 닫기.

## 문서

- `docs/TUNING.md`: 튜닝 값의 의미
- `docs/ASSETS.md`: 에셋 처리와 IP 정리 기록
- `docs/BACKLOG.md`: 범위 밖 아이디어
- `docs/CHECKLIST-M1.md`: 사람이 직접 확인할 항목
