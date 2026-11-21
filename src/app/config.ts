export const REPO_URL = 'https://github.com/rmnturov/koobiq-demos';
export const REPO_BRANCH = 'main';

export const repoUrlFor = (slug: string): string => `${REPO_URL}/tree/${REPO_BRANCH}/src/demos/${slug}`;

/** Relative on purpose: keeps working when the app is served under a sub-path. */
export const zipPathFor = (slug: string): string => `downloads/${slug}.zip`;

/** Title of the site itself: the catalog page and the tail of every demo page title. */
export const SITE_TITLE = 'Демки Ромы Турова';

/** «Название демки · Сайт», как в табе браузера; без демки — только название сайта. */
export const pageTitleFor = (demoTitle?: string): string => (demoTitle ? `${demoTitle} · ${SITE_TITLE}` : SITE_TITLE);
