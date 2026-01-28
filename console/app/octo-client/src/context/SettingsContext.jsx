import React, { createContext, useState, useEffect, useContext } from 'react';

const SettingsContext = createContext();

const STORAGE_KEY = "chatbox_env_settings_v1";

const defaultEnv = {
    brainId: "e39Lh3w2teng", // Default Requested
    ntid: "",
    customPrompt: "",
    theme: "colorful", // Default Requested
    skill: ""
};

// Helper to apply theme to body
function applyTheme(theme) {
    document.body.classList.remove("theme-dark-gray", "theme-black", "theme-white");
    if (theme && theme !== "colorful") {
        document.body.classList.add(`theme-${theme}`);
    }
}

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState(defaultEnv);

    // Fetch Settings from Backend (after Auth check ideally, but we try on mount)
    useEffect(() => {
        const initSettings = async () => {
            try {
                // 1. Get User Info for NTID
                const userRes = await fetch('/api/userinfo');
                let username = "";
                if (userRes.ok) {
                    const userData = await userRes.json();
                    username = userData.username;
                }

                // 2. Get Saved Env
                const envRes = await fetch('/settings/UserEnv');
                let backendSettings = {};

                if (envRes.ok) {
                    const envData = await envRes.json();
                    // OData response usually { value: [...] } or single object
                    const data = envData.value ? envData.value[0] : envData;

                    if (data) {
                        backendSettings = {
                            brainId: data.brainId,
                            customPrompt: data.customPrompt,
                            theme: data.theme
                        };
                    }
                }

                // 3. Merge: Backend > Storage (optional) > Defaults
                // For this requirement: Backend takes precedence over defaults.
                // If backend missing, use defaults.

                setSettings(prev => ({
                    ...prev,
                    ntid: username || prev.ntid,
                    ...backendSettings
                }));

            } catch (e) {
                console.error("Failed to init settings", e);
            }
        };
        initSettings();
    }, []);

    // Apply Theme Only (No LocalStorage)
    useEffect(() => {
        // localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); // REMOVED
        applyTheme(settings.theme);
    }, [settings.theme]); // dependency on theme only

    const updateSettings = (newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    const saveSettingsToBackend = async () => {
        try {
            const payload = {
                brainId: settings.brainId,
                customPrompt: settings.customPrompt,
                theme: settings.theme
            };

            const res = await fetch('/settings/UserEnv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error("Failed to save to backend details:", res.status, errText);
                throw new Error("Failed to save to backend");
            }
            return true;
        } catch (e) {
            console.error("Save settings error", e);
            return false;
        }
    };

    const resetSettings = async () => {
        let ntid = settings.ntid;
        // Try to fetch NTID again just in case
        try {
            const res = await fetch('/api/userinfo');
            if (res.ok) {
                const data = await res.json();
                if (data.username) ntid = data.username;
            }
        } catch (e) { }

        // Reset to defaults but keep NTID
        const newSettings = { ...defaultEnv, ntid };
        setSettings(newSettings);

        // Also save reset to backend? Requirement doesn't explicitly say, but logical.
        // For now, let user hit save to confirm reset persistence or do it auto?
        // Let's leave it manual save for safety.
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, resetSettings, saveSettingsToBackend }}>
            {children}
        </SettingsContext.Provider>
    );
}

export const useSettings = () => useContext(SettingsContext);
