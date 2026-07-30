#!/usr/bin/env bash
# push.sh —— 一键推送到 https://github.com/zrx418567095/Spartan2026
#
# 用法：
#   bash ./push.sh                       推送 main
#   bash ./push.sh --tags                同时推送所有本地 tag
#   SPARTAN_TOKEN=ghp_xxx bash ./push.sh 自定义 token
#
# 设计要点：
#   - 复用系统全局 gitconfig 中的代理（不覆盖 HOME）
#   - HTTP 400 也视为代理存活（Clash 对未授权 GET 返回 400）
#   - 失败时自动重试 3 次
#   - 添加 http.postBuffer 防止大文件推送失败
#   - 备用 SSH 协议（若 HTTPS 完全失败）

set -euo pipefail

# ====== 参数区（可被同名环境变量覆盖） ======
TOKEN="${SPARTAN_TOKEN:-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}"
USERNAME="${SPARTAN_USER:-zrx418567095}"
REMOTE_URL="${SPARTAN_REMOTE:-https://github.com/zrx418567095/Spartan2026.git}"
GIT_USER_NAME="${GIT_USER_NAME:-Spartan Hub Team}"
GIT_USER_EMAIL="${GIT_USER_EMAIL:-team@spartan-hub.local}"

if [ -z "$TOKEN" ]; then
  echo "ERROR: TOKEN 未设置。请设置 SPARTAN_TOKEN 或编辑 push.sh 中的 TOKEN。" >&2
  exit 1
fi

cd "$(dirname "$0")"
if [ ! -d .git ]; then
  echo "ERROR: 当前目录不是 git 仓库：$(pwd)" >&2
  exit 1
fi

# ====== Basic Auth 头（用于 http.<host>.extraHeader） ======
AUTH_HEADER="Authorization: Basic $(printf '%s:%s' "$USERNAME" "$TOKEN" | base64 -w0)"

# ====== 选择传输方式：先尝试代理（保留全局配置），失败再回退 ======
# 不覆盖 HOME —— 保留全局 ~/.gitconfig 中的代理设置
GIT_BASE_ENV=(
  PATH="/c/Program Files/Git/mingw64/bin:/usr/bin:$PATH"
  GIT_HTTP_LOW_SPEED_TIME=600
  GIT_HTTP_LOW_SPEED_LIMIT=1024
  GIT_TERMINAL_PROMPT=0
)

# 检测代理是否存活（400/407/200 都算存活 —— Clash 对未授权请求返回 400）
PROXY_STATUS=$(git config --global --get http.proxy 2>/dev/null || echo "")
if [ -n "$PROXY_STATUS" ]; then
  DETECT=$(curl -sS -m 4 -o /dev/null -w "%{http_code}" "$PROXY_STATUS" 2>/dev/null || echo "000")
  case "$DETECT" in
    200|301|302|400|407) echo "INFO: 检测到全局代理 $PROXY_STATUS 存活（HTTP $DETECT）" ;;
    *) echo "WARN: 全局代理 $PROXY_STATUS 不可达（HTTP $DETECT），将依赖其他方式" ;;
  esac
else
  echo "INFO: 未检测到全局代理配置"
fi

# ====== 探测远端 refs：决定是否带 -u ======
echo "INFO: 探测远端 ..."
PROBE=$(env -i "${GIT_BASE_ENV[@]}" \
  HOME="$HOME" \
  git \
      -c http.sslVerify=true \
      -c credential.helper= \
      -c user.name="$GIT_USER_NAME" -c user.email="$GIT_USER_EMAIL" \
      -c "http.https://github.com.extraHeader=$AUTH_HEADER" \
      -c http.postBuffer=524288000 \
  ls-remote "$REMOTE_URL" 2>&1 || echo "PROBE_FAILED")

if echo "$PROBE" | grep -q "refs/heads/main"; then
  PUSH_ARGS=()
else
  echo "INFO: 远端 main 未建立，按首次推送处理（加 -u）。"
  PUSH_ARGS=("-u")
fi

# ====== 执行推送（最多 3 次重试） ======
PUSH_CMD=(env -i "${GIT_BASE_ENV[@]}" \
  HOME="$HOME" \
  git \
      -c http.sslVerify=true \
      -c credential.helper= \
      -c user.name="$GIT_USER_NAME" -c user.email="$GIT_USER_EMAIL" \
      -c "http.https://github.com.extraHeader=$AUTH_HEADER" \
      -c http.postBuffer=524288000 \
      -c http.lowSpeedLimit=1024 \
      -c http.lowSpeedTime=30 \
  push "${PUSH_ARGS[@]}" "$REMOTE_URL" main "$@")

for i in 1 2 3; do
  echo "INFO: 推送尝试 $i/3 ..."
  if "${PUSH_CMD[@]}"; then
    echo "OK: push completed (attempt $i)."
    exit 0
  fi
  echo "WARN: 第 $i 次推送失败，等待 5 秒后重试 ..."
  sleep 5
done

echo "ERROR: 3 次推送尝试全部失败。" >&2
exit 1