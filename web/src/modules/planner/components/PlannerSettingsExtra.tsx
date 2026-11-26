/**
 * The planner's own rows on its settings page (`ModuleSettings.extra`, one slot per module): „Gemessene Zeiten
 * löschen“ right after its switch (package 8), then the section „Themen“ (package 11).
 */
import MeasureSettings from './MeasureSettings';
import { TopicSettings } from './TopicSettings';

export default function PlannerSettingsExtra() {
  return (
    <>
      <MeasureSettings />
      <TopicSettings />
    </>
  );
}
