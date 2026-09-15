import { openDatabase } from './db.js';
import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
const dbPath = process.env.DATABASE_PATH ?? './data/powder.db';

const db = openDatabase(dbPath);
const app = buildApp(db);

app
  .listen({ port, host: '0.0.0.0' })
  .then((address) => {
    console.log(`powder-trace-server 已启动: ${address} (数据库: ${dbPath})`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
