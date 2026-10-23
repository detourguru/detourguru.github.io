// 실제 값은 iOS가 키보드를 띄울 때 알려 준다. 데모는 예시 값을 쓴다
export const KEYBOARD_ANIMATION_MS = 250;

export const SCREEN_HEIGHT = 300;
export const KEYBOARD_HEIGHT = 150;

export const END_MS = 600;
export const SLOW = 4; // 재생할 때 실제보다 4배 느리게

// 채팅 말풍선은 글자 없이 길이만 남긴다. width는 채팅 폭 대비 %
export const MESSAGES = [
    { id: 1, mine: false, width: 62 },
    { id: 2, mine: true, width: 44 },
    { id: 3, mine: false, width: 34 },
    { id: 4, mine: true, width: 70 },
    { id: 5, mine: false, width: 52 },
    { id: 6, mine: true, width: 30 },
];
