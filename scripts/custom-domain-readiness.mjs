import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const target=(process.env.CRYPTO_TARGET_DOMAIN||'').trim().toLowerCase();
const legacy='1specnazov1.github.io';
const allowedExt=new Set(['.html','.js','.mjs','.ts','.json','.webmanifest','.md','.yml','.yaml','.sql']);
const ignore=new Set(['.git','node_modules','playwright-report','test-results']);
const hits=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(ignore.has(entry.name))continue;const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(allowedExt.has(path.extname(entry.name))){const text=fs.readFileSync(full,'utf8');text.split(/\r?\n/).forEach((line,index)=>{if(line.includes(legacy)||line.includes('localhost:3000'))hits.push({file:path.relative(root,full).replaceAll('\\','/'),line:index+1,text:line.trim().slice(0,220)});});}}}
walk(root);
console.log(`CRYPTO LAB custom-domain inventory: ${hits.length} legacy/localhost references`);
for(const h of hits)console.log(`${h.file}:${h.line} ${h.text}`);
if(!target){console.log('No CRYPTO_TARGET_DOMAIN supplied: inventory-only mode.');process.exit(0);}
if(!/^[a-z0-9.-]+$/.test(target)||!target.includes('.'))throw new Error('CRYPTO_TARGET_DOMAIN is invalid');
const cname=fs.existsSync('CNAME')?fs.readFileSync('CNAME','utf8').trim().toLowerCase():'';
if(cname!==target)throw new Error(`CNAME mismatch: expected ${target}, got ${cname||'<missing>'}`);
const runtime=hits.filter(h=>h.file.startsWith('v79/')||h.file.startsWith('supabase/functions/')||h.file.startsWith('supabase/migrations/'));
if(runtime.length)throw new Error(`Custom-domain cutover blocked: ${runtime.length} legacy runtime references remain`);
console.log(`Custom-domain runtime audit passed for ${target}`);
