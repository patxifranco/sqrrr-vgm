/**
 * SQRRRDLE Game Socket Handlers
 *
 * Daily word guessing game with $qr currency rewards.
 * - Rewards: 5000 coins for first 3 tries, 1000 coins after
 * - Progress syncs across devices via MongoDB
 * - Prevents duplicate completions per 24 hours
 */

// Per-user transaction locks to prevent race conditions
const userLocks = new Map();

// Word list for daily word selection (same as frontend)
const WORDS = [
  // Friends (Custom)
  'GARSI', 'KINUS', 'MOMIN', 'JESUS', 'KELMI', 'ASIER',
  // LOL Champions
  'TEEMO', 'VAYNE', 'RIVEN', 'BRAND', 'NASUS', 'YASUO', 'SENNA', 'KAYLE',
  'TALON', 'DIANA', 'LEONA', 'JANNA', 'ANNIE', 'FIORA', 'JAYCE', 'AKALI',
  'KARMA', 'ZIGGS', 'QUINN', 'BRAUM', 'SYLAS', 'YUUMI', 'GAREN', 'VIEGO',
  'VARUS', 'URGOT', 'POPPY', 'ELISE', 'SWAIN', 'SHACO', 'TARIC', 'SIVIR', 'CORKI',
  // Nintendo
  'MARIO', 'LUIGI', 'ZELDA', 'KIRBY', 'WARIO', 'PEACH', 'YOSHI', 'SAMUS',
  'GANON', 'SHEIK', 'MIPHA', 'DARUK', 'SIDON', 'PURAH', 'MIDNA', 'VAATI',
  'TOADS', 'KOOPA', 'DAISY', 'DIDDY', 'FUNKY', 'DIXIE', 'MARTH', 'ROBIN', 'CHROM',
  // Pokemon
  'PICHU', 'EEVEE', 'DITTO', 'ZUBAT', 'EKANS', 'ARBOK', 'UNOWN', 'RALTS',
  'SHINX', 'LUXIO', 'RIOLU', 'SNIVY', 'TEPIG', 'ZORUA', 'INKAY', 'TOXEL', 'KUBFU',
  // Sonic
  'SONIC', 'TAILS', 'KNUCK', 'ROUGE', 'BLAZE', 'SHADE', 'METAL',
  // Other Game Characters
  'SNAKE', 'CLOUD', 'CRASH', 'SPYRO', 'DANTE', 'RAGNA', 'ELLIE', 'GENJI',
  'HANZO', 'MERCY', 'ZARYA', 'SIGMA', 'LUCIO', 'ORISA', 'MOIRA', 'KAIRI',
  'ROXAS', 'TERRA', 'ATLAS', 'CHELL', 'TOMMY', 'DUTCH', 'HOSEA', 'SADIE',
  'ISAAC', 'MAGGY', 'JUDAS', 'STEVE', 'FRISK', 'CHARA', 'PAULA', 'LUCAS',
  'POKEY', 'SHULK', 'MELIA', 'JOKER', 'RYUJI', 'NAOTO', 'KANJI', 'AIGIS',
  'AERIS', 'RINOA', 'TIDUS', 'AURON', 'WAKKA', 'IGNIS', 'LOCKE', 'EDGAR',
  'SABIN', 'CELES', 'KEFKA', 'CECIL', 'RYDIA', 'PROTO', 'GUILE', 'SAGAT',
  'BISON', 'AKUMA', 'CAMMY', 'SONYA', 'ERMAC', 'BRYAN', 'ASUKA', 'ALISA',
  'RAVEN', 'JULIA', 'PANDA', 'CHIPP', 'FAUST', 'VENOM', 'DIZZY', 'KLIFF',
  'AMANE', 'JUBEI', 'BANJO', 'TERRY', 'SIMON',
  // Spanish Gaming Terms
  'NIVEL', 'MAGIA', 'PODER', 'VIDAS', 'SALUD', 'ARMAS', 'COFRE', 'LLAVE',
  'GEMAS', 'MISIL', 'MANDO', 'SALTO', 'TURBO', 'COMBO', 'BONUS', 'FINAL',
  'SPAWN', 'MUNDO', 'DUELO', 'RANGO', 'RACHA', 'LOGRO', 'JEFES', 'BARRA',
  'PUNTO', 'MATAR', 'MORIR', 'CURAR', 'CARTA', 'DADOS', 'JAQUE', 'TORRE',
  'ALFIL', 'REINA', 'CARGA', 'GOLPE', 'CORTE', 'LANZA', 'HACHA', 'ARCOS',
  'CASCO', 'BOTAS', 'RUNAS', 'HORDA', 'CUEVA', 'MINAS', 'FUEGO', 'HIELO',
  'RAYOS', 'PLATA', 'ACERO', 'COBRE', 'ROCAS', 'ARENA', 'SELVA', 'NIEVE',
  'LLAMA', 'LETAL', 'MAGOS', 'BRUJO', 'BRUJA', 'NINJA', 'ROBAR', 'DRACO',
  // Gaming Lingo
  'CARRY', 'BUILD', 'CRITS', 'STUNS', 'SLOWS', 'SPEED', 'FLASH', 'GHOST',
  'SMITE', 'BARON', 'DRAKE', 'NEXUS', 'WARDS', 'GANKS', 'SPLIT', 'GAMER'
];

// Extended valid guesses list - common 5-letter Spanish words + gaming terms
// Must match the frontend list for consistent validation
const VALID_GUESSES = new Set([
  ...WORDS,
  // Common Spanish 5-letter words
  'ABAJO', 'ABONO', 'ABRIL', 'ACABA', 'ACABO', 'ACASO', 'ACERO', 'ACIDO',
  'ACTUA', 'ACTOR', 'ACUTE', 'ADIOS', 'ADOBE', 'AFINA', 'AGUAS', 'AHORA',
  'AIRES', 'AJENO', 'AJUAR', 'ALBUM', 'ALDEA', 'ALEJA', 'ALGOS', 'ALGUN',
  'ALIAS', 'ALIEN', 'ALISO', 'ALMAS', 'ALTAR', 'ALTOS', 'AMABA', 'AMADO',
  'AMAGO', 'AMANO', 'AMARA', 'AMBAR', 'AMBOS', 'AMENO', 'AMIGA', 'AMIGO',
  'ANCLA', 'ANEXO', 'ANGEL', 'ANIMA', 'ANIMO', 'ANTES', 'AQUEL', 'ARABE',
  'ARBOL', 'ARDEN', 'AREAS', 'ARENA', 'ARMAR', 'AROMA', 'ARRAY', 'ARROZ',
  'ARTES', 'ASADO', 'ASILO', 'ASOMA', 'ATLAS', 'ATOMO', 'AUDIO', 'AVENA',
  'AVION', 'AVISO', 'AYUDA', 'AYUNO', 'AZOTE', 'BAILA', 'BAILE', 'BAJAR',
  'BAJAS', 'BAJOS', 'BANCA', 'BANCO', 'BANDA', 'BANDO', 'BARRA', 'BARON',
  'BARCO', 'BASES', 'BASTA', 'BATEA', 'BATIR', 'BEBER', 'BELGA', 'BELLA',
  'BELLO', 'BESAR', 'BICHO', 'BINGO', 'BIOMA', 'BLANC', 'BLUES', 'BOBOS',
  'BOCAS', 'BODAS', 'BOLAS', 'BOLSA', 'BOMBA', 'BORDE', 'BORRA', 'BOTAS',
  'BOTES', 'BRAVO', 'BRAZO', 'BREVE', 'BRISA', 'BRUJA', 'BRUJO', 'BRUMA',
  'BRUTA', 'BRUTO', 'BUENA', 'BUENO', 'BUHOS', 'BULTO', 'BURLA', 'BUSCA',
  'BUZON', 'CABAL', 'CABER', 'CABOS', 'CABRA', 'CACHE', 'CACHO', 'CAERA',
  'CAIDA', 'CAJAS', 'CALCE', 'CALDO', 'CALMA', 'CALOR', 'CALVA', 'CALVO',
  'CAMAS', 'CAMPO', 'CANAL', 'CANAS', 'CANTO', 'CAPAZ', 'CAPEA', 'CARGA',
  'CARNE', 'CAROS', 'CARTA', 'CASAS', 'CASOS', 'CASTA', 'CASTO', 'CAUSA',
  'CAVAR', 'CAZAS', 'CEDER', 'CEJAS', 'CELDA', 'CELOS', 'CENAS', 'CENSO',
  'CERCA', 'CERDO', 'CEROS', 'CESAR', 'CHALE', 'CHAPA', 'CHICA', 'CHICO',
  'CHILE', 'CHINA', 'CHINO', 'CHIVO', 'CHOCA', 'CIEGA', 'CIEGO', 'CIELO',
  'CIFRA', 'CINCO', 'CINES', 'CINTA', 'CIRCO', 'CISCO', 'CITAS', 'CIVIL',
  'CLARA', 'CLARO', 'CLASE', 'CLAVE', 'CLAVO', 'CLIMA', 'COCHE', 'COGER',
  'COJIN', 'COLAS', 'COLOR', 'COMAS', 'COMBO', 'COMER', 'COMIA', 'COMOS',
  'COMUN', 'CONDE', 'CONGA', 'COPIA', 'COPAS', 'CORAL', 'CORAN', 'CORRA',
  'CORRE', 'CORTA', 'CORTE', 'CORTO', 'COSAS', 'COSTA', 'COSTO', 'CREAN',
  'CREAR', 'CRECE', 'CREMA', 'CRIAN', 'CRUDA', 'CRUDO', 'CRUEL', 'CRUJE',
  'CUAJE', 'CUAJO', 'CUATE', 'CUBOS', 'CUECE', 'CUERO', 'CUEVA', 'CULPA',
  'CULTO', 'CUNDE', 'CURAS', 'CURSA', 'CURSO', 'CURVA', 'DADOS', 'DAMAS',
  'DANDO', 'DANZA', 'DANAR', 'DATOS', 'DEBER', 'DEBIL', 'DECIR', 'DEDAL',
  'DEDOS', 'DEJAR', 'DELTA', 'DEMAS', 'DENSO', 'DESDE', 'DESEO', 'DICHA',
  'DICHO', 'DIEGO', 'DIGNA', 'DIGNO', 'DISCO', 'DISTE', 'DIVAN', 'DOBLE',
  'DOCIL', 'DOLOR', 'DOMAR', 'DONDE', 'DONAR', 'DORAR', 'DOSIS', 'DOTAR',
  'DROGA', 'DUCHA', 'DUDAR', 'DUDAS', 'DUELO', 'DUENA', 'DUENO', 'DULCE',
  'DURAS', 'DUROS', 'ECHAR', 'ELIJE', 'ELITE', 'ELLOS', 'EMAIL', 'EMITE',
  'ENANO', 'ENERO', 'ENOJO', 'ENTRA', 'ENTRE', 'ENVIO', 'EPOCA', 'ERAIS',
  'ERROR', 'ETAPA', 'ETNIA', 'EUROS', 'EVITA', 'EXIGE', 'EXIJA', 'EXITO',
  'EXTRA', 'FABLA', 'FALDA', 'FALLA', 'FALLO', 'FALSA', 'FALSO', 'FALTA',
  'FAMAS', 'FANGO', 'FARSA', 'FATAL', 'FAUNA', 'FAVOR', 'FECHA', 'FELIZ',
  'FERIA', 'FIBRA', 'FICHA', 'FIERA', 'FIERO', 'FIJAR', 'FILAS', 'FILMA',
  'FINAL', 'FINCA', 'FINOS', 'FIRMA', 'FIRME', 'FISCO', 'FLACO', 'FLAMA',
  'FLASH', 'FLOJA', 'FLOJO', 'FLORA', 'FLOTA', 'FLUJO', 'FOBIA', 'FOCOS',
  'FOLIO', 'FONDO', 'FORMA', 'FOROS', 'FOTOS', 'FRACO', 'FRASE', 'FRENO',
  'FRESA', 'FRIAS', 'FRITA', 'FRITO', 'FRUTA', 'FRUTO', 'FUEGO', 'FUERA',
  'FUGAS', 'FUMAR', 'FUNDA', 'FURIA', 'GAFAS', 'GALAN', 'GALLO', 'GAMAS',
  'GANAS', 'GANGA', 'GANAR', 'GASAS', 'GATAS', 'GATOS', 'GEMIR', 'GENES',
  'GENIO', 'GENTE', 'GESTO', 'GIRAR', 'GIROS', 'GLOBO', 'GOLFO', 'GOLPE',
  'GOMAS', 'GORDA', 'GORDO', 'GORRA', 'GOTEA', 'GOTAS', 'GOZAN', 'GOZAR',
  'GRACE', 'GRADO', 'GRAMA', 'GRANA', 'GRAVE', 'GRIPE', 'GRIPA', 'GRITO',
  'GRUPO', 'GRUTA', 'GUAPA', 'GUAPO', 'GUIAS', 'GUION', 'GUISO', 'GUSTA',
  'GUSTO', 'HABER', 'HABIA', 'HABLA', 'HACER', 'HACIA', 'HACEN', 'HAGAN',
  'HALLO', 'HARAS', 'HARTO', 'HASTA', 'HELAR', 'HERIR', 'HIELO', 'HIJOS',
  'HILAR', 'HIMNO', 'HIPER', 'HOBBY', 'HOGAR', 'HOJAS', 'HONDA', 'HONDO',
  'HONOR', 'HORAS', 'HOTEL', 'HOYAS', 'HOYOS', 'HUECO', 'HUELE', 'HUEVO',
  'HUIDA', 'HUMOR', 'HUMOS', 'HUYAN', 'IDEAS', 'IDEAL', 'IDOLO', 'IGUAL',
  'ILESO', 'IMITA', 'IMPAR', 'INDEX', 'INDIO', 'INFLA', 'INSTA', 'JAMON',
  'JAQUE', 'JARRA', 'JEFES', 'JESUS', 'JODER', 'JOVEN', 'JOYAS', 'JUEGA',
  'JUEGO', 'JUEZA', 'JUGAD', 'JUGAR', 'JUGOS', 'JUNIO', 'JUNTA', 'JUNTO',
  'JURAR', 'JUSTO', 'KARTS', 'KILOS', 'KIOSK', 'KOALA', 'LABIO', 'LABOR',
  'LACAR', 'LACRA', 'LADAR', 'LAICA', 'LAICO', 'LAMER', 'LANZA', 'LAPIZ',
  'LARGA', 'LARGO', 'LARVA', 'LASER', 'LATAS', 'LATIR', 'LAVAR', 'LAVAS',
  'LAZAN', 'LAZOS', 'LEGAL', 'LEJOS', 'LEMAS', 'LENTO', 'LEONA', 'LEPRA',
  'LETAL', 'LETRA', 'LEVAS', 'LEYES', 'LIBRO', 'LICOR', 'LIDIA', 'LIGAR',
  'LIGHT', 'LIJAS', 'LILAS', 'LIMAR', 'LINDO', 'LINEA', 'LISTA', 'LISTO',
  'LITRO', 'LLAGA', 'LLAMA', 'LLANA', 'LLANO', 'LLEGA', 'LLENA', 'LLENO',
  'LLEVA', 'LLORA', 'LLORO', 'LOBBY', 'LOBOS', 'LOCOS', 'LOCUS', 'LODOS',
  'LOGRA', 'LOGRO', 'LOMAS', 'LOMOS', 'LONAS', 'LOTES', 'LUCEN', 'LUCIR',
  'LUCHA', 'LUCHO', 'LUCIO', 'LUEGO', 'LUGAR', 'LUJAR', 'LUJOS', 'LUNAS',
  'LUNES', 'MACHO', 'MADRE', 'MAFIA', 'MAGOS', 'MALES', 'MALLA', 'MALOS',
  'MAMAS', 'MANCO', 'MANDO', 'MANGO', 'MANIA', 'MANOS', 'MANTA', 'MAPAS',
  'MARCA', 'MARCO', 'MAREA', 'MARES', 'MASAS', 'MATAS', 'MATIZ', 'MAYOR',
  'MAZOS', 'MECER', 'MEDAL', 'MEDIA', 'MEDIO', 'MEJOR', 'MENOS', 'MENTA',
  'MENTE', 'MENUS', 'MEROS', 'MESAS', 'MESES', 'METAL', 'METER', 'METRO',
  'MICRO', 'MIEDO', 'MINAS', 'MINAR', 'MIRAR', 'MIRAS', 'MISAS', 'MISIL',
  'MISMA', 'MISMO', 'MITAD', 'MITOS', 'MIXTA', 'MIXTO', 'MODAL', 'MODAS',
  'MODIO', 'MODOS', 'MOJAR', 'MOLDE', 'MOLER', 'MONJA', 'MONJE', 'MONTA',
  'MONTE', 'MORAL', 'MORAR', 'MORDE', 'MORIR', 'MOROS', 'MORSE', 'MOTOR',
  'MOTOS', 'MOVER', 'MOVIL', 'MOZOS', 'MUCHA', 'MUCHO', 'MUDAR', 'MUDOS',
  'MUECA', 'MUELA', 'MUERE', 'MUERO', 'MUJER', 'MULAS', 'MULTA', 'MUNDO',
  'MUROS', 'MUSAS', 'MUSGO', 'MUSLO', 'NACER', 'NACIO', 'NADAS', 'NADAR',
  'NADIE', 'NAFTA', 'NAIPE', 'NANAS', 'NARIZ', 'NASAL', 'NATAL', 'NATAS',
  'NAVES', 'NECIO', 'NEGAR', 'NEGRO', 'NENES', 'NETAS', 'NETOS', 'NICHO',
  'NIDOS', 'NIEGA', 'NIEVE', 'NIETA', 'NIETO', 'NINFA', 'NINAS', 'NINOS',
  'NIVEL', 'NOBEL', 'NOBLE', 'NOCHE', 'NODOS', 'NOMOS', 'NORMA', 'NORTE',
  'NOTAS', 'NOTAR', 'NOVIO', 'NUBES', 'NUBLA', 'NUCAS', 'NUDOS', 'NUERA',
  'NUEVA', 'NUEVO', 'NUEVE', 'NUNCA', 'OBESO', 'OBRAS', 'OBRAR', 'OBVIO',
  'OCASO', 'OCIOS', 'OCUPA', 'ODIAR', 'ODIOS', 'OESTE', 'OIDAS', 'OIDOS',
  'OJALA', 'OJEAR', 'OLIVA', 'OLLAS', 'OLMOS', 'ONDAS', 'OPACO', 'OPERA',
  'OPINA', 'OPTAR', 'ORDEN', 'OREJA', 'OSADO', 'OSEAS', 'OTROS', 'OVEJA',
  'PACTO', 'PADRE', 'PAGAS', 'PAGAR', 'PAGOS', 'PAJAS', 'PALOS', 'PANES',
  'PAPAL', 'PAPAS', 'PAPEL', 'PARAR', 'PARDO', 'PARED', 'PARIS', 'PARRA',
  'PARTE', 'PARTO', 'PASAR', 'PASAS', 'PASEO', 'PASOS', 'PASTA', 'PATAS',
  'PATIO', 'PATOS', 'PAUSA', 'PAVOR', 'PECAR', 'PECHO', 'PEDAL', 'PEDIR',
  'PEGAS', 'PEINE', 'PELAR', 'PENAS', 'PENAL', 'PENDE', 'PENES', 'PENSA',
  'PEONA', 'PEPAS', 'PERAS', 'PERDO', 'PEREZ', 'PERLA', 'PERRO', 'PESAR',
  'PESCA', 'PESOS', 'PESTE', 'PIANO', 'PICAR', 'PICOS', 'PIEDA', 'PIEZA',
  'PILAS', 'PINAR', 'PINOS', 'PINTA', 'PINTO', 'PIPAS', 'PISAR', 'PISOS',
  'PISTA', 'PITAR', 'PIZZA', 'PLACA', 'PLAGA', 'PLANA', 'PLANO', 'PLATA',
  'PLATO', 'PLAYA', 'PLAZA', 'PLAZO', 'PLENA', 'PLENO', 'PLUMA', 'POBLA',
  'POBRE', 'POCAS', 'POCOS', 'PODER', 'PODIA', 'POEMA', 'POETA', 'POLAR',
  'POLEA', 'POLEN', 'POLVO', 'PONER', 'PONGO', 'PORTA', 'PORTE', 'POSEE',
  'POSER', 'POSTE', 'POTAR', 'POTRA', 'POTRO', 'POZOS', 'PRADO', 'PRAVO',
  'PRESA', 'PRESO', 'PRIMA', 'PRIMO', 'PRIOR', 'PRISA', 'PROBO', 'PROLE',
  'PROSA', 'PUEDE', 'PULGA', 'PULIR', 'PULPO', 'PULSO', 'PUNAL', 'PUNOS',
  'PUNTA', 'PUNTO', 'PUPAS', 'PUROS', 'PUZLE', 'QUEDA', 'QUEJA', 'QUEMA',
  'QUESO', 'QUIEN', 'QUOTA', 'RABIA', 'RABOS', 'RACHA', 'RADAR', 'RADIO',
  'RAJAR', 'RAMAS', 'RAMPA', 'RAMOS', 'RANAS', 'RANGO', 'RAPAR', 'RAPAZ',
  'RARAS', 'RAROS', 'RASCO', 'RASGA', 'RASGO', 'RASOS', 'RASPA', 'RATAS',
  'RATON', 'RATOS', 'RAYAS', 'RAYOS', 'RAZAS', 'RAZON', 'REATA', 'REBAL',
  'REDES', 'REGIA', 'REGIO', 'REGIR', 'REINA', 'REJAS', 'RELOJ', 'REMAR',
  'REMOS', 'RENAL', 'RENCO', 'RENTA', 'RENOS', 'REPAS', 'REPOS', 'REPTO',
  'RESTO', 'RETAR', 'RETOS', 'REYES', 'REZAR', 'REZOS', 'RICLA', 'RIEGA',
  'RIEGO', 'RIELA', 'RIFAR', 'RIFLE', 'RIGIO', 'RIGOR', 'RIMAR', 'RIMAS',
  'RINON', 'RIOJA', 'RISAS', 'RISCO', 'RITMO', 'RITOS', 'RIVAL', 'RIZAR',
  'RIZOS', 'ROBAR', 'ROBOS', 'ROBOT', 'ROBRA', 'ROCAS', 'ROCIO', 'RODEA',
  'RODEO', 'ROGAR', 'ROJAS', 'ROJOS', 'ROLLO', 'ROMAN', 'ROMBO', 'ROMPE',
  'RONDA', 'RONDO', 'ROPAS', 'ROQUE', 'ROSAS', 'ROSCA', 'RUBIA', 'RUBIO',
  'RUBOR', 'RUBRO', 'RUEDA', 'RUEGO', 'RUIDO', 'RUINA', 'RUMBA', 'RUMBO',
  'RUMOR', 'RUNAS', 'RUPIA', 'RURAL', 'RUSAS', 'RUSOS', 'RUTAS', 'SABIA',
  'SABIO', 'SABLE', 'SABOR', 'SACAR', 'SACIA', 'SACOS', 'SAGAZ', 'SALAS',
  'SALDO', 'SALEN', 'SALGO', 'SALIR', 'SALMO', 'SALON', 'SALSA', 'SALTA',
  'SALTO', 'SALUD', 'SALVA', 'SALVO', 'SANAS', 'SANDE', 'SANOS', 'SANTA',
  'SANTO', 'SAPOS', 'SARNO', 'SARNA', 'SARTA', 'SAUCE', 'SAUNA', 'SAVIA',
  'SAXON', 'SECAS', 'SECAR', 'SECOS', 'SECTA', 'SEDAL', 'SEDAR', 'SEDES',
  'SEGAR', 'SEGUN', 'SELVA', 'SENAL', 'SENAS', 'SENOR', 'SERIA', 'SERIO',
  'SERVA', 'SERVO', 'SETAS', 'SIEGA', 'SIGLO', 'SIGNO', 'SIGUE', 'SILLA',
  'SILBO', 'SIMIO', 'SISMO', 'SITIO', 'SOBAR', 'SOBRE', 'SOCIA', 'SOCIO',
  'SODIO', 'SOFAS', 'SOGAS', 'SOLAR', 'SOLAS', 'SOLER', 'SOLOS', 'SOMOS',
  'SONAR', 'SOPAR', 'SOPLA', 'SOPOR', 'SORDA', 'SORDO', 'SORGO', 'SORNA',
  'SOROS', 'SORTE', 'SOTAS', 'SUAVE', 'SUBAS', 'SUBIR', 'SUCIA', 'SUCIO',
  'SUDOR', 'SUECO', 'SUELA', 'SUELE', 'SUELO', 'SUENA', 'SUERO', 'SUITE',
  'SUMAR', 'SUMOS', 'SUPER', 'SUPON', 'SURAR', 'SURCO', 'SURGE', 'SURJA',
  'SUTIL', 'SUYAS', 'SUYOS', 'TABLA', 'TACOS', 'TACTO', 'TALAR', 'TALAS',
  'TALON', 'TALLA', 'TALLO', 'TAMAL', 'TANGO', 'TANTA', 'TANTO', 'TAPAS',
  'TAPEN', 'TAPIA', 'TAPIR', 'TAPON', 'TAQUE', 'TARDA', 'TARDE', 'TAREA',
  'TAROT', 'TARRO', 'TARTA', 'TASAS', 'TASAR', 'TAXIS', 'TAZAS', 'TECLA',
  'TECHO', 'TEJAS', 'TEJEN', 'TEJER', 'TEJON', 'TELAS', 'TELER', 'TEMAS',
  'TEMER', 'TEMOR', 'TEMPO', 'TENAS', 'TENCA', 'TENER', 'TENGO', 'TENIA',
  'TENIS', 'TENSO', 'TENIR', 'TENUE', 'TERCO', 'TERNO', 'TERRA', 'TERSO',
  'TESIS', 'TESLA', 'TESTA', 'TEXTO', 'TIBIO', 'TIENE', 'TIERA', 'TIGRE',
  'TILAS', 'TILDE', 'TIMOS', 'TINAS', 'TINTA', 'TINTO', 'TIPOS', 'TIQUE',
  'TIRAR', 'TIRAS', 'TIROL', 'TIRON', 'TITAN', 'TOCAR', 'TODAS', 'TODOS',
  'TOGAS', 'TOLDO', 'TOMAR', 'TOMAS', 'TOMOS', 'TONAL', 'TONER', 'TONOS',
  'TONTA', 'TONTO', 'TOPAN', 'TOPAR', 'TOPES', 'TOQUE', 'TORAL', 'TORAX',
  'TOREO', 'TOROS', 'TORRE', 'TORSO', 'TORTA', 'TOTAL', 'TOTEM', 'TOURS',
  'TRABA', 'TRABO', 'TRACE', 'TRAER', 'TRAGO', 'TRAJE', 'TRAMA', 'TRAMO',
  'TRATO', 'TRAZO', 'TRECE', 'TRENA', 'TRENE', 'TRENS', 'TREPA', 'TRIGO',
  'TRINA', 'TRIPA', 'TRITE', 'TROJA', 'TRONA', 'TRONO', 'TROPA', 'TROTE',
  'TROVA', 'TROZA', 'TRUCO', 'TRUFA', 'TRUJE', 'TUBAL', 'TUBAS', 'TUBOS',
  'TUMBA', 'TUMOR', 'TUNAS', 'TUNEL', 'TURBA', 'TURBO', 'TURCA', 'TURCO',
  'TURNO', 'TUTOR', 'TUYAS', 'TUYOS', 'UBICA', 'ULCER', 'ULTRA', 'UNICA',
  'UNICO', 'UNIDO', 'UNION', 'UNITA', 'UNTAR', 'UNTOS', 'URANO', 'URBIS',
  'URDIR', 'URGIR', 'URNAS', 'USADA', 'USADO', 'USARA', 'USURA', 'UTERO',
  'UVULA', 'VACAS', 'VACIA', 'VACIO', 'VAGAR', 'VAGON', 'VALER', 'VALES',
  'VALGA', 'VALLA', 'VALLE', 'VALOR', 'VALSA', 'VAPOR', 'VARAS', 'VARIO',
  'VARON', 'VASAR', 'VASOS', 'VAYAN', 'VECES', 'VECIN', 'VEDAS', 'VEGAS',
  'VEJAN', 'VEJAR', 'VEJEZ', 'VELAS', 'VELAR', 'VELOZ', 'VEMOS', 'VENAS',
  'VENCE', 'VENDA', 'VENDE', 'VENIR', 'VENTA', 'VENUS', 'VERAS', 'VERBO',
  'VERDE', 'VERGA', 'VERIA', 'VERSO', 'VETAN', 'VETAR', 'VETAS', 'VEXAR',
  'VIAJE', 'VIBRA', 'VICIO', 'VIDAS', 'VIDEO', 'VIEJA', 'VIEJO', 'VIENE',
  'VIGAS', 'VIGOR', 'VILAS', 'VILES', 'VILLA', 'VINCA', 'VINCO', 'VINOS',
  'VIOLA', 'VIRAL', 'VIRUS', 'VISAR', 'VISAS', 'VISIR', 'VISON', 'VISOR',
  'VISTA', 'VISTO', 'VITAL', 'VIUDA', 'VIUDO', 'VIVAN', 'VIVAS', 'VIVAZ',
  'VIVIR', 'VIVOS', 'VOCAL', 'VOCES', 'VODKA', 'VOLAR', 'VOLEA', 'VOLTA',
  'VOLTS', 'VORAZ', 'VOTAR', 'VOTOS', 'VULGO', 'YACEN', 'YACER', 'YATES',
  'YEDRA', 'YEGUA', 'YEMAS', 'YENDO', 'YERNO', 'YERRO', 'YESOS', 'YOGUR',
  'YOYOS', 'ZAFAR', 'ZAGAS', 'ZANJA', 'ZARES', 'ZARPA', 'ZARZA', 'ZONAS',
  'ZONDA', 'ZORRO', 'ZUECO', 'ZUMBA', 'ZUMOS', 'ZURDA', 'ZURDO', 'ZURRA',
  // Common English gaming terms
  'ABUSE', 'ADMIN', 'AFTER', 'AGAIN', 'ALIEN', 'ALPHA', 'AMAZE', 'ANGLE',
  'ANIME', 'ARMOR', 'ARROW', 'AUDIO', 'AWARD', 'BASIC', 'BATCH', 'BEAST',
  'BEGIN', 'BEING', 'BELOW', 'BLADE', 'BLAST', 'BLAZE', 'BLEED', 'BLIND',
  'BLINK', 'BLOCK', 'BLOOD', 'BOARD', 'BOATS', 'BONUS', 'BOOST', 'BOOTS',
  'BOSSY', 'BRAIN', 'BRAND', 'BRAVE', 'BREAK', 'BREED', 'BRICK', 'BRIEF',
  'BRING', 'BROAD', 'BROKE', 'BRUTE', 'BUDDY', 'BUILT', 'BURST', 'BUYER',
  'CACHE', 'CARRY', 'CATCH', 'CAUSE', 'CHAIN', 'CHAIR', 'CHAMP', 'CHAOS',
  'CHARM', 'CHASE', 'CHEAP', 'CHEAT', 'CHECK', 'CHEST', 'CHIEF', 'CHILD',
  'CHILL', 'CHOSE', 'CLAIM', 'CLASH', 'CLASS', 'CLEAN', 'CLEAR', 'CLICK',
  'CLIMB', 'CLOCK', 'CLONE', 'CLOSE', 'CLOTH', 'CLOUD', 'COACH', 'COAST',
  'COLOR', 'COMBO', 'COMIC', 'COSTS', 'COUNT', 'COVER', 'CRACK', 'CRAFT',
  'CRASH', 'CRAZY', 'CREAM', 'CREST', 'CRIME', 'CROSS', 'CROWD', 'CROWN',
  'CRUDE', 'CRUEL', 'CRUSH', 'CURSE', 'CURVE', 'CYBER', 'CYCLE', 'DAILY',
  'DANCE', 'DEATH', 'DECAL', 'DECAY', 'DECOY', 'DELAY', 'DELTA', 'DEMON',
  'DENSE', 'DEPOT', 'DEPTH', 'DIGIT', 'DISCO', 'DODGE', 'DOING', 'DOUBT',
  'DOZEN', 'DRAFT', 'DRAIN', 'DRAMA', 'DRANK', 'DRAWN', 'DREAM', 'DRESS',
  'DRIED', 'DRIFT', 'DRILL', 'DRINK', 'DRIVE', 'DROID', 'DROWN', 'DRUNK',
  'DRYER', 'DUNCE', 'DWARF', 'DYING', 'EAGER', 'EARLY', 'EARTH', 'EATER',
  'ELDER', 'ELITE', 'EMPTY', 'ENEMY', 'ENJOY', 'ENTER', 'ENTRY', 'EQUAL',
  'EQUIP', 'ERROR', 'EVADE', 'EVENT', 'EVERY', 'EXACT', 'EXILE', 'EXIST',
  'EXTRA', 'FABLE', 'FACED', 'FACTS', 'FAINT', 'FAITH', 'FAKER', 'FALSE',
  'FANCY', 'FATAL', 'FAULT', 'FAVOR', 'FEAST', 'FEATS', 'FIBER', 'FIELD',
  'FIEND', 'FIFTH', 'FIFTY', 'FIGHT', 'FINAL', 'FIRST', 'FIXED', 'FIXER',
  'FLAGS', 'FLAME', 'FLANK', 'FLARE', 'FLASH', 'FLEET', 'FLESH', 'FLOAT',
  'FLOCK', 'FLOOD', 'FLOOR', 'FLORA', 'FLUID', 'FLUSH', 'FLYER', 'FOCAL',
  'FOCUS', 'FOLKS', 'FORCE', 'FORGE', 'FORMS', 'FORTE', 'FORTH', 'FORUM',
  'FOUND', 'FRAME', 'FRAUD', 'FREAK', 'FRESH', 'FRIED', 'FRONT', 'FROST',
  'FRUIT', 'FULLY', 'FUNDS', 'FUNNY', 'GAMER', 'GAMES', 'GATES', 'GAUGE',
  'GAUNT', 'GENRE', 'GHOST', 'GIANT', 'GIFTS', 'GIRLS', 'GIVEN', 'GIVER',
  'GIVES', 'GIZMO', 'GLARE', 'GLASS', 'GLEAM', 'GLIDE', 'GLOBE', 'GLOOM',
  'GLORY', 'GLOVE', 'GOALS', 'GOING', 'GRACE', 'GRADE', 'GRAIN', 'GRAND',
  'GRANT', 'GRAPH', 'GRASP', 'GRASS', 'GRAVE', 'GREED', 'GREEN', 'GREET',
  'GRIEF', 'GRILL', 'GRIND', 'GRIPS', 'GROSS', 'GROUP', 'GROVE', 'GROWL',
  'GROWN', 'GUARD', 'GUESS', 'GUEST', 'GUIDE', 'GUILD', 'GUILT', 'HABIT',
  'HANDS', 'HANDY', 'HAPPY', 'HARDY', 'HARSH', 'HASTE', 'HASTY', 'HATCH',
  'HAVEN', 'HAVOC', 'HEADS', 'HEALS', 'HEARD', 'HEART', 'HEAVY', 'HEDGE',
  'HEIST', 'HELLO', 'HELPS', 'HENCE', 'HERBS', 'HILLS', 'HINGE', 'HINTS',
  'HOARD', 'HOBBY', 'HOLDS', 'HOLES', 'HONOR', 'HOOKS', 'HOPES', 'HORSE',
  'HOSTS', 'HOTEL', 'HOUND', 'HOURS', 'HOUSE', 'HOVER', 'HUMAN', 'HUMID',
  'HUMOR', 'HUNTS', 'HURRY', 'HYDRA', 'HYPER', 'IDEAL', 'IDEAS', 'IDIOT',
  'IMAGE', 'INBOX', 'INDIE', 'INNER', 'INPUT', 'INTEL', 'INTER', 'INTRO',
  'ISSUE', 'ITEMS', 'JOINS', 'JOINT', 'JOKER', 'JOLLY', 'JUDGE', 'JUICE',
  'JUMBO', 'JUMPS', 'KINGS', 'KNIFE', 'KNOCK', 'KNOWN', 'KNOWS', 'LABEL',
  'LABOR', 'LACKS', 'LARGE', 'LASER', 'LASTS', 'LATER', 'LAUGH', 'LAYER',
  'LEADS', 'LEARN', 'LEASE', 'LEAST', 'LEAVE', 'LEGAL', 'LEVEL', 'LEVER',
  'LIGHT', 'LIKED', 'LIKES', 'LIMIT', 'LINES', 'LINKS', 'LIONS', 'LISTS',
  'LIVED', 'LIVER', 'LIVES', 'LLAMA', 'LOADS', 'LOANS', 'LOCAL', 'LOCKS',
  'LODGE', 'LOGIC', 'LOGIN', 'LOOKS', 'LOOPS', 'LOOSE', 'LORDS', 'LOSER',
  'LOSES', 'LOTUS', 'LOVED', 'LOVER', 'LOVES', 'LOWER', 'LOYAL', 'LUCKY',
  'LUNAR', 'LUNCH', 'LURKS', 'LYING', 'MACHO', 'MACRO', 'MAGIC', 'MAJOR',
  'MAKER', 'MAKES', 'MANIA', 'MANOR', 'MARCH', 'MARKS', 'MARSH', 'MASKS',
  'MATCH', 'MATES', 'MATHS', 'MAZES', 'MAYOR', 'MEALS', 'MEANS', 'MEDAL',
  'MEDIA', 'MELEE', 'MELON', 'MERCY', 'MERGE', 'MERIT', 'MERRY', 'METAL',
  'METER', 'MICRO', 'MIGHT', 'MILES', 'MILLS', 'MIMIC', 'MINDS', 'MINER',
  'MINES', 'MINOR', 'MINUS', 'MIXED', 'MIXER', 'MODEL', 'MODEM', 'MODES',
  'MOIST', 'MONEY', 'MONTH', 'MOODS', 'MORAL', 'MOTIF', 'MOTOR', 'MOUND',
  'MOUNT', 'MOUSE', 'MOUTH', 'MOVED', 'MOVER', 'MOVES', 'MOVIE', 'MULTI',
  'MUMMY', 'MUSIC', 'MYTHS', 'NAIVE', 'NAMED', 'NAMES', 'NASTY', 'NAVAL',
  'NEEDS', 'NERDS', 'NERVE', 'NEVER', 'NEWER', 'NEWLY', 'NIGHT', 'NINJA',
  'NINTH', 'NOBLE', 'NODES', 'NOISE', 'NORTH', 'NOTCH', 'NOTED', 'NOTES',
  'NOVEL', 'NURSE', 'OASIS', 'OCCUR', 'OCEAN', 'OFFER', 'OFTEN', 'OLIVE',
  'OMEGA', 'ONSET', 'OPENS', 'OPERA', 'ORBIT', 'ORDER', 'OTHER', 'OUGHT',
  'OUTER', 'OWNED', 'OWNER', 'OXIDE', 'PACKS', 'PACTS', 'PAGES', 'PAINS',
  'PAINT', 'PAIRS', 'PALMS', 'PANEL', 'PANIC', 'PAPER', 'PARTY', 'PASTE',
  'PATCH', 'PATHS', 'PAUSE', 'PEACE', 'PEAKS', 'PENNY', 'PERKS', 'PHASE',
  'PHONE', 'PHOTO', 'PICKS', 'PIECE', 'PILES', 'PILOT', 'PINCH', 'PIPES',
  'PITCH', 'PIXEL', 'PIZZA', 'PLACE', 'PLAIN', 'PLANE', 'PLANS', 'PLANT',
  'PLATE', 'PLAYS', 'PLAZA', 'PLEAD', 'PLOTS', 'POINT', 'POKER', 'POLAR',
  'POLLS', 'POOLS', 'POPUP', 'PORCH', 'PORTS', 'POSED', 'POSES', 'POSTS',
  'POUND', 'POWER', 'PRANK', 'PRESS', 'PRICE', 'PRIDE', 'PRIME', 'PRINT',
  'PRIOR', 'PRIZE', 'PROBE', 'PROMO', 'PRONE', 'PROOF', 'PROPS', 'PROUD',
  'PROVE', 'PROXY', 'PUNCH', 'PUPIL', 'PURGE', 'QUEEN', 'QUERY', 'QUEST',
  'QUEUE', 'QUICK', 'QUIET', 'QUITE', 'QUOTA', 'QUOTE', 'RACES', 'RACKS',
  'RADAR', 'RADIO', 'RAIDS', 'RAILS', 'RAINS', 'RAISE', 'RALLY', 'RANCH',
  'RANGE', 'RANKS', 'RAPID', 'RATED', 'RATES', 'RATIO', 'RAZOR', 'REACH',
  'REACT', 'READS', 'READY', 'REALM', 'REBEL', 'RECAP', 'REFER', 'REIGN',
  'RELAX', 'RELAY', 'RELIC', 'RENEW', 'REPEL', 'REPLY', 'RESET', 'RESIN',
  'RETRY', 'RIDER', 'RIDES', 'RIDGE', 'RIFLE', 'RIGHT', 'RIGID', 'RINGS',
  'RIOTS', 'RISEN', 'RISES', 'RISKS', 'RISKY', 'RIVAL', 'RIVER', 'ROADS',
  'ROAST', 'ROBOT', 'ROCKS', 'ROCKY', 'ROGUE', 'ROLES', 'ROMAN', 'ROOMS',
  'ROOTS', 'ROPES', 'ROSES', 'ROUGH', 'ROUND', 'ROUTE', 'ROVER', 'ROYAL',
  'RUINS', 'RULED', 'RULER', 'RULES', 'RUMOR', 'RURAL', 'RUSTS', 'SADLY',
  'SAFER', 'SAINT', 'SALAD', 'SALES', 'SAUCE', 'SAVED', 'SAVES', 'SCALE',
  'SCALY', 'SCAMS', 'SCANS', 'SCARE', 'SCENE', 'SCENT', 'SCOPE', 'SCORE',
  'SCOUT', 'SCRAP', 'SEALS', 'SEATS', 'SEEKS', 'SEEMS', 'SEIZE', 'SELLS',
  'SENDS', 'SENSE', 'SERUM', 'SERVE', 'SETUP', 'SEVEN', 'SHADE', 'SHAFT',
  'SHAKE', 'SHALL', 'SHAME', 'SHAPE', 'SHARE', 'SHARK', 'SHARP', 'SHEEP',
  'SHEER', 'SHEET', 'SHELF', 'SHELL', 'SHIFT', 'SHINE', 'SHINY', 'SHIPS',
  'SHIRT', 'SHOCK', 'SHOES', 'SHOOT', 'SHOPS', 'SHORE', 'SHORT', 'SHOTS',
  'SHOWN', 'SHOWS', 'SIEGE', 'SIGHT', 'SIGMA', 'SIGNS', 'SILLY', 'SINCE',
  'SITES', 'SIXTH', 'SIXTY', 'SIZED', 'SIZES', 'SKILL', 'SKIES', 'SKINS',
  'SKULL', 'SLASH', 'SLATE', 'SLAVE', 'SLEEP', 'SLEPT', 'SLICE', 'SLIDE',
  'SLOPE', 'SLOWS', 'SMALL', 'SMART', 'SMELL', 'SMILE', 'SMITH', 'SMOKE',
  'SNACK', 'SNAKE', 'SNARE', 'SNEAK', 'SNIVY', 'SOLAR', 'SOLID', 'SOLVE',
  'SONGS', 'SORRY', 'SORTS', 'SOULS', 'SOUND', 'SOUTH', 'SPACE', 'SPARE',
  'SPARK', 'SPAWN', 'SPEAK', 'SPEAR', 'SPECS', 'SPEED', 'SPELL', 'SPEND',
  'SPENT', 'SPICE', 'SPIKE', 'SPILL', 'SPINE', 'SPINS', 'SPITE', 'SPLIT',
  'SPOKE', 'SPOOF', 'SPORT', 'SPOTS', 'SQUAD', 'STACK', 'STAFF', 'STAGE',
  'STAIN', 'STAKE', 'STALL', 'STAMP', 'STAND', 'STARK', 'STARS', 'START',
  'STASH', 'STATE', 'STATS', 'STAYS', 'STEAL', 'STEAM', 'STEEL', 'STEEP',
  'STEER', 'STEPS', 'STICK', 'STILL', 'STING', 'STOCK', 'STOLE', 'STONE',
  'STOOD', 'STOOL', 'STOPS', 'STORE', 'STORM', 'STORY', 'STOUT', 'STOVE',
  'STRAP', 'STRAW', 'STRAY', 'STRIP', 'STUCK', 'STUDY', 'STUFF', 'STUMP',
  'STUNT', 'STYLE', 'SUGAR', 'SUITE', 'SUNNY', 'SUPER', 'SURGE', 'SWAMP',
  'SWAPS', 'SWARM', 'SWEAR', 'SWEAT', 'SWEEP', 'SWEET', 'SWELL', 'SWEPT',
  'SWIFT', 'SWING', 'SWORD', 'SWORN', 'SYNTH', 'TABLE', 'TAILS', 'TAKEN',
  'TAKES', 'TALES', 'TALKS', 'TANKS', 'TASTE', 'TASTY', 'TAXES', 'TEACH',
  'TEAMS', 'TEARS', 'TECHS', 'TEENS', 'TEMPO', 'TENDS', 'TENOR', 'TENSE',
  'TENTH', 'TERMS', 'TESTS', 'TEXTS', 'THANK', 'THEFT', 'THEME', 'THERE',
  'THESE', 'THICK', 'THIEF', 'THING', 'THINK', 'THIRD', 'THOSE', 'THREE',
  'THREW', 'THROW', 'THUMB', 'TIDAL', 'TIERS', 'TIGER', 'TIGHT', 'TILES',
  'TIMER', 'TIMES', 'TIRES', 'TIRED', 'TITAN', 'TITLE', 'TODAY', 'TOKEN',
  'TOLLS', 'TOMBS', 'TONED', 'TONES', 'TOOLS', 'TOOTH', 'TOPIC', 'TORCH',
  'TOTAL', 'TOUCH', 'TOUGH', 'TOURS', 'TOWER', 'TOWNS', 'TOXIC', 'TRACE',
  'TRACK', 'TRADE', 'TRAIL', 'TRAIN', 'TRAIT', 'TRANS', 'TRAPS', 'TRASH',
  'TREAT', 'TREES', 'TREND', 'TRIAL', 'TRIBE', 'TRICK', 'TRIED', 'TRIES',
  'TROOP', 'TRUCK', 'TRULY', 'TRUMP', 'TRUNK', 'TRUST', 'TRUTH', 'TUBES',
  'TUMOR', 'TUNES', 'TURNS', 'TUTOR', 'TWICE', 'TWINS', 'TWIST', 'TYPED',
  'TYPES', 'ULTRA', 'UNCLE', 'UNDER', 'UNDID', 'UNDUE', 'UNION', 'UNITE',
  'UNITS', 'UNITY', 'UNTIL', 'UPPER', 'UPSET', 'URBAN', 'URGED', 'USAGE',
  'USERS', 'USING', 'USUAL', 'UTTER', 'VAGUE', 'VALID', 'VALUE', 'VALVE',
  'VAMPS', 'VAPOR', 'VAULT', 'VEGAS', 'VENUE', 'VERBS', 'VERSE', 'VIDEO',
  'VIEWS', 'VIGOR', 'VIRAL', 'VIRUS', 'VISIT', 'VISTA', 'VITAL', 'VIVID',
  'VOCAL', 'VODKA', 'VOGUE', 'VOICE', 'VOTES', 'WAGER', 'WAGES', 'WAGON',
  'WAIST', 'WAITS', 'WAKES', 'WALKS', 'WALLS', 'WANTS', 'WARDS', 'WARMS',
  'WARNS', 'WASTE', 'WATCH', 'WATER', 'WATTS', 'WAVES', 'WEARS', 'WEARY',
  'WEEDS', 'WEEKS', 'WEIGH', 'WEIRD', 'WELLS', 'WHALE', 'WHEAT', 'WHEEL',
  'WHERE', 'WHICH', 'WHILE', 'WHITE', 'WHOLE', 'WHOSE', 'WIDTH', 'WILDS',
  'WINDS', 'WINES', 'WINGS', 'WIRED', 'WIRES', 'WITCH', 'WIVES', 'WOMAN',
  'WOMEN', 'WOODS', 'WORDS', 'WORKS', 'WORLD', 'WORRY', 'WORSE', 'WORST',
  'WORTH', 'WOULD', 'WOUND', 'WRATH', 'WRECK', 'WRIST', 'WRITE', 'WRONG',
  'WROTE', 'YACHT', 'YARDS', 'YEARS', 'YELLS', 'YIELD', 'YOUNG', 'YOUTH',
  'ZEROS', 'ZONES', 'ZOMBI', 'FRIKI', 'LAYSI'
]);

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDailyWord() {
  const d = new Date();
  let seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  // Scramble seed to avoid sequential word selection (must match frontend)
  seed = ((seed * 1103515245 + 12345) >>> 0) % 2147483648;
  const idx = seed % WORDS.length;
  return WORDS[idx];
}

// ==================== INITIALIZATION ====================
function init(io) {
  console.log('SQRRRDLE handler initialized');
}

// ==================== SOCKET HANDLERS ====================
function setupHandlers(io, socket, context) {
  const { getUser, saveUser, getLoggedInUsername } = context;

  // Get current game state for the user (syncs across devices)
  socket.on('sqrrrdle:getState', () => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('sqrrrdle:error', { message: 'No has iniciado sesión' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('sqrrrdle:error', { message: 'Usuario no encontrado' });
      return;
    }

    // Initialize sqrrrdle stats if not present
    if (!user.sqrrrdle) {
      user.sqrrrdle = {
        wordsGuessed: 0,
        totalTries: 0,
        totalCoins: 0,
        lastCompletedDate: null,
        currentDayGuesses: [],
        currentDayStatus: 'playing'
      };
    }

    const todayKey = getTodayKey();

    // Check if it's a new day - reset daily state
    if (user.sqrrrdle.lastCompletedDate !== todayKey && user.sqrrrdle.currentDayStatus !== 'playing') {
      // It's a new day, reset daily state
      user.sqrrrdle.currentDayGuesses = [];
      user.sqrrrdle.currentDayStatus = 'playing';
      saveUser(username);
    } else if (user.sqrrrdle.lastCompletedDate === todayKey) {
      // Already completed today - keep as completed
      user.sqrrrdle.currentDayStatus = user.sqrrrdle.currentDayStatus || 'won';
    }

    socket.emit('sqrrrdle:state', {
      guesses: user.sqrrrdle.currentDayGuesses || [],
      status: user.sqrrrdle.currentDayStatus || 'playing',
      coins: user.coins ?? 1000,
      todayKey: todayKey,
      stats: {
        wordsGuessed: user.sqrrrdle.wordsGuessed || 0,
        totalTries: user.sqrrrdle.totalTries || 0,
        totalCoins: user.sqrrrdle.totalCoins || 0
      }
    });
  });

  // Submit a guess
  socket.on('sqrrrdle:guess', (data) => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('sqrrrdle:error', { message: 'No has iniciado sesión' });
      return;
    }

    // Prevent race condition
    if (userLocks.get(username)) {
      socket.emit('sqrrrdle:error', { message: 'Procesando operación anterior...' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('sqrrrdle:error', { message: 'Usuario no encontrado' });
      return;
    }

    const guess = (data?.guess || '').toUpperCase().trim();
    if (guess.length !== 5) {
      socket.emit('sqrrrdle:error', { message: 'La palabra debe tener 5 letras' });
      return;
    }

    // Validate word is in our dictionary
    if (!VALID_GUESSES.has(guess)) {
      socket.emit('sqrrrdle:error', { message: 'Palabra no válida' });
      return;
    }

    // Initialize sqrrrdle stats if not present
    if (!user.sqrrrdle) {
      user.sqrrrdle = {
        wordsGuessed: 0,
        totalTries: 0,
        totalCoins: 0,
        lastCompletedDate: null,
        currentDayGuesses: [],
        currentDayStatus: 'playing'
      };
    }

    const todayKey = getTodayKey();
    const targetWord = getDailyWord();

    // Check if already completed today
    if (user.sqrrrdle.lastCompletedDate === todayKey) {
      socket.emit('sqrrrdle:error', { message: 'Ya completaste el SQRRRDLE de hoy' });
      return;
    }

    // Check if too many guesses
    if ((user.sqrrrdle.currentDayGuesses || []).length >= 6) {
      socket.emit('sqrrrdle:error', { message: 'Ya usaste todos tus intentos' });
      return;
    }

    // Lock user during transaction
    userLocks.set(username, true);

    try {
      // Add guess to list
      user.sqrrrdle.currentDayGuesses = user.sqrrrdle.currentDayGuesses || [];
      user.sqrrrdle.currentDayGuesses.push(guess);
      user.sqrrrdle.totalTries = (user.sqrrrdle.totalTries || 0) + 1;

      const attempts = user.sqrrrdle.currentDayGuesses.length;
      const isCorrect = guess === targetWord;
      const isGameOver = isCorrect || attempts >= 6;

      let payout = 0;

      if (isCorrect) {
        // Calculate payout: 5000 for first 3 tries, 1000 after
        payout = attempts <= 3 ? 5000 : 1000;

        // Award payout
        user.coins = (user.coins ?? 1000) + payout;

        // Update stats
        user.sqrrrdle.wordsGuessed = (user.sqrrrdle.wordsGuessed || 0) + 1;
        user.sqrrrdle.totalCoins = (user.sqrrrdle.totalCoins || 0) + payout;
        user.sqrrrdle.lastCompletedDate = todayKey;
        user.sqrrrdle.currentDayStatus = 'won';

        console.log(`[SQRRRDLE] ${username} ganó en ${attempts} intentos. Recompensa: ${payout}. Balance: ${user.coins}`);
      } else if (isGameOver) {
        // Lost - mark as completed with no reward
        user.sqrrrdle.lastCompletedDate = todayKey;
        user.sqrrrdle.currentDayStatus = 'lost';

        console.log(`[SQRRRDLE] ${username} perdió. La palabra era: ${targetWord}`);
      }

      saveUser(username);

      // Send response
      socket.emit('sqrrrdle:guessResult', {
        guess,
        isCorrect,
        isGameOver,
        payout,
        coins: user.coins,
        attempts,
        targetWord: isGameOver ? targetWord : null,
        status: user.sqrrrdle.currentDayStatus
      });

      // Also emit general coin update if payout
      if (payout > 0) {
        socket.emit('user:coins', {
          coins: user.coins
        });
      }
    } finally {
      userLocks.delete(username);
    }
  });

  // Player won wordle - legacy endpoint (kept for backward compatibility)
  socket.on('wordle:win', (data) => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('wordle:error', { message: 'Not logged in' });
      return;
    }

    // Prevent race condition
    if (userLocks.get(username)) {
      socket.emit('wordle:error', { message: 'Procesando operación anterior...' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('wordle:error', { message: 'User not found' });
      return;
    }

    const attempts = parseInt(data?.attempts) || 6;
    if (attempts < 1 || attempts > 6) {
      socket.emit('wordle:error', { message: 'Invalid attempts' });
      return;
    }

    // Initialize sqrrrdle stats if not present
    if (!user.sqrrrdle) {
      user.sqrrrdle = {
        wordsGuessed: 0,
        totalTries: 0,
        totalCoins: 0,
        lastCompletedDate: null,
        currentDayGuesses: [],
        currentDayStatus: 'playing'
      };
    }

    const todayKey = getTodayKey();

    // Check if already completed today
    if (user.sqrrrdle.lastCompletedDate === todayKey) {
      socket.emit('wordle:error', { message: 'Ya jugaste hoy' });
      return;
    }

    // Lock user during transaction
    userLocks.set(username, true);

    try {
      // Calculate payout: 5000 for first 3 tries, 1000 after
      const payout = attempts <= 3 ? 5000 : 1000;

      // Award payout
      user.coins = (user.coins ?? 1000) + payout;

      // Track sqrrrdle stats
      user.sqrrrdle.wordsGuessed = (user.sqrrrdle.wordsGuessed || 0) + 1;
      user.sqrrrdle.totalTries = (user.sqrrrdle.totalTries || 0) + attempts;
      user.sqrrrdle.totalCoins = (user.sqrrrdle.totalCoins || 0) + payout;
      user.sqrrrdle.lastCompletedDate = todayKey;
      user.sqrrrdle.currentDayStatus = 'won';

      saveUser(username);

      console.log(`[SQRRRDLE] ${username} ganó en ${attempts} intentos. Recompensa: ${payout}. Balance: ${user.coins}`);

      socket.emit('wordle:coins', {
        payout,
        coins: user.coins
      });

      // Also emit general coin update
      socket.emit('user:coins', {
        coins: user.coins
      });
    } finally {
      userLocks.delete(username);
    }
  });

  // Cleanup function
  return {
    handleDisconnect: () => {
      // No cleanup needed for sqrrrdle
    }
  };
}

module.exports = {
  init,
  setupHandlers
};
