import cds from '@sap/cds';
import passport from 'passport';
import xsenv from '@sap/xsenv';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

cds.on('bootstrap', app => {
    console.log('[Server] Bootstrapping...');

    // Load environment (reads default-env.json if available locally)
    xsenv.loadEnv();

    let services, isXsuaaBound;
    try {
        services = xsenv.getServices({ xsuaa: { tag: 'xsuaa' } });
        isXsuaaBound = services && services.xsuaa;
    } catch (e) {
        console.warn("[Server] XSUAA service not found locally. Switching to Mock mode.");
        isXsuaaBound = false;
    }

    if (isXsuaaBound) {
        // --- PROD / BTP Mode ---
        console.log('[Server] XSUAA service found. Enabling Passport JWT strategy.');
        // Dynamic import or require for CJS modules if needed
        const { XssecPassportStrategy, XsuaaService, SECURITY_CONTEXT } = require('@sap/xssec');
        const authService = new XsuaaService(services.xsuaa);

        passport.use(new XssecPassportStrategy(authService, SECURITY_CONTEXT)); // Default name is 'JWT'
        app.use(passport.initialize());

        // Protect /api routes
        app.use('/api', passport.authenticate('JWT', { session: false }));
        app.use('/settings', passport.authenticate('JWT', { session: false }));

    } else {
        // --- LOCAL / MOCK Mode ---
        console.log('[Server] No XSUAA service found. Enabling Local Mock Auth.');

        /*         app.use((req, res, next) => {
                    // console.log("[Server] Mock Auth Middleware Hit! URL:", req.url);
                    req.authInfo = {
                        getLogonName: () => 'localTest',
                        getEmail: () => 'localTest@bosch.com',
                        getGivenName: () => 'Local',
                        getFamilyName: () => 'Local Test',
                        checkScope: () => true
                    };
                    req.user = {
                        id: 'localTest'
                    };
                    next();
                }); */
        app.use((req, res, next) => {
            // console.log("[Server] Mock Auth Middleware Hit! URL:", req.url);
            req.authInfo = {
                getLogonName: () => 'IYH1HC',
                getEmail: () => 'hien.nguyendac@vn.bosch.com',
                getGivenName: () => 'Hien',
                getFamilyName: () => 'Nguyen Dac',
                checkScope: () => true
            };
            req.user = {
                id: 'IYH1HC'
            };
            next();
        });
    }

    // --- /api/me Endpoint for User Info & CSRF Token ---
    app.get('/api/me', (req, res) => {
        // req.authInfo is available if authenticated (Passport or Mock)
        if (req.authInfo) {
            const userId = req.authInfo.getLogonName ? req.authInfo.getLogonName() : (req.user && req.user.id);
            res.json({
                userId: userId,
                username: userId, // Compatibility alias
                email: req.authInfo.getEmail ? req.authInfo.getEmail() : "",
                firstName: req.authInfo.getGivenName ? req.authInfo.getGivenName() : "",
                lastName: req.authInfo.getFamilyName ? req.authInfo.getFamilyName() : ""
            });
        } else {
            res.status(401).json({ error: "Unauthorized" });
        }
    });

    /*     // --- Serve React Static Files (Monolithic Mode) ---
        const reactBuildPath = path.join(__dirname, '../app/octo-client/dist');
        app.use(express.static(reactBuildPath));
    
        // React Router Fallback
        app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api') || req.path.startsWith('/settings')) {
                return next();
            }
            res.sendFile(path.join(reactBuildPath, 'index.html'));
        }); */
});

// --- Auto-Deploy for In-Memory DB (Standard CAPM Fix) ---
cds.on('served', async (services) => {
    const db = await cds.connect.to('db');
    if (db.options.kind === 'sqlite' && db.options.credentials.database === ':memory:') {
        console.log('[Server] In-memory SQLite detected. Auto-deploying model to DB...');
        const model = await cds.load('srv'); // Load all definitions
        await cds.deploy(model).to(db);
        console.log('[Server] Auto-deployment complete.');
    }
});

export default cds.server;
