import { useEffect, type Dispatch } from 'react';

import type { MetricsEvent, MetricsSnapshot } from './metrics';
import { t } from './text';

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
            if (side === 'after') return { counter: '1/3', text: t.guide.switchToBefore, tone: 'normal' };
            return {
                counter: '1/3',
                text: state.sends >= STEP1_HINT_SENDS ? t.guide.pressFaster : t.guide.pressSend,
                tone: 'normal',
            };
        case 2:
            if (side === 'after') return { counter: '2/3', text: t.guide.switchToBefore, tone: 'normal' };
            return {
                counter: '2/3',
                text: state.roundTrips >= STEP2_HINT_ROUND_TRIPS ? t.guide.scrollMore : t.guide.missed,
                tone: 'normal',
            };
        case 3:
            if (side === 'before') return { counter: '3/3', text: t.guide.shook, tone: 'normal' };
            return { counter: '3/3', text: t.guide.tryAfter, tone: 'normal' };
        case 'done':
            return state.miss === 0 && state.shift === 0
                ? {
                      counter: null,
                      text: t.guide.fixed,
                      tone: 'good',
                      detail: t.guide.fixedDetail,
                  }
                : { counter: null, text: t.guide.stillDetected(state.miss, state.shift), tone: 'bad' };
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
