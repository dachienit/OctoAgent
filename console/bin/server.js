#!/usr/bin/env node
// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chalk from "chalk";
import { ask } from "../src/ask.js";
//import path from "path";
import { fileURLToPath } from "url";
import { dirname } from 'path';
import path from 'node:path';
import fs from 'node:fs';
import { setGlobalDispatcher, ProxyAgent } from "undici";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "../frontend");
dotenv.config({path: `${__dirname}/../.env`})

process.env.NODE_NO_WARNINGS = 1
if (process.env.PROX) {
    // Corporate proxy uses CA not in undici's certificate store
    //process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const dispatcher = new ProxyAgent({
        uri: new URL(process.env.PROX).toString() ,
        token: `Basic ${Buffer.from(`${process.env.AGENT_USER}:${process.env.AGENT_PWD}`).toString('base64')}`
    });
    setGlobalDispatcher(dispatcher);
}

async function getOAuth2AccessToken(jsonFilePath) {
  try {
    // Read and parse the JSON file containing service key
    //const serviceKeyData = await fs.readFile(jsonFilePath, 'utf8');

     const serviceKeyData = fs.readFileSync(path.resolve(`${__dirname}/${jsonFilePath}`), 'utf8');
    const serviceKey = JSON.parse(serviceKeyData);

    // Extract OAuth 2.0 credentials from the JSON
    const { clientid, clientsecret, url } = serviceKey;

    // Validate required fields
    if (!clientid || !clientsecret || !url) {
      throw new Error('Missing required fields in service key JSON');
    }

    // Prepare the OAuth 2.0 request
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientid);
    params.append('client_secret', clientsecret);

    // Make the POST request to get the access token
    const response = await fetch(url+'/oauth/token', {
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
    global.token = await getOAuth2AccessToken('../73aihkt.json');
    //console.log('Access Token:', token.accessToken);
    console.log('Token Type:', token.tokenType);
    console.log('Expires In:', token.expiresIn);
  } catch (error) {
    console.error('Failed to authenticate:', error.message);
  }

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.use(express.static(frontendPath));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// SSE: stream log from ask()
app.get("/api/logs/:issueKey", (req, res) => {
  const { issueKey } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  console.log(chalk.blue(`📡 Client connected for logs of ${issueKey}`));

  const sendMessage = (msg) => {
    res.write(`data: ${msg}\n\n`);
  };

  ask(issueKey, sendMessage)
    .then(() => {
      //sendMessage("✅ Refactor completed!");
      res.end();
    })
    .catch((err) => {
      sendMessage(`❌ Error: ${err.message}`);
      res.end();
    });

  req.on("close", () => {
    console.log(chalk.yellow(`Client disconnected from ${issueKey}`));
  });
});

// Fallback for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(chalk.green(`✅ Server running at http://localhost:${PORT}`));
});
