/**
 * Is a place in Germany? Official DWD warnings are asked only then (CONCEPT-SOURCES §1): a simplified border, never
 * a bounding box (a box would send Zürich, Salzburg or Prague to the DWD). Decided on the device.
 *
 * Source: VG250 state borders, © GeoBasis-DE / BKG 2021 (dl-de/by-2-0), as served by the DWD GeoServer
 * (`dwd:KV_VG250_BUNDESLAENDER_2020`), merged into one outline, simplified with Douglas–Peucker at 1.5 km, islands
 * under 20 km² dropped, and stored as Google-polyline strings at 0.01° ([lat, lon] deltas). Checked against towns on
 * both sides of the border in `germany.test.ts`.
 */
const RINGS: readonly string[] = [
  'a~Huc@NEAYH@@MLB?HFA@JDKHA?OJI?CB??OTLFE?WD@@ELDJM@HAHHDDRJA@HDANFTMCABEHADODAAGFM?SP@HPH@HJ@CP@AKHWD@DKBDLSVM@QEEEBASDSNAIIFK@YEMEAAOBBAKLGDSB??YCEFOEML]B[LNRJFVF@NVn@TLADHNBRPN@LIPJ\\@DFVQCQD?@JBGAWGE?MHIC]KU@QFE?KAUCDEKDKGCAECBDZEJSKAUE@@IFAGEFE?GL?BKCCEFCGDA@IBBBEEWGJ@MCBHWCLBAFYCGKHIRGDNc@LQBe@JI?IHO@KKEAEHCBICABGCIJE?GDIDCBFJEGO@KTLE_@MKAIIGMHKCDWGE@QHQEUDEDH?MHGD@?]EQ?GDD?IIM@OEFIK@YOM@g@CAE_@Be@QFGSJ?Cc@LK?MGG?a@BBFKDFBARk@EGQ@KKIBEJ@HALYSQJCLIBMPI?@EOOAQIKK}@KQYGIB?GEENk@USMBAEAHKIAFUJ?NKDCRDDIRK?MTATG@QZG?GPA\\GDGRQBCHOD?DM@ANIFGMG?QOCLGA?JMTAJCCENKCMLAJEIGF?OHC?IBC?DDIF?@GM??EOGEQICC_@BGECCKBCEAJYIMKA@a@QI@MMIHQGKKAE[@GCI@SAGI?EQ@QI[GI?WGAAPGA?JKGDUCGBGCCB@DSLFAQLDFS?OMCQSy@WQLUBKj@EBIII?MPMBCJOSa@MINWGIZUHQSGDGGQ`@QVQl@IGMBQi@QGK@KMw@ZOAAFI?CLIKAFBH?NSv@G?GQU`@CIIAIRC?BFB`@FA?FMHBDEE@PCEIJALEDBHCGANQ@EJG?DTFFDLKBDHEFDBGEHVCFF@@LDABLDI?JIFOO?]C@EKBECCBUCYC@?fAGFd@b@Vn@@GBFD?DICJO?Fn@?`@N\\B?IO@CJJ?HJHFABF@CKXDFAFGAGN@XH`@E@APIBKIBKUk@]DGMBTAPLZ@NKTOv@DPRREEEBCIGBEEELFr@CFIa@]E?NH@Ld@BB?G@LDAC^COB?AOKKI_@GAEGDIULCHF??JGJEd@IAJ\\DBIDFL?HAFG@Ix@@j@CPBD@d@EHKBIQC?AF?KAH\\T^B@CS?GGDMESAQHALQDC@D@IFADOHKLBDJD?@OKQHIL^?f@BBBGBPDADKA_@\\?BEAMLE?EDDCNDN?EX[?q@Jc@NEFQPK?BHUB_@B@CXK\\q@t@?b@BL@AAF@`@KX@NDF^PPEJMDBIF@JK`@DHJ@?OJAJLMb@G@?QECKB?DGF?FMD@|@D`@Cd@Jb@JLFG?R^DDEBw@?JNFJCFHXG^Xh@DA|@BFFADI@PJCDIBe@EIRONFHG@NTX?RF@@JD?H[PRCHLh@CNFAGV?LGJBHHMETHTFGFD@MH?BQHDRW\\CV^LACQBD@GNb@HFGHBF',
  '}mIoh@DOA@?IAFCQCJDT',
  'unIsk@Ai@@h@',
  'ynIsm@Cc@A\\DD',
  'utIyr@JO?EOJCCFL',
  '}tIms@Da@GGEBAH@RFF',
  'wsIut@DEAOIADV',
  'isIwcABIADAOHC?KCA@A@USNCJCTPJ',
  'mpIafADKGCFAKGDX',
  'qrI}pADO?FB@CIDABMEMDB?DDSGE?J@?C@?GIMC@AYBECMDLAQDH?IBA?D@GG?EIKR?JKFKSGAEH@h@KFGIBb@RPQWPFCQEGJOCKP@@IBD@G@F@A?HCEAFEE@HCFMD@DBG@FKCDLF?IJ@RFE?KB?@GDRDBAKHI@XFB',
  'gsI_qAGUALHF',
  'oqI}tAHKPFEQH?GKC@?KHE@IJ@CJDDKA?HNEJT@OGCFAES?a@GBCGWh@K\\KJ@J',
];

/** Polyline string → [lon, lat] points. */
function decode(s: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = (): number => {
    let shift = 0;
    let v = 0;
    let b: number;
    do {
      b = s.charCodeAt(i++) - 63;
      v |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return v & 1 ? ~(v >> 1) : v >> 1;
  };
  while (i < s.length) {
    lat += next();
    lon += next();
    out.push([lon / 100, lat / 100]);
  }
  return out;
}

let rings: [number, number][][] | undefined;

/** True when the position lies inside the simplified border of Germany (islands included). */
export function inGermany(lat: number, lon: number): boolean {
  if (lat < 47 || lat > 55.2 || lon < 5.8 || lon > 15.1) return false;
  rings ??= RINGS.map(decode);
  return rings.some((r) => {
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i]!;
      const [xj, yj] = r[j]!;
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  });
}
