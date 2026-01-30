import React, { useState, useRef, useEffect } from 'react';

const SapLogin = () => {
    const [sapConfig, setSapConfig] = useState({
        url: '',
        client: '',
        user: '',
        password: ''
    });

    // New state for Test Inputs
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
    const [status, setStatus] = useState({ type: '', msg: '' }); // type: 'error' | 'success' | 'info'
    const [isLoading, setIsLoading] = useState(false);

    // SSE & MCP State
    const eventSourceRef = useRef(null);
    const postEndpointRef = useRef(null);

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
                if (data.startsWith('/')) {
                    postEndpointRef.current = `http://localhost:3001${data}`;
                    return;
                }

                // 4. Handle Result (JSON-RPC)
                try {
                    const json = JSON.parse(data);

                    if (json.result && json.result.content && json.result.content[0]) {
                        const innerText = json.result.content[0].text;

                        // Parse inner JSON string if it exists
                        let resultObj;
                        try {
                            resultObj = JSON.parse(innerText);
                        } catch {
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
                        } else {
                            // GENERIC RESULT
                            console.log("[SSE] Tool Result:", resultObj);
                        }
                    } else if (json.error) {
                        throw new Error(json.error.message || "Unknown RPC Error");
                    }

                } catch (err) {
                    console.error("[SSE] Error parsing result:", err);
                    setStatus({ type: 'error', msg: err.message });
                    cleanup(); // disconnect on failure
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
                const payload = {
                    "jsonrpc": "2.0",
                    "method": "tools/call",
                    "params": {
                        "name": "logout",
                        "arguments": {}
                    },
                    "id": 2
                };

                await fetch(postEndpointRef.current, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                console.log("[MCP] Logout Request Sent");
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
    };

    useEffect(() => {
        return () => {
            if (eventSourceRef.current) eventSourceRef.current.close();
        };
    }, []);

    // --- WORKFLOW HELPERS ---
    const callMcpTool = async (name, args, id = Date.now()) => {
        if (!postEndpointRef.current) throw new Error("No Endpoint. Login first.");

        const payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": { name, arguments: args },
            "id": id
        };

        const res = await fetch(postEndpointRef.current, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json.error) throw new Error(`${name} failed: ${json.error.message}`);

        // Check for inner content text parsing requirement
        let result = json.result;
        if (result && result.content && result.content[0] && result.content[0].text) {
            try {
                const inner = JSON.parse(result.content[0].text);
                return inner;
            } catch {
                return result.content[0].text;
            }
        }
        return result;
    };

    const handleSaveToSap = async () => {
        const { objectName, package: pkg, transport, sourceCode } = testInputs;
        const objectUrl = `/sap/bc/adt/oo/classes/${objectName.toLowerCase()}`;

        try {
            setStatus({ type: 'info', msg: 'Checking object existence...' });

            // 1. CHECK EXISTENCE
            let exists = false;
            try {
                // Try to get registration info. If it succeeds, object exists.
                await callMcpTool('objectRegistrationInfo', { objectUrl });
                exists = true;
                console.log(`Object ${objectName} exists.`);
            } catch (e) {
                // If 404 or similar, assume not exists. 
                console.log("Object check failed, assuming non-existence or error:", e);
                exists = false;
            }

            if (exists) {
                // 2. CONFIRM UPDATE
                const confirm = window.confirm(`Object ${objectName} is available in the system, want to update?`);
                if (!confirm) {
                    setStatus({ type: 'info', msg: 'Operation cancelled by user.' });
                    return;
                }

                // 3. EXECUTE UPDATE
                await handleUpdateObject(objectName, objectUrl, sourceCode, transport);
            } else {
                // 4. EXECUTE CREATE
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

            // Show result
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
            setStatus({ type: 'info', msg: 'Create: Initialize...' });

            const parentPath = `/sap/bc/adt/packages/${pkg.toLowerCase()}`;

            setStatus({ type: 'info', msg: 'Create: Creating Object...' });
            await callMcpTool('createObject', {
                objtype: 'CLAS/OC', // HARDCODED
                name: objectName.toUpperCase(),
                parentName: pkg.toUpperCase(),
                description: 'Generated by OctoAgent',
                parentPath: parentPath,
                transport: transport // Optional
            });
            console.log("Object Created!");

            // 2. Update Content (Reuse Update Workflow)
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

            {/* TEST OPERATIONS AREA */}
            {isLoggedIn && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '10px' }}>
                    <h3>Test MCP Operations</h3>
                    <div className="settings-grid">
                        <label className="field">
                            <span>Transport (TR)</span>
                            <input
                                type="text"
                                value={testInputs.transport}
                                onChange={(e) => handleTestChange('transport', e.target.value)}
                            />
                        </label>
                        <label className="field">
                            <span>Package</span>
                            <input
                                type="text"
                                value={testInputs.package}
                                onChange={(e) => handleTestChange('package', e.target.value)}
                            />
                        </label>
                        <label className="field">
                            <span>Object Name</span>
                            <input
                                type="text"
                                value={testInputs.objectName}
                                onChange={(e) => handleTestChange('objectName', e.target.value)}
                            />
                        </label>
                        <label className="field" style={{ gridColumn: '1 / -1' }}>
                            <span>Source Code</span>
                            <textarea
                                value={testInputs.sourceCode}
                                onChange={(e) => handleTestChange('sourceCode', e.target.value)}
                                style={{
                                    width: '100%',
                                    minHeight: '200px',
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    background: '#2d2d2d',
                                    color: '#f8f8f2',
                                    border: '1px solid #444',
                                    borderRadius: '4px',
                                    padding: '8px'
                                }}
                            />
                        </label>
                    </div>

                    <div style={{ marginTop: '10px' }}>
                        <button
                            type="button"
                            className="btn-primary"
                            style={{ width: '100%', background: '#10b981' }}
                            onClick={handleSaveToSap}
                        >
                            Save to SAP System
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SapLogin;
