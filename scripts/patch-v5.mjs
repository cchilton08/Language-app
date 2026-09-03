import fs from "node:fs";

const path = "app/DutchTutorV5.tsx";
let source = fs.readFileSync(path, "utf8");

const oldNormalize = `const normalize = (s: string) => s.trim().toLocaleLowerCase("nl-NL").replace(/[.!?,:'’\\"“”]/g, "").replace(/\\s+/g, " ");`;
const newNormalize = `const normalize = (s: string) => s.trim().toLocaleLowerCase("nl-NL").replace(/[.!?,;:()'’\\"“”…]/g, "").replace(/\\s+/g, " ");`;
source = source.replace(oldNormalize, newNormalize);

const uidMarker = `const uid = () => Math.random().toString(36).slice(2, 10);`;
const helper = `// Recall matching is forgiving about mechanics, but strict about meaning and missing words.\nfunction editDistance(a:string,b:string){\n  const prev=Array.from({length:b.length+1},(_,i)=>i);\n  for(let i=1;i<=a.length;i++){\n    let left=i,diag=i-1;\n    for(let j=1;j<=b.length;j++){\n      const up=prev[j];\n      const cur=a[i-1]===b[j-1]?diag:1+Math.min(diag,up,left);\n      prev[j]=cur;diag=up;left=cur;\n    }\n  }\n  return prev[b.length];\n}\nfunction answerMatches(input:string,target:string){\n  const a=normalize(input).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');\n  const b=normalize(target).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');\n  if(!a||!b)return false;\n  if(a===b)return true;\n  if(a.replace(/\\s/g,'')===b.replace(/\\s/g,''))return true;\n  const aWords=a.split(' '), bWords=b.split(' ');\n  if(aWords.length!==bWords.length)return false;\n  const maxEdits=b.length>=18?2:b.length>=7?1:0;\n  if(Math.abs(a.length-b.length)>maxEdits)return false;\n  return editDistance(a,b)<=maxEdits;\n}\nfunction completeLearningChunk(value:string){\n  const text=String(value||'').trim();\n  return Boolean(text) && !text.includes('…') && !text.includes('...');\n}\n`;
if (!source.includes("function answerMatches(")) {
  source = source.replace(uidMarker, `${helper}${uidMarker}`);
}

source = source
  .replaceAll("normalize(reviewInput)===normalize(currentReview.dutch)", "answerMatches(reviewInput,currentReview.dutch)")
  .replaceAll("normalize(teachInput)===normalize(currentTeach.dutch)", "answerMatches(teachInput,currentTeach.dutch)")
  .replaceAll("normalize(quizRepairInput)===normalize(currentQuizMiss.correction)", "answerMatches(quizRepairInput,currentQuizMiss.correction)");

source = source.replace(
  `for(const x of items)if(x?.dutch&&!out.some(y=>normalize(y.dutch)===normalize(x.dutch)))out.push(x);`,
  `for(const x of items)if(x?.dutch&&completeLearningChunk(x.dutch)&&!out.some(y=>normalize(y.dutch)===normalize(x.dutch)))out.push(x);`
);
source = source.replace(
  `if(!x?.dutch||v.some(w=>normalize(w.dutch)===normalize(x.dutch)))continue;`,
  `if(!x?.dutch||!completeLearningChunk(x.dutch)||v.some(w=>normalize(w.dutch)===normalize(x.dutch)))continue;`
);

fs.writeFileSync(path, source);
