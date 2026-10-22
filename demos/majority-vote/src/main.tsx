import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../../shared/base.css';
import { applyThemeFromQuery } from '../../shared/theme';
import { App } from './App';
import './styles.css';

applyThemeFromQuery();

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소가 없습니다');

createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
