const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());
app.use(express.static('public'));

async function processSingleCookie(cookieInput) {
    const rawCookie = cookieInput.trim();
    if (!rawCookie) return null;

    const formattedCookie = rawCookie.startsWith('.ROBLOSECURITY=') 
        ? rawCookie 
        : `.ROBLOSECURITY=${rawCookie}`;

    try {
        const userRes = await axios.get('https://users.roblox.com/v1/users/authenticated', {
            headers: { Cookie: formattedCookie },
            timeout: 5000
        });

        const userId = userRes.data.id;
        const username = userRes.data.name;
        const displayName = userRes.data.displayName;

        let robux = 0;
        try {
            const robuxRes = await axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`, {
                headers: { Cookie: formattedCookie },
                timeout: 5000
            });
            robux = robuxRes.data.robux;
        } catch (e) {
            robux = 'Err';
        }

        let totalRap = 0;
        let collectiblesCount = 0;
        try {
            const collectiblesRes = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`, {
                headers: { Cookie: formattedCookie },
                timeout: 5000
            });
            
            if (collectiblesRes.data && collectiblesRes.data.data) {
                collectiblesCount = collectiblesRes.data.data.length;
                totalRap = collectiblesRes.data.data.reduce((acc, item) => acc + (item.recentAveragePrice || 0), 0);
            }
        } catch (e) {
            totalRap = 0;
        }

        return {
            status: 'VALID',
            userId,
            username,
            displayName,
            robux,
            totalRap,
            collectiblesCount,
            cookie: rawCookie
        };

    } catch (err) {
        return {
            status: 'INVALID',
            error: err.response?.status === 401 ? 'Cookie Expired / Invalid' : 'Request Timeout / Error',
            cookie: rawCookie
        };
    }
}

app.post('/api/check-bulk', async (req, res) => {
    const { cookies } = req.body;
    if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
        return res.status(400).json({ error: 'Cookie list kosong' });
    }

    const results = await Promise.all(cookies.map(cookie => processSingleCookie(cookie)));
    const filteredResults = results.filter(item => item !== null);

    return res.json({
        total: filteredResults.length,
        results: filteredResults
    });
});

app.listen(3000, () => {
    console.log('Server berjalan! Buka http://localhost:3000 di browser HP');
});
