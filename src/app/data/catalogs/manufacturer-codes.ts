/**
 * Maps GCAT OrgCodes for satellite manufacturers to full company names.
 * Source: Jonathan McDowell's GCAT Organizations Database
 * https://planet4589.org/space/gcat/web/orgs/index.html
 *
 * Multi-manufacturer uses "/" separator (e.g., "EADSB/THALR").
 */
export const manufacturerCodeMap: Record<string, string> = {
  // Lockheed Martin family
  LMSC: 'Lockheed Martin Space',
  LMSS: 'Lockheed Martin Space Systems',
  LMVF: 'Lockheed Martin (Valley Forge)',
  LMEW: 'Lockheed Martin (East Windsor)',
  LMCSS: 'Lockheed Martin Commercial Space Systems',
  LM: 'Lockheed Martin',
  LMSSD: 'Lockheed Martin Space Systems Division',

  // Northrop Grumman family
  NGST: 'Northrop Grumman Space Technology',
  NGISD: 'Northrop Grumman Innovation Systems',
  NGISGA: 'Northrop Grumman Innovation Systems (Gilbert, AZ)',
  NGAS: 'Northrop Grumman Aerospace Systems',

  // Ball Aerospace
  BALL: 'Ball Aerospace',

  // Boeing
  BOES: 'Boeing Satellite Systems',
  BSS: 'Boeing Satellite Systems',

  // TRW / Orbital Sciences (now Northrop Grumman)
  TRW: 'TRW Inc.',
  OSCGA: 'Orbital Sciences Corporation',
  OSCD: 'Orbital Sciences Corporation',
  ORBATK: 'Orbital ATK',

  // Airbus / EADS / Astrium family
  EASF: 'EADS Astrium (Friedrichshafen)',
  ASTD: 'Astrium',
  ADSB: 'Airbus Defence and Space (Bremen)',
  ADSUK: 'Airbus Defence and Space (Stevenage)',
  ADSM: 'Airbus Defence and Space (Madrid)',
  ADSDF: 'Airbus Defence and Space (Friedrichshafen)',
  EADSB: 'EADS Astrium',
  ADS: 'Airbus Defence and Space',
  AIRBUS: 'Airbus Defence and Space',

  // Thales family
  THALES: 'Thales Alenia Space',
  THALR: 'Thales Alenia Space (Rome)',
  THALT: 'Thales Alenia Space (Turin)',
  TAS: 'Thales Alenia Space',

  // Alenia (now Thales Alenia Space)
  ALEN: 'Alenia Spazio',

  // OHB
  OHB: 'OHB System AG',

  // Other European
  SSTL: 'Surrey Satellite Technology Ltd',
  SSFL: 'SSTL (Farnborough)',

  // SpaceX
  SPX: 'SpaceX',

  // Sierra Nevada
  SNVL: 'Sierra Nevada Corporation',
  SNC: 'Sierra Nevada Corporation',

  // APL
  APL: 'Johns Hopkins Applied Physics Lab',

  // China
  CAST: 'China Academy of Space Technology',
  SISE: 'Shanghai Institute of Satellite Engineering',
  SECM: 'Shanghai Engineering Center for Microsatellites',
  DFH: 'DFH Satellite Co.',

  // India
  ISAC: 'ISRO Satellite Centre',
  URSC: 'U R Rao Satellite Centre',

  // Japan
  MELCO: 'Mitsubishi Electric Corporation',
  MHITO: 'Mitsubishi Heavy Industries',
  NEC: 'NEC Corporation',

  // Russia
  RESH: 'ISS Reshetnev',
  LAVK: 'NPO Lavochkin',
  ENRG: 'RSC Energia',
  KHRN: 'Khrunichev State Research and Production Space Center',
  TSKB: 'TsSKB Progress',
  VNIL: 'VNIIEM',

  // South Korea
  KARI: 'Korea Aerospace Research Institute',
  KAI: 'Korea Aerospace Industries',

  // Israel
  IAI: 'Israel Aerospace Industries',
  ELTA: 'ELTA Systems',

  // Composite keys for common multi-manufacturer entries
  'EADSB/THALR': 'EADS Astrium / Thales Alenia Space',
};
