// Books on the Gamify house's shelves. Every excerpt is from a work in the
// public domain (or an original retelling), so the pages can be shown in full.
export const BOOKS = [
  {
    id: 'alice', title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll', color: '#4f7fe0', ink: '#ffffff', h: 0.92, w: 0.15,
    pages: [
      'Chapter I. Down the Rabbit-Hole.\n\nAlice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, "and what is the use of a book," thought Alice "without pictures or conversations?"',
      'So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.',
    ],
  },
  {
    id: 'pride', title: 'Pride and Prejudice', author: 'Jane Austen', color: '#c24f8a', ink: '#ffffff', h: 0.84, w: 0.17,
    pages: [
      'Chapter I.\n\nIt is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
      'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.',
    ],
  },
  {
    id: 'gitanjali', title: 'Gitanjali', author: 'Rabindranath Tagore', color: '#e0a020', ink: '#2a1a00', h: 0.78, w: 0.13,
    pages: [
      'Poem 35\n\nWhere the mind is without fear and the head is held high;\nWhere knowledge is free;\nWhere the world has not been broken up into fragments by narrow domestic walls;\nWhere words come out from the depth of truth;',
      'Where tireless striving stretches its arms towards perfection;\nWhere the clear stream of reason has not lost its way into the dreary desert sand of dead habit;\nWhere the mind is led forward by thee into ever-widening thought and action --\nInto that heaven of freedom, my Father, let my country awake.',
    ],
  },
  {
    id: 'panchatantra', title: 'The Panchatantra', author: 'Vishnu Sharma (retold)', color: '#2f8f6a', ink: '#ffffff', h: 0.88, w: 0.16,
    pages: [
      'The Monkey and the Crocodile\n\nOn a river bank stood a great jamun tree, and in its branches lived a clever monkey. A crocodile who lived in the river became his friend, and each day the monkey tossed down sweet fruit for him and his wife.',
      'But the crocodile\'s wife grew jealous and wished to taste the monkey\'s heart. Mid-stream the crocodile confessed his errand. The monkey smiled and said, "What a pity! I left my heart on the tree. Take me back and I shall fetch it." Back on the bank he climbed up and never came down again.\n\nMoral: quick wit can save you from a trap.',
    ],
  },
  {
    id: 'meditations', title: 'Meditations', author: 'Marcus Aurelius', color: '#6a5aa8', ink: '#ffffff', h: 0.8, w: 0.14,
    pages: [
      'Book II\n\nBegin the morning by saying to thyself, I shall meet with the busy-body, the ungrateful, arrogant, deceitful, envious, unsocial.',
      'All these things happen to them by reason of their ignorance of what is good and evil. I can neither be injured by any of them, for no man can involve me in what is debasing; nor can I be angry with my kinsman, nor hate him.',
    ],
  },
  {
    id: 'jungle', title: 'The Jungle Book', author: 'Rudyard Kipling', color: '#d0592a', ink: '#ffffff', h: 0.9, w: 0.18,
    pages: [
      'Mowgli\'s Brothers\n\nIt was seven o\'clock of a very warm evening in the Seeonee hills when Father Wolf woke up from his day\'s rest, scratched himself, yawned, and spread out his paws one after the other to get rid of the sleepy feeling in their tips.',
      'Mother Wolf lay with her big gray nose dropped across her four tumbling, squealing cubs, and the moon shone into the mouth of the cave where they all lived. "Augrh!" said Father Wolf. "It is time to hunt again."',
    ],
  },
  {
    id: 'sherlock', title: 'A Scandal in Bohemia', author: 'Arthur Conan Doyle', color: '#3a8fa8', ink: '#ffffff', h: 0.82, w: 0.15,
    pages: [
      'I.\n\nTo Sherlock Holmes she is always the woman. I have seldom heard him mention her under any other name. In his eyes she eclipses and predominates the whole of her sex.',
      'It was not that he felt any emotion akin to love for Irene Adler. All emotions, and that one particularly, were abhorrent to his cold, precise but admirably balanced mind.',
    ],
  },
  {
    id: 'treasure', title: 'Treasure Island', author: 'Robert Louis Stevenson', color: '#a8402f', ink: '#ffffff', h: 0.86, w: 0.17,
    pages: [
      'Part One -- The Old Buccaneer\n\nSquire Trelawney, Dr. Livesey, and the rest of these gentlemen having asked me to write down the whole particulars about Treasure Island, from the beginning to the end, keeping nothing back but the bearings of the island, and that only because there is still treasure not yet lifted, I take up my pen.',
      'I go back to the time when my father kept the "Admiral Benbow" inn and the brown old seaman with the sabre cut first took up his lodging under our roof.',
    ],
  },
];

// Items in the fridge. `kind` picks a drawing in PropViewers.jsx.
export const FRIDGE_SHELVES = [
  [
    { name: 'Milk', kind: 'carton', color: '#f4f6ff', accent: '#4fa8ff' },
    { name: 'Curd (dahi)', kind: 'tub', color: '#f4efe0', accent: '#d9c9a8' },
    { name: 'Paneer', kind: 'block', color: '#f6edd0', accent: '#e8d9a8' },
    { name: 'Butter', kind: 'block', color: '#f7d96a', accent: '#e0b83a' },
    { name: 'Eggs', kind: 'eggs', color: '#f1e2c4', accent: '#d9c49a' },
  ],
  [
    { name: 'Mango juice', kind: 'carton', color: '#ffb347', accent: '#e07a10' },
    { name: 'Lassi', kind: 'bottle', color: '#fff2f6', accent: '#ff8fb5' },
    { name: 'Cold coffee', kind: 'bottle', color: '#c9a77a', accent: '#6b4a2f' },
    { name: 'Leftover dal', kind: 'tub', color: '#e8e1ff', accent: '#e0a020' },
    { name: 'Chocolate cake', kind: 'cake', color: '#6b4a2f', accent: '#ff6fb5' },
  ],
  [
    { name: 'Mango pickle (achaar)', kind: 'jar', color: '#d0592a', accent: '#7a2a10' },
    { name: 'Mint chutney', kind: 'jar', color: '#3aa862', accent: '#1f6a3a' },
    { name: 'Tomato ketchup', kind: 'bottle', color: '#d0392b', accent: '#7a1a10' },
    { name: 'Jam', kind: 'jar', color: '#a02a6a', accent: '#5a1038' },
    { name: 'Cola', kind: 'can', color: '#c0392b', accent: '#f4f6ff' },
  ],
  [
    { name: 'Tomatoes', kind: 'veg', color: '#e0392b', accent: '#2f8f4a' },
    { name: 'Green chillies', kind: 'leaf', color: '#2f9e4a', accent: '#1f6a3a' },
    { name: 'Coriander', kind: 'leaf', color: '#3aa862', accent: '#2f8f4a' },
    { name: 'Watermelon', kind: 'veg', color: '#e0526a', accent: '#2f8f4a' },
    { name: 'Water bottle', kind: 'bottle', color: '#bfe9ff', accent: '#4fa8ff' },
  ],
];
