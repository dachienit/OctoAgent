const cds = require('@sap/cds');

module.exports = async (srv) => {

    const { UserEnv } = srv.entities;

    // LOAD ENV
    srv.on('READ', UserEnv, async (req) => {
        try {
            console.log("[UserEnv] READ triggered for user:", req.user.id);
            const userId = req.user.id;
            const result = await SELECT.one.from(UserEnv).where({ userId });
            console.log("[UserEnv] READ result:", result);
            return result;
        } catch (e) {
            console.error("[UserEnv] READ Error:", e);
            throw e;
        }
    });

    // SAVE / UPDATE ENV
    srv.on('CREATE', UserEnv, async (req) => {
        try {
            console.log("[UserEnv] CREATE triggered for user:", req.user.id);
            const userId = req.user.id;
            const data = req.data;

            const exists = await SELECT.one.from(UserEnv).where({ userId });

            if (exists) {
                console.log("[UserEnv] Updating existing record");
                await UPDATE(UserEnv)
                    .set({
                        brainId: data.brainId,
                        theme: data.theme,
                        customPrompt: data.customPrompt,
                        updatedAt: new Date()
                    })
                    .where({ userId });
                return { ...exists, ...data };
            }

            console.log("[UserEnv] Creating new record");
            return await INSERT.into(UserEnv).entries({
                ID: cds.utils.uuid(),
                userId,
                ...data,
                createdAt: new Date()
            });
        } catch (e) {
            console.error("[UserEnv] CREATE Error:", e);
            throw e;
        }
    });
};
