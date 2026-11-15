import { useState } from 'react';
import type { Playlist } from '@/core/connectors/types';
import { t } from '@/strings';
import { tMusicPage } from '@/strings.musicPage';
import { useUiStore } from '@/stores/ui';
import { Button, Dialog, Form, FormActions, TextArea, TextField } from '@/ui';
import { changedPlaylists } from '../library';
import type { PlayerApi } from './types';
import styles from './Spotify.module.css';

const NAME_MAX = 100;
const DESCRIPTION_MAX = 300;

/** What the dialog edits: a new playlist, or name and description of one that exists. */
export type PlaylistTarget =
  { kind: 'new' } | { kind: 'edit'; id: string; name: string; description?: string };

/**
 * "Neue Playlist" and "Playlist bearbeiten": name and description, one request on "Anlegen" / "Speichern". On failure the
 * dialog stays open with what was typed (nothing is lost). Needs the feature "Playlists bearbeiten".
 */
export function PlaylistDialog({
  api,
  target,
  onClose,
  onDone,
}: {
  api: PlayerApi;
  /** `null` = closed. */
  target: PlaylistTarget | null;
  onClose: () => void;
  /** After a successful save: the new playlist (create) or the changed values (edit). */
  onDone: (result: Playlist) => void;
}) {
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={target?.kind === 'edit' ? tMusicPage.get().editTitle : tMusicPage.get().newTitle}
      askAfterTyping
    >
      {target ? (
        // Keyed so a second opening starts from the playlist's current values.
        <PlaylistForm
          key={target.kind === 'edit' ? target.id : 'new'}
          api={api}
          target={target}
          onClose={onClose}
          onDone={onDone}
        />
      ) : null}
    </Dialog>
  );
}

function PlaylistForm({
  api,
  target,
  onClose,
  onDone,
}: {
  api: PlayerApi;
  target: PlaylistTarget;
  onClose: () => void;
  onDone: (result: Playlist) => void;
}) {
  const tm = tMusicPage.use();
  const toast = useUiStore((s) => s.toast);
  const { source, ctx } = api.np;
  const [name, setName] = useState(target.kind === 'edit' ? target.name : '');
  const [description, setDescription] = useState(
    target.kind === 'edit' ? (target.description ?? '') : '',
  );
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const clean = name.trim();

  async function submit() {
    if (!clean || busy) return;
    setFailed(false);
    setBusy(true);
    try {
      if (target.kind === 'new') {
        const made = await source.createPlaylist!(ctx, clean, description.trim() || undefined);
        changedPlaylists();
        toast(tm.created(made.name));
        onDone(made);
      } else {
        const change = {
          ...(clean !== target.name ? { name: clean } : {}),
          ...(description.trim() !== (target.description ?? '')
            ? { description: description.trim() }
            : {}),
        };
        if (Object.keys(change).length > 0) await source.editPlaylist!(ctx, target.id, change);
        changedPlaylists();
        toast(tm.saved);
        onDone({ id: target.id, name: clean, description: description.trim() || undefined });
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form onSubmit={submit}>
      <TextField
        label={tm.fieldName}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={NAME_MAX}
        required
        data-autofocus
      />
      <TextArea
        label={tm.fieldDescription}
        hint={tm.descriptionHint}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={DESCRIPTION_MAX}
      />
      {target.kind === 'new' ? <p className={styles.note}>{tm.newPrivate}</p> : null}
      {failed ? (
        <p className={styles.note} role="alert">
          {tm.editFailed}
        </p>
      ) : null}
      <FormActions>
        <Button variant="ghost" onClick={onClose}>
          {t.actions.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={!clean || busy} aria-busy={busy}>
          {target.kind === 'new' ? tm.create : t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}
