export type Mode = 'original' | 'patched';

// 키보드가 뜨기 시작한 뒤 플러그인이 웹뷰를 줄이기까지 기다리는 시간(ms). Keyboard.m의 onKeyboardWillShow를 옮겼다
export const resizeDelay = (mode: Mode, animationMs: number) => (mode === 'original' ? animationMs + 200 : 0);

// 키보드가 올라온 정도. 0이면 내려가 있고 1이면 다 올라왔다
export const keyboardProgress = (elapsedMs: number, animationMs: number) => {
    if (elapsedMs <= 0) return 0;
    if (elapsedMs >= animationMs) return 1;
    return 1 - (1 - elapsedMs / animationMs) ** 3;
};
