// Fellowship BiS Tracker
// Gear data extracted from fellowbis.com calculator

// Dungeon name mappings with Spanish descriptions
const dungeonDescriptions = {
  "Cithrel's Fall": "Hielo 30 min",
  "Ransack of Drakheim": "Minijuego tótems 30 min",
  "The Heart of Tuzari": "Boss final jodienda 30 min",
  "Wraithtide Vault": "Piratas 30 min",
  "Empyrean Sands": "Desierto",
  "Everdawn Grove": "Ciervo",
  "Godfall Quarry": "Boss línea recta",
  "Sailor's Abyss": "Sirena piratas",
  "Silken Hollow": "Arañas Cringe",
  "Stormwatch": "Boss al 80% vida",
  "Urrak Markets": "Mercados XDD",
  "Wyrmheart": "Hielo",
  "Any Dungeon": "Cualquier mazmorra"
};

// Legendary/Weapon effects
const itemEffects = {
  // Helena
  "Masochistic Razor Necklace": {
    effectName: "Razor Crash",
    effect: "El primer golpe de tu Lanzamiento de Escudo siempre activa Metralla de Cuchilla y tu Metralla de Cuchilla ahora también aplica Herida Agonizante a los objetivos, reduciendo el daño que te hacen en un 20% durante 5 segundos."
  },
  "Fateful Arms": {
    effectName: "Fated Strike",
    effect: "Golpea al enemigo objetivo, infligiendo daño y daño de cuchillada a los enemigos cercanos. Te aplica Propósito Glorioso durante 6 segundos, aumentando tu Pericia en +20% y otorgándote +200% de Recuperación de Enfriamiento."
  },
  // Sylvie
  "Amulet of Unyielding Bloom": {
    effectName: "Unyielding Bloom",
    effect: "El 75% de cualquier sobrecuración realizada a un jugador por tu Flor del Corazón se aplica como Absorción a ese jugador durante hasta 15 segundos."
  },
  "Zeraleth's Scythe": {
    effectName: "Zeraleth's Hunger",
    effect: "Inflige daño mágico cada 0.5 segundos durante 3 segundos al enemigo objetivo mientras canalizas. Te curas por el 100% del daño infligido. El exceso de curación se distribuye a hasta 3 aliados cercanos."
  },
  // Mara
  "Treads of Vexira's Prey": {
    effectName: "Vexira's Venom",
    effect: "Tus golpes críticos de Colmillo de la Reina y Asalto Arácnido aplican Veneno de Vexira a los enemigos, añadiendo el 40% del daño inicial acumulativamente como daño de veneno durante 6 segundos."
  },
  "Fateful Dagger": {
    effectName: "Fated Strike",
    effect: "Golpea al enemigo objetivo, infligiendo daño y daño de cuchillada a los enemigos cercanos. Te aplica Propósito Glorioso durante 6 segundos, aumentando tu Pericia en +20% y otorgándote +200% de Recuperación de Enfriamiento."
  },
  // Elarion
  "Master Astronomer's Sabatons": {
    effectName: "Astronomer's Hail",
    effect: "La duración de tu Lluvia de Estrellas se aumenta en 2 segundos. Mientras Lluvia de Estrellas está activa, su duración se extiende en 0.5 segundos cada vez que lanzas Disparo Múltiple."
  },
  "Void-touched Bow": {
    effectName: "Voidbringer's Touch",
    effect: "Aplica Toque del Portador del Vacío al enemigo objetivo durante 15 segundos, causando que el 20% de todo el daño que inflijas a cualquier enemigo se replique y almacene en el efecto. Al expirar, el efecto erupciona en una explosión sombría, infligiendo el daño acumulado."
  }
};

// Mark legendary items (neck for Helena/Sylvie, feet for Mara/Elarion)
const legendarySlots = {
  helena: ['neck', 'weapon'],
  sylvie: ['neck', 'weapon'],
  mara: ['feet', 'weapon'],
  elarion: ['feet', 'weapon']
};

const fellowshipGearData = {
  helena: {
    name: 'Helena',
    role: 'Tank',
    portrait: 'fellowship/helena.webp',
    gear: {
      head: { name: 'Rusting Armet', dungeon: 'Wraithtide Vault', stats: { expertise: 184, spirit: 150 } },
      neck: { name: 'Masochistic Razor Necklace', dungeon: 'Any Dungeon', stats: { crit: 397, haste: 70 } },
      shoulders: { name: 'Windbitten Shoulderpads', dungeon: 'Ransack of Drakheim', stats: { crit: 45, haste: 252 } },
      back: { name: 'Blighted Fur Cape', dungeon: 'Everdawn Grove', stats: { haste: 158, expertise: 28 } },
      chest: { name: "Executioner's Hauberk", dungeon: 'The Heart of Tuzari', stats: { haste: 62, spirit: 346 } },
      wrists: { name: 'Ballast Wristguards', dungeon: "Sailor's Abyss", stats: { haste: 158, spirit: 28 } },
      hands: { name: 'Sticky Gauntlets', dungeon: 'Silken Hollow', stats: { haste: 123, expertise: 100 } },
      legs: { name: 'Venom-pitted Leggplates', dungeon: 'Silken Hollow', stats: { expertise: 204, spirit: 167 } },
      feet: { name: "Drowned Captain's Boots", dungeon: "Sailor's Abyss", stats: { haste: 143, spirit: 117 } },
      ring1: { name: 'Wave-Worn Signet Ring', dungeon: "Sailor's Abyss", stats: { expertise: 227, spirit: 40 } },
      ring2: { name: 'Mineralized Signet', dungeon: 'Godfall Quarry', stats: { haste: 120, spirit: 147 } },
      relic1: { name: 'Saltwash Elixir', dungeon: 'Any Dungeon', stats: { crit: 120, haste: 280 } },
      relic2: { name: 'Grimoire of Resurrection', dungeon: 'Any Dungeon', stats: { haste: 280, spirit: 120 } },
      weapon: { name: 'Fateful Arms', dungeon: 'Any Dungeon', stats: { expertise: 200, spirit: 245 } }
    }
  },
  sylvie: {
    name: 'Sylvie',
    role: 'Healer',
    portrait: 'fellowship/sylvie.webp',
    gear: {
      head: { name: "Shaman's Headgarb", dungeon: 'Everdawn Grove', stats: { haste: 50, spirit: 284 } },
      neck: { name: 'Amulet of Unyielding Bloom', dungeon: 'Any Dungeon', stats: { crit: 70, expertise: 397 } },
      shoulders: { name: 'Slavehide Shoulders', dungeon: 'The Heart of Tuzari', stats: { haste: 208, spirit: 89 } },
      back: { name: 'Drowned Cloak', dungeon: 'Ransack of Drakheim', stats: { crit: 84, spirit: 102 } },
      chest: { name: "First-mate's Tunic", dungeon: 'Wraithtide Vault', stats: { haste: 346, spirit: 62 } },
      wrists: { name: 'Cutthroat Cuffs', dungeon: 'Wraithtide Vault', stats: { crit: 28, haste: 158 } },
      hands: { name: 'Palmwoven Gloves', dungeon: 'Empyrean Sands', stats: { haste: 100, expertise: 123 } },
      legs: { name: 'Unusual Leggings', dungeon: 'Urrak Markets', stats: { crit: 315, haste: 56 } },
      feet: { name: 'Ceremonial Shoes', dungeon: 'The Heart of Tuzari', stats: { haste: 143, spirit: 117 } },
      ring1: { name: 'Webbed Leaf Signet', dungeon: 'Silken Hollow', stats: { expertise: 80, spirit: 187 } },
      ring2: { name: 'Execration Ring', dungeon: 'The Heart of Tuzari', stats: { haste: 187, expertise: 80 } },
      relic1: { name: 'Sinbinding Stone', dungeon: 'Any Dungeon', stats: { haste: 120, expertise: 280 } },
      relic2: { name: 'Grimoire of Resurrection', dungeon: 'Any Dungeon', stats: { haste: 280, spirit: 120 } },
      weapon: { name: "Zeraleth's Scythe", dungeon: 'Any Dungeon', stats: { expertise: 200, spirit: 245 } }
    }
  },
  mara: {
    name: 'Mara',
    role: 'DPS',
    portrait: 'fellowship/mara.webp',
    gear: {
      head: { name: 'Oiled Leather Headscarf', dungeon: "Sailor's Abyss", stats: { crit: 50, haste: 284 } },
      neck: { name: 'Bonestiched Amulet', dungeon: 'Wraithtide Vault', stats: { crit: 257, haste: 210 } },
      shoulders: { name: 'Heavy Fur Mantle', dungeon: 'Ransack of Drakheim', stats: { crit: 89, expertise: 208 } },
      back: { name: 'Salt-Encrusted Cloak', dungeon: 'Ransack of Drakheim', stats: { crit: 84, spirit: 102 } },
      chest: { name: 'Wolfhide Tunic', dungeon: 'The Heart of Tuzari', stats: { crit: 123, spirit: 285 } },
      wrists: { name: "Sailor's Wristcharm", dungeon: "Sailor's Abyss", stats: { haste: 102, expertise: 84 } },
      hands: { name: 'Grips of the Wretched', dungeon: 'The Heart of Tuzari', stats: { crit: 100, expertise: 123 } },
      legs: { name: 'Bloodstained Legguards', dungeon: 'Urrak Markets', stats: { crit: 315, haste: 56 } },
      feet: { name: "Treads of Vexira's Prey", dungeon: 'Any Dungeon', stats: { crit: 78, expertise: 182 } },
      ring1: { name: 'Ancient Eldrin Loop', dungeon: 'Wyrmheart', stats: { haste: 227, spirit: 40 } },
      ring2: { name: 'Coral Coil', dungeon: "Sailor's Abyss", stats: { haste: 40, expertise: 227 } },
      relic1: { name: 'Sinbinding Stone', dungeon: 'Any Dungeon', stats: { haste: 120, expertise: 280 } },
      relic2: { name: 'Humming Portalstone', dungeon: 'Any Dungeon', stats: { crit: 60, expertise: 340 } },
      weapon: { name: 'Fateful Dagger', dungeon: 'Any Dungeon', stats: { expertise: 200, spirit: 245 } }
    }
  },
  elarion: {
    name: 'Elarion',
    role: 'DPS',
    portrait: 'fellowship/elarion.webp',
    gear: {
      head: { name: 'Spidersilk Cowl', dungeon: 'Silken Hollow', stats: { expertise: 150, spirit: 184 } },
      neck: { name: 'Amulet of Silken Chains', dungeon: 'Silken Hollow', stats: { crit: 397, expertise: 70 } },
      shoulders: { name: 'Tanned Mantle', dungeon: 'The Heart of Tuzari', stats: { haste: 208, spirit: 89 } },
      back: { name: "Desert Acolyte's Shroud", dungeon: 'Empyrean Sands', stats: { crit: 102, spirit: 84 } },
      chest: { name: 'Once Bloodied Tunic', dungeon: 'Wraithtide Vault', stats: { haste: 346, spirit: 62 } },
      wrists: { name: 'Hammered Bracelet of Eight', dungeon: 'Wraithtide Vault', stats: { crit: 28, haste: 158 } },
      hands: { name: 'Long Oiled Gloves', dungeon: 'Wraithtide Vault', stats: { crit: 156, spirit: 67 } },
      legs: { name: 'Insulated Hidepants', dungeon: "Cithrel's Fall", stats: { expertise: 56, spirit: 315 } },
      feet: { name: "Master Astronomer's Sabatons", dungeon: 'Any Dungeon', stats: { crit: 182, expertise: 78 } },
      ring1: { name: "Manhunter's Mark", dungeon: 'The Heart of Tuzari', stats: { haste: 187, expertise: 80 } },
      ring2: { name: 'Rubellite Focus', dungeon: "Cithrel's Fall", stats: { crit: 120, haste: 147 } },
      relic1: { name: 'Sinbinding Stone', dungeon: 'Any Dungeon', stats: { haste: 120, expertise: 280 } },
      relic2: { name: 'Saltwash Elixir', dungeon: 'Any Dungeon', stats: { crit: 120, haste: 280 } },
      weapon: { name: 'Void-touched Bow', dungeon: 'Any Dungeon', stats: { haste: 200, expertise: 245 } }
    }
  }
};

// Get item icon path for a character and slot
function getItemIconPath(charId, slotId) {
  // Map slot names to file names (shoulders -> shoulder in files)
  const slotFileMap = {
    'shoulders': 'shoulder',
    'head': 'head',
    'neck': 'neck',
    'back': 'back',
    'chest': 'chest',
    'wrists': 'wrists',
    'hands': 'hands',
    'legs': 'legs',
    'feet': 'feet',
    'ring1': 'ring1',
    'ring2': 'ring2',
    'relic1': 'relic1',
    'relic2': 'relic2',
    'weapon': 'weapon'
  };
  const fileSlot = slotFileMap[slotId] || slotId;
  return `fellowship/items/${charId}/${fileSlot}_${charId}.png`;
}

// Check if item is legendary
function isLegendarySlot(charId, slotId) {
  return legendarySlots[charId] && legendarySlots[charId].includes(slotId);
}

// Stat colors
const statColors = {
  crit: 'crit',
  haste: 'haste',
  expertise: 'expertise',
  spirit: 'spirit'
};

// Stat display names
const statNames = {
  crit: 'Critical Strike',
  haste: 'Haste',
  expertise: 'Expertise',
  spirit: 'Spirit'
};

// Slot display names
const slotDisplayNames = {
  head: 'Head',
  neck: 'Neck',
  shoulders: 'Shoulders',
  back: 'Back',
  chest: 'Chest',
  wrists: 'Wrists',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
  relic1: 'Relic 1',
  relic2: 'Relic 2',
  weapon: 'Weapon'
};

// ==================== TALENT DATA ====================
// Talent builds by level (General Build)
// Each level shows which talents have points at that level
const fellowshipTalentData = {
  helena: {
    name: 'Helena',
    role: 'Tank',
    talents: [
      // Row 1
      { id: 'the-best-defense', name: 'The Best Defense', icon: 'warmaster_shield_throw_3.png', row: 1, col: 1, maxPoints: 2 },
      { id: 'shield-mastery', name: 'Shield Mastery', icon: 'Tex_y_17_layered.png', row: 1, col: 2, maxPoints: 2 },
      { id: 'sword-board', name: 'Sword & Board', icon: 'T_Warmaster_ShieldSlam.png', row: 1, col: 3, maxPoints: 2 },
      // Row 2
      { id: 'reinforced-steel', name: 'Reinforced Steel', icon: 'Tex_armor_3_b.png', row: 2, col: 1, maxPoints: 1 },
      { id: 'guarded-veteran', name: 'Guarded Veteran', icon: 'T_Nhance_RPG_Fire_08_Yellow.png', row: 2, col: 2, maxPoints: 1 },
      { id: 'punishing-strikes', name: 'Punishing Strikes', icon: 'T_Warmaster_FatalBlow.png', row: 2, col: 3, maxPoints: 1 },
      // Row 3
      { id: 'aftershock', name: 'Aftershock', icon: 'T_Nhance_RPG_Arcane_36.png', row: 3, col: 1, maxPoints: 2 },
      { id: 'sharpened-blade', name: 'Sharpened Blade', icon: 'T_Warmaster_BleedStrike.png', row: 3, col: 2, maxPoints: 2 },
      { id: 'razor-shrapnel', name: 'Razor Shrapnel', icon: 'Tex_SpellBook06_48.png', row: 3, col: 3, maxPoints: 2 },
      // Row 4
      { id: 'high-command', name: 'High Command', icon: 'T_Nhance_RPG_Fire_05.png', row: 4, col: 1, maxPoints: 1 },
      { id: 'magic-ward', name: 'Magic Ward', icon: 'T_Arcane_Scroll.png', row: 4, col: 2, maxPoints: 1 },
      { id: 'skull-cracker', name: 'Skull Cracker', icon: 'T_Nhance_RPG_BloodCombat_01.png', row: 4, col: 3, maxPoints: 1 },
      // Row 5
      { id: 'second-wind', name: 'Second Wind', icon: 'T_Nhance_RPG_Energy_07.png', row: 5, col: 1, maxPoints: 3 },
      { id: 'martial-command', name: 'Martial Command', icon: 'T_Warmaster_Ultimate.png', row: 5, col: 2, maxPoints: 3 },
      { id: 'gleaming-shield', name: 'Gleaming Shield', icon: 'T_Nhance_RPG_Gold_05.png', row: 5, col: 3, maxPoints: 3 },
      // Row 6
      { id: 'front-line-defender', name: 'Front Line Defender', icon: 'warmaster_shields_up.png', row: 6, col: 1, maxPoints: 1 },
      { id: 'master-of-war', name: 'Master of War', icon: 'T_Nhance_RPG_Gold_03.png', row: 6, col: 2, maxPoints: 1 },
      { id: 'greater-shockwave', name: 'Greater Shockwave', icon: 'Barbarian3.png', row: 6, col: 3, maxPoints: 1 }
    ],
    levelBuilds: {
      2: { 'shield-mastery': 2 },
      3: { 'shield-mastery': 2, 'guarded-veteran': 1 },
      4: { 'shield-mastery': 2, 'high-command': 1, 'guarded-veteran': 1 },
      5: { 'sharpened-blade': 2, 'guarded-veteran': 1, 'magic-ward': 1, 'high-command': 1 },
      6: { 'guarded-veteran': 1, 'sharpened-blade': 2, 'high-command': 1, 'master-of-war': 1, 'front-line-defender': 1 },
      7: { 'guarded-veteran': 1, 'high-command': 1, 'gleaming-shield': 3, 'master-of-war': 1, 'front-line-defender': 1 },
      8: { 'reinforced-steel': 1, 'guarded-veteran': 1, 'high-command': 1, 'gleaming-shield': 3, 'master-of-war': 1, 'front-line-defender': 1 },
      9: { 'reinforced-steel': 1, 'guarded-veteran': 1, 'sharpened-blade': 2, 'high-command': 1, 'gleaming-shield': 3, 'front-line-defender': 1 },
      10: { 'reinforced-steel': 1, 'guarded-veteran': 1, 'sharpened-blade': 2, 'high-command': 1, 'gleaming-shield': 3, 'front-line-defender': 1, 'master-of-war': 1 },
      11: { 'reinforced-steel': 1, 'guarded-veteran': 1, 'sharpened-blade': 2, 'magic-ward': 1, 'high-command': 1, 'gleaming-shield': 3, 'master-of-war': 1, 'front-line-defender': 1 },
      12: { 'reinforced-steel': 1, 'guarded-veteran': 1, 'punishing-strikes': 1, 'sharpened-blade': 2, 'high-command': 1, 'skull-cracker': 1, 'gleaming-shield': 3, 'master-of-war': 1, 'front-line-defender': 1 },
      13: { 'shield-mastery': 2, 'reinforced-steel': 1, 'sharpened-blade': 2, 'high-command': 1, 'front-line-defender': 1, 'gleaming-shield': 3, 'second-wind': 3 }
    }
  },
  sylvie: {
    name: 'Sylvie',
    role: 'Healer',
    talents: [
      // Row 1
      { id: 'nettle-to-petal', name: 'Nettle to the Petal', icon: 'T_Mosse_Lifepetal.png', row: 1, col: 1, maxPoints: 2 },
      { id: 'synchronized-fluttering', name: 'Synchronized Fluttering', icon: 'Sylvie_AbilityIcon_03.png', row: 1, col: 2, maxPoints: 2 },
      { id: 'verdant-restoration', name: 'Verdant Restoration', icon: 'T_Nhance_RPG_Shadow_58.png', row: 1, col: 3, maxPoints: 2 },
      // Row 2
      { id: 'sprouting-nettles', name: 'Sprouting Nettles', icon: 'Sylvie_AbilityIcon_02.png', row: 2, col: 1, maxPoints: 1 },
      { id: 'natural-knowledge', name: 'Natural Knowledge', icon: 'Tex_blue_9.png', row: 2, col: 2, maxPoints: 1 },
      { id: 'trailing-restoration', name: 'Trailing Restoration', icon: 'T_ArcaneAid.png', row: 2, col: 3, maxPoints: 1 },
      // Row 3
      { id: 'symbiosis', name: 'Symbiosis', icon: 'T_Mosse_DoubleHeal.png', row: 3, col: 1, maxPoints: 2 },
      { id: 'will-of-nature', name: 'Will of Nature', icon: 'T_Icon_Fel_07.png', row: 3, col: 2, maxPoints: 2 },
      { id: 'rowdy-rootsap', name: 'Rowdy Rootsap', icon: 'T_Mosse_Rootheal.png', row: 3, col: 3, maxPoints: 2 },
      // Row 4
      { id: 'nurtured-haven', name: 'Nurtured Haven', icon: 'T_Mosse_LinkCD.png', row: 4, col: 1, maxPoints: 1 },
      { id: 'magic-ward', name: 'Magic Ward', icon: 'T_Arcane_Scroll.png', row: 4, col: 2, maxPoints: 1 },
      { id: 'blueys-gambit', name: "Bluey's Gambit", icon: 'T_Nhance_RPG_Elements_32.png', row: 4, col: 3, maxPoints: 1 },
      // Row 5
      { id: 'natural-protector', name: 'Natural Protector', icon: 'Druid17.png', row: 5, col: 1, maxPoints: 3 },
      { id: 'flutterswift', name: 'Flutterswift', icon: 'T_ArcaneWhirl.png', row: 5, col: 2, maxPoints: 3 },
      { id: 'flower-power', name: 'Flower Power', icon: 'T_Mosse_Bigheal.png', row: 5, col: 3, maxPoints: 3 },
      // Row 6
      { id: 'elusive-wildling', name: 'Elusive Wildling', icon: 'T_Mosse_Hide.png', row: 6, col: 1, maxPoints: 1 },
      { id: 'spirited-fortitude', name: 'Spirited Fortitude', icon: 'Barbarian3.png', row: 6, col: 2, maxPoints: 1 },
      { id: 'bloomin-boomshrooms', name: "Bloomin' Boomshrooms", icon: 'T_Mosse_Boomshroom.png', row: 6, col: 3, maxPoints: 1 }
    ],
    levelBuilds: {
      2: { 'nettle-to-petal': 2 },
      3: { 'nettle-to-petal': 2, 'natural-knowledge': 1 },
      4: { 'nettle-to-petal': 2, 'natural-knowledge': 1, 'trailing-restoration': 1 },
      5: { 'nettle-to-petal': 2, 'natural-knowledge': 1, 'verdant-restoration': 2 },
      6: { 'nettle-to-petal': 2, 'natural-knowledge': 1, 'verdant-restoration': 2, 'blueys-gambit': 1 },
      7: { 'nettle-to-petal': 2, 'natural-knowledge': 1, 'verdant-restoration': 2, 'blueys-gambit': 1, 'trailing-restoration': 1 },
      8: { 'nettle-to-petal': 2, 'natural-knowledge': 1, 'verdant-restoration': 2, 'blueys-gambit': 1, 'trailing-restoration': 1, 'elusive-wildling': 1 },
      9: { 'nettle-to-petal': 2, 'natural-knowledge': 1, 'verdant-restoration': 2, 'blueys-gambit': 1, 'flower-power': 3 },
      10: { 'nettle-to-petal': 2, 'natural-knowledge': 1, 'verdant-restoration': 2, 'blueys-gambit': 1, 'flower-power': 3, 'elusive-wildling': 1 },
      11: { 'nettle-to-petal': 2, 'natural-knowledge': 1, 'verdant-restoration': 2, 'blueys-gambit': 1, 'flower-power': 3, 'elusive-wildling': 1, 'magic-ward': 1 },
      12: { 'nettle-to-petal': 2, 'natural-knowledge': 1, 'verdant-restoration': 2, 'blueys-gambit': 1, 'flower-power': 3, 'elusive-wildling': 1, 'magic-ward': 1, 'spirited-fortitude': 1 },
      13: { 'nettle-to-petal': 2, 'natural-knowledge': 1, 'verdant-restoration': 2, 'blueys-gambit': 1, 'flower-power': 3, 'elusive-wildling': 1, 'magic-ward': 1, 'spirited-fortitude': 1, 'trailing-restoration': 1 }
    }
  },
  mara: {
    name: 'Mara',
    role: 'DPS',
    talents: [
      // Row 1
      { id: 'red-ledger', name: 'Red Ledger', icon: 'Mara_Bleed.png', row: 1, col: 1, maxPoints: 2 },
      { id: 'corrosive-spill', name: 'Corrosive Spill', icon: 'T_Icon_Unholy_197.png', row: 1, col: 2, maxPoints: 2 },
      { id: 'assassins-guile', name: "Assassin's Guile", icon: 'T_Icon_Shadow_121.png', row: 1, col: 3, maxPoints: 2 },
      // Row 2
      { id: 'bloodrush', name: 'Bloodrush', icon: 'T_Nhance_RPG_BloodCombat_24.png', row: 2, col: 1, maxPoints: 1 },
      { id: 'venomous-delight', name: 'Venomous Delight', icon: 'Tex_green_23.png', row: 2, col: 2, maxPoints: 1 },
      { id: 'efficient-killer', name: 'Efficient Killer', icon: 'T_ShadowStab.png', row: 2, col: 3, maxPoints: 1 },
      // Row 3
      { id: 'gushing-blood', name: 'Gushing Blood', icon: 'Berserker5.png', row: 3, col: 1, maxPoints: 2 },
      { id: 'feed-the-queen', name: 'Feed the Queen', icon: 'T_Nhance_RPG_Shadow_41.png', row: 3, col: 2, maxPoints: 2 },
      { id: 'deadly-scheme', name: 'Deadly Scheme', icon: 'Tex_SpellBook08_71.png', row: 3, col: 3, maxPoints: 2 },
      // Row 4
      { id: 'veil-of-shadows', name: 'Veil of Shadows', icon: 'Mara_Defensive.png', row: 4, col: 1, maxPoints: 1 },
      { id: 'maidens-doom', name: "Maiden's Doom", icon: 'Mara_Maiden.png', row: 4, col: 2, maxPoints: 1 },
      { id: 'magic-ward', name: 'Magic Ward', icon: 'T_Arcane_Scroll.png', row: 4, col: 3, maxPoints: 1 },
      // Row 5
      { id: 'from-the-shadows', name: 'From the Shadows', icon: 'T_Nhance_RPG_BloodCombat_23.png', row: 5, col: 1, maxPoints: 3 },
      { id: 'hemotoxin', name: 'Hemotoxin', icon: 'T_PoisonBlister.png', row: 5, col: 2, maxPoints: 3 },
      { id: 'malevolence', name: 'Malevolence', icon: 'Tex_violet_7.png', row: 5, col: 3, maxPoints: 3 },
      // Row 6
      { id: 'arachnid-onslaught', name: 'Arachnid Onslaught', icon: 'Mara_SpiderAOE.png', row: 6, col: 1, maxPoints: 1 },
      { id: 'spirited-fortitude', name: 'Spirited Fortitude', icon: 'Barbarian3.png', row: 6, col: 2, maxPoints: 1 },
      { id: 'puncture', name: 'Puncture', icon: 'Mara_RegainEnergyHit.png', row: 6, col: 3, maxPoints: 1 }
    ],
    levelBuilds: {
      2: { 'corrosive-spill': 2 },
      3: { 'corrosive-spill': 2, 'venomous-delight': 1 },
      4: { 'corrosive-spill': 2, 'venomous-delight': 1, 'efficient-killer': 1 },
      5: { 'corrosive-spill': 2, 'venomous-delight': 1, 'deadly-scheme': 2 },
      6: { 'corrosive-spill': 2, 'venomous-delight': 1, 'deadly-scheme': 2, 'efficient-killer': 1 },
      7: { 'corrosive-spill': 2, 'venomous-delight': 1, 'deadly-scheme': 2, 'assassins-guile': 2 },
      8: { 'corrosive-spill': 2, 'venomous-delight': 1, 'deadly-scheme': 2, 'hemotoxin': 3 },
      9: { 'hemotoxin': 3, 'bloodrush': 1, 'gushing-blood': 2, 'from-the-shadows': 3 },
      10: { 'hemotoxin': 3, 'bloodrush': 1, 'gushing-blood': 2, 'from-the-shadows': 3, 'puncture': 1 },
      11: { 'hemotoxin': 3, 'bloodrush': 1, 'gushing-blood': 2, 'from-the-shadows': 3, 'red-ledger': 2 },
      12: { 'hemotoxin': 3, 'bloodrush': 1, 'gushing-blood': 2, 'from-the-shadows': 3, 'red-ledger': 2, 'puncture': 1 },
      13: { 'hemotoxin': 3, 'bloodrush': 1, 'gushing-blood': 2, 'from-the-shadows': 3, 'red-ledger': 2, 'deadly-scheme': 2 }
    }
  },
  elarion: {
    name: 'Elarion',
    role: 'DPS',
    talents: [
      // Row 1
      { id: 'focused-expanse', name: 'Focused Expanse', icon: 'Bowguy_Multishot.png', row: 1, col: 1, maxPoints: 2 },
      { id: 'fusillade', name: 'Fusillade', icon: 'T_Icon_Energy_106.png', row: 1, col: 2, maxPoints: 2 },
      { id: 'final-crescendo', name: 'Final Crescendo', icon: 'Bowguy_Ricochet.png', row: 1, col: 3, maxPoints: 2 },
      // Row 2
      { id: 'skylit-grace', name: 'Skylit Grace', icon: 'Tex_b_03.png', row: 2, col: 1, maxPoints: 1 },
      { id: 'piercing-seekers', name: 'Piercing Seekers', icon: 'T_Nhance_RPG_Icons_SoulArrow.png', row: 2, col: 2, maxPoints: 1 },
      { id: 'skyward-munitions', name: 'Skyward Munitions', icon: 'Bowguy_Shot.png', row: 2, col: 3, maxPoints: 1 },
      // Row 3
      { id: 'repeating-stars', name: 'Repeating Stars', icon: 'Bowguy_Rain.png', row: 3, col: 1, maxPoints: 2 },
      { id: 'lunarlight-affinity', name: 'Lunarlight Affinity', icon: 'T_Icon_Energy_108.png', row: 3, col: 2, maxPoints: 2 },
      { id: 'lethal-shots', name: 'Lethal Shots', icon: 'Tex_arrow.png', row: 3, col: 3, maxPoints: 2 },
      // Row 4
      { id: 'path-of-twilight', name: 'Path of Twilight', icon: 'Bowguy_Abilityicon_Defensive.png', row: 4, col: 1, maxPoints: 1 },
      { id: 'lunar-fury', name: 'Lunar Fury', icon: 'Bowguy_Mark.png', row: 4, col: 2, maxPoints: 1 },
      { id: 'magic-ward', name: 'Magic Ward', icon: 'T_Arcane_Scroll.png', row: 4, col: 3, maxPoints: 1 },
      // Row 5
      { id: 'fervent-supremacy', name: 'Fervent Supremacy', icon: 'Bowguy_Supremacy.png', row: 5, col: 1, maxPoints: 3 },
      { id: 'impending-heartseeker', name: 'Impending Heartseeker', icon: 'Bowguy_Spray.png', row: 5, col: 2, maxPoints: 3 },
      { id: 'resurgent-winds', name: 'Resurgent Winds', icon: 'T_Icon_Tech_40.png', row: 5, col: 3, maxPoints: 3 },
      // Row 6
      { id: 'last-lights', name: 'Last Lights', icon: 'Tex_b_24.png', row: 6, col: 1, maxPoints: 1 },
      { id: 'spirited-fortitude', name: 'Spirited Fortitude', icon: 'Barbarian3.png', row: 6, col: 2, maxPoints: 1 },
      { id: 'weight-of-gravity', name: 'The Weight of Gravity', icon: 'Bowguy_GrappleShot.png', row: 6, col: 3, maxPoints: 1 }
    ],
    levelBuilds: {
      2: { 'final-crescendo': 2 },
      3: { 'final-crescendo': 2, 'skyward-munitions': 1 },
      4: { 'final-crescendo': 2, 'lethal-shots': 2 },
      5: { 'final-crescendo': 2, 'lethal-shots': 2, 'skyward-munitions': 1 },
      6: { 'final-crescendo': 2, 'lethal-shots': 2, 'skyward-munitions': 1, 'piercing-seekers': 1 },
      7: { 'final-crescendo': 2, 'lethal-shots': 2, 'skyward-munitions': 1, 'fusillade': 2 },
      8: { 'final-crescendo': 2, 'lethal-shots': 2, 'skyward-munitions': 1, 'fusillade': 2, 'piercing-seekers': 1 },
      9: { 'fusillade': 2, 'piercing-seekers': 1, 'fervent-supremacy': 3, 'impending-heartseeker': 3 },
      10: { 'fusillade': 2, 'piercing-seekers': 1, 'fervent-supremacy': 3, 'impending-heartseeker': 3, 'last-lights': 1 },
      11: { 'fusillade': 2, 'piercing-seekers': 1, 'fervent-supremacy': 3, 'impending-heartseeker': 3, 'repeating-stars': 2 },
      12: { 'fusillade': 2, 'piercing-seekers': 1, 'fervent-supremacy': 3, 'impending-heartseeker': 3, 'repeating-stars': 2, 'last-lights': 1 },
      13: { 'fusillade': 2, 'piercing-seekers': 1, 'fervent-supremacy': 3, 'impending-heartseeker': 3, 'repeating-stars': 2, 'last-lights': 1, 'skyward-munitions': 1 }
    }
  }
};

// Current talent level selection
let currentTalentLevel = 13;

// Edit mode state
let talentEditMode = false;
let editModeBuild = {}; // Temporary build being edited

// DOM elements
let fellowshipMenuScreen;
let fellowshipChoiceScreen;
let fellowshipGearScreen;
let fellowshipTalentScreen;
let fellowshipDungeonScreen;
let fellowshipTooltip;
let fellowshipDungeonTooltip;
let fellowshipTalentTooltip;
let currentCharacter = null;
let currentCharacterId = null;

// Track current hovered item for tooltip management
let currentHoveredSlot = null;

function initFellowship() {
  fellowshipMenuScreen = document.getElementById('fellowship-menu-screen');
  fellowshipChoiceScreen = document.getElementById('fellowship-choice-screen');
  fellowshipGearScreen = document.getElementById('fellowship-gear-screen');
  fellowshipTalentScreen = document.getElementById('fellowship-talent-screen');
  fellowshipDungeonScreen = document.getElementById('fellowship-dungeon-screen');
  fellowshipTooltip = document.getElementById('fellowship-tooltip');
  fellowshipDungeonTooltip = document.getElementById('fellowship-dungeon-tooltip');
  fellowshipTalentTooltip = document.getElementById('fellowship-talent-tooltip');

  if (!fellowshipMenuScreen) return;

  // Hub button
  const fellowshipBtn = document.getElementById('fellowship-btn');
  if (fellowshipBtn) {
    fellowshipBtn.addEventListener('click', () => {
      showFellowshipScreen('fellowship-menu-screen');
    });
  }

  // Back to hub button
  const backToHubBtn = document.getElementById('fellowship-back-to-hub-btn');
  if (backToHubBtn) {
    backToHubBtn.addEventListener('click', () => {
      showFellowshipScreen('hub-screen');
    });
  }

  // Back to characters button (from choice screen)
  const choiceBackBtn = document.getElementById('fellowship-choice-back-btn');
  if (choiceBackBtn) {
    choiceBackBtn.addEventListener('click', () => {
      showFellowshipScreen('fellowship-menu-screen');
    });
  }

  // Gear choice button
  const gearChoiceBtn = document.getElementById('fellowship-gear-choice-btn');
  if (gearChoiceBtn) {
    gearChoiceBtn.addEventListener('click', () => {
      if (currentCharacterId) {
        loadCharacterGear(currentCharacterId);
      }
    });
  }

  // Talent choice button
  const talentChoiceBtn = document.getElementById('fellowship-talent-choice-btn');
  if (talentChoiceBtn) {
    talentChoiceBtn.addEventListener('click', () => {
      if (currentCharacterId) {
        loadCharacterTalents(currentCharacterId);
      }
    });
  }

  // Back to choice button (from gear screen)
  const backToCharsBtn = document.getElementById('fellowship-back-to-chars-btn');
  if (backToCharsBtn) {
    backToCharsBtn.addEventListener('click', () => {
      if (currentCharacterId) {
        showCharacterChoice(currentCharacterId);
      } else {
        showFellowshipScreen('fellowship-menu-screen');
      }
    });
  }

  // Back to choice button (from talent screen)
  const talentBackBtn = document.getElementById('fellowship-talent-back-btn');
  if (talentBackBtn) {
    talentBackBtn.addEventListener('click', () => {
      if (currentCharacterId) {
        showCharacterChoice(currentCharacterId);
      } else {
        showFellowshipScreen('fellowship-menu-screen');
      }
    });
  }

  // Back to gear button (from dungeon screen)
  const dungeonBackBtn = document.getElementById('fellowship-dungeon-back-btn');
  if (dungeonBackBtn) {
    dungeonBackBtn.addEventListener('click', () => {
      if (currentCharacterId) {
        loadCharacterGear(currentCharacterId);
      } else {
        showFellowshipScreen('fellowship-menu-screen');
      }
    });
  }

  // Character buttons - now show choice screen
  const charButtons = document.querySelectorAll('.fellowship-char-btn');
  charButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const charId = btn.dataset.char;
      showCharacterChoice(charId);
    });
  });

  // Setup tooltip behavior
  setupTooltips();
}

// Show character choice screen (Gear vs Talents)
// Character comments
const characterComments = {
  helena: 'REASON GIGACHAD',
  sylvie: 'Ioseba marikon',
  mara: 'Garsi subnormal sin legendaria XD',
  elarion: 'Kinus dale al puto defensivo'
};

function showCharacterChoice(charId) {
  const charData = fellowshipGearData[charId];
  if (!charData) return;

  currentCharacterId = charId;
  currentCharacter = charData;

  // Update choice screen
  const titleSpan = document.getElementById('fellowship-choice-char-title');
  const portraitImg = document.getElementById('fellowship-choice-portrait-img');
  const nameSpan = document.getElementById('fellowship-choice-char-name');
  const commentSpan = document.getElementById('fellowship-choice-char-comment');

  if (titleSpan) titleSpan.textContent = charData.name;
  if (portraitImg) {
    portraitImg.src = charData.portrait;
    portraitImg.alt = charData.name;
  }
  if (nameSpan) nameSpan.textContent = charData.name;
  if (commentSpan) commentSpan.textContent = characterComments[charId] || '';

  showFellowshipScreen('fellowship-choice-screen');
}

// Load character talents
function loadCharacterTalents(charId) {
  const talentData = fellowshipTalentData[charId];
  const charData = fellowshipGearData[charId];
  if (!talentData || !charData) return;

  currentCharacterId = charId;

  // Update title
  const titleSpan = document.getElementById('fellowship-talent-char-title');
  if (titleSpan) titleSpan.textContent = charData.name;

  // Generate level buttons
  const levelButtonsContainer = document.getElementById('talent-level-buttons');
  if (levelButtonsContainer) {
    levelButtonsContainer.innerHTML = '';
    for (let level = 2; level <= 13; level++) {
      const btn = document.createElement('button');
      btn.className = 'talent-level-btn' + (level === currentTalentLevel ? ' active' : '');
      btn.textContent = level;
      btn.dataset.level = level;
      btn.addEventListener('click', () => {
        // Save current edit if in edit mode before switching levels
        if (talentEditMode) {
          saveTempBuild(charId);
        }
        currentTalentLevel = level;
        document.querySelectorAll('.talent-level-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Load the build for this level into edit mode if editing
        if (talentEditMode) {
          editModeBuild = { ...(fellowshipTalentData[charId].levelBuilds[level] || {}) };
        }
        renderTalentTree(charId);
      });
      levelButtonsContainer.appendChild(btn);
    }
  }

  // Add edit mode controls if not already present
  setupEditModeControls(charId);

  // Render talent tree
  renderTalentTree(charId);

  showFellowshipScreen('fellowship-talent-screen');
}

// Render talent tree for current level
function renderTalentTree(charId) {
  const talentData = fellowshipTalentData[charId];
  if (!talentData) return;

  const treeContainer = document.getElementById('fellowship-talent-tree');
  if (!treeContainer) return;

  // Use edit mode build if in edit mode, otherwise use saved build
  const levelBuild = talentEditMode ? editModeBuild : (talentData.levelBuilds[currentTalentLevel] || {});
  const totalPoints = Object.values(levelBuild).reduce((sum, pts) => sum + pts, 0);

  // Update points display
  const pointsUsed = document.getElementById('fellowship-talent-points-used');
  const pointsTotal = document.getElementById('fellowship-talent-points-total');
  if (pointsUsed) pointsUsed.textContent = totalPoints;
  if (pointsTotal) pointsTotal.textContent = currentTalentLevel;

  // Update edit mode indicator class on tree container
  if (talentEditMode) {
    treeContainer.classList.add('edit-mode');
  } else {
    treeContainer.classList.remove('edit-mode');
  }

  // Group talents by row
  const talentsByRow = {};
  talentData.talents.forEach(talent => {
    if (!talentsByRow[talent.row]) {
      talentsByRow[talent.row] = [];
    }
    talentsByRow[talent.row].push(talent);
  });

  // Render tree
  treeContainer.innerHTML = '';

  Object.keys(talentsByRow).sort((a, b) => a - b).forEach(rowNum => {
    const rowTalents = talentsByRow[rowNum].sort((a, b) => a.col - b.col);
    const rowDiv = document.createElement('div');
    rowDiv.className = 'talent-row';

    rowTalents.forEach(talent => {
      const points = levelBuild[talent.id] || 0;
      const isActive = points > 0;

      const talentDiv = document.createElement('div');
      talentDiv.className = 'talent-node' + (isActive ? ' active' : ' inactive');
      if (talentEditMode) {
        talentDiv.classList.add('editable');
      }
      talentDiv.dataset.talentId = talent.id;

      // Icon - use local files
      const iconUrl = `fellowship/talents/${talent.icon}`;
      talentDiv.innerHTML = `
        <div class="talent-icon-wrapper">
          <img class="talent-icon" src="${iconUrl}" alt="${talent.name}" onerror="this.src='fellowship/talent-placeholder.png'">
          <span class="talent-points ${isActive ? '' : 'hidden'}">${points}/${talent.maxPoints}</span>
        </div>
        <div class="talent-name">${talent.name}</div>
      `;

      // Talent tooltip removed - user requested removal as it's not useful

      // Click handler for edit mode
      talentDiv.addEventListener('click', () => {
        handleTalentClick(charId, talent.id, talent.maxPoints);
      });

      // Right-click to remove points
      talentDiv.addEventListener('contextmenu', (e) => {
        handleTalentRightClick(charId, talent.id, talent.maxPoints, e);
      });

      rowDiv.appendChild(talentDiv);
    });

    treeContainer.appendChild(rowDiv);
  });
}

function showTalentTooltip(talent, points, e) {
  if (!fellowshipTalentTooltip) return;

  const nameEl = fellowshipTalentTooltip.querySelector('.fellowship-tooltip-name');
  const descEl = fellowshipTalentTooltip.querySelector('.fellowship-tooltip-desc');

  if (nameEl) {
    nameEl.textContent = talent.name;
    nameEl.className = 'fellowship-tooltip-name' + (points > 0 ? ' active' : '');
  }
  if (descEl) {
    descEl.textContent = `${points}/${talent.maxPoints} puntos`;
  }

  positionTooltip(e, fellowshipTalentTooltip);
  fellowshipTalentTooltip.classList.add('visible');
}

function hideTalentTooltip() {
  if (fellowshipTalentTooltip) {
    fellowshipTalentTooltip.classList.remove('visible');
  }
}

// Setup edit mode controls
function setupEditModeControls(charId) {
  const talentScreen = document.getElementById('fellowship-talent-screen');
  if (!talentScreen) return;

  // Check if controls already exist
  let controlsContainer = document.getElementById('talent-edit-controls');
  if (!controlsContainer) {
    controlsContainer = document.createElement('div');
    controlsContainer.id = 'talent-edit-controls';
    controlsContainer.className = 'talent-edit-controls';

    // Insert after the points display
    const pointsDisplay = talentScreen.querySelector('.talent-points-display');
    if (pointsDisplay) {
      pointsDisplay.parentNode.insertBefore(controlsContainer, pointsDisplay.nextSibling);
    } else {
      const talentTree = document.getElementById('fellowship-talent-tree');
      if (talentTree) {
        talentTree.parentNode.insertBefore(controlsContainer, talentTree);
      }
    }
  }

  // Render controls
  controlsContainer.innerHTML = `
    <button id="talent-edit-toggle" class="talent-edit-btn ${talentEditMode ? 'active' : ''}">
      ${talentEditMode ? 'Exit Edit Mode' : 'Edit Mode'}
    </button>
    ${talentEditMode ? `
      <button id="talent-clear-btn" class="talent-edit-btn clear">Clear Level</button>
      <button id="talent-copy-btn" class="talent-edit-btn copy">Copy from Prev</button>
      <button id="talent-export-btn" class="talent-edit-btn export">Export All Builds</button>
    ` : ''}
  `;

  // Setup event listeners
  const toggleBtn = document.getElementById('talent-edit-toggle');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      talentEditMode = !talentEditMode;
      if (talentEditMode) {
        // Enter edit mode - load current build
        editModeBuild = { ...(fellowshipTalentData[charId].levelBuilds[currentTalentLevel] || {}) };
      } else {
        // Exit edit mode - save changes
        saveTempBuild(charId);
        editModeBuild = {};
      }
      setupEditModeControls(charId);
      renderTalentTree(charId);
    };
  }

  const clearBtn = document.getElementById('talent-clear-btn');
  if (clearBtn) {
    clearBtn.onclick = () => {
      editModeBuild = {};
      renderTalentTree(charId);
    };
  }

  const copyBtn = document.getElementById('talent-copy-btn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      if (currentTalentLevel > 2) {
        const prevBuild = fellowshipTalentData[charId].levelBuilds[currentTalentLevel - 1] || {};
        editModeBuild = { ...prevBuild };
        renderTalentTree(charId);
      }
    };
  }

  const exportBtn = document.getElementById('talent-export-btn');
  if (exportBtn) {
    exportBtn.onclick = () => {
      exportAllBuilds(charId);
    };
  }
}

// Save temporary build to character data
function saveTempBuild(charId) {
  if (!fellowshipTalentData[charId]) return;

  // Clean up empty entries
  const cleanBuild = {};
  Object.keys(editModeBuild).forEach(key => {
    if (editModeBuild[key] > 0) {
      cleanBuild[key] = editModeBuild[key];
    }
  });

  fellowshipTalentData[charId].levelBuilds[currentTalentLevel] = cleanBuild;
}

// Export all builds as JSON
function exportAllBuilds(charId) {
  if (!fellowshipTalentData[charId]) return;

  // Save current edit first
  saveTempBuild(charId);

  const buildsJson = JSON.stringify(fellowshipTalentData[charId].levelBuilds, null, 2);

  // Create modal to show the JSON
  let modal = document.getElementById('talent-export-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'talent-export-modal';
    modal.className = 'talent-export-modal';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="talent-export-content">
      <h3>${fellowshipTalentData[charId].name} - Level Builds</h3>
      <textarea id="talent-export-text" readonly>${buildsJson}</textarea>
      <div class="talent-export-buttons">
        <button id="talent-copy-json" class="talent-edit-btn copy">Copy to Clipboard</button>
        <button id="talent-close-modal" class="talent-edit-btn">Close</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  document.getElementById('talent-copy-json').onclick = () => {
    const textarea = document.getElementById('talent-export-text');
    textarea.select();
    document.execCommand('copy');
    alert('Copied to clipboard');
  };

  document.getElementById('talent-close-modal').onclick = () => {
    modal.style.display = 'none';
  };

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };
}

// Handle talent click in edit mode
function handleTalentClick(charId, talentId, maxPoints) {
  if (!talentEditMode) return;

  const currentPoints = editModeBuild[talentId] || 0;
  const newPoints = (currentPoints + 1) % (maxPoints + 1); // Cycle: 0 -> 1 -> 2 -> ... -> maxPoints -> 0

  if (newPoints === 0) {
    delete editModeBuild[talentId];
  } else {
    editModeBuild[talentId] = newPoints;
  }

  // Check if total points exceed level limit
  const totalPoints = Object.values(editModeBuild).reduce((sum, pts) => sum + pts, 0);
  if (totalPoints > currentTalentLevel) {
    // Revert the change
    if (currentPoints === 0) {
      delete editModeBuild[talentId];
    } else {
      editModeBuild[talentId] = currentPoints;
    }
    return;
  }

  renderTalentTree(charId);
}

// Handle right-click to remove points
function handleTalentRightClick(charId, talentId, maxPoints, e) {
  e.preventDefault();
  if (!talentEditMode) return;

  const currentPoints = editModeBuild[talentId] || 0;
  if (currentPoints > 0) {
    const newPoints = currentPoints - 1;
    if (newPoints === 0) {
      delete editModeBuild[talentId];
    } else {
      editModeBuild[talentId] = newPoints;
    }
    renderTalentTree(charId);
  }
}

function showFellowshipScreen(screenId) {
  // Hide any visible tooltips when changing screens
  hideAllTooltips();

  // Hide all screens
  document.querySelectorAll('.screen-container').forEach(screen => {
    screen.classList.remove('active');
  });

  // Show target screen
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }
}

function loadCharacterGear(charId) {
  const charData = fellowshipGearData[charId];
  if (!charData) return;

  currentCharacter = charData;
  currentCharacterId = charId;

  // Update header
  const titleSpan = document.getElementById('fellowship-char-title');
  const portraitImg = document.getElementById('fellowship-current-portrait');
  const nameSpan = document.getElementById('fellowship-current-name');

  if (titleSpan) titleSpan.textContent = charData.name;
  if (portraitImg) {
    portraitImg.src = charData.portrait;
    portraitImg.alt = charData.name;
  }
  if (nameSpan) nameSpan.textContent = charData.name;

  // Populate gear slots and attach tooltips directly
  Object.keys(charData.gear).forEach(slotId => {
    const item = charData.gear[slotId];
    const slotElement = document.getElementById(`slot-${slotId}`);
    // Get the parent .fellowship-slot wrapper for the tooltip listener
    const slotWrapper = slotElement ? slotElement.closest('.fellowship-slot') : null;

    if (slotElement && slotWrapper) {
      const slotType = slotId.replace(/[0-9]/g, '');
      const iconPath = getItemIconPath(charId, slotId);
      const isLegendary = isLegendarySlot(charId, slotId);
      const dungeonDesc = dungeonDescriptions[item.dungeon] || item.dungeon;

      slotElement.innerHTML = `
        <div class="fellowship-item-icon ${slotType}"><img src="${iconPath}" alt="${item.name}"></div>
        <div class="fellowship-item-info">
          <div class="fellowship-item-name ${isLegendary ? 'legendary' : ''}">${item.name}</div>
          <div class="fellowship-item-dungeon">${dungeonDesc}</div>
        </div>
      `;
      slotElement.dataset.slot = slotId;

      // Store item data on the wrapper
      slotWrapper._itemData = item;
      slotWrapper._isLegendary = isLegendary;

      // Add tooltip listeners directly to this element (like Arc Raiders does)
      // Use onX handlers so they replace previous handlers on each load
      slotWrapper.onmouseenter = (e) => {
        showGearTooltip(item, e, isLegendary);
      };
      slotWrapper.onmouseleave = hideGearTooltip;
      slotWrapper.onmousemove = moveGearTooltip;
    }
  });

  // Setup Por Mazmorras button for this character
  const dungeonBtn = document.getElementById('fellowship-dungeon-btn');
  if (dungeonBtn) {
    dungeonBtn.onclick = () => loadDungeonViewForCharacter(charId);
  }

  showFellowshipScreen('fellowship-gear-screen');
}

function loadDungeonViewForCharacter(charId) {
  const charData = fellowshipGearData[charId];
  if (!charData) return;

  // Group items by dungeon for this character
  const dungeonItems = {};

  Object.keys(charData.gear).forEach(slotId => {
    const item = charData.gear[slotId];
    const dungeon = item.dungeon;

    if (!dungeonItems[dungeon]) {
      dungeonItems[dungeon] = [];
    }

    dungeonItems[dungeon].push({
      name: item.name,
      slot: slotId,
      stats: item.stats,
      dungeon: dungeon,
      isLegendary: isLegendarySlot(charId, slotId)
    });
  });

  // Sort dungeons (put "Any Dungeon" last)
  const sortedDungeons = Object.keys(dungeonItems).sort((a, b) => {
    if (a === 'Any Dungeon') return 1;
    if (b === 'Any Dungeon') return -1;
    return a.localeCompare(b);
  });

  // Update title
  const titleEl = document.querySelector('#fellowship-dungeon-screen .title-bar-text');
  if (titleEl) titleEl.textContent = `Fellowship BiS - ${charData.name} - Por Mazmorras`;

  // Render dungeon list
  const dungeonList = document.getElementById('fellowship-dungeon-list');
  if (!dungeonList) return;

  // Clear and rebuild dungeon list
  dungeonList.innerHTML = '';

  sortedDungeons.forEach(dungeon => {
    const items = dungeonItems[dungeon];
    const dungeonDesc = dungeonDescriptions[dungeon] || '';
    const itemCount = items.length;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'fellowship-dungeon-group';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'fellowship-dungeon-header';
    headerDiv.innerHTML = `
      <span class="fellowship-dungeon-name">${dungeon}</span>
      ${dungeonDesc ? `<span class="fellowship-dungeon-desc">(${dungeonDesc})</span>` : ''}
      <span class="fellowship-dungeon-count">${itemCount} item${itemCount > 1 ? 's' : ''}</span>
    `;
    groupDiv.appendChild(headerDiv);

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'fellowship-dungeon-items';

    items.forEach(item => {
      const slotType = item.slot.replace(/[0-9]/g, '');
      const slotLabel = slotDisplayNames[item.slot] || item.slot;
      const iconPath = getItemIconPath(charId, item.slot);
      const statsHtml = Object.keys(item.stats).map(stat => {
        return `${statNames[stat]}: +${item.stats[stat]}`;
      }).join(', ');

      const itemDiv = document.createElement('div');
      itemDiv.className = 'fellowship-dungeon-item';
      itemDiv.innerHTML = `
        <div class="fellowship-dungeon-item-icon ${slotType}"><img src="${iconPath}" alt="${item.name}"></div>
        <div class="fellowship-dungeon-item-info">
          <div class="fellowship-dungeon-item-row">
            <span class="fellowship-dungeon-item-slot ${slotType}">${slotLabel}:</span>
            <span class="fellowship-dungeon-item-name ${item.isLegendary ? 'legendary' : ''}">${item.name}</span>
          </div>
          <div class="fellowship-dungeon-item-stats">${statsHtml}</div>
        </div>
      `;

      // Store item data on element
      itemDiv._itemData = item;

      // Add tooltip listeners directly (like Arc Raiders does)
      itemDiv.onmouseenter = (e) => {
        showDungeonItemTooltip(item, e);
      };
      itemDiv.onmouseleave = hideDungeonTooltip;
      itemDiv.onmousemove = moveDungeonTooltip;

      itemsDiv.appendChild(itemDiv);
    });

    groupDiv.appendChild(itemsDiv);
    dungeonList.appendChild(groupDiv);
  });

  showFellowshipScreen('fellowship-dungeon-screen');
}

function setupTooltips() {
  // No global event delegation needed - listeners are added directly to elements
  // in loadCharacterGear() and loadDungeonViewForCharacter()
  // This matches how Arc Raiders does it
}

function hideAllTooltips() {
  hideTooltip(fellowshipTooltip);
  hideTooltip(fellowshipDungeonTooltip);
  hideTooltip(fellowshipTalentTooltip);
  currentHoveredSlot = null;
}

// Simple tooltip functions like Arc Raiders uses
function hideGearTooltip() {
  if (fellowshipTooltip) {
    fellowshipTooltip.classList.remove('visible');
  }
}

function moveGearTooltip(e) {
  if (!fellowshipTooltip || !fellowshipTooltip.classList.contains('visible')) return;
  positionTooltip(e, fellowshipTooltip);
}

function hideDungeonTooltip() {
  if (fellowshipDungeonTooltip) {
    fellowshipDungeonTooltip.classList.remove('visible');
  }
}

function moveDungeonTooltip(e) {
  if (!fellowshipDungeonTooltip || !fellowshipDungeonTooltip.classList.contains('visible')) return;
  positionTooltip(e, fellowshipDungeonTooltip);
}

// Show gear tooltip with item stats, dungeon location, and effects
function showGearTooltip(item, e, isLegendary) {
  if (!fellowshipTooltip || !item) return;

  // Build tooltip content
  const nameEl = fellowshipTooltip.querySelector('.fellowship-tooltip-name');
  const statsEl = fellowshipTooltip.querySelector('.fellowship-tooltip-stats');
  const dungeonEl = fellowshipTooltip.querySelector('.fellowship-tooltip-dungeon');

  // Create or get effect element
  let effectEl = fellowshipTooltip.querySelector('.fellowship-tooltip-effect');
  if (!effectEl) {
    effectEl = document.createElement('div');
    effectEl.className = 'fellowship-tooltip-effect';
    fellowshipTooltip.appendChild(effectEl);
  }

  // Item name
  if (nameEl) {
    nameEl.textContent = item.name;
    nameEl.className = 'fellowship-tooltip-name' + (isLegendary ? ' legendary' : '');
  }

  // Item stats
  if (statsEl && item.stats) {
    let statsHtml = '';
    Object.keys(item.stats).forEach(stat => {
      const colorClass = statColors[stat] || '';
      statsHtml += `
        <div class="fellowship-tooltip-stat">
          <span class="fellowship-tooltip-stat-name">${statNames[stat]}:</span>
          <span class="fellowship-tooltip-stat-value ${colorClass}">+${item.stats[stat]}</span>
        </div>
      `;
    });
    statsEl.innerHTML = statsHtml;
  }

  // Dungeon location
  if (dungeonEl) {
    const dungeonName = item.dungeon || '';
    if (dungeonName) {
      const dungeonDesc = dungeonDescriptions[dungeonName] || '';
      dungeonEl.innerHTML = `
        <div class="fellowship-tooltip-dungeon-label">Ubicación:</div>
        <div class="fellowship-tooltip-dungeon-name">${dungeonName}</div>
        ${dungeonDesc ? `<div class="fellowship-tooltip-dungeon-desc">(${dungeonDesc})</div>` : ''}
      `;
      dungeonEl.style.display = '';
    } else {
      dungeonEl.style.display = 'none';
    }
  }

  // Special effect for legendaries/weapons
  const effect = itemEffects[item.name];
  if (effect) {
    effectEl.innerHTML = `
      <div class="fellowship-tooltip-effect-name">${effect.effectName}</div>
      <div class="fellowship-tooltip-effect-desc">${effect.effect}</div>
    `;
    effectEl.style.display = '';
  } else {
    effectEl.style.display = 'none';
  }

  // Position and show
  positionTooltip(e, fellowshipTooltip);
  fellowshipTooltip.classList.add('visible');
}

// Show dungeon item tooltip with stats, location, and effects
function showDungeonItemTooltip(item, e) {
  if (!fellowshipDungeonTooltip || !item) return;

  const isLegendary = item.isLegendary || false;

  // Build tooltip content
  const nameEl = fellowshipDungeonTooltip.querySelector('.fellowship-tooltip-name');
  const statsEl = fellowshipDungeonTooltip.querySelector('.fellowship-tooltip-stats');
  const dungeonEl = fellowshipDungeonTooltip.querySelector('.fellowship-tooltip-dungeon');

  // Create or get effect element
  let effectEl = fellowshipDungeonTooltip.querySelector('.fellowship-tooltip-effect');
  if (!effectEl) {
    effectEl = document.createElement('div');
    effectEl.className = 'fellowship-tooltip-effect';
    fellowshipDungeonTooltip.appendChild(effectEl);
  }

  // Item name
  if (nameEl) {
    nameEl.textContent = item.name;
    nameEl.className = 'fellowship-tooltip-name' + (isLegendary ? ' legendary' : '');
  }

  // Item stats
  if (statsEl && item.stats) {
    let statsHtml = '';
    Object.keys(item.stats).forEach(stat => {
      const colorClass = statColors[stat] || '';
      statsHtml += `
        <div class="fellowship-tooltip-stat">
          <span class="fellowship-tooltip-stat-name">${statNames[stat]}:</span>
          <span class="fellowship-tooltip-stat-value ${colorClass}">+${item.stats[stat]}</span>
        </div>
      `;
    });
    statsEl.innerHTML = statsHtml;
  }

  // Dungeon location
  if (dungeonEl) {
    const dungeonName = item.dungeon || '';
    if (dungeonName) {
      const dungeonDesc = dungeonDescriptions[dungeonName] || '';
      dungeonEl.innerHTML = `
        <div class="fellowship-tooltip-dungeon-label">Ubicación:</div>
        <div class="fellowship-tooltip-dungeon-name">${dungeonName}</div>
        ${dungeonDesc ? `<div class="fellowship-tooltip-dungeon-desc">(${dungeonDesc})</div>` : ''}
      `;
      dungeonEl.style.display = '';
    } else {
      dungeonEl.style.display = 'none';
    }
  }

  // Special effect for legendaries/weapons
  const effect = itemEffects[item.name];
  if (effect) {
    effectEl.innerHTML = `
      <div class="fellowship-tooltip-effect-name">${effect.effectName}</div>
      <div class="fellowship-tooltip-effect-desc">${effect.effect}</div>
    `;
    effectEl.style.display = '';
  } else {
    effectEl.style.display = 'none';
  }

  // Position and show
  positionTooltip(e, fellowshipDungeonTooltip);
  fellowshipDungeonTooltip.classList.add('visible');
}

function hideTooltip(tooltip) {
  if (tooltip) {
    tooltip.classList.remove('visible');
  }
}

function positionTooltip(e, tooltip) {
  if (!tooltip) return;

  const padding = 15;
  let x = e.clientX + padding;
  let y = e.clientY + padding;

  // Keep tooltip within viewport
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (x + tooltipRect.width > viewportWidth) {
    x = e.clientX - tooltipRect.width - padding;
  }
  if (y + tooltipRect.height > viewportHeight) {
    y = e.clientY - tooltipRect.height - padding;
  }

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initFellowship);
