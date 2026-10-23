import { langFromQuery, type Lang } from '../../shared/lang';

export const LANG: Lang = langFromQuery();

const KO = {
    pageTitle: '가상 스크롤 채팅 재현',
    title: '채팅 바닥 고정',
    desc: '메시지가 늦게 커지면 스크롤이 바닥에서 떨어진다.',
    side: { before: '고치기 전', after: '고친 뒤' },
    compare: '비교 대상',
    send: '메시지 보내기',
    watchAuto: '자동으로 보기',
    restart: '처음부터',
    distance: (px: number) => `바닥까지 ${px}px`,
    missLabel: '바닥 미달',
    missUnit: (_count: number) => '회',
    shakeLabel: '흔들림',
    missFlash: (px: number) => `바닥에서 ${px}px 떨어진 채 멈춤`,
    shakeFlash: (px: number) => `가만히 있는데 ${px}px 흔들림`,
    imageLoading: '이미지 불러오는 중…',
    phase: {
        preparing: '준비 중',
        sending: (n: number, total: number) => `메시지 보내는 중 ${n}/${total}`,
        burst: '10개 한꺼번에',
        scrollUp: '위로 올렸다가',
        scrollDown: '다시 내리는 중',
        watching: '지켜보는 중',
    },
    guide: {
        switchToBefore: '고치기 전으로 바꿔서 해 보세요',
        pressFaster: '더 빠르게 눌러 보세요',
        pressSend: '메시지 보내기를 빠르게 여러 번 눌러 보세요',
        scrollMore: '조금 더 위로 올렸다가 내려와 보세요',
        missed: '바닥에 붙지 않았습니다. 다음: 위로 조금 올렸다가 다시 내려와 보세요',
        shook: '흔들렸습니다. 다음: 고친 뒤로 바꾸고 똑같이 해 보세요',
        tryAfter: '메시지 보내기를 여러 번 누르고, 위로 올렸다가 내려와 보세요',
        fixed: '고친 뒤에는 바닥 미달 0회, 흔들림 0px',
        fixedDetail: '높이를 미리 확정하고, 바닥 근처는 다시 그리지 않고, 크기가 바뀌면 직접 바닥에 붙여서',
        stillDetected: (miss: number, shift: number) => `고친 뒤에도 감지됐습니다. 바닥 미달 ${miss}회, 흔들림 ${shift}px`,
    },
    cause: {
        snippetLength: 12,
        kind: { image: '사진', choices: '선택지', stream: '스트리밍', text: '메시지' } as Record<string, string>,
        growth: {
            image: '이미지가 늦게 로드돼',
            choices: '선택지 버튼이 늦게 붙어',
            stream: '스트리밍 텍스트가 늘어나',
            text: '등장 애니메이션으로',
        } as Record<string, string>,
        unknown: '원인: 렌더 뒤에 메시지 높이가 바뀜',
        miss: (reason: string, from: number, to: number) => `원인: 메시지가 붙은 뒤 ${reason} 높이가 ${from}px에서 ${to}px로 커짐`,
        changed: (snippet: string, from: number, to: number) => `원인: ‘${snippet}’ 메시지 높이가 렌더 뒤 ${from}px에서 ${to}px로 바뀜`,
        replay: ' 등장 애니메이션이 처음부터 재생돼',
        remounted: (snippet: string, replay: string, from: number, to: number) =>
            `원인: 화면 밖으로 나갔던 ‘${snippet}’ 메시지가 다시 그려지면서${replay} 높이가 ${from}px에서 ${to}px로 다시 측정됨`,
    },
};

const EN: typeof KO = {
    pageTitle: 'Virtual scroll chat repro',
    title: 'Keeping a chat at the bottom',
    desc: 'When a message grows after it renders, the scroll stops short of the bottom.',
    side: { before: 'Before fix', after: 'After fix' },
    compare: 'Compare',
    send: 'Send message',
    watchAuto: 'Run automatically',
    restart: 'Start over',
    distance: (px) => `${px}px to bottom`,
    missLabel: 'missed bottom',
    missUnit: (n) => (n === 1 ? ' time' : ' times'),
    shakeLabel: 'jitter',
    missFlash: (px) => `Stopped ${px}px short of the bottom`,
    shakeFlash: (px) => `Jittered ${px}px while sitting still`,
    imageLoading: 'Loading image…',
    phase: {
        preparing: 'Getting ready',
        sending: (n, total) => `Sending message ${n}/${total}`,
        burst: 'Sending 10 at once',
        scrollUp: 'Scrolling up',
        scrollDown: 'Scrolling back down',
        watching: 'Watching',
    },
    guide: {
        switchToBefore: 'Switch to Before fix and try it',
        pressFaster: 'Try pressing faster',
        pressSend: 'Press Send message quickly, several times',
        scrollMore: 'Scroll up a bit further, then come back down',
        missed: "It didn't stick to the bottom. Next: scroll up a little, then come back down",
        shook: 'It jittered. Next: switch to After fix and do the same',
        tryAfter: 'Press Send message several times, then scroll up and come back down',
        fixed: 'After fix: missed bottom 0 times, jitter 0px',
        fixedDetail:
            'Heights are fixed up front, rows near the bottom are never redrawn, and the list is pinned to the bottom by hand whenever its size changes',
        stillDetected: (miss, shift) => `Still detected after the fix: missed bottom ${miss} times, jitter ${shift}px`,
    },
    cause: {
        snippetLength: 24,
        kind: { image: 'Photo', choices: 'Choices', stream: 'Streaming', text: 'Message' },
        growth: {
            image: 'the image loaded late',
            choices: 'the choice buttons were attached late',
            stream: 'the streaming text kept growing',
            text: 'the entry animation ran',
        },
        unknown: 'Cause: a message changed height after it rendered',
        miss: (reason, from, to) => `Cause: after the message was added, ${reason}, so its height grew from ${from}px to ${to}px`,
        changed: (snippet, from, to) => `Cause: the “${snippet}” message changed height from ${from}px to ${to}px after it rendered`,
        replay: ', replaying its entry animation from the start',
        remounted: (snippet, replay, from, to) =>
            `Cause: the “${snippet}” message left the screen and was drawn again${replay}, so its height was re-measured from ${from}px to ${to}px`,
    },
};

export const t = LANG === 'en' ? EN : KO;
