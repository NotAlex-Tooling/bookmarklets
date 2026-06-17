<div align="center">

<img src="logo.png" alt="OSINT Bookmarklets" width="128" />

# OSINT Bookmarklets

> Browser bookmarklets that turn social-media pages into one-window OSINT toolkits.

</div>

---

## What it is

Each bookmarklet drops a small draggable window onto the page you're viewing and pulls out
every useful OSINT signal it can find — IDs, profile pictures, banners, exact timestamps,
post grids, collaborators, and cross-platform pivots — straight from the page source, DOM,
and platform APIs.

Browse and install them all at **[bookmarklets.notalex.sh](https://bookmarklets.notalex.sh)**.

---

## Install

1. Open **[bookmarklets.notalex.sh](https://bookmarklets.notalex.sh)**.
2. Show your bookmarks bar (`⌘⇧B` / `Ctrl+Shift+B`).
3. Drag a card's named button (e.g. **Instagram Profile OSINT**) onto the bar.
4. Open a target page and click the bookmark.

If a bookmarklet ever returns outdated results, drag it again from the site to get the latest version.

---

## The bookmarklets

| Tool | What it does | Login needed? |
|---|---|---|
| **Instagram Profile OSINT** | IDs, location, HD profile picture, post-grid timestamps, collab links, anonymous story reels, and cross-platform pivots. | Logged in for HD pic, posts, collabs, and stories. The About tab works logged-out on public profiles. |
| **Facebook Profile OSINT** | IDs, unmasked profile photo, full-res cover banner, name search, and cross-platform pivots. | Logged in — Facebook only embeds this for authenticated viewers. |
| **Facebook Comments OSINT** | Unfolds every hidden, collapsed, and "See more" comment or reply, recursively and in any language. | Logged in. |
| **X Profile OSINT** | Banner-derived user ID, upload time of the profile picture, max-res banner and avatar, and pivot links. | Logged in on most profiles. |
| **YouTube Channel OSINT** | IDs, max-res banner and avatar, exact upload times, plus Filmot, Geofind, and Socialblade deep links. | None. |
| **Meta Blur** | Blurs your own profile photo, name, and identity-exposing UI on Facebook or Instagram so you can capture clean evidence. | Logged in. |
| **ID & Timestamp Decoder** | Universal Snowflake decoder — X, Discord, Instagram, and TikTok IDs → exact creation time. Auto-fills from the current page. | None. |
| **Domain & Infra Recon** | DNS-over-HTTPS records, crt.sh subdomains, TLD spray, and RDAP / WHOIS / Shodan / urlscan / VirusTotal / Wayback pivots. | None. |
| **Google Maps OSINT** | A review's exact create time and whether it was edited, full-resolution contributor photos, and a pivot from a contributor ID to all their reviews and photos. | None. |
| **Telegram Profile OSINT** | Username, display name, bio, account type, member count, and photo, plus Lyzem / TGStat / Telemetr pivots. | None. |
| **Snapchat OSINT** | Username, display name, subscribers, snapcode, and bio, historical Bitmoji outfits, and best-effort Spotlight/Story tile IDs. | None. |
| **YouTube Thumbnail Grabber** | Max-res thumbnail with fallback, every JPG and WebP size, and the start/middle/end storyboard frames. | None. |
| **Reddit Profile OSINT** | Exact creation time, full karma breakdown, account flags, avatar, and bio, plus Arctic Shift, RedTrail, and Reveddit pivots. | None. |
| **Page Forensics Console** | Every image, a full meta / OpenGraph / JSON-LD dump, cookies and local/session storage, word frequency, find-on-page highlighting, and one-click Wayback save/lookup. | None. |

**Anonymous by design:** the Instagram stories tab reads the active reel without marking it seen, so the
account owner never sees you in their viewer list.

Each tool also has a `*.bookmarklet.txt` file containing its ready-to-paste `javascript:…` URL.

---

<div align="center">
  <a href="https://github.com/NotAlex-Tooling/">Tooling by NotAlex</a> ·
  <a href="https://github.com/NotAlex-Tooling/bookmarklets">source code</a> ·
  by <a href="https://notalex.sh">notalex.sh</a>
</div>
