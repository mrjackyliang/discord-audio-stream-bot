const Discord = require('discord.js');
const dotenv = require('dotenv');
const inquirer = require('inquirer');
const portAudio = require('naudiodon');

const createStream = require('./stream');

dotenv.config();

/**
 * Initialize.
 *
 * @returns {Promise<void>}
 *
 * @since 1.0.0
 */
async function initialize() {
  /**
   * Discord configuration.
   *
   * @since 1.0.0
   */
  const client = new Discord.Client();

  /**
   * Audio device setup.
   *
   * @since 1.0.0
   */
  const { device: deviceName } = await inquirer.prompt([{
    type: 'list',
    name: 'device',
    message: 'Choose the output audio device to stream on Discord:',
    choices: portAudio.getDevices(),
  }]);
  const audioDevice = portAudio.getDevices().find((device) => device.name === deviceName);

  /**
   * When client is ready.
   *
   * @since 1.0.0
   */
  client.on('ready', async () => {
    let broadcast;

    /**
     * Server ready signal.
     *
     * @since 1.0.0
     */
    console.log('Server is ready ...');

    /**
     * Create a device broadcast stream.
     *
     * @since 1.0.0
     */
    try {
      broadcast = createStream(client, audioDevice);
    } catch (error) {
      await client.user.setStatus('invisible');

      console.error(error.message);
      process.exit(0);
    }

    /**
     * Set user status.
     *
     * @since 1.0.0
     */
    await client.user.setStatus('online');

    /**
     * Message embed template.
     *
     * @param {string} title   - Message embed title.
     * @param {string} content - Message embed content.
     *
     * @returns {module:"discord.js".MessageEmbed}
     *
     * @since 1.0.0
     */
    const messageEmbedTemplate = (title, content) => new Discord.MessageEmbed()
      .setColor('#7289da')
      .setTitle(title)
      .setDescription(content)
      .setTimestamp()
      .setFooter('Discord Audio Stream Bot');

    /**
     * Voice controller.
     *
     * @param {string}      action    - You can "join", "leave", "play", or "stop".
     * @param {Guild}       guild     - Discord guild information.
     * @param {NewsChannel} channel   - Discord channel functions.
     * @param {string|null} channelId - Voice channel id.
     *
     * @since 1.0.0
     */
    const voiceController = async (action, guild, channel, channelId = null) => {
      const voiceChannel = client.channels.cache.get(channelId);
      const connectedTo = guild.me.voice.channel;

      if (
        (!voiceChannel && action !== 'stop')
        || (voiceChannel && voiceChannel.type !== 'voice')
      ) {
        console.error(`The voice channel (${channelId}) is invalid or does not exist ...`);

        await channel.send(
          messageEmbedTemplate('Error', `The voice channel (${channelId}) is invalid or does not exist.`),
        );

        return;
      }

      switch (action) {
        case 'play':
          voiceChannel.join().then(async (connection) => {
            console.log(`Connected to voice channel (${channelId}) ...`);

            connection.play(broadcast);

            await channel.send(
              messageEmbedTemplate('Connected', `Now connected and streaming audio to <#${channelId}>`),
            );
          }).catch(async (error) => {
            console.error(`${error.message.replace(/\\.$/, '')} ...`);

            await channel.send(
              messageEmbedTemplate('Error', `Cannot connect to voice channel (${channelId}). Check logs for more details.`),
            );
          });
          break;
        case 'stop':
          if (connectedTo) {
            broadcast.end();
            connectedTo.leave();
            console.log(`Disconnected from voice channel (${connectedTo.id}) ...`);

            await channel.send(
              messageEmbedTemplate('Disconnected', `Now disconnected from <#${connectedTo.id}>`),
            );
          } else {
            console.log('Not connected to any voice channel ...');

            await channel.send(
              messageEmbedTemplate('Error', 'Cannot disconnect from voice channel. Check logs for more details.'),
            );
          }
          break;
        default:
          break;
      }
    };

    /**
     * Listen for Discord server messages.
     *
     * @since 1.0.0
     */
    client.on('message', async (message) => {
      const {
        guild,
        channel,
        mentions,
      } = message;
      const mentioned = mentions.users;
      const clientId = client.user.id;
      const [username, command, channelId] = message.content.split(' ');

      // If bot was not tagged, skip.
      if (!mentioned.get(clientId)) {
        return;
      }

      // Command help menu.
      if (!command || command === 'help') {
        const mentionedUsername = mentioned.get(clientId).username;

        console.log('Displaying command help menu ...');

        await channel.send(messageEmbedTemplate(
          'Command Help Menu',
          [
            `\`@${mentionedUsername} help\`\nDisplay the help menu (this list)`,
            `\`@${mentionedUsername} list\`\nSee a list of available voice channels`,
            `\`@${mentionedUsername} play <channel id>\`\nJoin channel and start playing audio`,
            `\`@${mentionedUsername} stop\`\nStop playing audio and leave channel`,
          ].join('\n\n'),
        ));
      }

      // Voice channel list.
      if (command === 'list') {
        const voiceChannels = channel.guild.channels.cache.filter((theChannel) => theChannel.type === 'voice');

        console.log('Displaying voice channel list ...');

        await channel.send(messageEmbedTemplate(
          'Voice Channels List',
          [
            `Copy the channel IDs shown next to the channel names below for use with the \`join\`, \`play\`, \`stop\` commands. Please make sure these channels are viewable by ${username}.\n`,
            ...voiceChannels.map((theChannel) => `${theChannel.name} ➜ \`${theChannel.id}\``),
          ].join('\n'),
        ));
      }

      // Start playing in voice channel.
      if (command === 'play' && channelId) {
        console.log(`Connecting to voice channel (${channelId}) ...`);

        await voiceController('play', guild, channel, channelId);
      }

      // Stop playing in voice channel.
      if (command === 'stop') {
        console.log('Disconnecting from voice channel ...');

        await voiceController('stop', guild, channel);
      }
    });

    /**
     * Capture SIGINT (Control+C).
     *
     * @since 1.0.0
     */
    process.on('SIGINT', async () => {
      await client.user.setStatus('invisible');

      console.log('Stopping server ...');
      process.exit(130);
    });
  });

  /**
   * Client login.
   *
   * @since 1.0.0
   */
  await client.login(process.env.DISCORD_CLIENT_TOKEN);
}

/**
 * Initialize server.
 *
 * @since 1.0.0
 */
initialize().then(() => {
  console.log('Initializing server ...');
});
