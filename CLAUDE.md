# NAUGHTY LIST — 스노우볼 헤드 트래킹 웹 체험

1인 제작 개인 PR 프로젝트. 노트북 브라우저에서 웹캠으로 머리와 표정을 추적해, 화면 너머의 스노우볼을 들여다보며 노는 2분짜리 인터랙티브 작품이다.
기획서 원본: https://claude.ai/artifact/5NoYdw8jfdjqiLtYbVwsqa

## 절대 원칙

- **오브젝트 하나:** 스노우볼과 그 안의 작은 마을만 만든다. 공간 전체(방, 거실)는 만들지 않는다.
- **화면 전환 없음:** 컷, 장면 전환, 카메라 연출 이동이 없다. 시점은 헤드 트래킹(Fish Tank VR, off-axis projection)으로만 움직인다.
- **관객 환경:** 데스크톱·노트북 브라우저(Chrome, Safari, Edge) + 내장 웹캠. 설치·로그인 없음.
- **개인정보:** 웹캠 영상은 브라우저 안에서만 처리하고 서버로 보내지 않는다. 얼굴 사진은 저장하지 않는다.
- **IP:** 해리 포터, 다이애건 앨리, 그린치 관련 이름·형상·문구를 쓰지 않는다. 악동 캐릭터 '험벅(Humbug)'은 오리지널이며, 목소리와 자막으로만 등장한다.
- **1인 제작 범위:** 기능을 늘리기보다 핵심을 다듬는다. 범위 밖 아이디어는 `docs/BACKLOG.md`에 적고 구현하지 않는다.

## 체험 흐름 (상태 머신)

```
intro → start → play(60초) → judge → reward
```

| 상태 | 화면 | 입력 |
| --- | --- | --- |
| `intro` | 어둠 속 스노우볼. '시작하기'를 누르면 카메라 권한 요청 | 클릭 |
| `start` | 험벅 대사 자막: "60초 안에 이 마을 크리스마스를 망쳐." 타이머와 점수 표시 | 없음 |
| `play` | 장난 3개 + 눈 인터랙션 | 헤드 트래킹 + 마우스 |
| `judge` | 2초 평소 표정 저장 → 찡그림 5초 → 슬픈 얼굴 5초 | 표정만 |
| `reward` | 받침대 명판에 성적표가 새겨진다. 총점, 칭호, 장난 기록, 공유 | 클릭 |

## 인터랙션 명세

### 헤드 트래킹 (전 구간)
- MediaPipe Face Landmarker(`@mediapipe/tasks-vision`), VIDEO 모드, `outputFaceBlendshapes: true`, `outputFacialTransformationMatrixes: true`.
- 머리 위치 → off-axis(비대칭 절두체) 카메라. 화면을 '창문'으로 보고 눈 위치에 맞춰 projection matrix를 다시 계산한다.
  - x, y: 두 눈 중점의 정규화 좌표
  - z: 양 눈 사이 픽셀 거리로 추정
- 떨림 제거는 One Euro Filter로 한다. 30fps 추적, 렌더는 60fps.

### 기울이기 (roll)
- 고개를 어깨 쪽으로 갸웃하는 roll 각도. ±5° 데드존.
- 그 방향으로 바닥에 쌓인 눈이 흐른다. 각도가 클수록 빠르다.

### 흔들기 (yaw)
- 좌·우·좌로 도리도리하는 동작이다. 약 1.5초 안에 yaw 방향 전환이 3회 이상, 진폭이 12° 이상이면 인식한다.
- 쌓인 눈이 입자로 흩날려 사라지고, 잠시 뒤 다시 내려 쌓인다.
- roll과 yaw는 축이 달라 서로 헷갈리지 않아야 한다. 그렇게 되는지 테스트로 확인한다.

### 장난 3개 (`play`, 마우스 클릭, raycast)

| 장난 | 동작 | 결과 |
| --- | --- | --- |
| 눈사람 무너뜨리기 | 클릭해 밀기 | 머리가 굴러 떨어지고 당근 코가 빠진다 |
| 가로등 끄기 | 클릭 | 깜빡이다 꺼지고 주변이 어두워진다 (emissive + point light) |
| 트리 전구 스위치 끄기 | 트리 뒤에 숨은 작은 스위치 클릭 | 트리 전구가 한꺼번에 꺼진다. 스위치는 고개를 기울여야 보인다 |

장난 점수는 빨리 할수록 높다.

### 심술 심사 (`judge`, 표정만)
- 처음 2초 동안 blendshape 평균을 기준값(baseline)으로 저장한다.
- 찡그림 = mean(`browDownLeft`, `browDownRight`) − baseline. 화면에서는 눈보라가 거세지고 마을 불이 꺼진다.
- 슬픔 = 0.6 × mean(`mouthFrownLeft`, `mouthFrownRight`) + 0.4 × `browInnerUp` − baseline. 화면에서는 눈이 고요해지고 불이 다시 켜진다.
- 점수는 최고값 60% + 임계값 이상 유지 시간 40%로 시작하고, 튜닝 가능한 상수로 분리한다.
- 총점 = 장난 점수 + 표정 점수.
- 칭호는 귀여운 말썽꾼 → 얄미운 악동 → 전설의 심술쟁이 순이다.

### 카메라 거절 시 대체 입력
- 마우스 위치로 시점과 기울이기를, 마우스를 빠르게 흔드는 동작으로 흔들기를 대신한다.
- 심술 심사는 버튼을 길게 누르는 방식으로 대신한다.

## 기술 스택

- Next.js(App Router) + TypeScript
- React Three Fiber + drei + `@react-three/postprocessing`
- 상태 관리는 zustand
- `@mediapipe/tasks-vision`. `face_landmarker.task` 모델 파일은 `public/models/`에 둔다.
- 유리: drei `MeshTransmissionMaterial` 또는 `MeshPhysicalMaterial`(transmission)
- 눈: instanced points 약 3,000개 + 바닥 heightfield(예: 64×64)로 쌓임과 흐름을 표현
- 후처리: 블룸, 얕은 심도, 필름 그레인
- 배포는 Vercel. 순위와 공유는 마일스톤 3에서 Supabase로 붙인다.
- TouchDesigner, Unreal, AI 영상은 이 코드베이스에서 쓰지 않는다.

## 성능 예산

- 첫 화면 3초 이내, 전체 다운로드 15MB 이하
- M1 맥북에어·최근 내장 그래픽에서 60fps, 5년 된 노트북에서 30fps 이상
- 모델은 Draco 또는 Meshopt로, 텍스처는 KTX2 또는 WebP로 압축한다. `@gltf-transform/cli` 사용을 권장한다.

## 소스 에셋: `assets/source/` (Tripo 생성, git 제외)

임시 모델이다. **테스트용**이고 최종 에셋이 아니다. 처리 기록과 IP 정리 내역은 `docs/ASSETS.md`에 있다.

| 파일 | 내용 | 처리 |
| --- | --- | --- |
| shop_a.glb | 거리 가게 줄 (원본에 유명 IP 상점 간판) | 간판 텍스처를 덮고 10만 삼각형으로 |
| shop_b.glb | 좁고 높은 가게 | 간판 글자를 덮고 10만 삼각형으로, 뒤쪽에 한 번 더 사용 |
| tree.glb | 눈 덮인 작은 나무 | 문장 같은 장식을 덮고 5만 삼각형으로 |
| street_lamp.glb | 가로등 (가로등 끄기 장난 대상) | 3만 삼각형으로 |
| (wizard duo) | 특정 캐릭터 인물 2명 | **사용하지 않음 (IP)** |

- 유리구, 받침대, 바닥, 니트 천은 코드로 만든다.
- 눈사람과 전구 달린 중앙 트리는 아직 없다. 처음엔 단순한 기본 도형으로 임시 제작하고, 나중에 교체할 수 있게 컴포넌트를 분리한다.

## 코드 구조 (권장)

```
app/                  Next.js 페이지
src/scene/            SnowGlobe, Village, Snow(입자, heightfield), Glass, PostFX
src/props/            Snowman, StreetLamp, TreeSwitch (교체 가능한 컴포넌트)
src/tracking/         faceTracker.ts, offAxisCamera.ts, gestures.ts, oneEuro.ts, expression.ts
src/game/             store.ts (zustand 상태 머신), scoring.ts, constants.ts
src/ui/               HUD, IntroOverlay, JudgeMeter, RewardCard
assets/source/        원본 GLB (git LFS 또는 .gitignore)
public/models/        최적화된 GLB, face_landmarker.task
docs/                 BACKLOG.md, TUNING.md
```

## 마일스톤

1. **M1 기술 검증:** 원본 GLB 정리·최적화, off-axis 헤드 트래킹, 기울이기와 흔들기 인식, 눈 입자와 heightfield, 디버그 패널(머리 위치, roll, yaw, blendshape 값)
2. **M2 플레이:** 상태 머신, 장난 3개, 타이머와 점수, 마우스 대체 입력
3. **M3 심사와 보상:** 기준 표정 저장, 표정 점수, 성적표 카드, 공유 이미지, 순위(Supabase)
4. **M4 다듬기:** 룩뎁(유리, 조명, 후처리), 사운드, 성능 최적화, 여러 노트북 테스트, Vercel 배포

목표 공개일은 2026-12-10이다.

## 작업 규칙

- 마일스톤 단위로 일한다. 시작 전에 계획을 보여주고, 끝나면 확인 방법(실행 명령, 확인할 화면)을 알려준다.
- 튜닝 값(임계값, 각도, 시간)은 모두 `src/game/constants.ts`에 모으고 `docs/TUNING.md`에 의미를 적는다.
- 웹캠이 필요한 기능에는 항상 디버그 오버레이와 마우스 대체 입력을 함께 만든다.
- 사람이 직접 확인해야 하는 것(헤드 트래킹 체감, 표정 인식)은 확인 체크리스트로 남긴다.
