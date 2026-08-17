const isBrowser = () => typeof window !== 'undefined';

type RouterAdapter = {
  push: (path: string) => Promise<boolean>;
  replace: (path: string) => Promise<boolean>;
  back: () => void;
};

let nextRouter: RouterAdapter | null = null;

export const setNavigationRouter = (router: RouterAdapter | null) => {
  nextRouter = router;
};

const emitNavigationChange = () => {
  if (!isBrowser()) return;
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const navigateTo = (path: string, replace = false) => {
  if (nextRouter) {
    void (replace ? nextRouter.replace(path) : nextRouter.push(path));
    return;
  }

  if (!isBrowser()) return;

  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }

  emitNavigationChange();
};

export const goBack = () => {
  if (nextRouter) {
    nextRouter.back();
    return;
  }

  if (!isBrowser()) return;
  window.history.back();
};

export const goForward = () => {
  if (!isBrowser()) return;
  window.history.forward();
};