const flag = process.argv.find((arg) => arg.startsWith('--target='));
export const target = flag?.slice('--target='.length) ?? process.env.STATIC_DEPLOY_TARGET ?? 'pages';
if (!['pages', 'vps'].includes(target)) throw new Error(`Unbekanntes statisches Releaseziel: ${target}`);
export const basePath = target === 'vps' ? '' : '/pv-belegung';
export const label = target === 'vps' ? 'VPS' : 'Pages';
export const previewPort = target === 'vps' ? '3189' : '3188';
