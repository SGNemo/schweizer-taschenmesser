import { useState } from 'react';
import { Link } from 'react-router';
import { BackupExportDialog } from '@/core/backup/BackupExport';
import { useModuleStates } from '@/core/modules/activation';
import { getPlatform } from '@/core/platform';
import { StatusLineLink } from '@/core/status/StatusLineLink';
import { t } from '@/strings';
import { Button, PageHeader } from '@/ui';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { useDeviceStatus } from '../useDeviceStatus';
import styles from './StatusPage.module.css';

/**
 * `/device`: how this device is doing, as lines in four groups. Every line is a link to the settings page where the
 * thing is set; nothing is switched here. The one action is "Backup herunterladen" under the backup lines (follow-up
 * 16 of 0b-8): it opens the settings' export form in a dialog (password recommended, readable file only as the
 * second button there), never a file in one click, and it stays calm (secondary, no colour, no reminder).
 * The phone shows the same page without the desktop's lines.
 */
export default function StatusPage() {
  const d = t.device;
  const { groups, look, noBackup, ready } = useDeviceStatus();
  // CPU, memory and network live in "Dieser PC" → System (desktop only); this page points there instead of repeating them.
  const desktop = getPlatform().kind === 'desktop';
  const diskOn = useModuleStates()?.disk === true;
  const [exporting, setExporting] = useState(false);
  return (
    <>
      <PageHeader title={d.meta.name} />
      {/* Head and lines wait for the first reads and then come together (no line fills in, no "Kein Backup" first). */}
      {ready ? (
        <HeroSlot area="figure">
          {/* One short figure: calm words while all is well (or while only the backup is missing: said, never red),
              else how many lines need a look and which. */}
          <HeroFigure
            value={
              look.length > 0 ? String(look.length) : noBackup ? d.summary.noBackup : d.summary.ok
            }
            unit={look.length === 0 ? undefined : d.page.figureUnit(look.length)}
            // All well: the words say it. Otherwise the names of the lines that need a look (short, never cut).
            detail={look.length === 0 ? undefined : look.map((l) => l.title).join(', ')}
            testId="device-summary"
          />
        </HeroSlot>
      ) : null}
      <div className={styles.page} data-testid="device-status" aria-busy={!ready}>
        {ready ? (
          <>
            {groups.map((group) => (
              // The line names say what each group is; the space between groups is enough (no heading on top).
              <ul
                key={group.id}
                aria-label={group.title}
                className={styles.lines}
                data-testid={`device-group-${group.id}`}
              >
                {group.lines.map((line) => (
                  <li key={line.id}>
                    <StatusLineLink line={line} layout="columns" />
                  </li>
                ))}
                {group.id === 'backup' ? (
                  <li className={styles.action}>
                    <Button onClick={() => setExporting(true)} data-testid="device-backup-export">
                      {t.backup.export}
                    </Button>
                  </li>
                ) : null}
              </ul>
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
          </>
        ) : null}
      </div>
      <BackupExportDialog open={exporting} onClose={() => setExporting(false)} />
    </>
  );
}
