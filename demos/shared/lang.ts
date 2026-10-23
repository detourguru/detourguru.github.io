export type Lang = 'ko' | 'en';

// 영문 글의 쇼트코드가 ?lang=en을 붙인다. 그 외에는 한국어
export const langFromQuery = (): Lang => (new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'ko');
