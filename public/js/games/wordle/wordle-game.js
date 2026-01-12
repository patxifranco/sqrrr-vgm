/**
 * SQRRRDLE Game
 * Daily word guessing game with gaming-themed Spanish words
 * Progress syncs across devices via server
 */

// Word list - gaming characters, terms, and friends
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
// This allows players to guess real words even if they're not in the daily answer pool
const VALID_GUESSES = new Set([
  // All answer words are valid guesses
  ...WORDS,
  // Common Spanish 5-letter words
  'ABAJO', 'ABONO', 'ABRIL', 'ACABA', 'ACABO', 'ACASO', 'ACERO', 'ACIDO',
  'ACTUA', 'ACTOR', 'ACUTE', 'ADIOS', 'ADOBE', 'AFINA', 'AGUAS', 'AHORA',
  'AIRES', 'AJENO', 'AJUAR', 'ALBUM', 'ALDEA', 'ALEJA', 'ALGOS', 'ALGÚN',
  'ALGUN', 'ALIAS', 'ALIEN', 'ALISO', 'ALMAS', 'ALTAR', 'ALTOS', 'AMABA',
  'AMADO', 'AMAGO', 'AMANO', 'AMARA', 'AMBAR', 'AMBOS', 'AMENO', 'AMIGA',
  'AMIGO', 'AMITO', 'AMOR', 'ANCLA', 'ANEXO', 'ANGEL', 'ANIMA', 'ANIMO',
  'ANTES', 'AQUEL', 'ARABE', 'ARBOL', 'ARDEN', 'AREAS', 'ARENA', 'ARMAR',
  'AROMA', 'ARRAY', 'ARROZ', 'ARTES', 'ASADO', 'ASILO', 'ASOMA', 'ATLAS',
  'ATOMO', 'AUDIO', 'AVENA', 'AVION', 'AVISO', 'AYUDA', 'AYUNO', 'AZOTE',
  'BAILA', 'BAILE', 'BAJAR', 'BAJAS', 'BAJOS', 'BANCA', 'BANCO', 'BANDA',
  'BANDO', 'BARRA', 'BARON', 'BARCO', 'BARRA', 'BASES', 'BASTA', 'BATEA',
  'BATIR', 'BEBER', 'BELGA', 'BELLA', 'BELLO', 'BESAR', 'BICHO', 'BICHO',
  'BINGO', 'BIOMA', 'BISES', 'BISNE', 'BLANC', 'BLUES', 'BOBOS', 'BOCAS',
  'BODAS', 'BOLAS', 'BOLSA', 'BOMBA', 'BORDE', 'BORRA', 'BOTAS', 'BOTES',
  'BRAVO', 'BRAZO', 'BREVE', 'BRISA', 'BRUJA', 'BRUJO', 'BRUMA', 'BRUTA',
  'BRUTO', 'BUENA', 'BUENO', 'BUHOS', 'BULTO', 'BURLA', 'BUSCA', 'BUZON',
  'CABAL', 'CABER', 'CABOS', 'CABRA', 'CACHE', 'CACHO', 'CAERA', 'CAIDA',
  'CAJAS', 'CALCE', 'CALDO', 'CALMA', 'CALOR', 'CALVA', 'CALVO', 'CAMAS',
  'CAMPO', 'CANAL', 'CANAS', 'CANTO', 'CAPAZ', 'CAPEA', 'CARGA', 'CARNE',
  'CAROS', 'CARTA', 'CASAS', 'CASOS', 'CASTA', 'CASTO', 'CAUSA', 'CAVAR',
  'CAZAS', 'CEDER', 'CEJAS', 'CELDA', 'CELOS', 'CENAS', 'CENSO', 'CERCA',
  'CERDO', 'CEROS', 'CESAR', 'CHALE', 'CHAPA', 'CHICA', 'CHICO', 'CHILE',
  'CHINA', 'CHINO', 'CHIVO', 'CHOCA', 'CIEGA', 'CIEGO', 'CIELO', 'CIENT',
  'CIFRA', 'CINCO', 'CINES', 'CINTA', 'CIRCO', 'CISCO', 'CITAS', 'CIVIL',
  'CLARA', 'CLARO', 'CLASE', 'CLAVE', 'CLAVO', 'CLIMA', 'COCHE', 'COGER',
  'COJIN', 'COLAS', 'COLOR', 'COMAS', 'COMBO', 'COMER', 'COMIA', 'COMOS',
  'COMÚN', 'COMUN', 'CONDE', 'CONGA', 'COPIA', 'COPAS', 'CORAL', 'CORAN',
  'CORRA', 'CORRE', 'CORTA', 'CORTE', 'CORTO', 'COSAS', 'COSTA', 'COSTO',
  'CREAN', 'CREAR', 'CRECE', 'CREMA', 'CRIAN', 'CRUDA', 'CRUDO', 'CRUEL',
  'CRUJE', 'CRUZAR', 'CUAJE', 'CUAJO', 'CUATE', 'CUBOS', 'CUECE', 'CUERO',
  'CUEVA', 'CULPA', 'CULTO', 'CUMAS', 'CUMBA', 'CUNDE', 'CURAS', 'CURSA',
  'CURSO', 'CURVA', 'DADOS', 'DAMAS', 'DANDO', 'DANZA', 'DAÑAR', 'DANAR',
  'DATOS', 'DEBER', 'DEBIL', 'DECIR', 'DEDAL', 'DEDOS', 'DEJAR', 'DELTA',
  'DEMÁS', 'DEMAS', 'DENSO', 'DESDE', 'DESEO', 'DICHA', 'DICHO', 'DIEGO',
  'DIGNA', 'DIGNO', 'DISCO', 'DISTE', 'DIVAN', 'DIYAS', 'DOBLE', 'DOCES',
  'DOCIL', 'DOLOR', 'DOMAR', 'DONDE', 'DONAR', 'DORAR', 'DOSIS', 'DOTAR',
  'DROGA', 'DUCHA', 'DUDAR', 'DUDAS', 'DUELO', 'DUENA', 'DUENO', 'DULCE',
  'DURAS', 'DUROS', 'ECHAR', 'ELIJE', 'ELITE', 'ELLOS', 'EMAIL', 'EMITE',
  'ENANO', 'ENERO', 'ENOJO', 'ENTRA', 'ENTRE', 'ENVIO', 'EPOCA', 'ERAIS',
  'ERROR', 'ETAPA', 'ETNIA', 'EUROS', 'EVITA', 'EXIGE', 'EXIJA', 'EXITO',
  'EXTRA', 'FABLA', 'FALDA', 'FALLA', 'FALLO', 'FALSA', 'FALSO', 'FALTA',
  'FAMAS', 'FANGO', 'FARSA', 'FATAL', 'FAUNA', 'FAVOR', 'FECHA', 'FELIZ',
  'FERIA', 'FIBRA', 'FICHA', 'FIERA', 'FIERO', 'FIJAR', 'FILAS', 'FILMA',
  'FILÓN', 'FINAL', 'FINCA', 'FINOS', 'FIRMA', 'FIRME', 'FISCO', 'FLACO',
  'FLAMA', 'FLASH', 'FLOJA', 'FLOJO', 'FLORA', 'FLOTA', 'FLUJO', 'FOBIA',
  'FOCOS', 'FOLIO', 'FONDO', 'FORMA', 'FOROS', 'FOTOS', 'FRACO', 'FRASE',
  'FRENO', 'FRESA', 'FRIAS', 'FRITA', 'FRITO', 'FRUTA', 'FRUTO', 'FUEGO',
  'FUERA', 'FUGAS', 'FUMAR', 'FUNDA', 'FURIA', 'GAFAS', 'GALAN', 'GALLO',
  'GAMAS', 'GANAS', 'GANGA', 'GANAR', 'GASAS', 'GATAS', 'GATOS', 'GEMIR',
  'GENES', 'GENIO', 'GENTE', 'GESTO', 'GIRAR', 'GIROS', 'GLOBO', 'GOLFO',
  'GOLPE', 'GOMAS', 'GORDA', 'GORDO', 'GORRA', 'GOTEA', 'GOTAS', 'GOZAN',
  'GOZAR', 'GRACE', 'GRADO', 'GRAMA', 'GRANA', 'GRAVE', 'GRIPE', 'GRIPA',
  'GRISO', 'GRITAR', 'GRITO', 'GRUPO', 'GRUTA', 'GUAPA', 'GUAPO', 'GUIAS',
  'GUION', 'GUISO', 'GUSTA', 'GUSTO', 'HABER', 'HABIA', 'HABLA', 'HACER',
  'HACIA', 'HACEN', 'HAGAN', 'HALLO', 'HARÁS', 'HARAS', 'HARTO', 'HASTA',
  'HELAR', 'HERIR', 'HIELO', 'HIJOS', 'HILAR', 'HIMNO', 'HIPER', 'HOBBY',
  'HOGAR', 'HOJAS', 'HONDA', 'HONDO', 'HONOR', 'HORAS', 'HOTEL', 'HOYAS',
  'HOYOS', 'HUECO', 'HUELE', 'HUEVO', 'HUIDA', 'HUMOR', 'HUMOS', 'HUYAN',
  'IDEAS', 'IDEAL', 'IDOLO', 'IGUAL', 'ILESO', 'IMITA', 'IMPAR', 'IMPÍO',
  'INDEX', 'INDIO', 'INFLA', 'INJUSTO', 'INSTA', 'INVITA', 'JAMON', 'JAQUE',
  'JARRA', 'JEFES', 'JESUS', 'JODER', 'JOVEN', 'JOYAS', 'JUEGA', 'JUEGO',
  'JUEZA', 'JUGAD', 'JUGAR', 'JUGOS', 'JUNIO', 'JUNTA', 'JUNTO', 'JURAR',
  'JUSTO', 'KARTS', 'KILOS', 'KIOSK', 'KOALA', 'LABIO', 'LABOR', 'LACAR',
  'LACRA', 'LADAR', 'LAICA', 'LAICO', 'LAMER', 'LANZA', 'LAPIZ', 'LARGA',
  'LARGO', 'LARVA', 'LASER', 'LATAS', 'LATIR', 'LAVAR', 'LAVAS', 'LAZAN',
  'LAZOS', 'LEGAL', 'LEJOS', 'LEMAS', 'LENTO', 'LEONA', 'LEON', 'LEPRA',
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
  'MEZCLA', 'MICRO', 'MIEDO', 'MINAS', 'MINAR', 'MIRAR', 'MIRAS', 'MISAS',
  'MISIL', 'MISMA', 'MISMO', 'MITAD', 'MITOS', 'MIXTA', 'MIXTO', 'MODAL',
  'MODAS', 'MODIO', 'MODOS', 'MOJAR', 'MOLDE', 'MOLER', 'MONJA', 'MONJE',
  'MONTA', 'MONTE', 'MORAL', 'MORAR', 'MORDE', 'MORIR', 'MOROS', 'MORSE',
  'MOTOR', 'MOTOS', 'MOVER', 'MOVIL', 'MOZOS', 'MUCHA', 'MUCHO', 'MUDAR',
  'MUDOS', 'MUECA', 'MUELA', 'MUERE', 'MUERO', 'MUJER', 'MULAS', 'MULTA',
  'MUNDO', 'MUROS', 'MUSAS', 'MUSGO', 'MUSLO', 'NACER', 'NACIÓ', 'NACIO',
  'NADAS', 'NADAR', 'NADIE', 'NAFTA', 'NAIPE', 'NANAS', 'NARIZ', 'NASAL',
  'NATAL', 'NATAS', 'NAVES', 'NECIO', 'NEGAR', 'NEGRO', 'NENES', 'NETAS',
  'NETOS', 'NICHO', 'NIDOS', 'NIEGA', 'NIEVE', 'NIETA', 'NIETO', 'NINFA',
  'NINAS', 'NINOS', 'NIÑOS', 'NIVEL', 'NOBEL', 'NOBLE', 'NOCHE', 'NODOS',
  'NOMOS', 'NORMA', 'NORTE', 'NOTAS', 'NOTAR', 'NOVIO', 'NUBES', 'NUBLA',
  'NUCAS', 'NUDOS', 'NUERA', 'NUEVA', 'NUEVO', 'NUEVE', 'NUNCA', 'OBESO',
  'OBRAS', 'OBRAR', 'OBVIO', 'OCASO', 'OCIOS', 'OCUPA', 'ODIAR', 'ODIOS',
  'OESTE', 'OFERTA', 'OIDAS', 'OIDOS', 'OJALA', 'OJEAR', 'OLEAJ', 'OLFAT',
  'OLIVA', 'OLLAS', 'OLMOS', 'OLVID', 'ONDAS', 'OPACO', 'OPERA', 'OPINA',
  'OPTAR', 'OPTOS', 'ORDEN', 'OREJA', 'ÓRGANO', 'ORGANO', 'ORGIA', 'OSADO',
  'OSEAS', 'OTROS', 'OVEJA', 'PACTO', 'PADRE', 'PAGAS', 'PAGAR', 'PAGOS',
  'PAJAS', 'PALOS', 'PANES', 'PAPAL', 'PAPAS', 'PAPEL', 'PARAR', 'PARDO',
  'PARED', 'PARIS', 'PARRA', 'PARTE', 'PARTO', 'PASAR', 'PASAS', 'PASEO',
  'PASOS', 'PASTA', 'PATAS', 'PATIO', 'PATOS', 'PAUSA', 'PAUZA', 'PAVOR',
  'PAYOS', 'PAZOS', 'PECAR', 'PECHO', 'PEDAL', 'PEDIR', 'PEGAS', 'PEINE',
  'PELAR', 'PENAS', 'PENAL', 'PENDE', 'PENES', 'PENSA', 'PEÑAS', 'PEÑON',
  'PEONA', 'PEOR', 'PEPAS', 'PERAS', 'PERDO', 'PEREZ', 'PERIL', 'PERLA',
  'PERRO', 'PESAR', 'PESCA', 'PESOS', 'PESTE', 'PIANO', 'PICAR', 'PICOS',
  'PIEDA', 'PIEJO', 'PIEL', 'PIEZA', 'PILAS', 'PINAR', 'PINOS', 'PINTA',
  'PINTO', 'PIPAS', 'PISAR', 'PISOS', 'PISTA', 'PITAR', 'PIZZA', 'PLACA',
  'PLAGA', 'PLANA', 'PLANO', 'PLATA', 'PLATO', 'PLAYA', 'PLAZA', 'PLAZO',
  'PLENA', 'PLENO', 'PLUMA', 'POBLA', 'POBRE', 'POCAS', 'POCOS', 'PODER',
  'PODIA', 'POEMA', 'POETA', 'POLAR', 'POLEA', 'POLEN', 'POLVO', 'PONER',
  'PONGO', 'PORTA', 'PORTE', 'POSEE', 'POSER', 'POSTE', 'POTAR', 'POTRA',
  'POTRO', 'POZOS', 'PRADO', 'PRAVO', 'PREÑA', 'PRESA', 'PRESO', 'PRIMA',
  'PRIMO', 'PRIOR', 'PRISA', 'PROBO', 'PROLE', 'PROSA', 'PRUEB', 'PUEDE',
  'PULGA', 'PULIR', 'PULPO', 'PULSO', 'PUNAL', 'PUÑOS', 'PUNOS', 'PUNTA',
  'PUNTO', 'PUÑAL', 'PUPAS', 'PUROS', 'PUZLE', 'QUEDA', 'QUEJA', 'QUEMA',
  'QUESO', 'QUIEN', 'QUOTA', 'RABIA', 'RABOS', 'RACHA', 'RADAR', 'RADIO',
  'RAJAR', 'RAMAS', 'RAMPA', 'RAMOS', 'RANAS', 'RANGO', 'RAPAR', 'RAPAZ',
  'RARAS', 'RAROS', 'RASCO', 'RASGA', 'RASGO', 'RASOS', 'RASPA', 'RATAS',
  'RATON', 'RATOS', 'RAYAS', 'RAYOS', 'RAZAS', 'RAZON', 'REATA', 'REBAL',
  'REDES', 'REGIA', 'REGIO', 'REGIR', 'REINA', 'REJAS', 'RELOJ', 'REMAR',
  'REMOS', 'RENAL', 'RENCO', 'RENTA', 'RENOS', 'RENTA', 'REPAS', 'REPOS',
  'REPTO', 'RESTO', 'RETAR', 'RETOS', 'REYES', 'REZAR', 'REZOS', 'RICLA',
  'RIEGA', 'RIEGO', 'RIELA', 'RIFAR', 'RIFLE', 'RIGIÓ', 'RIGIO', 'RIGOR',
  'RIMAR', 'RIMAS', 'RIÑON', 'RINON', 'RIOJA', 'RISAS', 'RISCO', 'RITMO',
  'RITOS', 'RIVAL', 'RIZAR', 'RIZOS', 'ROBAR', 'ROBOS', 'ROBOT', 'ROBRA',
  'ROCAS', 'ROCIO', 'RODEA', 'RODEO', 'ROGAR', 'ROJAS', 'ROJOS', 'ROLLO',
  'ROMAN', 'ROMBO', 'ROMPE', 'RONDA', 'RONDO', 'ROPAS', 'ROQUE', 'ROSAS',
  'ROSCA', 'RUBIA', 'RUBIO', 'RUBOR', 'RUBRO', 'RUEDA', 'RUEGO', 'RUIDO',
  'RUINA', 'RUMBA', 'RUMBO', 'RUMOR', 'RUNAS', 'RUPIA', 'RURAL', 'RUSAS',
  'RUSOS', 'RUTAS', 'SABIA', 'SABIO', 'SABLE', 'SABOR', 'SACAR', 'SACIA',
  'SACOS', 'SAGAZ', 'SALAS', 'SALDO', 'SALEN', 'SALGO', 'SALIR', 'SALMO',
  'SALON', 'SALSA', 'SALTA', 'SALTO', 'SALUD', 'SALVA', 'SALVO', 'SANAS',
  'SANDE', 'SANOS', 'SANTA', 'SANTO', 'SAPOS', 'SARNO', 'SARNA', 'SARTA',
  'SAUCE', 'SAUNA', 'SAVIA', 'SAXON', 'SECAS', 'SECAR', 'SECOS', 'SECTA',
  'SEDAL', 'SEDAR', 'SEDES', 'SEGAR', 'SEGÚN', 'SEGUN', 'SELVA', 'SENAL',
  'SEÑAL', 'SENAS', 'SEÑAS', 'SEÑOR', 'SENOR', 'SERIA', 'SERIO', 'SERVA',
  'SERVO', 'SETAS', 'SIEGA', 'SIGLO', 'SIGNO', 'SIGUE', 'SILLA', 'SILBO',
  'SIMIO', 'SISMO', 'SITIO', 'SOBAR', 'SOBRE', 'SOCIA', 'SOCIO', 'SODIO',
  'SOFAS', 'SOGAS', 'SOLAR', 'SOLAS', 'SOLER', 'SOLOS', 'SOMA', 'SOMOS',
  'SONAR', 'SOÑAR', 'SOPAR', 'SOPLA', 'SOPOR', 'SORDA', 'SORDO', 'SORGO',
  'SORNA', 'SOROS', 'SORTE', 'SOTAS', 'SUAVE', 'SUBAS', 'SUBIR', 'SUCIA',
  'SUCIO', 'SUDOR', 'SUECO', 'SUELA', 'SUELE', 'SUELO', 'SUENA', 'SUEÑO',
  'SUERO', 'SUITE', 'SUJETA', 'SUMA', 'SUMAR', 'SUMOS', 'SUPER', 'SUPON',
  'SURAR', 'SURCO', 'SURGE', 'SURJA', 'SUTIL', 'SUYAS', 'SUYOS', 'TABLA',
  'TACOS', 'TACTO', 'TALAR', 'TALAS', 'TALON', 'TALLA', 'TALLO', 'TALÓN',
  'TAMAL', 'TANGO', 'TANTA', 'TANTO', 'TAPAS', 'TAPEN', 'TAPIA', 'TAPIR',
  'TAPON', 'TAQUE', 'TARDA', 'TARDE', 'TAREA', 'TAROT', 'TARRO', 'TARTA',
  'TASAS', 'TASAR', 'TAXIS', 'TAZAS', 'TECLA', 'TECHO', 'TECLA', 'TEJAS',
  'TEJEN', 'TEJER', 'TEJON', 'TELAS', 'TELER', 'TEMAS', 'TEMER', 'TEMOR',
  'TEMPO', 'TENAS', 'TENCA', 'TENER', 'TENGO', 'TENIA', 'TENIS', 'TENSO',
  'TEÑIR', 'TENIR', 'TENUE', 'TERCO', 'TERNO', 'TERRA', 'TERSO', 'TESIS',
  'TESLA', 'TESTA', 'TEXTO', 'TIBIO', 'TIENE', 'TIERA', 'TIGRE', 'TILAS',
  'TILDE', 'TIMOS', 'TINAS', 'TINTA', 'TINTO', 'TIPOS', 'TIQUE', 'TIRAR',
  'TIRAS', 'TIROL', 'TIRON', 'TITAN', 'TOCAR', 'TODAS', 'TODOS', 'TOGAS',
  'TOLDO', 'TOMAR', 'TOMAS', 'TOMOS', 'TONAL', 'TONER', 'TONOS', 'TONTA',
  'TONTO', 'TOPAN', 'TOPAR', 'TOPES', 'TOQUE', 'TORAL', 'TORAX', 'TOREO',
  'TOROS', 'TORRE', 'TORSO', 'TORTA', 'TOTAL', 'TOTEM', 'TOURS', 'TRABA',
  'TRABO', 'TRACE', 'TRAER', 'TRAGO', 'TRAJE', 'TRAMA', 'TRAMO', 'TRATO',
  'TRAZO', 'TRECE', 'TRENA', 'TRENE', 'TRENS', 'TREPA', 'TRIGO', 'TRINA',
  'TRIPA', 'TRITE', 'TROFE', 'TROJA', 'TRONA', 'TRONO', 'TROPA', 'TROTE',
  'TROVA', 'TROZA', 'TRUCO', 'TRUFA', 'TRUJE', 'TUBAL', 'TUBAS', 'TUBOS',
  'TUMBA', 'TUMOR', 'TUNAS', 'TUNEL', 'TÚNEL', 'TURBA', 'TURBO', 'TURCA',
  'TURCO', 'TURNO', 'TUTOR', 'TUYAS', 'TUYOS', 'UBICA', 'ULCER', 'ULTRA',
  'UNAÑA', 'UNICA', 'UNICO', 'ÚNICO', 'UNIDO', 'UNION', 'UNIÓN', 'UNITA',
  'UNTAR', 'UNTOS', 'URANO', 'URBIS', 'URDIR', 'URGIR', 'URNAS', 'USADA',
  'USADO', 'USANZ', 'USARA', 'USURA', 'UTERI', 'UTERO', 'ÚTERO', 'UVULA',
  'VACAS', 'VACIA', 'VACÍO', 'VACIO', 'VAGAR', 'VAGÓN', 'VAGON', 'VALER',
  'VALES', 'VALGA', 'VALLA', 'VALLE', 'VALOR', 'VALSA', 'VALS', 'VAPOR',
  'VARAS', 'VARIO', 'VARON', 'VARÓN', 'VASAR', 'VASOS', 'VAYAN', 'VECES',
  'VECIN', 'VEDAS', 'VEGAS', 'VEJAN', 'VEJAR', 'VEJEZ', 'VELAS', 'VELAR',
  'VELOZ', 'VEMOS', 'VENAS', 'VENCE', 'VENDA', 'VENDE', 'VENIR', 'VENTA',
  'VENUS', 'VERAS', 'VERBO', 'VERDE', 'VERGA', 'VERÍA', 'VERIA', 'VERSO',
  'VERYA', 'VETAN', 'VETAR', 'VETAS', 'VEXAR', 'VIAJE', 'VIBRA', 'VICIO',
  'VIDAS', 'VIDEO', 'VIEJA', 'VIEJO', 'VIENE', 'VIGAS', 'VIGOR', 'VILAS',
  'VILES', 'VILLA', 'VINCA', 'VINCO', 'VINOS', 'VIÑAS', 'VIÑAS', 'VIOLA',
  'VIRAL', 'VIRUS', 'VISAR', 'VISAS', 'VISIR', 'VISON', 'VISOR', 'VISTA',
  'VISTO', 'VITAL', 'VIUDA', 'VIUDO', 'VIVAN', 'VIVAS', 'VIVAZ', 'VIVIR',
  'VIVOS', 'VOCAL', 'VOCES', 'VODKA', 'VOLAR', 'VOLEA', 'VOLTA', 'VOLTS',
  'VOMIT', 'VORAZ', 'VOTAR', 'VOTOS', 'VULGO', 'YACEN', 'YACER', 'YATES',
  'YEDRA', 'YEGUA', 'YEMAS', 'YENDO', 'YERNO', 'YERRO', 'YESOS', 'YOGUR',
  'YOYOS', 'ZAFAR', 'ZAGAS', 'ZANJA', 'ZARES', 'ZARPA', 'ZARZA', 'ZONAS',
  'ZONDA', 'ZORRO', 'ZUECO', 'ZUMBA', 'ZUMOS', 'ZURDA', 'ZURDO', 'ZURRA',
  // Common English gaming terms (internationally recognized)
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
  'IMAGE', 'INBOX', 'INDIE', 'INFRA', 'INNER', 'INPUT', 'INTEL', 'INTER',
  'INTRO', 'ISSUE', 'ITEMS', 'JOINS', 'JOINT', 'JOKER', 'JOLLY', 'JUDGE',
  'JUICE', 'JUMBO', 'JUMPS', 'KINGS', 'KNIFE', 'KNOCK', 'KNOWN', 'KNOWS',
  'LABEL', 'LABOR', 'LACKS', 'LARGE', 'LASER', 'LASTS', 'LATER', 'LAUGH',
  'LAYER', 'LEADS', 'LEARN', 'LEASE', 'LEAST', 'LEAVE', 'LEGAL', 'LEVEL',
  'LEVER', 'LIGHT', 'LIKED', 'LIKES', 'LIMIT', 'LINES', 'LINKS', 'LIONS',
  'LISTS', 'LIVED', 'LIVER', 'LIVES', 'LLAMA', 'LOADS', 'LOANS', 'LOCAL',
  'LOCKS', 'LODGE', 'LOGIC', 'LOGIN', 'LOOKS', 'LOOPS', 'LOOSE', 'LORDS',
  'LOSER', 'LOSES', 'LOST', 'LOTUS', 'LOVED', 'LOVER', 'LOVES', 'LOWER',
  'LOYAL', 'LUCKY', 'LUNAR', 'LUNCH', 'LURKS', 'LYING', 'MACHO', 'MACRO',
  'MAGIC', 'MAJOR', 'MAKER', 'MAKES', 'MANIA', 'MANOR', 'MARCH', 'MARKS',
  'MARSH', 'MASKS', 'MATCH', 'MATES', 'MATHS', 'MAZES', 'MAYOR', 'MEALS',
  'MEANS', 'MEDAL', 'MEDIA', 'MELEE', 'MELON', 'MERCY', 'MERGE', 'MERIT',
  'MERRY', 'METAL', 'METER', 'MICRO', 'MIGHT', 'MILES', 'MILLS', 'MIMIC',
  'MINDS', 'MINER', 'MINES', 'MINOR', 'MINUS', 'MIXED', 'MIXER', 'MODEL',
  'MODEM', 'MODES', 'MOIST', 'MONEY', 'MONTH', 'MOODS', 'MORAL', 'MOTIF',
  'MOTOR', 'MOUND', 'MOUNT', 'MOUSE', 'MOUTH', 'MOVED', 'MOVER', 'MOVES',
  'MOVIE', 'MULTI', 'MUMMY', 'MUSIC', 'MYTHS', 'NAIVE', 'NAMED', 'NAMES',
  'NASTY', 'NAVAL', 'NEEDS', 'NERDS', 'NERVE', 'NEVER', 'NEWER', 'NEWLY',
  'NIGHT', 'NINJA', 'NINTH', 'NOBLE', 'NODES', 'NOISE', 'NORTH', 'NOTCH',
  'NOTED', 'NOTES', 'NOVEL', 'NURSE', 'OASIS', 'OCCUR', 'OCEAN', 'OFFER',
  'OFTEN', 'OLIVE', 'OMEGA', 'ONSET', 'OPENS', 'OPERA', 'ORBIT', 'ORDER',
  'OTHER', 'OUGHT', 'OUTER', 'OUTGO', 'OWNED', 'OWNER', 'OXIDE', 'PACKS',
  'PACTS', 'PAGES', 'PAINS', 'PAINT', 'PAIRS', 'PALMS', 'PANEL', 'PANIC',
  'PAPER', 'PARTY', 'PASTE', 'PATCH', 'PATHS', 'PAUSE', 'PEACE', 'PEAKS',
  'PENNY', 'PERKS', 'PHASE', 'PHONE', 'PHOTO', 'PICKS', 'PIECE', 'PILES',
  'PILOT', 'PINCH', 'PIPES', 'PITCH', 'PIXEL', 'PIZZA', 'PLACE', 'PLAIN',
  'PLANE', 'PLANS', 'PLANT', 'PLATE', 'PLAYS', 'PLAZA', 'PLEAD', 'PLOTS',
  'POINT', 'POKER', 'POLAR', 'POLLS', 'POOLS', 'POPUP', 'PORCH', 'PORTS',
  'POSED', 'POSES', 'POSTS', 'POUND', 'POWER', 'PRANK', 'PRESS', 'PRICE',
  'PRIDE', 'PRIME', 'PRINT', 'PRIOR', 'PRIZE', 'PROBE', 'PROMO', 'PRONE',
  'PROOF', 'PROPS', 'PROUD', 'PROVE', 'PROXY', 'PUNCH', 'PUPIL', 'PURGE',
  'QUEEN', 'QUERY', 'QUEST', 'QUEUE', 'QUICK', 'QUIET', 'QUITE', 'QUOTA',
  'QUOTE', 'RACES', 'RACKS', 'RADAR', 'RADIO', 'RAIDS', 'RAILS', 'RAINS',
  'RAISE', 'RALLY', 'RANCH', 'RANGE', 'RANKS', 'RAPID', 'RATED', 'RATES',
  'RATIO', 'RAZOR', 'REACH', 'REACT', 'READS', 'READY', 'REALM', 'REBEL',
  'RECAP', 'REFER', 'REIGN', 'RELAX', 'RELAY', 'RELIC', 'REMOT', 'RENEW',
  'REPEL', 'REPLY', 'RESET', 'RESIN', 'RETRY', 'RIDER', 'RIDES', 'RIDGE',
  'RIFLE', 'RIGHT', 'RIGID', 'RINGS', 'RIOTS', 'RISEN', 'RISES', 'RISKS',
  'RISKY', 'RIVAL', 'RIVER', 'ROADS', 'ROAST', 'ROBOT', 'ROCKS', 'ROCKY',
  'ROGUE', 'ROLES', 'ROMAN', 'ROOMS', 'ROOTS', 'ROPES', 'ROSES', 'ROUGH',
  'ROUND', 'ROUTE', 'ROVER', 'ROYAL', 'RUINS', 'RULED', 'RULER', 'RULES',
  'RUMOR', 'RURAL', 'RUSTS', 'SADLY', 'SAFER', 'SAINT', 'SALAD', 'SALES',
  'SAUCE', 'SAVED', 'SAVES', 'SCALE', 'SCALY', 'SCAMS', 'SCANS', 'SCARE',
  'SCENE', 'SCENT', 'SCOPE', 'SCORE', 'SCOUT', 'SCRAP', 'SEALS', 'SEATS',
  'SEEKS', 'SEEMS', 'SEIZE', 'SELLS', 'SENDS', 'SENSE', 'SERUM', 'SERVE',
  'SETUP', 'SEVEN', 'SHADE', 'SHAFT', 'SHAKE', 'SHALL', 'SHAME', 'SHAPE',
  'SHARE', 'SHARK', 'SHARP', 'SHEEP', 'SHEER', 'SHEET', 'SHELF', 'SHELL',
  'SHIFT', 'SHINE', 'SHINY', 'SHIPS', 'SHIRT', 'SHOCK', 'SHOES', 'SHOOT',
  'SHOPS', 'SHORE', 'SHORT', 'SHOTS', 'SHOWN', 'SHOWS', 'SIEGE', 'SIGHT',
  'SIGMA', 'SIGNS', 'SILLY', 'SINCE', 'SITES', 'SIXTH', 'SIXTY', 'SIZED',
  'SIZES', 'SKILL', 'SKIES', 'SKINS', 'SKULL', 'SLASH', 'SLATE', 'SLAVE',
  'SLEEP', 'SLEPT', 'SLICE', 'SLIDE', 'SLOPE', 'SLOWS', 'SMALL', 'SMART',
  'SMELL', 'SMILE', 'SMITH', 'SMOKE', 'SNACK', 'SNAKE', 'SNARE', 'SNEAK',
  'SNIVY', 'SOLAR', 'SOLID', 'SOLVE', 'SONGS', 'SORRY', 'SORTS', 'SOULS',
  'SOUND', 'SOUTH', 'SPACE', 'SPARE', 'SPARK', 'SPAWN', 'SPEAK', 'SPEAR',
  'SPECS', 'SPEED', 'SPELL', 'SPEND', 'SPENT', 'SPICE', 'SPIKE', 'SPILL',
  'SPINE', 'SPINS', 'SPITE', 'SPLIT', 'SPOKE', 'SPOOF', 'SPORT', 'SPOTS',
  'SQUAD', 'STACK', 'STAFF', 'STAGE', 'STAIN', 'STAKE', 'STALL', 'STAMP',
  'STAND', 'STARK', 'STARS', 'START', 'STASH', 'STATE', 'STATS', 'STAYS',
  'STEAL', 'STEAM', 'STEEL', 'STEEP', 'STEER', 'STEPS', 'STICK', 'STILL',
  'STING', 'STOCK', 'STOLE', 'STONE', 'STOOD', 'STOOL', 'STOPS', 'STORE',
  'STORM', 'STORY', 'STOUT', 'STOVE', 'STRAP', 'STRAW', 'STRAY', 'STRIP',
  'STUCK', 'STUDY', 'STUFF', 'STUMP', 'STUNT', 'STYLE', 'SUGAR', 'SUITE',
  'SUNNY', 'SUPER', 'SURGE', 'SWAMP', 'SWAPS', 'SWARM', 'SWEAR', 'SWEAT',
  'SWEEP', 'SWEET', 'SWELL', 'SWEPT', 'SWIFT', 'SWING', 'SWORD', 'SWORN',
  'SYNTH', 'TABLE', 'TAILS', 'TAKEN', 'TAKES', 'TALES', 'TALKS', 'TANKS',
  'TASTE', 'TASTY', 'TAXES', 'TEACH', 'TEAMS', 'TEARS', 'TECHS', 'TEENS',
  'TEMPO', 'TENDS', 'TENOR', 'TENSE', 'TENTH', 'TERMS', 'TESTS', 'TEXTS',
  'THANK', 'THEFT', 'THEME', 'THERE', 'THESE', 'THICK', 'THIEF', 'THING',
  'THINK', 'THIRD', 'THOSE', 'THREE', 'THREW', 'THROW', 'THUMB', 'TIDAL',
  'TIERS', 'TIGER', 'TIGHT', 'TILES', 'TIMER', 'TIMES', 'TIRES', 'TIRED',
  'TITAN', 'TITLE', 'TODAY', 'TOKEN', 'TOLLS', 'TOMBS', 'TONED', 'TONES',
  'TOOLS', 'TOOTH', 'TOPIC', 'TORCH', 'TOTAL', 'TOUCH', 'TOUGH', 'TOURS',
  'TOWER', 'TOWNS', 'TOXIC', 'TRACE', 'TRACK', 'TRADE', 'TRAIL', 'TRAIN',
  'TRAIT', 'TRANS', 'TRAPS', 'TRASH', 'TREAT', 'TREES', 'TREND', 'TRIAL',
  'TRIBE', 'TRICK', 'TRIED', 'TRIES', 'TROOP', 'TRUCK', 'TRULY', 'TRUMP',
  'TRUNK', 'TRUST', 'TRUTH', 'TUBES', 'TUMOR', 'TUNES', 'TURNS', 'TUTOR',
  'TWICE', 'TWINS', 'TWIST', 'TYPED', 'TYPES', 'ULTRA', 'UNCLE', 'UNDER',
  'UNDID', 'UNDUE', 'UNFAIR', 'UNION', 'UNITE', 'UNITS', 'UNITY', 'UNTIL',
  'UPPER', 'UPSET', 'URBAN', 'URGED', 'USAGE', 'USERS', 'USING', 'USUAL',
  'UTTER', 'VAGUE', 'VALID', 'VALUE', 'VALVE', 'VAMPS', 'VAPOR', 'VAULT',
  'VEGAS', 'VENUE', 'VERBS', 'VERSE', 'VIDEO', 'VIEWS', 'VIGOR', 'VIRAL',
  'VIRUS', 'VISIT', 'VISTA', 'VITAL', 'VIVID', 'VOCAL', 'VODKA', 'VOGUE',
  'VOICE', 'VOTES', 'WAGER', 'WAGES', 'WAGON', 'WAIST', 'WAITS', 'WAKES',
  'WALKS', 'WALLS', 'WANTS', 'WARDS', 'WARMS', 'WARNS', 'WASTE', 'WATCH',
  'WATER', 'WATTS', 'WAVES', 'WEARS', 'WEARY', 'WEEDS', 'WEEKS', 'WEIGH',
  'WEIRD', 'WELLS', 'WHALE', 'WHEAT', 'WHEEL', 'WHERE', 'WHICH', 'WHILE',
  'WHITE', 'WHOLE', 'WHOSE', 'WIDTH', 'WILDS', 'WINDS', 'WINES', 'WINGS',
  'WIRED', 'WIRES', 'WITCH', 'WIVES', 'WOMAN', 'WOMEN', 'WOODS', 'WORDS',
  'WORKS', 'WORLD', 'WORRY', 'WORSE', 'WORST', 'WORTH', 'WOULD', 'WOUND',
  'WRATH', 'WRECK', 'WRIST', 'WRITE', 'WRONG', 'WROTE', 'YACHT', 'YARDS',
  'YEARS', 'YELLS', 'YIELD', 'YOUNG', 'YOUTH', 'ZEROS', 'ZONES', 'ZOMBI'
]);

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;
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
    const idx = seed % WORDS.length;
    return WORDS[idx];
  }

  createBoard() {
    this.board.innerHTML = '';
    for (let r = 0; r < MAX_ATTEMPTS; r++) {
      const row = document.createElement('div');
      row.className = 'wordle-row';
      row.dataset.row = r;
      for (let c = 0; c < WORD_LENGTH; c++) {
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
      // Clone and replace to remove old listeners
      const newKey = key.cloneNode(true);
      key.parentNode.replaceChild(newKey, key);
      newKey.addEventListener('click', () => {
        const k = newKey.dataset.key;
        this.handleKey(k);
      });
    });

    // Remove old keydown listener if exists
    if (boundKeydownHandler) {
      document.removeEventListener('keydown', boundKeydownHandler);
    }

    // Create bound handler for this instance
    boundKeydownHandler = (e) => {
      if (!document.getElementById('wordle-screen').classList.contains('active')) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key.toUpperCase();
      if (key === 'ENTER') {
        this.handleKey('ENTER');
      } else if (key === 'BACKSPACE') {
        this.handleKey('BACKSPACE');
      } else if (/^[A-Z]$/.test(key)) {
        this.handleKey(key);
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
    } else if (/^[A-Z]$/.test(key) && this.currentTile < WORD_LENGTH) {
      this.addLetter(key);
    }
  }

  addLetter(letter) {
    const tile = this.getTile(this.currentRow, this.currentTile);
    if (!tile) return;

    tile.textContent = letter;
    tile.classList.add('filled', 'pop');
    setTimeout(() => tile.classList.remove('pop'), 100);
    this.currentTile++;
  }

  deleteLetter() {
    if (this.currentTile === 0) return;

    this.currentTile--;
    const tile = this.getTile(this.currentRow, this.currentTile);
    if (!tile) return;

    tile.textContent = '';
    tile.classList.remove('filled');
  }

  submitGuess() {
    if (this.currentTile !== WORD_LENGTH) {
      this.showMessage('Necesitas 5 letras', 'error');
      this.shakeRow(this.currentRow);
      return;
    }

    const guess = this.getCurrentGuess();

    // Validate word is in our dictionary
    if (!VALID_GUESSES.has(guess)) {
      this.showMessage('Palabra no válida', 'error');
      this.shakeRow(this.currentRow);
      return;
    }

    // Send guess to server for validation and storage
    if (this.socket && this.serverSynced) {
      this.socket.emit('sqrrrdle:guess', { guess });
    } else {
      // Fallback to local processing
      this.processGuessLocally(guess);
    }
  }

  processGuessLocally(guess) {
    this.guesses.push(guess);
    this.revealRow(this.currentRow, guess);
  }

  getCurrentGuess() {
    let guess = '';
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = this.getTile(this.currentRow, c);
      guess += tile.textContent;
    }
    return guess;
  }

  revealRow(rowIdx, guess, callback = null) {
    const row = this.board.querySelector(`[data-row="${rowIdx}"]`);
    const tiles = row.querySelectorAll('.wordle-tile');

    // Calculate states
    const states = this.calculateStates(guess);

    // Reveal with animation
    tiles.forEach((tile, i) => {
      setTimeout(() => {
        tile.classList.add('reveal');
        setTimeout(() => {
          tile.classList.add(states[i]);
          this.updateKeyState(guess[i], states[i]);
        }, 250);
      }, i * 300);
    });

    // After all reveals
    setTimeout(() => {
      if (callback) {
        callback();
      } else {
        this.checkGameEnd(guess);
        this.currentRow++;
        this.currentTile = 0;
        this.saveLocalState();
      }
    }, WORD_LENGTH * 300 + 300);
  }

  calculateStates(guess) {
    const states = Array(WORD_LENGTH).fill('absent');
    const targetArr = this.targetWord.split('');
    const guessArr = guess.split('');

    // First pass: correct positions
    guessArr.forEach((letter, i) => {
      if (letter === targetArr[i]) {
        states[i] = 'correct';
        targetArr[i] = null;
        guessArr[i] = null;
      }
    });

    // Second pass: present but wrong position
    guessArr.forEach((letter, i) => {
      if (letter === null) return;
      const idx = targetArr.indexOf(letter);
      if (idx !== -1) {
        states[i] = 'present';
        targetArr[idx] = null;
      }
    });

    return states;
  }

  updateKeyState(letter, state) {
    const priority = { 'correct': 3, 'present': 2, 'absent': 1 };
    const currentPriority = priority[this.keyStates[letter]] || 0;
    const newPriority = priority[state] || 0;

    if (newPriority > currentPriority) {
      this.keyStates[letter] = state;
      const keyEl = this.keyboard.querySelector(`[data-key="${letter}"]`);
      if (keyEl) {
        keyEl.classList.remove('correct', 'present', 'absent');
        keyEl.classList.add(state);
      }
    }
  }

  checkGameEnd(guess) {
    if (guess === this.targetWord) {
      this.gameStatus = 'won';
      const attempts = this.currentRow + 1;
      const payout = attempts <= 3 ? 5000 : 1000;
      this.showMessage(`Ganaste ${payout} $qr`, 'success');
      this.bounceRow(this.currentRow);
      this.updateStats(true, attempts);

      // Award coins via legacy endpoint if not using new flow
      if (!this.serverSynced && this.socket) {
        this.socket.emit('wordle:win', { attempts });
      }

      setTimeout(() => this.showStatsModal(), 2000);
    } else if (this.currentRow >= MAX_ATTEMPTS - 1) {
      this.gameStatus = 'lost';
      this.showMessage(`La palabra era: ${this.targetWord}`, 'error');
      this.updateStats(false);
      setTimeout(() => this.showStatsModal(), 2000);
    }
  }

  // Handle server response for guess
  handleGuessResult(data) {
    const { guess, isCorrect, isGameOver, payout, coins, targetWord, status } = data;

    // Add guess to local list
    this.guesses.push(guess);

    // Reveal the row
    this.revealRow(this.currentRow, guess, () => {
      this.currentRow++;
      this.currentTile = 0;

      if (isCorrect) {
        this.gameStatus = 'won';
        this.showMessage(`Ganaste ${payout} $qr`, 'success');
        this.bounceRow(this.currentRow - 1);
        this.updateStats(true, this.guesses.length);
        setTimeout(() => this.showStatsModal(), 2000);
      } else if (isGameOver) {
        this.gameStatus = 'lost';
        this.showMessage(`La palabra era: ${targetWord}`, 'error');
        this.updateStats(false);
        setTimeout(() => this.showStatsModal(), 2000);
      }

      // Update coins display
      if (this.onCoinsUpdate && coins !== undefined) {
        this.onCoinsUpdate(coins);
      }
    });
  }

  // Load state from server
  loadServerState(data) {
    this.serverSynced = true;
    const { guesses, status, coins, todayKey, stats } = data;

    // Update coins display
    if (this.onCoinsUpdate && coins !== undefined) {
      this.onCoinsUpdate(coins);
    }

    // Check if it's a new day
    if (todayKey !== this.todayKey) {
      // Server might have old data, use local date
      return;
    }

    // Restore guesses
    if (guesses && guesses.length > 0) {
      this.guesses = [...guesses];
      this.gameStatus = status || 'playing';
      this.currentRow = guesses.length;
      this.currentTile = 0;

      // Replay guesses on board (instantly, no animation)
      guesses.forEach((guess, rowIdx) => {
        const states = this.calculateStates(guess);
        for (let c = 0; c < WORD_LENGTH; c++) {
          const tile = this.getTile(rowIdx, c);
          tile.textContent = guess[c];
          tile.classList.add('filled', states[c]);
        }
        // Update keyboard
        for (let i = 0; i < guess.length; i++) {
          this.updateKeyState(guess[i], states[i]);
        }
      });
    }

    // Set game status if already finished
    if (status === 'won') {
      this.gameStatus = 'won';
    } else if (status === 'lost') {
      this.gameStatus = 'lost';
      this.showMessage(`La palabra era: ${this.targetWord}`, 'error');
    }
  }

  getTile(row, col) {
    return this.board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  }

  showMessage(msg, type = '') {
    this.messageEl.textContent = msg;
    this.messageEl.className = 'wordle-message ' + type;
    if (type) {
      setTimeout(() => {
        this.messageEl.textContent = '';
        this.messageEl.className = 'wordle-message';
      }, 3000);
    }
  }

  shakeRow(rowIdx) {
    const row = this.board.querySelector(`[data-row="${rowIdx}"]`);
    row.classList.add('shake');
    setTimeout(() => row.classList.remove('shake'), 500);
  }

  bounceRow(rowIdx) {
    const row = this.board.querySelector(`[data-row="${rowIdx}"]`);
    const tiles = row.querySelectorAll('.wordle-tile');
    tiles.forEach((tile, i) => {
      setTimeout(() => tile.classList.add('bounce'), i * 100);
    });
  }

  // Local state persistence (fallback)
  saveLocalState() {
    const state = {
      date: this.todayKey,
      guesses: this.guesses,
      gameStatus: this.gameStatus,
      keyStates: this.keyStates
    };
    localStorage.setItem('sqrrr_wordle_state', JSON.stringify(state));
  }

  loadLocalState() {
    try {
      const saved = JSON.parse(localStorage.getItem('sqrrr_wordle_state') || '{}');

      // Check if it's a new day
      if (saved.date !== this.todayKey) {
        // New day, reset
        this.guesses = [];
        this.gameStatus = 'playing';
        this.keyStates = {};
        localStorage.removeItem('sqrrr_wordle_state');
        return;
      }

      // Restore state
      this.guesses = saved.guesses || [];
      this.gameStatus = saved.gameStatus || 'playing';
      this.keyStates = saved.keyStates || {};

      // Replay guesses on board
      this.guesses.forEach((guess, rowIdx) => {
        const states = this.calculateStates(guess);
        for (let c = 0; c < WORD_LENGTH; c++) {
          const tile = this.getTile(rowIdx, c);
          tile.textContent = guess[c];
          tile.classList.add('filled', states[c]);
        }
      });

      // Restore keyboard
      Object.entries(this.keyStates).forEach(([letter, state]) => {
        const keyEl = this.keyboard.querySelector(`[data-key="${letter}"]`);
        if (keyEl) keyEl.classList.add(state);
      });

      this.currentRow = this.guesses.length;

    } catch (e) {
      // Reset on error
      localStorage.removeItem('sqrrr_wordle_state');
    }
  }

  // Stats
  getStats() {
    try {
      return JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  updateStats(won, attempts = 0) {
    const stats = this.getStats();
    stats.played = (stats.played || 0) + 1;
    stats.won = (stats.won || 0) + (won ? 1 : 0);
    stats.streak = won ? (stats.streak || 0) + 1 : 0;
    stats.maxStreak = Math.max(stats.maxStreak || 0, stats.streak);
    stats.distribution = stats.distribution || [0, 0, 0, 0, 0, 0];
    if (won && attempts >= 1 && attempts <= 6) {
      stats.distribution[attempts - 1]++;
    }
    stats.lastPlayed = this.todayKey;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  showStatsModal() {
    const modal = document.getElementById('wordle-stats-modal');
    const stats = this.getStats();

    document.getElementById('wordle-stat-played').textContent = stats.played || 0;
    document.getElementById('wordle-stat-win-pct').textContent =
      stats.played ? Math.round((stats.won || 0) / stats.played * 100) : 0;
    document.getElementById('wordle-stat-streak').textContent = stats.streak || 0;
    document.getElementById('wordle-stat-max-streak').textContent = stats.maxStreak || 0;

    // Distribution bars
    const dist = stats.distribution || [0, 0, 0, 0, 0, 0];
    const maxDist = Math.max(...dist, 1);
    const barsContainer = document.getElementById('wordle-distribution-bars');
    barsContainer.innerHTML = '';

    dist.forEach((count, i) => {
      const row = document.createElement('div');
      row.className = 'wordle-dist-row';
      const highlight = (this.gameStatus === 'won' && i === this.guesses.length - 1) ? 'highlight' : '';
      const width = Math.max(8, (count / maxDist) * 100);
      row.innerHTML = `
        <span>${i + 1}</span>
        <div class="wordle-dist-bar ${highlight}" style="width: ${width}%">${count}</div>
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

  hideStatsModal() {
    document.getElementById('wordle-stats-modal').classList.remove('active');
  }

  setupSocketHandlers() {
    if (!this.socket) return;

    // Prevent duplicate handlers - only set up once
    if (this.socketHandlersSetup) return;
    this.socketHandlersSetup = true;

    // Remove any existing listeners first
    this.socket.off('sqrrrdle:state');
    this.socket.off('sqrrrdle:guessResult');
    this.socket.off('sqrrrdle:error');
    this.socket.off('wordle:coins');

    // Handle server state response
    this.socket.on('sqrrrdle:state', (data) => {
      this.loadServerState(data);
    });

    // Handle guess result from server
    this.socket.on('sqrrrdle:guessResult', (data) => {
      this.handleGuessResult(data);
    });

    // Handle errors
    this.socket.on('sqrrrdle:error', (data) => {
      this.showMessage(data.message || 'Error', 'error');
      this.shakeRow(this.currentRow);
    });

    // Legacy coin updates
    this.socket.on('wordle:coins', (data) => {
      if (this.onCoinsUpdate) {
        this.onCoinsUpdate(data.coins);
      }
    });
  }

  destroy() {
    // Remove keydown listener
    if (boundKeydownHandler) {
      document.removeEventListener('keydown', boundKeydownHandler);
      boundKeydownHandler = null;
    }

    // Remove socket listeners
    if (this.socket) {
      this.socket.off('sqrrrdle:state');
      this.socket.off('sqrrrdle:guessResult');
      this.socket.off('sqrrrdle:error');
      this.socket.off('wordle:coins');
    }

    this.socketHandlersSetup = false;
  }
}
