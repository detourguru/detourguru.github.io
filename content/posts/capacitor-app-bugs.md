+++
date = '2026-10-23T00:00:00+09:00'
draft = true
title = '웹 앱을 Capacitor로 감싸고 나서 생긴 결함 고치기'
description = '몽글은 React 웹 앱을 Capacitor로 앱 안의 웹뷰에 띄워서 iOS와 Android 앱으로 낸다. 그런데 iOS에서 키보드가 다 올라온 뒤에야 화면이 줄어들었고, Android release 빌드는 켜자마자 꺼졌다. iOS에서는 친구 요청 알림이 오지 않는 일도 있었다. 원인은 키보드 플러그인의 iOS 코드와 R8이 줄인 Capacitor 어노테이션, 끊긴 채 남은 SSE 연결이었다. 그래서 플러그인을 패치하고 R8 규칙을 넣었고, 서버 heartbeat와 앱 복귀 처리를 추가했다.'
tags = ["디버깅"]
+++

<!-- 저자 확인 필요:
- 태그가 하나뿐이다. data/tags.yaml에서 맞는 태그가 디버깅밖에 없다. 두 번째 태그(예: 모바일)를 새로 만들지. 만들면 allowed_en도 같이 추가
- SSE 섹션은 초안 realtime-push-and-poll.md의 "끊긴 SSE 연결이 살아 있는 것처럼 남았다" 섹션과 내용이 겹친다. 어느 글에 둘지
- 4월 키보드 작업 때는 Android 프로젝트만 있었다(iOS 프로젝트는 10-13 5545422bb에서 처음 추가). 그래서 resize 값이 영향이 없었다는 건 플러그인 소스로 확인했다. 그때 화면을 실제로 바꾼 게 같이 고친 CSS였다는 건 추정이라 쓰지 않았다
- 키보드 패치는 처음에 대기를 0.01초로 줄였다가(506117fa7) 다음 커밋(71cf44c99)에서 0초와 performWithoutAnimation으로 바꿨다. 본문에는 지금 코드만 썼다
- release 크래시: 100% 재현, 죽은 위치(checkPermissions), 고친 뒤 푸시 권한 창까지 확인했다는 건 proguard-rules.pro 주석에만 있다. 크래시 로그 원본이 있으면 확인. 처음 알게 된 상황도
- SSE: 끊긴 원인이 백그라운드 복귀라는 건 코드 주석과 ARCHITECTURE.md에만 있어서 헤더와 본문에 쓰지 않았다. 실기기에서 고쳐진 걸 확인했는지
- SSE: 서버 주석의 "fetch-event-source는 SSE 주석을 넘겨주지 않는다"는 라이브러리 코드(parse.js)와 다르다. 주석 줄은 버리지만 뒤의 빈 줄에서 빈 메시지를 onmessage로 넘긴다. 그래서 ping을 이벤트로 보낸 이유는 뺐다
- 단계별 현상 사진이나 영상
- keyboard-resize 데모: 키보드 애니메이션 시간 0.25초와 키보드, 화면 높이는 예시 값이다. 원본에서 웹뷰를 줄이기 전까지 입력창이 키보드에 가려지는 모습이 실기기와 같은지
- 배운점의 가장 어려웠던 점 소감, "나눠 보려고 한다" 문장
- 영문판(.en.md)이 필요한지
-->

몽글은 React로 만든 웹 앱을 Capacitor로 앱 안의 웹뷰에 띄워서 iOS와 Android 앱으로 낸다. 네이티브 쪽은 하나도 모르는 상태에서 이 앱의 iOS와 Android 빌드까지 하게 됐다.

앱으로 낸 뒤에는 iOS에서 키보드가 다 올라온 뒤에야 화면이 줄어들었고, Android release 빌드는 켜자마자 꺼졌다. iOS에서 친구 요청을 받아도 알림이 오지 않는 일도 있었다.

## 키보드가 다 올라온 뒤에야 화면이 줄어들었다

채팅 화면은 입력창이 맨 아래에 있다. 그래서 키보드가 뜨면 그만큼 웹뷰 높이를 빼야 입력창이 가려지지 않는다. Capacitor 키보드 플러그인에서는 키보드가 뜰 때 무엇을 줄일지 `resize` 옵션으로 정한다. `native`로 두면 플러그인이 웹뷰 전체 높이를 키보드만큼 줄인다.

4월에는 Android에서 이 옵션을 `none`, `body`, `native`로 하루 동안 바꿔 가며 맞췄다. 그런데 플러그인 타입 정의를 보면 `resize`는 iOS에서만 동작한다.

```ts
/**
 * Configure the way the app is resized when the Keyboard appears.
 *
 * Only available on iOS.
 * ...
 */
resize?: KeyboardResize;
```

Android 플러그인 코드도 `resizeOnFullScreen`만 읽고 `resize`는 읽지 않는다. 그때는 iOS 프로젝트가 아직 없었으니까, 4월에 바꾼 `resize` 값은 앱에 아무 영향이 없었던 거였다.

10월에 iOS 프로젝트를 추가하고 나서야 `resize: native`가 동작했다. 그런데 이번에는 키보드가 다 올라오고 조금 지나서야 화면이 줄어들었다. 웹뷰 높이를 바꾸는 건 플러그인이라서, 플러그인의 iOS 코드인 `Keyboard.m`을 `node_modules` 안에서 열어 봤다.

키보드가 뜨기 시작하면 iOS가 플러그인에 알림을 보낸다. 그런데 플러그인은 이 알림을 받고도 바로 웹뷰를 줄이지 않았다. 키보드 애니메이션 시간에 0.2초를 더한 만큼 기다린 다음에 줄였다. 키보드 애니메이션이 끝나고도 0.2초가 더 지나야 화면이 따라오는 것이 문제였다.

`node_modules` 안의 코드는 직접 고쳐도 `npm install`을 다시 하면 원래대로 돌아간다. 그래서 고친 내용을 patch-package로 `patches/@capacitor+keyboard+8.0.1.patch` 파일에 남겼다. 설치가 끝나면 patch-package가 이 파일을 다시 적용한다.

```json
"postinstall": "patch-package",
```

고친 코드는 기다리지 않고 바로 웹뷰 높이를 바꾼다. 높이가 바뀔 때 iOS 애니메이션이 붙지 않게 `performWithoutAnimation`으로 감쌌다.

```objc
[UIView performWithoutAnimation:^{
  [self setKeyboardHeight:height delay:0]; // 애니메이션 시간 + 0.2초였던 대기를 0으로
}];
```

{{< demo name="keyboard-resize" height="auto" >}}

## release 빌드만 켜자마자 꺼졌다

Android 앱은 debug 빌드로 설치하면 멀쩡했다. 스토어에 올릴 release 빌드를 설치했을 때만 앱이 뜨자마자 종료됐다. release 빌드에는 debug 빌드에 없는 `minifyEnabled`가 켜져 있다.

```gradle
release {
    ...
    minifyEnabled true
    ...
}
```

`minifyEnabled`를 켜면 빌드할 때 R8이 안 쓰는 클래스를 지우고 이름을 짧게 바꾼다. 웹 번들러가 minify하면서 변수 이름을 줄이는 것과 비슷하다.

죽은 곳은 앱이 켜지면서 푸시 알림을 준비할 때 부르는 `PushNotifications.checkPermissions()`였다. Capacitor는 플러그인이 쓰는 권한을 플러그인 클래스에 붙은 `@CapacitorPlugin` 어노테이션에서 읽는다.

```java
CapacitorPlugin annotation = plugin.getPluginHandle().getPluginAnnotation();
for (Permission perm : annotation.permissions()) { // annotation이 null이면 여기서 죽는다
```

Capacitor 기본 R8 규칙은 `@CapacitorPlugin`이 붙은 플러그인 클래스는 지키지만, 어노테이션 타입 자체는 지키지 않는다. 그래서 R8이 어노테이션 타입을 줄인 release 빌드에서는 `getPluginAnnotation()`이 `null`을 돌려줬다. 어노테이션을 못 찾은 채로 바로 `.permissions()`를 부른 것이 문제였다.

그래서 앱의 `proguard-rules.pro`에 어노테이션 패키지를 통째로 지키는 규칙 두 줄을 넣었다.

```
-keep class com.getcapacitor.annotation.** { *; }
-keepclassmembers class com.getcapacitor.annotation.** { *; }
```

`minifyEnabled`를 켜 둔 채로도 release 빌드가 정상으로 뜨게 됐다.

## iOS에서 친구 요청 알림이 오지 않았다

앱은 서버가 이벤트를 밀어 보내는 SSE 연결을 하나 열어 두고, 친구 요청과 수락도 이 연결로 받는다. 그런데 iOS에서는 친구 요청을 받아도 알림이 안 떴다. 친구 목록도 바뀌지 않았다.

앱의 재연결 코드는 연결이 닫혔다는 `onclose`나 에러가 났다는 `onerror`가 와야 돌았다. 그런데 끊긴 SSE 연결이 에러도 종료도 없이 멈춘 채로 남아서 둘 다 오지 않았다. 서버 heartbeat도 주석 처리돼 있었으니, 앱은 연결이 살아 있는지 알 방법이 없었다.

게다가 서버는 친구 요청과 수락 이벤트를 그 순간 붙어 있는 연결에만 보내고, 나중에 붙은 연결에는 보내지 않는다. 그러니 다시 연결돼도 끊겨 있던 동안의 이벤트는 오지 않았다.

그래서 주석 처리돼 있던 heartbeat를 다시 켜서 서버가 25초마다 `ping` 이벤트를 보내게 했다.

```ts
const heartbeat = setInterval(() => {
    ...
    res.write(`event: ping\ndata: {}\n\n`);
    ...
}, SSE_HEARTBEAT_MS); // 25초
```

앱은 ping이 오기 시작한 연결에서 60초 동안 아무것도 못 받으면 그 연결을 버리고 새로 연다. 새로 연결되면 친구 목록을 다시 받아서 끊겨 있던 동안 놓친 요청과 수락을 메운다.

앱으로 돌아왔을 때도 한 번 더 확인한다. Capacitor의 `@capacitor/app` 플러그인은 앱이 다시 화면에 나오면 `appStateChange` 이벤트를 웹으로 넘겨준다. 이 이벤트가 왔을 때 SSE 연결로 마지막으로 무언가를 받은 지 30초가 넘었으면, 60초를 다 기다리지 않고 바로 새로 연다.

```ts
void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) reviveStaleAppRealtimeStream(queryClient); // 마지막으로 받은 지 30초가 넘었으면 새로 연다
}).then(...);
```

마지막 ping을 받고 10초 뒤에 앱으로 돌아오면 연결을 그대로 두고, 5분 뒤에 돌아오면 바로 새로 연다.

## 배운점

<!-- 저자 확인 필요: 가장 어려웠던 점 소감 -->

네이티브를 하나도 모르고 시작했는데, 세 버그를 고친 곳은 모두 웹 화면 코드 밖이었다. 키보드는 플러그인의 iOS 코드를, 크래시는 Android 빌드 규칙을 고쳤다. 친구 알림은 서버 heartbeat와 Capacitor가 넘겨주는 앱 복귀 이벤트로 고쳤다.

다음에 앱에서만 생기는 버그를 만나면 그 동작을 웹뷰가 하는지, 플러그인이나 빌드 도구가 하는지부터 나눠 보려고 한다. 결국 Capacitor로 웹 앱을 그대로 앱으로 낼 수는 있어도, 웹뷰 밖에서 무슨 일이 일어나는지는 알아야 하는 것 같다.
