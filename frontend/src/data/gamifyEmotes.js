// Quick reactions people can send from the right-hand menu. The id is what travels over
// the socket (the server keeps its own copy of this list); the icon is chosen on screen.
export const EMOTE_IDS = ['wave', 'heart', 'laugh', 'thumbs', 'party', 'cheers'];
export const isEmote = (id) => EMOTE_IDS.includes(id);
