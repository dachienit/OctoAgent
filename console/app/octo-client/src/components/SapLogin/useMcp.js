import { useState, useRef, useEffect, useCallback } from 'react';

export const useMcp = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [status, setStatus] = useState({ type: '', msg: '' });
    const [isLoading, setIsLoading] = useState(false);

    // Refs for persistence
    const eventSourceRef = useRef(null);
    const postEndpointRef = useRef(null);
    const pendingRequests = useRef(new Map());

    const cleanup = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setIsLoading(false);
        pendingRequests.current.forEach(({ reject, timeout }) => {
            clearTimeout(timeout);
            reject(new Error("Connection closed"));
        });
        pendingRequests.current.clear();
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) eventSourceRef.current.close();
        };
    }, []);

    const callMcpTool = useCallback((name, args, id = null) => {
        if (!postEndpointRef.current) return Promise.reject(new Error("No Endpoint. Login first."));

        const requestId = id || Date.now();
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                if (pendingRequests.current.has(requestId)) {
                    pendingRequests.current.delete(requestId);
                    reject(new Error(`Timeout waiting for response to ${name} (ID: ${requestId})`));
                }
            }, 60000); // 60s timeout

            pendingRequests.current.set(requestId, { resolve, reject, timeout });

            const payload = {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": { name, arguments: args },
                "id": requestId
            };

            try {
                const res = await fetch(postEndpointRef.current, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                await res.text(); // Wait for send, response comes via SSE
            } catch (networkErr) {
                clearTimeout(timeout);
                pendingRequests.current.delete(requestId);
                reject(networkErr);
            }
        });
    }, []);

    const connect = useCallback(async (sapConfig) => {
        setStatus({ type: 'info', msg: 'Connecting to MCP Server...' });
        setIsLoading(true);
        postEndpointRef.current = null; // Reset endpoint

        try {
            const eventSource = new EventSource('http://localhost:3001/sse');
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                console.log("[SSE] Connection Opened!");
                setStatus({ type: 'info', msg: 'Connected to Server. Waiting for endpoint...' });
            };

            eventSource.addEventListener('endpoint', async (event) => {
                const data = event.data;
                console.log("[SSE] Endpoint Event:", data);
                postEndpointRef.current = `http://localhost:3001${data}`;

                setStatus({ type: 'info', msg: 'Authenticating...' });
                try {
                    const result = await callMcpTool('login', {
                        "SAP_URL": sapConfig.url,
                        "SAP_USER": sapConfig.user,
                        "SAP_PASSWORD": sapConfig.password,
                        "SAP_CLIENT": sapConfig.client,
                        "SAP_LANGUAGE": "EN", // Default
                        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
                    }, 1);
                    console.log("[MCP] Login Result:", result);

                    if (result && result.message && result.message.includes("Login configuration updated")) {
                        setIsLoggedIn(true);
                        setStatus({ type: 'success', msg: 'Login Successful' });
                        setIsLoading(false);
                    }
                } catch (err) {
                    setStatus({ type: 'error', msg: `Connection Error: ${err.message}` });
                    cleanup();
                }
            });

            eventSource.onmessage = (event) => {
                const data = event.data;
                if (data.startsWith('/')) {
                    postEndpointRef.current = `http://localhost:3001${data}`;
                    return;
                }

                try {
                    const json = JSON.parse(data);
                    if (json.id && pendingRequests.current.has(json.id)) {
                        const { resolve, reject, timeout } = pendingRequests.current.get(json.id);
                        clearTimeout(timeout);
                        pendingRequests.current.delete(json.id);

                        if (json.error) {
                            reject(new Error(json.error.message));
                        } else {
                            // Unwrap content logic
                            if (json.result && json.result.content && json.result.content[0] && json.result.content[0].text) {
                                try {
                                    const inner = JSON.parse(json.result.content[0].text);
                                    resolve(inner);
                                } catch {
                                    resolve(json.result.content[0].text);
                                }
                            } else {
                                resolve(json.result);
                            }
                        }
                    }
                } catch (err) {
                    console.error("[SSE] Error parsing result:", err);
                }
            };

            eventSource.onerror = (err) => {
                console.error("[SSE] Connection Error:", err);
                if (!isLoggedIn) { // Only report if not already logged in/stable
                    setStatus({ type: 'error', msg: 'Failed to connect to MCP Server' });
                    cleanup();
                }
            };

        } catch (e) {
            setStatus({ type: 'error', msg: e.message });
            setIsLoading(false);
        }
    }, [callMcpTool, cleanup, isLoggedIn]);

    const disconnect = useCallback(async () => {
        if (postEndpointRef.current) {
            try {
                // Fire and forget logout
                callMcpTool('logout', {}, 2).catch(console.error);
            } catch (err) {
                console.error("Logout failed", err);
            }
        }
        cleanup();
        setIsLoggedIn(false);
        setStatus({ type: 'info', msg: 'Logged out' });
    }, [callMcpTool, cleanup]);

    return {
        isLoggedIn,
        status,
        setStatus,
        isLoading,
        connect,
        disconnect,
        callMcpTool
    };
};
