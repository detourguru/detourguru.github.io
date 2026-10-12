import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../../shared/base.css';
import { applyThemeFromQuery } from '../../shared/theme';
import { App } from './App';
import './styles.css';

applyThemeFromQuery();

const rootEl = document.getElementById('root');
if (rootEl) {
    createRoot(rootEl).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}
