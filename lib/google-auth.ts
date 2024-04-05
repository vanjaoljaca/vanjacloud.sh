require('dotenv').config();

const http = require('http');
const opn = require('opn');
const { google } = require('googleapis');

const CLIENT_ID = '290430285327-un8po3uie98phhnv6l0f68jll25mnpko.apps.googleusercontent.com';


// https://console.cloud.google.com/apis/credentials/oauthclient/290430285327-un8po3uie98phhnv6l0f68jll25mnpko.apps.googleusercontent.com?project=vanjacloud
const CLIENT_SECRET = process.env.GOOGLE_OAUTH; // Get CLIENT_SECRET from .env file
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/userinfo.profile'
];

export async function getTokens() {
  return new Promise((resolve, reject) => {
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    });

    const server = http.createServer(async (req, res) => {
      try {
        if (req.url.indexOf('/oauth2callback') > -1) {
          const qs = new URL(req.url, 'http://localhost:3000').searchParams;
          const code = qs.get('code');
          const { tokens } = await oauth2Client.getToken(code);
          resolve(tokens);
          server.close();
          console.log('Authorization successful! You may now close the browser tab.');
          res.end('Authorization successful! You may now close the browser tab.');
        } else {
          res.end('Hello World!');
        }
      } catch (err) {
        console.error(err);
        reject(err);
        res.end('Error occurred during authorization. Please try again.');
      }
    });

    server.listen(3000, () => {
      opn(authUrl, { wait: false });
      console.log(`Please visit this URL to authorize the application: ${authUrl}`);
    });
  });
}

export async function getOauth2Client(tokens) {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}