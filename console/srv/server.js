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

        app.use((req, res, next) => {
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
        });
    }

    // --- Serve React Static Files (Monolithic Mode) ---
    const reactBuildPath = path.join(__dirname, '../app/octo-client/dist');
    app.use(express.static(reactBuildPath));

    // React Router Fallback
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/settings')) {
            return next();
        }
        res.sendFile(path.join(reactBuildPath, 'index.html'));
    });
});

export default cds.server;
