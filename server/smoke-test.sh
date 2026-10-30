#!/usr/bin/env bash
# Smoke test Worker API ARI — jalankan saat worker dev/production hidup:
#   BASE=http://localhost:8787 ./server/smoke-test.sh
set -euo pipefail
BASE="${BASE:-http://localhost:8787}"

pass=0
fail=0
check() { # label expected_substring actual
  if [[ "$3" == *"$2"* ]]; then
    echo "  ok    $1"; pass=$((pass+1))
  else
    echo "  GAGAL $1"
    echo "    harap ada: $2"
    echo "    hasil:     $3"
    fail=$((fail+1))
  fi
}

echo "-- /health --"
check "health" '"ok":true' "$(curl -s "$BASE/health")"

echo "-- upsert employee --"
emp='{"table":"ari_employees","rows":[{"id":"emp-1","value":{"id":"emp-1","name":"Ari","username":"ari","access_role":"owner","pin":"sha256_sim_1509442","status_aktif":true},"updated_at":"2026-10-30T00:00:00.000Z"}],"onConflict":"id"}'
check "upsert karyawan" '"error":null' "$(curl -s -X POST "$BASE/api/upsert" -H 'content-type: application/json' -d "$emp")"

echo "-- login (PIN 1234) --"
login_res="$(curl -s -X POST "$BASE/api/login" -H 'content-type: application/json' -d '{"p_username":"ari","p_pin":"1234"}')"
token="$(echo "$login_res" | sed -E 's/.*"token":"([a-f0-9]{64})".*/\1/')"
if [[ "$login_res" == *'"token"'* ]] && [[ ${#token} -eq 64 ]]; then
  echo "  ok    token sesi didapat (64 hex)"; pass=$((pass+1))
else
  echo "  GAGAL login tidak mengembalikan token: $login_res"; fail=$((fail+1))
fi

echo "-- login salah (PIN 0000) --"
check "PIN salah ditolak (tanpa token)" '"data":null' "$(curl -s -X POST "$BASE/api/login" -H 'content-type: application/json' -d '{"p_username":"ari","p_pin":"0000"}')"

echo "-- q biasa + json path --"
check "select semua" 'emp-1' "$(curl -s -X POST "$BASE/api/q" -H 'content-type: application/json' -d '{"table":"ari_employees","columns":["id","value"]}')"
check "filter value->>username" 'emp-1' "$(curl -s -X POST "$BASE/api/q" -H 'content-type: application/json' -d '{"table":"ari_employees","columns":["id"],"filters":[{"col":"value","json":"username","op":"eq","value":"ari"}]}')"

echo "-- ari_store upsert + maybeSingle --"
store='{"table":"ari_store","row":{"key":"brand","value":{"nama":"ARI"},"updated_at":"2026-10-30T00:00:00.000Z"}}'
check "upsert store" '"error":null' "$(curl -s -X POST "$BASE/api/upsert" -H 'content-type: application/json' -d "$store")"
single="$(curl -s -X POST "$BASE/api/q" -H 'content-type: application/json' -d '{"table":"ari_store","columns":["key","value"],"filters":[{"col":"key","op":"eq","value":"brand"}],"single":true}')"
check "maybeSingle" '"nama":"ARI"' "$single"

echo "-- attendance upsert ignoreDuplicates --"
att='{"table":"ari_attendance","row":{"id":"att-1","value":{"id":"att-1","timestamp":"2026-10-30T10:00:00+07:00","employee_id":"emp-1"},"created_at":"2026-10-30T03:00:00.000Z"},"onConflict":"id","ignoreDuplicates":true}'
check "absen masuk" '"error":null' "$(curl -s -X POST "$BASE/api/upsert" -H 'content-type: application/json' -d "$att")"

echo "-- penjualan ganda --"
sale1='{"table":"ari_marketplace_item_sales","rows":[{"id":"sale-1","value":{"id":"sale-1","order_number":"X1","description":"a","variant":"v","qty":1,"price":10,"date":"2026-10-30","marketplace_ref":"shopee"},"updated_at":"2026-10-30T00:00:00.000Z"}],"onConflict":"id"}'
sale2='{"table":"ari_marketplace_item_sales","rows":[{"id":"sale-2","value":{"id":"sale-2","order_number":"X1","description":"a","variant":"v","qty":1,"price":10,"date":"2026-10-30","marketplace_ref":"shopee"},"updated_at":"2026-10-30T00:00:00.000Z"}],"onConflict":"id"}'
check "penjualan pertama masuk" '"error":null' "$(curl -s -X POST "$BASE/api/upsert" -H 'content-type: application/json' -d "$sale1")"
check "penjualan ganda ditolak" 'ganda' "$(curl -s -X POST "$BASE/api/upsert" -H 'content-type: application/json' -d "$sale2")"

echo "-- delete tanpa token ditolak --"
del='{"p_table":"ari_employees","p_ids":["emp-1"],"p_token":""}'
check "delete tanpa token ditolak" 'Sesi tidak valid' "$(curl -s -X POST "$BASE/api/delete" -H 'content-type: application/json' -d "$del")"

echo "-- table whitelist --"
bad='{"table":"ari_sessions","columns":["token"]}'
check "ari_sessions tidak bisa dibaca" 'tidak dapat dibaca' "$(curl -s -X POST "$BASE/api/q" -H 'content-type: application/json' -d "$bad")"

echo "-- mass delete guard (dengan token sah) --"
mass='{"p_table":"ari_employees","p_ids":["fake1","fake2","fake3","fake4","fake5","fake6","fake7","fake8","fake9","fake10","fake11","fake12"],"p_token":"'"$token"'"}'
check "hapus massal ditolak" 'ditolak' "$(curl -s -X POST "$BASE/api/delete" -H 'content-type: application/json' -d "$mass")"

echo "-- delete dengan token sah --"
del_ok='{"p_table":"ari_employees","p_ids":["emp-1"],"p_token":"'"$token"'"}'
check "delete 1 baris sah" '"error":null' "$(curl -s -X POST "$BASE/api/delete" -H 'content-type: application/json' -d "$del_ok")"

echo "-- foto (R2) upload → serve → delete --"
key_foto="smoke-$(date +%s).jpg"
printf 'PNGDATA' > /tmp/ari-smoke-photo.jpg
up="$(curl -s -X POST "$BASE/api/photo" -F "key=$key_foto" -F "file=@/tmp/ari-smoke-photo.jpg")"
check "upload foto dapat url" "$key_foto" "$up"
url_foto="$(echo "$up" | sed -E 's/.*"url":"([^"]+)".*/\1/')"
check "serve foto 200/berisi data" 'PNGDATA' "$(curl -s "$url_foto")"
rm -f /tmp/ari-smoke-photo.jpg
check "delete foto" '"error":null' "$(curl -s -X DELETE "$BASE/api/photo" -H 'content-type: application/json' -d "{\"key\":\"$key_foto\"}")"
svc="$(curl -s -o /dev/null -w '%{http_code}' "$url_foto")"
check "foto sudah hilang (404)" '404' "$svc"

echo
echo "hasil: $pass lulus, $fail gagal"
[[ $fail -eq 0 ]] || exit 1
