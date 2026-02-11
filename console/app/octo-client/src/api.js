let csrfToken = null;

async function fetchCsrfToken() {
    if (csrfToken) return csrfToken;
    try {
        console.log('🔐 Fetching CSRF token...');
        const response = await fetch('/api/me', {
            method: 'GET',
            headers: { 'X-CSRF-Token': 'Fetch' }
        });
        const token = response.headers.get('X-CSRF-Token');
        if (token) {
            csrfToken = token;
            console.log('✅ CSRF token fetched successfully');
        }
        return token;
    } catch (error) {
        console.error('❌ Error fetching CSRF token:', error);
        return null;
    }
}

export const api = {
    chat: async (message, env, option = null, reLoad = false, metadata = {}) => {
        try {
            const token = await fetchCsrfToken();
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['X-CSRF-Token'] = token;

            const { signal, ...restMetadata } = metadata;

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers,
                signal: signal,
                body: JSON.stringify({
                    message,
                    env,
                    option,
                    reLoad,
                    ...restMetadata
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || err.message || `HTTP Error ${response.status}`);
            }
            return await response.json();
        } catch (e) {
            console.error("Chat API Error:", e);
            throw e;
        }
    },

    getUserInfo: async () => {
        // Use the new /api/me endpoint which is more robust and returns formatted info
        const res = await fetch('/api/me');
        if (!res.ok) throw new Error("Unauthorized");
        return await res.json();
    },

    getSkills: async () => {
        const res = await fetch('/api/skills()');
        if (!res.ok) return [];
        const data = await res.json();
        return data.value || data;
    },

    getSkill: async (filename) => {
        const res = await fetch(`/api/getSkill(filename='${encodeURIComponent(filename)}')`);
        if (!res.ok) throw new Error("Failed to load skill");
        const data = await res.json();
        return data;
    },

    saveSkill: async (filename, content) => {
        const token = await fetchCsrfToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['X-CSRF-Token'] = token;

        const res = await fetch('/api/saveSkill', {
            method: 'POST',
            headers,
            body: JSON.stringify({ filename, content })
        });
        if (!res.ok) throw new Error("Failed to save skill");
        return true;
    }
};
