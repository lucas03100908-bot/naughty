# 에셋

## 원본 → 웹용

`assets/source/`(git 제외)의 Tripo 모델을 `npm run assets`(`scripts/optimize-assets.mjs`)로 `public/models/`에 만든다.

| 모델 | 원본 | 결과 | 삼각형 원본 | 삼각형 결과 |
| --- | --- | --- | --- | --- |
| shop_a | 65.30 MB | 1.75 MB | 1,940,285 | 99,996 |
| shop_b | 60.82 MB | 1.47 MB | 1,882,915 | 100,000 |
| tree | 66.11 MB | 0.87 MB | 1,944,140 | 50,000 |
| street_lamp | 61.96 MB | 0.62 MB | 1,895,648 | 30,000 |
| christmas_tree | 57.58 MB | 1.99 MB | 1,970,748 | 116,249 |
| snowman | 56.18 MB | 0.97 MB | 1,878,797 | 55,740 |
| ground | 64.94 MB | 1.01 MB | 1,930,446 | 60,000 |
| **합계** | 432.90 MB | 8.69 MB | | |

부품이 여러 개인 모델은 노드를 합치지 않고, 재질마다 처리한다. `npm run assets -- snowman`처럼 이름을 주면 그 모델만 다시 만든다.

처리 순서: IP 영역 덮기 → 발광 맵 생성 → weld → simplify(meshoptimizer) → 텍스처 WebP 변환(베이스 컬러 2K/1K, 노멀 1K, 러프니스 512) → Meshopt 압축.

- **발광 맵:** 베이스 컬러에서 따뜻하고 밝은 픽셀(불 켜진 창문, 가로등 유리)만 남겨 emissive 텍스처로 쓴다. 장난에서 불을 끌 때 이 세기를 0으로 내리면 된다.
- **KHR_materials_volume:** Tripo가 불투명 소품에도 붙여서 제거한다.

## 원본 파일과 IP 처리

| 원본 파일 | 저장소 이름 | 처리 |
| --- | --- | --- |
| `wizarding shop 3d model (1).glb` | `shop_a.glb` | 텍스처에 유명 IP의 상점 이름 간판이 있어 흐리게 덮음(3곳). 가운데 창 위 '모자 든 해골' 조형물을 지오메트리에서 잘라냄(`crop`) |
| `wizarding shop 3d model.glb` | `shop_b.glb` | 읽히는 간판 글자 10곳을 흐리게 덮음. 굴뚝 위 부엉이 풍향계와 문 위 날개 달린 금색 공을 잘라냄(`crop`) |
| `tree 3d model.glb` | 사용 안 함 | 마법사 모자·빗자루·부엉이 장식. 모퉁이 나무 2그루는 `dio_pine.glb`로 바꿈(2026-11-19) |
| `vintage street lamp 3d model.glb` | `street_lamp.glb` | 그대로 |
| `christmas tree 3d model_Clone1.glb` | `christmas_tree.glb` | 마을 트리(장난) + 구석 장식 나무. 부품 15개 그대로 유지, 장식의 발광이 트리 전구 |
| `snowman 3d model_Clone1.glb` | `snowman.glb` | 장난 눈사람. 부품 유지: part_1 머리, part_2 모자, part_4 눈, part_6 당근 코, part_3·5 팔, part_0 몸통 |
| `7cdc771f-….glb` | `ground.glb` | 눈 덮인 돌길(연석·보도가 있는 휘어진 거리 한 구간). 마을 바닥. 높이 격자는 `scripts/ground-heights.mjs`가 `src/scene/groundHeights.ts`로 굽는다 |
| `wizard duo 3d model.glb` | 사용 안 함 | 특정 캐릭터로 알아볼 수 있는 인물 2명. CLAUDE.md IP 원칙에 따라 제외 |

덮을 위치는 macOS Vision OCR(4방향)과 텍스처 육안 검사로 찾았다. 좌표는 `scripts/optimize-assets.mjs`의 `cover` 배열에 있다. 모델을 다시 생성하면 좌표도 다시 찾아야 한다.

## 기타 파일

- 전환 영상(`dive.mp4`)은 2026-11-19에 뺐다. 로브 입은 아이들과 유명 IP를 흉내 낸 간판이 나와서다. 원본은 `assets/source/video/dive.mp4`(git 밖)에 남아 있다.

- `public/models/face_landmarker.task` (3.6 MB): Google MediaPipe 공식 모델(float16).
- `public/mediapipe/` (wasm 14.7 MB × 2): `@mediapipe/tasks-vision`에서 복사. 브라우저가 지원하는 쪽 하나만 받는다.
- 유리, 받침대, 바닥, 니트 천은 코드로 만들어 다운로드가 없다.
