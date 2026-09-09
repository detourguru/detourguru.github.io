+++
date = '2026-09-09T13:20:00+09:00'
draft = false
title = '앱 테마가 10개일때 색각 이상을 어떻게 대응해야 할까?'
description = '테마가 10개인 앱에서 색각 이상 대응을 색 고르기로 접근했다가 실패했다. WCAG 대비비 공식으로 원인을 찾고 배경 토큰을 값이 아니라 관계로 고정한 과정.'
tags = ["접근성", "설계", "테스트"]
+++

디자이너가 없는 우리 팀! 보통 UI는 기획자가 피그마로 그려주거나 기획자가 바쁘면 내가 우선 컨셉을 받아서 목업을 작업하고 컨펌받는 방식으로 일하고 있다. 뚝딱뚝딱 여느 때처럼 UI를 그린 다음 어때요? 하고 목업을 보여주자 팀 동료가 난처한 듯이 말했다. "레이아웃은 예쁜데 사실 저 배지 색 구분이 잘 안가요 저 색약이잖아요."

## 색각 이상 대응은 색을 고르는 일이 아니다

동료 말을 듣고 제일 먼저 한 건 인터넷에 색각 이상이 있어도 잘 보이는 색상을 찾아본거였다. 그리고 콘텐츠 내 타입별 배지에 해당 색을 다시 부여해보았다. 그런데도 대단히 큰 차이가 나지는 않는다고했다. 그러면서 자기는 괜찮다고 하는거다. 하나도 괜찮지 않았다! 배지로 오브젝트의 타입을 쉽게 구분하게할 목적이었는데 전혀 목적을 달성할 수 없었던 거니까.

검색해보니 [WCAG(Web Content Accessibility Guidelines, 웹 접근성 국제 표준 가이드라인)](https://www.w3.org/WAI/standards-guidelines/wcag/)라는 문서가 있었다.

이 문서에서 내가 적용해야했던 부분은 [색 대비](https://www.w3.org/WAI/WCAG22/quickref/?versions=2.1&showtechniques=143#use-of-color)였다.

<div style="display:flex; gap:12px; flex-wrap:wrap; margin:20px 0;">
  <div style="flex:1; min-width:220px; box-sizing:border-box; background:#FFFFFF; color:#ffe833; border-radius:10px; padding:24px; text-align:center; border:1px solid #eee;">
    <div style="font-weight:700; font-size:1.6rem;">테스트</div>
    <div style="font-size:0.8rem; margin-top:8px; color:#555;">대비 1.25:1</div>
  </div>
  <div style="flex:1; min-width:220px; box-sizing:border-box; background:#000000; color:#ffe833; border-radius:10px; padding:24px; text-align:center;">
    <div style="font-weight:700; font-size:1.6rem;">테스트</div>
    <div style="font-size:0.8rem; margin-top:8px; opacity:0.9;">대비 16.84:1</div>
  </div>
</div>

왼쪽은 글자색(노랑)과 배경(흰색)의 명도가 비슷해서 거의 묻힌다. 오른쪽은 같은 글자색인데 배경이 검정이라 명도 차이가 커서 뚜렷이 보인다. 색상(hue)은 그대로 두고 배경과의 명도 차이만 바꿨는데 가독성이 이렇게 달라진다.

그러니까 배지의 색이 구분이 안간다는 말도 이해가 갔다. 우리는 여러 타입에 따른 배지 색을 부여했는데 그 중 특정 타입 2개의 대비비가 1.62:1이었다. 둘 다 비슷한 주황 계열이라 색상 구분이 어려운 사람에게는 사실상 같은 색으로 보였던 것이다. 권장 대비비가 4.5:1인것을 생각하면 반도 미치지 않는 수치였다.

<svg width="0" height="0" style="position:absolute;">
  <filter id="deuteranopia-sim">
    <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0" />
  </filter>
</svg>

<div style="display:flex; gap:32px; flex-wrap:wrap; margin:20px 0;">
  <div>
    <div style="font-size:0.8rem; opacity:0.7; margin-bottom:10px;">우리 눈에 보이는 색</div>
    <div style="display:flex; gap:10px;">
      <div style="width:64px; height:64px; border-radius:10px; background:#C8501E; display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.75rem; font-weight:600;">타입 A</div>
      <div style="width:64px; height:64px; border-radius:10px; background:#C8901E; display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.75rem; font-weight:600;">타입 B</div>
    </div>
    <div style="font-size:0.75rem; opacity:0.7; margin-top:8px;">대비 1.62:1</div>
  </div>
  <div>
    <div style="font-size:0.8rem; opacity:0.7; margin-bottom:10px;">적록색맹에게 보이는 색</div>
    <div style="display:flex; gap:10px; filter:url(#deuteranopia-sim);">
      <div style="width:64px; height:64px; border-radius:10px; background:#C8501E; display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.75rem; font-weight:600;">타입 A</div>
      <div style="width:64px; height:64px; border-radius:10px; background:#C8901E; display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.75rem; font-weight:600;">타입 B</div>
    </div>
    <div style="font-size:0.75rem; opacity:0.7; margin-top:8px;">거의 같은 색으로 보인다</div>
  </div>
</div>

## 테마가 10개면 색을 고정 값으로 줄 수 없다

더 큰 문제는 비슷한 시점에 앱에 테마 기능이 막 붙어서 10개 선택지 중 하나를 고를 수 있게 되었는데 역시나 접근성 최적화는 되어있지 않았다. 그럼 색각 이상 동료한테 40개 화면 10개의 테마를 다 QA 시켜야하나? 그럴수는 없었다.

우선 테스트코드로 강조색을 배경으로 쓰고 그 위에 글자색을 얹는 조합의 대비비를 테마별로 계산해봤다.

```ts
test('모든 테마에서 글자색이 강조색 위에서 기준치를 넘는다', () => {
    const relativeLuminance = (hex: string) => {
        // WCAG 제공 계산식을 사용했다
        const channels = [0, 2, 4]
            .map((offset) => parseInt(hex.replace('#', '').slice(offset, offset + 2), 16) / 255)
            .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (a: string, b: string) => {
        const [brighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
        return (brighter + 0.05) / (darker + 0.05);
    };

    Object.entries(THEMES).forEach(([id, { tokens }]) => {
        const ratio = contrast(tokens['--color-text'], tokens['--color-accent']);

        expect(`${id}:${ratio.toFixed(2)}`).toBe(`${id}:${Math.max(ratio, 4.5).toFixed(2)}`);
    });
});
```
그런데 테마 10개 중 6개가 권장 대비인 4.5:1에 못 미쳤고 제일 낮은 값은 2.48:1로 절반 수준이었다. 강조색은 테마마다 밝기가 제각각인데 글자색까지 밝은 계열인 테마에서 대비비가 낮게 계산된 것이다.

그럼 아예 글자색을 흰색이나 검정으로 고정하면 되지 않을까?

<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:20px 0;">
  <div style="box-sizing:border-box; background:#9B5DE5; color:#FFFFFF; border-radius:10px; padding:16px; text-align:center;">
    <div style="font-size:0.8rem; opacity:0.9;">라벤더 소프트 + 흰색</div>
    <div style="font-weight:700; margin-top:4px;">4.13:1 · 실패</div>
  </div>
  <div style="box-sizing:border-box; background:#9B5DE5; color:#000000; border-radius:10px; padding:16px; text-align:center;">
    <div style="font-size:0.8rem; opacity:0.7;">라벤더 소프트 + 검정</div>
    <div style="font-weight:700; margin-top:4px;">5.09:1 · 통과</div>
  </div>
  <div style="box-sizing:border-box; background:#24304A; color:#FFFFFF; border-radius:10px; padding:16px; text-align:center;">
    <div style="font-size:0.8rem; opacity:0.9;">차콜 블루 + 흰색</div>
    <div style="font-weight:700; margin-top:4px;">13.15:1 · 통과</div>
  </div>
  <div style="box-sizing:border-box; background:#24304A; color:#000000; border-radius:10px; padding:16px; text-align:center; border:1px solid #3d5170;">
    <div style="font-size:0.8rem; opacity:0.7;">차콜 블루 + 검정</div>
    <div style="font-weight:700; margin-top:4px;">1.60:1 · 실패</div>
  </div>
</div>

결과는 둘 다 실패였다. 흰색으로 고정하면 accent가 어두운 테마는 통과하지만 밝은 테마가 실패하고, 검정으로 고정하면 정반대였다. 글자색을 값 하나로 정하는 것 자체가 말이 안됐다.

### 값이 아니라 관계를 고정해주어야한다

그래서 `--color-accent-foreground`라는 토큰을 따로 만들었다. accent 위에 올라가는 글자색 전용 토큰이다.

```ts
// 다크테마
'--color-accent': '#24304A',
'--color-accent-foreground': '#FFFFFF',

// 컬러테마
'--color-accent': '#9B5DE5',
'--color-accent-foreground': '#000000',
```

<div style="display:flex; gap:12px; flex-wrap:wrap; margin:20px 0;">
  <div style="flex:1; min-width:200px; box-sizing:border-box; background:#24304A; color:#FFFFFF; border-radius:10px; padding:16px; text-align:center;">
    <div style="font-size:0.8rem; opacity:0.9;">다크테마 + foreground(흰색)</div>
    <div style="font-weight:700; margin-top:4px;">13.15:1 · 통과</div>
  </div>
  <div style="flex:1; min-width:200px; box-sizing:border-box; background:#9B5DE5; color:#000000; border-radius:10px; padding:16px; text-align:center;">
    <div style="font-size:0.8rem; opacity:0.7;">컬러테마 + foreground(검정)</div>
    <div style="font-weight:700; margin-top:4px;">5.09:1 · 통과</div>
  </div>
</div>

이걸 기준으로 같은 계산을 다시 돌리면 전 테마가 통과하고, 제일 낮은 값이 4.96:1이다.

## 대비비 기준을 통과해도 여전히 보이지 않는 것들
### 토큰을 짝으로 설계하지 않았다

처음에 설계할때부터 컬러토큰을 용도에 맞게 분리했어야하는데 그냥 "보기에 좋은" 색을 가져다 쓰다보니까 사실 이번의 테마 작업이 좀더 어렵고 까다로웠던 것 같다. 토큰 이름을 짝에 맞게 설계했으면 그냥 메인 색은 이거 배경색은 이거 등등 용도에 맞게 바꿀 수 있어서 테마 작업이 더욱 용이했을텐데.

다행히 eslint 규칙으로 `color-[#ffffff]`와 같은 커스텀 컬러토큰은 일절 못쓰게 막아둬서 그래도 비교적 용이한 작업이었다. 다음에 컬러토큰을 설계할때는 무조건 배경과 그 위에 얹힐 텍스트 색과 같이 짝으로 이루어진 토큰을 사용할걸 염두에 두고 작업할 것 같다.

### 상태를 색으로만 알려주고 있었다

토큰 테스트를 다 통과시킨 뒤에도 화면을 직접 훑어보니 여전히 문제인 곳이 있었다. 하단 탭바는 활성과 비활성을 표시하는 색상에 둘 다 명도 차이만 있었고 라벨 텍스트도 없어서 아이콘 색이 유일하게 활성/비활성을 구분하는 표시였다.

<div style="display:flex; gap:32px; flex-wrap:wrap; margin:20px 0; align-items:flex-start;">
  <div>
    <div style="font-size:0.8rem; opacity:0.7; margin-bottom:10px;">Before</div>
    <div style="display:flex; gap:14px;">
      <div style="width:28px; height:28px; border-radius:50%; background:#7E7796;"></div>
      <div style="width:28px; height:28px; border-radius:50%; background:#3B3D4C;"></div>
      <div style="width:28px; height:28px; border-radius:50%; background:#7E7796;"></div>
      <div style="width:28px; height:28px; border-radius:50%; background:#7E7796;"></div>
    </div>
  </div>
  <div>
    <div style="font-size:0.8rem; opacity:0.7; margin-bottom:10px;">After</div>
    <div style="display:flex; gap:14px;">
      <div style="width:28px; height:28px; border-radius:50%; background:#7E7796;"></div>
      <div style="text-align:center;">
        <div style="width:28px; height:28px; border-radius:50%; background:#9B5DE5;"></div>
        <div style="width:28px; height:3px; background:#9B5DE5; border-radius:2px; margin-top:6px;"></div>
      </div>
      <div style="width:28px; height:28px; border-radius:50%; background:#7E7796;"></div>
      <div style="width:28px; height:28px; border-radius:50%; background:#7E7796;"></div>
    </div>
  </div>
</div>

그래서 활성색을 accent 컬러로 주어서 색상 대비를 더 크게 주었고, 탭 위에 인디케이터 바도 표시해주어서 그냥 색이 아예 구분이 안가더라도 육안으로 어떤게 활성화 탭인지 구분되게 했다. 그리고 `aria-current="page"`도 추가해서 사람이 아니라 컴퓨터가 봐도 구분되게 했다.

> 참고: WCAG에서도 색 말고도 알 수 있는 경로를 하나 더 두는 것을 권장하고있다.

## 배운점

접근성의 중요성은 알고있지만 실제로 접근성을 고려해본 작업을 하는 것은 이번이 거의 처음이었던 것 같다. 색각 이상 대응을 할 때 잘 보이는 색을 고르는 것을 넘어 명도와 대비로 잘 구분되게 할 것, 그리고 색 말고도 구분할 수 있는 신호를 하나 더 두어야한다는 것을 배웠다. 

그리고 테마 작업을 하면서 컬러토큰도 다시 생각하게 됐다. 적은 수의 토큰을 돌려 쓰는 게 관리가 더 쉽다고 생각했지만 막상 항상 좋은 건 아니었다. 실제로 어떤 색 위에 어떤 색이 올라가는지를 생각해서 토큰을 나누는 게 오히려 관리하기 편하단걸 알게됐다.

무엇보다 테스트코드로 이런 정책을 강제해둔 게 마음에 든다. 나중에 내가 아닌 다른 사람이 작업하더라도 같은 기준을 지킬 수 있으니까. 이번 화면만 고친 게 아니라 팀에서 계속 지킬 수 있는 기준을 하나 만들어둔 것 같아서 뿌듯했다.
