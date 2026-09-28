import fs from 'node:fs/promises';
await fs.mkdir(new URL('./src/components/ui/',import.meta.url),{recursive:true});
for(const name of ['slider','button']){
 const response=await fetch(`https://ui.shadcn.com/r/styles/new-york/${name}.json`);
 if(!response.ok)throw Error(`${name}: ${response.status}`);
 const item=await response.json();
 const file=item.files.find(f=>f.path.endsWith(`${name}.tsx`));
 if(!file)throw Error(`Missing ${name} source`);
 await fs.writeFile(new URL(`./src/components/ui/${name}.tsx`,import.meta.url),file.content);
 console.log(`Downloaded official shadcn/ui ${name} source`);
}
