#!/usr/bin/env bash
# build.sh —— SpartanUltra 项目打包
#
# 用法：
#   bash ./build.sh                 # 打包到 ./dist/spartan-hub-YYYYMMDD-HHmm.tar.gz
#   OUTPUT_DIR=/tmp bash ./build.sh # 指定输出目录
#
# 设计要点：
#   - 排除 node_modules、.env、data/、logs/、.DS_Store、.git/
#   - 默认软链 npm ci，部署端装包（避免 ~300 MB 依赖进包）
#   - 生成 SHA256 与文件清单 manifest.txt
#   - 兼容 Windows Git Bash 与 Linux/macOS

set -euo pipefail

cd "$(dirname "$0")"

# ====== 参数区 ======
OUTPUT_DIR="${OUTPUT_DIR:-./dist}"
TIMESTAMP="$(date +%Y%m%d-%H%M)"
PROJECT_NAME="spartan-hub"
ARCHIVE_NAME="${PROJECT_NAME}-${TIMESTAMP}.tar.gz"

# ====== 工具函数 ======
log()  { printf "\033[1;34m[build]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[WARN ]\033[0m %s\n" "$*" >&2; }
err()  { printf "\033[1;31m[ERR  ]\033[0m %s\n" "$*" >&2; exit 1; }

[ -d .git ] && warn "建议打包前 git status 干净（避免把未提交改动漏掉）"

mkdir -p "$OUTPUT_DIR"
STAGE_DIR="$(mktemp -d -t spartan-build-XXXXXX)"
trap 'rm -rf "$STAGE_DIR"' EXIT

log "阶段目录: $STAGE_DIR"
log "输出目录: $OUTPUT_DIR"
log "包名    : $ARCHIVE_NAME"

# ====== 复制源码 ======
log "复制项目文件（排除依赖、数据库、日志）..."

# 使用 tar 复制可以保证保留权限，并且能精确控制排除项
tar \
  --exclude='./.git' \
  --exclude='./dist' \
  --exclude='./server/node_modules' \
  --exclude='./server/data' \
  --exclude='./server/logs' \
  --exclude='./server/.env' \
  --exclude='./server/.server.pid' \
  --exclude='./server/server.log' \
  --exclude='./server/*.db' \
  --exclude='./**/.DS_Store' \
  --exclude='./**/Thumbs.db' \
  --exclude='./**/node_modules' \
  -cf - . | tar -xf - -C "$STAGE_DIR"

# ====== 生成 manifest.txt ======
log "生成文件清单 manifest.txt ..."
{
  echo "SpartanUltra Build Manifest"
  echo "==========================="
  echo "Build Time : $(date -Iseconds 2>/dev/null || date)"
  echo "Git Commit : $(git rev-parse --short HEAD 2>/dev/null || echo 'not-a-git-repo')"
  echo "Git Branch : $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
  echo "Hostname   : $(hostname 2>/dev/null || echo unknown)"
  echo
  echo "Files:"
  echo "------"
  (cd "$STAGE_DIR" && find . -type f | sort)
} > "$STAGE_DIR/manifest.txt"

# ====== 打包 ======
log "压缩为 tar.gz ..."
tar -czf "$OUTPUT_DIR/$ARCHIVE_NAME" -C "$STAGE_DIR" .

# ====== 计算 SHA256 ======
log "计算 SHA256 ..."
SHA_FILE="$OUTPUT_DIR/${ARCHIVE_NAME%.tar.gz}.sha256"
if command -v sha256sum >/dev/null 2>&1; then
  ( cd "$OUTPUT_DIR" && sha256sum "$ARCHIVE_NAME" ) > "$SHA_FILE"
else
  ( cd "$OUTPUT_DIR" && shasum -a 256 "$ARCHIVE_NAME" ) > "$SHA_FILE"
fi

# ====== 报告 ======
SIZE=$(du -h "$OUTPUT_DIR/$ARCHIVE_NAME" | cut -f1)
log "================================================"
log "打包完成"
log "  包路径  : $OUTPUT_DIR/$ARCHIVE_NAME"
log "  包大小  : $SIZE"
log "  校验文件: $SHA_FILE"
log "  文件总数: $(find "$STAGE_DIR" -type f | wc -l)"
log "================================================"

echo
echo "上传到服务器示例："
echo "  scp $OUTPUT_DIR/$ARCHIVE_NAME root@spartanultra.allenboard.cn:/tmp/"
echo