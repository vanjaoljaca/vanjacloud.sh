const inputPath = '/Users/vanjaoljaca/Movies/SingingMix/01/ROSALÍA - LA FAMA ft. The Weeknd [QsE4BZGfXeY].mp4';

import Speaker from 'speaker';
import ffmpeg from 'fluent-ffmpeg';
import { Writable } from 'stream';

const sampleRate = 44100; // Standard CD-quality sample rate
const bitDepth = 16; // Standard CD-quality bit depth
const channels = 2; // Stereo audio

// Calculate buffer length for 2 seconds of audio
const bufferLength = 2 * sampleRate * (bitDepth / 8) * channels;

let buffers = [];
let writableStream = new Writable({
  write(chunk, encoding, callback) {
    buffers.push(chunk);
    callback();
  }
});

ffmpeg(inputPath)
  .format('s16le') // PCM format
  .audioFrequency(sampleRate)
  .audioChannels(channels)
  .on('error', (err) => {
    console.error('An error occurred: ' + err.message);
  })
  .on('end', () => {
    let pcmBuffer = Buffer.concat(buffers);
    // Extract first 2 seconds
    let firstTwoSecondsBuffer = pcmBuffer.slice(0, bufferLength);

    // Play the first 2 seconds through speaker
    let speaker = new Speaker({
      channels: channels,
      bitDepth: bitDepth,
      sampleRate: sampleRate
    });

    speaker.write(firstTwoSecondsBuffer);
    speaker.end(); // Important to call end to flush the speaker buffer

    // Event to detect when speaker has finished playing
    speaker.on('flush', () => {
      console.log('Finished playing the first 2 seconds.');
    });
  })
  .pipe(writableStream);
