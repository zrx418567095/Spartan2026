#!/usr/bin/env bash
# push.sh —— 一键推送到 https://github.com/zrx418567095/Spartan2026
#
# 用法：
#   bash ./push.sh                       推送 main
#   bash ./push.sh --tags                同时推送所有本地 tag
#   SPARTAN_TOKEN=ghp_xxx bash ./push.sh 自定义 token
#
# 设计要点：
#   - 解决 Windows 全局 gitconfig 中失效的 proxy 引发的 2802 / 443 超时
#   - 通过隔离 HOME、显式指定 7890 代理、http.<url>.extraHeader 注入 Auth
#   - 避免任何凭证落盘到 .git/config

set -euo pipefail

# ====== 参数区（可被同名环境变量覆盖） ======
TOKEN="${SPARTAN_TOKEN:-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}"
USERNAME="${SPARTAN_USER:-zrx418567095}"
REMOTE_URL="${SPARTAN_REMOTE:-https://github.com/zrx418567095/Spartan2026.git}"
PROXY="${SPARTAN_PROXY:-http://127.0.0.1:7890}"
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

# ====== 探测远端是否存在 main：决定是否带 -u ======
PROBE=$(env -i \
  PATH="/c/Program Files/Git/mingw64/bin:/usr/bin:$PATH" \
  HOME=/tmp/empty-home USERPROFILE=/tmp/empty-home \
  GIT_HTTP_LOW_SPEED_TIME=600 GIT_TERMINAL_PROMPT=0 \
  git -c http.proxy="$PROXY" -c https.proxy="$PROXY" \
      -c http.sslVerify=false -c credential.helper= \
      -c user.name="$GIT_USER_NAME" -c user.email="$GIT_USER_EMAIL" \
      -c "http.https://github.com.extraHeader=$AUTH_HEADER" \
  ls-remote "$REMOTE_URL" 2>&1 || true)

PUSH_ARGS=()
if echo "$PROBE" | grep -q "refs/heads/main"; then
  PUSH_ARGS=()
else
  echo "INFO: 远端 main 未建立，按首次推送处理（加 -u）。"
  PUSH_ARGS=("-u")
fi

# ====== 执行推送 ======
env -i \
  PATH="/c/Program Files/Git/mingw64/bin:/usr/bin:$PATH" \
  HOME=/tmp/empty-home USERPROFILE=/tmp/empty-home \
  GIT_HTTP_LOW_SPEED_TIME=600 GIT_TERMINAL_PROMPT=0 \
  git -c http.proxy="$PROXY" -c https.proxy="$PROXY" \
      -c http.sslVerify=false -c credential.helper= \
      -c user.name="$GIT_USER_NAME" -c user.email="$GIT_USER_EMAIL" \
      -c "http.https://github.com.extraHeader=$AUTH_HEADER" \
  push "${PUSH_ARGS[@]}" "$REMOTE_URL" main "$@"

echo "OK: push completed."
