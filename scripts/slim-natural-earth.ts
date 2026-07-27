/**
 * Slim Natural Earth admin-0 country GeoJSON files for runtime use.
 *
 * Natural Earth ships ~150 attribute columns per feature; the political-map
 * renderer only needs the geometry, an English name, the localized names for
 * the app's supported languages, the label anchor point, and the label ranking
 * used for zoom-based decluttering. Stripping the rest and truncating
 * coordinate precision cuts file size by roughly half.
 *
 * Usage: npx tsx scripts/slim-natural-earth.ts
 * Rewrites whichever public/data/ne_{110m,50m,10m}_admin_0_countries.geojson
 * files exist in place. Only the 50m dataset ships today - a 110m/50m/10m
 * auto-LOD design was tried and dropped (the generalization levels are not
 * coincident, so LOD swaps visibly shifted borders, and the 10m parse stalled
 * the main thread). Idempotent - already-slimmed files pass through unchanged.
 * Source data: https://www.naturalearthdata.com/downloads/ (admin 0 - countries).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** App locales with a Natural Earth NAME_* column (cs has none; falls back to en). */
const NE_LOCALE_COLUMNS: Record<string, string> = {
  de: 'NAME_DE',
  es: 'NAME_ES',
  fr: 'NAME_FR',
  it: 'NAME_IT',
  ja: 'NAME_JA',
  ko: 'NAME_KO',
  pl: 'NAME_PL',
  ru: 'NAME_RU',
  uk: 'NAME_UK',
  zh: 'NAME_ZH',
};

/** Decimal places kept per dataset: ~11 m for 10m data, ~111 m for the rest. */
const PRECISION: Record<string, number> = {
  '10m': 4,
  '50m': 3,
  '110m': 3,
};

/**
 * Czech country names keyed by the Natural Earth English `name` column. NE has
 * no NAME_CS attribute, so Czech (an app language) is baked in here; anything
 * missing from this map falls back to the English name at runtime.
 */
const CS_NAMES: Record<string, string> = {
  'Afghanistan': 'Afghánistán',
  'Åland': 'Alandy',
  'Albania': 'Albánie',
  'Algeria': 'Alžírsko',
  'American Samoa': 'Americká Samoa',
  'Antarctica': 'Antarktida',
  'Antigua and Barb.': 'Antigua a Barbuda',
  'Armenia': 'Arménie',
  'Australia': 'Austrálie',
  'Austria': 'Rakousko',
  'Azerbaijan': 'Ázerbájdžán',
  'Bahamas': 'Bahamy',
  'Bahrain': 'Bahrajn',
  'Bangladesh': 'Bangladéš',
  'Belarus': 'Bělorusko',
  'Belgium': 'Belgie',
  'Bermuda': 'Bermudy',
  'Bhutan': 'Bhútán',
  'Bolivia': 'Bolívie',
  'Bosnia and Herz.': 'Bosna a Hercegovina',
  'Br. Indian Ocean Ter.': 'Britské indickooceánské území',
  'Brazil': 'Brazílie',
  'British Virgin Is.': 'Britské Panenské ostrovy',
  'Brunei': 'Brunej',
  'Bulgaria': 'Bulharsko',
  'Cabo Verde': 'Kapverdy',
  'Cambodia': 'Kambodža',
  'Cameroon': 'Kamerun',
  'Canada': 'Kanada',
  'Cayman Is.': 'Kajmanské ostrovy',
  'Central African Rep.': 'Středoafrická republika',
  'Chad': 'Čad',
  'China': 'Čína',
  'Colombia': 'Kolumbie',
  'Comoros': 'Komory',
  'Congo': 'Kongo',
  'Cook Is.': 'Cookovy ostrovy',
  'Costa Rica': 'Kostarika',
  "Côte d'Ivoire": 'Pobřeží slonoviny',
  'Croatia': 'Chorvatsko',
  'Cuba': 'Kuba',
  'Cyprus': 'Kypr',
  'Czechia': 'Česko',
  'Dem. Rep. Congo': 'DR Kongo',
  'Denmark': 'Dánsko',
  'Djibouti': 'Džibutsko',
  'Dominica': 'Dominika',
  'Dominican Rep.': 'Dominikánská republika',
  'Ecuador': 'Ekvádor',
  'El Salvador': 'Salvador',
  'Eq. Guinea': 'Rovníková Guinea',
  'Estonia': 'Estonsko',
  'Ethiopia': 'Etiopie',
  'Faeroe Is.': 'Faerské ostrovy',
  'Falkland Is.': 'Falklandy',
  'Fiji': 'Fidži',
  'Finland': 'Finsko',
  'Fr. Polynesia': 'Francouzská Polynésie',
  'Fr. S. Antarctic Lands': 'Francouzská jižní území',
  'France': 'Francie',
  'Gambia': 'Gambie',
  'Georgia': 'Gruzie',
  'Germany': 'Německo',
  'Greece': 'Řecko',
  'Greenland': 'Grónsko',
  'Heard I. and McDonald Is.': 'Heardův a McDonaldovy ostrovy',
  'Hong Kong': 'Hongkong',
  'Hungary': 'Maďarsko',
  'Iceland': 'Island',
  'India': 'Indie',
  'Indian Ocean Ter.': 'Australská indickooceánská území',
  'Indonesia': 'Indonésie',
  'Iran': 'Írán',
  'Iraq': 'Irák',
  'Ireland': 'Irsko',
  'Isle of Man': 'Ostrov Man',
  'Israel': 'Izrael',
  'Italy': 'Itálie',
  'Jamaica': 'Jamajka',
  'Japan': 'Japonsko',
  'Jordan': 'Jordánsko',
  'Kazakhstan': 'Kazachstán',
  'Kenya': 'Keňa',
  'Kuwait': 'Kuvajt',
  'Kyrgyzstan': 'Kyrgyzstán',
  'Latvia': 'Lotyšsko',
  'Lebanon': 'Libanon',
  'Liberia': 'Libérie',
  'Libya': 'Libye',
  'Liechtenstein': 'Lichtenštejnsko',
  'Lithuania': 'Litva',
  'Luxembourg': 'Lucembursko',
  'Madagascar': 'Madagaskar',
  'Malaysia': 'Malajsie',
  'Maldives': 'Maledivy',
  'Marshall Is.': 'Marshallovy ostrovy',
  'Mauritania': 'Mauritánie',
  'Mauritius': 'Mauricius',
  'Mexico': 'Mexiko',
  'Micronesia': 'Mikronésie',
  'Moldova': 'Moldavsko',
  'Monaco': 'Monako',
  'Mongolia': 'Mongolsko',
  'Montenegro': 'Černá Hora',
  'Morocco': 'Maroko',
  'Mozambique': 'Mosambik',
  'N. Cyprus': 'Severní Kypr',
  'N. Mariana Is.': 'Severní Mariany',
  'Namibia': 'Namibie',
  'Nepal': 'Nepál',
  'Netherlands': 'Nizozemsko',
  'New Caledonia': 'Nová Kaledonie',
  'New Zealand': 'Nový Zéland',
  'Nicaragua': 'Nikaragua',
  'Nigeria': 'Nigérie',
  'Norfolk Island': 'Norfolk',
  'North Korea': 'Severní Korea',
  'North Macedonia': 'Severní Makedonie',
  'Norway': 'Norsko',
  'Oman': 'Omán',
  'Pakistan': 'Pákistán',
  'Palestine': 'Palestina',
  'Papua New Guinea': 'Papua Nová Guinea',
  'Philippines': 'Filipíny',
  'Pitcairn Is.': 'Pitcairnovy ostrovy',
  'Poland': 'Polsko',
  'Portugal': 'Portugalsko',
  'Puerto Rico': 'Portoriko',
  'Qatar': 'Katar',
  'Romania': 'Rumunsko',
  'Russia': 'Rusko',
  'S. Geo. and the Is.': 'Jižní Georgie',
  'S. Sudan': 'Jižní Súdán',
  'Saint Helena': 'Svatá Helena',
  'Saint Lucia': 'Svatá Lucie',
  'São Tomé and Principe': 'Svatý Tomáš a Princův ostrov',
  'Saudi Arabia': 'Saúdská Arábie',
  'Serbia': 'Srbsko',
  'Seychelles': 'Seychely',
  'Siachen Glacier': 'Ledovec Siačen',
  'Singapore': 'Singapur',
  'Slovakia': 'Slovensko',
  'Slovenia': 'Slovinsko',
  'Solomon Is.': 'Šalamounovy ostrovy',
  'Somalia': 'Somálsko',
  'South Africa': 'Jihoafrická republika',
  'South Korea': 'Jižní Korea',
  'Spain': 'Španělsko',
  'Sri Lanka': 'Šrí Lanka',
  'St. Kitts and Nevis': 'Svatý Kryštof a Nevis',
  'St. Pierre and Miquelon': 'Saint-Pierre a Miquelon',
  'St. Vin. and Gren.': 'Svatý Vincenc a Grenadiny',
  'St-Barthélemy': 'Svatý Bartoloměj',
  'St-Martin': 'Svatý Martin',
  'Sudan': 'Súdán',
  'Suriname': 'Surinam',
  'Sweden': 'Švédsko',
  'Switzerland': 'Švýcarsko',
  'Syria': 'Sýrie',
  'Taiwan': 'Tchaj-wan',
  'Tajikistan': 'Tádžikistán',
  'Tanzania': 'Tanzanie',
  'Thailand': 'Thajsko',
  'Timor-Leste': 'Východní Timor',
  'Trinidad and Tobago': 'Trinidad a Tobago',
  'Tunisia': 'Tunisko',
  'Turkey': 'Turecko',
  'Turkmenistan': 'Turkmenistán',
  'Turks and Caicos Is.': 'Turks a Caicos',
  'U.S. Virgin Is.': 'Americké Panenské ostrovy',
  'Ukraine': 'Ukrajina',
  'United Arab Emirates': 'Spojené arabské emiráty',
  'United Kingdom': 'Spojené království',
  'United States of America': 'Spojené státy',
  'Uzbekistan': 'Uzbekistán',
  'Vatican': 'Vatikán',
  'W. Sahara': 'Západní Sahara',
  'Wallis and Futuna Is.': 'Wallis a Futuna',
  'Yemen': 'Jemen',
  'Zambia': 'Zambie',
};

type Position = number[];
type CoordinateTree = Position | CoordinateTree[];

interface NeFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: CoordinateTree } | null;
}

const roundTree = (tree: CoordinateTree, factor: number): CoordinateTree => {
  if (typeof tree[0] === 'number') {
    return (tree as Position).map((v) => Math.round(v * factor) / factor);
  }

  return (tree as CoordinateTree[]).map((child) => roundTree(child, factor));
};

const slimFeature = (feature: NeFeature, factor: number): NeFeature | null => {
  if (!feature.geometry) {
    return null;
  }

  const p = feature.properties;
  const properties: Record<string, unknown> = {
    name: p.NAME ?? p.name,
    labelX: p.LABEL_X ?? p.labelX,
    labelY: p.LABEL_Y ?? p.labelY,
    labelRank: p.LABELRANK ?? p.labelRank,
    minLabel: p.MIN_LABEL ?? p.minLabel,
    maxLabel: p.MAX_LABEL ?? p.maxLabel,
  };

  for (const [locale, column] of Object.entries(NE_LOCALE_COLUMNS)) {
    const localized = p[column] ?? (p.names as Record<string, unknown> | undefined)?.[locale];

    if (localized && localized !== properties.name) {
      properties.names = { ...(properties.names as Record<string, unknown> | undefined), [locale]: localized };
    }
  }

  const csName = CS_NAMES[properties.name as string];

  if (csName && csName !== properties.name) {
    properties.names = { ...(properties.names as Record<string, unknown> | undefined), cs: csName };
  }

  return {
    type: 'Feature',
    properties,
    geometry: {
      type: feature.geometry.type,
      coordinates: roundTree(feature.geometry.coordinates, factor),
    },
  };
};

for (const [scale, decimals] of Object.entries(PRECISION)) {
  const file = join(import.meta.dirname, '..', 'public', 'data', `ne_${scale}_admin_0_countries.geojson`);

  if (!existsSync(file)) {
    continue;
  }

  const raw = JSON.parse(readFileSync(file, 'utf8')) as { features: NeFeature[] };
  const factor = 10 ** decimals;
  const features = raw.features.map((f) => slimFeature(f, factor)).filter((f) => f !== null);
  const out = JSON.stringify({ type: 'FeatureCollection', features });

  writeFileSync(file, `${out}\n`);
  // eslint-disable-next-line no-console
  console.log(`${scale}: ${features.length} features, ${(out.length / 1024 / 1024).toFixed(2)} MiB`);
}
