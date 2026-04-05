import fs from "fs";
const p = "d:/GolfClubAdvisor/bookmarklets/_raw.txt";
let s = fs.readFileSync(p, "utf8");

// 1) Wider lookback in O()
s = s.split("t-(r||55)").join("t-(r||92)");

// 2) Wider forward window in inner e()
s = s.split("t+(r||12)").join("t+(r||24)");
s = s.split("n||12").join("n||24");

// 3) Wider e() calls at price anchors
s = s.split("e(r,s,45,14)").join("e(r,s,82,22)");
s = s.split("e(r,x,60,16)").join("e(r,x,92,24)");

// 4) Fix U(): inner `var m=/regex/` hoisting shadows global m(); rename regex to mRx
s = s.replace(
  /for\(var h=\[\],m=\/"\(\?:price\|unitPrice/g,
  'for(var h=[],mRx=/(?:"price|unitPrice'
);
// The replacement might have broken - let me check original: for(var h=[],m=/"(?:price|
// I need replace m.exec with mRx.exec in U only - use global replace for m.exec in that loop - careful

// Undo if wrong - read original substring
const origM = 'for(var h=[],m=/(?:"price|unitPrice|salePrice|retailPrice|finalPrice|itemPrice)"\\s*:\\s*"?(\d+\\.?\\d*)"?/g;null!==(r=m.exec(n));)';
// Actually simpler: replace exact string from file
s = s.replace(
  'for(var h=[],m=/(?:"price|unitPrice|salePrice|retailPrice|finalPrice|itemPrice)"\\s*:\\s*"?(\d+\\.?\\d*)"?/g;null!==(r=m.exec(n));)',
  'for(var h=[],mRx=/(?:"price|unitPrice|salePrice|retailPrice|finalPrice|itemPrice)"\\s*:\\s*"?(\d+\\.?\\d*)"?/g;null!==(r=mRx.exec(n));)'
);

// 5) Insert J() after function a(e){...} inside U — match the closing brace of a and "for(var i="
const insertJ = `function J(e,t){if(!e)return"";t=String(t||"").replace(/\\s+/g," ").trim();for(var r="skuName specName specAttrs cargoNumber cargoModel propValue saleProp skuSpecName specInfo offerSkuName cargoSpec itemSpec skuSpecs propValues".split(" "),n="",a=0,i=0;i<r.length;i++)for(var s=new RegExp('"'+r[i]+'"\\\\s*:\\\\s*"((?:[^"\\\\\\\\]|\\\\\\\\.)*)"',"gi"),c;c=s.exec(e);){var o=c[1];if(o=a(o),!o||m(o)||g(o))continue;if((o=o.replace(/\\s+/g," ").trim())&&o!==t&&2<o.length&&o.length<160&&o.length>a)n=o,a=o.length}return n}`;

// Find: function a(e){return(e=String(e||"")...?"":e}for(var i=/
const aEnd = '.test(e)?"":e}for(var i=/"(?:subject|title|skuName';
if (!s.includes(aEnd)) {
  console.error("anchor aEnd not found");
  process.exit(1);
}
s = s.replace(aEnd, '.test(e)?"":e}' + insertJ + 'for(var i=/"(?:subject|title|skuName');

// 6) Larger JSON window + spec from J
s = s.replace(
  /var s,c=a\(r\[1\]\),o=L\(r\[2\]\);!c\|\|!o\|\|999999<o\|\|\(\(\(x=\(s=n\.slice\(r\.index,Math\.min\(n\.length,r\.index\+2200\)\)\.match/,
  "var chunk=n.slice(r.index,Math.min(n.length,r.index+3800)),s,c=a(r[1]),o=L(r[2]);!c||!o||999999<o||(((x=(s=chunk.match"
);
s = s.replace(
  /t\.push\(\{name:c,spec:"",price:o,qty:x\}\)\}/,
  "t.push({name:c,spec:J(chunk,c)||\"\",price:o,qty:x})}"
);

// 7) fillSpecsFromAnchors + k init — insert function before U (after g closes)
const fillFn =
  'function fillSpecsFromAnchors(e,t){if(!e||!t||!t.length)return;for(var r=0;r<e.length;r++){var n=e[r];if(String(n.spec||"").replace(/\\s+/g," ").trim())continue;var a=n._anchorLine;if(null==a||a<0)continue;for(var i="",s=Math.max(0,a-96),c=Math.min(t.length-1,a+32),o=s;o<=c;o++){var l=t[o],u=l.match(/^(规格型号|颜色分类|颜色|型号|规格|款式|尺码)\\s*[：:]\\s*(.+)$/);if(u&&(u=u[2].trim())&&!m(u)&&!g(u)){i=u;break}}if(!i)for(o=Math.max(0,a-14),c=Math.min(t.length-1,a+14);o<=c;o++)if((l=String(t[o]||"").trim())&&8<=l.length&&l.length<=64&&!m(l)&&!g(l)&&!/^[¥￥\\d.\\s\\/元,，]+$/.test(l)&&/[A-Za-z0-9]/.test(l)&&/\\d/.test(l)&&!/^https?:/.test(l))if(/[A-Za-z]\\d[-–.]\\d/.test(l.replace(/\\s/g,""))||/^[^：:]+[：:]/.test(l)===!1&&l.split(/\\s+/).length<=6){i=l;break}i&&(n.spec=i)}}';

const gEnd = '&&t.length<=18)}}}function O(e,t,r){';
if (!s.includes(gEnd)) {
  console.error("anchor gEnd not found");
  process.exit(1);
}
s = s.replace(gEnd, "&&t.length<=18)}}}" + fillFn + "function O(e,t,r){");

// 8) k array init + fillSpecs after dedupe forEach
const oldK =
  'k=[],ce=(a.forEach(function(e,t){var r=String(e.spec||"").replace(/\\s+/g," ").trim(),n=(e.name||"").slice(0,15)+"_"+e.price+"_"+(e.qty||1)+"_"+r;r||(n+="__r"+t),se[n]||(se[n]=1,k.push(e))}),/^(规格|';
const newK =
  'k=[];(function(){a.forEach(function(e,t){var r=String(e.spec||"").replace(/\\s+/g," ").trim(),n=(e.name||"").slice(0,15)+"_"+e.price+"_"+(e.qty||1)+"_"+r;r||(n+="__r"+t),se[n]||(se[n]=1,k.push(e))});fillSpecsFromAnchors(k,r)})();var ce=/^(规格|';
if (!s.includes(oldK)) {
  console.error("anchor oldK not found");
  process.exit(1);
}
s = s.replace(oldK, newK);

// 9) Merge title/spec fix
const oldMerge =
  'C&&k.forEach(function(e){var t=(e.name||"").trim(),r=(e.spec||"").trim();/[\\u4e00-\\u9fff]{5,}/.test(t)&&14<=t.length||(!r&&t&&t.length<=16&&!m(t)&&!g(t)&&(e.spec=t),e.name=C,e.productName=C)});';
const newMerge =
  'C&&function(Cc){k.forEach(function(e){var t=(e.name||"").trim(),r=(e.spec||"").trim();if(!r&&t&&!m(t)&&!g(t))if(t!==Cc)e.spec=200<t.length?t.slice(0,200):t;else if(t.length<=28)e.spec=t;!e.spec&&Cc&&t&&t!==Cc&&!m(t)&&!g(t)&&(e.spec=200<t.length?t.slice(0,200):t);e.name=Cc;e.productName=Cc})}((C||"").trim());fillSpecsFromAnchors(k,r);';
if (!s.includes(oldMerge)) {
  console.error("anchor oldMerge not found");
  process.exit(1);
}
s = s.replace(oldMerge, newMerge);

fs.writeFileSync("d:/GolfClubAdvisor/bookmarklets/1688-tartgo-import.bookmarklet.js", s);
console.log("out len", s.length);
console.log("mRx ok", s.includes("mRx="), "m.exec in U?", /for\(var h=\[\],m=/.test(s));
