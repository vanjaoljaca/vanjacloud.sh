import axios from "axios";
import SpotifyWebApi from "spotify-web-api-node";
import fetch from "node-fetch";

const spotifyApi = new SpotifyWebApi();

// https://open.spotify.com/get_access_token
const sp_dc = 'AQA021Xo1ZrAw4ALb4H3S2rbnrETZPfPrZA5yTZk23EcA83v4GMEp5GZHpxsJ8rCsEH2qil7TztyRj7c0YVofTEmKSRHPFobgL-G4iXrNb_HmzCwjf9eL8xrauDXFvDh8tIbqU_1Mf5_ygpYpeDcA7IsvWddN5d5VuCeejY5aqz02fjj0hT0bjD0SdkDKTRgJte3vnp7tH7UT9WGB9fTVmWOzN3l'
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.41 Safari/537.36"

interface SpotifyToken {
    clientId: string,
    accessToken: string,
    accessTokenExpirationTimestampMs: number,
    isAnonymous: boolean
}


async function withLocalCache<T>(filename: string, param2: () => Promise<SpotifyToken>, param3: (d) => Promise<boolean>) {
    return Promise.resolve(undefined);
}


async function getCachedSpotifyToken(sp_dc: string) {
    const filename = 'spotify_token';

    return await withLocalCache<SpotifyToken>(filename, async () => getSpotifyToken(),
        async (d) => d.accessTokenExpirationTimestampMs < Date.now());
}

async function getSpotifyToken(): Promise<SpotifyToken> {
    const r = await fetch("https://open.spotify.com/get_access_token?reason=transport&productType=web_player", {
        "headers": {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,la;q=0.7",
            "sec-ch-ua": "\"Not_A Brand\";v=\"99\", \"Google Chrome\";v=\"109\", \"Chromium\";v=\"109\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"macOS\"",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "none",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
            "cookie": "sp_t=b1a187e367194eadbd48842c2c910d41; _gcl_au=1.1.1479833318.1671154631; sp_adid=218ebf21-0530-45fa-b990-3113e078b05b; _fbp=fb.1.1671154632328.1539873791; _scid=3558dc59-ff82-4c7b-963a-81d5a3c4f810; _cs_c=0; _tt_enable_cookie=1; _ttp=lcx5_5aQk9FP9PFhBC9GGUkbxg2; sp_dc=AQA021Xo1ZrAw4ALb4H3S2rbnrETZPfPrZA5yTZk23EcA83v4GMEp5GZHpxsJ8rCsEH2qil7TztyRj7c0YVofTEmKSRHPFobgL-G4iXrNb_HmzCwjf9eL8xrauDXFvDh8tIbqU_1Mf5_ygpYpeDcA7IsvWddN5d5VuCeejY5aqz02fjj0hT0bjD0SdkDKTRgJte3vnp7tH7UT9WGB9fTVmWOzN3l; sp_key=b50a4a5b-d429-47ea-8536-c063f6f49b22; ki_r=; _pin_unauth=dWlkPVpUVTNZek5qTURrdE1XRmtZaTAwTjJVeUxXSXhaR0V0T1RSaFpEZ3dZMlF6TVRoaA; ki_t=1673216536773%3B1673216536773%3B1673216553599%3B1%3B4; _hjSessionUser_3321767=eyJpZCI6IjRkZjZhNDliLTVmYzgtNTRiOC1hZjFlLTFkMzE0MjQ1MGY2ZSIsImNyZWF0ZWQiOjE2NzQ3MTcxNDU5MTYsImV4aXN0aW5nIjp0cnVlfQ==; sp_gaid=0088fcdca441c654e5e83000f87dc6256fdaf72748c012cd79df34; LPVID=BhZDljM2FlNWZkOTI3MDBh; _gid=GA1.2.84255436.1676295118; sp_pfhp=2c2ccb58-8a92-4713-a1c0-8b43b3090b49; sss=1; _schn=_z7qjwa; _sctr=1|1676217600000; OptanonAlertBoxClosed=2023-02-13T13:33:10.156Z; _hjSessionUser_309589=eyJpZCI6IjAxMWNhM2FmLWQ3YWQtNTY4NC04ZjYyLTkzYjVlNjdmMDU3OSIsImNyZWF0ZWQiOjE2NzQ5NzE2ODg2MzcsImV4aXN0aW5nIjp0cnVlfQ==; sp_m=uk; _cs_id=e01a3e9c-e083-a762-c5a6-8c462db9baae.1671154645.2.1676295271.1676295271.1.1705318645324; LPSID-2422064=6ow9HneZTRGo1lzizbVjEA; _ga_S35RN5WNT2=GS1.1.1676295270.2.1.1676295339.60.0.0; sp_landing=https%3A%2F%2Fwww.spotify.com%2Fapi%2Fmasthead%2Fv1%2Fmasthead; sp_landingref=https%3A%2F%2Fopen.spotify.com%2F; _ga_ZWG1NSHWD8=GS1.1.1676388299.5.1.1676389318.0.0.0; _derived_epik=dj0yJnU9VGtuLVVUbi1Sa2ZFdV8zVmlIcS00ZXJyalFTVDhFWHMmbj12dHNsd2IyaWlMVEFhWk1tZ1BGSHF3Jm09MSZ0PUFBQUFBR1BycThjJnJtPTEmcnQ9QUFBQUFHUHJxOGMmc3A9Mg; OptanonConsent=isIABGlobal=false&datestamp=Tue+Feb+14+2023+23%3A48%3A22+GMT%2B0800+(Australian+Western+Standard+Time)&version=6.26.0&hosts=&landingPath=NotLandingPage&groups=s00%3A1%2Cf00%3A1%2Cm00%3A1%2Ct00%3A1%2Ci00%3A1%2Cf11%3A1&AwaitingReconsent=false&isGpcEnabled=0&consentId=5d5d274b-fa18-4140-8634-d608cca5d599&interactionCount=0&geolocation=AU%3BWA; _ga=GA1.2.728480226.1671154631; _hjSession_3321767=eyJpZCI6IjQxZDExOWNkLTdmYjUtNGQ2NC1iZjdkLTU2ZDBlNjQ1YWRmZiIsImNyZWF0ZWQiOjE2NzYzODk3MDMyOTAsImluU2FtcGxlIjpmYWxzZX0=; _hjAbsoluteSessionInProgress=1"
        },
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": null,
        "method": "GET"
    });
    return await r.json();
}

async function getSpotifyToken2(sp_dc: string): Promise<SpotifyToken> {

    // return {"clientId":"d8a5ed958d274c2e8ee717e6a4b0971d","accessToken":"BQBZ__uQXLjY6geXgC7qVCbESJ8KhJYsQV7ubcYo1_2MmyAf7kfGLiIZk5d6LQtekOVy3hhCMitS3iIe86b5givF7s-E3r9Qqsp-znYu9KXAT2rcTiKfLd4lRBazuqT7T5vqQY2mWH-puaddm_-AWaKfEqFznpxqRXv5XwSplKS2qOe0Ryp9L6Ir1b_I-HaimyfBR-sns-rYAxmizm-pl24FKjGqh7ii30NqM9_n8I-WB_x4l_Xi84Of-4lwbflxMaLXCC6zKVJK5BMDQr8A0fIPnAaxgcSAMlxmRoU2vKebNHmxEujKlXyXZHbEuwTFM1dJF-nZsw","accessTokenExpirationTimestampMs":1676390670351,"isAnonymous":false};

    try {
        // set axios cookie
        // axios.defaults.headers.common['cookies'] = 'sp_dc=' + sp_dc + ';';
        const a = await axios({
            method: 'get',
            url: 'https://open.spotify.com/get_access_token?reason=transport&productType=web_player',
            headers: {
                // 'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': USER_AGENT,
                'app-platform': 'WebPlayer',
                'cookies': 'sp_dc=' + sp_dc + ';',
            },
        })

        return a.data;
    } catch (e) {
        console.log(e.response);
    }
}

async function getLyrics(token: string, trackId: string) {
    try {
        const a = await axios({
            method: 'get',
            url: 'https://spclient.wg.spotify.com/color-lyrics/v2/track/' + trackId,
            params: {
                format: 'json',
                market: 'from_token',
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': USER_AGENT,
                'app-platform': 'WebPlayer',
                'authorization': `Bearer ${token}`
            },
        });
        return a.data;
    } catch (e) {
        console.log('getLyrics', e.response);
    }
}

async function seekTest() {

    const t = await getSpotifyToken();
    console.log('got token. anonymous should be false: ', t.isAnonymous);
    spotifyApi.setAccessToken(t.accessToken);

    setInterval(async () => {
        try {
            // log current time
            const s = new Date()
            console.log(s.toISOString(), 'seeking');
            // await spotifyApi.seek(1000)
            const tr = await spotifyApi.getMyCurrentPlayingTrack();
            console.log(s.toISOString(), 'got tr');
            const l = await getLyrics(t.accessToken, tr.body.item.id)
            console.log(JSON.stringify(l.lyrics.lines))
            const e = new Date()
            console.log(e.toISOString(), 'seeked (', e.getTime() - s.getTime(), 'ms)');
        } catch (e) {
            console.log('setInterval error', e);
        }
    }, 4000);
}

async function loopTest() {

    const r = await getSpotifyToken();

    spotifyApi.setAccessToken(r.accessToken);

    const regionMs = [5000, 10000];

    setInterval(async () => {
        // log current time
        const s = new Date()
        console.log(s.toISOString(), 'seeking');
        // await spotifyApi.seek(1000)
        let r = await spotifyApi.getMyCurrentPlaybackState();
        console.log(r.body.progress_ms);

        const e = new Date()
        console.log(e.toISOString(), 'seeked (', e.getTime() - s.getTime(), 'ms)');
    }, 4000);
}