import * as fs from "fs";
import {getOauth2Client, getTokens} from "../lib/google-auth";
import path from "path";

const DATA_FOLDER = 'data'

async function getGoogleAuth() {
  const authFileName = 'auth.google.json';
  if (!fs.existsSync(DATA_FOLDER)) {
    // make a directory
    fs.mkdirSync(DATA_FOLDER);
  }

  const authFile = path.join(DATA_FOLDER, authFileName);
  if (fs.existsSync(authFile)) {
    let tokens = JSON.parse(fs.readFileSync(authFile).toString());
    let auth = await getOauth2Client(tokens);
    if (auth.expiry_date < Date.now()) {
      return auth;
    }
  }

  let tokens = await getTokens();
  fs.writeFileSync(authFile, JSON.stringify(tokens));

  return await getOauth2Client(tokens);
}

async function youtubeTest() {
  const key = 'AIzaSyBbKpVKwMFwEAddNy7-s9GngCO3B1ECLTA';
  const { google } = require('googleapis');

  let auth = await getGoogleAuth();

  console.log('auth done', auth);

  // Set up YouTube API client with API key
  const youtube = google.youtube({
    version: 'v3',
    auth: auth
  });

  // const r = await youtube.videos.list({
  //   id: 'E_b-Q0xiTmo',
  //   part: 'contentDetails'
  // });
  // console.log(r);

  // Get the current playing video ID and position
  const r2 = await youtube.videos.list({
    part: 'id,player',
    myRating: 'like',
    maxResults: 1
  }, (err, res) => {
    if (err) {
      console.error(err);
      return;
    }

    console.log('got res', res.data);

    const videoId = res.data.items[0].id;
    console.log('Current video ID: ' + videoId);

    console.log('player', res.data.items[0].player)
    console.log('embedHtml', res.data.items[0].player.embedHtml)
    try {
      const position = res.data.items[0].player.embedHtml.match(/start=([0-9]+)/)[1];
      console.log('Current video position: ' + position);
    } catch (e) {
      console.log('no position');
    }
  });

  console.log('r2', r2)
}

youtubeTest()