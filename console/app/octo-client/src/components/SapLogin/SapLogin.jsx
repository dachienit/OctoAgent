import React, { useState, useRef, useEffect } from 'react';

const SapLogin = () => {
    const [sapConfig, setSapConfig] = useState({
        url: '',
        client: '',
        user: '',
        password: ''
    });

    const [testInputs, setTestInputs] = useState({
        transport: 'S4HK902742',
        package: 'ZPK_IYH1HC',
        objectName: 'Z_CL_PO_PROCESS',
        sourceCode: `class Z_CL_PO_PROCESS definition
  public
  final
  create public .

public section.

  methods GET_PRICE_RANGES
    importing
      !IV_A type I
      !IV_B type I
    returning
      value(RV_SUBRC) type SY-SUBRC .
  PROTECTED SECTION.
  PRIVATE SECTION.
ENDCLASS.

CLASS Z_CL_PO_PROCESS IMPLEMENTATION.
  METHOD get_price_ranges.
    rv_subrc = 4. 
  ENDMETHOD.
ENDCLASS.`
    });

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [status, setStatus] = useState({ type: '', msg: '' });
    const [isLoading, setIsLoading] = useState(false);

    // SSE & MCP State
    const eventSourceRef = useRef(null);
    const postEndpointRef = useRef(null);

    // Pending Requests Map: RequestID -> { resolve, reject, timer }
    const pendingRequests = useRef(new Map());

    const handleChange = (field, value) => {
        setSapConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleTestChange = (field, value) => {
        setTestInputs(prev => ({ ...prev, [field]: value }));
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setStatus({ type: 'info', msg: 'Connecting to MCP Server...' });
        setIsLoading(true);

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
                console.log("[SSE] Endpoint received:", postEndpointRef.current);

                setStatus({ type: 'info', msg: 'Authenticating...' });
                try {
                    // Login uses ID 1
                    const result = await callMcpTool('login', {
                        "SAP_URL": sapConfig.url,
                        "SAP_USER": sapConfig.user,
                        "SAP_PASSWORD": sapConfig.password,
                        "SAP_CLIENT": sapConfig.client,
                        "SAP_LANGUAGE": "EN",
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

            eventSource.onmessage = async (event) => {
                const data = event.data;
                console.log("[SSE] Message:", data);

                // Handle Endpoint (Sent initially or repeatedly)
                if (data.startsWith('/')) {
                    postEndpointRef.current = `http://localhost:3001${data}`;
                    return;
                }

                // Handle JSON-RPC Result
                try {
                    const json = JSON.parse(data);

                    // Check if this result matches a pending request
                    if (json.id && pendingRequests.current.has(json.id)) {
                        const { resolve, reject, timeout } = pendingRequests.current.get(json.id);
                        clearTimeout(timeout);
                        pendingRequests.current.delete(json.id);

                        if (json.error) {
                            reject(new Error(json.error.message));
                        } else {
                            // Extract content if available
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
                        return; // Handled as request response
                    }

                    // Handle legacy login success check (if not handled by pendingRequests above)
                    // or other unsolicited messages
                    if (json.result && json.result.content && json.result.content[0]) {
                        const innerText = json.result.content[0].text;
                        let resultObj;
                        try {
                            resultObj = JSON.parse(innerText);
                        } catch {
                            resultObj = { message: innerText };
                        }

                        if (resultObj.message && resultObj.message.includes("Login configuration updated")) {
                            setIsLoggedIn(true);
                            setStatus({ type: 'success', msg: 'Login Successful' });
                            setIsLoading(false);
                            // Also resolve ID 1 if pending
                            if (pendingRequests.current.has(1)) {
                                const { resolve, timeout } = pendingRequests.current.get(1);
                                clearTimeout(timeout);
                                pendingRequests.current.delete(1);
                                resolve(resultObj);
                            }
                        } else {
                            console.log("[SSE] Tool Result (Unsolicited):", resultObj);
                        }
                    } else if (json.error) {
                        console.error("[SSE] RPC Error:", json.error);
                        if (json.id === 1 || !isLoggedIn) {
                            setStatus({ type: 'error', msg: json.error.message });
                        }
                    }

                } catch (err) {
                    console.error("[SSE] Error parsing result:", err);
                }
            };

            eventSource.onerror = (err) => {
                console.error("[SSE] Connection Error:", err);
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

    const handleLogout = async () => {
        if (postEndpointRef.current) {
            setStatus({ type: 'info', msg: 'Logging out...' });
            try {
                // Fire and forget logout? or wait?
                callMcpTool('logout', {}, 2).catch(console.error);
            } catch (err) {
                console.error("Logout failed", err);
            }
        }
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
        // Reject all pending
        pendingRequests.current.forEach(({ reject, timeout }) => {
            clearTimeout(timeout);
            reject(new Error("Connection closed"));
        });
        pendingRequests.current.clear();
    };

    useEffect(() => {
        return () => {
            if (eventSourceRef.current) eventSourceRef.current.close();
        };
    }, []);

    // --- ASYNC MCP TOOL CALLER ---
    const callMcpTool = (name, args, id = null) => {
        if (!postEndpointRef.current) return Promise.reject(new Error("No Endpoint. Login first."));

        const requestId = id || Date.now();

        return new Promise(async (resolve, reject) => {
            // Set 30s timeout
            const timeout = setTimeout(() => {
                if (pendingRequests.current.has(requestId)) {
                    pendingRequests.current.delete(requestId);
                    reject(new Error(`Timeout waiting for response to ${name} (ID: ${requestId})`));
                }
            }, 30000);

            // Register promise
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

                // We expect "Accepted" text or similar, so we don't try to parse JSON here
                // unless it is NOT "Accepted".
                const text = await res.text();
                // console.log(`[MCP] ${name} sent. Response:`, text);

            } catch (networkErr) {
                clearTimeout(timeout);
                pendingRequests.current.delete(requestId);
                reject(networkErr);
            }
        });
    };

    const handleSaveToSap = async () => {
        const { objectName, package: pkg, transport, sourceCode } = testInputs;
        const objectUrl = `/sap/bc/adt/oo/classes/${objectName.toLowerCase()}`;

        try {
            setStatus({ type: 'info', msg: 'Checking object existence...' });

            // 1. CHECK EXISTENCE
            let exists = false;
            try {
                await callMcpTool('objectRegistrationInfo', { objectUrl });
                exists = true;
                console.log(`Object ${objectName} exists.`);
            } catch (e) {
                console.log("Object check failed (likely 404):", e.message);
                exists = false;
            }

            if (exists) {
                const confirm = window.confirm(`Object ${objectName} is available in the system, want to update?`);
                if (!confirm) {
                    setStatus({ type: 'info', msg: 'Operation cancelled by user.' });
                    return;
                }
                await handleUpdateObject(objectName, objectUrl, sourceCode, transport);
            } else {
                await handleCreateObject(objectName, pkg, transport, sourceCode);
            }

        } catch (e) {
            console.error(e);
            alert("Save Operation Failed: " + e.message);
            setStatus({ type: 'error', msg: e.message });
        }
    };

    const handleUpdateObject = async (objectName, objectUrl, sourceCode, transport) => {
        const objectSourceUrl = `${objectUrl}/source/main`;

        try {
            setStatus({ type: 'info', msg: 'Update: Locking...' });

            // 1. LOCK
            const lockRes = await callMcpTool('lock', { objectUrl, accessMode: 'MODIFY' });
            const lockHandle = lockRes.lockHandle;
            if (!lockHandle) throw new Error("Could not acquire lock handle");
            console.log("Locked:", lockHandle);

            // 2. SET SOURCE
            setStatus({ type: 'info', msg: 'Update: Setting Source...' });
            await callMcpTool('setObjectSource', {
                objectSourceUrl,
                source: sourceCode,
                lockHandle,
                transport
            });
            console.log("Source Set!");

            // 3. UNLOCK
            setStatus({ type: 'info', msg: 'Update: Unlocking...' });
            await callMcpTool('unLock', { objectUrl, lockHandle });
            console.log("Unlocked!");

            // 4. ACTIVATE
            setStatus({ type: 'info', msg: 'Update: Activating...' });
            const activeRes = await callMcpTool('activateByName', { objectName, objectUrl });

            let messages = "Activation Done.";
            if (activeRes && activeRes.messages) {
                messages = activeRes.messages.map(m => m.shortText).join('\n');
            }
            alert("Update & Activation Successful!\n" + messages);
            setStatus({ type: 'success', msg: 'Update Complete' });

        } catch (e) {
            throw new Error("Update Flow: " + e.message);
        }
    };

    const handleCreateObject = async (objectName, pkg, transport, sourceCode) => {
        try {
            const parentPath = `/sap/bc/adt/packages/${pkg.toLowerCase()}`;

            setStatus({ type: 'info', msg: 'Create: Creating Object...' });
            await callMcpTool('createObject', {
                objtype: 'CLAS/OC', // HARDCODED
                name: objectName.toUpperCase(),
                parentName: pkg.toUpperCase(),
                description: 'Generated by OctoAgent',
                parentPath: parentPath,
                transport: transport
            });
            console.log("Object Created!");

            const objectUrl = `/sap/bc/adt/oo/classes/${objectName.toLowerCase()}`;
            await handleUpdateObject(objectName, objectUrl, sourceCode, transport);

        } catch (e) {
            throw new Error("Create Flow: " + e.message);
        }
    };

    return (
        <div className="settings-panel" style={{ marginTop: '0', marginBottom: '20px' }}>
            <h2>SAP System Connection</h2>
            <form onSubmit={isLoggedIn ? (e) => { e.preventDefault(); handleLogout(); } : handleLogin} className="settings-grid">
                <label className="field">
                    <span>SAP URL</span>
                    <input type="text" placeholder="https://example.sap.corp:44300"
                        value={sapConfig.url} onChange={(e) => handleChange('url', e.target.value)} disabled={isLoggedIn || isLoading} />
                </label>
                <label className="field">
                    <span>Client</span>
                    <input type="text" placeholder="100"
                        value={sapConfig.client} onChange={(e) => handleChange('client', e.target.value)} disabled={isLoggedIn || isLoading} />
                </label>
                <label className="field">
                    <span>User</span>
                    <input type="text" placeholder="User"
                        value={sapConfig.user} onChange={(e) => handleChange('user', e.target.value)} disabled={isLoggedIn || isLoading} />
                </label>
                <label className="field">
                    <span>Password</span>
                    <input type="password" placeholder="Password"
                        value={sapConfig.password} onChange={(e) => handleChange('password', e.target.value)} disabled={isLoggedIn || isLoading} />
                </label>

                {status.msg && (
                    <div style={{
                        fontSize: '12px', padding: '8px', borderRadius: '4px',
                        background: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: status.type === 'error' ? '#ef4444' : (status.type === 'success' ? '#10b981' : '#6b7280')
                    }}>
                        {status.msg}
                    </div>
                )}

                <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={isLoading}>
                    {isLoading ? 'Connecting...' : (isLoggedIn ? 'Logout' : 'Login')}
                </button>
            </form>

            {isLoggedIn && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '10px' }}>
                    <h3>Test MCP Operations</h3>
                    <div className="settings-grid">
                        <label className="field"><span>Transport (TR)</span><input type="text" value={testInputs.transport} onChange={(e) => handleTestChange('transport', e.target.value)} /></label>
                        <label className="field"><span>Package</span><input type="text" value={testInputs.package} onChange={(e) => handleTestChange('package', e.target.value)} /></label>
                        <label className="field"><span>Object Name</span><input type="text" value={testInputs.objectName} onChange={(e) => handleTestChange('objectName', e.target.value)} /></label>
                        <label className="field" style={{ gridColumn: '1 / -1' }}><span>Source Code</span><textarea value={testInputs.sourceCode} onChange={(e) => handleTestChange('sourceCode', e.target.value)} style={{ width: '100%', minHeight: '200px', fontFamily: 'monospace', fontSize: '12px', background: '#2d2d2d', color: '#f8f8f2', border: '1px solid #444', borderRadius: '4px', padding: '8px' }} /></label>
                    </div>
                    <div style={{ marginTop: '10px' }}>
                        <button type="button" className="btn-primary" style={{ width: '100%', background: '#10b981' }} onClick={handleSaveToSap}>Save to SAP System</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SapLogin;
