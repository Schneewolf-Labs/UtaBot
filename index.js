require('dotenv').config();
const { Client, Intents, MessageAttachment } = require('discord.js');
const axios = require('axios');

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const token = process.env.DISCORD_BOT_TOKEN;
const apiEndpoint = 'http://127.0.0.1:5000/generate';

let queue = [];

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Registering the slash command
    const data = {
        name: 'generate',
        description: 'Generate music based on a prompt',
        options: [{
            name: 'prompt',
            type: 'STRING',
            description: 'The prompt to generate music from',
            required: true,
        }],
    };

    await client.application?.commands.create(data);

		processQueue();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'generate') {
        const prompt = options.getString('prompt');
				queue.push({ prompt: prompt, interaction: interaction });
				await interaction.reply({ content: `Your prompt "${prompt}" has been added to the queue. I'll notify you when it's ready!` });
    }
});

async function processQueue() {
	while(true) {
		if (queue.length > 0) {
			const { prompt, interaction } = queue.shift();
			const channel = interaction.channel;
			const user = interaction.user;

			try {
				const response = await axios.post(apiEndpoint, {
					prompt: prompt
				}, { responseType: 'arraybuffer' });

				const musicFile = response.data;
				const attachment = new MessageAttachment(musicFile, 'music.ogg');
				
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
