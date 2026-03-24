import { useEffect, useState } from 'react';

interface CapacitorInfo {
  isNative: boolean;
  platform: 'ios' | 'android' | 'web';
}

export function useCapacitor(): CapacitorInfo {
  const [info, setInfo] = useState<CapacitorInfo>({ isNative: false, platform: 'web' });

  useEffect(() => {
    import('@capacitor/core')
      .then(({ Capacitor }) => {
        setInfo({
          isNative: Capacitor.isNativePlatform(),
          platform: Capacitor.getPlatform() as CapacitorInfo['platform'],
        });
      })
      .catch(() => {
        // Not in Capacitor context — web browser
      });
  }, []);

  return info;
}
