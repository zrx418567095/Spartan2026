#!/usr/bin/env node
// 重置数据库：删表重建 + 重新 seed（开发用，慎用于生产）
// 用法：
//   npm run db:reset              # 会先提示确认（输入 DELETE 全大写才执行）
//   npm run db:reset -- --force   # 跳过确认直接执行（不推荐生产环境）
//
// v0.3.4+: reset 前自动备份当前 db 到 data/backup/spartan.db.YYYY-MM-DD_HH-mm-ss.bak
//
// 注意：执行前必须确保没有任何进程持有 db 文件的锁：
//   - 后端 Node 服务（bash start.sh stop）
//   - DBeaver / sqlitebrowser 等 GUI 客户端（关闭连接或退出应用）
//   - 其他运行中的脚本 / Node REPL / sqlite3 CLI
//
// Windows 下会因 EBUSY 失败；Linux 下无此问题

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'spartan.db');
const DATA_DIR = path.dirname(DB_PATH);
const BACKUP_DIR = path.join(DATA_DIR, 'backup');

// 安全护栏：--force 跳过确认；否则要求输入 'DELETE' 大写
const skipConfirm = process.argv.includes('--force') || process.argv.includes('-y');
if (!skipConfirm) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  WARN: 即将重置数据库 ' + DB_PATH);
  console.log('  WARN: 所有用户数据将被清空（保留 schema，重灌种子）');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  // 二次确认：必须输入 DELETE 全大写
  const readline = require('node:readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("Type 'DELETE' in UPPERCASE to confirm: ", (ans) => {
    rl.close();
    if (ans !== 'DELETE') {
      console.log('已取消');
      process.exit(1);
    }
    doReset();
  });
} else {
  doReset();
}

function doReset() {
  const db = require('../db');

  // v0.3.4+: 自动备份当前 db（如果存在）到 backup/ 目录
  if (fs.existsSync(DB_PATH)) {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, '_').slice(0, 19);
    const backupPath = path.join(BACKUP_DIR, `spartan.db.${ts}.bak`);
    try {
      // 复制 db + wal + shm（保持一致）
      fs.copyFileSync(DB_PATH, backupPath);
      for (const ext of ['-wal', '-shm']) {
        const src = DB_PATH + ext;
        const dst = backupPath + ext;
        if (fs.existsSync(src)) fs.copyFileSync(src, dst);
      }
      console.log(`[reset] ✓ 备份到 ${backupPath}`);
    } catch (e) {
      console.error(`[reset] ⚠️ 备份失败: ${e.message}`);
      console.error('[reset] 继续执行 reset（如果不想丢数据请 Ctrl+C 中断）');
      // 给 3 秒让用户决定
      const sec = 3;
      for (let i = sec; i > 0; i--) {
        process.stdout.write(`\r[reset] ${i} 秒后继续... `);
        require('child_process').execSync('sleep 1', { stdio: 'ignore' });
      }
      process.stdout.write('\n');
    }
  }

  function tryUnlink(p) {
    if (!fs.existsSync(p)) return;
    // Windows 下 sqlite 进程退出后 db 文件可能仍被占用（EBUSY）
    // 重试最多 5 次，每次等 1s
    for (let i = 0; i < 5; i++) {
      try {
        fs.unlinkSync(p);
        console.log(`[reset] removed ${p}`);
        return;
      } catch (e) {
        if (e.code === 'EBUSY' || e.code === 'EPERM') {
          if (i === 4) {
            console.error(`[reset] FAILED to unlink ${p}: ${e.message}`);
            console.error(`[reset] 请确保服务已停止 (bash start.sh stop) 且 sqlite 进程已退出`);
            process.exit(1);
          }
          console.log(`[reset] ${p} busy, retry ${i + 1}/5 ...`);
          require('child_process').execSync('sleep 1', { stdio: 'ignore' });
        } else {
          throw e;
        }
      }
    }
  }

  if (fs.existsSync(DB_PATH)) {
    console.log(`[reset] removing ${DB_PATH}`);
    tryUnlink(DB_PATH);
  }
  // 同时清理 wal/shm
  for (const ext of ['-wal', '-shm']) {
    const p = DB_PATH + ext;
    if (fs.existsSync(p)) tryUnlink(p);
  }

  require('child_process').execSync('node scripts/init.js', { stdio: 'inherit', cwd: path.dirname(__dirname) });
  require('child_process').execSync('node scripts/seed.js', { stdio: 'inherit', cwd: path.dirname(__dirname) });
  console.log('[reset] done.');
  console.log(`[reset] 💡 如需恢复备份: cp ${backupPath} ${DB_PATH} (或用 scripts/restore.sh)`);
}