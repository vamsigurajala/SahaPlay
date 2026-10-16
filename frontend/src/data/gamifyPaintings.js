// Sad love paintings hung in the upstairs living room. All five are public-domain
// works (the artists died long ago) and the images are bundled in /images/gamify/art.
// The stories are short retellings, in our own words, of why each was painted.

import { INDIAN_PAINTINGS } from './gamifyIndianPaintings';

const WESTERN = {
  ophelia: {
    id: 'ophelia',
    title: 'Ophelia',
    artist: 'John Everett Millais',
    year: '1851-52',
    place: 'Tate Britain, London',
    img: '/images/gamify/art/ophelia.jpg',
    w: 900,
    h: 612,
    mood: ['Heartbreak', 'Grief', 'Pre-Raphaelite'],
    why: 'Millais wanted to show nature and sorrow with complete honesty. He chose the saddest moment of a Shakespeare love story and painted it so gently that it almost looks peaceful.',
    story: 'In Hamlet, Ophelia loves the prince, but he pushes her away and then kills her father by mistake. Her mind gives way. She wanders to a brook, gathering flowers and singing old songs, and slips into the water. Millais paints the moment she lets the current carry her, lips parted, still singing as her heavy dress pulls her down.',
    behind: 'He painted the riverbank from life beside the Hogsmill River in Surrey over many months. Back in his studio, the young artist Elizabeth Siddal lay for hours in a bath of water kept warm by lamps. When the lamps went out she caught a bad cold, and Millais paid her doctor\'s bill.',
    look: [
      'Every flower is painted accurately and chosen for its meaning: poppies for sleep and death, pansies for love in vain, violets for faithfulness.',
      'Her open hands look half like surrender and half like a prayer.',
      'The bright, lush riverbank makes her loss feel even quieter.',
    ],
  },
  shalott: {
    id: 'shalott',
    title: 'The Lady of Shalott',
    artist: 'John William Waterhouse',
    year: '1888',
    place: 'Tate Britain, London',
    img: '/images/gamify/art/shalott.jpg',
    w: 900,
    h: 691,
    mood: ['Longing', 'Unreturned love', 'Fate'],
    why: 'Waterhouse was drawn all his life to tragic women from myth and poetry. He painted this scene from Tennyson\'s poem three times; this is the first and most famous.',
    story: 'A lady is cursed to live alone in a tower, weaving and never looking at the world directly, only at its reflection in a mirror. One day the knight Lancelot rides by, singing. She turns to the window to see him for real. The mirror cracks, her weaving flies apart, and she knows the curse has fallen. She finds a boat, writes her name on its prow, and floats down the river towards Camelot, singing her last song. She dies before she arrives, and the knights who gather by her boat wonder who she was. Lancelot only remarks that she has a lovely face.',
    behind: 'Waterhouse shows the start of her last journey: she sits upright in the boat in a white dress, lips parted as she sings, one hand resting on the mooring chain. Three candles burn at the prow, and the autumn colours around her say the year is ending too.',
    look: [
      'Her eyes are open but far away, as if she has already left.',
      'The three candles at the prow burn steadily, but not for long.',
      'She is loved by no one in the story, which is what makes it so sad.',
    ],
  },
  romeo: {
    id: 'romeo',
    title: 'Romeo and Juliet',
    artist: 'Frank Dicksee',
    year: '1884',
    place: 'Southampton City Art Gallery',
    img: '/images/gamify/art/romeo.jpg',
    w: 621,
    h: 900,
    mood: ['Farewell', 'Forbidden love', 'Dawn'],
    why: 'Dicksee was a Victorian painter of romantic stories, and he chose the scene audiences loved most: the lovers\' last tender morning together.',
    story: 'Romeo and Juliet have married in secret, but Romeo has been banished for killing Juliet\'s cousin and must leave Verona before sunrise or die. In this scene, the morning after their wedding night, they cling to each other on the balcony. Juliet tries to persuade him that the birdsong is the nightingale, not the lark that announces day. He leaves anyway, and they never speak again while both are alive.',
    behind: 'Everything in the picture is soft and golden: the sunrise, her pale dress, the blossoming vine. Dicksee lets us enjoy the happiness for a moment because we already know how the play ends.',
    look: [
      'She leans on tiptoe to reach him, and he holds her face as if memorising it.',
      'The sky behind them is turning to morning, the clock that is about to part them.',
      'Their embrace is the only still thing in the picture; the rest is already moving on.',
    ],
  },
  separation: {
    id: 'separation',
    title: 'Separation',
    artist: 'Edvard Munch',
    year: '1896',
    place: '',
    img: '/images/gamify/art/separation.jpg',
    w: 900,
    h: 678,
    mood: ['Break-up', 'Loneliness', 'Ache'],
    why: 'Munch painted his own heartbreak. He returned again and again to the pain of ended love, collecting those works in a series he called the Frieze of Life, about love, fear and death.',
    story: 'A man stands under a tree with his hand pressed to his chest, as if holding a wound. Beside him a woman in a pale dress turns away and walks towards the sea. Her long hair streams back across the picture and seems to reach for his heart. Munch described feeling tied to a lost love by strands of her hair wrapped around his heart, even as she moved out of his life.',
    behind: 'Munch\'s early love affairs ended painfully, and he used paint to carry the feeling. He often painted the same subject several times and in several media, and Separation exists as paintings and as a print.',
    look: [
      'The red shape at the man\'s feet reads like a bleeding heart or a bush of flame.',
      'The woman is bright and moving; the man is dark and fixed to the ground.',
      'A single line of hair is all that still joins them.',
    ],
  },
  paolo: {
    id: 'paolo',
    title: 'Paolo and Francesca',
    artist: 'Alexandre Cabanel',
    year: '1870',
    place: '',
    img: '/images/gamify/art/paolo.jpg',
    w: 900,
    h: 705,
    mood: ['Doomed love', 'Betrayal', 'Tragedy'],
    why: 'Cabanel, a leading French painter of his day, took the most famous pair of lovers from Dante\'s Inferno and painted the instant after the tragedy, when all that is left is stillness.',
    story: 'Francesca was married for political reasons to the lord of Rimini, Gianciotto Malatesta. She fell in love with his younger brother Paolo while the two read together about Lancelot and Guinevere. Her husband found them and killed them both. In Dante\'s poem their ghosts are swept forever on a storm wind, and Francesca tells her story so tenderly that Dante faints from pity.',
    behind: 'On the right, half hidden behind the curtain, the husband looks down at what he has done. The lovers lie together, her hand still resting on the bed.',
    look: [
      'Paolo has fallen at the foot of the bed but is still turned towards her.',
      'The husband\'s face is the only one that is awake; it shows no triumph.',
      'The rich colours of their clothes make the stillness feel even colder.',
    ],
  },
};

export const PAINTINGS = { ...WESTERN, ...INDIAN_PAINTINGS };
// The living-room set; the Indian paintings are browsed from the Breakup Room.
export const PAINTING_IDS = Object.keys(WESTERN);
