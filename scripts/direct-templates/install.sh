#!/bin/sh
# Website-hosted installer for direct GitHub Releases distribution.
set -eu
cli='__CLI__'
binary='__BINARY__'
repo='https://github.com/__OWNER__/__REPO__'
install_dir=${CLI_INSTALL_DIR:-"$HOME/.local/bin"}
action=${1:-install}
case "$action" in install|upgrade|--check) ;; *) echo "Usage: install.sh [upgrade|--check]" >&2; exit 2;; esac
case "$(uname -s)" in Darwin) os=darwin;; Linux) os=linux;; *) echo 'On Windows use __SITE__/install.ps1' >&2; exit 1;; esac
case "$(uname -m)" in arm64|aarch64) arch=arm64;; x86_64|amd64) arch=amd64;; *) echo 'Unsupported architecture' >&2; exit 1;; esac
case "$install_dir" in /*) ;; *) echo 'CLI_INSTALL_DIR must be absolute' >&2; exit 1;; esac
for tool in curl awk; do command -v "$tool" >/dev/null 2>&1 || { echo "$tool is required" >&2; exit 1; }; done

target=${CLI_UPGRADE_TARGET:-"$install_dir/$cli"}
case "$target" in /*) ;; *) echo 'Upgrade target must be absolute' >&2; exit 1;; esac
if [ "$action" = install ] && { [ -e "$target" ] || [ -L "$target" ]; }; then
  echo "$cli is installed. Run '$cli upgrade' to update it." >&2
  exit 1
fi
if [ "$action" = upgrade ] && [ ! -f "$target" ]; then
  echo "No installed $cli executable at $target" >&2
  exit 1
fi
if [ -L "$target" ]; then echo 'Refusing to replace a symlink; install a managed binary first' >&2; exit 1; fi

version=${CLI_VERSION:-}
if [ -n "$version" ]; then
  version=${version#v}
  printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo 'Invalid CLI_VERSION' >&2; exit 1; }
  base="$repo/releases/download/v$version"
else
  base="$repo/releases/latest/download"
fi
if [ "$action" = --check ]; then
  printf 'Installed: '
  if [ -x "$target" ]; then "$target" --version; else echo '(not installed)'; fi
  curl --proto '=https' --tlsv1.2 -fsSIL --max-time 20 -o /dev/null -w 'Latest release: %{url_effective}\n' "$repo/releases/latest"
  exit 0
fi

umask 077
stage=$(mktemp -d "${TMPDIR:-/tmp}/${cli}-install.XXXXXXXX")
trap 'rm -rf "$stage"' EXIT HUP INT TERM
asset="${binary}_${os}_${arch}"
curl --proto '=https' --tlsv1.2 -fsSL --retry 3 "$base/SHA256SUMS" -o "$stage/SHA256SUMS"
curl --proto '=https' --tlsv1.2 -fsSL --retry 3 "$base/$asset" -o "$stage/$asset"
expected=$(awk -v name="$asset" '$2 == name { n++; value=$1 } END { if (n == 1) print value }' "$stage/SHA256SUMS")
printf '%s' "$expected" | grep -Eq '^[[:xdigit:]]{64}$' || { echo 'Missing or invalid release checksum' >&2; exit 1; }
if command -v shasum >/dev/null 2>&1; then
  actual=$(shasum -a 256 "$stage/$asset" | awk '{print $1}')
else
  actual=$(sha256sum "$stage/$asset" | awk '{print $1}')
fi
[ "$actual" = "$expected" ] || { echo 'Release checksum mismatch; installation unchanged' >&2; exit 1; }
chmod 755 "$stage/$asset"
"$stage/$asset" --version
mkdir -p "$(dirname "$target")"
pending=$(mktemp "$(dirname "$target")/.${cli}-next.XXXXXXXX")
trap 'rm -rf "$stage"; rm -f "$pending"' EXIT HUP INT TERM
cp "$stage/$asset" "$pending"
chmod 755 "$pending"
mv -f "$pending" "$target"
"$target" --version
printf 'Installed %s at %s\n' "$cli" "$target"
case ":${PATH:-}:" in *":$(dirname "$target"):"*) ;; *) printf 'Add %s to your PATH.\n' "$(dirname "$target")";; esac
