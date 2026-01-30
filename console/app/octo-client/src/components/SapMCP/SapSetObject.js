/**
 * Logic for Saving, Creating, and Updating SAP Objects via MCP.
 * Decoupled from the UI to allow reuse.
 */

export const unLockObject = async (objectUrl, lockHandle, callMcpTool, setStatus) => {
    if (lockHandle) {
        setStatus({ type: 'info', msg: 'Cleaning up: Unlocking...' });
        try {
            await callMcpTool('unLock', { objectUrl, lockHandle });
            console.log("Unlocked!");
        } catch (unlockErr) {
            console.error("Unlock failed:", unlockErr);
        }
    }
};

export const updateObject = async (objectName, objectUrl, sourceCode, transport, callMcpTool, setStatus) => {
    const objectSourceUrl = `${objectUrl}/source/main`;
    let lockHandle = null;

    try {
        setStatus({ type: 'info', msg: 'Update: Locking...' });

        // 1. LOCK
        const lockRes = await callMcpTool('lock', { objectUrl, accessMode: 'MODIFY' });
        if (!lockRes || !lockRes.lockHandle) {
            throw new Error("Lock failed. Object might be locked by another user.");
        }
        lockHandle = lockRes.lockHandle;
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

        // 3. SYNTAX CHECK 
        setStatus({ type: 'info', msg: 'Update: Checking Syntax...' });
        const syntaxCheckRes = await callMcpTool('syntaxCheckCode', {
            code: sourceCode,
            url: objectSourceUrl,
            mainUrl: objectSourceUrl
        });
        console.log("[MCP] Syntax Check Result:", syntaxCheckRes);

        let syntaxErrors = [];
        if (syntaxCheckRes && syntaxCheckRes.result) {
            if (Array.isArray(syntaxCheckRes.result)) {
                syntaxErrors = syntaxCheckRes.result.filter(m => m.severity === 'E');
            }
        } else if (Array.isArray(syntaxCheckRes)) {
            syntaxErrors = syntaxCheckRes.filter(m => m.severity === 'E');
        }

        if (syntaxErrors.length > 0) {
            const errorMsg = syntaxErrors.map(e => `[ERROR] Line ${e.line}: ${e.text}`).join('\n');
            alert("Syntax Check Failed:\n" + errorMsg);
            setStatus({ type: 'error', msg: 'Syntax Check Failed' });
            return;
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
        console.error("Update Flow Error:", e);
        alert("Update Error: " + e.message);
        setStatus({ type: 'error', msg: e.message });
        throw e; // Propagate error
    } finally {
        // 5. UNLOCK 
        await unLockObject(objectUrl, lockHandle, callMcpTool, setStatus);
    }
};

export const createObject = async (objectName, pkg, transport, sourceCode, callMcpTool, setStatus) => {
    try {
        // 1. Search for Package to get URL
        setStatus({ type: 'info', msg: `Create: Searching for package ${pkg}...` });
        const pkgSearchRes = await callMcpTool('searchObject', { query: pkg.toUpperCase() });
        console.log("Package Search Result:", pkgSearchRes);

        let parentPath = '';
        if (pkgSearchRes && pkgSearchRes.results) {
            const pkgMatch = pkgSearchRes.results.find(res => res["adtcore:name"] === pkg.toUpperCase());
            if (pkgMatch) {
                parentPath = pkgMatch["adtcore:uri"];
            }
        }

        if (!parentPath) {
            console.warn("Could not find package URI via search, trying manual construction...");
            parentPath = `/sap/bc/adt/packages/${pkg.toLowerCase()}`;
        }

        // 2. Create Object
        setStatus({ type: 'info', msg: `Create: Creating ${objectName}...` });
        const createArgs = {
            objtype: 'CLAS/OC',
            name: objectName.toUpperCase(),
            parentName: pkg.toUpperCase(),
            description: 'Generated by OctoAgent',
            parentPath: parentPath,
            transport: transport
        };
        console.log("Calling createObject with:", createArgs);

        const createRes = await callMcpTool('createObject', createArgs);
        console.log("createObject Result:", createRes);

        // 3. Construct Object URL Manualy (Search is too slow/unreliable immediately after create)
        setStatus({ type: 'info', msg: 'Create: Verifying creation...' });

        // Manual construction for Class (common pattern)
        // If we support other types later, we need a switch or map here.
        const objectUrl = `/sap/bc/adt/oo/classes/${objectName.toLowerCase()}`;
        console.log("Constructed Object URL:", objectUrl);

        // Optional: We could still try search and log it, but NOT block on it.
        // const objSearchRes = await callMcpTool('searchObject', { query: objectName.toUpperCase() });
        // console.log("Post-Create Search Check:", objSearchRes);

        if (!objectUrl) {
            throw new Error("Could not determine object URL.");
        }

        // 4. Update Workflow
        await updateObject(objectName, objectUrl, sourceCode, transport, callMcpTool, setStatus);

    } catch (e) {
        throw new Error("Create Flow: " + e.message);
    }
};

export const saveToSap = async (inputs, callMcpTool, setStatus) => {
    const { objectName, package: pkg, transport, sourceCode } = inputs;
    const objectUrl = `/sap/bc/adt/oo/classes/${objectName.toLowerCase()}`;

    try {
        setStatus({ type: 'info', msg: 'Checking object existence...' });

        // 1. CHECK EXISTENCE
        let exists = false;
        try {
            const searchRes = await callMcpTool('searchObject', {
                query: objectName.toUpperCase()
            });
            console.log("[MCP] Search Result:", searchRes);

            if (searchRes && Array.isArray(searchRes.results)) {
                exists = searchRes.results.some(obj =>
                    obj["adtcore:name"] === objectName.toUpperCase() &&
                    (obj["adtcore:type"] === 'CLAS/OC' || obj["adtcore:type"] === 'CLAS')
                );
            }

            if (exists) console.log(`Object ${objectName} found.`);
            else console.log(`Object ${objectName} NOT found.`);

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
            await updateObject(objectName, objectUrl, sourceCode, transport, callMcpTool, setStatus);
        } else {
            await createObject(objectName, pkg, transport, sourceCode, callMcpTool, setStatus);
        }

    } catch (e) {
        console.error(e);
        alert("Save Operation Failed: " + e.message);
        setStatus({ type: 'error', msg: e.message });
    }
};
