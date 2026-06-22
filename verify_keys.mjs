import { readFileSync } from 'fs';
const c = readFileSync('./frontend/src/i18n.js', 'utf8');
const keys = ['app_screenshare','app_custom','app_upload','catMoviesVideo','catMusicPodcasts','catQuickActions','catSocialMedia','catWebGames','castScreen','castToTv','appDirectory','launchBtn'];
let allGood = true;
keys.forEach(k => {
  const n = (c.match(new RegExp('"' + k + '"', 'g')) || []).length;
  const status = n === 20 ? '✅' : '❌';
  if (n !== 20) allGood = false;
  console.log(`  ${status} (${n}/20) ${k}`);
});
console.log(allGood ? '\n✅ All keys translated in all 20 languages!' : '\n❌ Some keys are missing translations');
