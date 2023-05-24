import { Telegraf, session } from 'telegraf'
import { message } from 'telegraf/filters'
import { code } from 'telegraf/format'
import config from 'config'
import { ogg } from './ogg.js'
import { openai } from './openai.js'
import { removeFile } from './utils.js'
import { initCommand, processTextToChat, INITIAL_SESSION } from './logic.js'
import {client, collectionName, dbName} from "./db.js";

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

bot.use(session())

const sessions = {};

bot.command('new', initCommand)

bot.command('start', initCommand)

bot.on(message('voice'), async (ctx) => {

  //ctx.session ??= INITIAL_SESSION
  try {
    await ctx.reply(code('Сообщение принял. Жду ответ от сервера...'))
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
    const userId = String(ctx.message.from.id)
    const oggPath = await ogg.create(link.href, userId)
    const mp3Path = await ogg.toMp3(oggPath, userId)

    await removeFile(oggPath)

    const text = await openai.transcription(mp3Path)
    await ctx.reply(code(`Ваш запрос: ${text}`))

    ctx.session ??= { ...INITIAL_SESSION };
    await processTextToChat(ctx, text)

    sessions[ctx.chat.id] = ctx.session;
  } catch (e) {
    console.log(`Error while voice message`, e.message)
  }
})

bot.on(message('text'), async (ctx) => {
  ctx.session ??= await getSession(ctx) //INITIAL_SESSION
  try {
    await ctx.reply(code('Сообщение принял. Жду ответ от сервера...'))
    await processTextToChat(ctx, ctx.message.text)

    sessions[ctx.chat.id] = ctx.session;

  } catch (e) {
    console.log(`Error while voice message`, e.message)
  }
})


const startBot = async () => {
  try {
    await loadSessionsFromDatabase(); // Load sessions from the database

    await bot.launch();
    console.log('Bot started successfully!');
  } catch (e) {
    console.error('Failed to start the bot:', e);
  }
};

startBot().catch((err) => console.error('Error starting the bot:', err));

async function loadSessionsFromDatabase() {
  try {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    const chats = await collection.find().toArray();

    for (const chat of chats) {
      sessions[chat.chatId] = chat.session;
    }
    console.log('Sessions loaded successfully');
  } catch (e) {
    console.error('Error loading sessions from the database:', e);
  }
}

/*const startBot = async () => {
  try {
    await bot.launch();
    console.log('Bot started successfully!');
  } catch (e) {
    console.error('Failed to start the bot:', e);
  }
};

startBot().catch((err) => console.error('Error starting the bot:', err));*/

//bot.launch()

/*
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
*/


process.once('SIGINT', async () => {
  await saveSessions();
  bot.stop('SIGINT');
});

process.once('SIGTERM', async () => {
  await saveSessions();
  bot.stop('SIGTERM');
});

async function getSession(ctx) {
  try {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    const result = await collection.findOne({ chatId: ctx.chat.id });
    return result?.session || { ...INITIAL_SESSION };
  } catch (e) {
    console.error('Error retrieving session from the database:', e);
    return { ...INITIAL_SESSION };
  }
}

async function saveSessions() {
  try {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    await collection.deleteMany({});

    for (const chatId of Object.keys(sessions)) {
      const session = sessions[chatId];
      await collection.insertOne({ chatId, session });
    }

    console.log('Sessions saved successfully');
  } catch (e) {
    console.error('Error saving sessions to the database:', e);
  }
}
