const portAudio = require('naudiodon');

/**
 * Create stream.
 *
 * Discord expects raw audio streams to be 2-channels,
 * signed 16-bits, and have a 48000Hz sample rate.
 *
 * @param {module:"discord.js".Client} client - Discord.js client.
 * @param {Device | undefined}         device - Audio device from Naudiodon.
 *
 * @since 1.0.0
 */
module.exports = function createStream(client, device) {
  if (
    device.maxInputChannels !== 2
    || device.maxOutputChannels !== 0
    || device.defaultSampleRate !== 48000
  ) {
    throw Error(`${device.name} is not a supported audio device ...`);
  }

  // Create the broadcast stream.
  const broadcast = client.voice.createBroadcast();

  // Create the audio device stream.
  const audio = new portAudio.AudioIO({
    inOptions: {
      channelCount: 2,
      sampleFormat: portAudio.SampleFormat16Bit,
      sampleRate: 48000,
      deviceId: device.id,
      closeOnError: false,
    },
  });

  // Create a dispatcher for our audio stream.
  broadcast.play(audio, {
    type: 'converted',
  });

  audio.start();

  return broadcast;
};
