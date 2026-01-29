import React, { useState, useRef, useEffect } from 'react';

const SapLogin = () => {
    const [sapConfig, setSapConfig] = useState({
        url: '',
        client: '',
        user: '',
        password: ''
    });

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [status, setStatus] = useState({ type: '', msg: '' }); // type: 'error' | 'success' | 'info'
    const [isLoading, setIsLoading] = useState(false);

    // SSE & MCP State
    const eventSourceRef = useRef(null);
    const postEndpointRef = useRef(null);

    const handleChange = (field, value) => {
        setSapConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setStatus({ type: 'info', msg: 'Connecting to MCP Server...' });
        setIsLoading(true);

        try {
            // 1. Connect SSE
            const eventSource = new EventSource('http://localhost:3001/sse');
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                console.log("[SSE] Connection Opened!");
                setStatus({ type: 'info', msg: 'Connected to Server. Waiting for endpoint...' });
            };

            // Handle 'endpoint' event
            eventSource.addEventListener('endpoint', async (event) => {
                const data = event.data;
                console.log("[SSE] Endpoint Event:", data);

                postEndpointRef.current = `http://localhost:3001${data}`;
                console.log("[SSE] Endpoint received:", postEndpointRef.current);

                // 3. Send Login POST
                setStatus({ type: 'info', msg: 'Authenticating...' });
                try {
                    const payload = {
                        "jsonrpc": "2.0",
                        "method": "tools/call",
                        "params": {
                            "name": "login",
                            "arguments": {
                                "SAP_URL": sapConfig.url,
                                "SAP_USER": sapConfig.user,
                                "SAP_PASSWORD": sapConfig.password,
                                "SAP_CLIENT": sapConfig.client,
                                "SAP_LANGUAGE": "EN",
                                "NODE_TLS_REJECT_UNAUTHORIZED": "0"
                            }
                        },
                        "id": 1
                    };

                    await fetch(postEndpointRef.current, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    console.log("[MCP] Login Request Sent");

                } catch (err) {
                    setStatus({ type: 'error', msg: `Connection Error: ${err.message}` });
                    cleanup();
                }
            });

            eventSource.onmessage = async (event) => {
                const data = event.data;
                console.log("[SSE] Message:", data);

                // 2. Handle Endpoint (Sent initially)
                // The server sends the endpoint path relative to localhost:3001
                // Example: /messages?sessionId=...
                if (data.startsWith('/')) {
                    postEndpointRef.current = `http://localhost:3001${data}`;
                    console.log("[SSE] Endpoint received:", postEndpointRef.current);

                    // 3. Send Login POST
                    setStatus({ type: 'info', msg: 'Authenticating...' });
                    try {
                        const payload = {
                            "jsonrpc": "2.0",
                            "method": "tools/call",
                            "params": {
                                "name": "login",
                                "arguments": {
                                    "SAP_URL": sapConfig.url,
                                    "SAP_USER": sapConfig.user,
                                    "SAP_PASSWORD": sapConfig.password,
                                    "SAP_CLIENT": sapConfig.client,
                                    "SAP_LANGUAGE": "EN",
                                    "NODE_TLS_REJECT_UNAUTHORIZED": "0"
                                }
                            },
                            "id": 1
                        };

                        await fetch(postEndpointRef.current, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        console.log("[MCP] Login Request Sent");

                    } catch (err) {
                        setStatus({ type: 'error', msg: `Connection Error: ${err.message}` });
                        cleanup();
                    }
                    return;
                }

                // 4. Handle Result (JSON-RPC)
                try {
                    const json = JSON.parse(data);

                    if (json.result && json.result.content && json.result.content[0]) {
                        const innerText = json.result.content[0].text;

                        // Parse inner JSON string if it exists
                        // The server sends double-encoded JSON sometimes: "{\"message\":...}"
                        let resultObj;
                        try {
                            resultObj = JSON.parse(innerText);
                        } catch {
                            // Fallback if plain text
                            resultObj = { message: innerText };
                        }

                        if (resultObj.message && resultObj.message.includes("Login configuration updated")) {
                            // SUCCESS
                            setIsLoggedIn(true);
                            setStatus({ type: 'success', msg: 'Login Successful' });
                            setIsLoading(false);
                        } else if (resultObj.error) {
                            // FAILURE
                            throw new Error(resultObj.error);
                        }
                    } else if (json.error) {
                        throw new Error(json.error.message || "Unknown RPC Error");
                    }

                } catch (err) {
                    console.error("[SSE] Error parsing result:", err);
                    // If it's a login failure, it often comes here
                    setStatus({ type: 'error', msg: err.message });
                    cleanup(); // disconnect on failure
                }
            };

            eventSource.onerror = (err) => {
                console.error("[SSE] Connection Error:", err);
                // Only show error if we aren't already logged in (SSE might close/reconnect)
                if (!isLoggedIn) {
                    setStatus({ type: 'error', msg: 'Failed to connect to MCP Server' });
                    cleanup();
                }
            };

        } catch (e) {
            setStatus({ type: 'error', msg: e.message });
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        cleanup();
        setIsLoggedIn(false);
        setStatus({ type: 'info', msg: 'Logged out' });
    };

    const cleanup = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setIsLoading(false);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) eventSourceRef.current.close();
        };
    }, []);

    return (
        <div className="settings-panel" style={{ marginTop: '0', marginBottom: '20px' }}>
            <h2>SAP System Connection</h2>
            <form onSubmit={isLoggedIn ? (e) => { e.preventDefault(); handleLogout(); } : handleLogin} className="settings-grid">
                <label className="field">
                    <span>SAP URL</span>
                    <input
                        type="text"
                        placeholder="https://example.sap.corp:44300"
                        value={sapConfig.url}
                        onChange={(e) => handleChange('url', e.target.value)}
                        disabled={isLoggedIn || isLoading}
                    />
                </label>
                <label className="field">
                    <span>SAP Client</span>
                    <input
                        type="text"
                        placeholder="100"
                        value={sapConfig.client}
                        onChange={(e) => handleChange('client', e.target.value)}
                        disabled={isLoggedIn || isLoading}
                    />
                </label>
                <label className="field">
                    <span>SAP User</span>
                    <input
                        type="text"
                        placeholder="User"
                        value={sapConfig.user}
                        onChange={(e) => handleChange('user', e.target.value)}
                        disabled={isLoggedIn || isLoading}
                    />
                </label>
                <label className="field">
                    <span>SAP Password</span>
                    <input
                        type="password"
                        placeholder="Password"
                        value={sapConfig.password}
                        onChange={(e) => handleChange('password', e.target.value)}
                        disabled={isLoggedIn || isLoading}
                    />
                </label>

                {status.msg && (
                    <div style={{
                        fontSize: '12px',
                        padding: '8px',
                        borderRadius: '4px',
                        background: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: status.type === 'error' ? '#ef4444' : (status.type === 'success' ? '#10b981' : '#6b7280')
                    }}>
                        {status.msg}
                    </div>
                )}

                <button
                    type="submit"
                    className="btn-primary"
                    style={{ width: '100%' }}
                    disabled={isLoading}
                >
                    {isLoading ? 'Connecting...' : (isLoggedIn ? 'Logout' : 'Login')}
                </button>
            </form>
        </div>
    );
};

export default SapLogin;
