import { openai } from './openai.js'
import {client, collectionName, dbName} from "./db.js";

export const INITIAL_SESSION = {
  messages: [],
}

export async function initCommand(ctx) {
  ctx.session = { ...INITIAL_SESSION }
  await ctx.reply('Жду вашего голосового или текстового сообщения')
}

export async function processTextToChat(ctx, content) {
  try {
    ctx.session.messages.push({ role: openai.roles.USER, content })

    const response = await openai.chat(ctx.session.messages)

    ctx.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response.content,
    })

    await ctx.reply(response.content)

    // Store the updated session in the database
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    await collection.updateOne(
        { chatId: ctx.chat.id },
        { $set: { session: ctx.session } },
        { upsert: true }
    );

  } catch (e) {
    console.log('Error while processing text to gpt', e.message)
  }
}