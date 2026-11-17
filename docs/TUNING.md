# 튜닝 값

모든 값은 `src/game/constants.ts`에 있다. 이 문서는 각 값의 의미와, 바꿨을 때 무엇이 달라지는지를 적는다.

## 화면·웹캠 모델 (off-axis 투영)

| 상수 | 기본값 | 의미 |
| --- | --- | --- |
| `SCREEN.heightCm` | 19 | 화면 세로 길이(cm). 월드 1단위 = 이 길이. 13~14인치 노트북은 18~20. 실제보다 크게 잡으면 시차가 약해진다. |
| `WEBCAM.hfovDeg` | 60 | 웹캠 수평 화각. 거리(z)와 좌우 위치 추정에 쓴다. 틀리면 z가 실제보다 가깝거나 멀게 나온다. |
| `WEBCAM.aboveScreenCm` | 1 | 화면 윗변에서 렌즈까지 거리. 머리 y 원점을 화면 중앙으로 옮길 때 쓴다. |
| `HEAD.ipdCm` | 6.3 | 평균 동공 간 거리. 눈 사이 픽셀 거리 → z 추정. |
| `HEAD.nominalDistanceCm` | 55 | 얼굴이 없을 때(마우스 모드)의 눈 거리. |
| `HEAD.min/maxDistanceCm` | 25 / 120 | z 추정값 클램프. |
| `HEAD.gainXY`, `HEAD.gainZ` | 1 / 1 | 실제 머리 움직임에 곱하는 배율. 1보다 크면 '창문' 효과가 과장된다. 체감 테스트 후 조정. |
| `TRACKING.fps` | 30 | Face Landmarker 추론 주기. 렌더는 디스플레이 주사율로 따로 돈다. |
| `TRACKING.lostAfterSec` | 0.5 | 얼굴이 이만큼 안 보이면 '없음'으로 표시. |

## 떨림 제거 (One Euro Filter)

| 상수 | 기본값 | 의미 |
| --- | --- | --- |
| `ONE_EURO_POSITION.minCutoff` | 0.8 | 가만히 있을 때의 차단 주파수(Hz). 낮을수록 떨림이 줄지만 느려진다. |
| `ONE_EURO_POSITION.beta` | 0.04 | 빠르게 움직일 때 지연을 줄이는 정도. 높을수록 반응이 빠르지만 움직일 때 떨린다. |
| `ONE_EURO_ANGLE.*` | 1.5 / 0.02 | roll·yaw(도)용 같은 필터. |

조정 순서: 머리를 가만히 두고 `minCutoff`를 떨림이 안 보일 때까지 낮춘다. 그다음 빠르게 움직이며 `beta`를 지연이 거슬리지 않을 때까지 올린다.

## 기울이기 (roll)

| 상수 | 기본값 | 의미 |
| --- | --- | --- |
| `ROLL.deadzoneDeg` | 5 | 이 각도 안에서는 눈이 흐르지 않는다. |
| `ROLL.fullDeg` | 25 | 이 각도에서 흐름 속도가 최대가 된다. 그 사이는 선형. |
| `SNOW.flowRate` | 24 | 최대로 기울였을 때 눈 층이 초당 이동하는 칸 수. 바닥 폭이 64칸이라 약 2.5초면 반대편으로 다 쏠린다. |
| `SNOW.reposeStep` | 0.004 | 이웃 칸 높이 차이 허용치(안식각). 작을수록 더미가 넓고 완만해진다. |

## 흔들기 (yaw)

| 상수 | 기본값 | 의미 |
| --- | --- | --- |
| `SHAKE.windowMs` | 1500 | 방향 전환이 모두 이 시간 안에 일어나야 한다. |
| `SHAKE.minReversals` | 3 | 필요한 yaw 방향 전환 횟수. 좌·우·좌는 보통 2~3회다. 인식이 어려우면 2로 낮춘다. |
| `SHAKE.minSwingDeg` | 12 | 극값과 극값 사이 최소 진폭. 첫 반 스윙은 절반만 있어도 된다. |
| `SHAKE.cooldownMs` | 1500 | 한 번 인식한 뒤 다음 인식까지 쉬는 시간. |

흔들기는 필터를 거치지 않은 yaw로 판정한다. 필터가 빠른 방향 전환을 깎아 먹기 때문이다. roll은 눈 사이 선의 기울기, yaw는 얼굴 변환 행렬에서 따로 계산하므로 축이 섞이지 않는다.

## 마우스 대체 입력

| 상수 | 기본값 | 의미 |
| --- | --- | --- |
| `MOUSE.rangeXCm`, `rangeYCm` | 18 / 10 | 마우스가 화면 끝에 있을 때의 가상 머리 위치. |
| `MOUSE.rollMaxDeg` | 30 | Shift를 누른 채 화면 끝까지 움직였을 때의 roll. |
| `MOUSE.shakeYawScaleDeg` | 30 | 마우스 x를 이 범위의 가상 yaw로 바꿔 같은 흔들기 판정기에 넣는다. |

## 스노우볼 배치

| 상수 | 기본값 | 의미 |
| --- | --- | --- |
| `GLOBE.radius`, `centerY`, `floorY`, `floorRadius` | 0.45 / 0.45 / 0.2 / 0.368 | 구 로컬 단위(물체 전체 높이 ≈ 0.9). `floorRadius`는 유리와 받침대가 만나는 원. |
| `GLOBE.scale`, `GLOBE.position` | 0.76 / (0, −0.5, −0.4) | 월드 배치. z가 음수면 화면 '뒤'에 있다. 더 뒤로 보낼수록 시차가 커진다. |
| `SCENE_TILT` | 0.2 rad | 구와 천을 관객 쪽으로 기울인 각도. 눈높이에서 봐도 위에서 내려다보는 느낌이 든다. |

## 눈

| 상수 | 기본값 | 의미 |
| --- | --- | --- |
| `SNOW.count` | 3000 | 눈송이 수. |
| `SNOW.grid` | 64 | heightfield 해상도(한 변의 칸 수). |
| `SNOW.fallSpeed`, `drift` | 0.055 / 0.025 | 낙하 속도, 좌우 흔들림(구 로컬 단위/초). |
| `SNOW.depositPerFlake` | 0.00006 | 눈송이 하나가 바닥에 닿을 때 쌓이는 높이. |
| `SNOW.initialDepth`, `maxDepth` | 0.009 / 0.05 | 처음 깊이, 칸당 최대 깊이. 꽉 찬 칸은 더 받지 않아 눈이 뒤로 쌓인다. |
| `SNOW.shakeStirSec` | 2.2 | 흔든 뒤 눈이 공중에서 휘몰아치는 시간. |
| `SNOW.shakeKick` | 1.6 | 휘몰아치는 세기. |
| `SNOW.shakeLiftShare` | 0.6 | 흔들 때 바닥에서 튀어 오르는 눈송이 비율. |
| `SNOW.returnSec` | 5 | 휘몰아침이 잦아든 뒤 바닥 눈이 다시 쌓이는 시간. 흔들면 고르게 다시 쌓인다. |
| `SNOW.flakeSize` | 0.016 | 눈송이 크기. |

## 조명

| 상수 | 기본값 | 의미 |
| --- | --- | --- |
| `LIGHTS.shopEmissive` | 1.4 | 가게 창문 발광 세기(블룸에 걸린다). |
| `LIGHTS.lampEmissive` | 3.0 | 가로등 유리 발광 세기. |
| `LIGHTS.treeEmissive` | 0.25 | 나무 텍스처의 따뜻한 픽셀 발광. |
| `LIGHTS.lampPointIntensity` | 0.012 | 가로등 포인트 라이트. 장면이 작아서(광원과 바닥이 몇 cm) 물리 단위로는 아주 작은 값이 맞다. 0.1만 돼도 바닥이 하얗게 날아간다. |
