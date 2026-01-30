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

                setStatus({ type: 'info', msg: 'Authenticating...' });
                try {
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
            try {
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

    const callMcpTool = (name, args, id = null) => {
        if (!postEndpointRef.current) return Promise.reject(new Error("No Endpoint. Login first."));

        const requestId = id || Date.now();
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                if (pendingRequests.current.has(requestId)) {
                    pendingRequests.current.delete(requestId);
                    reject(new Error(`Timeout waiting for response to ${name} (ID: ${requestId})`));
                }
            }, 30000);

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
                await res.text();
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
                // Query for object
                const searchRes = await callMcpTool('searchObject', {
                    query: objectName.toUpperCase()
                });
                console.log("[MCP] Search Result:", searchRes);

                if (searchRes && Array.isArray(searchRes.results)) {
                    exists = searchRes.results.some(obj =>
                        obj["adtcore:name"] === objectName.toUpperCase() &&
                        (obj["adtcore:type"] === 'CLAS/OC' || obj["adtcore:type"] === 'CLAS')
                    );
                } else {
                    console.log("Search result structure unexpected or empty:", searchRes);
                    exists = false;
                }

                if (exists) console.log(`Object ${objectName} found in search results.`);
                else console.log(`Object ${objectName} NOT found in search results.`);

            } catch (e) {
                console.log("Search failed or returned error:", e);
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
            if (!lockRes || !lockRes.lockHandle) {
                throw new Error("Lock failed. Object might be locked by another user.");
            }
            const lockHandle = lockRes.lockHandle;

            // 2. SET SOURCE
            setStatus({ type: 'info', msg: 'Update: Setting Source...' });
            await callMcpTool('setObjectSource', {
                objectSourceUrl,
                source: sourceCode,
                lockHandle,
                transport
            });

            // 3. UNLOCK
            setStatus({ type: 'info', msg: 'Update: Unlocking...' });
            await callMcpTool('unLock', { objectUrl, lockHandle });
            console.log("Unlocked!");

            // 3.5 SYNTAX CHECK
            setStatus({ type: 'info', msg: 'Update: Checking Syntax...' });
            const syntaxCheckRes = await callMcpTool('syntaxCheckCode', {
                code: sourceCode,
                url: objectSourceUrl,
                mainUrl: objectSourceUrl
            });
            console.log("[MCP] Syntax Check Result:", syntaxCheckRes);

            if (syntaxCheckRes) {
                let errors = [];
                // Handle direct array
                if (Array.isArray(syntaxCheckRes)) {
                    errors = syntaxCheckRes;
                }
                // Handle Object with messages
                else if (syntaxCheckRes.messages) {
                    errors = syntaxCheckRes.messages.filter(m => m.type === 'E');
                }
                // Handle nested structure (rare but possible depending on tool format)
                else if (syntaxCheckRes.result && Array.isArray(syntaxCheckRes.result)) {
                    errors = syntaxCheckRes.result;
                }

                if (errors.length > 0) {
                    const errorMsg = errors.map(e => `[ERROR] Line ${e.line || e.unitLine || '?'}: ${e.shortText}`).join('\n');
                    alert("Syntax Check Failed:\n" + errorMsg);
                    setStatus({ type: 'error', msg: 'Syntax Check Failed' });
                    return;
                }
            }

            // 4. ACTIVATE
            setStatus({ type: 'info', msg: 'Update: Activating...' });
            const activeRes = await callMcpTool('activateByName', { objectName, objectUrl });
            console.log("[MCP] Activation Result:", activeRes);

            if (activeRes && activeRes.messages) {
                const errors = activeRes.messages.filter(m =>
                    m.type === 'E' || m.severity === 'E' || m.type === 'error' || m.severity === 'error'
                );
                const warnings = activeRes.messages.filter(m =>
                    m.type === 'W' || m.severity === 'W' || m.type === 'warning' || m.severity === 'warning'
                );

                if (errors.length > 0) {
                    const errorMsg = errors.map(e => `[ERROR] Line ${e.line || e.unitLine || '?'}: ${e.shortText}`).join('\n');
                    alert("Activation Failed with Errors:\n" + errorMsg);
                    setStatus({ type: 'error', msg: 'Activation Failed' });
                    return;
                }

                if (warnings.length > 0) {
                    const warnMsg = warnings.map(w => `[WARN] ${w.shortText}`).join('\n');
                    alert("Activation Success (with Warnings):\n" + warnMsg);
                } else {
                    alert("Activation Successful!");
                }
            } else {
                alert("Activation Successful! (No messages returned)");
            }

            setStatus({ type: 'success', msg: 'Update Complete' });

        } catch (e) {
            throw new Error("Update Flow: " + e.message);
        }
    };

    const handleCreateObject = async (objectName, pkg, transport, sourceCode) => {
        try {
            const parentPath = `/sap/bc/adt/packages/${pkg.toLowerCase()}`;

            setStatus({ type: 'info', msg: `Create: Creating ${objectName}...` });
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
                <label className="field"><span>SAP URL</span><input type="text" placeholder="https://example.sap.corp:44300" value={sapConfig.url} onChange={(e) => handleChange('url', e.target.value)} disabled={isLoggedIn || isLoading} /></label>
                <label className="field"><span>Client</span><input type="text" placeholder="100" value={sapConfig.client} onChange={(e) => handleChange('client', e.target.value)} disabled={isLoggedIn || isLoading} /></label>
                <label className="field"><span>User</span><input type="text" placeholder="User" value={sapConfig.user} onChange={(e) => handleChange('user', e.target.value)} disabled={isLoggedIn || isLoading} /></label>
                <label className="field"><span>Password</span><input type="password" placeholder="Password" value={sapConfig.password} onChange={(e) => handleChange('password', e.target.value)} disabled={isLoggedIn || isLoading} /></label>

                {status.msg && (
                    <div style={{ fontSize: '12px', padding: '8px', borderRadius: '4px', background: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: status.type === 'error' ? '#ef4444' : (status.type === 'success' ? '#10b981' : '#6b7280') }}>
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
