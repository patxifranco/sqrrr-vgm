/**
 * SQRRRDLE Game
 * Daily word guessing game with gaming-themed words
 * Progress syncs across devices via server
 * Supports 5 and 6 letter words
 */

// Word list - famous game characters, games, and gaming terms only
const WORDS = [
  // Friends (Custom) - 5 letters
  'GARSI', 'KINUS', 'MOMIN', 'JESUS', 'KELMI', 'ASIER',

  // ===== 5-LETTER WORDS =====
  // LOL Champions (5 letters)
  'TEEMO', 'VAYNE', 'RIVEN', 'BRAND', 'NASUS', 'YASUO', 'SENNA', 'KAYLE',
  'TALON', 'DIANA', 'LEONA', 'JANNA', 'ANNIE', 'FIORA', 'JAYCE', 'AKALI',
  'KARMA', 'ZIGGS', 'QUINN', 'BRAUM', 'SYLAS', 'YUUMI', 'GAREN', 'VIEGO',
  'VARUS', 'URGOT', 'POPPY', 'ELISE', 'SWAIN', 'SHACO', 'TARIC', 'SIVIR',
  'CORKI', 'AMUMU', 'GALIO', 'IVERN', 'MILIO', 'NEEKO', 'NILAH', 'RAKAN',
  'XAYAH', 'NASUS', 'VEIGAR',

  // Overwatch (5 letters)
  'GENJI', 'HANZO', 'MERCY', 'ZARYA', 'SIGMA', 'LUCIO', 'ORISA', 'MOIRA',

  // Nintendo (5 letters)
  'MARIO', 'LUIGI', 'ZELDA', 'KIRBY', 'WARIO', 'PEACH', 'YOSHI', 'SAMUS',
  'GANON', 'KOOPA', 'DAISY', 'DIDDY', 'FALCO', 'SHULK', 'MARTH', 'ROBIN',
  'CHROM', 'LUCAS', 'EPONA', 'MIDNA', 'MIPHA', 'DARUK', 'SIDON',

  // Pokemon (5 letters)
  'PICHU', 'EEVEE', 'DITTO', 'ZUBAT', 'RALTS', 'SHINX', 'LUXIO', 'ZORUA',
  'LUGIA', 'ENTEI', 'ABSOL', 'ARBOK', 'EKANS', 'ABRA',

  // Sonic (5 letters)
  'SONIC', 'TAILS', 'ROUGE', 'BLAZE', 'METAL', 'KNUCKLES',

  // Final Fantasy (5 letters)
  'CLOUD', 'TIDUS', 'AURON', 'AERIS', 'SQUALL',

  // Street Fighter / Fighting Games (5 letters)
  'GUILE', 'CAMMY', 'SAGAT', 'BISON', 'AKUMA', 'IBUKI', 'KARIN',
  'SONYA', 'ERMAC', 'ASUKA', 'ALISA', 'BRYAN',

  // Other Famous Game Characters (5 letters)
  'SNAKE', 'CRASH', 'SPYRO', 'DANTE', 'STEVE', 'JOKER', 'ELLIE',
  'CHIEF', 'QUIET', 'SOLID', 'LARA',

  // Game Names (5 letters)
  'HADES', 'BRAWL', 'SMASH', 'LIMBO', 'FORZA', 'GEARS', 'FABLE',
  'OKAMI', 'STRAY', 'TUNIC', 'BRAID', 'ISAAC', 'AMONG',

  // Gaming Terms (5 letters)
  'COMBO', 'SPAWN', 'BONUS', 'LEVEL', 'ARMOR', 'SKILL', 'LOBBY',
  'KILLS', 'SWORD', 'MAGIC', 'HEALS', 'MAINS', 'PATCH', 'RANKS', 'STATS',
  'BUILD', 'FLASH', 'GHOST', 'SMITE', 'BARON', 'DRAKE', 'NEXUS', 'GAMER',
  'TOWER', 'CARRY', 'CHAMP', 'ITEMS', 'RESET',

  // ===== 6-LETTER WORDS =====
  // LOL Champions (6 letters)
  'THRESH', 'VIKTOR', 'ANIVIA', 'ZILEAN', 'SINGED', 'RAMMUS', 'GRAVES',
  'IRELIA', 'EZREAL', 'SORAKA', 'DRAVEN', 'RENGAR', 'RUMBLE', 'KENNEN',
  'TWITCH', 'VEIGAR', 'XERATH', 'KASSADIN',

  // Overwatch (6 letters)
  'TRACER', 'REAPER', 'SOMBRA', 'PHARAH', 'TORBJORN',

  // Nintendo (6 letters)
  'BOWSER', 'FALCON', 'TINGLE', 'URBOSA', 'REVALI', 'OLIMAR', 'PIKMIN',
  'BYLETH', 'MYTHRA', 'RIDLEY',

  // Pokemon (6 letters)
  'GENGAR', 'MEWTWO', 'ARCEUS', 'VULPIX', 'MUDKIP', 'GASTLY', 'MEOWTH',
  'LAPRAS', 'CELEBI', 'KYOGRE', 'DIALGA', 'PALKIA', 'WOBBUFFET',

  // Final Fantasy / JRPG (6 letters)
  'NOCTIS', 'SEPHIROTH',

  // Street Fighter / Fighting Games (6 letters)
  'BLANKA', 'BALROG', 'SAKURA', 'RASHID', 'JOHNNY', 'KITANA', 'BARAKA',
  'KAZUYA', 'RAIDEN',

  // Other Famous Game Characters (6 letters)
  'KRATOS', 'NATHAN', 'TREVOR', 'ARTHUR', 'GERALT', 'OCELOT', 'LIQUID',
  'MASTER', 'CORTANA',

  // Game Names (6 letters)
  'PORTAL', 'TETRIS', 'SKYRIM', 'DIABLO', 'SEKIRO', 'HITMAN', 'ROBLOX',
  'RAYMAN', 'TEKKEN', 'LEAGUE', 'YAKUZA', 'HOLLOW', 'ROCKET', 'INSIDE',
  'TARKOV', 'ANTHEM',

  // Gaming Terms (6 letters)
  'DAMAGE', 'SHIELD', 'HEALTH', 'MINION', 'CREEPS', 'RANKED', 'JUNGLE',
];

// Filter to only valid 5 and 6 letter words
const WORDS_CLEAN = WORDS.filter(w => w.length === 5 || w.length === 6);

// Extended valid guesses - common words players might try
const VALID_GUESSES = new Set([
  ...WORDS_CLEAN,
  // Common 5-letter words
  'ABOUT', 'ABOVE', 'ABUSE', 'ACTOR', 'ACUTE', 'ADMIT', 'ADOPT', 'ADULT',
  'AFTER', 'AGAIN', 'AGENT', 'AGREE', 'AHEAD', 'ALARM', 'ALBUM', 'ALERT',
  'ALIKE', 'ALIVE', 'ALLOW', 'ALONE', 'ALONG', 'ALTER', 'AMONG', 'ANGER',
  'ANGLE', 'ANGRY', 'APART', 'APPLE', 'APPLY', 'ARENA', 'ARGUE', 'ARISE',
  'ARRAY', 'ASIDE', 'ASSET', 'AVOID', 'AWARD', 'AWARE', 'AWFUL', 'BASIC',
  'BASIS', 'BEACH', 'BEGAN', 'BEGIN', 'BEGUN', 'BEING', 'BELOW', 'BENCH',
  'BILLY', 'BIRTH', 'BLACK', 'BLADE', 'BLAME', 'BLANK', 'BLAST', 'BLEND',
  'BLESS', 'BLIND', 'BLOCK', 'BLOOD', 'BLOWN', 'BOARD', 'BOOST', 'BOOTH',
  'BOUND', 'BRAIN', 'BRAND', 'BRASS', 'BRAVE', 'BREAD', 'BREAK', 'BREED',
  'BRICK', 'BRIEF', 'BRING', 'BROAD', 'BROKE', 'BROWN', 'BUILD', 'BUILT',
  'BUYER', 'CABLE', 'CALIF', 'CARRY', 'CATCH', 'CAUSE', 'CHAIN', 'CHAIR',
  'CHAOS', 'CHARM', 'CHART', 'CHASE', 'CHEAP', 'CHECK', 'CHEST', 'CHIEF',
  'CHILD', 'CHINA', 'CHOSE', 'CIVIL', 'CLAIM', 'CLASS', 'CLEAN', 'CLEAR',
  'CLIMB', 'CLOCK', 'CLOSE', 'COACH', 'COAST', 'COULD', 'COUNT', 'COURT',
  'COVER', 'CRAFT', 'CRASH', 'CREAM', 'CRIME', 'CROSS', 'CROWD', 'CROWN',
  'CURVE', 'CYCLE', 'DAILY', 'DANCE', 'DATED', 'DEALT', 'DEATH', 'DEBUT',
  'DELAY', 'DEPTH', 'DOING', 'DOUBT', 'DOZEN', 'DRAFT', 'DRAMA', 'DRANK',
  'DRAWN', 'DREAM', 'DRESS', 'DRILL', 'DRINK', 'DRIVE', 'DROVE', 'DYING',
  'EAGER', 'EARLY', 'EARTH', 'EIGHT', 'ELITE', 'EMPTY', 'ENEMY', 'ENJOY',
  'ENTER', 'ENTRY', 'EQUAL', 'ERROR', 'EVENT', 'EVERY', 'EXACT', 'EXIST',
  'EXTRA', 'FAITH', 'FALSE', 'FAULT', 'FAVOR', 'FEAST', 'FIELD', 'FIFTH',
  'FIFTY', 'FIGHT', 'FINAL', 'FIRST', 'FIXED', 'FLASH', 'FLEET', 'FLOOR',
  'FLUID', 'FOCUS', 'FORCE', 'FORTH', 'FORTY', 'FORUM', 'FOUND', 'FRAME',
  'FRANK', 'FRAUD', 'FRESH', 'FRONT', 'FRUIT', 'FULLY', 'FUNNY', 'GIANT',
  'GIVEN', 'GLASS', 'GLOBE', 'GOING', 'GRACE', 'GRADE', 'GRAND', 'GRANT',
  'GRASS', 'GRAVE', 'GREAT', 'GREEN', 'GROSS', 'GROUP', 'GROWN', 'GUARD',
  'GUESS', 'GUEST', 'GUIDE', 'HAPPY', 'HARRY', 'HEART', 'HEAVY', 'HENCE',
  'HENRY', 'HORSE', 'HOTEL', 'HOUSE', 'HUMAN', 'IDEAL', 'IMAGE', 'INDEX',
  'INNER', 'INPUT', 'ISSUE', 'JAPAN', 'JIMMY', 'JOINT', 'JONES', 'JUDGE',
  'JUICE', 'KEVIN', 'KNIFE', 'KNOCK', 'KNOWN', 'LABEL', 'LARGE', 'LASER',
  'LATER', 'LAUGH', 'LAYER', 'LEARN', 'LEASE', 'LEAST', 'LEAVE', 'LEGAL',
  'LEVEL', 'LEWIS', 'LIGHT', 'LIMIT', 'LINKS', 'LIVES', 'LOCAL', 'LOOSE',
  'LOWER', 'LUCKY', 'LUNCH', 'LYING', 'MAGIC', 'MAJOR', 'MAKER', 'MARCH',
  'MARIA', 'MATCH', 'MAYBE', 'MAYOR', 'MEANT', 'MEDIA', 'METAL', 'MIGHT',
  'MINOR', 'MINUS', 'MIXED', 'MODEL', 'MONEY', 'MONTH', 'MORAL', 'MOTOR',
  'MOUNT', 'MOUSE', 'MOUTH', 'MOVIE', 'MUSIC', 'NEEDS', 'NEVER', 'NIGHT',
  'NOISE', 'NORTH', 'NOTED', 'NOVEL', 'NURSE', 'OCCUR', 'OCEAN', 'OFFER',
  'OFTEN', 'ORDER', 'OTHER', 'OUGHT', 'PAINT', 'PANEL', 'PAPER', 'PARTY',
  'PEACE', 'PETER', 'PHASE', 'PHONE', 'PHOTO', 'PIECE', 'PILOT', 'PITCH',
  'PLACE', 'PLAIN', 'PLANE', 'PLANT', 'PLATE', 'POINT', 'POUND', 'POWER',
  'PRESS', 'PRICE', 'PRIDE', 'PRIME', 'PRINT', 'PRIOR', 'PRIZE', 'PROOF',
  'PROUD', 'PROVE', 'QUEEN', 'QUICK', 'QUIET', 'QUITE', 'RADIO', 'RAISE',
  'RANGE', 'RAPID', 'RATIO', 'REACH', 'READY', 'REFER', 'RIGHT', 'RIVAL',
  'RIVER', 'ROGER', 'ROMAN', 'ROUGH', 'ROUND', 'ROUTE', 'ROYAL', 'RURAL',
  'SCALE', 'SCENE', 'SCOPE', 'SCORE', 'SENSE', 'SERVE', 'SEVEN', 'SHALL',
  'SHAPE', 'SHARE', 'SHARP', 'SHEET', 'SHELF', 'SHELL', 'SHIFT', 'SHIRT',
  'SHOCK', 'SHOOT', 'SHORT', 'SHOWN', 'SIGHT', 'SINCE', 'SIXTH', 'SIXTY',
  'SIZED', 'SKILL', 'SLEEP', 'SLIDE', 'SMALL', 'SMART', 'SMILE', 'SMITH',
  'SMOKE', 'SOLID', 'SOLVE', 'SORRY', 'SOUND', 'SOUTH', 'SPACE', 'SPARE',
  'SPEAK', 'SPEED', 'SPEND', 'SPENT', 'SPLIT', 'SPOKE', 'SPORT', 'STAFF',
  'STAGE', 'STAKE', 'STAND', 'START', 'STATE', 'STEAM', 'STEEL', 'STICK',
  'STILL', 'STOCK', 'STONE', 'STOOD', 'STORE', 'STORM', 'STORY', 'STRIP',
  'STUCK', 'STUDY', 'STUFF', 'STYLE', 'SUGAR', 'SUITE', 'SUPER', 'SWEET',
  'TABLE', 'TAKEN', 'TASTE', 'TAXES', 'TEACH', 'TEETH', 'TEXAS', 'THANK',
  'THEFT', 'THEIR', 'THEME', 'THERE', 'THESE', 'THICK', 'THING', 'THINK',
  'THIRD', 'THOSE', 'THREE', 'THREW', 'THROW', 'TIGHT', 'TIMES', 'TIRED',
  'TITLE', 'TODAY', 'TOKEN', 'TOOLS', 'TOTAL', 'TOUCH', 'TOUGH', 'TOWER',
  'TRACK', 'TRADE', 'TRAIN', 'TREAT', 'TREND', 'TRIAL', 'TRIBE', 'TRICK',
  'TRIED', 'TRIES', 'TRUCK', 'TRULY', 'TRUST', 'TRUTH', 'TWICE', 'UNDER',
  'UNION', 'UNITY', 'UNTIL', 'UPPER', 'UPSET', 'URBAN', 'USUAL', 'VALID',
  'VALUE', 'VIDEO', 'VIRUS', 'VISIT', 'VITAL', 'VOICE', 'WASTE', 'WATCH',
  'WATER', 'WHEEL', 'WHERE', 'WHICH', 'WHILE', 'WHITE', 'WHOLE', 'WHOSE',
  'WOMAN', 'WOMEN', 'WORLD', 'WORRY', 'WORSE', 'WORST', 'WORTH', 'WOULD',
  'WOUND', 'WRITE', 'WRONG', 'WROTE', 'YIELD', 'YOUNG', 'YOUTH', 'ABAJO',
  'ABRIL', 'AHORA', 'AMIGO', 'ANTES', 'BUENO', 'CALLE', 'CAMPO', 'CARRO',
  'CIELO', 'CINCO', 'COCHE', 'COMER', 'DESDE', 'DONDE', 'FUEGO', 'GENTE',
  'HACER', 'HASTA', 'HIELO', 'HUEVO', 'LINDO', 'LUGAR', 'MISMO', 'MUCHO',
  'MUNDO', 'NOCHE', 'NUEVO', 'NUNCA', 'PADRE', 'PERRO', 'PLAYA', 'PODER',
  'PRIMO', 'PUNTO', 'QUESO', 'RELOJ', 'SIETE', 'SUELO', 'TARDE', 'TENIS',
  'TEXTO', 'TIGRE', 'TODOS', 'VERDE', 'VECES', 'VIAJE', 'VIDAO', 'VISTA',

  // Common 6-letter words
  'ACCEPT', 'ACCESS', 'ACROSS', 'ACTION', 'ACTIVE', 'ACTUAL', 'ADVICE',
  'ADVISE', 'AFFECT', 'AFFORD', 'AFRAID', 'AGENCY', 'ALMOST', 'ALWAYS',
  'AMOUNT', 'ANIMAL', 'ANNUAL', 'ANSWER', 'ANYONE', 'APPEAL', 'APPEAR',
  'AROUND', 'ARRIVE', 'ARTIST', 'ASPECT', 'ASSESS', 'ASSIST', 'ASSUME',
  'ATTACK', 'ATTEND', 'AUGUST', 'AUTHOR', 'BATTLE', 'BEAUTY', 'BECAME',
  'BECOME', 'BEFORE', 'BEHALF', 'BEHIND', 'BELIEF', 'BELONG', 'BERLIN',
  'BESIDE', 'BETTER', 'BEYOND', 'BISHOP', 'BORDER', 'BOTTLE', 'BOTTOM',
  'BOUGHT', 'BRANCH', 'BREATH', 'BRIDGE', 'BRIGHT', 'BRINGS', 'BROKEN',
  'BROKER', 'BUDGET', 'BURDEN', 'BUREAU', 'BUTTON', 'BUYERS', 'CALLED',
  'CAMERA', 'CANCER', 'CANNOT', 'CARBON', 'CAREER', 'CASINO', 'CASTLE',
  'CAUGHT', 'CAUSED', 'CENTER', 'CENTRE', 'CHANCE', 'CHANGE', 'CHARGE',
  'CHOICE', 'CHOOSE', 'CHOSEN', 'CHURCH', 'CIRCLE', 'CITIES', 'CLAIMS',
  'CLIENT', 'CLOSED', 'CLOSER', 'COFFEE', 'COLUMN', 'COMBAT', 'COMEDY',
  'COMING', 'COMMIT', 'COMMON', 'COMPLY', 'COPPER', 'CORNER', 'COSTLY',
  'COUNTY', 'COUPLE', 'COURSE', 'COVERS', 'CREATE', 'CREDIT', 'CRISIS',
  'CUSTOM', 'DANGER', 'DEALER', 'DEBATE', 'DECADE', 'DECIDE', 'DEFEAT',
  'DEFEND', 'DEFINE', 'DEGREE', 'DEMAND', 'DENTAL', 'DEPEND', 'DEPUTY',
  'DESERT', 'DESIGN', 'DESIRE', 'DETAIL', 'DETECT', 'DEVICE', 'DIFFER',
  'DINNER', 'DIRECT', 'DOCTOR', 'DOLLAR', 'DOMAIN', 'DOUBLE', 'DRIVEN',
  'DRIVER', 'DURING', 'EASILY', 'EATING', 'EDITOR', 'EFFECT', 'EFFORT',
  'EIGHTH', 'EITHER', 'ELEVEN', 'EMERGE', 'EMPIRE', 'EMPLOY', 'ENABLE',
  'ENDING', 'ENERGY', 'ENGAGE', 'ENGINE', 'ENOUGH', 'ENSURE', 'ENTIRE',
  'ENTITY', 'EQUITY', 'ESCAPE', 'ESTATE', 'ETHNIC', 'EUROPE', 'EVENTS',
  'EXCEPT', 'EXCESS', 'EXCUSE', 'EXPAND', 'EXPECT', 'EXPERT', 'EXPORT',
  'EXTEND', 'EXTENT', 'FABRIC', 'FACING', 'FACTOR', 'FAILED', 'FAIRLY',
  'FALLEN', 'FAMILY', 'FAMOUS', 'FARMER', 'FATHER', 'FAVOUR', 'FELLOW',
  'FEMALE', 'FIGURE', 'FILING', 'FILTER', 'FINALLY', 'FINDER', 'FINGER',
  'FINISH', 'FISCAL', 'FLIGHT', 'FLOWER', 'FLYING', 'FOLLOW', 'FORCED',
  'FOREST', 'FORGET', 'FORMAL', 'FORMAT', 'FORMER', 'FOUGHT', 'FOURTH',
  'FRANCE', 'FRIEND', 'FROZEN', 'FUTURE', 'GARDEN', 'GATHER', 'GENDER',
  'GERMAN', 'GLOBAL', 'GOLDEN', 'GOTTEN', 'GOVERN', 'GROUND', 'GROWTH',
  'GUILTY', 'HANDED', 'HANDLE', 'HAPPEN', 'HARDLY', 'HEADED', 'HEALTH',
  'HEARTS', 'HEAVEN', 'HEIGHT', 'HELPED', 'HEROES', 'HIDDEN', 'HIGHER',
  'HIGHLY', 'HOLDER', 'HONEST', 'HOPING', 'HORROR', 'HOTELS', 'HOURLY',
  'HOUSED', 'HOUSES', 'HUMANS', 'HUNTER', 'IGNORE', 'IMAGES', 'IMPACT',
  'IMPORT', 'IMPOSE', 'INCOME', 'INDEED', 'INJURY', 'INSIDE', 'INSIST',
  'INTENT', 'INVEST', 'ISLAND', 'ISSUES', 'ITSELF', 'JERSEY', 'JOINED',
  'JOSEPH', 'JUNIOR', 'JUSTICE', 'KEEPER', 'KILLED', 'KILLER', 'KINDLY',
  'KINGDOM', 'KNIGHT', 'LADIES', 'LANDED', 'LARGER', 'LATEST', 'LATTER',
  'LAUNCH', 'LAWYER', 'LEADER', 'LEAGUE', 'LEAVES', 'LENGTH', 'LESSON',
  'LETTER', 'LIGHTS', 'LIKELY', 'LIMITS', 'LINEAR', 'LINKED', 'LIQUID',
  'LISTEN', 'LITTLE', 'LIVING', 'LOCATE', 'LOCKED', 'LONDON', 'LONGER',
  'LOOKED', 'LOSING', 'LOSSES', 'LOVELY', 'LOWEST', 'LUXURY', 'MAINLY',
  'MAKERS', 'MAKING', 'MANAGE', 'MANNER', 'MANUAL', 'MARGIN', 'MARINE',
  'MARKED', 'MARKET', 'MASTER', 'MATRIX', 'MATTER', 'MATURE', 'MEDIUM',
  'MEMBER', 'MEMORY', 'MENTAL', 'MERELY', 'MERGER', 'METHOD', 'MEXICO',
  'MIDDLE', 'MILLER', 'MINING', 'MINUTE', 'MIRROR', 'MISERY', 'MISTER',
  'MOBILE', 'MODELS', 'MODERN', 'MODEST', 'MODULE', 'MOMENT', 'MONKEY',
  'MONTHS', 'MORGAN', 'MORRIS', 'MOSTLY', 'MOTHER', 'MOTION', 'MOVING',
  'MURDER', 'MUSEUM', 'MUTUAL', 'MYSELF', 'NARROW', 'NATION', 'NATIVE',
  'NATURE', 'NEARBY', 'NEARLY', 'NEEDED', 'NELSON', 'NEURAL', 'NICELY',
  'NIGHTS', 'NOBODY', 'NORMAL', 'NOTICE', 'NOTION', 'NOTING', 'NOVELS',
  'NUMBER', 'OBJECT', 'OBTAIN', 'OCCUPY', 'OCCURS', 'OFFERS', 'OFFICE',
  'OFFSET', 'OLDEST', 'ONLINE', 'OPENED', 'OPTION', 'ORANGE', 'ORDERS',
  'ORIGIN', 'OTHERS', 'OUGHT', 'OUTLET', 'OUTPUT', 'OWNERS', 'OXYGEN',
  'PACKED', 'PALACE', 'PANELS', 'PAPERS', 'PARADE', 'PARENT', 'PARTLY',
  'PASSED', 'PATENT', 'PATROL', 'PATRON', 'PAYING', 'PEOPLE', 'PERIOD',
  'PERMIT', 'PERSON', 'PHRASE', 'PICKED', 'PIECES', 'PLACED', 'PLACES',
  'PLAINS', 'PLANET', 'PLANTS', 'PLASMA', 'PLATES', 'PLAYED', 'PLAYER',
  'PLEASE', 'PLENTY', 'POCKET', 'POETRY', 'POINTS', 'POLICE', 'POLICY',
  'POLISH', 'POLLEN', 'POORLY', 'POPE', 'POPULAR', 'PORTAL', 'POSTER',
  'POTATO', 'POWDER', 'POWERS', 'PRAYER', 'PREFER', 'PRETTY', 'PRICES',
  'PRINCE', 'PRINTS', 'PRISON', 'PROFIT', 'PROPER', 'PROVE', 'PROVEN',
  'PUBLIC', 'PULLED', 'PURELY', 'PURSUE', 'PUSHED', 'PUZZLE', 'RACIAL',
  'RACING', 'RAISED', 'RANDOM', 'RANKED', 'RARELY', 'RATHER', 'RATING',
  'READER', 'REALLY', 'REASON', 'RECALL', 'RECENT', 'RECORD', 'REDUCE',
  'REFORM', 'REFUSE', 'REGARD', 'REGIME', 'REGION', 'REJECT', 'RELATE',
  'RELIEF', 'REMAIN', 'REMEDY', 'REMIND', 'REMOTE', 'REMOVE', 'RENDER',
  'RENTAL', 'REPAIR', 'REPEAT', 'REPORT', 'RESCUE', 'RESORT', 'RESULT',
  'RETAIN', 'RETIRE', 'RETURN', 'REVEAL', 'REVIEW', 'REWARD', 'RIGHTS',
  'RISING', 'ROBUST', 'ROLLED', 'ROOTED', 'RUBBER', 'RULING', 'RUNNER',
  'RUSSIA', 'SACRED', 'SAFETY', 'SALARY', 'SAMPLE', 'SAVING', 'SAYING',
  'SCHEME', 'SCHOOL', 'SCREEN', 'SCRIPT', 'SEARCH', 'SEASON', 'SECOND',
  'SECRET', 'SECTOR', 'SECURE', 'SEEING', 'SEEMED', 'SELECT', 'SELLER',
  'SENATE', 'SENIOR', 'SENSOR', 'SERIES', 'SERVED', 'SERVER', 'SETTLE',
  'SEVERE', 'SEXUAL', 'SHADOW', 'SHAPED', 'SHAPES', 'SHARES', 'SHIELD',
  'SHIFTS', 'SHOULD', 'SHOWED', 'SHOWER', 'SIGNAL', 'SIGNED', 'SILENT',
  'SILVER', 'SIMPLE', 'SIMPLY', 'SINGER', 'SINGLE', 'SISTER', 'SLIGHT',
  'SLOWLY', 'SMOOTH', 'SOCIAL', 'SOLELY', 'SOLVED', 'SOUGHT', 'SOURCE',
  'SOVIET', 'SPEAKS', 'SPIRIT', 'SPOKEN', 'SPORTS', 'SPREAD', 'SPRING',
  'SQUARE', 'STABLE', 'STAGES', 'STAKES', 'STANDS', 'STARTS', 'STATED',
  'STATES', 'STATUS', 'STEADY', 'STEVEN', 'STOCKS', 'STOLEN', 'STORED',
  'STORES', 'STRAIN', 'STRAND', 'STREAM', 'STREET', 'STRESS', 'STRICT',
  'STRIKE', 'STRING', 'STROKE', 'STRONG', 'STRUCK', 'STUDIO', 'STUPID',
  'SUBMIT', 'SUBTLE', 'SUBURB', 'SUFFER', 'SUMMER', 'SUMMIT', 'SUNDAY',
  'SUNSET', 'SUPPLY', 'SURELY', 'SURVEY', 'SWITCH', 'SYMBOL', 'SYSTEM',
  'TABLES', 'TACKLE', 'TACTIC', 'TAKING', 'TALENT', 'TALKED', 'TARGET',
  'TAUGHT', 'TEMPLE', 'TENANT', 'TENDER', 'TENNIS', 'TERROR', 'TESTED',
  'THANKS', 'THEIRS', 'THEORY', 'THINKS', 'THIRTY', 'THOMAS', 'THOUGH',
  'THREAT', 'THROWN', 'TICKET', 'TIMING', 'TISSUE', 'TITLES', 'TOILET',
  'TONGUE', 'TOPPED', 'TOPICS', 'TOWARD', 'TRACKS', 'TRADER', 'TRAINS',
  'TRAVEL', 'TRENDS', 'TRIBAL', 'TRICKS', 'TROOPS', 'TRUSTS', 'TRYING',
  'TUCKED', 'TUNNEL', 'TURKEY', 'TURNED', 'TWELVE', 'TWENTY', 'UNIQUE',
  'UNITED', 'UNLESS', 'UNLIKE', 'UPDATE', 'UPWARD', 'URGENT', 'USEFUL',
  'VALLEY', 'VALUED', 'VALUES', 'VARIES', 'VASTLY', 'VENDOR', 'VERSUS',
  'VESSEL', 'VICTIM', 'VIDEOS', 'VIEWED', 'VIEWER', 'VIKING', 'VILLAGE',
  'VIRGIN', 'VIRTUE', 'VISION', 'VISITS', 'VISUAL', 'VOICES', 'VOLUME',
  'VOTERS', 'VOTING', 'WALKER', 'WALKED', 'WANTED', 'WARMTH', 'WARNER',
  'WARNED', 'WATERS', 'WEALTH', 'WEAPON', 'WEEKLY', 'WEIGHT', 'WHEELS',
  'WIDELY', 'WILLIE', 'WILSON', 'WINDOW', 'WINNER', 'WINTER', 'WISDOM',
  'WISHES', 'WITHIN', 'WONDER', 'WOODEN', 'WORKER', 'WORLDS', 'WORTHY',
  'WOUNDS', 'WRITER', 'YELLOW', 'YIELDS', 'CAMINO', 'CIUDAD', 'COMIDA',
  'CUENTA', 'DINERO', 'ESTADO', 'FAMOSO', 'GRANDE', 'GUERRA', 'MANERA',
  'NUMERO', 'TIEMPO', 'VERDAD', 'AMIGOS', 'BUENOS', 'CUANDO', 'EQUIPO'
]);

const MAX_ATTEMPTS = 6;
const STATS_KEY = 'sqrrrdle_stats';

// Bound event listener reference for cleanup
let boundKeydownHandler = null;

export class WordleGame {
  constructor(options = {}) {
    this.container = options.container;
    this.socket = options.socket;
    this.onCoinsUpdate = options.onCoinsUpdate || (() => {});

    this.board = null;
    this.keyboard = null;
    this.messageEl = null;

    this.currentRow = 0;
    this.currentTile = 0;
    this.guesses = [];
    this.gameStatus = 'playing'; // playing, won, lost
    this.targetWord = '';
    this.wordLength = 5; // Dynamic - set based on daily word
    this.keyStates = {};
    this.serverSynced = false;
    this.socketHandlersSetup = false;

    this.todayKey = this.getTodayKey();
  }

  init() {
    this.board = document.getElementById('wordle-board');
    this.keyboard = document.getElementById('wordle-keyboard');
    this.messageEl = document.getElementById('wordle-message');

    this.targetWord = this.getDailyWord();
    this.wordLength = this.targetWord.length; // Set word length dynamically
    this.createBoard();
    this.setupKeyboard();
    this.setupSocketHandlers();

    // Request state from server first (for cross-device sync)
    if (this.socket) {
      this.socket.emit('sqrrrdle:getState');
    } else {
      // Fallback to local state if no socket
      this.loadLocalState();
    }
  }

  getSpainDate() {
    // Always use Madrid timezone for consistent daily reset at midnight Spain time
    const spain = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
    const [year, month, day] = spain.split('-').map(Number);
    return { year, month, day };
  }

  getTodayKey() {
    const { year, month, day } = this.getSpainDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  getDailyWord() {
    // Deterministic selection based on date - word is never exposed
    const { year, month, day } = this.getSpainDate();
    let seed = year * 10000 + month * 100 + day;
    // Scramble seed to avoid sequential word selection (must match server)
    seed = ((seed * 1103515245 + 12345) >>> 0) % 2147483648;
    const idx = seed % WORDS_CLEAN.length;
    return WORDS_CLEAN[idx];
  }

  createBoard() {
    this.board.innerHTML = '';
    // Add class for 6-letter words to adjust tile size
    this.board.classList.toggle('six-letters', this.wordLength === 6);

    for (let r = 0; r < MAX_ATTEMPTS; r++) {
      const row = document.createElement('div');
      row.className = 'wordle-row';
      row.dataset.row = r;
      for (let c = 0; c < this.wordLength; c++) {
        const tile = document.createElement('div');
        tile.className = 'wordle-tile';
        tile.dataset.row = r;
        tile.dataset.col = c;
        row.appendChild(tile);
      }
      this.board.appendChild(row);
    }
  }

  setupKeyboard() {
    const keys = this.keyboard.querySelectorAll('.wordle-key');
    keys.forEach(key => {
      key.addEventListener('click', () => {
        const k = key.dataset.key;
        this.handleKey(k);
      });
    });

    // Also handle physical keyboard
    boundKeydownHandler = (e) => {
      if (e.key === 'Enter') {
        this.handleKey('ENTER');
      } else if (e.key === 'Backspace') {
        this.handleKey('BACKSPACE');
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        this.handleKey(e.key.toUpperCase());
      }
    };

    document.addEventListener('keydown', boundKeydownHandler);
  }

  handleKey(key) {
    if (this.gameStatus !== 'playing') return;

    if (key === 'ENTER') {
      this.submitGuess();
    } else if (key === 'BACKSPACE') {
      this.deleteLetter();
    } else if (/^[A-Z]$/.test(key) && this.currentTile < this.wordLength) {
      this.addLetter(key);
    }
  }

  addLetter(letter) {
    const tile = this.board.querySelector(
      `.wordle-tile[data-row="${this.currentRow}"][data-col="${this.currentTile}"]`
    );
    if (tile) {
      tile.textContent = letter;
      tile.classList.add('filled');
      this.currentTile++;
    }
  }

  deleteLetter() {
    if (this.currentTile > 0) {
      this.currentTile--;
      const tile = this.board.querySelector(
        `.wordle-tile[data-row="${this.currentRow}"][data-col="${this.currentTile}"]`
      );
      if (tile) {
        tile.textContent = '';
        tile.classList.remove('filled');
      }
    }
  }

  submitGuess() {
    if (this.currentTile !== this.wordLength) {
      this.showMessage(`La palabra debe tener ${this.wordLength} letras`, 'error');
      this.shakeRow(this.currentRow);
      return;
    }

    const guess = this.getCurrentGuess();

    // Check if word is valid (in our dictionary)
    if (!VALID_GUESSES.has(guess) && guess.length === this.wordLength) {
      this.showMessage('Palabra no válida', 'error');
      this.shakeRow(this.currentRow);
      return;
    }

    // Submit to server for validation
    if (this.socket) {
      this.socket.emit('sqrrrdle:guess', { guess });
    }

    // Also process locally for immediate feedback
    this.processGuess(guess);
  }

  getCurrentGuess() {
    let guess = '';
    for (let c = 0; c < this.wordLength; c++) {
      const tile = this.board.querySelector(
        `.wordle-tile[data-row="${this.currentRow}"][data-col="${c}"]`
      );
      if (tile) {
        guess += tile.textContent;
      }
    }
    return guess;
  }

  processGuess(guess) {
    this.guesses.push(guess);

    // Calculate tile states
    const states = Array(this.wordLength).fill('absent');
    const targetLetters = this.targetWord.split('');
    const guessLetters = guess.split('');

    // First pass: mark correct letters
    for (let i = 0; i < this.wordLength; i++) {
      if (guessLetters[i] === targetLetters[i]) {
        states[i] = 'correct';
        targetLetters[i] = null;
        guessLetters[i] = null;
      }
    }

    // Second pass: mark present letters
    for (let i = 0; i < this.wordLength; i++) {
      if (guessLetters[i] !== null) {
        const idx = targetLetters.indexOf(guessLetters[i]);
        if (idx !== -1) {
          states[i] = 'present';
          targetLetters[idx] = null;
        }
      }
    }

    // Animate reveal
    this.revealRow(this.currentRow, states, guess);

    // Check win/loss after animation
    setTimeout(() => {
      if (guess === this.targetWord) {
        this.gameStatus = 'won';
        this.showMessage('¡Has ganado!', 'success');
        this.saveLocalState();
        this.updateStats(true, this.guesses.length);
      } else if (this.currentRow >= MAX_ATTEMPTS - 1) {
        this.gameStatus = 'lost';
        this.showMessage(`La palabra era: ${this.targetWord}`, 'error');
        this.saveLocalState();
        this.updateStats(false, MAX_ATTEMPTS);
      } else {
        this.currentRow++;
        this.currentTile = 0;
        this.saveLocalState();
      }
    }, this.wordLength * 300 + 300);
  }

  revealRow(rowIdx, states, guess) {
    const tiles = this.board.querySelectorAll(`.wordle-tile[data-row="${rowIdx}"]`);

    tiles.forEach((tile, i) => {
      setTimeout(() => {
        tile.classList.add('flip');
        setTimeout(() => {
          tile.classList.add(states[i]);
          this.updateKeyboardKey(guess[i], states[i]);
        }, 250);
      }, i * 300);
    });
  }

  updateKeyboardKey(letter, state) {
    const key = this.keyboard.querySelector(`.wordle-key[data-key="${letter}"]`);
    if (!key) return;

    // Only upgrade state (absent -> present -> correct)
    const currentState = this.keyStates[letter];
    if (currentState === 'correct') return;
    if (currentState === 'present' && state === 'absent') return;

    this.keyStates[letter] = state;
    key.classList.remove('absent', 'present', 'correct');
    key.classList.add(state);
  }

  shakeRow(rowIdx) {
    const row = this.board.querySelector(`.wordle-row[data-row="${rowIdx}"]`);
    if (row) {
      row.classList.add('shake');
      setTimeout(() => row.classList.remove('shake'), 500);
    }
  }

  showMessage(text, type = 'info') {
    this.messageEl.textContent = text;
    this.messageEl.className = `wordle-message ${type}`;
    this.messageEl.classList.add('show');

    setTimeout(() => {
      this.messageEl.classList.remove('show');
    }, 2500);
  }

  // Socket handlers for server sync
  setupSocketHandlers() {
    if (!this.socket || this.socketHandlersSetup) return;
    this.socketHandlersSetup = true;

    // Receive game state from server
    this.socket.on('sqrrrdle:state', (data) => {
      this.serverSynced = true;

      // If server has progress for today, restore it
      if (data.guesses && data.guesses.length > 0 && data.todayKey === this.todayKey) {
        this.restoreFromServer(data);
      }
    });

    // Receive guess result from server
    this.socket.on('sqrrrdle:guessResult', (data) => {
      if (data.payout > 0) {
        this.showMessage(`¡+${data.payout} $qr!`, 'success');
        this.onCoinsUpdate(data.coins);
      }
    });

    this.socket.on('sqrrrdle:error', (data) => {
      this.showMessage(data.message, 'error');
    });

    // Handle coin updates from wordle:coins (legacy)
    this.socket.on('wordle:coins', (data) => {
      if (data.payout > 0) {
        this.showMessage(`¡+${data.payout} $qr!`, 'success');
        this.onCoinsUpdate(data.coins);
      }
    });
  }

  restoreFromServer(data) {
    // Clear current board state
    this.board.innerHTML = '';
    this.createBoard();

    // Restore guesses
    data.guesses.forEach((guess, rowIdx) => {
      this.guesses.push(guess);

      // Calculate states for this guess
      const states = Array(this.wordLength).fill('absent');
      const targetLetters = this.targetWord.split('');
      const guessLetters = guess.split('');

      for (let i = 0; i < this.wordLength; i++) {
        if (guessLetters[i] === targetLetters[i]) {
          states[i] = 'correct';
          targetLetters[i] = null;
          guessLetters[i] = null;
        }
      }

      for (let i = 0; i < this.wordLength; i++) {
        if (guessLetters[i] !== null) {
          const idx = targetLetters.indexOf(guessLetters[i]);
          if (idx !== -1) {
            states[i] = 'present';
            targetLetters[idx] = null;
          }
        }
      }

      // Fill in tiles (no animation for restore)
      for (let c = 0; c < this.wordLength; c++) {
        const tile = this.board.querySelector(
          `.wordle-tile[data-row="${rowIdx}"][data-col="${c}"]`
        );
        if (tile) {
          tile.textContent = guess[c];
          tile.classList.add('filled', states[c]);
          this.updateKeyboardKey(guess[c], states[c]);
        }
      }
    });

    this.currentRow = data.guesses.length;
    this.currentTile = 0;

    // Restore game status
    if (data.status === 'won') {
      this.gameStatus = 'won';
    } else if (data.status === 'lost') {
      this.gameStatus = 'lost';
    } else if (data.guesses.length >= MAX_ATTEMPTS) {
      this.gameStatus = 'lost';
    }
  }

  // Local storage fallback
  saveLocalState() {
    const state = {
      guesses: this.guesses,
      todayKey: this.todayKey,
      gameStatus: this.gameStatus
    };
    localStorage.setItem('sqrrrdle_state', JSON.stringify(state));
  }

  loadLocalState() {
    try {
      const saved = localStorage.getItem('sqrrrdle_state');
      if (saved) {
        const state = JSON.parse(saved);

        // Check if it's from today
        if (state.todayKey === this.todayKey && state.guesses && state.guesses.length > 0) {
          this.restoreFromServer({
            guesses: state.guesses,
            status: state.gameStatus,
            todayKey: state.todayKey
          });
        }
      }
    } catch (e) {
      console.error('Error loading local state:', e);
    }
  }

  // Stats tracking
  updateStats(won, attempts) {
    try {
      let stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
      stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
      stats.gamesWon = (stats.gamesWon || 0) + (won ? 1 : 0);
      stats.currentStreak = won ? (stats.currentStreak || 0) + 1 : 0;
      stats.maxStreak = Math.max(stats.maxStreak || 0, stats.currentStreak);

      // Track attempt distribution
      if (!stats.distribution) {
        stats.distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      }
      if (won) {
        stats.distribution[attempts] = (stats.distribution[attempts] || 0) + 1;
      }

      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {
      console.error('Error updating stats:', e);
    }
  }

  // Show stats modal
  showStats() {
    let stats = {};
    try {
      stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
    } catch (e) {
      stats = {};
    }

    const modal = document.getElementById('wordle-stats-modal');
    if (!modal) return;

    // Fill in stats
    document.getElementById('wordle-stat-played').textContent = stats.gamesPlayed || 0;
    const winPct = stats.gamesPlayed > 0
      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
      : 0;
    document.getElementById('wordle-stat-win').textContent = winPct;
    document.getElementById('wordle-stat-streak').textContent = stats.currentStreak || 0;
    document.getElementById('wordle-stat-maxstreak').textContent = stats.maxStreak || 0;

    // Fill in distribution
    const distribution = stats.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const maxCount = Math.max(...Object.values(distribution), 1);

    const barsContainer = document.getElementById('wordle-distribution-bars');
    barsContainer.innerHTML = '';

    [1, 2, 3, 4, 5, 6].forEach(num => {
      const count = distribution[num] || 0;
      const width = Math.max((count / maxCount) * 100, 8);
      const row = document.createElement('div');
      row.className = 'distribution-row';
      row.innerHTML = `
        <span class="guess-num">${num}</span>
        <div class="bar" style="width: ${width}%">${count}</div>
      `;
      barsContainer.appendChild(row);
    });

    // Next word countdown - always show
    const nextWordEl = document.getElementById('wordle-next-word');
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const diff = tomorrow - now;
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    nextWordEl.textContent = `Próxima palabra en ${hours}h ${mins}m`;

    modal.classList.add('active');
  }

  // Cleanup on destroy
  destroy() {
    if (boundKeydownHandler) {
      document.removeEventListener('keydown', boundKeydownHandler);
      boundKeydownHandler = null;
    }
  }
}
