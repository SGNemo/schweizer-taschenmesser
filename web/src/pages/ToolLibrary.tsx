import { useTools } from '@/core/tools/state';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Badge, Button, Card, Icon, IconButton, Switch } from '@/ui';
import styles from './Page.module.css';

const s = t.tools.library;
const GROUPS = ['basis', 'extra', 'dev'] as const;

/** `/tools`: switch tools on or off and set the order of the toolbar. */
export function ToolLibrary() {
  const tools = useTools();
  const openTools = useUiStore((st) => st.openTools);
  const activeIds = tools?.active.map((x) => x.id) ?? [];

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1>{s.title}</h1>
          <p className={styles.lead}>{s.intro}</p>
        </div>
      </div>
      {GROUPS.map((group) => {
        const inGroup = (tools?.all ?? []).filter((x) => x.group === group);
        if (inGroup.length === 0) return null;
        return (
          <section key={group} aria-labelledby={`tools-${group}`} className={styles.section}>
            <h2 id={`tools-${group}`}>{s.groups[group]}</h2>
            <ul className={`${styles.list} ${styles.grid}`}>
              {inGroup.map((tool) => {
                const on = activeIds.includes(tool.id);
                const index = activeIds.indexOf(tool.id);
                return (
                  <Card
                    as="li"
                    key={tool.id}
                    className={styles.moduleCard}
                    data-testid={`tool-${tool.id}`}
                  >
                    <div className={styles.moduleHead}>
                      <span className={styles.moduleIcon}>
                        <Icon name={tool.icon} />
                      </span>
                      <span className={styles.moduleName}>{tool.name}</span>
                      <Badge>{tool.offline ? s.offline : s.online}</Badge>
                    </div>
                    <p className={styles.desc}>{tool.description}</p>
                    <Switch
                      label={s.enable(tool.name)}
                      checked={on}
                      disabled={!tools}
                      onChange={(checked) => void tools?.setEnabled(tool.id, checked)}
                    />
                    {on ? (
                      <div className={styles.toolActions}>
                        <Button onClick={() => openTools(tool.id)}>{s.open(tool.name)}</Button>
                        <IconButton
                          label={s.up(tool.name)}
                          disabled={index <= 0}
                          onClick={() => void tools?.move(tool.id, -1)}
                        >
                          <Icon name="chevronUp" />
                        </IconButton>
                        <IconButton
                          label={s.down(tool.name)}
                          disabled={index >= activeIds.length - 1}
                          onClick={() => void tools?.move(tool.id, 1)}
                        >
                          <Icon name="chevronDown" />
                        </IconButton>
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}
