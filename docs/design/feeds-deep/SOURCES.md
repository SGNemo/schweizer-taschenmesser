# Feeds starter catalogue – sources

Data: `web/src/modules/feeds/catalog.json` (checked by `feeds.catalog.test.ts`: https only, no tracking parameters, every group in de and en, every row listed here).

## How the sources were picked
- Public, free to read without an account, run by the publisher itself (public broadcasters, established newsrooms, magazines); no aggregators except Hacker News (community front page, via hnrss.org).
- The feed address is the one the publisher names on its own RSS/feed page or in the `<link rel="alternate">` of its home page; no tracking parameters, no affiliate links, no feed-proxy services.
- Mix per group: at least two per language; public-service first, then independent and commercial outlets. "Local" lists regional public broadcasters (de) and regional sections (en); more regions belong in a later pass, not in a longer list.
- **Not verified in the build session** (its network allows none of these hosts). Before a release: open each address once (the add dialog shows the latest articles from package 2 on) and fix or remove a dead one; the test keeps the list shape, not the reachability.

## List
| id | lang | group | source | feed | site |
| --- | --- | --- | --- | --- | --- |
| `tagesschau` | de | news | tagesschau.de | https://www.tagesschau.de/index~rss2.xml | https://www.tagesschau.de/ |
| `dlf-nachrichten` | de | news | Deutschlandfunk Nachrichten | https://www.deutschlandfunk.de/nachrichten-100.rss | https://www.deutschlandfunk.de/ |
| `zeit` | de | news | ZEIT ONLINE | https://newsfeed.zeit.de/index | https://www.zeit.de/ |
| `spiegel` | de | news | DER SPIEGEL | https://www.spiegel.de/schlagzeilen/index.rss | https://www.spiegel.de/ |
| `heise` | de | tech | heise online | https://www.heise.de/rss/heise-atom.xml | https://www.heise.de/ |
| `golem` | de | tech | Golem.de | https://rss.golem.de/rss.php?feed=ATOM1.0 | https://www.golem.de/ |
| `netzpolitik` | de | tech | netzpolitik.org | https://netzpolitik.org/feed/ | https://netzpolitik.org/ |
| `t3n` | de | tech | t3n | https://t3n.de/rss.xml | https://t3n.de/ |
| `spektrum` | de | science | Spektrum der Wissenschaft | https://www.spektrum.de/alias/rss/spektrum-de-rss-feed/996406 | https://www.spektrum.de/ |
| `scinexx` | de | science | scinexx | https://www.scinexx.de/feed/ | https://www.scinexx.de/ |
| `dlf-forschung` | de | science | Deutschlandfunk Forschung aktuell | https://www.deutschlandfunk.de/forschung-aktuell-102.rss | https://www.deutschlandfunk.de/ |
| `sportschau` | de | sport | Sportschau | https://www.sportschau.de/index~rss2.xml | https://www.sportschau.de/ |
| `kicker` | de | sport | kicker | https://newsfeed.kicker.de/news/aktuell | https://www.kicker.de/ |
| `gamestar` | de | gaming | GameStar | https://www.gamestar.de/news/rss/news.rss | https://www.gamestar.de/ |
| `gamepro` | de | gaming | GamePro | https://www.gamepro.de/rss/gamepro.rss | https://www.gamepro.de/ |
| `ndr` | de | local (Norddeutschland) | NDR | https://www.ndr.de/home/index-rss.xml | https://www.ndr.de/ |
| `wdr` | de | local (Nordrhein-Westfalen) | WDR | https://www1.wdr.de/uebersicht-100.feed | https://www1.wdr.de/ |
| `mdr` | de | local (Mitteldeutschland) | MDR | https://www.mdr.de/nachrichten/index-rss.xml | https://www.mdr.de/ |
| `rbb24` | de | local (Berlin und Brandenburg) | rbb24 | https://www.rbb24.de/aktuell/index.xml/feed=rss.xml | https://www.rbb24.de/ |
| `orf` | de | local (Österreich) | ORF.at | https://rss.orf.at/news.xml | https://orf.at/ |
| `srf` | de | local (Schweiz) | SRF News | https://www.srf.ch/news/bnf/rss/1646 | https://www.srf.ch/news |
| `bbc-news` | en | news | BBC News | https://feeds.bbci.co.uk/news/rss.xml | https://www.bbc.co.uk/news |
| `guardian-world` | en | news | The Guardian – World | https://www.theguardian.com/world/rss | https://www.theguardian.com/world |
| `npr` | en | news | NPR News | https://feeds.npr.org/1001/rss.xml | https://www.npr.org/ |
| `aljazeera` | en | news | Al Jazeera English | https://www.aljazeera.com/xml/rss/all.xml | https://www.aljazeera.com/ |
| `ars` | en | tech | Ars Technica | https://feeds.arstechnica.com/arstechnica/index | https://arstechnica.com/ |
| `verge` | en | tech | The Verge | https://www.theverge.com/rss/index.xml | https://www.theverge.com/ |
| `hn` | en | tech | Hacker News (front page) | https://hnrss.org/frontpage | https://news.ycombinator.com/ |
| `quanta` | en | science | Quanta Magazine | https://www.quantamagazine.org/feed/ | https://www.quantamagazine.org/ |
| `sciencedaily` | en | science | ScienceDaily | https://www.sciencedaily.com/rss/all.xml | https://www.sciencedaily.com/ |
| `nature` | en | science | Nature | https://www.nature.com/nature.rss | https://www.nature.com/ |
| `bbc-sport` | en | sport | BBC Sport | https://feeds.bbci.co.uk/sport/rss.xml | https://www.bbc.co.uk/sport |
| `guardian-sport` | en | sport | The Guardian – Sport | https://www.theguardian.com/uk/sport/rss | https://www.theguardian.com/uk/sport |
| `espn` | en | sport | ESPN | https://www.espn.com/espn/rss/news | https://www.espn.com/ |
| `rps` | en | gaming | Rock Paper Shotgun | https://www.rockpapershotgun.com/feed | https://www.rockpapershotgun.com/ |
| `eurogamer` | en | gaming | Eurogamer | https://www.eurogamer.net/feed | https://www.eurogamer.net/ |
| `polygon` | en | gaming | Polygon | https://www.polygon.com/rss/index.xml | https://www.polygon.com/ |
| `bbc-london` | en | local (London) | BBC News – London | https://feeds.bbci.co.uk/news/england/london/rss.xml | https://www.bbc.co.uk/news/england/london |
| `bbc-scotland` | en | local (Scotland) | BBC News – Scotland | https://feeds.bbci.co.uk/news/scotland/rss.xml | https://www.bbc.co.uk/news/scotland |
| `nyt-nyregion` | en | local (New York) | The New York Times – N.Y. Region | https://rss.nytimes.com/services/xml/rss/nyt/NYRegion.xml | https://www.nytimes.com/section/nyregion |
