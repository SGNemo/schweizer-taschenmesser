import { Link } from 'react-router';
import { useModuleStates } from '@/core/modules/activation';
import { getPlatform } from '@/core/platform';
import { StatusLineLink } from '@/core/status/StatusLineLink';
import { t } from '@/strings';
import { PageHeader } from '@/ui';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { useDeviceStatus } from '../useDeviceStatus';
import styles from './StatusPage.module.css';

/**
 * `/device`: how this device is doing, as lines in four groups. Display only: every line is a link to the settings
 * page where the thing is set; nothing is switched here. The phone shows the same page without the desktop's lines.
 */
export default function StatusPage() {
  const d = t.device;
  const { groups, look } = useDeviceStatus();
  // CPU, memory and network live in "Dieser PC" → System (desktop only); this page points there instead of repeating them.
  const desktop = getPlatform().kind === 'desktop';
  const diskOn = useModuleStates()?.disk === true;
  return (
    <>
      <PageHeader title={d.meta.name} />
      <HeroSlot area="figure">
        {/* One short figure: calm words while all is well, else how many lines need a look and which. */}
        <HeroFigure
          value={look.length === 0 ? d.summary.ok : String(look.length)}
          unit={look.length === 0 ? undefined : d.page.figureUnit(look.length)}
          // All well: the words say it. Otherwise the names of the lines that need a look (short, never cut).
          detail={look.length === 0 ? undefined : look.map((l) => l.title).join(', ')}
          testId="device-summary"
        />
      </HeroSlot>
      <div className={styles.page} data-testid="device-status">
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`device-${group.id}`} className={styles.group}>
            <h2 id={`device-${group.id}`} className={styles.heading}>
              {group.title}
            </h2>
            <ul className={styles.lines}>
              {group.lines.map((line) => (
                <li key={line.id}>
                  <StatusLineLink line={line} layout="columns" />
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className={styles.more}>{d.page.note}</p>
        {desktop ? (
          <p className={styles.more} data-testid="device-pc">
            {d.page.pc}{' '}
            <Link to={diskOn ? '/disk?tab=system' : '/library'}>
              {diskOn ? d.page.pcOpen : d.page.pcLibrary}
            </Link>
          </p>
        ) : null}
      </div>
    </>
  );
}
