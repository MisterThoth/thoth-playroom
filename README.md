# Thoth Playroom

A SMITE-inspired 3D game in the browser, starring Thoth, Ra, Bastet, Hecate, Skadi, Ullr and Bacchus.

**Play here:** https://misterthoth.github.io/thoth-playroom/

## Play with friends (free)

1. Open the game in Chrome or Edge and press **Play online with friends**.
2. Enter a nickname and press **Create room**. Send the invite link to your friends.
3. Each player picks **Blue team** or **Red team** and a god, then presses **Ready**.
4. The host presses **Start**. Empty slots are filled with bots, so it is always 5 vs 5.

Same team = you play together. Different teams = you play against each other.

Players connect directly to each other (WebRTC). When a network blocks direct connections, the game falls back
automatically to free public MQTT relays. No account and no server needed.

## Technical

One `index.html` (three.js r170, Trystero and mqtt.js are in `vendor/`) plus `assets/` with 3D models, sound and voices.
Run locally with `python3 -m http.server 8000` and open http://localhost:8000.
