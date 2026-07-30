#!/usr/bin/env node
// 初始化数据库结构（幂等）：执行 schema.sql
// 用法：npm run db:init 或 node scripts/init.js

require('dotenv').config();
const path = require('node:path');
const db = require('../db');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'spartan.db');
const SCHEMA = path.join(__dirname, '..', 'schema.sql');

console.log(`[init] open db: ${DB_PATH}`);
const handle = db.open(DB_PATH);

console.log('[init] apply schema ...');
db.applySchema(handle, SCHEMA);

console.log('[init] done.');
db.close();