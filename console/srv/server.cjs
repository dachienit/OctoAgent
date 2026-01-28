const cds = require('@sap/cds');
const passport = require('passport');
const xsenv = require('@sap/xsenv');

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
        const { XssecPassportStrategy, XsuaaService } = require('@sap/xssec');
        const authService = new XsuaaService(services.xsuaa);

        passport.use(new XssecPassportStrategy(authService)); // Default name is 'JWT'
        app.use(passport.initialize());

        // Protect /api routes
        app.use('/api', passport.authenticate('JWT', { session: false }));

    } else {
        // --- LOCAL / MOCK Mode ---
        console.log('[Server] No XSUAA service found. Enabling Local Mock Auth.');

        app.use((req, res, next) => {
            console.log("[Server] Mock Auth Middleware Hit! URL:", req.url);
            // Check if there is already an Authorization header (e.g. from CAP mock)
            // If not, inject our mock user
            // Force inject our mock user for local dev
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
});

module.exports = cds.server;
