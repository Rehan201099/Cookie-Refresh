const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());

// Mengarahkan folder public agar file HTML utama terbaca
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint untuk cek cookie Roblox
app.post('/api/check', async (req, res) => {
    try {
        const { cookie } = req.body;
        if (!cookie) {
            return res.status(400).json({ error: "Cookie tidak boleh kosong" });
        }

        const cleanCookie = cookie.trim();

        const userResponse = await axios.get('https://users.roblox.com/v1/users/authenticated', {
            headers: { 'Cookie': `.ROBLOSECURITY=${cleanCookie}` }
        });

        const userId = userResponse.data.id;
        const username = userResponse.data.name;
        const displayName = userResponse.data.displayName;

        const economyResponse = await axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`, {
            headers: { 'Cookie': `.ROBLOSECURITY=${cleanCookie}` }
        });
        const robux = economyResponse.data.robux || 0;

        const profileResponse = await axios.get(`https://users.roblox.com/v1/users/${userId}`, {
            headers: { 'Cookie': `.ROBLOSECURITY=${cleanCookie}` }
        });
        const createdDate = profileResponse.data.created;

        let emailStatus = "Tidak Diketahui";
        let has2FA = false;
        try {
            const settingsResponse = await axios.get('https://settings.roblox.com/v1/email', {
                headers: { 'Cookie': `.ROBLOSECURITY=${cleanCookie}` }
            });
            emailStatus = settingsResponse.data.verified ? "Verified (Aman)" : "Unverified";
        } catch (e) {}

        try {
            const tfaResponse = await axios.get('https://twostepverification.roblox.com/v1/users/' + userId + '/metadata', {
                headers: { 'Cookie': `.ROBLOSECURITY=${cleanCookie}` }
            });
            has2FA = tfaResponse.data.isTwoStepVerificationEnabled || false;
        } catch (e) {}

        const accountData = {
            success: true,
            userId,
            username,
            displayName,
            robux,
            totalIncoming: 0,
            totalSpent: 0,
            createdDate,
            isPremium: false,
            emailStatus,
            has2FA: has2FA ? "Aktif (Enabled)" : "Nonaktif (Disabled)",
            cookie: cleanCookie
        };

        res.json({ results: [accountData] });
    } catch (err) {
        res.status(500).json({ error: "Gagal memproses cookie atau sesi kedaluwarsa" });
    }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
