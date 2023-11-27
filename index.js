require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, REST, Routes } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const token = process.env.DISCORD_BOT_TOKEN;
const apiEndpoint = 'http://127.0.0.1:5002/generate';

let queue = [];

client.once('ready', async () => {
	console.log(`Logged in as ${client.user.tag}!`);

	// Register slash commands
	const commands = [
		new SlashCommandBuilder()
			.setName('generate')
			.setDescription('Generate music from a prompt')
			.addStringOption(option => option.setName('prompt').setDescription('The prompt for the music').setRequired(true))
			.addIntegerOption(option => option.setName('duration').setDescription('The duration of the music in seconds').setMinValue(5).setMaxValue(300))
			.addNumberOption(option => option.setName('temperature').setDescription('Softmax temperature for generation').setMinValue(0.0).setMaxValue(1.0))
			.addIntegerOption(option => option.setName('top_k').setDescription('Top K value for sampling').setMinValue(1).setMaxValue(500))
      .addNumberOption(option => option.setName('top_p').setDescription('Top P value for sampling').setMinValue(0.0).setMaxValue(1.0))
			.addNumberOption(option => option.setName('cfg_coef').setDescription('Coefficient for classifier free guidance').setMinValue(0.0).setMaxValue(10.0))
			.addNumberOption(option => option.setName('extend_stride').setDescription('Stride length for extended generation').setMinValue(1).setMaxValue(30))
	].map(command => command.toJSON());

	const rest = new REST().setToken(token);
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
			{ body: commands },
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}

	// Start queue processing
	processQueue();
});

client.on('interactionCreate', async interaction => {
	// Check if interaction is a command and occurs in a guild
	if (!interaction.isCommand() || !interaction.inGuild()) {
		if (!interaction.inGuild()) {
			// Reply only if the interaction is not in a guild
			await interaction.reply({ content: 'This command can only be used in servers.', ephemeral: true });
		}
		return;
	}

	const { commandName, options } = interaction;

	if (commandName === 'generate') {
		const prompt = options.getString('prompt');
		const params = {
			duration: options.getInteger('duration') || 60,
			temperature: options.getNumber('temperature'),
			top_k: options.getInteger('top_k'),
			top_p: options.getNumber('top_p'),
			cfg_coef: options.getNumber('cfg_coef'),
			extend_stride: options.getInteger('extend_stride')
		};
		console.log(`Received prompt: ${prompt}`);
		const queueLen = queue.length;
		const queueMessage = queueLen === 0 ? `I'll get started on your prompt \`${prompt}\` right away.` : `Your prompt \`${prompt}\` has been enqueued! There are ${queueLen} prompt(s) ahead of you.`;
		queue.push({ prompt: prompt, params: params, interaction: interaction });
		const replyMessage = `Got it! ${queueMessage}\nI'll notify you when it's ready!`;
		await interaction.reply({ 
			content: replyMessage
		});
	}
});

async function processQueue() {
	while (true) {
		if (queue.length > 0) {
			const { prompt, params, interaction } = queue.shift();
			const channel = interaction.channel;
			const user = interaction.user;

			try {
				const response = await axios.post(apiEndpoint, {
					prompt: prompt,
					duration: params.duration,
					temperature: params.temperature,
					top_k: params.top_k,
					top_p: params.top_p,
					cfg_coef: params.cfg_coef,
					extend_stride: params.extend_stride
				}, { responseType: 'arraybuffer' });

				const musicFile = response.data;
				// replace prompt spaces with underscores
				const filename = prompt.replace(/ /g, '_') + '.ogg';
				const attachment = new AttachmentBuilder(musicFile, { name: filename });

				await channel.send({
					content: `Hey <@${user.id}>, your music is ready!`,
					files: [attachment]
				});
			} catch (error) {
				console.error(error);
				await channel.send(`<@${user.id}>, something went wrong while generating your music. Please try again later.`);
			}
		}
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
}

client.login(token);
