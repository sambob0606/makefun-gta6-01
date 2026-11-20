# Vireo City — an open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/competitions/gta6-01)
[![rank](https://make.fun/badge/gta6-01/sambob0606/makefun-gta6-01/rank.svg)](https://make.fun/competitions/gta6-01)
[![reward](https://make.fun/badge/gta6-01/sambob0606/makefun-gta6-01/reward.svg)](https://make.fun/competitions/gta6-01)

An entry for [make.fun gta6-01](https://make.fun/competitions/gta6-01): a complete
open-world crime game that plays offline in a desktop browser from static files.
Everything in it is original — the city, the characters, the story, the art and
the sound. No Rockstar Games name, character, map or asset appears anywhere.

## The game

Cass Rook came back to Vireo City for one last job. The city had other plans.

- **A city on foot and by car** — a 3600×2600 grid city with avenues, streets,
  sidewalks, parks, a civic plaza and a beach, all drawn procedurally.
- **Steal cars, drive them** — take a parked car, or pull a driver out of a
  moving one (the police will notice). Arcade handling, traffic that brakes
  for you, and cars that wreck.
- **Traffic and pedestrians** — cars follow the road network and turn at
  intersections; pedestrians walk the sidewalks and flee from gunfire and
  speeding cars.
- **Wanted system and police** — crimes raise your stars; police cars chase,
  ram and try to bust you on foot. Lay low and the heat cools off.
- **Missions and a story** — five jobs from the fixer Dana Voss: a pickup, a
  stolen Vanta GT, a getaway, a fight with the Kingsmen at Civic Plaza, and
  the First Meridian Bank job. Finish them all and the city is yours to roam.
- **Combat** — a pistol with pickups for ammo, health and cash; rivals who
  shoot back.
- **HUD with a minimap** — health, money, ammo, wanted stars, objective text,
  speed, and a live minimap with the mission marker, police and cars.
- **Start and save** — a title screen over the living city, pause, and
  progress saved to localStorage when a mission ends or you pause.
- **Sound** — a WebAudio synth: engine hum, sirens, gunshots and pickups.
  No audio files, no network requests.

## How to play

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk, or drive |
| E | Enter / exit a car |
| Mouse | Aim |
| Click / Space | Shoot (or punch with no ammo) |
| Shift | Sprint on foot |
| P / Esc | Pause (saves progress) |
| Enter | Start / continue / retry |

## Run it

```sh
node serve.ts        # then open http://localhost:8080
```

or open `game/index.html` from any static file server. The hand-in program:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored `vendor/makefun-game.ts` library.

## License

MIT — see [LICENSE](LICENSE).
