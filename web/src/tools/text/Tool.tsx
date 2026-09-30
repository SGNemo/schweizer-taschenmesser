import { useMemo, useState } from 'react';
import { t } from '@/strings';
import { Button, Checkbox, TextArea, TextField } from '@/ui';
import { copyWithToast, num } from '../shared';
import styles from '../tools.module.css';
import { convertCase, countText, lorem, sortLines, tidy, type CaseMode } from './logic';

const s = t.tools.text;
const nf = new Intl.NumberFormat('de-DE');

export default function TextTool() {
  const [text, setText] = useState('');
  const [trimLines, setTrim] = useState(true);
  const [collapseSpaces, setCollapse] = useState(true);
  const [dropEmptyLines, setDrop] = useState(false);
  const [paragraphs, setParagraphs] = useState('2');
  const stats = useMemo(() => countText(text), [text]);
  const cases: { mode: CaseMode; label: string }[] = [
    { mode: 'upper', label: s.upper },
    { mode: 'lower', label: s.lower },
    { mode: 'title', label: s.title },
    { mode: 'sentence', label: s.sentence },
  ];
  return (
    <div className={styles.stack}>
      <TextArea label={s.input} value={text} onChange={(e) => setText(e.target.value)} rows={8} />
      <div className={styles.row}>
        <Button onClick={() => void copyWithToast(text)} disabled={!text}>
          {s.copy}
        </Button>
        <Button onClick={() => setText('')} disabled={!text}>
          {s.clear}
        </Button>
      </div>

      <section aria-label={s.stats}>
        <ul className={styles.list} data-testid="text-stats">
          <li className={styles.item}>
            <span>{s.chars}</span>
            <strong>{nf.format(stats.chars)}</strong>
          </li>
          <li className={styles.item}>
            <span>{s.charsNoSpaces}</span>
            <strong>{nf.format(stats.charsNoSpaces)}</strong>
          </li>
          <li className={styles.item}>
            <span>{s.words}</span>
            <strong>{nf.format(stats.words)}</strong>
          </li>
          <li className={styles.item}>
            <span>{s.lines}</span>
            <strong>{nf.format(stats.lines)}</strong>
          </li>
          <li className={styles.item}>
            <span>{s.sentences}</span>
            <strong>{nf.format(stats.sentences)}</strong>
          </li>
          <li className={styles.item}>
            <span>{s.paragraphs}</span>
            <strong>{nf.format(stats.paragraphs)}</strong>
          </li>
          <li className={styles.item}>
            <span>{s.reading}</span>
            <strong>{s.minutes(stats.minutes)}</strong>
          </li>
        </ul>
      </section>

      <section aria-label={s.caseTitle} className={styles.stack}>
        <h3>{s.caseTitle}</h3>
        <div className={styles.row}>
          {cases.map((c) => (
            <Button
              key={c.mode}
              onClick={() => setText(convertCase(text, c.mode))}
              disabled={!text}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </section>

      <section aria-label={s.tidyTitle} className={styles.stack}>
        <h3>{s.tidyTitle}</h3>
        <Checkbox
          label={s.trimLines}
          checked={trimLines}
          onChange={(e) => setTrim(e.target.checked)}
        />
        <Checkbox
          label={s.collapseSpaces}
          checked={collapseSpaces}
          onChange={(e) => setCollapse(e.target.checked)}
        />
        <Checkbox
          label={s.dropEmpty}
          checked={dropEmptyLines}
          onChange={(e) => setDrop(e.target.checked)}
        />
        <div className={styles.row}>
          <Button
            onClick={() => setText(tidy(text, { trimLines, collapseSpaces, dropEmptyLines }))}
            disabled={!text}
          >
            {s.tidy}
          </Button>
          <Button onClick={() => setText(sortLines(text, false))} disabled={!text}>
            {s.sortAsc}
          </Button>
          <Button onClick={() => setText(sortLines(text, true))} disabled={!text}>
            {s.sortDesc}
          </Button>
        </div>
      </section>

      <section aria-label={s.loremTitle} className={styles.stack}>
        <h3>{s.loremTitle}</h3>
        <div className={styles.row}>
          <div className={styles.grow}>
            <TextField
              label={s.loremCount}
              value={paragraphs}
              onChange={(e) => setParagraphs(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
          <Button onClick={() => setText(lorem(num(paragraphs) ?? 1))}>{s.loremInsert}</Button>
        </div>
      </section>
    </div>
  );
}
