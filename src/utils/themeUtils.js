// Consolidated App Themes
export const APP_THEMES = {
    tech: {
        id: 'tech',
        label: { en: 'Tech', nl: 'Tech' },
        colors: { primary: '#6366f1', hover: '#4f46e5', accent: '#f472b6', bgStart: '#0f172a', bgEnd: '#1e293b' } // Indigo + Slate
    },
    nature: {
        id: 'nature',
        label: { en: 'Nature', nl: 'Natuur' },
        colors: { primary: '#10b981', hover: '#059669', accent: '#3b82f6', bgStart: '#022c22', bgEnd: '#064e3b' } // Emerald + Forest
    },
    urban: {
        id: 'urban',
        label: { en: 'Urban', nl: 'Stads' },
        colors: { primary: '#06b6d4', hover: '#0891b2', accent: '#f59e0b', bgStart: '#083344', bgEnd: '#164e63' } // Cyan + Ocean
    },
    sunset: {
        id: 'sunset',
        label: { en: 'Sunset', nl: 'Zonsondergang' },
        colors: { primary: '#f43f5e', hover: '#e11d48', accent: '#a855f7', bgStart: '#4c0519', bgEnd: '#881337' } // Rose + Wine
    },
    warmth: {
        id: 'warmth',
        label: { en: 'Warmth', nl: 'Warmte' },
        colors: { primary: '#f59e0b', hover: '#d97706', accent: '#06b6d4', bgStart: '#451a03', bgEnd: '#78350f' } // Amber + Coffee
    }
};

export const applyTheme = (activeTheme) => {
    const root = document.documentElement;
    const theme = APP_THEMES[activeTheme];

    if (theme && theme.colors) {
        const c = theme.colors;
        root.style.setProperty('--primary', c.primary);
        root.style.setProperty('--primary-hover', c.hover);
        root.style.setProperty('--accent', c.accent);
        root.style.setProperty('--bg-gradient-start', c.bgStart);
        root.style.setProperty('--bg-gradient-end', c.bgEnd);

        // Update button text color (default to white if undefined)
        root.style.setProperty('--btn-text-color', c.btnText || 'white');

        // Update global text colors (default to light values if undefined)
        root.style.setProperty('--text-main', c.textMain || '#f8fafc');
        root.style.setProperty('--text-muted', c.textMuted || '#94a3b8');
    }
};
