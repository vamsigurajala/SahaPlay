import i18n from '../../i18n';

// Names that appear all over the house (rooms, doors, games, pinned things), in the
// language chosen in app settings. English is the fallback, so a missing word is never blank.

const tr = (key, def, opts) => i18n.t(key, { defaultValue: def, ...opts });

export const zoneName = (z) => (z ? tr(`gamify.zones.${z.id}`, z.label) : '');
export const gameName = (id, def) => tr(`gamify.games.${id}`, def);

// 'Cricket ground' and 'Market' are doors that lead to rooms of the same name.
const LINK_TO_ZONE = { cricketground: 'cricket', market: 'market' };
export function linkText(link, dest) {
  const slug = (link.label || '').toLowerCase().replace(/[^a-z]+/g, '');
  if (!slug) return tr('gamify.goTo', `Go to ${dest?.label || ''}`, { room: zoneName(dest) });
  if (LINK_TO_ZONE[slug]) return tr(`gamify.zones.${LINK_TO_ZONE[slug]}`, link.label);
  return tr(`gamify.link.${slug}`, link.label);
}
export const goToText = (z) => tr('gamify.goTo', `Go to ${z?.label || ''}`, { room: zoneName(z) });
export const kindName = (kind, def, opts) => tr(`gamify.kinds.${kind}`, def, opts);
