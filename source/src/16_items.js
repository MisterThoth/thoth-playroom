// ============================================================================
// ITEMS (1/2) · the item database, the stat layer, gold and the item passives.
//
// Stat layer: final stat = god base + per-level growth + items + buffs.
//   - settings.power / settings.cdr are accessors: the stored value is the base (the menu slider, or the
//     Arena's level power 30 + 18 x level), and the getter adds the items. Physical gods read the slider as
//     55 % physical power (ppow), so physical item power is added as phys / 0.55; the kits are untouched.
//   - maxHp / maxMp / moveSpeed / attackSpeed / basicDamage (11_player.js) add Stats.* directly.
//   - Combat.mitigate: protections after penetration (% first, then flat), 100 / (100 + prot).
//   - Combat.deal (wrapped): crit, on-hit and on-ability passives, lifesteal, execute, antiheal.
//   - Arena: PlayerUnit protections, CC reduction, shields and cheat-death; bots carry their own items
//     (BotGod.istats) that feed hp, protections, power, attack speed, move speed, cdr, crit, pen, lifesteal.
// Ullr «Bowelius» always does exactly 1 damage: his damage stats count for nothing (the store says so).
// ============================================================================
const STAT_KEYS = ['phys', 'mag', 'as', 'crit', 'critDmg', 'ls', 'pen', 'penP', 'pprot', 'mprot', 'hp', 'mana', 'hp5', 'mp5', 'cdr', 'ms', 'ccr', 'heal'];
const STAT_NAMES = {
  phys: 'Physical Power', mag: 'Magical Power', as: 'Attack Speed', crit: 'Critical Strike Chance', critDmg: 'Critical Damage', ls: 'Lifesteal',
  pen: 'Penetration', penP: 'Percent Penetration', pprot: 'Physical Protection', mprot: 'Magical Protection', hp: 'Health', mana: 'Mana',
  hp5: 'Health per 5 s', mp5: 'Mana per 5 s', cdr: 'Cooldown Reduction', ms: 'Movement Speed', ccr: 'CC Reduction', heal: 'Healing Received',
};
const STAT_PCT = new Set(['as', 'crit', 'critDmg', 'ls', 'penP', 'cdr', 'ms', 'ccr', 'heal']);
const DMG_STATS = new Set(['phys', 'mag', 'crit', 'critDmg', 'pen', 'penP', 'ls']);   // (worth nothing to Ullr)
const STAT_CAP = { crit: 1, cdr: 0.4, ccr: 0.4, penP: 0.4, ls: 0.65, ms: 0.5, as: 1.5 };
const fmtStat = (k, v) => (STAT_PCT.has(k) ? `+${Math.round(v * 100)}%` : `+${Math.round(v)}`);
const fmtGold = (n) => Math.round(n).toLocaleString('en-US');
const CAT_NAMES = { start: 'Starter Items', phys: 'Physical', mag: 'Magical', def: 'Defense', sup: 'Support/Hybrid', cons: 'Consumables', relic: 'Relics' };
const CAT_ORDER = ['start', 'phys', 'mag', 'def', 'sup', 'cons', 'relic'];
// keys: P opens the store, 6/7 drink the consumables, Z fires the relic (Q/E/R/F/G/B/V and 1-5 belong to the god)
const ITEM_KEYS = { store: 'KeyP', cons: ['Digit6', 'Digit7'], relic: 'KeyZ' };
for (const k of [ITEM_KEYS.store, ...ITEM_KEYS.cons, ITEM_KEYS.relic]) GAME_KEYS.add(k);
const ECON = { start: 1500, perSec: 6, godKill: 300, assist: 75, minion: 20, camp: 35, siege: 150, sellBack: 0.5, trainGold: 99999 };

// ---------------------------------------------------------------------------
// The items. cost = total price; from = components (a T2/T3 consumes them when bought)
// sym / ink pick the procedural icon (16b_store_ui.js); en = the English name it is known by
// ---------------------------------------------------------------------------
const ITEMS = [];
const ITEM = {};
const defItem = (id, name, cat, tier, cost, stats, o = {}) => { const it = { id, name, cat, tier, cost, stats, from: o.from || [], sym: o.sym || 'gem', ink: o.ink, bg: o.bg, pname: o.pname || '', passive: o.passive || '', en: o.en || '', use: o.use, stack: o.stack || 1, cd: o.cd || 0 }; ITEMS.push(it); ITEM[id] = it; return it; };

// ---- Startitems (one at a time)
defItem('s_mage', 'Scribe’s Inkwell', 'start', 0, 750, { mag: 20, mana: 100, mp5: 5 }, { sym: 'inkwell', ink: 'azure', pname: 'Ink and Wisdom', passive: 'Ability hits on a god restore 10 mana (once per cast). Minions you kill give +3 bonus gold.' });
defItem('s_hunter', 'Hunting Falcon’s Feather', 'start', 0, 750, { phys: 8, as: 0.1 }, { sym: 'plume', ink: 'bronze', pname: 'Falcon Eye', passive: 'Every 4th basic attack deals +25 damage. +15% damage to minions, jungle monsters and training targets.' });
defItem('s_assassin', 'Night Hunter’s Dagger', 'start', 0, 800, { phys: 12, ms: 0.05 }, { sym: 'dagger', ink: 'silver', pname: 'Ambush', passive: '+8% damage to targets below 50% health.' });
defItem('s_guardian', 'Seal of the Sphinx', 'start', 0, 750, { hp: 150, pprot: 10, mprot: 10 }, { sym: 'sphinx', ink: 'gold', pname: 'Guardian’s Gift', passive: 'Aura: allies within 9 m gain +5 physical and magical protection. +1 bonus gold/s while an allied god is within 12 m.' });
defItem('s_warrior', 'Spartan’s Armlet', 'start', 0, 750, { phys: 8, mag: 12, hp: 100, pprot: 10 }, { sym: 'armlet', ink: 'bronze', pname: 'Fighting Spirit', passive: 'Ability hits heal you for 1.5% of max health (once per cast).' });

// ---- Tier 1 components
defItem('bronze_sickle', 'Bronze Sickle', 'phys', 1, 700, { phys: 15 }, { sym: 'sickle', ink: 'bronze' });
defItem('jackal_fang', 'Jackal Fang', 'phys', 1, 650, { as: 0.12 }, { sym: 'fang', ink: 'bone' });
defItem('copper_arrow', 'Copper Arrowhead', 'phys', 1, 750, { phys: 8, pen: 6 }, { sym: 'arrow', ink: 'bronze' });
defItem('blood_amber', 'Blood Amber', 'phys', 1, 700, { phys: 6, ls: 0.08 }, { sym: 'gem', ink: 'ruby' });
defItem('papyrus_scroll', 'Papyrus Scroll', 'mag', 1, 700, { mag: 25 }, { sym: 'scroll', ink: 'bone' });
defItem('lotus_charm', 'Lotus Charm', 'mag', 1, 650, { mana: 150, mp5: 6 }, { sym: 'lotus', ink: 'azure' });
defItem('set_shard', 'Shard of Set', 'mag', 1, 800, { mag: 15, pen: 5 }, { sym: 'shard', ink: 'ruby' });
defItem('khonsu_glass', 'Khonsu’s Hourglass', 'mag', 1, 700, { cdr: 0.05, mana: 100 }, { sym: 'hourglass', ink: 'silver' });
defItem('scarab_shell', 'Scarab Shell', 'def', 1, 650, { pprot: 15 }, { sym: 'scarab', ink: 'teal' });
defItem('linen_wraps', 'Mummy Linen', 'def', 1, 650, { mprot: 15 }, { sym: 'wraps', ink: 'bone' });
defItem('nile_pearl', 'Nile Pearl', 'def', 1, 700, { hp: 150, hp5: 6 }, { sym: 'pearl', ink: 'silver' });
defItem('reed_sandals', 'Reed Sandals', 'sup', 1, 600, { ms: 0.07 }, { sym: 'sandal', ink: 'bronze' });
defItem('crystal_eye', 'Crystal Eye', 'sup', 1, 750, { ccr: 0.08, hp: 100 }, { sym: 'eye', ink: 'ice' });

// ---- Tier 2
defItem('tempered_khopesh', 'Tempered Khopesh', 'phys', 2, 1500, { phys: 25, crit: 0.1 }, { from: ['bronze_sickle', 'jackal_fang'], sym: 'khopesh', ink: 'silver' });
defItem('fenris_claw', 'Fenris Claw', 'phys', 2, 1550, { phys: 20, as: 0.18 }, { from: ['bronze_sickle', 'jackal_fang'], sym: 'claw', ink: 'silver' });
defItem('shieldbreaker', 'Shieldbreaker', 'phys', 2, 1600, { phys: 18, pen: 10 }, { from: ['copper_arrow', 'bronze_sickle'], sym: 'axe', ink: 'silver' });
defItem('sekhmet_tooth', 'Fang of Sekhmet', 'phys', 2, 1450, { phys: 15, ls: 0.12 }, { from: ['blood_amber'], sym: 'tooth', ink: 'ruby' });
defItem('scribe_quill', 'Scribe’s Quill', 'mag', 2, 1500, { mag: 45, mana: 150 }, { from: ['papyrus_scroll', 'lotus_charm'], sym: 'quill', ink: 'azure' });
defItem('moon_disc', 'Moon Disc of Khonsu', 'mag', 2, 1600, { mag: 35, cdr: 0.1 }, { from: ['papyrus_scroll', 'khonsu_glass'], sym: 'moon', ink: 'silver' });
defItem('night_wick', 'Wick of Night', 'mag', 2, 1650, { mag: 35, pen: 8 }, { from: ['set_shard', 'papyrus_scroll'], sym: 'candle', ink: 'violet' });
defItem('lotus_staff', 'Lotus Staff', 'mag', 2, 1400, { mag: 30, mana: 200, mp5: 10 }, { from: ['lotus_charm'], sym: 'staff', ink: 'azure' });
defItem('bronze_hoplon', 'Bronze Hoplon', 'def', 2, 1500, { pprot: 30, hp: 150 }, { from: ['scarab_shell', 'nile_pearl'], sym: 'shield', ink: 'bronze' });
defItem('royal_wraps', 'Royal Mummy Wraps', 'def', 2, 1500, { mprot: 30, hp: 150 }, { from: ['linen_wraps', 'nile_pearl'], sym: 'wraps', ink: 'gold' });
defItem('ymir_cloak', 'Cloak of Ymir', 'def', 2, 1700, { pprot: 20, mprot: 20 }, { from: ['scarab_shell', 'linen_wraps'], sym: 'cloak', ink: 'ice' });
defItem('water_of_life', 'Water of Life', 'def', 2, 1450, { hp: 300, hp5: 12 }, { from: ['nile_pearl'], sym: 'vial', ink: 'teal' });
defItem('winged_sandals', 'Winged Sandals', 'sup', 2, 1400, { ms: 0.12, as: 0.08 }, { from: ['reed_sandals', 'jackal_fang'], sym: 'wingsandal', ink: 'gold' });
defItem('bastet_collar', 'Collar of Bastet', 'sup', 2, 1500, { ccr: 0.15, hp: 200 }, { from: ['crystal_eye'], sym: 'collar', ink: 'gold' });
defItem('janus_coin', 'Janus Coin', 'sup', 2, 1600, { phys: 12, mag: 20, cdr: 0.05 }, { from: ['bronze_sickle', 'papyrus_scroll'], sym: 'coin', ink: 'gold' });

// ---- Tier 3: physical
defItem('sekhmet_khopesh', 'Khopesh of Sekhmet', 'phys', 3, 2900, { phys: 40, crit: 0.25, critDmg: 0.25 }, { from: ['tempered_khopesh', 'jackal_fang'], sym: 'khopesh', ink: 'gold', pname: 'Lioness’s Fury', passive: 'Critical hits grant +20% attack speed for 3 s.' });
defItem('mjolnir_echo', 'Mjölnir’s Echo', 'phys', 3, 2800, { phys: 30, as: 0.25 }, { from: ['fenris_claw', 'copper_arrow'], sym: 'hammer', ink: 'ice', pname: 'Thunderstrike', passive: 'Every 3rd basic attack calls down a lightning bolt: 50 + 40% of item power as damage within 2.5 m of the target.' });
defItem('anubis_sickle', 'Anubis’ Soul Sickle', 'phys', 3, 2700, { phys: 35, as: 0.15 }, { from: ['fenris_claw', 'bronze_sickle'], sym: 'sickle', ink: 'gold', pname: 'Soul Harvest', passive: 'Basic attacks also deal 5% of the target’s missing health (max 120 per hit).' });
defItem('gungnir_point', 'Gungnir’s Point', 'phys', 3, 2800, { phys: 35, penP: 0.25 }, { from: ['shieldbreaker', 'copper_arrow'], sym: 'spear', ink: 'gold', pname: 'Allfather’s Aim', passive: '+10% damage to targets with more than 1500 max health.' });
defItem('bloodmoon_fang', 'Bloodmoon Fang', 'phys', 3, 2600, { phys: 30, ls: 0.2 }, { from: ['sekhmet_tooth', 'bronze_sickle'], sym: 'tooth', ink: 'gold', pname: 'Bloodthirst', passive: 'Below 40% health, your lifesteal is doubled.' });
defItem('brynhild_axe', 'Brynhild’s Vengeance', 'phys', 3, 2700, { phys: 35, pen: 12, cdr: 0.1 }, { from: ['shieldbreaker', 'khonsu_glass'], sym: 'axe', ink: 'gold', pname: 'Valkyrie’s Judgement', passive: 'After you use an ability, your next basic attack (within 4 s) deals +40% damage and slows the target 20% for 1.5 s.' });
defItem('ares_warhammer', 'Ares’ Warhammer', 'phys', 3, 2600, { phys: 30, hp: 200, pprot: 20 }, { from: ['bronze_hoplon', 'bronze_sickle'], sym: 'warhammer', ink: 'ruby', pname: 'God of War', passive: 'Ability hits grant 5% damage reduction for 4 s (stacks 3 times).' });
defItem('ra_sun_disc', 'Sun Disc of Ra', 'phys', 3, 2700, { phys: 25, as: 0.2, hp: 150 }, { from: ['fenris_claw', 'nile_pearl'], sym: 'sun', ink: 'ember', pname: 'Sunfire', passive: 'Basic attacks set the target on fire: 12 + 15% of item power as damage per second for 3 s (refreshes, does not stack).' });
defItem('artemis_bow', 'Artemis’ Silver Bow', 'phys', 3, 2800, { phys: 30, crit: 0.2, ms: 0.07 }, { from: ['tempered_khopesh', 'reed_sandals'], sym: 'bow', ink: 'silver', pname: 'Moon Hunt', passive: 'Critical hits grant +12% movement speed for 2 s.' });
// ---- Tier 3: magical
defItem('thoth_book', 'Book of Thoth’s Echoes', 'mag', 3, 3000, { mag: 80, mana: 200 }, { from: ['scribe_quill', 'lotus_charm'], sym: 'book', ink: 'azure', pname: 'Echo of Knowledge', passive: 'Each kill grants 1 stack (a god grants 5). Each stack gives +1 magical power (max 75). At 75 stacks: +40 additional magical power. Stacks are lost if you sell the book.' });
defItem('hel_lantern', 'Hel’s Lantern', 'mag', 3, 2700, { mag: 60, pen: 10 }, { from: ['night_wick', 'linen_wraps'], sym: 'lantern', ink: 'teal', pname: 'Flame of the Underworld', passive: 'Ability hits apply antiheal (40% less healing) for 4 s and burn the target for 10 + 5% of item power as damage per second for 3 s.' });
defItem('khonsu_crown', 'Moon Crown of Khonsu', 'mag', 3, 2800, { mag: 70, cdr: 0.15 }, { from: ['moon_disc', 'khonsu_glass'], sym: 'mooncrown', ink: 'silver', pname: 'Moon Phase', passive: 'When an ability hits, the cooldowns of your other abilities are reduced by 0.5 s (once per cast).' });
defItem('circe_staff', 'Circe’s Staff of Transformation', 'mag', 3, 2900, { mag: 65, penP: 0.3 }, { from: ['night_wick', 'set_shard'], sym: 'staff', ink: 'violet', pname: 'Spellbreak', passive: '+10% damage to targets with more than 60% health.' });
defItem('apep_fang', 'Fang of Apep', 'mag', 3, 2600, { mag: 60, ls: 0.15, mprot: 15 }, { from: ['lotus_staff', 'blood_amber'], sym: 'serpent', ink: 'violet', pname: 'The Devourer', passive: 'Your lifesteal works fully on abilities (otherwise only a third).' });
defItem('seshat_brush', 'Brush of Seshat', 'mag', 3, 2700, { mag: 70, mana: 200, cdr: 0.05 }, { from: ['scribe_quill', 'khonsu_glass'], sym: 'brush', ink: 'gold', pname: 'Afterword', passive: 'After you use an ability, your next basic attack (within 3 s) deals 40 + 50% of item power as bonus damage.' });
defItem('persephone_pomegranate', 'Pomegranate of Persephone', 'mag', 3, 2500, { mag: 55, hp: 200, mp5: 10 }, { from: ['lotus_staff', 'nile_pearl'], sym: 'pomegranate', ink: 'ruby', pname: 'Return of Spring', passive: 'A kill or assist on a god heals you for 20% of max health. Other kills heal 2%.' });
defItem('atum_crown', 'Sun Crown of Atum', 'mag', 3, 3200, { mag: 110 }, { from: ['scribe_quill', 'papyrus_scroll'], sym: 'crown', ink: 'gold', pname: 'Power of Creation', passive: 'All magical power from items is increased by 20%.' });
// ---- Tier 3: defence
defItem('maat_feather', 'Feather of Ma’at', 'def', 3, 2600, { pprot: 35, mprot: 35, hp: 150, heal: 0.2 }, { from: ['ymir_cloak', 'nile_pearl'], sym: 'feather', ink: 'gold', pname: 'Weight of Justice', passive: '+20% healing received. Aura: you and allies within 9 m gain +10 physical and magical protection.' });
defItem('scarab_amulet', 'Scarab Amulet', 'def', 3, 2500, { hp: 300, mprot: 30 }, { from: ['royal_wraps', 'scarab_shell'], sym: 'scarab', ink: 'gold', pname: 'Rebirth of Khepri', passive: 'If you fall below 30% health, you gain a shield of 200 + 15% of max health for 4 s. 60 s cooldown.' });
defItem('aegis_fragment', 'Aegis Fragment', 'def', 3, 2700, { pprot: 50, hp: 200 }, { from: ['bronze_hoplon', 'scarab_shell'], sym: 'aegis', ink: 'silver', pname: 'Gorgon’s Gaze', passive: 'The first hit from a god every 8 seconds deals 50% less damage.' });
defItem('osiris_ankh', 'Ankh of Rebirth', 'def', 3, 3000, { hp: 350, pprot: 25, mprot: 25 }, { from: ['water_of_life', 'scarab_shell', 'linen_wraps'], sym: 'ankh', ink: 'gold', pname: 'Rebirth', passive: 'Lethal damage leaves you at 1 health, grants 1.5 s of immortality and heals 35% of max health over 3 s. 150 s cooldown.' });
defItem('sobek_scales', 'Scales of Sobek', 'def', 3, 2500, { pprot: 55, hp: 150 }, { from: ['bronze_hoplon', 'nile_pearl'], sym: 'scales', ink: 'teal', pname: 'Crocodile Hide', passive: '20% of the damage you take from basic attacks is reflected back at the attacker.' });
defItem('nephthys_veil', 'Veil of Nephthys', 'def', 3, 2600, { mprot: 55, hp: 150, ccr: 0.1 }, { from: ['royal_wraps', 'crystal_eye'], sym: 'veil', ink: 'violet', pname: 'Twilight Veil', passive: 'When you are stunned or rooted, you gain 20% damage reduction for 3 s.' });
defItem('ymir_frostmail', 'Frostmail of Ymir', 'def', 3, 2700, { pprot: 40, mprot: 20, hp: 150 }, { from: ['ymir_cloak', 'scarab_shell'], sym: 'snow', ink: 'ice', pname: 'Eternal Winter', passive: 'Aura: enemies within 6 m are slowed 15%.' });
defItem('yggdrasil_bark', 'Bark of Yggdrasil', 'def', 3, 2400, { hp: 400, hp5: 25, pprot: 20 }, { from: ['water_of_life', 'scarab_shell'], sym: 'tree', ink: 'jade', pname: 'Sap of the World Tree', passive: 'After 3 s out of combat, you regenerate 2% of max health per second.' });
// ---- Tier 3: support / hybrid
defItem('horus_wings', 'Wings of Horus', 'sup', 3, 2400, { ms: 0.18, hp: 150, cdr: 0.05 }, { from: ['winged_sandals', 'nile_pearl'], sym: 'wings', ink: 'gold', pname: 'Sky Flight', passive: 'After 4 s without dealing or taking damage, you gain +15% extra movement speed.' });
defItem('thyrsus', 'Thyrsus of Dionysus', 'sup', 3, 2600, { phys: 20, mag: 45, as: 0.2 }, { from: ['janus_coin', 'jackal_fang'], sym: 'thyrsus', ink: 'jade', pname: 'Bacchic Frenzy', passive: 'Each ability you use grants +10% attack speed for 4 s (stacks 3 times).' });
defItem('athena_mantle', 'Mantle of Athena', 'sup', 3, 2500, { pprot: 30, mprot: 30, hp: 150, cdr: 0.1 }, { from: ['ymir_cloak', 'khonsu_glass'], sym: 'helmet', ink: 'silver', pname: 'Strategist’s Protection', passive: 'Aura: you and allied gods within 9 m deal 8% more damage.' });
defItem('isis_wings', 'Wings of Isis', 'sup', 3, 2500, { hp: 250, mana: 200, mp5: 15, cdr: 0.1 }, { from: ['water_of_life', 'lotus_charm'], sym: 'isiswings', ink: 'azure', pname: 'Maternal Protection', passive: 'Aura: you and allies within 9 m who are below 50% health regenerate 1% of max health per second.' });
defItem('hermes_caduceus', 'Caduceus of Hermes', 'sup', 3, 2400, { ms: 0.1, as: 0.2, cdr: 0.1 }, { from: ['winged_sandals', 'khonsu_glass'], sym: 'caduceus', ink: 'gold', pname: 'Messenger’s Haste', passive: 'Aura: you and allies within 9 m gain +10% attack speed and +5% movement speed.' });
defItem('janus_blade', 'Janus’ Double-Edged Blade', 'sup', 3, 2800, { phys: 25, mag: 45, cdr: 0.1, pen: 5 }, { from: ['janus_coin', 'copper_arrow'], sym: 'twoblade', ink: 'gold', pname: 'Two Faces', passive: 'A basic attack after an ability deals +15% damage; an ability after a basic attack deals +10% damage.' });
defItem('tyr_oath', 'Oath of Tyr', 'sup', 3, 2600, { phys: 20, mag: 35, hp: 250, pprot: 20 }, { from: ['janus_coin', 'nile_pearl'], sym: 'hand', ink: 'bronze', pname: 'Courage of the One-Handed', passive: 'Below 50% health, you deal 15% more damage.' });
defItem('bragi_harp', 'Harp of Bragi', 'sup', 3, 2400, { mag: 40, mana: 250, cdr: 0.15 }, { from: ['lotus_staff', 'khonsu_glass'], sym: 'harp', ink: 'gold', pname: 'Skald’s Song', passive: 'Each ability you use heals you and allies within 9 m for 25 + 8% of item power (4 s internal cooldown).' });

// ---- Consumables (2 slots, stack)
defItem('c_heal', 'Healing Elixir', 'cons', 0, 50, {}, { sym: 'flask', ink: 'ruby', stack: 5, pname: 'Drink', passive: 'Heals 300 health over 10 s.', use: 'heal' });
defItem('c_mana', 'Mana Potion', 'cons', 0, 50, {}, { sym: 'flask', ink: 'azure', stack: 5, pname: 'Drink', passive: 'Restores 220 mana over 10 s.', use: 'mana' });
defItem('c_ward', 'Elixir of the Eye of Horus', 'cons', 0, 150, {}, { sym: 'eyeflask', ink: 'gold', stack: 3, pname: 'Guardian’s Blessing', passive: '+10 physical and magical protection and +5% movement speed for 90 s.', use: 'ward' });
defItem('c_isis', 'Blessing of Isis', 'cons', 0, 120, {}, { sym: 'isisflask', ink: 'teal', stack: 5, pname: 'Drink', passive: 'Heals 350 health and restores 250 mana over 12 s.', use: 'isis' });
defItem('c_power', 'Sekhmet’s Elixir of Might', 'cons', 0, 900, {}, { sym: 'flask', ink: 'ember', stack: 1, pname: 'Lioness’s Power', passive: '+15 physical / +35 magical power and +5% attack speed for 180 s.', use: 'power' });
// ---- Relics (free, one at a time, on Z)
defItem('r_bead', 'Bead of Ma’at’s Purification', 'relic', 0, 0, {}, { sym: 'bead', ink: 'ice', cd: 120, pname: 'Cleanse', passive: 'Removes all CC (stun, root, slow) and grants 1.5 s of CC immunity.', use: 'bead' });
defItem('r_sprint', 'Jackal’s Sprint', 'relic', 0, 0, {}, { sym: 'paw', ink: 'gold', cd: 90, pname: 'Sprint', passive: '+40% movement speed for 4 s.', use: 'sprint' });
defItem('r_aegis', 'Relic of Athena’s Shield', 'relic', 0, 0, {}, { sym: 'aegis', ink: 'gold', cd: 100, pname: 'Shield', passive: 'A shield of 25% of max health for 3 s.', use: 'shield' });
defItem('r_blink', 'Anubis’ Shadow Step', 'relic', 0, 0, {}, { sym: 'blink', ink: 'violet', cd: 120, pname: 'Blink', passive: 'Teleports you 9 m forward (in the aiming direction).', use: 'blink' });
defItem('r_frost', 'Ymir’s Icy Breath', 'relic', 0, 0, {}, { sym: 'frost', ink: 'ice', cd: 90, pname: 'Icy Breath', passive: 'Enemies within 8 m are slowed 40% for 3 s and take 50 damage.', use: 'frost' });

// what each component builds into (for the store's "Bygger til")
const BUILDS_INTO = {};
for (const it of ITEMS) for (const c of it.from) (BUILDS_INTO[c] = BUILDS_INTO[c] || []).includes(it.id) || BUILDS_INTO[c].push(it.id);

// the bots' builds: a starter and six tier-3 items, by god (Ullr builds tanky: his arrows do 1 anyway)
const BOT_BUILDS = {
  thoth: ['s_mage', 'thoth_book', 'khonsu_crown', 'circe_staff', 'hel_lantern', 'atum_crown', 'nephthys_veil'],
  hecate: ['s_mage', 'hel_lantern', 'thoth_book', 'circe_staff', 'khonsu_crown', 'atum_crown', 'osiris_ankh'],
  ra: ['s_mage', 'seshat_brush', 'thoth_book', 'khonsu_crown', 'circe_staff', 'persephone_pomegranate', 'scarab_amulet'],
  skadi: ['s_hunter', 'mjolnir_echo', 'sekhmet_khopesh', 'gungnir_point', 'bloodmoon_fang', 'artemis_bow', 'scarab_amulet'],
  bastet: ['s_assassin', 'brynhild_axe', 'anubis_sickle', 'gungnir_point', 'bloodmoon_fang', 'sekhmet_khopesh', 'aegis_fragment'],
  bacchus: ['s_guardian', 'maat_feather', 'athena_mantle', 'sobek_scales', 'nephthys_veil', 'ymir_frostmail', 'osiris_ankh'],
  ullr: ['s_hunter', 'hermes_caduceus', 'horus_wings', 'sobek_scales', 'nephthys_veil', 'osiris_ankh', 'yggdrasil_bark'],
  Mage: ['s_mage', 'thoth_book', 'khonsu_crown', 'circe_staff', 'hel_lantern', 'atum_crown', 'nephthys_veil'],
  Hunter: ['s_hunter', 'mjolnir_echo', 'sekhmet_khopesh', 'gungnir_point', 'bloodmoon_fang', 'artemis_bow', 'scarab_amulet'],
  Assassin: ['s_assassin', 'brynhild_axe', 'anubis_sickle', 'gungnir_point', 'bloodmoon_fang', 'sekhmet_khopesh', 'aegis_fragment'],
  Guardian: ['s_guardian', 'maat_feather', 'athena_mantle', 'sobek_scales', 'nephthys_veil', 'ymir_frostmail', 'osiris_ankh'],
  Warrior: ['s_warrior', 'ares_warhammer', 'tyr_oath', 'janus_blade', 'aegis_fragment', 'nephthys_veil', 'bloodmoon_fang'],
};
const AURA_ITEMS = { maat_feather: 'maat', athena_mantle: 'athena', isis_wings: 'isis', hermes_caduceus: 'hermes', s_guardian: 'guardian' };

// ---------------------------------------------------------------------------
// Stat sums
// ---------------------------------------------------------------------------
const zeroStats = () => { const s = {}; for (const k of STAT_KEYS) s[k] = 0; return s; };
function addStats(s, add, k = 1) { for (const key in add) s[key] = (s[key] || 0) + add[key] * k; return s; }
function capStats(s) { for (const k in STAT_CAP) s[k] = Math.min(STAT_CAP[k], s[k]); return s; }
// the items' plain sum (bots use exactly this; the player adds passives, auras and buffs on top)
function sumItemStats(inv) {
  const s = zeroStats();
  for (const id of inv) if (id && ITEM[id]) addStats(s, ITEM[id].stats);
  if (inv.includes('atum_crown')) s.mag *= 1.2;
  return capStats(s);
}

const Stats = {
  cur: zeroStats(),
  basePower: typeof settings.power === 'number' ? settings.power : 600,
  baseCdr: typeof settings.cdr === 'number' ? settings.cdr : 0.2,
  get(k) { return this.cur[k] || 0; },
  flat(k) { return this.cur[k] || 0; },
  ullr() { return !!(Kit && Kit.id === 'ullr'); },
  physical() { return !!(Kit && Kit.physical); },
  // the item power of the god's own kind (phys for physical gods, mag for mages); 0 for Ullr
  itemPow() { if (this.ullr()) return 0; return this.physical() ? this.cur.phys : this.cur.mag; },
  // what the items add to settings.power (physical gods read power x 0.55 as physical power)
  powerTerm() { if (!Kit || this.ullr()) return 0; return this.physical() ? this.cur.phys / 0.55 : this.cur.mag; },
  // basic attacks: physical gods scale 100 % with physical power, mages with their kit's basicScale of magical power
  basicBonus() { if (!Kit || this.ullr()) return 0; return this.physical() ? this.cur.phys : (kitStats().basicScale || 0.2) * this.cur.mag; },
  asMul() { return 1 + Math.min(STAT_CAP.as, this.cur.as); },
  msMul() { return 1 + Math.min(STAT_CAP.ms, this.cur.ms); },
};
// settings.power and settings.cdr: stored base + items (saved without the items)
(function installSettingsAccessors() {
  Object.defineProperty(settings, 'power', { configurable: true, enumerable: true, get() { return Stats.basePower + Stats.powerTerm(); }, set(v) { Stats.basePower = Number(v) || 0; } });
  Object.defineProperty(settings, 'cdr', { configurable: true, enumerable: true, get() { return Math.min(0.4, Stats.baseCdr + Stats.cur.cdr); }, set(v) { Stats.baseCdr = Number(v) || 0; } });
  Object.defineProperty(settings, 'toJSON', { configurable: true, enumerable: false, value() { const o = {}; for (const k of Object.keys(this)) o[k] = this[k]; o.power = Stats.basePower; o.cdr = Stats.baseCdr; return o; } });
})();

// ---------------------------------------------------------------------------
// The player's items, gold, passives, consumables and relic
// ---------------------------------------------------------------------------
const Items = {
  gold: ECON.trainGold, infinite: true, slots: [null, null, null, null, null, null], cons: [null, null], relic: null, relicCd: 0,
  st: {}, cds: {}, buffs: [], hots: [], recv: {}, combatT: 99, ccImmuneT: 0, immuneT: 0, antihealT: 0, shieldHp: 0, shieldT: 0,
  castSeq: 0, procLock: 0, incomeAcc: 0, auraT: 0, botT: 0, saved: null, oocFlag: false, lastCast: '', dirty: true,

  // ---------------------------------------------------------------- queries
  owned() { return this.slots.filter(Boolean); },
  has(id) { return this.slots.includes(id); },
  inArena() { return typeof Arena !== 'undefined' && Arena.active; },
  // Arena: only at the fountain (or while dead); the playroom: anywhere
  canShop() {
    if (!this.inArena()) return true;
    if (P.dead) return true;
    const f = ArenaMap.fountains[Arena.myTeam]; if (!f) return true;
    return Math.hypot(P.pos.x - f.pos.x, P.pos.z - f.pos.z) < AM.fountR + 3;
  },
  goldText() { return this.infinite && !this.inArena() ? '∞' : fmtGold(this.gold); },
  // what buying `id` costs given an inventory pool: owned components are consumed (recursively)
  costWith(id, pool, top = true) {
    if (!top) { const i = pool.indexOf(id); if (i >= 0) { pool.splice(i, 1); return { cost: 0, used: [id] }; } }
    const it = ITEM[id]; let cost = it.cost; const used = [];
    for (const c of it.from) { const r = this.costWith(c, pool, false); cost -= ITEM[c].cost - r.cost; used.push(...r.used); }
    return { cost, used };
  },
  quote(id) { return this.costWith(id, this.owned()); },
  // why the player can't buy `id` right now (null = can)
  blocker(id) {
    const it = ITEM[id]; if (!it) return 'Unknown item';
    if (!this.canShop()) return 'Go to the fountain to shop';
    if (it.cat === 'relic') return this.relic === id ? 'You already carry this relic' : null;
    const q = this.quote(id);
    if (!(this.infinite && !this.inArena()) && q.cost > this.gold) return 'Not enough gold';
    if (it.cat === 'cons') {
      const c = this.cons.find((x) => x && x.id === id);
      if (c && c.n >= it.stack) return `Max ${it.stack} of this`;
      if (!c && !this.cons.includes(null)) return 'Consumable slots are full';
      return null;
    }
    if (it.tier >= 2 && this.has(id)) return 'You already have this';
    if (it.cat === 'start' && this.slots.some((s) => s && ITEM[s].cat === 'start')) return 'Only one starter item at a time';
    if (this.owned().length - q.used.length + 1 > 6) return 'Inventory is full (sell something first)';
    return null;
  },
  // ---------------------------------------------------------------- buying and selling
  buy(id, { silent = false } = {}) {
    const why = this.blocker(id);
    if (why) { if (!silent) { HUD.warn(why); Sound.deny(); } return false; }
    const it = ITEM[id], q = this.quote(id), free = this.infinite && !this.inArena();
    if (it.cat === 'relic') { this.relic = id; this.relicCd = Math.min(this.relicCd, 10); }
    else if (it.cat === 'cons') {
      const c = this.cons.find((x) => x && x.id === id);
      if (c) c.n++; else this.cons[this.cons.indexOf(null)] = { id, n: 1 };
      if (!free) this.gold -= q.cost;
    } else {
      for (const u of q.used) { const i = this.slots.indexOf(u); if (i >= 0) { this.slots[i] = null; this.dropState(u); } }
      const i = this.slots.indexOf(null); this.slots[i] = id;
      if (!free) this.gold -= q.cost;
    }
    this.recalc(); this.save();
    if (!silent) this.purchaseFx(it);
    if (typeof Store !== 'undefined') Store.onChange(id);
    return true;
  },
  sellSlot(i, { silent = false } = {}) {
    const id = this.slots[i]; if (!id) return false;
    if (!this.canShop()) { if (!silent) { HUD.warn('Go to the fountain to shop'); Sound.deny(); } return false; }
    this.slots[i] = null; this.dropState(id);
    if (!(this.infinite && !this.inArena())) this.gold += Math.round(ITEM[id].cost * ECON.sellBack);
    this.recalc(); this.save();
    if (!silent) { Sound.tone(880, 520, 0.12, 0.05, 'triangle'); HUD.toast(`Sold ${ITEM[id].name} (+${fmtGold(ITEM[id].cost * ECON.sellBack)} gold)`); }
    if (typeof Store !== 'undefined') Store.onChange(null);
    return true;
  },
  sellCons(i) {
    const c = this.cons[i]; if (!c) return false;
    if (!this.canShop()) { HUD.warn('Go to the fountain to shop'); Sound.deny(); return false; }
    if (!(this.infinite && !this.inArena())) this.gold += Math.round(ITEM[c.id].cost * ECON.sellBack);
    if (--c.n <= 0) this.cons[i] = null;
    this.save(); if (typeof Store !== 'undefined') Store.onChange(null);
    return true;
  },
  dropState(id) {
    if (id === 'thoth_book') this.st.book = 0;
    if (id === 'mjolnir_echo') this.st.mj = 0;
  },
  // the playroom's "selg alt / nullstill"
  resetAll(gold = ECON.trainGold) {
    this.slots = [null, null, null, null, null, null]; this.cons = [null, null]; this.relic = null; this.relicCd = 0;
    this.st = {}; this.cds = {}; this.buffs = []; this.hots = []; this.gold = gold; this.shieldHp = 0;
    this.recalc(); this.save();
    if (typeof Store !== 'undefined') Store.onChange(null);
  },
  purchaseFx(it) {
    Sound.arena('buff_pickup', { gain: 0.55 });
    Sound.tone(1320, 1760, 0.09, 0.045, 'triangle'); VFX.later(0.07, () => Sound.tone(1760, 2350, 0.12, 0.035, 'triangle'));
    if (Game.mode === 'play' && !P.dead) {
      FX2.ring(P.pos, 'thothGold', { radius: 1.7, dur: 0.5 });
      FX2.burst(P.pos.clone().setY(1.5), 'thothGold', { size: 0.4, sparks: 14, embers: 10, puffs: 0, bursts: 1, light: true, distort: false });
    }
    if (Stats.ullr() && Object.keys(it.stats).some((k) => DMG_STATS.has(k))) HUD.toast(`${it.name}: +0 damage (it’s Ullr)`);
    else HUD.toast(`Bought ${it.name}`);
  },

  // ---------------------------------------------------------------- stats
  recalc() {
    const oldH = maxHp(), oldM = maxMp();
    const s = zeroStats();
    for (const id of this.slots) if (id) addStats(s, ITEM[id].stats);
    const book = this.st.book || 0;
    if (this.has('thoth_book')) s.mag += Math.min(75, book) + (book >= 75 ? 40 : 0);
    if (this.has('atum_crown')) s.mag *= 1.2;
    const r = this.recv;
    if (r.maat) { s.pprot += 10; s.mprot += 10; }
    if (r.guardian) { s.pprot += 5; s.mprot += 5; }
    if (r.hermes) { s.as += 0.1; s.ms += 0.05; }
    if (this.oocFlag) s.ms += 0.15;
    for (const b of this.buffs) addStats(s, b.stats, b.n || 1);
    Stats.cur = capStats(s);
    const nh = maxHp(), nm = maxMp();
    if (!P.dead) {
      if (nh > oldH) P.hp += nh - oldH;
      if (nm > oldM) P.mp += nm - oldM;
      P.hp = Math.min(P.hp, nh); P.mp = Math.min(P.mp, nm);
    }
  },
  buff(key, dur, stats, name, max = 1, sym = null) {
    let b = this.buffs.find((x) => x.key === key);
    if (b) { b.t = dur; b.dur = dur; if (max > 1) b.n = Math.min(max, (b.n || 1) + 1); }
    else { b = { key, t: dur, dur, stats, name, n: 1, sym }; this.buffs.push(b); }
    this.recalc();
    return b;
  },
  buffOn(key) { return this.buffs.some((b) => b.key === key); },
  heal(amount, fromItem = true) {
    if (P.dead || amount <= 0) return 0;
    let a = amount * (1 + Stats.cur.heal) * (this.antihealT > 0 ? 0.6 : 1);
    a = Math.min(a, maxHp() - P.hp);
    if (a <= 0) return 0;
    P.hp += a;
    if (this.inArena() && Arena.pstats) Arena.pstats.healed += a;
    void fromItem;
    return a;
  },
  giveShield(amount, dur) {
    if (this.inArena()) { Arena.playerShield = Math.max(Arena.playerShield || 0, 0) + amount; Arena.playerShieldT = Math.max(Arena.playerShieldT || 0, dur); }
    else { this.shieldHp = Math.max(this.shieldHp, amount); this.shieldT = Math.max(this.shieldT, dur); }
    if (FX2.ready) FX2.aura(P.pos, 'thothGold', { radius: 0.95, height: 2.2, rate: 14, dur, int: 1.2 });
  },
  shieldNow() { return this.inArena() ? (Arena.playerShield || 0) : this.shieldHp; },

  // ---------------------------------------------------------------- damage hooks (player as attacker)
  basicExtra(target) {
    let add = 0;
    if (this.has('anubis_sickle')) add += Math.min(120, 0.05 * Math.max(0, (target.maxHp || 0) - (target.hp || 0)));
    if (this.has('seshat_brush') && this.st.seshat > 0) { this.st.seshat = 0; add += 40 + 0.5 * Stats.itemPow(); this.flashText(target, 'AFTERWORD', '#ffd25e'); }
    if (this.has('s_hunter')) { this.st.hunt = (this.st.hunt || 0) + 1; if (this.st.hunt >= 4) { this.st.hunt = 0; add += 25; } }
    return add;
  },
  dmgAmp(target, basicLike, abil) {
    let m = 1;
    const tf = (target.hp || 0) / Math.max(1, target.maxHp || 1);
    if (this.has('gungnir_point') && (target.maxHp || 0) > 1500) m *= 1.1;
    if (this.has('circe_staff') && tf > 0.6) m *= 1.1;
    if (this.has('s_assassin') && tf < 0.5) m *= 1.08;
    if (this.has('tyr_oath') && P.hp < maxHp() * 0.5) m *= 1.15;
    if (this.has('s_hunter') && !target.isGod) m *= 1.15;
    if (this.recv.athena) m *= 1.08;
    if (basicLike) {
      if (this.has('brynhild_axe') && this.st.brynhild > 0) { this.st.brynhild = 0; m *= 1.4; if (target.slowed) target.slowed(0.2, 1.5); this.flashText(target, 'VALKYRIE', '#ffe28a'); }
      if (this.has('janus_blade') && this.st.janusB) { this.st.janusB = false; m *= 1.15; }
    } else if (abil && this.has('janus_blade') && this.st.janusA === this.castSeq) m *= 1.1;
    return m;
  },
  afterHit(target, amt, basicLike, abil, crit) {
    this.combatT = 0;
    // lifesteal: full on basic attacks, a third on abilities (Apep's fang: full)
    const ls = Stats.cur.ls;
    if (ls > 0 && (basicLike || abil)) {
      let k = basicLike || this.has('apep_fang') ? 1 : 0.33;
      if (this.has('bloodmoon_fang') && P.hp < maxHp() * 0.4) k *= 2;
      this.heal(amt * ls * k);
    }
    if (crit) {
      if (this.has('sekhmet_khopesh')) this.buff('sekhmet', 3, { as: 0.2 }, 'Lioness’s Fury', 1, 'khopesh');
      if (this.has('artemis_bow')) this.buff('artemis', 2, { ms: 0.12 }, 'Moon Hunt', 1, 'bow');
    }
    if (basicLike) {
      if (this.has('janus_blade')) this.st.janusP = true;
      if (this.has('ra_sun_disc')) this.dot(target, 12 + 0.15 * Stats.itemPow(), 3, 'Sunfire');
      if (this.has('mjolnir_echo')) { this.st.mj = (this.st.mj || 0) + 1; if (this.st.mj >= 3) { this.st.mj = 0; this.lightning(target); } }
    }
    if (abil) {
      if (this.has('hel_lantern')) { target.antiheal = Math.max(target.antiheal || 0, 4); this.dot(target, 10 + 0.05 * Stats.itemPow(), 3, 'Hel’s Flame'); }
      if (this.has('ares_warhammer')) { const a = this.st.ares || (this.st.ares = { n: 0, t: 0 }); a.n = Math.min(3, a.n + 1); a.t = 4; }
      const once = this.st.onceSeq !== this.castSeq;
      if (once) {
        this.st.onceSeq = this.castSeq;
        if (this.has('khonsu_crown')) for (const k of ABILITY_ORDER) if (k !== this.lastCast && P.cd[k] > 0) P.cd[k] = Math.max(0, P.cd[k] - 0.5);
        if (this.has('s_warrior')) this.heal(maxHp() * 0.015);
        if (this.has('s_mage') && target.isGod) P.mp = Math.min(maxMp(), P.mp + 10);
      }
    }
  },
  // a burn on the target (refreshed, never stacked); damage ticks through the target's bleed list
  dot(target, dps, dur, src) {
    if (!target || !target.alive || !target.bleeds) return;
    const b = target.bleeds.find((x) => x.src === src);
    if (b) { b.t = dur; b.dps = dps; } else if (target.bleed) target.bleed(dps, dur, src);
  },
  // item damage that does not proc other items
  proc(target, raw, name, physical = null) {
    if (!target || !target.alive) return 0;
    this.procLock++;
    try { return Stats.ullr() ? Combat.deal(target, 1, 'proc', name, true) : Combat.deal(target, raw, 'proc', name, false, physical); }   // (Ullr: 1, always)
    finally { this.procLock--; }
  },
  lightning(target) {
    const c = target.pos.clone(), dmg = 50 + 0.4 * Stats.itemPow();
    VFX.bolt(c.clone().setY(9), c.clone().setY(0.6), new THREE.Color(0.55, 0.8, 1.0), 0.28, 0.12, 0.9);
    if (FX2.ready) { FX2.burst(c.clone().setY(0.8), 'skadi', { size: 0.55, sparks: 18, embers: 6, puffs: 0, bursts: 1, light: true, distort: false }); FX2.ring(c, 'skadi', { radius: 2.5, dur: 0.35 }); }
    for (const d of Combat.dummies) if (d.alive && Math.hypot(d.pos.x - c.x, d.pos.z - c.z) <= 2.5 + d.radius) this.proc(d, dmg, 'Mjölnir’s Echo', false);
  },
  flashText(target, text, color) { Combat.texts.push({ x: target.pos.x, y: (target.height || 2) + 0.9, z: target.pos.z, text, color, t: 0, big: false, small: true }); },
  onCast(id) {
    this.castSeq++; this.lastCast = id; this.combatT = 0;
    if (this.has('thyrsus')) this.buff('thyrsus', 4, { as: 0.1 }, 'Bacchic Frenzy', 3, 'thyrsus');
    if (this.has('brynhild_axe')) this.st.brynhild = 4;
    if (this.has('seshat_brush')) this.st.seshat = 3;
    if (this.has('janus_blade')) { if (this.st.janusP) this.st.janusA = this.castSeq; this.st.janusP = false; this.st.janusB = true; }
    if (this.has('bragi_harp') && !(this.cds.bragi > 0)) {
      this.cds.bragi = 4;
      const h = 25 + 0.08 * Stats.itemPow();
      this.heal(h);
      if (this.inArena()) for (const b of Arena.alliesNear(P.pos, 9, Arena.myTeam)) if (!b.isPlayer && b.alive) { if (b.replica) Net.heal(b, Math.min(h, b.maxHp - b.hp)); else b.hp = Math.min(b.maxHp, b.hp + h); }   // (online: the host heals its bots)
      if (FX2.ready) FX2.ring(P.pos, 'turq', { radius: 9, dur: 0.6, int: 0.8 });
    }
  },
  onKill(target) {
    if (this.has('thoth_book') && (this.st.book || 0) < 75) {
      const before = this.st.book || 0;
      this.st.book = Math.min(75, before + (target.isGod ? 5 : 1));
      if (before < 75 && this.st.book >= 75) HUD.toast('Book of Thoth’s Echoes is full: +40 magical power');
      this.recalc();
    }
    if (this.has('persephone_pomegranate') && !(this.inArena() && target.isGod)) this.heal(maxHp() * (target.isGod ? 0.2 : 0.02));
  },
  // ---------------------------------------------------------------- damage hooks (player as target, Arena)
  incoming(amt, src, o) {
    if (this.immuneT > 0) return 0;
    let dr = 0;
    if (this.st.ares && this.st.ares.t > 0) dr += 0.05 * this.st.ares.n;
    if (this.buffOn('nephthys')) dr += 0.2;
    amt *= 1 - Math.min(0.5, dr);
    if (this.has('aegis_fragment') && !(this.cds.aegis > 0) && src && src.isGod) { amt *= 0.5; this.cds.aegis = 8; this.flashText({ pos: P.pos, height: 2.2 }, 'AEGIS', '#e8f0ff'); }
    void o;
    return amt;
  },
  tryAnkh() {
    if (!this.has('osiris_ankh') || this.cds.ankh > 0) return false;
    this.cds.ankh = 150; this.immuneT = 1.5;
    this.hots.push({ hp: maxHp() * 0.35 / 3, mp: 0, t: 3 });
    HUD.toast('Ankh of Rebirth: you live again!');
    if (FX2.ready) { FX2.burst(P.pos.clone().setY(1.2), 'thothGold', { size: 1.1, sparks: 30, embers: 20, puffs: 1, bursts: 2, light: true }); FX2.ring(P.pos, 'thothGold', { radius: 3.5, dur: 0.7 }); }
    Sound.arena('ankh_pickup', { gain: 0.9 });
    return true;
  },
  afterDamaged(amt, src, o) {
    this.combatT = 0;
    if (amt <= 0 || P.dead) return;
    if (this.has('scarab_amulet') && !(this.cds.scarab > 0) && P.hp < maxHp() * 0.3) {
      this.cds.scarab = 60;
      this.giveShield(200 + 0.15 * maxHp(), 4);
      HUD.toast('Scarab Amulet: Khepri’s shield');
      Sound.arena('scarab_pickup', { gain: 0.7 });
    }
    if (this.has('sobek_scales') && o && o.basic && src && src.alive && src.maxHp && src.team !== Arena.myTeam) Arena.hurt(src, amt * 0.2, Arena.pu, { true: true });
  },
  onCC() { if (this.has('nephthys_veil')) this.buff('nephthys', 3, {}, 'Twilight Veil', 1, 'veil'); },

  // ---------------------------------------------------------------- consumables + relic
  useCons(i) {
    const c = this.cons[i]; if (!c || P.dead) return false;
    const it = ITEM[c.id];
    if (it.use === 'heal') this.hots.push({ hp: 30, mp: 0, t: 10 });
    else if (it.use === 'mana') this.hots.push({ hp: 0, mp: 22, t: 10 });
    else if (it.use === 'isis') this.hots.push({ hp: 350 / 12, mp: 250 / 12, t: 12 });
    else if (it.use === 'ward') this.buff('ward', 90, { pprot: 10, mprot: 10, ms: 0.05 }, 'Eye of Horus', 1, 'eyeflask');
    else if (it.use === 'power') this.buff('elixir', 180, { phys: 15, mag: 35, as: 0.05 }, 'Sekhmet’s Power', 1, 'flask');
    if (--c.n <= 0) this.cons[i] = null;
    Sound.tone(520, 880, 0.18, 0.04, 'sine');
    if (FX2.ready) FX2.burst(P.pos.clone().setY(1.3), it.use === 'mana' ? 'thoth' : it.use === 'power' ? 'molten' : it.use === 'ward' ? 'thothGold' : 'turq', { size: 0.35, sparks: 10, embers: 10, puffs: 0, bursts: 1, light: false, distort: false });
    this.save(); if (typeof Store !== 'undefined') Store.onChange(null);
    return true;
  },
  useRelic() {
    const id = this.relic; if (!id || P.dead) return false;
    if (this.relicCd > 0) { HUD.warn(`Relic ready in ${Math.ceil(this.relicCd)} s`); Sound.deny(); return false; }
    const it = ITEM[id];
    if (it.use !== 'bead' && P.stunT > 0) { Sound.deny(); return false; }
    if (it.use === 'blink' && kitBusy()) { Sound.deny(); return false; }
    this.relicCd = it.cd;
    const at = P.pos.clone();
    if (it.use === 'bead') {
      P.stunT = 0; P.rootT = 0; P.slowT = 0; P.slowAmt = 0; this.ccImmuneT = 1.5;
      if (this.inArena()) Arena.cc = null;
      if (FX2.ready) { FX2.burst(at.clone().setY(1.2), 'turq', { size: 0.8, sparks: 24, embers: 14, puffs: 1, bursts: 1, light: true }); FX2.ring(at, 'turq', { radius: 3, dur: 0.5 }); }
      HUD.toast('Cleansed · CC immune for 1.5 s');
    } else if (it.use === 'sprint') {
      this.buff('sprint', 4, { ms: 0.4 }, 'Jackal’s Sprint', 1, 'paw');
      if (FX2.ready) FX2.aura(P.pos, 'thothGold', { radius: 0.8, height: 1.2, rate: 18, dur: 4 });
    } else if (it.use === 'shield') {
      this.giveShield(maxHp() * 0.25, 3);
      HUD.toast(`Shield · ${Math.round(maxHp() * 0.25)}`);
    } else if (it.use === 'blink') {
      const f = fwdOf(P.yaw), dist = 9, to = at.clone().addScaledVector(f, dist);
      const tb = segmentBlocked(at.x, at.z, to.x, to.z);
      if (tb < 1) to.lerpVectors(at, to, Math.max(0, tb - 0.04));
      resolveCircle(to, 0.45);
      P.pos.x = to.x; P.pos.z = to.z; P.vel.set(0, 0, 0);
      if (FX2.ready) { FX2.burst(at.clone().setY(1.1), 'hecate', { size: 0.6, sparks: 16, embers: 12, puffs: 2, bursts: 1, light: false }); FX2.burst(P.pos.clone().setY(1.1), 'hecate', { size: 0.7, sparks: 20, embers: 12, puffs: 1, bursts: 1, light: true }); }
    } else if (it.use === 'frost') {
      const near = Combat.dummies.filter((d) => d.alive && Math.hypot(d.pos.x - at.x, d.pos.z - at.z) <= 8 + d.radius);
      for (const d of near) { d.slowed(0.4, 3); this.proc(d, 50, 'Ymir’s Icy Breath', false); }
      if (FX2.ready) { FX2.ring(at, 'frost', { radius: 8, dur: 0.6 }); FX2.burst(at.clone().setY(1), 'frost', { size: 0.9, sparks: 26, embers: 18, puffs: 3, bursts: 1, light: true }); }
    }
    Sound.arena('buff_pickup', { gain: 0.6, rate: 1.2 });
    return true;
  },

  // ---------------------------------------------------------------- the frame
  update(dt) {
    if (dt <= 0) return;
    const playing = Game.mode === 'play' || Game.mode === 'inspect';
    this.combatT += dt;
    for (const k in this.cds) if (this.cds[k] > 0) this.cds[k] -= dt;
    if (this.relicCd > 0) this.relicCd = Math.max(0, this.relicCd - dt);
    this.ccImmuneT = Math.max(0, this.ccImmuneT - dt); this.immuneT = Math.max(0, this.immuneT - dt); this.antihealT = Math.max(0, this.antihealT - dt);
    for (const k of ['brynhild', 'seshat']) if (this.st[k] > 0) this.st[k] -= dt;
    if (this.st.ares && this.st.ares.t > 0 && (this.st.ares.t -= dt) <= 0) this.st.ares.n = 0;
    if (this.shieldT > 0 && (this.shieldT -= dt) <= 0) this.shieldHp = 0;
    // buffs
    let changed = false;
    for (const b of this.buffs) b.t -= dt;
    if (this.buffs.some((b) => b.t <= 0)) { this.buffs = this.buffs.filter((b) => b.t > 0); changed = true; }
    const ooc = this.has('horus_wings') && this.combatT > 4;
    if (ooc !== this.oocFlag) { this.oocFlag = ooc; changed = true; }
    if (changed) this.recalc();
    // regeneration: hp5 / mp5 from items, heal-over-time drinks, Yggdrasil
    if (!P.dead && playing) {
      const s = Stats.cur;
      if (s.hp5 > 0) this.heal(s.hp5 / 5 * dt);
      if (s.mp5 > 0) P.mp = Math.min(maxMp(), P.mp + s.mp5 / 5 * dt);
      if (this.has('yggdrasil_bark') && this.combatT > 3) this.heal(maxHp() * 0.02 * dt);
      for (const h of this.hots) { const k = Math.min(dt, h.t); h.t -= dt; if (h.hp) this.heal(h.hp * k); if (h.mp) P.mp = Math.min(maxMp(), P.mp + h.mp * k); }
      this.hots = this.hots.filter((h) => h.t > 0);
    }
    // keys: 6/7 drink, Z relic
    if (Game.mode === 'play' && !(typeof Store !== 'undefined' && Store.open) && !P.dead) {
      ITEM_KEYS.cons.forEach((k, i) => { if (input.pressed.has(k)) { if (this.cons[i]) this.useCons(i); else Sound.deny(); } });
      if (input.pressed.has(ITEM_KEYS.relic)) { if (this.relic) this.useRelic(); else { HUD.warn('No relic (buy one in the store, P)'); Sound.deny(); } }
    }
    // auras (yours and your allies')
    this.auraT -= dt;
    if (this.auraT <= 0) { this.auraT = 0.5; this.updateAuras(0.5); }
    // the Arena's economy and the bots' shopping
    if (this.inArena()) this.arenaTick(dt);
  },
  updateAuras(step) {
    const arena = this.inArena();
    const me = { pos: P.pos, team: Arena.myTeam, alive: !P.dead, inv: this.slots, isPlayer: true };
    // (online: the other players' items (their state) and the host's bots' (its bot table) give their auras too; only my
    // god and the host's own bots take them here - the others take theirs on their own page, the replicas from the host)
    const gods = arena ? [me, ...Arena.bots.filter((b) => b.inv), ...Arena.humans] : [me];
    for (const g of gods) {
      if (g.replica || g.isRemotePlayer) continue;
      const recv = {};
      if (g.alive) for (const s of gods) {
        if (!s.alive || s.team !== g.team || Math.hypot(s.pos.x - g.pos.x, s.pos.z - g.pos.z) > 9) continue;
        for (const id of s.inv) if (id && AURA_ITEMS[id]) recv[AURA_ITEMS[id]] = true;
      }
      if (g.isPlayer) {
        const a = Object.keys(recv).sort().join(), b = Object.keys(this.recv).sort().join();
        this.recv = recv; if (a !== b) this.recalc();
        if (recv.isis && !P.dead && P.hp < maxHp() * 0.5) this.heal(maxHp() * 0.01 * step);
        if (recv.guardian && arena && this.has('s_guardian') && [...Arena.bots, ...Arena.humans].some((x) => x.team === Arena.myTeam && x.alive && Math.hypot(x.pos.x - P.pos.x, x.pos.z - P.pos.z) < 12)) this.gold += 1 * step;
      } else {
        const key = Object.keys(recv).sort().join();
        if (key !== g.recvKey) { g.recvKey = key; g.recv = recv; botProt(g); }
        if (recv.isis && g.alive && g.hp < g.maxHp * 0.5) g.hp = Math.min(g.maxHp, g.hp + g.maxHp * 0.01 * step);
      }
    }
    // Ymir's frostmail: everyone's enemies close to its wearer walk slower
    for (const g of gods) {
      if (!g.alive || g.replica || g.isRemotePlayer || !g.inv.includes('ymir_frostmail')) continue;
      const foes = g.isPlayer ? Combat.dummies : Arena.foesOf(g.team);
      for (const u of foes) if (u.alive && u.slowed && Math.hypot(u.pos.x - g.pos.x, u.pos.z - g.pos.z) <= 6 + (u.radius || 0.5)) u.slowed(0.15, 0.7);
    }
  },
  // ---------------------------------------------------------------- Arena economy
  arenaTick(dt) {
    if (Arena.phase !== 'play') return;
    this.incomeAcc += ECON.perSec * dt;
    if (this.incomeAcc >= 1) {
      const n = Math.floor(this.incomeAcc); this.incomeAcc -= n;
      this.gold += n;
      if (Arena.authority) for (const b of Arena.bots) b.gold = (b.gold || 0) + n;   // (online: the host's bots)
    }
    this.botT -= dt;
    if (this.botT <= 0 && Arena.authority) {
      this.botT = 0.5;
      for (const b of Arena.bots) if (b.inv && (!b.alive || Arena.inFountainZone(b.pos, b.team))) botShop(b);
    }
  },
  addGold(g, amt, at, why = 0) {
    if (!g || !amt) return;
    if (g === Arena.pu) {
      this.gold += amt;
      const p = at || P.pos;
      Combat.texts.push({ x: p.x + rand(-0.2, 0.2), y: 2.6, z: p.z + rand(-0.2, 0.2), text: `+${amt} g`, color: '#ffd25e', t: 0, big: amt >= 150, small: amt < 50 });
      if (amt >= 50) { Sound.tone(1568, 2093, 0.08, 0.035, 'triangle'); VFX.later(0.06, () => Sound.tone(2093, 2637, 0.1, 0.03, 'triangle')); }
    } else if (g.isRemotePlayer) Net.gold(g, amt, at, why);   // (online: another human's gold is its own page's; why: 1 kill 2 assist 3 minion 4 camp 5 Sebek)
    else if (g.inv) g.gold = (g.gold || 0) + amt;
  },
  onGodKill(kg, assists, v) {
    if (kg) this.addGold(kg, ECON.godKill, v.pos.clone ? v.pos.clone() : v.pos, 1);
    for (const g of assists) this.addGold(g, ECON.assist, v.pos.clone ? v.pos.clone() : v.pos, 2);
    // Persephone's pomegranate: takedowns heal (the player's)
    if ((kg === Arena.pu || assists.includes(Arena.pu)) && this.has('persephone_pomegranate')) this.heal(maxHp() * 0.2);
  },
  onArenaDeath(u, killer) {
    if (!killer || killer.team === u.team) return;
    if (u.kind === 'minion' && killer.isGod) this.addGold(killer, ECON.minion + ((killer === Arena.pu ? this.has('s_mage') : killer.isRemotePlayer && killer.inv.includes('s_mage')) ? 3 : 0), u.pos.clone(), 3);
    else if (u.kind === 'camp' && killer.isGod) this.addGold(killer, ECON.camp, u.pos.clone(), 4);
    else if (u.kind === 'siege') {
      const team = 1 - u.team;
      for (const g of [Arena.pu, ...Arena.bots, ...Arena.humans]) if (g.team === team) this.addGold(g, ECON.siege, g === Arena.pu ? P.pos : null, 5);
      if (team === Arena.myTeam) HUD.toast(`Sebek Colossus fell · +${ECON.siege} gold for the team`);
    }
  },
  // the playroom's inventory waits outside while a match runs
  enterArena() {
    this.saved = { slots: this.slots.slice(), cons: this.cons.map((c) => (c ? { ...c } : null)), relic: this.relic, gold: this.gold, st: { ...this.st } };
    this.slots = [null, null, null, null, null, null]; this.cons = [null, null]; this.relic = null; this.st = {}; this.buffs = []; this.hots = [];
    this.recalc();
  },
  startMatch() {
    this.slots = [null, null, null, null, null, null]; this.cons = [null, null]; this.relic = null; this.relicCd = 0;
    this.st = {}; this.cds = {}; this.buffs = []; this.hots = []; this.recv = {}; this.gold = ECON.start; this.incomeAcc = 0; this.botT = 0.2;
    this.recalc();
    P.hp = maxHp(); P.mp = maxMp();
    for (const b of Arena.bots) { b.gold = ECON.start; b.inv = []; b.istats = sumItemStats([]); b.recv = {}; b.recvKey = ''; b.applyLevel(true); }
    if (typeof Store !== 'undefined') Store.onChange(null);
  },
  leaveArena() {
    const s = this.saved; this.saved = null;
    if (s) { this.slots = s.slots; this.cons = s.cons; this.relic = s.relic; this.gold = s.gold; this.st = s.st; }
    this.buffs = []; this.hots = []; this.recv = {}; this.cds = {}; this.relicCd = 0;
    this.recalc();
    P.hp = maxHp(); P.mp = maxMp();
    if (typeof Store !== 'undefined') { Store.close(false); Store.onChange(null); }
  },
  // ---------------------------------------------------------------- persistence (the playroom only)
  save() {
    if (this.inArena()) return;
    try { localStorage.setItem('thoth-playroom-items', JSON.stringify({ slots: this.slots, cons: this.cons, relic: this.relic, gold: this.gold, infinite: this.infinite, book: this.st.book || 0 })); } catch (e) { /* storage unavailable */ }
  },
  load() {
    try {
      const d = JSON.parse(localStorage.getItem('thoth-playroom-items') || 'null');
      if (!d) return;
      if (Array.isArray(d.slots)) this.slots = [0, 1, 2, 3, 4, 5].map((i) => (ITEM[d.slots[i]] && ITEM[d.slots[i]].cat !== 'cons' && ITEM[d.slots[i]].cat !== 'relic' ? d.slots[i] : null));
      if (Array.isArray(d.cons)) this.cons = [0, 1].map((i) => (d.cons[i] && ITEM[d.cons[i].id] ? { id: d.cons[i].id, n: clamp(d.cons[i].n | 0, 1, ITEM[d.cons[i].id].stack) } : null));
      if (ITEM[d.relic]) this.relic = d.relic;
      if (typeof d.gold === 'number') this.gold = d.gold;
      if (typeof d.infinite === 'boolean') this.infinite = d.infinite;
      this.st.book = d.book || 0;
    } catch (e) { /* ignore */ }
  },
};

// ---------------------------------------------------------------------------
// Bots: buying, and their stat layer
// ---------------------------------------------------------------------------
function botBuild(b) { return BOT_BUILDS[b.god] || BOT_BUILDS[(GODS[b.god] && GODS[b.god].role) || 'Mage'] || BOT_BUILDS.Mage; }
// the next thing to buy on the way to `goal`: the goal itself if affordable, else its most expensive missing component
function botNextStep(goal, inv, gold) {
  const r = Items.costWith(goal, inv.slice());
  if (r.cost <= gold) return { id: goal, cost: r.cost, used: r.used };
  const comps = ITEM[goal].from.slice().sort((a, b) => ITEM[b].cost - ITEM[a].cost);
  for (const c of comps) { if (inv.includes(c)) continue; const s = botNextStep(c, inv, gold); if (s) return s; }
  return null;
}
function botShop(b) {
  const plan = botBuild(b);
  for (let guard = 0; guard < 6; guard++) {
    const goal = plan.find((id) => !b.inv.includes(id) && !(ITEM[id].cat === 'start' && b.starterSold));
    if (!goal) return;
    const step = botNextStep(goal, b.inv, b.gold);
    if (!step) return;   // saving up
    if (b.inv.length - step.used.length + 1 > 6) {
      // full: the starter goes first (sold for half)
      const si = b.inv.findIndex((id) => ITEM[id].cat === 'start');
      if (si < 0 || ITEM[step.id].cat === 'start') return;
      b.gold += Math.round(ITEM[b.inv[si]].cost * ECON.sellBack); b.inv.splice(si, 1); b.starterSold = true;
      continue;
    }
    for (const u of step.used) { const i = b.inv.indexOf(u); if (i >= 0) b.inv.splice(i, 1); }
    b.inv.push(step.id); b.gold -= step.cost;
    b.istats = sumItemStats(b.inv);
    b.applyLevel();
    if (b.onScreen && b.camDist < 30 && FX2.ready && ITEM[step.id].tier >= 3) FX2.ring(b.pos, 'thothGold', { radius: 1.3, dur: 0.45 });
  }
}
function botProt(b) {
  if (b._protBase === undefined) return;
  const s = b.istats || zeroStats(), r = b.recv || {};
  const aura = (r.maat ? 10 : 0) + (r.guardian ? 5 : 0);
  b.physProt = b._protBase + s.pprot + aura; b.magProt = b._protBase + s.mprot + aura;
}
{
  const BP = BotGod.prototype;
  const al0 = BP.applyLevel;
  BP.applyLevel = function (full = false) {
    al0.call(this, full);
    this._protBase = this.physProt;
    const s = this.istats; if (!s) return;
    this.maxHp += s.hp;
    this.hp = full ? this.maxHp : Math.min(this.maxHp, this.hp + s.hp);
    this.power *= 1 + (this.bk && this.bk.physical ? s.phys / 450 : s.mag / 900);
    botProt(this);
  };
  // basic attacks come faster with attack speed (and Hermes' aura)
  const ba0 = BP.basicAttack;
  BP.basicAttack = function (tg) { ba0.call(this, tg); const s = this.istats; if (s) this.atkCd /= 1 + Math.min(STAT_CAP.as, s.as + (this.recv && this.recv.hermes ? 0.1 : 0)); };
  const sb0 = BP.speedBuff;
  BP.speedBuff = function () { const s = this.istats; return sb0.call(this) * (s ? 1 + Math.min(STAT_CAP.ms, s.ms + (this.recv && this.recv.hermes ? 0.05 : 0)) : 1); };
  // cooldown reduction from items: the bot's cooldowns run faster; antiheal blunts its regeneration
  const up0 = BP.update;
  BP.update = function (dt, t) {
    const h0 = this.hp;
    up0.call(this, dt, t);
    const s = this.istats;
    if (s && this.alive && s.cdr > 0) { const k = s.cdr / (1 - s.cdr); for (let i = 0; i < this.cd.length; i++) this.cd[i] = Math.max(0, this.cd[i] - dt * k); }
    if (this.antiheal > 0 && this.hp > h0 && this.alive) this.hp = h0 + (this.hp - h0) * 0.6;
  };
  // crowd-control reduction
  for (const k of ['applyStun', 'freeze', 'mesmerize', 'rooted']) {
    const f = ArenaUnit.prototype[k];
    BP[k] = function (t, ...a) { const r = this.istats ? Math.min(STAT_CAP.ccr, this.istats.ccr) : 0; return f.call(this, t * (1 - r), ...a); };
  }
  const sl0 = ArenaUnit.prototype.slowed;
  BP.slowed = function (amt, t) { const r = this.istats ? Math.min(STAT_CAP.ccr, this.istats.ccr) : 0; return sl0.call(this, amt, t * (1 - r)); };
}

// ---------------------------------------------------------------------------
// Hooks into combat (wrappers: the original code stays as it was)
// ---------------------------------------------------------------------------
// protections after penetration: % first (Thoth's Dead Reckoning + items), then flat
Combat.mitigate = function (raw, target, physical = false) {
  const tp = physical ? { flat: 0, pct: 0 } : this.pen();
  const ullr = Stats.ullr();
  const pct = Math.min(0.6, tp.pct + (ullr ? 0 : Stats.cur.penP)), flat = tp.flat + (ullr ? 0 : Stats.cur.pen);
  const prot = (physical ? target.physProt : target.magProt) || 0;
  const eff = Math.max(0, prot * (1 - pct) - flat);
  return raw * 100 / (100 + eff);
};
{
  const deal0 = Combat.deal;
  Combat.deal = function (target, raw, kind, src, trueDamage = false, physical = null) {
    if (Net.ctx) return 0;
    if (!target || !target.alive || Items.procLock || !Kit || Kit.id === 'ullr') return deal0.call(this, target, raw, kind, src, trueDamage, physical);   // (Ullr: always exactly 1)
    const basicLike = kind === 'basic' || (kind === 'glyph' && src === 'Basic attack');
    const abil = !basicLike && kind !== 'dot' && kind !== 'proc';
    let r = raw, crit = false;
    if (basicLike) {
      r += Items.basicExtra(target);
      const cc = Stats.cur.crit;
      if (cc > 0 && Math.random() < cc) { crit = true; r *= 1.75 + Stats.cur.critDmg; }
    }
    if (kind !== 'dot') r *= Items.dmgAmp(target, basicLike, abil);
    const n = this.texts.length;
    this.critHit = crit;   // (online: a blow sent to another page carries it)
    let amt; try { amt = deal0.call(this, target, r, kind, src, trueDamage, physical); } finally { this.critHit = false; }
    if (amt > 0) {
      if (crit && this.texts.length > n) { const tx = this.texts[this.texts.length - 1]; tx.text = `${amt}!`; tx.color = '#ffe95a'; tx.big = true; }
      try { Items.afterHit(target, amt, basicLike, abil, crit); } catch (e) { console.warn('[items] afterHit', e); }
    }
    return amt;
  };
  const credit0 = Combat.credit;
  Combat.credit = function (target) { credit0.call(this, target); try { Items.onKill(target); } catch (e) { console.warn('[items] onKill', e); } };
}
// "on ability cast": every kit's cast() reports to the items first (so an instant ability's own hits count as this cast)
for (const kit of Object.values(GODS)) {
  if (!kit || typeof kit.cast !== 'function' || kit.cast.itemsWrapped) continue;
  const c0 = kit.cast;
  kit.cast = function (id, ...a) { if (!Net.ctx) try { Items.onCast(id); } catch (e) { console.warn('[items] onCast', e); } return c0.call(this, id, ...a); };
  kit.cast.itemsWrapped = true;
}
// the player in the Arena: protections, crowd-control reduction, shields, cheat death, reflect
for (const k of ['magProt', 'physProt']) {
  const d0 = Object.getOwnPropertyDescriptor(PlayerUnit.prototype, k);
  if (d0 && d0.get) Object.defineProperty(PlayerUnit.prototype, k, { configurable: true, get() { return d0.get.call(this) + Stats.cur[k === 'magProt' ? 'mprot' : 'pprot']; } });
}
for (const k of ['applyStun', 'rooted']) {
  const f = PlayerUnit.prototype[k];
  PlayerUnit.prototype[k] = function (t) { if (Items.ccImmuneT > 0) return; Items.onCC(); return f.call(this, t * (1 - Stats.cur.ccr)); };
}
{
  const f = PlayerUnit.prototype.slowed;
  PlayerUnit.prototype.slowed = function (amt, t) { if (Items.ccImmuneT > 0) return; return f.call(this, amt, t * (1 - Stats.cur.ccr)); };
}
{
  const A = Arena;
  // gold: god kills and assists (the same killer / assist rules as the XP)
  const gd0 = A.godDied;
  A.godDied = function (v, killer) {
    const vTeam = v.team, now = Combat.time;
    let kg = killer && killer.isGod ? killer : null;
    if (!kg) { let bt = -1; for (const [g, t] of v.dmgBy) if (g.team !== vTeam && now - t < 10 && t > bt && g.alive !== undefined) { bt = t; kg = g; } }
    const assists = [];
    for (const [g, t] of v.dmgBy) if (g !== kg && g.team !== vTeam && now - t < 10) assists.push(g);
    const r = gd0.call(this, v, killer);
    try { Items.onGodKill(kg, assists, v); } catch (e) { console.warn('[items] gold', e); }
    return r;
  };
  // gold: minions, camps, Sebek
  const oud0 = A.onUnitDied;
  A.onUnitDied = function (u) {
    const killer = u.lastAttacker && Combat.time - u.lastAttackT < 12 ? u.lastAttacker : null;
    const r = oud0.call(this, u);
    try { Items.onArenaDeath(u, killer); } catch (e) { console.warn('[items] gold', e); }
    return r;
  };
  // bots' items when they deal damage: crit, penetration, Athena's aura, lifesteal, Hel's antiheal
  const hurt0 = A.hurt;
  A.hurt = function (target, raw, src, o = {}) {
    if (!target || !target.alive || this.phase !== 'play') return hurt0.call(this, target, raw, src, o);
    const S = src && src.istats;
    const fixed = raw === 1 || (src && src.bk && src.bk.basic.fixed && o.basic);
    if (S && !fixed) {
      if (o.basic && S.crit > 0 && Math.random() < S.crit) raw *= 1.75 + S.critDmg;
      if (!o.true && (S.pen > 0 || S.penP > 0)) {
        const prot = Math.max(0, (o.physical ? target.physProt : target.magProt) || 0), eff = Math.max(0, prot * (1 - S.penP) - S.pen);
        raw *= (100 + prot) / (100 + eff);
      }
      if (src.recv && src.recv.athena) raw *= 1.08;
    }
    const amt = hurt0.call(this, target, raw, src, o);
    if (S && amt > 0 && src.alive && src.maxHp) {
      if (S.ls > 0) src.hp = Math.min(src.maxHp, src.hp + amt * S.ls * (o.basic ? 1 : 0.33) * (src.antiheal > 0 ? 0.6 : 1));
      if (!o.basic && src.inv && src.inv.includes('hel_lantern')) { if (target.isPlayer) Items.antihealT = 4; else target.antiheal = Math.max(target.antiheal || 0, 4); }
    }
    return amt;
  };
  // the player takes damage: damage reduction passives, Aegis, the Ankh, then Scarab / Sobek after
  const dp0 = A.damagePlayer;
  A.damagePlayer = function (amt, src, o = {}) {
    if (P.dead || this.immortal) return dp0.call(this, amt, src, o);
    amt = Items.incoming(amt, src, o);
    if (amt <= 0) { Items.combatT = 0; return 0; }
    amt = Math.max(1, Math.round(amt));
    if (amt >= P.hp + (this.playerShield || 0) && Items.tryAnkh()) amt = Math.max(0, Math.floor(P.hp + (this.playerShield || 0) - 1));
    const r = dp0.call(this, amt, src, o);
    try { Items.afterDamaged(r, src, o); } catch (e) { console.warn('[items] afterDamaged', e); }
    return r;
  };
  // a match starts: the playroom's inventory is stashed (before the match saves settings), everyone gets 1500 gold
  const sm0 = A.setupMatch;
  A.setupMatch = async function (...a) {
    if (!ArenaMap.saved) Items.enterArena();
    const r = await sm0.apply(this, a);
    Items.startMatch();
    return r;
  };
  const ex0 = A.exit;
  A.exit = function (...a) { const r = ex0.apply(this, a); Items.leaveArena(); return r; };
}
// the per-frame tick rides on VFX.update (called once per simulation step)
{
  const vu0 = VFX.update;
  VFX.update = function (dt) {
    vu0.call(this, dt);
    try { Items.update(dt); } catch (e) { if (!Items.warned) { Items.warned = true; console.warn('[items] update', e); } }
  };
}

