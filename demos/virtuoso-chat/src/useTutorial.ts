import { useEffect, type Dispatch } from 'react';

import type { MetricsEvent, MetricsSnapshot } from './metrics';

export type Side = 'before' | 'after';

export type TutorialState =
    | { step: 1; sends: number }
    | { step: 2; roundTrips: number }
    | { step: 3; afterSends: number; afterRoundTrips: number }
    | { step: 'done'; miss: number; shift: number };

export type TutorialAction =
    | { type: 'send'; side: Side }
    | { type: 'event'; event: MetricsEvent; side: Side }
    | { type: 'switched' }
    | { type: 'confirm'; snapshot: MetricsSnapshot }
    | { type: 'reset' };

export const TUTORIAL_START: TutorialState = { step: 1, sends: 0 };

const AFTER_MIN_SENDS = 6;
const AFTER_SETTLE_MS = 1500;
const STEP1_HINT_SENDS = 10;
const STEP2_HINT_ROUND_TRIPS = 2;

export const tutorialReducer = (state: TutorialState, action: TutorialAction): TutorialState => {
    switch (action.type) {
        case 'reset':
            return TUTORIAL_START;
        case 'switched':
            return state.step === 3 ? { step: 3, afterSends: 0, afterRoundTrips: 0 } : state;
        case 'confirm':
            return state.step === 3 ? { step: 'done', miss: action.snapshot.missCount, shift: action.snapshot.idleShiftSum } : state;
        case 'send':
            if (state.step === 1 && action.side === 'before') return { ...state, sends: state.sends + 1 };
            if (state.step === 3 && action.side === 'after') return { ...state, afterSends: state.afterSends + 1 };
            return state;
        case 'event': {
            const { event, side } = action;
            if (side === 'before') {
                if (state.step === 1 && event.kind === 'miss') return { step: 2, roundTrips: 0 };
                if (state.step === 2 && event.kind === 'shake') return { step: 3, afterSends: 0, afterRoundTrips: 0 };
                if (state.step === 2 && event.kind === 'roundTrip') return { ...state, roundTrips: state.roundTrips + 1 };
            } else if (state.step === 3 && event.kind === 'roundTrip') {
                return { ...state, afterRoundTrips: state.afterRoundTrips + 1 };
            }
            return state;
        }
    }
};

export type Guide = { counter: string | null; text: string; tone: 'normal' | 'good' | 'bad'; detail?: string };

export const guideFor = (state: TutorialState, side: Side): Guide => {
    switch (state.step) {
        case 1:
            if (side === 'after') return { counter: '1/3', text: '고치기 전으로 바꿔서 해 보세요', tone: 'normal' };
            return {
                counter: '1/3',
                text: state.sends >= STEP1_HINT_SENDS ? '더 빠르게 눌러 보세요' : '메시지 보내기를 빠르게 여러 번 눌러 보세요',
                tone: 'normal',
            };
        case 2:
            if (side === 'after') return { counter: '2/3', text: '고치기 전으로 바꿔서 해 보세요', tone: 'normal' };
            return {
                counter: '2/3',
                text:
                    state.roundTrips >= STEP2_HINT_ROUND_TRIPS
                        ? '조금 더 위로 올렸다가 내려와 보세요'
                        : '바닥에 붙지 않았습니다. 다음: 위로 조금 올렸다가 다시 내려와 보세요',
                tone: 'normal',
            };
        case 3:
            if (side === 'before') return { counter: '3/3', text: '흔들렸습니다. 다음: 고친 뒤로 바꾸고 똑같이 해 보세요', tone: 'normal' };
            return { counter: '3/3', text: '메시지 보내기를 여러 번 누르고, 위로 올렸다가 내려와 보세요', tone: 'normal' };
        case 'done':
            return state.miss === 0 && state.shift === 0
                ? {
                      counter: null,
                      text: '고친 뒤에는 바닥 미달 0회, 흔들림 0px',
                      tone: 'good',
                      detail: '높이를 미리 확정하고, 바닥 근처는 다시 그리지 않고, 크기가 바뀌면 직접 바닥에 붙여서',
                  }
                : { counter: null, text: `고친 뒤에도 감지됐습니다. 바닥 미달 ${state.miss}회, 흔들림 ${state.shift}px`, tone: 'bad' };
    }
};

export const useTutorialCompletion = (
    state: TutorialState,
    side: Side,
    dispatch: Dispatch<TutorialAction>,
    readSnapshot: () => MetricsSnapshot,
) => {
    const ready = state.step === 3 && side === 'after' && state.afterSends >= AFTER_MIN_SENDS && state.afterRoundTrips >= 1;
    const afterSends = state.step === 3 ? state.afterSends : 0;
    const afterRoundTrips = state.step === 3 ? state.afterRoundTrips : 0;
    useEffect(() => {
        if (!ready) return;
        const timer = window.setTimeout(() => dispatch({ type: 'confirm', snapshot: readSnapshot() }), AFTER_SETTLE_MS);
        return () => window.clearTimeout(timer);
    }, [ready, afterSends, afterRoundTrips, dispatch, readSnapshot]);
};
