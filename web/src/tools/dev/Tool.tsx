import { useState } from 'react';
import { t } from '@/strings';
import { Segmented } from '@/ui';
import styles from '../tools.module.css';
import Base64Panel from './Base64Panel';
import HashPanel from './HashPanel';
import JsonPanel from './JsonPanel';
import UuidPanel from './UuidPanel';

const s = t.tools.dev;
const TABS = ['base64', 'json', 'uuid', 'hash'] as const;
type Tab = (typeof TABS)[number];

export default function DevTool() {
  const [tab, setTab] = useState<Tab>('base64');
  return (
    <div className={styles.stack}>
      <Segmented
        label={s.tabsLabel}
        value={tab}
        options={TABS.map((k) => ({ value: k, label: s.tabs[k]! }))}
        onChange={setTab}
      />
      {tab === 'base64' ? (
        <Base64Panel />
      ) : tab === 'json' ? (
        <JsonPanel />
      ) : tab === 'uuid' ? (
        <UuidPanel />
      ) : (
        <HashPanel />
      )}
    </div>
  );
}
