// The scripts Move in shows for producing each accepted file from a vendor's own API or export.
// Each writes files under the 2 MiB upload limit, one page of history at a time.

export const zendeskScript = `ZD=yourcompany              # the first part of yourcompany.zendesk.com
ZD_EMAIL=you@example.com  # the Zendesk admin who made the API token
read -rsp 'Zendesk API token: ' ZD_TOKEN; echo
api() { curl -gfsS -u "$ZD_EMAIL/token:$ZD_TOKEN" "https://$ZD.zendesk.com/api/v2/$1"; }
page='tickets.json?page[size]=50'; n=1
while [ -n "$page" ]; do
  api "$page" > page.json
  jq -c '.tickets[]' page.json | while read -r t; do
    api "tickets/$(jq -r .id <<<"$t")/comments.json" | jq -c --argjson t "$t" '{ticket: ($t + {comments: .comments})}'
  done > tickets.ndjson
  ids=$(jq -r '.ticket | .requester_id, .comments[].author_id' tickets.ndjson | sort -u | paste -sd, -)
  { api "users/show_many.json?ids=$ids" | jq -c '.users[] | {user: .}'; cat tickets.ndjson; } > "zendesk-move-in-$n.ndjson"
  page=$(jq -r 'if .meta.has_more then .links.next | sub("^.*/api/v2/"; "") else "" end' page.json); n=$((n+1))
done
rm page.json tickets.ndjson; ls zendesk-move-in-*.ndjson`;

export const helpScoutScript = `HS_APP_ID=your-app-id       # Help Scout: Your Profile > My Apps > Create My App
MAILBOX=123456              # the number in your mailbox's address in Help Scout
read -rsp 'Help Scout app secret: ' HS_SECRET; echo
TOKEN=$(curl -fsS -X POST https://api.helpscout.net/v2/oauth2/token -d grant_type=client_credentials -d client_id="$HS_APP_ID" -d client_secret="$HS_SECRET" | jq -r .access_token)
api() { curl -fsS -H "Authorization: Bearer $TOKEN" "$1" | jq -c .; }
url="https://api.helpscout.net/v2/conversations?status=all&mailbox=$MAILBOX"; : > ids.txt
while [ -n "$url" ]; do api "$url" > list.json; jq -r '._embedded.conversations[].id' list.json >> ids.txt; url=$(jq -r '._links.next.href // empty' list.json); done
split -l 25 ids.txt batch-; n=1
for batch in batch-*; do
  out="helpscout-move-in-$n.jsonl"; : > "$out"
  for id in $(cat "$batch"); do
    api "https://api.helpscout.net/v2/conversations/$id" | tee -a "$out" | jq -r '.primaryCustomer.id' >> customers.txt
    page="https://api.helpscout.net/v2/conversations/$id/threads"
    while [ -n "$page" ]; do api "$page" | tee -a "$out" > threads.json; page=$(jq -r '._links.next.href // empty' threads.json); done
  done
  for c in $(sort -u customers.txt); do api "https://api.helpscout.net/v2/customers/$c" >> "$out"; done
  rm customers.txt; n=$((n+1))
done
rm ids.txt list.json threads.json batch-*; ls helpscout-move-in-*.jsonl`;

export const intercomContactsScript = `read -rsp 'Intercom access token: ' IC_TOKEN; echo
jq -r '.. | objects | select(.type? == "contact") | .id' intercom-export/*.json* | sort -u | while read -r id; do
  curl -fsS -H "Authorization: Bearer $IC_TOKEN" -H 'Intercom-Version: 2.16' "https://api.intercom.io/contacts/$id"; echo
done | jq -sc '{contacts: .}' > intercom-contacts.json
zip -j intercom-move-in.zip intercom-export/*.json* intercom-contacts.json`;
