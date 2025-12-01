#!/usr/bin/env node
// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chalk from "chalk";
import { ask } from "../src/ask.js";
import { fileURLToPath } from "url";
import { dirname } from 'path';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { setGlobalDispatcher, ProxyAgent } from "undici";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({path: path.join(__dirname, '../.env')});

process.env.NODE_NO_WARNINGS = 1;
async function getOAuth2AccessToken() {
  try {
    // Prepare the OAuth 2.0 request
    const params = new URLSearchParams();
    params.append('client_id', process.env.CLIENT_ID);
    params.append('scope', process.env.SCOPE);
    params.append('client_secret', process.env.CLIENT_SECRET);
    params.append('grant_type', process.env.GRANT_TYPE);

    // Make the POST request to get the access token
    const response = await fetch(process.env.URL_TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // Parse the response
    const tokenData = await response.json();

    // Check if access token is present
    if (!tokenData.access_token) {
      throw new Error('No access token received in response');
    }

    return {
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type || 'Bearer',
      expiresIn: tokenData.expires_in,
    };
  } catch (error) {
    console.error('Error obtaining access token:', error.message);
    throw error;
  }
}

try {
    global.token = await getOAuth2AccessToken();
    if (process.env.PROX) {
      // Corporate proxy uses CA not in undici's certificate store
      //process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      const dispatcher = new ProxyAgent({
          uri: new URL(process.env.PROX).toString() ,
          token: `Basic ${Buffer.from(`${process.env.AGENT_USER}:${process.env.AGENT_PWD}`).toString('base64')}`
      });
      setGlobalDispatcher(dispatcher); 
    }

    console.log('Token Type:', token.tokenType);
    console.log('Expires In:', token.expiresIn);
  } catch (error) {
    console.error('Failed to authenticate:', error.message);
  }

// Setup Express server
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend directory
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// API endpoint to get Windows username
app.get('/api/userinfo', (req, res) => {
  try {
    // Get username from environment variable (Windows: USERNAME, Linux/Mac: USER)
    // Or use os.userInfo() which works cross-platform
    let username = '';
    
    if (process.platform === 'win32') {
      // Windows - ưu tiên USERNAME
      username = process.env.USERNAME || '';
      if (!username) {
        try {
          username = os.userInfo().username || '';
        } catch (err) {
          console.error('Error getting user info:', err);
        }
      }
    } else {
      // Linux/Mac
      username = process.env.USER || '';
      if (!username) {
        try {
          username = os.userInfo().username || '';
        } catch (err) {
          console.error('Error getting user info:', err);
        }
      }
    }
    
    console.log(`[API] Returning username: ${username}`);
    res.json({ username: username || '' });
  } catch (error) {
    console.error('Error in /api/userinfo:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }

});

// API endpoint for chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required and must be a string' });
    }

    // Call the ask function
    const response = await ask(message);
    
    res.json({ reply: response });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(chalk.green(`Server is running on http://localhost:${PORT}`));
  console.log(chalk.blue(`Frontend is available at http://localhost:${PORT}`));
});