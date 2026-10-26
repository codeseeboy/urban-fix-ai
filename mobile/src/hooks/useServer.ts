import { useEffect, useState } from 'react';

import { discoverServer, server } from '@/lib/server';

/** Current backend URL (null = unreachable) plus a manual re-check. */
export function useServer() {
  const [url, setUrl] = useState<string | null>(server.url);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const off = server.subscribe(setUrl);
    return () => {
      off();
    };
  }, []);

  const recheck = async () => {
    setChecking(true);
    try {
      return await discoverServer();
    } finally {
      setChecking(false);
    }
  };

  return { url, checking, recheck };
}
