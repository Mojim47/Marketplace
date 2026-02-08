import { promises as fs } from 'fs'
import path from 'path'

async function findFiles(dir, name){
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const out = []
  for(const e of entries){
    const p = path.join(dir, e.name)
    if(e.isDirectory()) out.push(...await findFiles(p, name))
    else if(e.name === name) out.push(p)
  }
  return out
}

function mergeSummaries(files){
  const agg = {}
  for(const f of files){
    try { const json = JSON.parse(fs.readFileSync(f,'utf8'))
      for(const [file,data] of Object.entries(json)){
        if(!agg[file]) agg[file] = { ...data }
        else {
          ;['lines','statements','functions','branches'].forEach(k => {
            agg[file][k].covered += data[k].covered
            agg[file][k].total += data[k].total
            agg[file][k].pct = +(agg[file][k].covered / agg[file][k].total * 100).toFixed(2)
          })
        }
      }
    } catch {}
  }
  return agg
}

async function run(){
  const files = await findFiles(process.cwd(), 'coverage-summary.json')
  const merged = mergeSummaries(files)
  await fs.writeFile('coverage/merged-summary.json', JSON.stringify(merged,null,2))
  console.log('Merged', files.length, 'summaries into coverage/merged-summary.json')
}
run().catch(e=>{ console.error(e); process.exit(1) })
