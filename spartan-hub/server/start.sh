#!/usr/bin/env bash
# start.sh —— SpartanUltra 后端启动/停止/状态管理
#
# 用法：
#   bash ./start.sh start          # 后台启动（默认）
#   bash ./start.sh stop           # 停止
#   bash ./start.sh restart        # 重启
#   bash ./start.sh status         # 查看运行状态
#   bash ./start.sh logs           # tail -f 日志
#   bash ./start.sh foreground     # 前台运行（Ctrl+C 退出）
#   bash ./start.sh reset --force  # 删表重建 + 重新 seed（需 --force + 二次确认）
#
# 设计要点：
#   - 写 PID 到 .server.pid，便于 stop/restart
#   - 日志输出到 logs/server.log
#   - 自动检查 .env，首次运行生成随机 JWT_SECRET
#   - 首次启动自动 db:init + db:seed（已建库则跳过）

set -euo pipefail

cd "$(dirname "$0")"

# ====== 路径常量 ======
DATA_DIR="./data"
LOG_DIR="./logs"
PID_FILE="./.server.pid"
LOG_FILE="$LOG_DIR/server.log"
ENV_FILE="./.env"

# ====== 工具函数 ======
ensure_dirs() {
  mkdir -p "$DATA_DIR" "$LOG_DIR"
}

is_running() {
  # 通过端口响应判断（Git Bash/Windows 下 PID 不可靠）
  local port
  port=$(get_port)
  curl -s -m 1 -o /dev/null "http://127.0.0.1:$port/healthz" 2>/dev/null
}

get_port() {
  if [ -f "$ENV_FILE" ]; then
    local p
    p=$(grep '^PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '\r')
    if [ -n "$p" ]; then echo "$p"; return; fi
  fi
  echo "${PORT:-3000}"
}

ensure_env() {
  if [ ! -f "$ENV_FILE" ]; then
    echo "INFO: 首次启动，生成 .env（JWT_SECRET 随机 64 字节）"
    local secret
    secret=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    cat > "$ENV_FILE" <<EOF
PORT=3000
HOST=127.0.0.1
NODE_ENV=production
JWT_SECRET=$secret
SQLITE_PATH=$PWD/$DATA_DIR/spartan.db
TRUSTED_PROXY=true
TOKEN_TTL_SECONDS=28800
EOF
    chmod 600 "$ENV_FILE"
    echo "INFO: 已写入 $ENV_FILE（chmod 600）"
  fi
}

ensure_db() {
  if [ -f "$DATA_DIR/spartan.db" ]; then
    echo "INFO: 数据库已存在，跳过 init/seed"
    return
  fi
  echo "INFO: 首次部署，初始化数据库 ..."
  node scripts/init.js
  node scripts/seed.js
}

ensure_deps() {
  if [ ! -d node_modules ]; then
    echo "INFO: 安装依赖 ..."
    npm install --no-audit --no-fund --loglevel=error
  fi
}

# ====== 命令实现 ======

cmd_start() {
  ensure_dirs
  ensure_deps
  ensure_env
  ensure_db

  if is_running; then
    echo "WARN: 服务已在运行（PID=$(cat "$PID_FILE")）"
    return 0
  fi

  echo "INFO: 启动 spartan-api ..."
  # 后台启动，nohup + disown
  nohup node index.js > "$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  # 等待端口就绪（最多 10 秒）
  local port
  port=$(grep '^PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '\r' || echo 3000)
  for i in $(seq 1 20); do
    if curl -s -m 1 -o /dev/null "http://127.0.0.1:$port/healthz" 2>/dev/null; then
      echo "OK: spartan-api started, PID=$pid, port=$port"
      echo "     health: http://127.0.0.1:$port/healthz"
      echo "     logs:   tail -f $LOG_FILE"
      return 0
    fi
    sleep 0.5
  done
  echo "ERROR: 启动超时，查看 $LOG_FILE" >&2
  cat "$LOG_FILE" | tail -30 >&2
  return 1
}

cmd_stop() {
  if ! is_running; then
    echo "INFO: 服务未运行"
    rm -f "$PID_FILE"
    return 0
  fi
  echo "INFO: 停止服务 ..."
  if command -v taskkill >/dev/null 2>&1; then
    # Windows: 通过端口查 PID 杀
    local port
    port=$(get_port)
    local pids
    pids=$(netstat -ano 2>/dev/null | grep ":$port " | grep LISTENING | awk '{print $NF}' | sort -u)
    for p in $pids; do
      taskkill //PID "$p" //F 2>/dev/null || true
    done
  else
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null || true)
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
    pkill -f "node index.js" 2>/dev/null || true
    for i in $(seq 1 10); do
      if ! is_running; then break; fi
      sleep 0.5
    done
    if is_running; then
      pkill -9 -f "node index.js" 2>/dev/null || true
    fi
  fi
  rm -f "$PID_FILE"
  echo "OK: stopped"
}

cmd_restart() {
  cmd_stop || true
  sleep 1
  cmd_start
}

cmd_status() {
  if is_running; then
    local port
    port=$(get_port)
    echo "STATUS: running on http://127.0.0.1:$port"
    if [ -f "$LOG_FILE" ]; then
      echo "----- last 10 log lines -----"
      tail -10 "$LOG_FILE"
    fi
  else
    echo "STATUS: stopped"
    return 1
  fi
}

cmd_logs() {
  if [ ! -f "$LOG_FILE" ]; then
    echo "INFO: 日志文件不存在（服务可能未启动过）"
    return 1
  fi
  tail -f "$LOG_FILE"
}

cmd_foreground() {
  ensure_dirs
  ensure_deps
  ensure_env
  ensure_db
  echo "INFO: 前台启动（Ctrl+C 退出） ..."
  exec node index.js
}

cmd_reset() {
  # 安全护栏：必须显式传 --force 才会进入 reset 流程
  if [ "${1:-}" != "--force" ]; then
    echo "ERROR: 重置数据库需要 --force 标志"
    echo "用法: $0 reset --force"
    echo ""
    echo "⚠️  这将永久删除所有数据：成员 / 公告 / 费用 / 分摊 / 任务 / 装备 / 审计日志"
    echo "⚠️  不会删除 SQLite 数据库文件本身，但会重建并重新灌种子"
    echo "⚠️  生产环境慎用！建议先备份：cp data/spartan.db data/spartan.db.bak"
    return 1
  fi

  cmd_stop || true

  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  WARN: 即将重置数据库 $DATA_DIR/spartan.db"
  echo "  WARN: 所有用户数据将被清空（保留 schema，重灌种子）"
  echo "═══════════════════════════════════════════════════════════"
  echo ""

  # 二次确认：必须输入 DELETE 全大写
  read -p "Type 'DELETE' in UPPERCASE to confirm: " ans
  if [ "$ans" != "DELETE" ]; then
    echo "已取消"
    return 1
  fi

  # 等待 service 完全退出 + 文件句柄释放（避免 EBUSY）
  sleep 1

  node scripts/reset.js
  echo "OK: reset done"
}

# ====== 入口 ======
ACTION="${1:-start}"
shift || true

case "$ACTION" in
  start)        cmd_start "$@" ;;
  stop)         cmd_stop "$@" ;;
  restart)      cmd_restart "$@" ;;
  status)       cmd_status "$@" ;;
  logs|log|tail) cmd_logs "$@" ;;
  foreground|fg) cmd_foreground "$@" ;;
  reset)        cmd_reset "$@" ;;
  *)
    echo "用法: $0 {start|stop|restart|status|logs|foreground|reset}" >&2
    echo "      $0 reset --force    （数据库重置，需 --force + 二次确认）" >&2
    exit 1
    ;;
esac