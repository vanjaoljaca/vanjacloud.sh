import OpenAI from 'openai';
import fs from 'fs'

import { exec as execCb } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execCb);

const client = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY']
})

const interval = 5000
const task = process.argv[2] || 'writing tiktok scripts';
const systemPrompt = `You are a system designed to observe the user's computer usage and help them. 
One part of help is motivation - ensuring theyre not getting distracted doing the wrong thing - 
another is making suggestions for whatever task they seem to be doing. 
SHORT ONE LINE QUIPS BY DEFAULT, the user will specifically ask for details if needed. 
Think of yourself as the 2ndary in a pair programming scenario, looking over someones shoulder.`
const userPrompt = `User is trying to '${task}'. Look at their screen and determine what help they might need. 
Reply with a short quip that should be said out loud to the user.
If they look like theyre slacking off, gently guide them towards what they might be stuck on.`

const imagePath = './screenshot.png'
const speechPath = './speech.mp3'

export async function gpt4v() {

    await new Promise(resolve => setTimeout(resolve, interval));

    await exec(`screencapture -x ${imagePath}`)

    const base64_image = await encodeImage(imagePath);
    const result = await client.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
            {
                "role": "system",
                "content": systemPrompt
            },
            {
                "role": "user",
                "content": [
                    { "type": "text", "text": userPrompt },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": `data:image/jpeg;base64,${base64_image}`
                        },
                    },
                ],
            }]
    })

    const voiceResponse = await client.audio.speech.create({
        voice: 'onyx',
        input: result.choices[0].message.content,
        model: 'tts-1',
    })
    const buffer = Buffer.from(await voiceResponse.arrayBuffer());
    await fs.promises.writeFile(speechPath, buffer);

    await exec(`afplay ${speechPath}`);
}


const encodeImage = async (imagePath: string): Promise<string> => {
    const bitmap = fs.readFileSync(imagePath);
    return Buffer.from(bitmap).toString('base64');
};