#!/usr/bin/env node
// 重置数据库：删表重建 + 重新 seed（开发用，慎用于生产）
// 用法：npm run db:reset

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'spartan.db');

if (fs.existsSync(DB_PATH)) {
  console.log(`[reset] removing ${DB_PATH}`);
  fs.unlinkSync(DB_PATH);
  // 同时清理 wal/shm
  for (const ext of ['-wal', '-shm']) {
    const p = DB_PATH + ext;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

require('child_process').execSync('node scripts/init.js', { stdio: 'inherit', cwd: path.dirname(__dirname) });
require('child_process').execSync('node scripts/seed.js', { stdio: 'inherit', cwd: path.dirname(__dirname) });
console.log('[reset] done.');