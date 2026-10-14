// Books in the Gamify house. Every opening is from a work in the public domain
// (or is an original retelling, marked "retold"); the "about" text is ours.

export const GENRES = {
  horror: { label: 'Horror', a: '#7a1020', b: '#1a0a12', ink: '#ffd9d9' },
  thriller: { label: 'Thriller', a: '#2a3a5a', b: '#0c1220', ink: '#d9e6ff' },
  crime: { label: 'Crime', a: '#3a3a3a', b: '#14141a', ink: '#f0e6c8' },
  romance: { label: 'Romance', a: '#c24f7a', b: '#5a1a3a', ink: '#fff0f6' },
  adventure: { label: 'Adventure', a: '#2f7a5a', b: '#10301f', ink: '#e6fff0' },
  scifi: { label: 'Science fiction', a: '#3a5ac2', b: '#10183a', ink: '#e0e8ff' },
  classic: { label: 'Classic', a: '#8a5a34', b: '#2a1a0e', ink: '#fff0d9' },
  indian: { label: 'Indian tales and verse', a: '#d0792a', b: '#4a2208', ink: '#fff2d9' },
  philosophy: { label: 'Philosophy', a: '#6a5aa8', b: '#1a1440', ink: '#ece6ff' },
  poetry: { label: 'Poetry', a: '#2f8fa8', b: '#0c2a36', ink: '#e0f6ff' },
};

const B = (id, genre, title, author, text, about) => ({ id, genre, title, author, text, about });

export const BOOKS = [
  // ── horror ──
  B('dracula', 'horror', 'Dracula', 'Bram Stoker', '3 May. Bistritz.--Left Munich at 8:35 P. M., on 1st May, arriving at Vienna early next morning; should have arrived at 6:46, but train was an hour late. Buda-Pesth seems a wonderful place, from the glimpse which I got of it from the train and the little I could walk through the streets.', 'A young solicitor travels to a Transylvanian castle and discovers that his host is something far older and hungrier than a nobleman.'),
  B('frankenstein', 'horror', 'Frankenstein', 'Mary Shelley', 'You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings. I arrived here yesterday, and my first task is to assure my dear sister of my welfare and increasing confidence in the success of my undertaking.', 'A brilliant student gives life to a creature stitched from the dead, then runs from what he has made.'),
  B('jekyll', 'horror', 'Dr Jekyll and Mr Hyde', 'R. L. Stevenson', 'Mr. Utterson the lawyer was a man of a rugged countenance that was never lighted by a smile; cold, scanty and embarrassed in discourse; backward in sentiment; lean, long, dusty, dreary and yet somehow lovable.', 'A respectable London doctor and a brutal stranger share a secret that unravels one foggy night at a time.'),
  B('telltale', 'horror', 'The Tell-Tale Heart', 'Edgar Allan Poe', 'True!--nervous--very, very dreadfully nervous I had been and am; but why will you say that I am mad? The disease had sharpened my senses--not destroyed--not dulled them. Above all was the sense of hearing acute.', 'A narrator insists he is perfectly sane while describing a crime he cannot stop hearing.'),
  B('usher', 'horror', 'The Fall of the House of Usher', 'Edgar Allan Poe', 'During the whole of a dull, dark, and soundless day in the autumn of the year, when the clouds hung oppressively low in the heavens, I had been passing alone, on horseback, through a singularly dreary tract of country; and at length found myself, as the shades of the evening drew on, within view of the melancholy House of Usher.', 'A visitor to a crumbling mansion finds its last heirs as fragile as the walls around them.'),
  B('screw', 'horror', 'The Turn of the Screw', 'Henry James', 'The story had held us, round the fire, sufficiently breathless, but except the obvious remark that it was gruesome, as, on Christmas Eve in an old house, a strange tale should essentially be, I remember no comment uttered till somebody happened to say that it was the only case he had met in which such a visitation had fallen on a child.', 'A young governess is sure the two children in her care are being watched by something that should not be there.'),
  B('raven', 'horror', 'The Raven', 'Edgar Allan Poe', 'Once upon a midnight dreary, while I pondered, weak and weary,\nOver many a quaint and curious volume of forgotten lore--\nWhile I nodded, nearly napping, suddenly there came a tapping,\nAs of some one gently rapping, rapping at my chamber door.', 'A grieving scholar is visited at midnight by a bird that has only one word to say.'),
  B('phantom', 'horror', 'The Phantom of the Opera', 'Gaston Leroux', 'The Opera ghost really existed. He was not, as was long believed, a creature of the imagination of the theatrical people, a superstition of the managers, or a product of the impressionable and excitable brains of the young ladies of the ballet.', 'Something lives beneath the Paris Opera, and it has taken an interest in one young singer.'),
  B('dorian', 'horror', 'The Picture of Dorian Gray', 'Oscar Wilde', 'The studio was filled with the rich odour of roses, and when the light summer wind stirred amidst the trees of the garden, there came through the open door the heavy scent of the lilac, or the more delicate perfume of the pink-flowering thorn.', 'A young man wishes that his portrait would age instead of him, and the wish comes true.'),
  B('paw', 'horror', "The Monkey's Paw", 'W. W. Jacobs', 'Without, the night was cold and wet, but in the small parlour of Laburnam Villa the blinds were drawn and the fire burned brightly.', 'A family is given three wishes by a withered paw, and learns what each one really costs.'),
  // ── thriller ──
  B('steps', 'thriller', 'The Thirty-Nine Steps', 'John Buchan', 'I returned from the City about three o\'clock on that May afternoon pretty well disgusted with life. I had been three months in the Old Country, and was fed up with it.', 'A bored Londoner is handed a secret by a dying stranger and is hunted across Scotland.'),
  B('whitewoman', 'thriller', 'The Woman in White', 'Wilkie Collins', 'This is the story of what a Woman\'s patience can endure, and what a Man\'s resolution can achieve.', 'A midnight meeting on a moonlit road draws a drawing master into a conspiracy.'),
  B('montecristo', 'thriller', 'The Count of Monte Cristo', 'Alexandre Dumas', 'On the 24th of February, 1815, the look-out at Notre-Dame de la Garde signalled the three-master, the Pharaon from Smyrna, Trieste, and Naples.', 'A sailor is betrayed, imprisoned and, years later, returns in disguise to settle every debt.'),
  B('thursday', 'thriller', 'The Man Who Was Thursday', 'G. K. Chesterton', 'The suburb of Saffron Park lay on the sunset side of London, as red and ragged as a cloud of sunset.', 'A poet joins a council of anarchists, each named after a day of the week, and nothing is what it seems.'),
  B('gatsby', 'thriller', 'The Great Gatsby', 'F. Scott Fitzgerald', 'In my younger and more vulnerable years my father gave me some advice that I\'ve been turning over in my mind ever since.', 'A summer on Long Island, a mysterious host with a green light across the bay.'),
  // ── crime ──
  B('scarlet', 'crime', 'A Study in Scarlet', 'Arthur Conan Doyle', 'In the year 1878 I took my degree of Doctor of Medicine of the University of London, and proceeded to Netley to go through the course prescribed for surgeons in the army.', 'Dr Watson meets Sherlock Holmes for the first time, and a body is found in an empty house.'),
  B('four', 'crime', 'The Sign of the Four', 'Arthur Conan Doyle', 'Sherlock Holmes took his bottle from the corner of the mantel-piece and his hypodermic syringe from its neat morocco case.', 'A stolen treasure, a wooden-legged man and a pair of footprints lead Holmes through London.'),
  B('hound', 'crime', 'The Hound of the Baskervilles', 'Arthur Conan Doyle', 'Mr. Sherlock Holmes, who was usually very late in the mornings, save upon those not infrequent occasions when he was up all night, was seated at the breakfast table.', 'A family curse, a howling on the moor and a hound said to be from hell.'),
  B('speckled', 'crime', 'The Adventure of the Speckled Band', 'Arthur Conan Doyle', 'On glancing over my notes of the seventy odd cases in which I have during the last eight years studied the methods of my friend Sherlock Holmes, I find many tragic, some comic, a large number merely strange, but none commonplace.', 'A frightened young woman describes a whistle in the night and her sister\'s last words.'),
  B('redhead', 'crime', 'The Red-Headed League', 'Arthur Conan Doyle', 'I had called upon my friend, Mr. Sherlock Holmes, one day in the autumn of last year and found him in deep conversation with a very stout, florid-faced, elderly gentleman with fiery red hair.', 'A pawnbroker is paid handsomely for copying out an encyclopaedia, until the job suddenly ends.'),
  B('carbuncle', 'crime', 'The Blue Carbuncle', 'Arthur Conan Doyle', 'I had called upon my friend Sherlock Holmes upon the second morning after Christmas, with the intention of wishing him the compliments of the season.', 'A battered hat and a Christmas goose lead to a famous jewel.'),
  B('final', 'crime', 'The Final Problem', 'Arthur Conan Doyle', 'It is with a heavy heart that I take up my pen to write these the last words in which I shall ever record the singular gifts by which my friend Mr. Sherlock Holmes was distinguished.', 'Holmes meets Professor Moriarty and a waterfall in Switzerland.'),
  B('morgue', 'crime', 'The Murders in the Rue Morgue', 'Edgar Allan Poe', 'The mental features discoursed of as the analytical, are, in themselves, but little susceptible of analysis.', 'The first detective story: two women, a locked room and a puzzle only reason can solve.'),
  B('bluecross', 'crime', 'The Blue Cross', 'G. K. Chesterton', 'Between the silver ribbon of morning and the green glittering ribbon of sea, the boat touched Harwich and let loose a swarm of folk like flies, among whom the man we must follow was by no means conspicuous--nor wished to be.', 'A small priest in a crumpled coat follows a master thief across London.'),
  B('crimepun', 'crime', 'Crime and Punishment', 'Fyodor Dostoevsky', 'On an exceptionally hot evening early in July a young man came out of the garret in which he lodged in S. Place and walked slowly, as though in hesitation, towards K. bridge.', 'A poor student believes he is above the law, then has to live with what he does.'),
  // ── romance ──
  B('pride', 'romance', 'Pride and Prejudice', 'Jane Austen', 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.', 'Elizabeth Bennet and the proud Mr Darcy misjudge each other, and take a long time to find out.'),
  B('emma', 'romance', 'Emma', 'Jane Austen', 'Emma Woodhouse, handsome, clever, and rich, with a comfortable home and happy disposition, seemed to unite some of the best blessings of existence; and had lived nearly twenty-one years in the world with very little to distress or vex her.', 'A confident matchmaker is certain she knows everyone\'s heart except her own.'),
  B('jane', 'romance', 'Jane Eyre', 'Charlotte Bronte', 'There was no possibility of taking a walk that day. We had been wandering, indeed, in the leafless shrubbery an hour in the morning; but since dinner the cold winter wind had brought with it clouds so sombre, and a rain so penetrating, that further out-door exercise was now out of the question.', 'An orphan becomes a governess at Thornfield Hall, where the master keeps a secret upstairs.'),
  B('wuthering', 'romance', 'Wuthering Heights', 'Emily Bronte', '1801.--I have just returned from a visit to my landlord--the solitary neighbour that I shall be troubled with. This is certainly a beautiful country!', 'Two families, one windswept farmhouse and a love that refuses to end.'),
  B('persuasion', 'romance', 'Persuasion', 'Jane Austen', 'Sir Walter Elliot, of Kellynch Hall, in Somersetshire, was a man who, for his own amusement, never took up any book but the Baronetage; there he found occupation for an idle hour, and consolation in a distressed one.', 'Eight years after being persuaded to refuse him, Anne meets Captain Wentworth again.'),
  B('sense', 'romance', 'Sense and Sensibility', 'Jane Austen', 'The family of Dashwood had long been settled in Sussex. Their estate was large, and their residence was at Norland Park, in the centre of their property, where, for many generations, they had lived in so respectable a manner as to engage the general good opinion of their surrounding acquaintance.', 'Two sisters, one careful and one passionate, learn about love the hard way.'),
  B('romeo', 'romance', 'Romeo and Juliet', 'William Shakespeare', 'Two households, both alike in dignity,\nIn fair Verona, where we lay our scene,\nFrom ancient grudge break to new mutiny,\nWhere civil blood makes civil hands unclean.\nFrom forth the fatal loins of these two foes\nA pair of star-cross\'d lovers take their life.', 'Two young people from feuding families fall in love in a single, doomed week.'),
  B('karenina', 'romance', 'Anna Karenina', 'Leo Tolstoy', 'Happy families are all alike; every unhappy family is unhappy in its own way.', 'A society wife falls in love with a cavalry officer, and Russia watches.'),
  B('women', 'romance', 'Little Women', 'Louisa May Alcott', '"Christmas won\'t be Christmas without any presents," grumbled Jo, lying on the rug.', 'Four sisters grow up in a New England house while their father is away at war.'),
  B('sonnet18', 'romance', 'Sonnet 18', 'William Shakespeare', 'Shall I compare thee to a summer\'s day?\nThou art more lovely and more temperate:\nRough winds do shake the darling buds of May,\nAnd summer\'s lease hath all too short a date.', 'The most famous love poem in English, in fourteen lines.'),
  B('sonnet43', 'romance', 'Sonnets from the Portuguese', 'Elizabeth Barrett Browning', 'How do I love thee? Let me count the ways.\nI love thee to the depth and breadth and height\nMy soul can reach, when feeling out of sight\nFor the ends of being and ideal grace.', 'Forty-four sonnets written to her husband before they were married.'),
  B('gitanjali1', 'romance', 'Gitanjali (Song Offerings)', 'Rabindranath Tagore', 'Thou hast made me endless, such is thy pleasure. This frail vessel thou emptiest again and again, and fillest it ever with fresh life.', 'The songs that won Tagore the Nobel Prize in 1913.'),
  // ── adventure ──
  B('treasure', 'adventure', 'Treasure Island', 'R. L. Stevenson', 'Squire Trelawney, Dr. Livesey, and the rest of these gentlemen having asked me to write down the whole particulars about Treasure Island, from the beginning to the end, keeping nothing back but the bearings of the island, and that only because there is still treasure not yet lifted, I take up my pen.', 'A boy, a map and a one-legged cook with a parrot.'),
  B('jungle', 'adventure', 'The Jungle Book', 'Rudyard Kipling', 'It was seven o\'clock of a very warm evening in the Seeonee hills when Father Wolf woke up from his day\'s rest, scratched himself, yawned, and spread out his paws one after the other to get rid of the sleepy feeling in their tips.', 'Mowgli, raised by wolves, learns the law of the jungle from Baloo and Bagheera.'),
  B('moby', 'adventure', 'Moby-Dick', 'Herman Melville', 'Call me Ishmael. Some years ago--never mind how long precisely--having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.', 'Captain Ahab chases a white whale across every ocean.'),
  B('eighty', 'adventure', 'Around the World in Eighty Days', 'Jules Verne', 'Mr. Phileas Fogg lived, in 1872, at No. 7, Saville Row, Burlington Gardens, the house in which Sheridan died in 1814.', 'A wager, a passport and a calm gentleman who never hurries.'),
  B('crusoe', 'adventure', 'Robinson Crusoe', 'Daniel Defoe', 'I was born in the year 1632, in the city of York, of a good family, though not of that country, my father being a foreigner of Bremen, who settled first at Hull.', 'One man, one island and twenty-eight years.'),
  B('gulliver', 'adventure', "Gulliver's Travels", 'Jonathan Swift', 'My father had a small estate in Nottinghamshire; I was the third of five sons.', 'A ship\'s surgeon finds himself among giants, tiny people and talking horses.'),
  B('sawyer', 'adventure', 'The Adventures of Tom Sawyer', 'Mark Twain', '"TOM!" No answer. "TOM!" No answer. "What\'s gone with that boy, I wonder? You TOM!"', 'Mischief, whitewashed fences and a cave by the Mississippi.'),
  B('alice', 'adventure', "Alice's Adventures in Wonderland", 'Lewis Carroll', 'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, "and what is the use of a book," thought Alice "without pictures or conversations?"', 'A girl follows a white rabbit down a hole and nothing stays the right size.'),
  B('oz', 'adventure', 'The Wonderful Wizard of Oz', 'L. Frank Baum', 'Dorothy lived in the midst of the great Kansas prairies, with Uncle Henry, who was a farmer, and Aunt Em, who was the farmer\'s wife.', 'A cyclone, a yellow brick road and a wizard who is not what he seems.'),
  B('peterpan', 'adventure', 'Peter Pan', 'J. M. Barrie', 'All children, except one, grow up.', 'A boy who will not grow up takes three children to Neverland.'),
  // ── science fiction ──
  B('timemachine', 'scifi', 'The Time Machine', 'H. G. Wells', 'The Time Traveller (for so it will be convenient to speak of him) was expounding a recondite matter to us.', 'An inventor travels hundreds of thousands of years forward and finds a strange, quiet future.'),
  B('worlds', 'scifi', 'The War of the Worlds', 'H. G. Wells', 'No one would have believed in the last years of the nineteenth century that this world was being watched keenly and closely by intelligences greater than man\'s and yet as mortal as his own.', 'Cylinders fall from Mars onto the English countryside.'),
  B('leagues', 'scifi', 'Twenty Thousand Leagues Under the Seas', 'Jules Verne', 'The year 1866 was signalized by a remarkable incident, a mysterious and puzzling phenomenon, which doubtless no one has yet forgotten.', 'A professor is taken aboard the Nautilus by the mysterious Captain Nemo.'),
  // ── classic ──
  B('twocities', 'classic', 'A Tale of Two Cities', 'Charles Dickens', 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity.', 'London and Paris on the eve of the French Revolution.'),
  B('expectations', 'classic', 'Great Expectations', 'Charles Dickens', 'My father\'s family name being Pirrip, and my Christian name Philip, my infant tongue could make of both names nothing longer or more explicit than Pip.', 'A blacksmith\'s boy is given a mysterious fortune.'),
  B('carol', 'classic', 'A Christmas Carol', 'Charles Dickens', 'Marley was dead: to begin with. There is no doubt whatever about that.', 'Scrooge is visited by three spirits on Christmas Eve.'),
  B('walden', 'classic', 'Walden', 'Henry David Thoreau', 'When I wrote the following pages, or rather the bulk of them, I lived alone, in the woods, a mile from any neighbor, in a house which I had built myself, on the shore of Walden Pond, in Concord, Massachusetts.', 'Two years in a small cabin, and what they taught.'),
  // ── Indian tales and verse ──
  B('gitanjali', 'indian', 'Gitanjali, Poem 35', 'Rabindranath Tagore', 'Where the mind is without fear and the head is held high;\nWhere knowledge is free;\nWhere the world has not been broken up into fragments by narrow domestic walls;\nWhere words come out from the depth of truth;\nInto that heaven of freedom, my Father, let my country awake.', 'The poem every Indian school child knows.'),
  B('panchatantra', 'indian', 'The Panchatantra (retold)', 'Vishnu Sharma', 'On a river bank stood a great jamun tree, and in its branches lived a clever monkey. A crocodile who lived in the river became his friend, and each day the monkey tossed down sweet fruit for him and his wife. But the crocodile\'s wife grew jealous and wished to taste the monkey\'s heart.', 'Animal fables that teach how to live wisely, retold here in our own words.'),
  B('birbal', 'indian', "Birbal's Khichdi (retold)", 'Akbar-Birbal tales', 'One freezing winter, Emperor Akbar offered a reward to anyone who could stand all night in the cold river. A poor man did it, warmed only by a faraway lamp, and the court said he had cheated. Birbal said nothing and left for home.', 'A clever minister teaches the court a lesson, retold in our own words.'),
  B('tenali', 'indian', 'Tenali Rama and the Cats (retold)', 'Tenali Rama tales', 'The king gave every household in the village a cat and a cup of milk each day, hoping to end the mice. Tenali Rama\'s cat would not drink the hot milk, and the people began to wonder why.', 'A witty poet of Vijayanagara outsmarts a greedy priest, retold in our own words.'),
  // ── philosophy and poetry ──
  B('meditations', 'philosophy', 'Meditations', 'Marcus Aurelius', 'Begin the morning by saying to thyself, I shall meet with the busy-body, the ungrateful, arrogant, deceitful, envious, unsocial. All these things happen to them by reason of their ignorance of what is good and evil.', 'The private notes of a Roman emperor on how to stay calm.'),
  B('artofwar', 'philosophy', 'The Art of War', 'Sun Tzu', 'Sun Tzu said: The art of war is of vital importance to the State.', 'Short chapters on strategy that people still read for business and life.'),
  B('ozymandias', 'poetry', 'Ozymandias', 'Percy Bysshe Shelley', 'I met a traveller from an antique land,\nWho said--"Two vast and trunkless legs of stone\nStand in the desert....Near them, on the sand,\nHalf sunk a shatter\'d visage lies."', 'What is left of a king who said, look on my works.'),
  B('daffodils', 'poetry', 'I Wandered Lonely as a Cloud', 'William Wordsworth', 'I wandered lonely as a cloud\nThat floats on high o\'er vales and hills,\nWhen all at once I saw a crowd,\nA host, of golden daffodils.', 'A walk in the Lake District and a field of flowers.'),
  B('if', 'poetry', 'If--', 'Rudyard Kipling', 'If you can keep your head when all about you\nAre losing theirs and blaming it on you,\nIf you can trust yourself when all men doubt you,\nBut make allowance for their doubting too.', 'Advice from a father to a son.'),
];

const byId = Object.fromEntries(BOOKS.map(b => [b.id, b]));
const pick = (ids) => ids.map(i => byId[i]).filter(Boolean);

// Which books sit on which bookshelf — the study (a reading room) has the most,
// the bedroom a small, cosy handful.
export const SHELVES = {
  'study-a': { title: 'Study library', books: pick(['dracula', 'frankenstein', 'jekyll', 'telltale', 'usher', 'screw', 'raven', 'phantom', 'dorian', 'paw', 'scarlet', 'four', 'hound', 'speckled', 'redhead', 'carbuncle', 'final', 'morgue', 'bluecross', 'crimepun', 'steps', 'whitewoman', 'montecristo', 'thursday']) },
  'study-b': { title: 'Study classics', books: pick(['timemachine', 'worlds', 'leagues', 'moby', 'eighty', 'crusoe', 'gulliver', 'twocities', 'expectations', 'carol', 'walden', 'meditations', 'artofwar', 'gatsby']) },
  hall: { title: 'Living room shelf', books: pick(['treasure', 'jungle', 'alice', 'oz', 'peterpan', 'sawyer', 'gitanjali', 'panchatantra', 'birbal', 'tenali', 'ozymandias', 'daffodils', 'if']) },
  bed: { title: 'Bedside shelf', books: pick(['pride', 'emma', 'jane', 'wuthering', 'persuasion', 'sense', 'romeo', 'sonnet18']) },
  default: { title: 'Bookshelf', books: pick(['pride', 'jane', 'sonnet43', 'karenina', 'women', 'gitanjali1']) },
};

// Items in the fridge. `kind` picks a drawing in PropViewers.jsx.
export const FRIDGE_SHELVES = [
  [
    { name: 'Milk', kind: 'carton', color: '#f4f6ff', accent: '#2f7fe0', label: 'MILK' },
    { name: 'Curd (dahi)', kind: 'tub', color: '#fbf6e8', accent: '#d9c9a8', label: 'DAHI' },
    { name: 'Paneer', kind: 'block', color: '#f6edd0', accent: '#e8d9a8', label: 'PANEER' },
    { name: 'Butter', kind: 'block', color: '#f7d96a', accent: '#e0b83a', label: 'BUTTER' },
    { name: 'Eggs', kind: 'eggs', color: '#f1e2c4', accent: '#d9c49a' },
  ],
  [
    { name: 'Mango juice', kind: 'carton', color: '#ffb347', accent: '#e07a10', label: 'MANGO' },
    { name: 'Lassi', kind: 'bottle', color: '#fff2f6', accent: '#ff7fa5', label: 'LASSI' },
    { name: 'Cold coffee', kind: 'bottle', color: '#c9a77a', accent: '#6b4a2f', label: 'COFFEE' },
    { name: 'Leftover dal', kind: 'tub', color: '#fff1c8', accent: '#e0a020', label: 'DAL' },
    { name: 'Chocolate cake', kind: 'cake', color: '#5a3a24', accent: '#ff6fb5' },
  ],
  [
    { name: 'Mango pickle (achaar)', kind: 'jar', color: '#d0592a', accent: '#7a2a10', label: 'ACHAAR' },
    { name: 'Mint chutney', kind: 'jar', color: '#3aa862', accent: '#1f6a3a', label: 'CHUTNEY' },
    { name: 'Tomato ketchup', kind: 'bottle', color: '#d0392b', accent: '#7a1a10', label: 'KETCHUP' },
    { name: 'Jam', kind: 'jar', color: '#a02a6a', accent: '#5a1038', label: 'JAM' },
    { name: 'Cola', kind: 'can', color: '#c0392b', accent: '#f4f6ff', label: 'COLA' },
  ],
  [
    { name: 'Tomatoes', kind: 'veg', color: '#e0392b', accent: '#2f8f4a' },
    { name: 'Green chillies', kind: 'leaf', color: '#2f9e4a', accent: '#1f6a3a' },
    { name: 'Coriander', kind: 'leaf', color: '#3aa862', accent: '#2f8f4a' },
    { name: 'Watermelon', kind: 'veg', color: '#e0526a', accent: '#2f8f4a' },
    { name: 'Water bottle', kind: 'bottle', color: '#bfe9ff', accent: '#4fa8ff', label: 'WATER' },
  ],
];

// Dishes you can cook on the stove: vessel, what is in it, the steps shown while
// it cooks, and the finished plate colour.
export const DISHES = [
  { id: 'chai', name: 'Masala chai', vessel: 'pot', fill: '#b07a4a', bubble: '#e8c9a0', plate: 'cup', done: '#b07a4a', steps: ['Boil water with ginger and cardamom', 'Add tea leaves and let it darken', 'Pour in milk and sugar', 'Simmer until it rises'] },
  { id: 'dal', name: 'Dal tadka', vessel: 'pot', fill: '#e8b830', bubble: '#f5d870', plate: 'bowl', done: '#e8b830', steps: ['Boil toor dal with turmeric', 'Heat ghee and splutter jeera', 'Add garlic, chillies and tomato', 'Pour the tadka over the dal'] },
  { id: 'rice', name: 'Jeera rice', vessel: 'pot', fill: '#f4efe0', bubble: '#ffffff', plate: 'bowl', done: '#f4efe0', steps: ['Rinse the basmati rice', 'Fry jeera in ghee', 'Add rice and water', 'Cover and cook until fluffy'] },
  { id: 'roti', name: 'Roti on the tawa', vessel: 'tawa', fill: '#d9a860', bubble: '#f4d9a0', plate: 'roti', done: '#d9a860', steps: ['Roll the dough thin and round', 'Place on the hot tawa', 'Flip when bubbles appear', 'Puff it over the open flame'] },
  { id: 'paneer', name: 'Paneer butter masala', vessel: 'pan', fill: '#e0702a', bubble: '#f4a060', plate: 'bowl', done: '#e0702a', steps: ['Fry onion and tomato paste in butter', 'Add masalas and cream', 'Slide in the paneer cubes', 'Finish with kasuri methi'] },
  { id: 'omelette', name: 'Masala omelette', vessel: 'pan', fill: '#f4d860', bubble: '#fff2a0', plate: 'flat', done: '#f4d860', steps: ['Whisk eggs with onion and chilli', 'Pour into the hot pan', 'Cook until set at the edges', 'Fold and serve'] },
  { id: 'maggi', name: 'Masala noodles', vessel: 'pan', fill: '#e0a030', bubble: '#f4c860', plate: 'bowl', done: '#e0a030', steps: ['Boil water with the masala', 'Add the noodles', 'Stir in chopped veggies', 'Let the water cook away'] },
  { id: 'sabzi', name: 'Aloo gobi', vessel: 'pan', fill: '#e8c040', bubble: '#f4dc80', plate: 'bowl', done: '#e8c040', steps: ['Splutter jeera and ginger', 'Add potato and cauliflower', 'Sprinkle turmeric and coriander', 'Cover and cook until soft'] },
];

export const OVEN_ITEMS = [
  { id: 'cake', name: 'Chocolate cake', kind: 'cake', temp: 180, minutes: 35 },
  { id: 'pizza', name: 'Pizza', kind: 'pizza', temp: 220, minutes: 12 },
  { id: 'cookies', name: 'Cookies', kind: 'cookies', temp: 170, minutes: 14 },
];
