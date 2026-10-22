+++
date = '2026-10-21T00:00:00+09:00'
draft = true
title = '사진첩처럼 밀어서 넘기는 스와이프 만들기'
description = '몽글 플레이 화면에 손가락으로 밀어 옆 장소로 이동하는 스와이프를 만들었다. 러버밴드 공식으로 사진이 손가락을 따라오게 하고, 라벨이 꽉 차는 거리에서 바로 이동하도록 라벨과 이동 판정이 같은 식을 쓰게 했다. 대각선 이동에서도 두 사진이 함께 밀리도록 8방향 슬라이드를 맞추고, 등장 애니메이션의 모바일 프레임 드랍은 transform과 opacity만 남겨 해결했다.'
tags = ["React", "CSS", "설계"]
+++

<!-- 저자 확인 필요:
- "가장 재밌게 작업한 화면"이라는 소감
- 0.55가 덜 따라온다는 근거는 코드 주석뿐 (직접 느낀 건지 피드백인지)
- 라벨 100% 거리에서 이동이 기획 요청인지 (커밋엔 req1~req3뿐)
- 방향 꺾기 버그를 누가 찾았는지 (테스트 주석엔 "사용자 보고"뿐)
- 프레임 드랍 확인 기기와 방법, 고친 뒤 확인 방법 (측정 기록 없음)
-->

휴대폰 사진첩에서 사진을 옆으로 넘길 때를 생각해보자. 손가락을 대고 밀면 사진이 손가락을 따라오고, 충분히 밀면 다음 사진이 들어온다.

회사에서 개발 중인 서비스인 몽글의 텍스트 MUD 게임 플레이 화면에도 이런 조작이 있다. 플레이 화면에서는 지금 있는 장소의 배경 사진 위에 채팅이 올라가 있다. 옆 장소로 넘어가려면 방향 패드나 `/동` 같은 슬래시 명령을 써도 되고, 화면 가운데를 손가락으로 밀어도 된다.

그런데 처음 만든 스와이프는 사진첩처럼 움직이지 않았다. 사진은 손가락을 따라오다 80px에서 딱 멈췄고, 이동할 수 없는 막힌 방향으로는 밀어도 전혀 움직이지 않았다. 이동도 일정 거리 넘게 민 다음 손을 떼야만 일어났다.

<!-- 데모: 8방향으로 끌면 사진이 러버밴드로 따라오고 라벨이 꽉 차는 150px에서 슬라이드. 막힌 방향은 자물쇠 라벨만 -->

## 손가락이 움직인 방향을 8방향 중 하나로 정한다

손가락으로 미는 동작은 채팅 위에 깔린 투명한 스와이프 영역이 받는다. `touch-action: none`으로 밑의 채팅이 같이 스크롤되지 않게 막고, `setPointerCapture`로 손가락이 영역 밖으로 나가도 이벤트를 계속 받는다. 방향은 손가락을 처음 댄 시작점에서 가로와 세로로 움직인 거리(`dx`, `dy`)로 정한다.

```ts
const angle = (Math.atan2(-dy, -dx) * 180) / Math.PI;
const direction = angleToDirection(angle); // 0도(e)를 가운데 두고 45도씩 8칸으로 자른다
```

지도를 왼쪽으로 끌면 오른쪽 땅이 보이는 것처럼 스와이프도 손가락이 민 반대쪽 장소로 간다. 그래서 각도를 잴 때 `dx`, `dy`에 마이너스를 붙인다. 손가락을 왼쪽으로 50px 밀면 `atan2(0, 50)`이 0도라 `e`(동쪽)가 된다. 위로 50px 밀면 `atan2(50, 0)`이 90도인데, 화면 좌표는 y가 아래로 갈수록 커지니까 90도는 아래쪽인 `s`(남쪽)가 된다.

## 첫 번째: 사진이 80px에서 딱 멈춘다

<!-- 그림: 손가락은 계속 끄는데 화면은 80px에서 멈춘 장면 -->

처음에는 손가락이 움직인 만큼 사진을 옮기되 `Math.min`과 `Math.max`로 ±80px에서 잘랐다. 그래서 손가락을 200px 밀어도 사진은 80px에서 더 움직이지 않았다. 그렇다고 끝까지 1:1로 따라오게 하면 옆 장소 사진이 없는 막힌 방향에서는 사진 가장자리 너머의 검은 배경이 드러났다.

그래서 고무줄을 당기듯 멀리 밀수록 사진이 덜 따라오는 러버밴드 공식으로 바꿨다. 출발할 때는 사진이 손가락을 거의 그대로 따라오지만 정해둔 거리는 끝까지 넘지 않는다.

```ts
export const RUBBER_BAND_LIMIT_PX = 140; // 사진이 넘지 못하는 거리
const RUBBER_BAND_RESISTANCE = 1.0; // 출발할 때 손가락을 따라오는 비율

export const rubberBand = (delta: number, limit: number): number => {
    if (delta === 0) return 0;
    const sign = Math.sign(delta);
    const abs = Math.abs(delta);
    return sign * (limit * (1 - 1 / (1 + (abs * RUBBER_BAND_RESISTANCE) / limit)));
};
```

`RUBBER_BAND_RESISTANCE`가 1이면 손가락이 움직인 거리가 x일 때 이 식은 `140 * x / (140 + x)`와 같다. 손가락을 100px 밀면 `140 * 100 / 240`이라 사진은 58.3px 움직인다.

| 손가락 이동 | 사진 이동 |
| --- | --- |
| 10px | 9.3px |
| 100px | 58.3px |
| 150px | 72.4px |
| 300px | 95.5px |

사진은 10px 근처에서는 손가락에 거의 붙어 오다가 300px을 밀어도 95px 정도만 따라온다. 80px에서 자를 때처럼 갑자기 멈추지 않고 조금씩 덜 따라오는 것이다. 손가락이 멀어질수록 분모도 같이 커지니까 사진은 140px에 끝까지 닿지 않는다. 이렇게 구한 값이 배경 사진 레이어의 `translate3d`에 그대로 들어간다.

`RUBBER_BAND_RESISTANCE`는 손가락을 막 밀기 시작할 때 사진이 따라오는 비율이다. 이 값은 원래 0.55였는데, 그러면 손가락을 10px 밀어도 사진은 5px 안팎만 움직인다. 처음부터 절반 남짓만 따라오니 사진이 덜 따라오는 느낌이 나서 1.0으로 올렸다. 그리고 막힌 방향에만 따로 쓰던 32px 한계도 140px 하나로 합쳤다.

## 두 번째: 라벨은 꽉 찼는데 손을 떼면 제자리로 돌아온다

<!-- 그림: 라벨이 꽉 찼는데 손을 떼자 사진이 제자리로 돌아오는 장면 -->

미는 동안 화면 가장자리에는 도착할 장소 이름이 적힌 라벨이 뜨는데, 멀리 밀수록 라벨이 점점 진해진다. 그런데 라벨의 불투명도와 옆 장소로 이동할지 정하는 판정이 따로 계산되고 있었다. 라벨은 손가락이 24px 움직였을 때부터 진해지기 시작해서 61px쯤이면 이미 불투명도 100%로 꽉 찼다. 반면 이동은 손을 뗀 순간 손가락이 120px 넘게 움직였는지로 판정했다. 그러니 61px에서 120px 사이에서 손을 떼면 라벨은 꽉 차 있는데 사진은 제자리로 돌아왔다.

그래서 라벨이 꽉 차는 순간 손을 떼지 않아도 바로 이동하도록 바꿨다. 이동이 일어나는 거리는 라벨 공식에서 거꾸로 구했고, 라벨과 스와이프 영역이 아래 함수를 같이 쓴다.

```ts
const DEAD_ZONE_PX = 24;
const ESTIMATED_COMMIT_DISTANCE_PX = 150;
const FULL_PROGRESS_RANGE_PX = Math.max(ESTIMATED_COMMIT_DISTANCE_PX - DEAD_ZONE_PX, 1); // 126
const LABEL_EASE_EXP = 2.6;
const LABEL_OPACITY_GAIN = 1.0;

export const getSwipeLabelEased = (distance: number): number => {
    const rawProgress = Math.min(Math.max((distance - DEAD_ZONE_PX) / FULL_PROGRESS_RANGE_PX, 0), 1);
    return 1 - Math.pow(1 - rawProgress, LABEL_EASE_EXP); // 처음엔 빨리, 끝으로 갈수록 천천히 찬다
};

export const getSwipeLabelOpacity = (distance: number): number =>
    Math.min(getSwipeLabelEased(distance) * LABEL_OPACITY_GAIN, 1);

// 불투명도가 1이 되는 거리를 거꾸로 구해서 이동 거리로 쓴다
export const SWIPE_COMMIT_DISTANCE_PX: number = (() => {
    const targetEased = 1 / LABEL_OPACITY_GAIN;
    if (targetEased >= 1) return DEAD_ZONE_PX + FULL_PROGRESS_RANGE_PX;
    const oneMinusRaw = Math.pow(1 - targetEased, 1 / LABEL_EASE_EXP);
    return DEAD_ZONE_PX + (1 - oneMinusRaw) * FULL_PROGRESS_RANGE_PX;
})();
```

라벨 불투명도는 24px까지는 0이다. 그 뒤 126px 동안은 ease-out 곡선을 따라 50px에서 0.45, 100px에서 0.91을 지나 150px에서 1이 된다. 지금은 `LABEL_OPACITY_GAIN`이 1이라 `SWIPE_COMMIT_DISTANCE_PX`가 첫 번째 if문에서 바로 24 + 126 = 150px로 나온다. `LABEL_OPACITY_GAIN`을 1.2로 올리면 라벨이 꽉 차는 거리와 이동이 일어나는 거리가 함께 87px쯤으로 줄어든다.

이동 판정은 손가락이 움직일 때마다 한다.

```ts
const handlePointerMove = (e: React.PointerEvent) => {
    // ...
    if (committedRef.current) return; // 이미 이동했으면 손을 뗄 때까지 무시한다
    // ... commitDistance: 손가락이 움직인 거리 (기준점은 아래에서 다룬다)
    if (canMove && commitDistance >= SWIPE_COMMIT_DISTANCE_PX) {
        committedRef.current = true;
        onMove(direction);
        onCommit?.(direction);
    }
};
```

이제 손을 떼지 않아도 150px에 닿는 순간 이동하고, 손을 떼기 전까지는 계속 밀어도 다시 이동하지 않는다. 손을 뗄 때 이동하던 코드는 지웠다. 라벨 불투명도가 150px에서 정확히 1이 되고 0.5px 앞인 149.5px에서는 1보다 작은지도 테스트로 남겨뒀다.

`onMove`에는 방향 패드를 눌렀을 때 부르는 것과 같은 `triggerExternalMove`가 들어간다. 그래서 스와이프로 이동해도 방향 패드나 슬래시 명령으로 이동할 때와 같은 슬라이드 애니메이션으로 장소가 바뀐다.

러버밴드의 140px과 이동이 일어나는 150px은 숫자가 비슷해 보여도 다른 값이다. 140px은 사진이 움직일 수 있는 한계이고 150px은 손가락이 움직인 거리다. 그래서 방향을 꺾지 않고 곧게 밀었다면 이동하는 순간 사진은 `140 * 150 / 290`인 72px쯤 움직여 있다.

### 방향을 꺾으면 라벨이 차기도 전에 넘어갔다

손을 떼지 않아도 이동하게 되자 새 버그가 생겼다. 예를 들어 동쪽이 막혀 있으면 손가락을 왼쪽으로 200px 끌어도 이동하지 않는다. 여기서 손을 떼지 않고 그대로 위로 200px 올리면 방향이 남동쪽(`se`)으로 바뀐다. 그런데 손가락을 처음 댄 시작점부터 잰 거리는 이미 283px이라 라벨이 차오를 틈도 없이 바로 남동쪽 장소로 넘어가버렸다. 그래서 방향이 바뀌는 순간의 손가락 위치부터 거리를 다시 재도록 고쳤다.

```ts
if (lastDirRef.current !== null && lastDirRef.current !== direction) {
    commitAnchorRef.current = { x: e.clientX, y: e.clientY }; // 방향이 바뀐 자리를 새 기준점으로
}
lastDirRef.current = direction;
const anchor = commitAnchorRef.current ?? start;
const commitDistance = Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y);
```

이제 남동쪽으로 꺾인 순간 `commitDistance`는 0이 되고 라벨도 0%부터 다시 차오른다. 처음 방향이 정해질 때는 직전 방향이 없어서(`null`) 기준점을 옮기지 않는다. 그래서 방향을 꺾지 않고 곧게 밀 때는 그대로 시작점부터 150px을 밀면 이동한다. 라벨과 달리 사진의 러버밴드는 계속 시작점에서 잰 `dx`, `dy`로 계산한다. 그러니 방향을 꺾어도 사진은 끊기지 않고 이어서 움직인다. 왼쪽으로 200px 끌다가 위로 200px 올리는 이 순서 그대로 테스트도 남겼다.

## 세 번째: 대각선으로 이동하면 새 사진만 모서리에서 들어와 덮는다

<!-- 그림: 북동쪽 이동 전후. 새 사진만 덮어오던 장면과 두 사진이 붙어서 함께 밀려나는 장면 -->

이동이 정해지면 지금 장소의 사진이 화면 밖으로 나가고 새 장소의 사진이 들어오는 슬라이드가 나온다. 그런데 예전 배경 컴포넌트에는 새 사진이 들어오는 위치가 8방향 모두 있었는데, 지금 사진이 나가는 위치는 동서남북 4방향뿐이었다. 그래서 북동쪽처럼 대각선으로 이동하면 지금 사진은 그대로 있고 새 사진만 모서리에서 들어와 위를 덮었다.

이 문제는 방향을 x, y 벡터로 바꿔서 두 사진을 같은 벡터만큼 함께 밀도록 고쳤다.

```ts
// getUnitOffset: 'ne'면 { x: 1, y: -1 }처럼 8방향을 x, y가 -1, 0, 1인 벡터로 바꾼다
const getExitTransform = (direction: MudDirection) => {
    const offset = getUnitOffset(direction);
    return `translate3d(${offset.x * -100}%, ${offset.y * -100}%, 0)`; // 반대쪽으로 한 화면만큼 나간다
};

const getEnterTransform = (direction: MudDirection) => {
    const offset = getUnitOffset(direction);
    return `translate3d(${offset.x * 100}%, ${offset.y * 100}%, 0)`; // 그 방향 한 화면 바깥에서 들어온다
};
```

북동쪽(`ne`)이면 새 사진은 오른쪽 위 바깥인 `translate3d(100%, -100%, 0)`에서 화면 안으로 들어온다. 지금 사진은 화면 안에서 왼쪽 아래 바깥인 `translate3d(-100%, 100%, 0)`으로 나간다. 두 사진 모두 x로 -100%, y로 +100%씩 움직이니까 모서리를 맞댄 채 함께 밀려난다. 그리고 두 사진에 Web Animations API로 같은 250ms와 같은 감속 곡선을 줘서 도중에 둘 사이가 벌어지지 않는다.

## 네 번째: 도착한 장소의 목록이 모바일에서 끊기며 등장한다

<!-- 그림: 도착한 장소의 목록이 타입별 애니메이션으로 등장하는 장면 -->

슬라이드가 끝나면 그 장소에 있는 오브젝트와 NPC, 몬스터 같은 목록이 한 행씩 등장한다. NPC는 아래에서 자라나듯 올라오고 몬스터는 작게 시작했다가 크게 튀어나오는 식으로 타입마다 등장 방식이 다르다. 행마다 흰 빛도 한 번 번쩍인다. 그런데 모바일에서는 이 등장 애니메이션의 프레임이 떨어져서 끊겨 보였다.

등장 애니메이션의 키프레임에는 transform과 opacity 말고 다른 속성도 같이 움직이고 있었다. NPC는 `clip-path: inset(100% 0 0 0)`에서 `inset(0 0 0 0)`으로 아래부터 드러났다. 몬스터는 `blur(6px)`에서, 플레이어는 `blur(3px)`에서 선명해졌다. 흰 빛은 `background-color`의 알파값을 0에서 0.32로 올렸다가 다시 내렸다. 게다가 행은 25ms 간격으로 하나씩 시작하고 NPC 애니메이션 하나는 320ms 동안 움직인다. NPC가 열 명이면 마지막 행은 225ms에 시작한다. 225ms는 첫 행이 끝나는 320ms보다 이르니까 이때는 열 행이 한꺼번에 움직이고 있다.

브라우저는 [스타일 계산과 레이아웃, 페인트, 합성 단계를 거쳐 화면을 그린다](https://web.dev/articles/rendering-performance). 레이아웃도 페인트도 필요 없는 속성만 바뀌면 곧바로 합성 단계로 넘어가니까 브라우저가 할 일이 가장 적다. 그래서 web.dev [애니메이션 가이드](https://web.dev/articles/animations-guide)도 애니메이션을 가능하면 `opacity`와 `transform`으로 제한하라고 권한다. 이미 그려둔 레이어를 옮기거나 투명도만 바꾸는 건 합성 단계에서 끝나지만, 흰 빛의 `background-color`는 바뀔 때마다 다시 칠해야 한다.

그래서 등장 애니메이션은 transform과 opacity로만 만들고 나머지 속성은 뺐다. 흰 빛은 요소를 처음부터 흰색(`bg-white opacity-0`)으로 칠해두고 opacity만 움직인다. 흰 빛 요소에는 다른 내용이 없어서 흰색에 알파 0.32를 주는 것과 opacity를 0.32로 두는 건 화면에서 똑같이 보인다.

```css
@keyframes impact-flash {
    0% {
        opacity: 0;
    }
    0.01% {
        opacity: 0.32; /* 예전엔 background-color: rgba(255, 255, 255, 0.32) */
    }
    /* ... */
    100% {
        opacity: 0;
    }
}
```

NPC는 clip-path를 빼고 아래쪽을 기준으로 `translateY(30px) scaleY(0.08)`에서 `scaleY(1)`까지 키우는 것만 남겼다. 몬스터와 플레이어, 아이템 키프레임에서는 blur를 주던 줄만 지웠다. NPC와 플레이어 뒤에 깔리는 글로우에 늘 걸려 있던 blur도 같이 뺐다. 장소를 옮기는 슬라이드는 앞에서 본 것처럼 `translate3d`만 움직인다.

## 배운점

당연하게 쓰던 사진첩 스와이프도 직접 만들어보니 사진이 얼마나 따라올지, 라벨이 언제 꽉 찰지, 언제 이동할지를 전부 숫자로 정해야 했다. 라벨처럼 화면에 보이는 값과 실제 동작이 따로 계산되면 사용자는 그 차이를 그대로 겪는다. 결국 보이는 것과 실제로 일어나는 일은 같은 식에서 꺼내 써야 하는 것 같다.
