// Dog pet shared state management for Gamify Mode
// Tracks cleanliness, hunger, happiness, and dirtiness over time

const STORAGE_KEY = 'gamify_dog_pet_state_v1';

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Decay cleanliness based on elapsed time since last update
      const elapsedMinutes = (Date.now() - (parsed.lastUpdated || Date.now())) / 60000;
      const decay = Math.min(60, Math.floor(elapsedMinutes * 3));
      return {
        cleanliness: Math.max(20, (parsed.cleanliness ?? 45) - decay),
        hunger: Math.max(15, (parsed.hunger ?? 55) - Math.floor(decay * 0.8)),
        happiness: Math.max(25, (parsed.happiness ?? 70) - Math.floor(decay * 0.5)),
        name: parsed.name || 'Buddy',
        totalBaths: parsed.totalBaths || 0,
        totalMeals: parsed.totalMeals || 0,
        totalPets: parsed.totalPets || 0,
        lastUpdated: Date.now(),
      };
    }
  } catch {
    // fallback
  }
  return {
    cleanliness: 40, // starts slightly muddy so user immediately sees dirt & bath options!
    hunger: 50,
    happiness: 65,
    name: 'Buddy',
    totalBaths: 0,
    totalMeals: 0,
    totalPets: 0,
    lastUpdated: Date.now(),
  };
}

let state = loadInitialState();
const listeners = new Set();

function notify() {
  state.lastUpdated = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded / private mode
  }
  listeners.forEach(fn => {
    try {
      fn({ ...state, isDirty: state.cleanliness < 60 });
    } catch (e) {
      console.warn('[DogState] listener error', e);
    }
  });
}

// Background dirt accumulation ticker while user is in the house
let decayInterval = null;
function startDecay() {
  if (decayInterval) return;
  decayInterval = setInterval(() => {
    // Slowly decays cleanliness by 1 point every 6 seconds (gets dirty over ~2-3 minutes of running outdoors)
    if (state.cleanliness > 10) {
      state.cleanliness = Math.max(10, state.cleanliness - 1);
    }
    if (state.hunger > 10 && Math.random() < 0.4) {
      state.hunger = Math.max(10, state.hunger - 1);
    }
    notify();
  }, 6000);
}

if (typeof window !== 'undefined') {
  startDecay();
}

export const dogState = {
  get() {
    return { ...state, isDirty: state.cleanliness < 60 };
  },
  subscribe(fn) {
    listeners.add(fn);
    fn({ ...state, isDirty: state.cleanliness < 60 });
    return () => listeners.delete(fn);
  },
  bath() {
    state.cleanliness = Math.min(85, Math.max(75, state.cleanliness + 45));
    state.happiness = Math.min(100, state.happiness + 15);
    state.totalBaths = (state.totalBaths || 0) + 1;
    notify();
    return { ...state, isDirty: state.cleanliness < 60 };
  },
  dry() {
    state.cleanliness = 100; // 100% sparkling clean once dried!
    state.happiness = Math.min(100, state.happiness + 20);
    notify();
    return { ...state, isDirty: state.cleanliness < 60 };
  },
  feed() {
    state.hunger = 100;
    state.happiness = Math.min(100, state.happiness + 20);
    state.totalMeals = (state.totalMeals || 0) + 1;
    notify();
    return { ...state, isDirty: state.cleanliness < 60 };
  },
  pet() {
    state.happiness = 100;
    state.totalPets = (state.totalPets || 0) + 1;
    notify();
    return { ...state, isDirty: state.cleanliness < 60 };
  },
  makeDirty() {
    state.cleanliness = 20;
    notify();
    return { ...state, isDirty: state.cleanliness < 60 };
  },
};
