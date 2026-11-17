# 에셋

## 원본 → 웹용

`assets/source/`(git 제외)의 Tripo 모델을 `npm run assets`(`scripts/optimize-assets.mjs`)로 `public/models/`에 만든다.

| 모델 | 원본 | 결과 | 삼각형 원본 | 삼각형 결과 |
| --- | --- | --- | --- | --- |
| shop_a | 65.30 MB | 1.75 MB | 1,940,285 | 99,996 |
| shop_b | 60.82 MB | 1.47 MB | 1,882,915 | 100,000 |
| tree | 66.11 MB | 0.87 MB | 1,944,140 | 50,000 |
| street_lamp | 61.96 MB | 0.62 MB | 1,895,648 | 30,000 |
| **합계** | 254.20 MB | 4.72 MB | | |

처리 순서: IP 영역 덮기 → 발광 맵 생성 → weld → simplify(meshoptimizer) → 텍스처 WebP 변환(베이스 컬러 2K/1K, 노멀 1K, 러프니스 512) → Meshopt 압축.

- **발광 맵:** 베이스 컬러에서 따뜻하고 밝은 픽셀(불 켜진 창문, 가로등 유리)만 남겨 emissive 텍스처로 쓴다. 장난에서 불을 끌 때 이 세기를 0으로 내리면 된다.
- **KHR_materials_volume:** Tripo가 불투명 소품에도 붙여서 제거한다.

## 원본 파일과 IP 처리

| 원본 파일 | 저장소 이름 | 처리 |
| --- | --- | --- |
| `wizarding shop 3d model (1).glb` | `shop_a.glb` | 텍스처에 유명 IP의 상점 이름 간판이 있어 흐리게 덮음(3곳) |
| `wizarding shop 3d model.glb` | `shop_b.glb` | 읽히는 간판 글자 10곳을 흐리게 덮음 |
| `tree 3d model.glb` | `tree.glb` | 기숙사 문장처럼 보이는 장식 7곳을 흐리게 덮음 |
| `vintage street lamp 3d model.glb` | `street_lamp.glb` | 그대로 |
| `wizard duo 3d model.glb` | 사용 안 함 | 특정 캐릭터로 알아볼 수 있는 인물 2명. CLAUDE.md IP 원칙에 따라 제외 |

덮을 위치는 macOS Vision OCR(4방향)과 텍스처 육안 검사로 찾았다. 좌표는 `scripts/optimize-assets.mjs`의 `cover` 배열에 있다. 모델을 다시 생성하면 좌표도 다시 찾아야 한다.

## 기타 파일

- `public/models/face_landmarker.task` (3.6 MB): Google MediaPipe 공식 모델(float16).
- `public/mediapipe/` (wasm 14.7 MB × 2): `@mediapipe/tasks-vision`에서 복사. 브라우저가 지원하는 쪽 하나만 받는다.
- 유리, 받침대, 바닥, 니트 천은 코드로 만들어 다운로드가 없다.
