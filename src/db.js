import {MongoClient} from "mongodb";
import config from "config";

const mongoUri = config.get('MONGO_URL')
export const client = new MongoClient(mongoUri)// Database and collection names

export const dbName = 'your_database_name';
export const collectionName = 'sessions';

// Connect to the MongoDB server
try {
    await client.connect()
    console.log(" ✅ Connected successfully to mongo server")
} catch{
    console.log(" ❗️ Can't connect to db");
}
