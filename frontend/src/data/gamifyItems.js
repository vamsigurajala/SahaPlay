// Contents of the wardrobes, the vanity (makeup) shelf and the garden viewers.
// `kind` picks a drawing in components/gamify/viewerArt.jsx.

const C = (name, kind, color, accent) => ({ name, kind, color, accent });

export const WARDROBES = {
  'wd-a': {
    title: 'Everyday wardrobe',
    sections: [
      { label: 'Hanging', items: [
        C('Checked shirt', 'shirt', '#4a78c2', '#e8eefc'), C('White shirt', 'shirt', '#f2f4fa', '#c9d0e4'), C('Denim jacket', 'jacket', '#3f6aa8', '#2a4a7a'),
        C('Blue kurta', 'kurta', '#2f6fb5', '#f0c860'), C('Hoodie', 'jacket', '#6a5aa8', '#4a3c80'), C('Blazer', 'jacket', '#2a2f3d', '#6a7088'),
      ] },
      { label: 'Folded', items: [
        C('T-shirt', 'tshirt', '#e0529f', '#ffffff'), C('Jeans', 'pants', '#3a5f9a', '#2a4570'), C('Shorts', 'shorts', '#c9a77a', '#8a6a40'),
        C('Sweater', 'tshirt', '#c24a3a', '#8a2a1a'), C('Track pants', 'pants', '#3a3a48', '#20202a'), C('Polo T-shirt', 'tshirt', '#3aa862', '#ffffff'),
      ] },
      { label: 'Shoes and extras', items: [
        C('Sneakers', 'shoe', '#f2f4fa', '#e0392b'), C('Formal shoes', 'shoe', '#4a2a1a', '#2a1208'), C('Sandals', 'sandal', '#c9a77a', '#6a4a20'),
        C('Cap', 'cap', '#2f6fb5', '#ffffff'), C('Belt', 'belt', '#5a3a24', '#d9c48a'), C('Watch', 'watch', '#2a2f3d', '#c0c6d8'), C('Sunglasses', 'glasses', '#1a1a22', '#6a7088'), C('Backpack', 'bag', '#e08a2a', '#7a4a10'),
      ] },
    ],
  },
  'wd-b': {
    title: 'Ethnic and party wear',
    sections: [
      { label: 'Hanging', items: [
        C('Silk saree', 'saree', '#c2185b', '#f0c860'), C('Green saree', 'saree', '#1f8a5a', '#f0c860'), C('Anarkali kurta', 'dress', '#6a3fb5', '#f0c860'),
        C('Lehenga', 'dress', '#d0392b', '#f0c860'), C('Sherwani', 'kurta', '#e8c9a0', '#8a5a20'), C('Dupatta', 'scarf', '#e0529f', '#f0c860'),
      ] },
      { label: 'Folded', items: [
        C('Cotton kurti', 'kurta', '#ff8a5a', '#ffffff'), C('Leggings', 'pants', '#2a2a38', '#14141c'), C('Palazzo', 'pants', '#3aa8a0', '#1f6a66'),
        C('Salwar suit', 'kurta', '#a56bff', '#e8d9ff'), C('Blouse', 'tshirt', '#c2185b', '#f0c860'), C('Pyjama set', 'pants', '#8dd0ff', '#4a8ac2'),
      ] },
      { label: 'Footwear and accessories', items: [
        C('Heels', 'heel', '#c2185b', '#7a0a38'), C('Juttis', 'sandal', '#f0b73a', '#c2185b'), C('Ballet flats', 'shoe', '#f2c9d9', '#c2185b'),
        C('Handbag', 'bag', '#c2185b', '#f0c860'), C('Clutch', 'bag', '#2a2f3d', '#f0c860'), C('Scarf', 'scarf', '#4fa8ff', '#ffffff'),
      ] },
    ],
  },
  'wd-c': {
    title: 'Winter and travel',
    sections: [
      { label: 'Hanging', items: [
        C('Puffer jacket', 'jacket', '#e0392b', '#8a1a10'), C('Woollen coat', 'jacket', '#8a6a4a', '#5a3a24'), C('Shawl', 'scarf', '#a56bff', '#f0c860'),
        C('Raincoat', 'jacket', '#f0c030', '#c29010'), C('Cardigan', 'jacket', '#7a8cff', '#4a5ac2'), C('Leather jacket', 'jacket', '#2a2a30', '#6a6a78'),
      ] },
      { label: 'Folded', items: [
        C('Thermals', 'tshirt', '#8a8fa8', '#5a5f78'), C('Woollen sweater', 'tshirt', '#2f8f6a', '#1f5a44'), C('Cargo pants', 'pants', '#6a7a4a', '#4a5a2a'),
        C('Socks', 'sock', '#e0529f', '#ffffff'), C('Gloves', 'sock', '#3a3a48', '#6a6a78'), C('Woollen cap', 'cap', '#c24a3a', '#ffffff'),
      ] },
      { label: 'Boots and bags', items: [
        C('Trekking boots', 'shoe', '#6a4a2a', '#2a1a0a'), C('Gum boots', 'shoe', '#2f7a5a', '#10301f'), C('Suitcase', 'bag', '#3a5ac2', '#1a2a6a'),
        C('Muffler', 'scarf', '#e08a2a', '#ffffff'), C('Umbrella', 'umbrella', '#d0392b', '#2a2a38'), C('Duffel bag', 'bag', '#2a2f3d', '#e08a2a'),
      ] },
    ],
  },
};

export const COSMETICS = {
  title: 'Dressing table',
  sections: [
    { label: 'Makeup', items: [
      C('Lipstick', 'lipstick', '#d0183a', '#3a1a22'), C('Compact powder', 'compact', '#e8c9a0', '#2a2a38'), C('Foundation', 'bottle', '#e8c0a0', '#2a2a38'),
      C('Kajal', 'pencil', '#1a1a22', '#c0c6d8'), C('Mascara', 'mascara', '#1a1a22', '#e0529f'), C('Eyeshadow palette', 'palette', '#c2185b', '#5a1a3a'),
      C('Blush', 'compact', '#ff8aa5', '#c2185b'), C('Nail polish', 'polish', '#d0183a', '#1a1a22'), C('Lip gloss', 'lipstick', '#ff7aa5', '#f0c860'),
      C('Bindi pack', 'bindi', '#d0183a', '#f0c860'), C('Sindoor', 'jar', '#e0392b', '#7a1a10'), C('Eyeliner', 'pencil', '#3a2a5a', '#c0c6d8'),
    ] },
    { label: 'Hair', items: [
      C('Wooden comb', 'comb', '#c9a77a', '#6a4a20'), C('Hair brush', 'brush', '#e0529f', '#5a3a24'), C('Hair clips', 'clips', '#f0b73a', '#d0183a'),
      C('Hair oil', 'bottle', '#4a8a3a', '#f0c860'), C('Shampoo', 'bottle', '#4fa8ff', '#ffffff'), C('Hair dryer', 'dryer', '#e0529f', '#3a3a48'),
      C('Scrunchies', 'bangles', '#a56bff', '#ff6fb5'), C('Hair serum', 'bottle', '#f0c860', '#7a5a10'),
    ] },
    { label: 'Skin and fragrance', items: [
      C('Face cream', 'jar', '#f6efe0', '#c9a77a'), C('Face wash', 'tube', '#3aa8a0', '#ffffff'), C('Sunscreen', 'tube', '#f0c030', '#ffffff'),
      C('Moisturiser', 'jar', '#ffd9e6', '#e0529f'), C('Perfume', 'perfume', '#c8a0ff', '#f0c860'), C('Rose water', 'perfume', '#ff9ab5', '#c2185b'),
      C('Lip balm', 'lipstick', '#f6efe0', '#3aa862'), C('Body lotion', 'bottle', '#f8f4ff', '#a56bff'),
    ] },
    { label: 'Jewellery', items: [
      C('Bangles', 'bangles', '#f0b73a', '#d0183a'), C('Earrings', 'earrings', '#f0b73a', '#d0183a'), C('Necklace', 'necklace', '#f0b73a', '#c2185b'),
      C('Hand mirror', 'mirror', '#e8f0ff', '#c9a77a'), C('Tweezers', 'pencil', '#c0c6d8', '#6a7088'),
    ] },
  ],
};

const P = (name, kind, color, accent, note, local) => ({ name, kind, color, accent, note, local });

export const GARDEN = {
  flowers: {
    title: 'Flower garden',
    items: [
      P('Rose', 'rose', '#d0183a', '#2f8f4a', 'Fragrant, with thorny stems; blooms in many colours.', 'Gulab'),
      P('Marigold', 'pom', '#f0a020', '#2f8f4a', 'Bright orange-yellow, used in garlands and festivals.', 'Genda'),
      P('Jasmine', 'star', '#fffaf0', '#2f8f4a', 'Tiny white flowers with a sweet evening scent.', 'Mogra / Chameli'),
      P('Sunflower', 'sun', '#f6c030', '#2f8f4a', 'Tall, and its head follows the sun.', 'Surajmukhi'),
      P('Lotus', 'lotus', '#ff9ac0', '#2f8f4a', 'Grows in still water; the national flower of India.', 'Kamal'),
      P('Hibiscus', 'hibiscus', '#e0183a', '#f0c030', 'Large trumpet flower with a long stamen.', 'Gudhal'),
      P('Tulip', 'tulip', '#e0529f', '#2f8f4a', 'Cup-shaped spring flower that grows from a bulb.', 'Tulip'),
      P('Lily', 'lily', '#fff0f6', '#e08a2a', 'Six curved petals with speckled throats.', 'Lily'),
      P('Daisy', 'daisy', '#ffffff', '#2f8f4a', 'White petals around a yellow centre.', 'Gul-e-daudi'),
      P('Orchid', 'orchid', '#c85ae0', '#2f8f4a', 'Delicate flowers on a long arching stem.', 'Orchid'),
      P('Lavender', 'spike', '#9a7aff', '#2f8f4a', 'Purple spikes with a calming scent.', 'Lavender'),
      P('Bougainvillea', 'paper', '#e0187a', '#2f8f4a', 'Papery magenta bracts that cover walls and arches.', 'Bougainvillea'),
      P('Chrysanthemum', 'pom', '#e0b030', '#2f8f4a', 'Layered petals; a favourite autumn bloom.', 'Guldaudi'),
      P('Dahlia', 'pom', '#e0529f', '#2f8f4a', 'Round, many-petalled flowers in bold colours.', 'Dahlia'),
    ],
  },
  veg: {
    title: 'Vegetable patch',
    items: [
      P('Tomato', 'tomato', '#e0392b', '#2f8f4a', 'Red fruit that ripens on the vine.', 'Tamatar'),
      P('Brinjal', 'brinjal', '#5a2a8a', '#2f8f4a', 'Glossy purple fruit, great for bharta.', 'Baingan'),
      P('Okra', 'okra', '#4aa83a', '#2f8f4a', 'Slender green pods, ladies finger.', 'Bhindi'),
      P('Green chilli', 'chilli', '#2f9e4a', '#1f6a3a', 'Small and hot; ripens red.', 'Hari mirch'),
      P('Carrot', 'carrot', '#f08a20', '#2f8f4a', 'Sweet orange root that grows underground.', 'Gajar'),
      P('Cabbage', 'cabbage', '#7ac85a', '#3a8a3a', 'Tightly layered round head of leaves.', 'Patta gobhi'),
      P('Cauliflower', 'cauli', '#f6f2e0', '#4aa83a', 'A creamy flower head wrapped in leaves.', 'Phool gobhi'),
      P('Spinach', 'leaf', '#2f8a3a', '#1f5a2a', 'Dark leafy green, rich in iron.', 'Palak'),
      P('Pumpkin', 'pumpkin', '#f08a20', '#4a8a2a', 'Large ribbed gourd on a creeping vine.', 'Kaddu'),
      P('Bottle gourd', 'gourd', '#a8d890', '#4a8a2a', 'Pale green and mild in taste.', 'Lauki'),
      P('Cucumber', 'cucumber', '#3a9a4a', '#1f6a2a', 'Cool, crisp fruit eaten fresh.', 'Kheera'),
      P('Corn', 'corn', '#f6d030', '#4aa83a', 'Golden kernels on a cob wrapped in husk.', 'Makka'),
      P('Onion', 'onion', '#a84a8a', '#4aa83a', 'Layered bulb with a green stalk.', 'Pyaaz'),
      P('Peas', 'peas', '#5ac83a', '#2f8f4a', 'Sweet green seeds in a pod.', 'Matar'),
      P('Capsicum', 'capsicum', '#e0392b', '#2f8f4a', 'Bell pepper in red, green or yellow.', 'Shimla mirch'),
      P('Potato', 'potato', '#c9a060', '#8a6a30', 'A tuber that grows under the soil.', 'Aloo'),
    ],
  },
  herbs: {
    title: 'Herbs and kitchen plants',
    items: [
      P('Tulsi', 'sprig', '#2f9a4a', '#6a4a2a', 'Holy basil, kept in the courtyard vrindavan.', 'Tulsi'),
      P('Mint', 'sprig', '#4ac86a', '#6a4a2a', 'Cooling leaves for chutney and chai.', 'Pudina'),
      P('Coriander', 'sprig', '#5ac05a', '#6a4a2a', 'Fresh leaves to finish a curry.', 'Dhania'),
      P('Curry leaf', 'sprig', '#1f7a3a', '#6a4a2a', 'Aromatic leaves for tempering.', 'Kadi patta'),
      P('Aloe vera', 'aloe', '#6ac88a', '#c9a77a', 'Thick leaves with a soothing gel.', 'Ghritkumari'),
      P('Lemongrass', 'grass', '#9ad85a', '#6a4a2a', 'Citrus-scented grass for tea.', 'Hari chai'),
      P('Fenugreek', 'sprig', '#3ab05a', '#6a4a2a', 'Small bitter leaves, methi.', 'Methi'),
      P('Ginger', 'ginger', '#d9b070', '#8a6a30', 'Knobbly root with a sharp taste.', 'Adrak'),
    ],
  },
};
