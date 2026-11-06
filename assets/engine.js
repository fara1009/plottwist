/* Pure recommendation rules shared by the quiz and the two-person mode. */
(function(root){
  'use strict';
  const genres={comedy:'комедия',drama:'драма',scifi:'фантастика',thriller:'триллер',animation:'анимация',romance:'романтика',adventure:'приключения'};
  const moods={light:'лёгкий вечер',wonder:'чувство открытия',tense:'интрига',warm:'тёплая история'};
  function fitsDuration(movie,value){return value==='any'||movie.minutes<=Number(value)}
  function score(movie,p){let s=0;if(movie.moods.includes(p.mood))s+=5;if(p.genre==='any'||movie.genres.includes(p.genre))s+=4;if(fitsDuration(movie,p.duration))s+=3;else s-=8;if(p.intensity==='any'||movie.intensity<=Number(p.intensity))s+=2;else s-=4;return s}
  function reasons(movie,p){const r=[];if(movie.moods.includes(p.mood))r.push('настроение: '+moods[p.mood]);if(p.genre!=='any'&&movie.genres.includes(p.genre))r.push('любимый жанр: '+genres[p.genre]);if(p.duration!=='any'&&fitsDuration(movie,p.duration))r.push('укладывается в '+p.duration+' минут');if(p.intensity!=='any'&&movie.intensity<=Number(p.intensity))r.push('комфортная эмоциональная нагрузка');return r.length?r:['возможность попробовать что-то новое']}
  function strict(movie,p){return fitsDuration(movie,p.duration)&&(p.intensity==='any'||movie.intensity<=Number(p.intensity))&&(p.genre==='any'||movie.genres.includes(p.genre))&&movie.moods.includes(p.mood)}
  function recommend(movies,p){let pool=movies.filter(m=>fitsDuration(m,p.duration)&&(p.intensity==='any'||m.intensity<=Number(p.intensity)));if(!pool.length)return{items:[],exact:false};pool=pool.slice().sort((a,b)=>score(b,p)-score(a,p)||a.title.localeCompare(b.title,'ru'));return{items:pool.slice(0,3),exact:pool.slice(0,3).every(m=>strict(m,p))}}
  function together(movies,a,b){const pool=movies.filter(m=>fitsDuration(m,a.duration)&&fitsDuration(m,b.duration)&&(a.intensity==='any'||m.intensity<=Number(a.intensity))&&(b.intensity==='any'||m.intensity<=Number(b.intensity)));const ranked=pool.map(m=>({movie:m,a:score(m,a),b:score(m,b),exact:strict(m,a)&&strict(m,b)}));ranked.sort((x,y)=>Number(y.exact)-Number(x.exact)||(Math.min(y.a,y.b)-Math.min(x.a,x.b))||(y.a+y.b-x.a-x.b)||x.movie.title.localeCompare(y.movie.title,'ru'));return{items:ranked.slice(0,3),exact:ranked.length>0&&ranked[0].exact}}
  function clock(start,offset){const [h,m]=start.split(':').map(Number);const total=h*60+m+offset;return String(Math.floor(total/60)%24).padStart(2,'0')+':'+String(total%60).padStart(2,'0')+(total>=1440?' (+1 день)':'')}
  const api={genres,moods,score,reasons,recommend,together,clock};root.PlotEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
