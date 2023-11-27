require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, REST, Routes } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const token = process.env.DISCORD_BOT_TOKEN;
const apiEndpoint = 'http://127.0.0.1:5000/generate';

let queue = [];

client.once('ready', async () => {
	console.log(`Logged in as ${client.user.tag}!`);

	// Register slash commands
	const commands = [
		new SlashCommandBuilder()
			.setName('generate')
			.setDescription('Generate music from a prompt')
			.addStringOption(option => option.setName('prompt').setDescription('The prompt for the music').setRequired(true))
			.addIntegerOption(option => option.setName('duration').setDescription('The duration of the music in seconds').setRequired(false)),
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
		const duration = Math.min(300, options.getInteger('duration') || 90);
		console.log(`Received prompt: ${prompt}`);
		queue.push({ prompt: prompt, duration: duration, interaction: interaction });
		await interaction.reply({ content: `Your prompt \`${prompt}\` has been added to the queue. I'll notify you when it's ready!` });
	}
});

async function processQueue() {
	while (true) {
		if (queue.length > 0) {
			const { prompt, duration, interaction } = queue.shift();
			const channel = interaction.channel;
			const user = interaction.user;

			try {
				const response = await axios.post(apiEndpoint, {
					prompt: prompt,
					duration: duration
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
