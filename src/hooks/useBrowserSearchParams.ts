import { useMemo } from 'react';
import useBrowserPath from '@/hooks/useBrowserPath';

const useBrowserSearchParams = () => {
  const path = useBrowserPath();

  return useMemo(() => {
    const [, search = ''] = path.split('?');
    const query = search.split('#')[0] || '';
    return [new URLSearchParams(query)] as const;
  }, [path]);
};

export default useBrowserSearchParams;