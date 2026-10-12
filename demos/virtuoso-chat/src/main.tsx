import { createRoot } from 'react-dom/client';

import '../../shared/base.css';
import { applyThemeFromQuery } from '../../shared/theme';
import { App } from './App';
import './styles.css';

applyThemeFromQuery();

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소가 없습니다');

// StrictMode는 마운트를 두 번 일으켜 재마운트 측정을 흐리므로 쓰지 않는다
createRoot(root).render(<App />);
