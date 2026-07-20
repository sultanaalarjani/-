const puppeteer=require('puppeteer'); const fs=require('fs');
const OUT='/tmp/shotsW'; fs.mkdirSync(OUT,{recursive:true});
const ck=fs.readFileSync('/tmp/w.ck','utf8').split('\n').filter(l=>l&&!l.startsWith('#'));
const cookies=ck.map(l=>{const p=l.split('\t');return{name:p[5],value:p[6],domain:'localhost',path:'/'}}).filter(c=>c.name);
(async()=>{
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--lang=ar']});
  const page=await b.newPage(); await page.setViewport({width:1280,height:1000,deviceScaleFactor:1.4});
  await page.setCookie(...cookies);
  await page.goto('http://localhost:3030/dashboard',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,600));
  // click Weekly tab
  const btns=await page.$$('.tab');
  for(const btn of btns){const t=await page.evaluate(e=>e.textContent,btn); if(t&&t.includes('التحديث الأسبوعي')){await btn.click();break;}}
  await new Promise(r=>setTimeout(r,1200));
  await page.screenshot({path:`${OUT}/weekly.png`,fullPage:true});
  await b.close(); console.log('ok');
})().catch(e=>{console.error(e.message);process.exit(1);});
