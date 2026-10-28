const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const getHeaders = (cookie) => ({
    'Cookie': `.ROBLOSECURITY=${cookie}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json'
});

app.post('/api/check', async (req, res) => {
    try {
        const { cookies } = req.body;
        if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
            return res.status(400).json({ error: "Cookie tidak boleh kosong." });
        }

        let cleanCookie = cookies[0].trim().replace(/^["']|["']$/g, '');
        if (!cleanCookie) {
            return res.status(400).json({ error: "Format cookie tidak valid." });
        }

        // 1. Cek Autentikasi User ID & Username
        const userRes = await axios.get('https://users.roblox.com/v1/users/authenticated', {
            headers: getHeaders(cleanCookie),
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
            const currencyRes = await axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`, {
                headers: getHeaders(cleanCookie),
                timeout: 3000
            });
            robux = currencyRes.data.robux || 0;
        } catch (e) {}

        // 3. Cek Tanggal Pembuatan Akun (Age)
        let createdDate = "Tidak diketahui";
        try {
            const infoRes = await axios.get(`https://users.roblox.com/v1/users/${userId}`, { timeout: 3000 });
            if (infoRes.data && infoRes.data.created) {
                createdDate = new Date(infoRes.data.created).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'long', year: 'numeric'
                });
            }
        } catch (e) {}

        // 4. Cek Status Premium
        let isPremium = false;
        try {
            const premRes = await axios.get(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`, {
                headers: getHeaders(cleanCookie),
                timeout: 3000
            });
            isPremium = !!premRes.data;
        } catch (e) {}

        // 5. Cek Status Email & 2FA
        let emailStatus = "Tidak diketahui / Terkunci";
        let has2FA = false;
        try {
            const settingsRes = await axios.get(`https://accountsettings.roblox.com/v1/email`, {
                headers: getHeaders(cleanCookie),
                timeout: 3000
            });
            if (settingsRes.data && settingsRes.data.verified !== undefined) {
                emailStatus = settingsRes.data.verified ? "Terverifikasi (Verified)" : "Belum Verifikasi";
            }
        } catch (e) {}

        try {
            const tfaRes = await axios.get(`https://twostepverification.roblox.com/v1/users/${userId}/settings`, {
                headers: getHeaders(cleanCookie),
                timeout: 3000
            });
            if (tfaRes.data) {
                has2FA = tfaRes.data.isAuthenticatorEnabled || tfaRes.data.isEmailEnabled || false;
            }
        } catch (e) {}

        // 6. Cek Robux Income & Outgoing (Spend)
        let totalIncoming = 0;
        let totalSpent = 0;
        let transactions = [];
        try {
            const transRes = await axios.get(`https://economy.roblox.com/v2/users/${userId}/transactions?transactionType=All&limit=15`, {
                headers: getHeaders(cleanCookie),
                timeout: 4000
            });
            
            if (transRes.data && transRes.data.data) {
                transactions = transRes.data.data.map(tx => {
                    const amount = tx.currency?.amount || 0;
                    if (amount > 0) totalIncoming += amount;
                    if (amount < 0) totalSpent += Math.abs(amount);

                    return {
                        description: tx.details?.name || tx.type || "Transaksi",
                        amount: amount,
                        date: new Date(tx.created).toLocaleDateString('id-ID')
                    };
                });
            }
        } catch (e) {}

        const accountData = {
            success: true,
            userId,
            username,
            displayName,
            robux,
            totalIncoming,
            totalSpent,
            createdDate,
            isPremium,
            emailStatus,
            has2FA: has2FA ? "Aktif (Enabled)" : "Nonaktif (Disabled)",
            transactions,
            cookie: cleanCookie
        };

        res.json({ results: [accountData] });
    } catch (err) {
        res.status(500).json({ error: "Gagal memproses cookie atau server sibuk." });
    }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}module.exports = app;
