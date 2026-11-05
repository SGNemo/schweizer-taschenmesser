import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { devBuildNumber } from './select';

/** The build number of the installed Dev-Preview (`1.0.0-dev.683` → 683); undefined for any other build. */
export function useInstalledBuild(): number | undefined {
  const [build, setBuild] = useState<number | undefined>();
  useEffect(() => {
    let alive = true;
    void getPlatform()
      .app.version()
      .then((v) => alive && setBuild(devBuildNumber(v)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return build;
}
