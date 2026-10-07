import { t } from '@/strings';
import {
  READ_COVERS,
  READ_SHARES,
  READ_STYLES,
  useUiStore,
  type ReadCover,
  type ReadShare,
  type ReadStyle,
} from '@/stores/ui';
import { ReadableText, Segmented, SettingRow, SettingsGroup, Switch } from '@/ui';

/** Reading aid (device-local, stores/ui.ts): on/off, share of the word, strength, where it applies. Default: off. */
export function ReadingSection() {
  const r = t.settings.reading;
  const aid = useUiStore((s) => s.readAid);
  const setAid = useUiStore((s) => s.setReadAid);
  const share = useUiStore((s) => s.readShare);
  const setShare = useUiStore((s) => s.setReadShare);
  const style = useUiStore((s) => s.readStyle);
  const setStyle = useUiStore((s) => s.setReadStyle);
  const cover = useUiStore((s) => s.readCover);
  const setCover = useUiStore((s) => s.setReadCover);
  return (
    <SettingsGroup id="reading" title={r.title} hint={r.shortcut}>
      <SettingRow id="reading--aid" label={r.aid} description={r.aidHint}>
        <Switch label={r.aid} labelHidden checked={aid} onChange={setAid} />
      </SettingRow>
      <SettingRow id="reading--share" label={r.share}>
        <Segmented<ReadShare>
          label={r.share}
          value={share}
          options={[...READ_SHARES].sort().map((v) => ({ value: v, label: r.shareOptions[v] }))}
          onChange={setShare}
        />
      </SettingRow>
      <SettingRow id="reading--style" label={r.style} description={r.styleHint}>
        <Segmented<ReadStyle>
          label={r.style}
          value={style}
          options={READ_STYLES.map((v) => ({ value: v, label: r.styleOptions[v] }))}
          onChange={setStyle}
        />
      </SettingRow>
      <SettingRow id="reading--cover" label={r.cover} description={r.coverHint}>
        <Segmented<ReadCover>
          label={r.cover}
          value={cover}
          options={READ_COVERS.map((v) => ({ value: v, label: r.coverOptions[v] }))}
          onChange={setCover}
        />
      </SettingRow>
      <SettingRow id="reading--preview" label={r.preview}>
        <p data-testid="reading-preview" style={{ margin: 0, maxWidth: 'var(--measure)' }}>
          <ReadableText text={r.previewText} />
        </p>
      </SettingRow>
    </SettingsGroup>
  );
}
