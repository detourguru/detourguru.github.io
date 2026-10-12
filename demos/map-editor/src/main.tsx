import '@xyflow/react/dist/style.css';
import '../../shared/base.css';
import './map.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { applyThemeFromQuery } from '../../shared/theme';
import { MapDemo } from './MapDemo';

applyThemeFromQuery();

const root = document.getElementById('root');
if (root) {
    createRoot(root).render(
        <StrictMode>
            <MapDemo />
        </StrictMode>,
    );
}
