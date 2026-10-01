#!/bin/sh
# Nur für das dokumentierte statische Belegungs-Ziel. Bestehende Releases bleiben erhalten.
set -eu
base=/var/www/belegung
release_id=${1:?Release-ID fehlt}
archive_sha=${2:?Archiv-Hash fehlt}
index_sha=${3:?Index-Hash fehlt}
expected_previous=${4:?Bisheriger Releasepfad fehlt}
case "$release_id" in ''|*[!a-zA-Z0-9_-]*) echo 'Ungültige Release-ID' >&2; exit 1;; esac
case "$archive_sha:$index_sha" in *[!a-f0-9:]*|:*) echo 'Ungültiger Hash' >&2; exit 1;; esac
[ "${#archive_sha}" -eq 64 ] && [ "${#index_sha}" -eq 64 ]
[ "$(readlink -f "$base")" = "$base" ]
[ "$(readlink -f "$base/releases")" = "$base/releases" ]
case "$expected_previous" in "$base"/releases/*) ;; *) echo 'Rollbackpfad außerhalb der Anwendung' >&2; exit 1;; esac
[ -L "$base/current" ]
previous=$(readlink -f "$base/current")
[ "$previous" = "$expected_previous" ] || { echo 'Aktiver Release wurde zwischenzeitlich geändert' >&2; exit 1; }
[ -f "$previous/index.html" ]
release="$base/releases/$release_id"
archive="$base/releases/$release_id.tar.gz"
switch="$base/current-next-$release_id"
[ ! -e "$release" ] && [ ! -L "$release" ]
[ ! -e "$switch" ] && [ ! -L "$switch" ]
[ ! -e "$switch.rollback" ] && [ ! -L "$switch.rollback" ]
printf '%s  %s\n' "$archive_sha" "$archive" | sha256sum -c -
mkdir "$release"
tar --no-same-owner --no-same-permissions -xzf "$archive" -C "$release"
[ "$(readlink -f "$release")" = "$release" ]
printf '%s  %s\n' "$index_sha" "$release/index.html" | sha256sum -c -
[ -d "$release/_next/static" ]
[ ! -e "$release/api/debug-shot" ]
chmod -R a+rX "$release"
rollback() {
  result=$?
  if [ "$result" -ne 0 ] && [ "$(readlink -f "$base/current")" = "$release" ]; then
    ln -s "$previous" "$switch.rollback"
    mv -Tf "$switch.rollback" "$base/current"
    printf 'ROLLBACK %s\n' "$previous" >&2
  fi
  exit "$result"
}
trap rollback EXIT
ln -s "$release" "$switch"
mv -Tf "$switch" "$base/current"
curl --fail --silent --show-error --max-time 20 --resolve belegung.suedenergie-pv.de:443:127.0.0.1 \
  https://belegung.suedenergie-pv.de/ -o "$base/releases/$release_id-served.html"
printf '%s  %s\n' "$index_sha" "$base/releases/$release_id-served.html" | sha256sum -c -
printf 'DEPLOYED %s\nPREVIOUS %s\n' "$release" "$previous"
