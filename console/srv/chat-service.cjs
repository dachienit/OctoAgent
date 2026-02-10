const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

module.exports = async (srv) => {
    // Dynamic import for ESM module
    const { ask } = await import('./src/ask.js');
    //const { ask } = await import(path.join(process.cwd(), 'src/ask.js'));

    // Path to docs folder (roots/docs)
    // In CJS, __dirname is available directly
    const docsPath = path.join(__dirname, './docs');

    srv.on('chat', async (req) => {
        const { message, env, option, reLoad, historyID } = req.data;
        const metadata = { historyID }; // reconstructing metadata if needed

        console.log("Received chat request:", message.substring(0, 50) + "...");

        try {
            // ask function signature: (option, userMessage, env, objectType, objectName, error, historyID)
            // Mapping from req.data which matches the legacy `sendToApi` payload structure hopefully.
            // Legacy sendToApi body: { message, env, option, reLoad, objectType, objectName, error, historyID }
            // Let's use req.data fields directly.

            const objectType = req.data.objectType || "";
            const objectName = req.data.objectName || "";
            const error = req.data.error || "";
            const hisID = req.data.historyID || "";

            const response = await ask(option, message, env, objectType, objectName, error, hisID);

            // response is { output, historyID }
            return {
                reply: response.output,
                hisID: response.historyID
            };
        } catch (e) {
            console.error("Chat Error:", e);
            req.error(500, e.message || "Internal Server Error");
        }
    });

    srv.on('userinfo', (req) => {
        // req.http.req is the Express request object where Passport attaches authInfo
        const expressReq = req.http ? req.http.req : null;
        const authInfo = expressReq ? expressReq.authInfo : null;

        console.log("[API] userinfo endpoint called.");
        console.log("[API] CAP req.user.id:", req.user.id);
        console.log("[API] Express req.authInfo exists?:", !!authInfo);
        if (authInfo) {
            console.log("[API] AuthInfo LogonName:", typeof authInfo.getLogonName === 'function' ? authInfo.getLogonName() : 'N/A');
        }

        let userDetails = {
            username: req.user.id || "Anonymous",
            email: "",
            firstName: "",
            lastName: ""
        };

        if (authInfo) {
            // Check availability of methods (BTP XSUAA vs Local Mock)
            if (typeof authInfo.getLogonName === 'function') userDetails.username = authInfo.getLogonName();
            if (typeof authInfo.getEmail === 'function') userDetails.email = authInfo.getEmail();
            if (typeof authInfo.getGivenName === 'function') userDetails.firstName = authInfo.getGivenName();
            if (typeof authInfo.getFamilyName === 'function') userDetails.lastName = authInfo.getFamilyName();
        }

        // FALLBACK: If we are still anonymous (Middleware failed?), force Local Dev identity
        // This ensures the UI works while we debug the middleware connection.
        if (!userDetails.username || userDetails.username.toLowerCase() === 'anonymous') {
            console.log("[API] User is Anonymous. Forcing Local Test Mock Data.");
            userDetails = {
                username: 'localTest',
                email: 'localTest@bosch.com',
                firstName: 'Local',
                lastName: 'Local Test'
            };
        }

        console.log(`[API] UserInfo:`, userDetails);
        return userDetails;
    });

    srv.on('skills', (req) => {
        console.log('[CAP] skills called');
        console.log('[CAP] docsPath resolved to:', docsPath);
        try {
            if (!fs.existsSync(docsPath)) {
                console.warn('[CAP] Docs path does not exist!');
                return [];
            }
            const files = fs.readdirSync(docsPath).filter(file => {
                return fs.statSync(path.join(docsPath, file)).isFile();
            });
            console.log('[CAP] Found files:', files);
            return files;
        } catch (e) {
            console.error('Error listing skills:', e);
            req.error(500, 'Failed to list skills');
        }
    });

    srv.on('getSkill', (req) => {
        const { filename } = req.data;
        const filePath = path.join(docsPath, filename);
        try {
            if (!fs.existsSync(filePath)) req.error(404, 'File not found');
            const content = fs.readFileSync(filePath, 'utf-8');
            return { content };
        } catch (e) {
            req.error(500, 'Failed to read file');
        }
    });

    srv.on('saveSkill', (req) => {
        const { filename, content } = req.data;
        const filePath = path.join(docsPath, filename);
        try {
            fs.writeFileSync(filePath, content, 'utf-8');
            return true;
        } catch (e) {
            req.error(500, 'Failed to save file');
        }
    });


};
