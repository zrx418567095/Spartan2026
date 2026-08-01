#!/usr/bin/env bash
# db-backup.sh —— 备份 / 恢复 / 清理 spartan.db
#
# 用法：
#   bash scripts/db-backup.sh backup              # 立即备份当前 db
#   bash scripts/db-backup.sh list                # 列出所有备份
#   bash scripts/db-backup.sh restore <ts>       # 恢复到指定时间戳的备份
#   bash scripts/db-backup.sh clean [N]           # 保留最近 N 个备份（默认 10）
#   bash scripts/db-backup.sh auto               # reset 前自动调用
#
# 备份位置：data/backup/spartan.db.YYYY-MM-DD_HH-mm-ss.bak
# 最多保留 10 个备份（可通过 clean 调整）

set -euo pipefail

cd "$(dirname "$0")/.."
DATA_DIR="./data"
BACKUP_DIR="$DATA_DIR/backup"
DB="$DATA_DIR/spartan.db"

# ====== 工具函数 ======
ts_now() {
  date +%Y-%m-%d_%H-%M-%S
}

backup() {
  if [ ! -f "$DB" ]; then
    echo "ERROR: db 文件不存在 ($DB)"
    exit 1
  fi
  mkdir -p "$BACKUP_DIR"
  local ts
  ts=$(ts_now)
  local dst="$BACKUP_DIR/spartan.db.${ts}.bak"
  cp "$DB" "$dst"
  for ext in -wal -shm; do
    [ -f "$DB$ext" ] && cp "$DB$ext" "$dst$ext"
  done
  echo "✓ 已备份到 $dst"
  echo "$dst"  # 输出路径给调用方
}

list() {
  echo "=== 现有备份 ==="
  if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
    echo "  (空)"
    return
  fi
  # 按时间倒序
  ls -lt "$BACKUP_DIR"/spartan.db.*.bak 2>/dev/null | awk '{print $9, $5, $6, $7, $8}' | while read f size m d t; do
    [ -z "$f" ] && continue
    local ts=$(basename "$f" .bak | sed 's/spartan.db\.//')
    echo "  $ts  ($size bytes)  $f"
  done
}

restore() {
  local target="$1"
  if [ -z "$target" ]; then
    echo "用法: $0 restore <timestamp>"
    echo "示例: $0 restore 2026-08-01_10-30-00"
    echo ""
    list
    exit 1
  fi

  # 支持部分匹配（如 2026-08-01 会匹配第一个匹配项）
  local match
  match=$(ls "$BACKUP_DIR"/spartan.db.*.bak 2>/dev/null | grep "$target" | head -1 || true)
  if [ -z "$match" ]; then
    echo "ERROR: 找不到匹配 '$target' 的备份"
    list
    exit 1
  fi

  echo "准备恢复: $match"
  echo "  当前 db: $(stat -c %s "$DB" 2>/dev/null || echo '不存在') bytes"
  echo "  备份 db: $(stat -c %s "$match") bytes"
  echo ""
  read -p "确认覆盖当前 db？(yes/no) " ans
  if [ "$ans" != "yes" ]; then
    echo "已取消"
    return
  fi

  # 停服务
  if command -v taskkill >/dev/null 2>&1; then
    taskkill //F //IM node.exe 2>/dev/null || true
  fi
  sleep 1

  # 备份当前（保险）
  backup > /dev/null

  # 恢复
  cp "$match" "$DB"
  for ext in -wal -shm; do
    [ -f "$match$ext" ] && cp "$match$ext" "$DB$ext" || rm -f "$DB$ext"
  done
  echo "✓ 已恢复: $match"
  echo "  → 启动: bash start.sh start"
}

clean() {
  local keep="${1:-10}"
  if [ ! -d "$BACKUP_DIR" ]; then
    echo "备份目录不存在"
    return
  fi
  local count=$(ls "$BACKUP_DIR"/spartan.db.*.bak 2>/dev/null | wc -l)
  if [ "$count" -le "$keep" ]; then
    echo "当前 $count 个备份（≤ $keep，无需清理）"
    return
  fi
  local remove_count=$((count - keep))
  # 保留最新的 $keep 个，删最旧的
  ls -t "$BACKUP_DIR"/spartan.db.*.bak | tail -n "$remove_count" | while read f; do
    echo "  删除: $f"
    rm -f "$f" "$f-wal" "$f-shm"
  done
  echo "✓ 已清理 $remove_count 个旧备份，保留 $keep 个"
}

# ====== 入口 ======
case "${1:-help}" in
  backup)    backup ;;
  list)      list ;;
  restore)   restore "${2:-}" ;;
  clean)     clean "${2:-10}" ;;
  auto)      backup ;;  # 供其他脚本调用
  *)
    echo "用法: $0 {backup|list|restore <ts>|clean [N]}"
    echo ""
    echo "示例:"
    echo "  $0 backup                                # 立即备份"
    echo "  $0 list                                  # 列出所有备份"
    echo "  $0 restore 2026-08-01_10-30-00          # 恢复指定备份"
    echo "  $0 clean 5                               # 只保留最近 5 个"
    ;;
esac