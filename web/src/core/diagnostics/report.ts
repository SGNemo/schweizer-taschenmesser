import { getAboutInfo, type AboutInfo } from '@/core/about/info';
import { getPlatform } from '@/core/platform';
import { tDiag } from '@/strings.diagnostics';
import { scrub } from './errorLog';
import { REPORT_MAIL, REPORT_REPO_URL } from './config';

/** Dropdown labels of `.github/ISSUE_TEMPLATE/bug_report.yml` (prefill must match exactly). */
const PLATFORM_OPTION: Record<AboutInfo['platform'], string> = {
  desktop: 'Windows (Nemo-Portable.exe)',
  android: 'Android (Nemo.apk)',
  web: 'PWA im Browser',
};

/** Facts for the form: version, build, platform only (no user data, no paths). */
export interface ReportFacts {
  version: string;
  build: string;
  platform: string;
}

export async function reportFacts(): Promise<ReportFacts> {
  const i = await getAboutInfo();
  return {
    version: i.version,
    build: `${i.commit || '-'} ${i.channel}`,
    platform: PLATFORM_OPTION[i.platform],
  };
}

/** Optional error context (a caught error's name/message), scrubbed. */
export function issueUrl(f: ReportFacts, context?: string): string {
  const q = new URLSearchParams({
    template: 'bug_report.yml',
    labels: 'bug',
    version: f.version,
    build: f.build,
    platform: f.platform,
    steps: tDiag.get().report.stepsPlaceholder,
  });
  if (context) q.set('extra', scrub(context).slice(0, 300));
  return `${REPORT_REPO_URL}/issues/new?${q.toString()}`;
}

export function mailtoUrl(f: ReportFacts, context?: string): string {
  const r = tDiag.get().report;
  const body = [
    r.mailIntro,
    '',
    `Version: ${f.version}`,
    `Build: ${f.build}`,
    `Platform: ${f.platform}`,
    context ? `Context: ${scrub(context).slice(0, 300)}` : '',
    '',
    r.stepsPlaceholder,
  ].join('\n');
  return `mailto:${REPORT_MAIL}?subject=${encodeURIComponent(r.mailSubject)}&body=${encodeURIComponent(body)}`;
}

/** Opens the prefilled GitHub form in the browser. Nothing is sent by the app. */
export async function reportBug(context?: string): Promise<void> {
  await getPlatform().app.openUrl(issueUrl(await reportFacts(), context));
}

export async function reportByMail(context?: string): Promise<void> {
  await getPlatform().app.openUrl(mailtoUrl(await reportFacts(), context));
}
