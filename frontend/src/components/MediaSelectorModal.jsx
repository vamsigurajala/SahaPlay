import React, { useRef, useState, useEffect } from 'react';
import {
  X, Monitor, Link as LinkIcon, Upload, ChevronRight, Search,
  Gamepad2, Tv, Activity, FileText, Timer, HelpCircle, Palette,
  Globe, Users, Sparkles, CheckSquare, BookOpen, Film, AlertTriangle,
  Users2, User, Music, Video, Mic, Radio
} from 'lucide-react';

import { FaYoutube, FaTwitch, FaVimeo, FaInstagram, FaApple, FaSpotify, FaTiktok, FaSoundcloud, FaFacebook } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { SiNetflix, SiCrunchyroll, SiHbomax, SiAppletv } from 'react-icons/si';

export const OPTIONS = [
  // ── Streaming ──
  { id: 'youtube', name: 'YouTube', category: 'Streaming', subtitle: 'Search and watch videos together', badge: 'Multiplayer', bgColor: '#18181b', color: '#fff', brandColor: '#FF0000', icon: FaYoutube, type: 'browser', isWide: true, image: '/images/apps/youtube.jpg' },
  { id: 'twitch', name: 'Twitch', category: 'Streaming', subtitle: 'Watch live gaming broadcasts together', badge: 'Multiplayer', bgColor: '#18181b', color: '#fff', brandColor: '#9146FF', icon: FaTwitch, type: 'browser', isWide: true, image: '/images/apps/twitch.jpg' },
  { id: 'vimeo', name: 'Vimeo', category: 'Streaming', subtitle: 'Cinematic films and Vimeo originals', badge: 'Multiplayer', bgColor: '#111', color: '#fff', brandColor: '#00adef', icon: FaVimeo, type: 'browser', isWide: true, image: '/images/apps/vimeo.jpg' },
  { id: 'netflix', name: 'Netflix', category: 'Streaming', subtitle: 'Co-watch movies and TV series', badge: 'Multiplayer', bgColor: '#000', color: '#E50914', brandColor: '#E50914', icon: SiNetflix, type: 'placeholder', url: 'https://netflix.com', isWide: true, image: '/images/apps/netflix.jpg' },
  { id: 'appletv', name: 'Apple TV', category: 'Streaming', subtitle: 'Apple Originals and premium movies', badge: 'Multiplayer', bgColor: '#000', color: '#fff', brandColor: '#a855f7', icon: SiAppletv, type: 'placeholder', url: 'https://tv.apple.com', isWide: true, image: '/images/apps/appletv.jpg' },
  { id: 'prime', name: 'Prime Video', category: 'Streaming', subtitle: 'Amazon originals and movies', badge: 'Multiplayer', bgColor: '#0F1721', color: '#00A8E1', brandColor: '#00A8E1', icon: Film, type: 'placeholder', url: 'https://primevideo.com', isWide: true, image: '/images/apps/prime.jpg' },
  { id: 'hulu', name: 'Hulu', category: 'Streaming', subtitle: 'Stream TV shows and movies', badge: 'Multiplayer', bgColor: '#000', color: '#1ce783', brandColor: '#1ce783', icon: Film, type: 'placeholder', url: 'https://hulu.com', isWide: true, image: '/images/apps/hulu.jpg' },
  { id: 'hbomax', name: 'HBO Max', category: 'Streaming', subtitle: 'Warner Bros, DC, and HBO titles', badge: 'Multiplayer', bgColor: '#18002a', color: '#fff', brandColor: '#991ef2', icon: SiHbomax, type: 'placeholder', url: 'https://max.com', isWide: true, image: '/images/apps/hbomax.jpg' },
  { id: 'hotstar', name: 'Disney+ Hotstar', category: 'Streaming', subtitle: 'Disney, Marvel, and live sports', badge: 'Multiplayer', bgColor: '#040714', color: '#0063e5', brandColor: '#0063e5', icon: Film, type: 'placeholder', url: 'https://hotstar.com', isWide: true, image: '/images/apps/hotstar.jpg' },
  { id: 'crunchyroll', name: 'Crunchyroll', category: 'Streaming', subtitle: 'Watch anime shows and movies', badge: 'Multiplayer', bgColor: '#000', color: '#F47521', brandColor: '#F47521', icon: SiCrunchyroll, type: 'placeholder', url: 'https://crunchyroll.com', isWide: true, image: '/images/apps/crunchyroll.jpg' },
  { id: 'zee5', name: 'ZEE5', category: 'Streaming', subtitle: 'Zee5 shows and movies', badge: 'Multiplayer', bgColor: '#1A0A3B', color: '#fff', brandColor: '#5E2A8C', icon: Film, type: 'placeholder', url: 'https://zee5.com', isWide: true, image: '/platforms/zee5plt.jpg' },
  { id: 'sonyliv', name: 'SonyLIV', category: 'Streaming', subtitle: 'SonyLIV premium matches and shows', badge: 'Multiplayer', bgColor: '#0A0A14', color: '#fff', brandColor: '#D50000', icon: Film, type: 'placeholder', url: 'https://sonyliv.com', isWide: true, image: '/platforms/Sonylivplt.jpg' },
  { id: 'peacocktv', name: 'Peacock', category: 'Streaming', subtitle: 'Peacock shows and originals', badge: 'Multiplayer', bgColor: '#011825', color: '#fff', brandColor: '#4FC3F7', icon: Film, type: 'placeholder', url: 'https://peacocktv.com', isWide: true, image: '/platforms/Peacocktvplt.jpg' },
  { id: 'viki', name: 'Rakuten Viki', category: 'Streaming', subtitle: 'Asian dramas and movies', badge: 'Multiplayer', bgColor: '#0A1929', color: '#fff', brandColor: '#00B8D4', icon: Film, type: 'placeholder', url: 'https://viki.com', isWide: true, image: '/platforms/vikiplt.png' },
  { id: 'mxplayer', name: 'MX Player', category: 'Streaming', subtitle: 'MX Player web series and movies', badge: 'Multiplayer', bgColor: '#0A0A14', color: '#fff', brandColor: '#FF6B35', icon: Film, type: 'placeholder', url: 'https://mxplayer.in', isWide: true, image: '/platforms/MXplayerplt.jpg' },
  { id: 'aha', name: 'aha', category: 'Streaming', subtitle: 'aha Telugu and Tamil entertainment', badge: 'Multiplayer', bgColor: '#E8400A', color: '#fff', brandColor: '#FF5722', icon: Film, type: 'placeholder', url: 'https://aha.video', isWide: true, image: '/platforms/Ahaplt.png' },
  { id: 'tubi', name: 'Tubi TV', category: 'Streaming', subtitle: 'Watch free movies and TV shows online', badge: 'Virtual Browser', color: '#ff4e00', icon: Film, type: 'virtual_browser', url: 'https://tubitv.com', image: '/images/apps/tubitv.png' },

  // ── Games — Multiplayer ──
  { id: 'chessonline',    name: 'Master Chess',    category: 'Games', gameMode: 'Multiplayer', subtitle: 'Play classic chess against opponents',  badge: 'Multiplayer', color: '#10b981', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/master-chess?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                  image: '/images/apps/chess.jpg' },
  { id: 'mastercheckers', name: 'Master Checkers', category: 'Games', gameMode: 'Multiplayer', subtitle: 'Multiplayer checkers board game',        badge: 'Multiplayer', color: '#ef4444', icon: Gamepad2, type: 'embed', url: 'https://foony.com/games/checkers',                       image: '/images/apps/checkers.png' },
  { id: 'ludo',           name: 'Ludo',            category: 'Games', gameMode: 'Multiplayer', subtitle: 'Classic ludo board game with friends', badge: 'Multiplayer', color: '#f59e0b', icon: Gamepad2, type: 'embed', url: 'https://foony.com/games/ludo',                           image: '/images/apps/ludo.png' },
  { id: 'tictactoe',      name: 'Tic Tac Toe',     category: 'Games', gameMode: 'Multiplayer', subtitle: 'Classic grid strategy game for two',   badge: 'Multiplayer', color: '#06b6d4', icon: Gamepad2, type: 'embed', url: 'https://foony.com/games/tic-tac-toe',                    image: '/images/apps/tictactoe.png' },
  { id: 'carromhero',     name: 'Carrom Hero',      category: 'Games', gameMode: 'Multiplayer', subtitle: 'Multiplayer carrom board striker',     badge: 'Multiplayer', color: '#a855f7', icon: Gamepad2, type: 'embed', url: 'https://zv1y2i8p.play.gamezop.com/g/H1Hgyn6XqAS',          image: '/images/apps/carromhero.png' },
  { id: '8ballpool',      name: '8 Ball Pool',     category: 'Games', gameMode: 'Multiplayer', subtitle: 'Play multiplayer pool billiards online', badge: 'Multiplayer', color: '#3b82f6', icon: Gamepad2, type: 'embed', url: 'https://foony.com/games/9-ball-pool-online-billiards', image: '/images/apps/8ball.jpg' },
  { id: 'connect4',       name: '4 in a Row',      category: 'Games', gameMode: 'Multiplayer', subtitle: 'Connect four chips in a row to win',   badge: 'Multiplayer', color: '#dc2626', icon: Gamepad2, type: 'embed', url: 'https://foony.com/games/4-in-a-row-connect',              image: '/images/apps/fourinarow.png' },
  { id: 'sudoku',          name: 'Sudoku',           category: 'Games', gameMode: 'Multiplayer', subtitle: 'Classic number puzzle brain teaser',   badge: 'Multiplayer', color: '#3b82f6', icon: Gamepad2, type: 'embed', url: 'https://foony.com/games/sudoku-online',                  image: '/images/apps/sudoku.png' },
  { id: 'fonoo',          name: 'Fonoo Card Game',  category: 'Games', gameMode: 'Multiplayer', subtitle: 'Exciting online multiplayer card game',  badge: 'Multiplayer', color: '#a855f7', icon: Gamepad2, type: 'embed', url: 'https://foony.com/games/foono-online-card-game',         image: '/images/apps/foono.png' },
  { id: 'jigsawpuzzle',    name: 'Jigsaw Puzzle',   category: 'Games', gameMode: 'Multiplayer', subtitle: 'Solve beautiful jigsaw puzzles with friends', badge: 'Multiplayer', color: '#10b981', icon: Gamepad2, type: 'embed', url: 'https://foony.com/games/jigsaw-puzzle-online',          image: '/images/apps/jigsawpuzzle.png' },
  { id: 'spades',          name: 'Spades',          category: 'Games', gameMode: 'Multiplayer', subtitle: 'Classic spades trick-taking card game',        badge: 'Multiplayer', color: '#a855f7', icon: Gamepad2, type: 'embed', url: 'https://foony.com/games/spades',                         image: '/images/apps/spades.png' },
  { id: 'hazmobfps',          name: 'Hazmob FPS Shooter',   category: 'Games', gameMode: 'Multiplayer', subtitle: 'Multiplayer tactical online FPS combat',       badge: 'Multiplayer', color: '#10b981', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/hazmob-fps-online-shooter?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',         image: '/images/apps/hazmob.png' },
  { id: 'rollingballssearace',name: 'Rolling Balls Sea Race',category: 'Games', gameMode: 'Multiplayer', subtitle: 'Vibrant multiplayer sphere racing on sea tracks',  badge: 'Multiplayer', color: '#3b82f6', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/rolling-balls-sea-race?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',        image: '/images/apps/rollingballs.png' },
  { id: 'minetogether',       name: 'Mine Together',        category: 'Games', gameMode: 'Multiplayer', subtitle: 'Multiplayer block-building mining adventure',  badge: 'Multiplayer', color: '#a855f7', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/mine-together?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',              image: '/images/apps/minetogether.png' },
  { id: 'imposter3d',         name: 'Imposter 3D',          category: 'Games', gameMode: 'Multiplayer', subtitle: 'Online multiplayer sci-fi horror survival',    badge: 'Multiplayer', color: '#dc2626', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/imposter-3d-online-horror?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',  image: '/images/apps/imposter3d.png' },
  { id: 'blackriver',         name: 'Blackriver Mystery',   category: 'Games', gameMode: 'Multiplayer', subtitle: 'Cooperative hidden objects detective mystery', badge: 'Multiplayer', color: '#fbbf24', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/blackriver-mystery-hidden-objects?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025', image: '/images/apps/blackriver.png' },
  { id: 'twoplayerminiga',    name: '2 Player Minigames',    category: 'Games', gameMode: 'Multiplayer', subtitle: 'Fun split-screen challenge mini-game battles', badge: 'Multiplayer', color: '#10b981', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/2-player-games-mini-games?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',       image: '/images/apps/2playergames.png' },
  { id: 'truthordareparty',   name: 'Truth or Dare Party',   category: 'Games', gameMode: 'Multiplayer', subtitle: 'Spin party game questions and dares with friends', badge: 'Multiplayer', color: '#ec4899', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/truth-or-dare-party-game?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',    image: '/images/apps/truthordareparty.png' },
  { id: 'dominoonlinedu',     name: 'Domino Online Multiplayer', category: 'Games', gameMode: 'Multiplayer', subtitle: 'Classic domino tiles duel on a digital board', badge: 'Multiplayer', color: '#3b82f6', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/domino-online-multiplayer?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',   image: '/images/apps/domino.png' },
  { id: 'two34playergames',   name: '2 3 4 Player Games',    category: 'Games', gameMode: 'Multiplayer', subtitle: 'Local multiplayer party games for everyone',   badge: 'Multiplayer', color: '#f59e0b', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/234-player-games?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',             image: '/images/apps/234minigames.png' },
  { id: 'rallyproonline',     name: 'Rally Pro Online',     category: 'Games', gameMode: 'Multiplayer', subtitle: 'High-speed multiplayer rally car racing',      badge: 'Multiplayer', color: '#6366f1', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/rally-pro-online?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',             image: '/images/apps/rallypro.png' },
  { id: 'hangman14play',      name: 'Hangman 1-4 Players',   category: 'Games', gameMode: 'Multiplayer', subtitle: 'Classic word guessing puzzle for 1-4 players', badge: 'Multiplayer', color: '#06b6d4', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/hangman-14-players?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',             image: '/images/apps/hangman4players.png' },
  { id: 'soccerrandom',       name: 'Soccer Random',        category: 'Games', gameMode: 'Multiplayer', subtitle: 'Physics-based funny online multiplayer soccer',badge: 'Multiplayer', color: '#10b981', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/soccer-random?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                  image: '/images/apps/soccerrandom.png' },
  // ── Games — Singleplayer ──
  { id: 'skyron',          name: 'Skyron',          category: 'Games', gameMode: 'Singleplayer', subtitle: 'Epic arcade runner adventure',          badge: 'Singleplayer', color: '#6366f1', icon: Gamepad2, type: 'embed', url: 'https://play.gamepix.com/strykon/embed',                   image: '/images/apps/skyron.png' },
  { id: 'drawsavepuzzle',  name: 'Draw Save Puzzle',category: 'Games', gameMode: 'Singleplayer', subtitle: 'Draw to save characters from traps',  badge: 'Singleplayer', color: '#f59e0b', icon: Gamepad2, type: 'embed', url: 'https://play.gamepix.com/draw-save-puzzle/embed',           image: '/images/apps/puzzle.png' },
  { id: 'mahjong',         name: 'Mahjong Solitaire',category: 'Games', gameMode: 'Singleplayer', subtitle: 'Match tiles in Mahjong board game',    badge: 'Singleplayer', color: '#10b981', icon: Gamepad2, type: 'embed', url: 'https://foony.com/games/mahjong-solitaire',             image: '/images/apps/mahjongsolitare.png' },
  { id: 'assasinhunt',    name: "Assassin's Hunt",  category: 'Games', gameMode: 'Singleplayer', subtitle: 'Wild west shooter action game',        badge: 'Singleplayer', color: '#dc2626', icon: Gamepad2, type: 'embed', url: 'https://zv1y2i8p.play.gamezop.com/g/9lpHai56Q',            image: '/images/apps/assasinshunt.png' },
  { id: 'finalwarzone',   name: 'Final War Dead Zone', category: 'Games', gameMode: 'Singleplayer', subtitle: 'Intense warzone survival shooter', badge: 'Singleplayer', color: '#7c3aed', icon: Gamepad2, type: 'embed', url: 'https://zv1y2i8p.play.gamezop.com/g/gTD1yQp3R',           image: '/images/apps/finalwardeadzone.png' },
  { id: 'fruitchop',      name: 'Fruit Chop',        category: 'Games', gameMode: 'Singleplayer', subtitle: 'Slice fruits in this fast-paced game', badge: 'Singleplayer', color: '#16a34a', icon: Gamepad2, type: 'embed', url: 'https://zv1y2i8p.play.gamezop.com/g/rkWfy2pXq0r',         image: '/images/apps/fruitchop.png' },
  { id: 'game2048',       name: '2048',              category: 'Games', gameMode: 'Singleplayer', subtitle: 'Merge tiles to reach 2048',            badge: 'Singleplayer', color: '#f97316', icon: Gamepad2, type: 'embed', url: 'https://zv1y2i8p.play.gamezop.com/g/NyM_JGWcx',            image: '/images/apps/2048.png' },
  { id: 'guesstheflag',   name: 'Guess The Flag',    category: 'Games', gameMode: 'Singleplayer', subtitle: 'Test your world flag knowledge',      badge: 'Singleplayer', color: '#0891b2', icon: Gamepad2, type: 'embed', url: 'https://zv1y2i8p.play.gamezop.com/g/SKLI0L06A',           image: '/images/apps/guesstheflag.png' },
  { id: 'blocksadventure',name: 'Blocks Adventure',  category: 'Games', gameMode: 'Singleplayer', subtitle: 'Block puzzle adventure game',          badge: 'Singleplayer', color: '#8b5cf6', icon: Gamepad2, type: 'embed', url: 'https://zv1y2i8p.play.gamezop.com/g/UCS62KJ8c',           image: '/images/apps/blocksadevnture.png' },
  { id: 'bubbleshooter',  name: 'Bubble Shooter',    category: 'Games', gameMode: 'Singleplayer', subtitle: 'Pop colorful bubbles classic game',   badge: 'Singleplayer', color: '#ec4899', icon: Gamepad2, type: 'embed', url: 'https://zv1y2i8p.play.gamezop.com/g/yVywAGBQ6',           image: '/images/apps/bubbleshooter.png' },
  { id: 'blazingblades',  name: 'Blazing Blades',    category: 'Games', gameMode: 'Singleplayer', subtitle: 'Fast-paced arena blade slashing combat', badge: 'Singleplayer', color: '#f97316', icon: Gamepad2, type: 'embed', url: 'https://zv1y2i8p.play.gamezop.com/g/UYiznUAya',           image: '/images/apps/blazingblades.png' },
  { id: 'bottleshot',     name: 'Bottle Shot',       category: 'Games', gameMode: 'Singleplayer', subtitle: 'Test your aim shooting glass bottles',  badge: 'Singleplayer', color: '#0891b2', icon: Gamepad2, type: 'embed', url: 'https://zv1y2i8p.play.gamezop.com/g/B1fSpMkP51m',          image: '/images/apps/bottleshot.png' },
  { id: 'paintjob',        name: 'Paint Job',        category: 'Games', gameMode: 'Singleplayer', subtitle: 'Paint and color puzzle game',          badge: 'Singleplayer', color: '#f59e0b', icon: Gamepad2, type: 'embed', url: 'https://foony.com/games/paintjob',                       image: '/images/apps/paintjob.png' },
  { id: 'breakout',        name: 'Breakout',         category: 'Games', gameMode: 'Singleplayer', subtitle: 'Classic brick breaker arcade game',   badge: 'Singleplayer', color: '#ec4899', icon: Gamepad2, type: 'embed', url: 'https://foony.com/games/breakout',                       image: '/images/apps/breakout.png' },
  { id: 'popaword',        name: 'Pop a Word',        category: 'Games', gameMode: 'Singleplayer', subtitle: 'Word pop spelling puzzle game',       badge: 'Singleplayer', color: '#06b6d4', icon: Gamepad2, type: 'embed', url: 'https://foony.com/games/popaword',                       image: '/images/apps/popaword.png' },
  { id: 'removeallarrows',    name: 'Remove All Arrows',    category: 'Games', gameMode: 'Singleplayer', subtitle: 'Arrow removal strategy physics puzzle game', badge: 'Singleplayer', color: '#f59e0b', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/remove-all-arrows?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',             image: '/images/apps/superarrowgo.png' },
  { id: 'riseofthedead',      name: 'Rise of the Dead',     category: 'Games', gameMode: 'Singleplayer', subtitle: 'Intense survival defence against hordes of zombies', badge: 'Singleplayer', color: '#dc2626', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/rise-of-the-dead?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',          image: '/images/apps/riseofthedead.png' },
  { id: 'stickmanio',         name: 'Stickman.io',          category: 'Games', gameMode: 'Singleplayer', subtitle: 'Fast-paced stickman arena capture adventure',  badge: 'Singleplayer', color: '#06b6d4', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/stickman-captureio?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',         image: '/images/apps/stickman.png' },
  { id: 'justimposter',       name: 'Just Imposter',        category: 'Games', gameMode: 'Singleplayer', subtitle: 'Space crewmate action and betrayal challenge',  badge: 'Singleplayer', color: '#6366f1', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/just-impostor?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',              image: '/images/apps/justimposter.png' },
  { id: 'crosswordpuzzl',     name: 'Crossword Puzzles',    category: 'Games', gameMode: 'Singleplayer', subtitle: 'Brain teaser crossword and arrowword puzzle games', badge: 'Singleplayer', color: '#10b981', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/crossword-arrowword-puzzles?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025', image: '/images/apps/crossword.png' },
  { id: 'mytownhome',         name: 'My Town Home',         category: 'Games', gameMode: 'Singleplayer', subtitle: 'Cozy dollhouse family playhouse story builder', badge: 'Singleplayer', color: '#ec4899', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/my-town-home-family-playhouse?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025', image: '/images/apps/mytownhome.png' },
  { id: 'drawwithpencil',     name: 'Tracoria: Draw, Color & Match', category: 'Games', gameMode: 'Singleplayer', subtitle: 'Creative drawing and coloring book simulation', badge: 'Singleplayer', color: '#a855f7', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/tracoria-draw-color-match?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025', image: '/images/apps/drawwithpencil.png' },
  { id: 'fivenightsathug',    name: 'Five Nights at Huggy', category: 'Games', gameMode: 'Singleplayer', subtitle: 'Spooky survival horror in a dark toy factory',   badge: 'Singleplayer', color: '#ef4444', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/five-nights-at-huggy?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',         image: '/images/apps/fivenightswithhuggy.png' },
  { id: 'thetallman',         name: 'The Tall Man',         category: 'Games', gameMode: 'Singleplayer', subtitle: 'Eerie horror adventure following the slender figure', badge: 'Singleplayer', color: '#4b5563', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/the-tall-man?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',             image: '/images/apps/tallman.png' },
  { id: 'nightshift',         name: 'Night Shift',          category: 'Games', gameMode: 'Singleplayer', subtitle: 'Survive a tense night shift convenience store shifts', badge: 'Singleplayer', color: '#dc2626', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/night-shift?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',               image: '/images/apps/nightshift.png' },
  { id: 'grannyoriginal',     name: 'Granny Original',      category: 'Games', gameMode: 'Singleplayer', subtitle: 'Escape the creepy haunted house from spooky Granny', badge: 'Singleplayer', color: '#7c3aed', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/granny-original?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',           image: '/images/apps/grannyoriginal.png' },
  { id: 'alongwayhome',       name: 'A Long Way Home',      category: 'Games', gameMode: 'Singleplayer', subtitle: 'Atmospheric journey and puzzle adventure',       badge: 'Singleplayer', color: '#0284c7', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/a-long-way-home?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',             image: '/images/apps/alongwayhome.png' },
  { id: 'breakstickcomp',     name: 'Break Stick',          category: 'Games', gameMode: 'Singleplayer', subtitle: 'Satisfying stick breaking physics sandbox solver',   badge: 'Singleplayer', color: '#f59e0b', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/break-stick-completely?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',       image: '/images/apps/breakstick.png' },
  { id: 'mtbdownhill',        name: 'MTB Downhill Extreme', category: 'Games', gameMode: 'Singleplayer', subtitle: 'Extreme mountain biking downhill racer',          badge: 'Singleplayer', color: '#3b82f6', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/mtb-downhill-extreme?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',        image: '/images/apps/mtbdownhill.png' },
  { id: 'knifesmash',         name: 'Knife Smash',          category: 'Games', gameMode: 'Singleplayer', subtitle: 'Hit targets and break logs with precision throws',   badge: 'Singleplayer', color: '#ef4444', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/knife-smash?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                 image: '/images/apps/knifesmash.png' },
  { id: 'motorcycleracer',    name: 'Motorcycle Racer',     category: 'Games', gameMode: 'Singleplayer', subtitle: 'Road mayhem high-speed motorcycle racing simulator', badge: 'Singleplayer', color: '#ec4899', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/motorcycle-racer-road-mayhem?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025', image: '/images/apps/motorcycleracer.png' },
  { id: 'megarampcity',       name: 'Mega Ramp City',       category: 'Games', gameMode: 'Singleplayer', subtitle: 'Extreme city stunt car driving simulator',          badge: 'Singleplayer', color: '#06b6d4', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/mega-ramp-city?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',             image: '/images/apps/megarampcity.png' },
  { id: 'bubblepoplegend',    name: 'Bubble Pop Legend',    category: 'Games', gameMode: 'Singleplayer', subtitle: 'Pop colorful bubbles in this classic matching game', badge: 'Singleplayer', color: '#ec4899', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/bubble-pop-legend?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',   image: '/images/apps/bubblepoplegend.png' },
  { id: 'hiddenobjects',      name: 'Hidden Objects Island Secrets', category: 'Games', gameMode: 'Singleplayer', subtitle: 'Find hidden items on mysterious tropical islands', badge: 'Singleplayer', color: '#fbbf24', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/hidden-objects-island-secrets?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025', image: '/images/apps/hiddenobjects.png' },
  { id: 'nutspuzzle',         name: 'Nuts Puzzle',          category: 'Games', gameMode: 'Singleplayer', subtitle: 'Color sort nuts and bolts in this brain puzzle',    badge: 'Singleplayer', color: '#f59e0b', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/nuts-puzzle-sort-by-color?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',    image: '/images/apps/nutspuzzle.png' },
  { id: 'vegamix',            name: 'Vega Mix 2 Adventure', category: 'Games', gameMode: 'Singleplayer', subtitle: 'Charming match-3 garden adventure puzzle game',    badge: 'Singleplayer', color: '#a855f7', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/vega-mix-2-adventure?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',      image: '/images/apps/vegamix.png' },
  { id: 'mrracer',            name: 'Mr Racer',             category: 'Games', gameMode: 'Singleplayer', subtitle: 'High-speed road racing simulation',                  badge: 'Singleplayer', color: '#3b82f6', icon: Gamepad2, type: 'embed', url: 'https://mrracer.online/export?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                              image: '/images/apps/mrracer.png' },
  { id: 'stickmankombat',     name: 'Stickman Kombat 2D',   category: 'Games', gameMode: 'Singleplayer', subtitle: 'Exciting 2D stickman arena combat and fights',       badge: 'Singleplayer', color: '#06b6d4', icon: Gamepad2, type: 'embed', url: 'https://stickmankombat.io/export?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                             image: '/images/apps/stickmankombat.png' },
  { id: 'aod',                name: 'Art of Defense',       category: 'Games', gameMode: 'Singleplayer', subtitle: 'Tactical tower defence and base security game',        badge: 'Singleplayer', color: '#7c3aed', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/aod--art-of-defense?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',         image: '/images/apps/aod.png' },
  { id: 'blockblast',         name: 'Block Blast Master',   category: 'Games', gameMode: 'Singleplayer', subtitle: 'Addictive block grid blast strategy puzzle game',   badge: 'Singleplayer', color: '#10b981', icon: Gamepad2, type: 'embed', url: 'https://blockblastmaster.io/export?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                            image: '/images/apps/blockblast.png' },
  { id: 'ballsort',           name: 'Ball Sort Puzzle',     category: 'Games', gameMode: 'Singleplayer', subtitle: 'Sort colored balls in tubes to solve puzzles',       badge: 'Singleplayer', color: '#fbbf24', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/ball-sort-puzzle?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',          image: '/images/apps/ballsort.png' },
  { id: 'pandogo',            name: 'Panda Go',             category: 'Games', gameMode: 'Singleplayer', subtitle: 'Fun platformer adventure following a cute panda',   badge: 'Singleplayer', color: '#06b6d4', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/panda-go?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                       image: '/images/apps/pandogo.png' },
  { id: 'detective',          name: 'Detective Max Mystery', category: 'Games', gameMode: 'Singleplayer', subtitle: 'Solve the mysterious disappearance of Mr. Winters',  badge: 'Singleplayer', color: '#fbbf24', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/detective-max-mystery-the-disappearance-of-mr-winters?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025', image: '/images/apps/detective.png' },
  { id: 'bowlingstars',       name: 'Bowling Stars',        category: 'Games', gameMode: 'Singleplayer', subtitle: 'Exciting 3D bowling lane sports challenge',        badge: 'Singleplayer', color: '#a855f7', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/bowling-stars?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                  image: '/images/apps/bowlingstars.png' },
  { id: 'snakearena',         name: 'Snake Arena',          category: 'Games', gameMode: 'Singleplayer', subtitle: 'High-stakes slither arena survival battle',         badge: 'Singleplayer', color: '#10b981', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/snake--arena?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                  image: '/images/apps/snakearena.png' },
  { id: 'colorbynumbers',     name: 'Color by Numbers',     category: 'Games', gameMode: 'Singleplayer', subtitle: 'Relaxing antistress drawings coloring simulation',    badge: 'Singleplayer', color: '#a855f7', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/color-by-numbers-antistress-drawings?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025', image: '/images/apps/colorbynumbers.png' },
  { id: 'madtruck',           name: 'Mad Truck Challenge',  category: 'Games', gameMode: 'Singleplayer', subtitle: 'Special action monster truck road combat racer',   badge: 'Singleplayer', color: '#dc2626', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/mad-truck-challenge-special?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',   image: '/images/apps/madtruck.png' },
  { id: 'flyingrobots',       name: 'Flying Robots',        category: 'Games', gameMode: 'Singleplayer', subtitle: 'Action robots transform car combat arena battles',   badge: 'Singleplayer', color: '#06b6d4', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/flying-robot-transform-car-games?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025', image: '/images/apps/flyingrobots.png' },
  { id: 'swimingpool',        name: 'Swimming Pool Romance', category: 'Games', gameMode: 'Singleplayer', subtitle: 'Fun interactive pool romance puzzle simulator',      badge: 'Singleplayer', color: '#ec4899', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/swimming-pool-romance?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',          image: '/images/apps/swimingpool.png' },
  { id: 'tank1944',           name: 'Tank 1944',            category: 'Games', gameMode: 'Singleplayer', subtitle: 'Retro tank battle defense strategy game',            badge: 'Singleplayer', color: '#4b5563', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/tank-1944?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                      image: '/images/apps/tank1944.png' },
  { id: 'football',           name: 'Football Soccer',      category: 'Games', gameMode: 'Singleplayer', subtitle: 'Dynamic football soccer shootout match',            badge: 'Singleplayer', color: '#10b981', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/football--soccer?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                  image: '/images/apps/football.png' },
  { id: 'connectlines',       name: 'Connect Lines',        category: 'Games', gameMode: 'Singleplayer', subtitle: 'Challenging connect line color match puzzle',         badge: 'Singleplayer', color: '#06b6d4', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/connect-line?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                  image: '/images/apps/connectlines.png' },
  { id: 'squidgame',          name: 'Squid Game',           category: 'Games', gameMode: 'Singleplayer', subtitle: 'Intense squid game red light green light survival challenge', badge: 'Singleplayer', color: '#dc2626', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/squid-game?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',              image: '/images/apps/squidgame.png' },
  { id: 'mansion',            name: 'Abandoned Mansion',    category: 'Games', gameMode: 'Singleplayer', subtitle: 'Solve spooky mysteries in a haunted abandoned house', badge: 'Singleplayer', color: '#4b5563', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/abandoned-mansion?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',              image: '/images/apps/mansion.png' },
  { id: 'pixel',              name: 'Pixel Differences',    category: 'Games', gameMode: 'Singleplayer', subtitle: 'Find differences in cute retro pixel art illustrations', badge: 'Singleplayer', color: '#fbbf24', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/pixel-differences?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',          image: '/images/apps/pixel.png' },
  { id: 'sumofury',           name: 'Sumo Fury',            category: 'Games', gameMode: 'Singleplayer', subtitle: 'Action-packed sumo wrestler arena physics battle',    badge: 'Singleplayer', color: '#f59e0b', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/sumo-fury?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                      image: '/images/apps/sumofury.png' },
  { id: 'knockdown',          name: 'Knock Down',           category: 'Games', gameMode: 'Singleplayer', subtitle: 'Slingshot target knockdown physics puzzle game',     badge: 'Singleplayer', color: '#dc2626', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/knock-down?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                      image: '/images/apps/knockdown.png' },
  { id: 'breakthecar',        name: 'Break the Car Completely', category: 'Games', gameMode: 'Singleplayer', subtitle: 'Satisfying car destruction simulator sandbox',    badge: 'Singleplayer', color: '#f59e0b', icon: Gamepad2, type: 'embed', url: 'https://playgama.com/export/game/break-the-car-completely?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',      image: '/images/apps/breakthecar.png' },
  { id: 'rovercraft',         name: 'RoverCraft Race Your Space Car', category: 'Games', gameMode: 'Singleplayer', subtitle: 'Build and race your own rover across space tracks', badge: 'Singleplayer', color: '#0ea5e9', icon: Gamepad2, type: 'embed', url: 'https://www.madkidgames.com/full/rovercraft-race-your-space-car',    image: '/images/apps/rovercraft.png' },
  { id: 'carparkingpro',      name: 'Car Parking Pro: Park & Drive', category: 'Games', gameMode: 'Singleplayer', subtitle: 'Realistic parking and driving simulation challenges', badge: 'Singleplayer', color: '#f97316', icon: Gamepad2, type: 'embed', url: 'https://www.madkidgames.com/full/car-parking-pro-park-and-drive',    image: '/images/apps/parkingpro.png' },
  { id: 'hillclimbracing2',   name: 'Hill Climb Racing 2',   category: 'Games', gameMode: 'Singleplayer', subtitle: 'Uphill driving physics adventure across rugged terrain', badge: 'Singleplayer', color: '#16a34a', icon: Gamepad2, type: 'embed', url: 'https://www.madkidgames.com/full/hill-climb-racing-2-adventure-game', image: '/images/apps/hillclimbracing2.png' },
  { id: 'stackfireball',      name: 'Stack Fire Ball',       category: 'Games', gameMode: 'Singleplayer', subtitle: 'Stack falling blocks to build the tallest fiery tower', badge: 'Singleplayer', color: '#dc2626', icon: Gamepad2, type: 'embed', url: 'https://www.onlinegames.io/games/2021/unity/stack-fire-ball/index.html', image: '/images/apps/Stackfireball.png' },


  // ── Activities — General ──
  { id: 'notes',         name: 'Protected Notes',  category: 'Activities', activityTab: 'General', subtitle: 'Private encrypted notes in your room',      badge: 'Beta',   color: '#06b6d4', icon: FileText,     type: 'embed',           url: 'https://www.protectedtext.com/',                               image: '/images/apps/protectedtext.png' },
  { id: 'timer',         name: 'Timer & Clock',    category: 'Activities', activityTab: 'General', subtitle: 'Setup stopwatch or countdown events',        badge: 'Beta',   color: '#f59e0b', icon: Timer,        type: 'activity',        url: 'activity://timer',                                             image: '/images/apps/timer.png' },
  { id: 'whiteboard',    name: 'Whiteboard',       category: 'Activities', activityTab: 'General', subtitle: 'Collaborative online whiteboard tool',      badge: 'Beta',   color: '#10b981', icon: Palette,      type: 'virtual_browser', skipWarning: true, url: 'https://tldraw.com/',                                             image: '/images/apps/whiteboard.png' },
  { id: 'numicolor',     name: 'Numicolor',        category: 'Activities', activityTab: 'General', subtitle: 'Creative number coloring and drawing simulation',    badge: 'Beta',   color: '#a855f7', icon: Palette,      type: 'virtual_browser', skipWarning: true, url: 'https://numicolor.com/export?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',                            image: '/images/apps/numicolor.png' },
  { id: 'truthordare',   name: 'Truth or Dare',    category: 'Activities', activityTab: 'General', subtitle: 'Spin party game questions prompts',          badge: 'Simple', color: '#ec4899', icon: Sparkles,     type: 'virtual_browser', skipWarning: true, url: 'https://truthordareplay.com/',                                 image: '/images/apps/truthordare.png' },
  { id: 'wouldyourather',name: 'Would You Rather', category: 'Activities', activityTab: 'General', subtitle: 'Fascinating pick scenarios generator',       badge: 'Simple', color: '#8b5cf6', icon: HelpCircle,   type: 'virtual_browser', skipWarning: true, url: 'https://playgama.com/export/game/would-you-rather-game?clid=p_812594fc-a09b-4324-8ddc-06ebc2892025',  image: '/images/apps/wouldurather.png' },
  { id: 'quiz',          name: 'Mini Quiz',        category: 'Activities', activityTab: 'General', subtitle: 'Trivia duel — quick quiz battles',           badge: 'Beta',   color: '#10b981', icon: BookOpen,     type: 'virtual_browser', skipWarning: true, url: 'https://www.triviaduel.com/',                                  image: '/images/apps/miniquiz.png' },
  { id: 'mentimeter',    name: 'Mentimeter',       category: 'Activities', activityTab: 'General', subtitle: 'Interactive live polls and presentations',   badge: 'Beta',   color: '#3b82f6', icon: CheckSquare,  type: 'virtual_browser', skipWarning: true, url: 'https://www.mentimeter.com/',                                  image: '/images/apps/mentimeter.png' },
  { id: 'radiogarden',   name: 'Radio Garden',     category: 'Activities', activityTab: 'General', subtitle: 'Listen to live radio stations from around the world', badge: 'Beta', color: '#22c55e', icon: Radio,        type: 'virtual_browser', skipWarning: true, url: 'https://radio.garden/',                                        image: '/images/apps/radiogarden.png' },
  { id: 'scribble',      name: 'Skribbl.io',       category: 'Activities', activityTab: 'General', subtitle: 'Draw and guess pictures together',           badge: 'Live',   color: '#f97316', icon: Palette,      type: 'embed',           url: 'https://skribbl.io/',                                          image: '/images/apps/skribbl.png' },
  { id: 'hangman',       name: 'Hangman',          category: 'Activities', activityTab: 'General', subtitle: 'Guess the word before time runs out',        badge: 'Simple', color: '#fbbf24', icon: Sparkles,     type: 'virtual_browser', skipWarning: true, url: 'https://www.coolmathgames.com/0-hangman#immersiveModal',                  image: '/images/apps/hangman.png' },

  // ── Activities — Music ──
  { id: 'sharedpiano',   name: 'Shared Piano',     category: 'Activities', activityTab: 'Music',   subtitle: 'Play piano with friends in real-time',      badge: 'Live',   color: '#6366f1', icon: Music,        type: 'embed',           url: 'https://musiclab.chromeexperiments.com/Shared-Piano/#q4fitl6mo', image: '/images/apps/sharedpiano.png' },
  { id: 'songmaker',     name: 'Song Maker',       category: 'Activities', activityTab: 'Music',   subtitle: 'Create and share songs together',            badge: 'Lab',    color: '#ec4899', icon: Music,        type: 'embed',           url: 'https://musiclab.chromeexperiments.com/Song-Maker/',           image: '/images/apps/songmaker.png' },
  { id: 'kandinsky',     name: 'Kandinsky',        category: 'Activities', activityTab: 'Music',   subtitle: 'Draw shapes that turn into music',           badge: 'Lab',    color: '#f59e0b', icon: Music,        type: 'embed',           url: 'https://musiclab.chromeexperiments.com/Kandinsky/',            image: '/images/apps/kandinsky.png' },
  { id: 'voicespinner',  name: 'Voice Spinner',    category: 'Activities', activityTab: 'Music',   subtitle: 'Record and spin your voice into sound',      badge: 'Lab',    color: '#10b981', icon: Music,        type: 'embed',           url: 'https://musiclab.chromeexperiments.com/Voice-Spinner/',        image: '/images/apps/voicespinner.png' },
  { id: 'melodymaker',   name: 'Melody Maker',     category: 'Activities', activityTab: 'Music',   subtitle: 'Build melodies with Chrome Music Lab',       badge: 'Lab',    color: '#a855f7', icon: Music,        type: 'embed',           url: 'https://musiclab.chromeexperiments.com/Melody-Maker/',         image: '/images/apps/melodymaker.png' },

  // ── Web Chat ──
  { id: 'videocall', name: 'Video Call', category: 'Web Chat', subtitle: 'Encrypted real-time video connection', badge: 'Secure', color: '#10b981', icon: Video, type: 'activity', url: 'activity://videocall', image: '/images/apps/videocall.png' },
  { id: 'voicecall', name: 'Voice Call', category: 'Web Chat', subtitle: 'Secure end-to-end voice room', badge: 'Secure', color: '#06b6d4', icon: Mic, type: 'activity', url: 'activity://voicecall', image: '/images/apps/voicecall.png' },
  { id: 'webbrowser', name: 'Virtual Browser', category: 'Web Chat', subtitle: 'Search and browse the web together', badge: 'Multiplayer', color: '#6366f1', icon: Globe, type: 'virtual_browser', skipWarning: true, url: 'https://www.google.com', image: '/images/apps/virtualbrowser.jpg' },

  // ── Social & Music ──
  { id: 'soundcloud', name: 'SoundCloud', category: 'Social & Music', subtitle: 'Search and stream music playlists together', badge: 'Multiplayer', bgColor: '#ff5500', color: '#fff', icon: FaSoundcloud, type: 'direct', isWide: true, image: '/images/apps/soundcloud.jpg' },
  { id: 'spotify', name: 'Spotify', category: 'Social & Music', subtitle: 'Stream Spotify tracks and playlists', badge: 'Multiplayer', bgColor: '#000', color: '#fff', brandColor: '#1DB954', icon: FaSpotify, type: 'placeholder', url: 'https://open.spotify.com', isWide: true, image: '/images/apps/spotify.jpg' },
  { id: 'apple', name: 'Apple Music', category: 'Social & Music', subtitle: 'Watch music videos and stream albums', badge: 'Multiplayer', bgColor: '#fff', color: '#000', icon: FaApple, type: 'placeholder', url: 'https://music.apple.com', isWide: true, image: '/images/apps/apple.jpg' },
  { id: 'tiktok', name: 'TikTok', category: 'Social & Music', subtitle: 'Co-watch trending shorts and videos', badge: 'Multiplayer', bgColor: '#000', color: '#fff', brandColor: '#EE1D52', icon: FaTiktok, type: 'placeholder', url: 'https://tiktok.com', isWide: true, image: '/images/apps/tiktok.jpg' },
  { id: 'instagram', name: 'Instagram', category: 'Social & Music', subtitle: 'Browse Reels and social posts together', badge: 'Multiplayer', bgColor: '#000', color: '#fff', brandColor: '#E1306C', icon: FaInstagram, type: 'placeholder', url: 'https://instagram.com', isWide: true, image: '/images/apps/instagram.jpg' },
  { id: 'facebook', name: 'Facebook', category: 'Social & Music', subtitle: 'Watch shared group videos together', badge: 'Multiplayer', bgColor: '#0A3D91', color: '#fff', brandColor: '#1877F2', icon: FaFacebook, type: 'placeholder', url: 'https://facebook.com', isWide: true, image: '/platforms/facebookplt.jpg' },
  { id: 'xtwitter', name: 'X', category: 'Social & Music', subtitle: 'Read timelines and videos synchronously', badge: 'Multiplayer', bgColor: '#000', color: '#fff', brandColor: '#fff', icon: FaXTwitter, type: 'placeholder', url: 'https://x.com', isWide: true, image: '/platforms/xplt.png' },

  // ── Hero Actions (For Header) ──
  { id: 'screenshare', name: 'Screen Share', category: 'Hero Action', subtitle: 'Share window or tab', color: '#10b981', icon: Monitor, type: 'action', action: 'screenshare' },
  { id: 'custom', name: 'Paste URL', category: 'Hero Action', subtitle: 'Play any video link', color: '#6366f1', icon: LinkIcon, type: 'action', action: 'url' },
  { id: 'upload', name: 'Upload File', category: 'Hero Action', subtitle: 'Stream local files', color: '#fbbf24', icon: Upload, type: 'action', action: 'upload' },
];

function AppCard({ app, onClick, isLight }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const Icon = app.icon;
  const hasImage = app.image && !imgFailed;
  // Only devices with a real hover concept (mouse/trackpad) get the
  // name-on-hover treatment for Web Chat cards — touchscreens never fire a
  // sustained hover, so hiding the name by default there would mean it's
  // simply never seen at all.
  const canHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;
  const nameOnHoverOnly = app.category === 'Web Chat' && canHover;

  const isCleanThumbnailOnly = app.category === 'Streaming' || app.category === 'Social & Music';

  // Layout 1: Clean Brand Image Only (Streaming & Watch Together)
  if (isCleanThumbnailOnly) {
    return (
      <button
        onClick={onClick}
        style={{
          background: hasImage ? '#000' : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.02)'),
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.05)',
          borderRadius: 16,
          height: 120,
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          padding: 0,
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.03)' : '0 8px 16px rgba(0,0,0,0.15)',
          width: '100%'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = isLight ? '0 12px 24px rgba(0,0,0,0.08)' : '0 16px 32px rgba(0,0,0,0.4)';
          e.currentTarget.style.borderColor = isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = isLight ? '0 4px 12px rgba(0,0,0,0.03)' : '0 8px 16px rgba(0,0,0,0.15)';
          e.currentTarget.style.borderColor = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)';
        }}
      >
        {hasImage ? (
          <img
            src={app.image}
            alt={app.name}
            onError={() => setImgFailed(true)}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              position: 'absolute', inset: 0,
              zIndex: 0,
            }}
          />
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, width: '100%', height: '100%', padding: 16
          }}>
            {Icon && <Icon size={32} color={app.brandColor || app.color || '#fff'} />}
            <span style={{ fontSize: 13, fontWeight: 900, color: isLight ? '#1e293b' : '#fff' }}>{app.name}</span>
          </div>
        )}
        
        {/* Screenshare required indicator dot */}
        {app.type === 'placeholder' && (
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} title="Requires Screenshare" />
          </div>
        )}
      </button>
    );
  }

  // Layout 2: Games, Activities, and Whiteboard
  return (
    <button
      onClick={onClick}
      className="media-selector-card"
      style={{
        background: hasImage ? '#000' : (isLight ? '#1e293b' : 'rgba(255,255,255,0.02)'),
        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.05)',
        borderRadius: 16,
        height: 120,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-end',
        padding: 0,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.03)' : '0 8px 16px rgba(0,0,0,0.15)',
        textAlign: 'left',
        width: '100%'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = isLight ? '0 12px 24px rgba(0,0,0,0.08)' : '0 16px 32px rgba(0,0,0,0.4)';
        e.currentTarget.style.borderColor = isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)';
        setIsHovered(true);
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = isLight ? '0 4px 12px rgba(0,0,0,0.03)' : '0 8px 16px rgba(0,0,0,0.15)';
        e.currentTarget.style.borderColor = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)';
        setIsHovered(false);
      }}
    >
      {/* Background Graphic: either a local cover image or abstract glowing gradient with central translucent icon */}
      {hasImage ? (
        <>
          <img
            src={app.image}
            alt={app.name}
            onError={() => setImgFailed(true)}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              position: 'absolute', inset: 0,
              zIndex: 0,
            }}
          />
          {/* Dark gradient overlay + name/badge on top of image — for Web Chat
              cards on a hover-capable device, both the gradient and the name
              stay hidden until hovered so the tile reads as a clean icon at rest. */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)',
            zIndex: 1,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            padding: '10px 12px', boxSizing: 'border-box', gap: 4,
            opacity: nameOnHoverOnly ? (isHovered ? 1 : 0) : 1,
            transition: 'opacity 0.2s ease'
          }}>
            <span className={`stay-white${(app.category === 'Games' || app.category === 'Activities') ? ' game-card-title' : ''}`} style={{
              fontSize: 12, fontWeight: 900, color: '#fff',
              letterSpacing: '-0.2px', textShadow: '0 1px 4px rgba(0,0,0,0.9)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              {app.name}
            </span>
          </div>
        </>
      ) : (
        <>
          {/* Abstract glowing gradient card design */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle at top right, ${app.color || '#6366f1'}33 0%, rgba(9,9,14,0.95) 75%)`,
            zIndex: 0
          }} />
          {Icon && (
            <div style={{
              position: 'absolute', top: '15%', right: '10%',
              color: app.color || '#fff', opacity: 0.08,
              transform: 'rotate(15deg) scale(2.2)',
              pointerEvents: 'none', zIndex: 1
            }}>
              <Icon size={48} />
            </div>
          )}

          {/* Info Label overlay at bottom (ONLY if no thumbnail is available) */}
          <div style={{
            position: 'relative', zIndex: 2,
            padding: '16px 20px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            justifyContent: 'flex-end',
            boxSizing: 'border-box'
          }}>
            {Icon && (
              <div style={{
                color: '#fff',
                marginBottom: 4,
                display: 'flex', alignItems: 'center'
              }}>
                <Icon size={24} />
              </div>
            )}
            <span className={`stay-white${(app.category === 'Games' || app.category === 'Activities') ? ' game-card-title' : ''}`} style={{
              fontSize: 15,
              fontWeight: 850,
              color: '#fff',
              letterSpacing: '-0.3px',
              textShadow: '0 1px 4px rgba(0,0,0,0.6)'
            }}>
              {app.name}
            </span>
          </div>
        </>
      )}

      {app.type === 'placeholder' && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 3 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} title="Requires Screenshare" />
        </div>
      )}
    </button>
  );
}

export default function MediaSelectorModal({ 
  onClose, 
  onSelectPlatform, 
  onSelectUrl, 
  onUpload, 
  onScreenshare, 
  onSelectPlaceholder, 
  isLight,
  initialCategory = 'Streaming',
  initialGameTab = 'Multiplayer',
  initialActivityTab = 'General'
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [gameTab, setGameTab] = useState(initialGameTab);
  const [activityTab, setActivityTab] = useState(initialActivityTab);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [warningApp, setWarningApp] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const categories = ['Streaming', 'Games', 'Activities', 'Web Chat', 'Social & Music'];

  const handleAppClick = (app) => {
    if (app.type === 'coming_soon') {
      alert(`"${app.name}" is coming soon to SahaPlay!`);
      return;
    }

    if (app.type === 'virtual_browser') {
      if (app.skipWarning) {
        onSelectUrl(app.url, 'virtual_browser');
        onClose();
      } else {
        setWarningApp(app);
      }
      return;
    }

    if (app.type === 'action') {
      if (app.action === 'upload') {
        onUpload();
      } else if (app.action === 'url') {
        setShowUrlInput(prev => !prev);
      } else if (app.action === 'screenshare') {
        onScreenshare();
      }
    } else if (app.type === 'browser') {
      onSelectPlatform(app.id);
      onClose();
    } else if (app.type === 'activity' || app.type === 'embed') {
      onSelectUrl(app.url);
      onClose();
    } else if (app.type === 'direct') {
      setShowUrlInput(true);
    } else if (app.type === 'placeholder') {
      if (isMobile) {
        // Mobile: skip the popup-window + screenshare guided flow AND the
        // confirmation dialog — go straight into the in-app Virtual Browser
        // (Hyperbeam) with no modal at all, so login/playback never leaves
        // the app and there's nothing extra to tap through first.
        onSelectUrl(app.url, 'virtual_browser');
        onClose();
      } else if (onSelectPlaceholder) {
        onSelectPlaceholder(app);
      } else {
        window.open(app.url, '_blank');
        onScreenshare();
      }
    }
  };

  const handleUrlSubmit = () => {
    if (customUrl.trim()) {
      onSelectUrl(customUrl.trim());
      onClose();
    }
  };

  const handleWarningProceed = () => {
    if (warningApp) {
      onSelectUrl(warningApp.url, 'virtual_browser');
      setWarningApp(null);
      onClose();
    }
  };

  const HERO_ACTIONS = OPTIONS.filter(o => o.category === 'Hero Action');

  const filteredOptions = OPTIONS.filter(o => {
    if (o.category === 'Hero Action') return false;
    const matchesSearch = !searchQuery.trim() || 
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      o.category.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (o.subtitle && o.subtitle.toLowerCase().includes(searchQuery.toLowerCase()));
    if (searchQuery.trim()) return matchesSearch;
    if (o.category === 'Games' && activeCategory === 'Games') return o.gameMode === gameTab;
    if (o.category === 'Activities' && activeCategory === 'Activities') return o.activityTab === activityTab;
    return matchesSearch && o.category === activeCategory;
  });
  return (
    <>
      <style>{`
        .sp-media-selector-overlay {
          position: fixed !important;
          inset: 0px !important;
          background: rgba(5, 5, 10, 0.75) !important;
          z-index: 100000 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
        }
        .media-selector-card .game-card-title {
          opacity: 0 !important;
        }
        .media-selector-card:hover .game-card-title {
          opacity: 1 !important;
        }
      `}</style>
      <div
        onClick={onClose}
        className="sp-media-selector-overlay"
        style={{
          padding: isMobile ? 0 : '24px'
        }}
      >
      <div
        onClick={e => e.stopPropagation()}
        className="media-selector-modal-inner"
        style={{
          background: isLight ? '#ffffff' : '#0a0a0f',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)', position: 'relative',
          borderRadius: isMobile ? '24px 24px 0 0' : 24, 
          width: '100%', 
          maxWidth: 1020, 
          height: isMobile ? '94vh' : '82vh',
          display: 'flex', 
          flexDirection: 'column',
          boxShadow: isLight ? '0 40px 100px rgba(0,0,0,0.08)' : '0 32px 80px rgba(0,0,0,0.6)',
          fontFamily: "'Outfit',sans-serif",
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          padding: '24px 28px 20px', borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.04)', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: isLight ? '#0f172a' : '#fff', letterSpacing: '-0.5px', flex: 1 }}>
              App Directory
            </h2>
            <button
              onClick={onClose}
              className={isLight ? "media-selector-close-btn" : "stay-white"}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)',
                border: 'none', flexShrink: 0,
                color: isLight ? '#000000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background='#ef4444'; e.currentTarget.style.color='#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background=isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'; e.currentTarget.style.color=isLight ? '#000000' : '#fff'; }}
            >
              <X size={18} className={isLight ? "media-selector-close-btn-svg" : "stay-white"} />
            </button>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: isLight ? '#64748b' : '#94a3b8', fontWeight: 500 }}>
            Launch shared activities, video streams, portals, or local files
          </p>
        </div>

        {/* Custom URL Input Bar */}
        {showUrlInput && (
          <div style={{
            background: 'rgba(var(--brand-1-rgb),0.08)', borderBottom: '1px solid rgba(var(--brand-1-rgb),0.15)',
            padding: '16px 28px', display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0
          }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', background: isLight ? '#fff' : '#07070b',
              border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(var(--brand-1-rgb),0.25)', borderRadius: 12, padding: '8px 16px',
            }}>
              <LinkIcon size={16} color="var(--brand-1)" style={{ marginRight: 12 }} />
              <input 
                autoFocus
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
                placeholder="Paste any YouTube, Twitch, Vimeo, SoundCloud or direct MP4 URL..."
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: isLight ? '#0f172a' : '#fff', fontSize: 14, flex: 1, fontFamily: 'inherit'
                }}
              />
            </div>
            <button
              className="stay-white"
              onClick={handleUrlSubmit}
              disabled={!customUrl.trim()}
              style={{
                background: 'var(--brand-gradient)',
                border: 'none', borderRadius: 12, padding: '10px 20px', color: '#ffffff',
                fontSize: 14, fontWeight: 700, cursor: customUrl.trim() ? 'pointer' : 'not-allowed',
                opacity: customUrl.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 4px 12px rgba(var(--brand-1-rgb),0.3)'
              }}
            >
              <span>Launch</span> <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Main Body Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden' }}>
          
          {/* Sidebar Left (Desktop only) */}
          {!isMobile && (
            <div style={{
              width: 220, borderRight: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.04)',
              background: isLight ? '#f8fafc' : '#07070b', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 8,
              overflowY: 'auto', flexShrink: 0
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: isLight ? '#64748b' : '#64748b', padding: '0 8px 8px' }}>Categories</span>
              {categories.map(cat => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); setSearchQuery(''); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
                      border: 'none', background: isActive ? (isLight ? 'rgba(var(--brand-1-rgb), 0.08)' : 'rgba(var(--brand-1-rgb), 0.1)') : 'transparent',
                      color: isActive ? (isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)') : (isLight ? '#475569' : '#94a3b8'), fontSize: 13, fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
                    }}
                    onMouseEnter={e => { if(!isActive) e.currentTarget.style.color = isLight ? '#0f172a' : '#fff'; }}
                    onMouseLeave={e => { if(!isActive) e.currentTarget.style.color = isLight ? '#475569' : '#94a3b8'; }}
                  >
                    {cat === 'Streaming' && <Tv size={16} />}
                    {cat === 'Games' && <Gamepad2 size={16} />}
                    {cat === 'Activities' && <Activity size={16} />}
                    {cat === 'Music' && <Music size={16} />}
                    {cat === 'Whiteboard' && <Palette size={16} />}
                    {cat === 'Web Chat' && <Video size={16} />}
                    {cat === 'Social & Music' && <Music size={16} />}
                    {cat}
                  </button>
                );
              })}
            </div>
          )}

          {/* Mobile Category Tabs */}
          {isMobile && (
            <div style={{
              display: 'flex', gap: 8, padding: '12px 16px', overflowX: 'auto',
              borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.04)',
              background: isLight ? '#f8fafc' : '#07070b', flexShrink: 0
            }}>
              {categories.map(cat => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); setSearchQuery(''); }}
                    className={isActive ? 'stay-white' : ''}
                    style={{
                      padding: '8px 16px', borderRadius: 20, border: 'none',
                      background: isActive ? (isLight ? 'var(--brand-1-dark)' : 'var(--brand-1)') : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)'),
                      color: isActive ? '#fff' : (isLight ? '#475569' : '#fff'), fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer'
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}

          {/* Right Content Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Dedicated Hero Action Buttons at Top (Above search, responsive layout) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: isMobile ? 8 : 16,
              padding: isMobile ? '12px 16px 4px' : '24px 28px 8px',
              flexShrink: 0
            }}>
              {HERO_ACTIONS.map(app => (
                <button
                  key={app.id}
                  onClick={() => handleAppClick(app)}
                  style={{
                    background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
                    border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 12,
                    padding: isMobile ? '8px 10px' : '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? 8 : 12,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    minWidth: 0
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)';
                  }}
                >
                  <div style={{
                    color: app.color,
                    background: `${app.color}15`,
                    borderRadius: 8,
                    width: isMobile ? 28 : 36,
                    height: isMobile ? 28 : 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <app.icon size={isMobile ? 14 : 18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ 
                      fontSize: isMobile ? 11 : 13, 
                      fontWeight: 800, 
                      color: isLight ? '#0f172a' : '#fff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {app.name}
                    </span>
                    {!isMobile && <span style={{ fontSize: 10, color: '#64748b' }}>{app.subtitle}</span>}
                  </div>
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div style={{ padding: '16px 28px 10px', flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '10px 16px'
              }}>
                <Search size={18} color="#64748b" />
                <input 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search apps, games, activities..."
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: isLight ? '#0f172a' : '#fff', fontSize: 14, flex: 1, fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            {/* Game Mode Tabs — full-width underline style */}
            {(activeCategory === 'Games' || activeCategory === 'Activities') && !searchQuery.trim() && (
              <div style={{ padding: '0 28px', flexShrink: 0 }}>
                <style>{`.gmt-ul{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 0 11px;border:none;background:transparent;font-size:14px;font-weight:800;cursor:pointer;outline:none;font-family:inherit;transition:color .18s;position:relative;}.gmt-ul::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;border-radius:2px;transform:scaleX(0);transition:transform .2s cubic-bezier(0.4,0,0.2,1)}.gmt-ul.active-mp::after{background:#10b981;transform:scaleX(1)}.gmt-ul.active-sp::after{background:#6366f1;transform:scaleX(1)}.gmt-ul.active-gen::after{background:#06b6d4;transform:scaleX(1)}.gmt-ul.active-mus::after{background:#a855f7;transform:scaleX(1)}`}</style>
                <div style={{ display: 'flex', borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.07)', marginBottom: 16 }}>
                  {activeCategory === 'Games' && (<>
                    <button className={`gmt-ul${gameTab === 'Multiplayer' ? ' active-mp' : ''}`}
                      onClick={() => setGameTab('Multiplayer')}
                      style={{ color: gameTab === 'Multiplayer' ? '#10b981' : (isLight ? '#94a3b8' : '#4b5563') }}>
                      <Users2 size={15} /> Multiplayer
                    </button>
                    <button className={`gmt-ul${gameTab === 'Singleplayer' ? ' active-sp' : ''}`}
                      onClick={() => setGameTab('Singleplayer')}
                      style={{ color: gameTab === 'Singleplayer' ? '#6366f1' : (isLight ? '#94a3b8' : '#4b5563') }}>
                      <User size={15} /> Singleplayer
                    </button>
                  </>)}
                  {activeCategory === 'Activities' && (<>
                    <button className={`gmt-ul${activityTab === 'General' ? ' active-gen' : ''}`}
                      onClick={() => setActivityTab('General')}
                      style={{ color: activityTab === 'General' ? '#06b6d4' : (isLight ? '#94a3b8' : '#4b5563') }}>
                      <Activity size={15} /> General
                    </button>
                    <button className={`gmt-ul${activityTab === 'Music' ? ' active-mus' : ''}`}
                      onClick={() => setActivityTab('Music')}
                      style={{ color: activityTab === 'Music' ? '#a855f7' : (isLight ? '#94a3b8' : '#4b5563') }}>
                      <Music size={15} /> Music
                    </button>
                  </>)}
                </div>
              </div>
            )}

            {/* Grid Scroll container */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 28px 32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: (activeCategory === 'Games' || activeCategory === 'Activities') ? (isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)') : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                {filteredOptions.map(app => (
                  <AppCard key={app.id} app={app} onClick={() => handleAppClick(app)} isLight={isLight} />
                ))}
              </div>

              {filteredOptions.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b', fontSize: 14 }}>
                  No apps found matching your search.
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Web Game Portal Redirection Warning Dialog */}
      {warningApp && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110000, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          backdropFilter: 'blur(10px)'
        }} onClick={e => e.stopPropagation()}>
          <div style={{
            background: '#11111a', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 20,
            maxWidth: 420, width: '100%', padding: '24px 28px', textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
          }}>
            <div style={{
              width: 54, height: 54, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              color: '#f59e0b'
            }}>
              <AlertTriangle size={28} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#fff' }}>Launch {warningApp.name}?</h3>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
              This opens in the virtual browser because this site blocks normal iframe embedding.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setWarningApp(null)}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none',
                  borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleWarningProceed}
                style={{
                  flex: 1, background: '#f59e0b', color: '#000', border: 'none',
                  borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer'
                }}
              >
                Launch Anyway
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
