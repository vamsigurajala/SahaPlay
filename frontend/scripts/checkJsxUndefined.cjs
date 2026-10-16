const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
let bad = 0;
for (const f of process.argv.slice(2)) {
  let ast;
  try { ast = parser.parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx'] }); } catch (e) { console.log(f + ': parse error ' + e.message); bad++; continue; }
  traverse(ast, {
    JSXOpeningElement(p) {
      let n = p.node.name;
      while (n.type === 'JSXMemberExpression') n = n.object;
      if (n.type !== 'JSXIdentifier' || !/^[A-Z]/.test(n.name)) return;
      if (!p.scope.hasBinding(n.name)) { console.log(f + ': <' + n.name + '> is not defined'); bad++; }
    },
    ReferencedIdentifier(p) {
      if (p.node.type !== 'Identifier') return;
      const name = p.node.name;
      if (!p.scope.hasBinding(name) && !p.scope.hasGlobal(name) && !(name in globalThis) && !['window','document','navigator','localStorage','sessionStorage','requestAnimationFrame','cancelAnimationFrame','performance','fetch','AbortSignal','URL','Image','Audio','AudioContext','webkitAudioContext','Blob','FileReader','ResizeObserver','IntersectionObserver','MutationObserver','getComputedStorage','CSS','alert','confirm','Event','HTMLElement','SpeechSynthesisUtterance','speechSynthesis','Notification','MediaRecorder','WebSocket','XMLHttpRequest','FormData','File','DOMParser','screen','location','history','crypto','atob','btoa','setTimeout','clearTimeout','setInterval','clearInterval','console','Math','JSON','Date'].includes(name)) { console.log(f + ': ' + name + ' is not defined'); bad++; }
    },
  });
}
console.log('checked', process.argv.length - 2, 'files,', bad, 'problems');
