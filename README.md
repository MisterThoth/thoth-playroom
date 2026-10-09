# Thoth Playroom

Et SMITE-inspirert 3D-spill i nettleseren, med Thoth, Ra, Bastet, Hecate, Skadi, Ullr og Bacchus.

**Spill her:** https://misterthoth.github.io/thoth-playroom/

## Spill med venner (gratis)

1. Åpne spillet i Chrome eller Edge og trykk **Online med venner**.
2. Skriv et kallenavn og trykk **Lag rom**. Send invitasjonslenken til vennene dine.
3. Hver spiller velger **Blått lag** eller **Rødt lag** og en gud, og trykker **Klar**.
4. Verten trykker **Start**. Tomme plasser fylles med bots, så det alltid blir 5 mot 5.

Samme lag = dere spiller sammen. Hvert sitt lag = dere spiller mot hverandre.

Spillerne kobles direkte sammen (WebRTC). Det trengs ingen konto og ingen server.
Finner dere ikke hverandre, sjekk at alle har samme romkode. Noen jobb- og skolenettverk blokkerer
direkte tilkoblinger, og da kan det hjelpe å bruke mobilnett eller et annet nettverk.

## Teknisk

Én `index.html` (three.js r170 og Trystero ligger i `vendor/`) og `assets/` med 3D-modeller, lyd og stemmer.
Kjøres lokalt med `python3 -m http.server 8000` og http://localhost:8000.
