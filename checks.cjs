const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./assets/movies.js');
const E = require('./assets/engine.js');
const movies = globalThis.MOVIES;
assert.equal(new Set(movies.map(m=>m.id)).size,movies.length);
for (const m of movies) {
  assert.ok(m.minutes>0 && m.title && m.moods.length && m.genres.length);
  assert.ok(fs.existsSync(path.join(__dirname,m.poster)),m.poster);
}
const profiles=[];
for(const mood of ['light','wonder','tense','warm'])
for(const genre of ['comedy','scifi','thriller','animation','romance','any'])
for(const duration of ['100','125','any'])
for(const intensity of ['1','2','any']) profiles.push({mood,genre,duration,intensity});
const within=(m,p)=>(p.duration==='any'||m.minutes<=Number(p.duration))&&(p.intensity==='any'||m.intensity<=Number(p.intensity));
for (const p of profiles) {
  const r=E.recommend(movies,p);
  assert.ok(r.items.length>0 && r.items.length<=3,'Each supported profile has useful results');
  for (const m of r.items) assert.ok(within(m,p),'Quiz preserves hard limits');
}
for(const a of profiles) for(const b of profiles) {
  const forward=E.together(movies,a,b), reverse=E.together(movies,b,a);
  assert.deepEqual(forward.items.map(x=>x.movie.id),reverse.items.map(x=>x.movie.id),'Neither participant gets priority');
  for (const {movie} of forward.items) assert.ok(within(movie,a)&&within(movie,b),'Duo preserves both time/comfort limits');
}
assert.equal(E.clock('23:50',30),'00:20 (+1 день)');
assert.equal(E.clock('20:00',115),'21:55');
for(const filename of ['index.html','quiz.html','together.html','evening.html','my-list.html']) {
  const html=fs.readFileSync(path.join(__dirname,filename),'utf8');
  for(const [,asset] of html.matchAll(/(?:src|href)="(assets\/[^"#]+)"/g))assert.ok(fs.existsSync(path.join(__dirname,asset)),asset);
}
console.log(`PASS: ${profiles.length} quiz profiles; ${profiles.length**2} participant pairs; clock rollover; five pages and all asset paths.`);
