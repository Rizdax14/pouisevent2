// VERSION: 2.0
import { useState, useEffect } from "react";
// ─── SUPABASE ────────────────────────────────────────
const SUPABASE_URL = "https://daerxouhvmvqhirgyrjr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhZXJ4b3Vodm12cWhpcmd5cmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzM1NTMsImV4cCI6MjA5MDA0OTU1M30.CHaqQj8dd-C6NmA6JUkjzL5xtY8drzHqlYZAtJwCzGA";

async function sbFetch(table, params="") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbInsert(table, data) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbUpdate(table, match, data) {
  const params = Object.entries(match).map(([k,v])=>`${k}=eq.${v}`).join("&");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: "PATCH",
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}



const FONT_URL = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&display=swap";

function useIsMobile(){
  const [m,setM]=useState(window.innerWidth<700);
  useEffect(()=>{const h=()=>setM(window.innerWidth<700);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  return m;
}

const css=`
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#080810;color:#eeeef5;}
  .fade{animation:fadeIn .25s ease;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:#0d0d1c;}
  ::-webkit-scrollbar-thumb{background:#1e1e30;border-radius:2px;}
  button:focus{outline:none;}
`;

const TEAMS = [
  {id:1,name:"Abdosminables",color:"#A8E6CF",color2:"#FFFFFF",active:true,logoUrl:null},
  {id:2,name:"BLACKOUT",color:"#1A1A1A",color2:"#FFFFFF",active:false,logoUrl:null,oldName:"G.P.M.E"},
  {id:3,name:"Bobslayeurs",color:"#2DBD6E",color2:"#FFFFFF",active:false,logoUrl:null},
  {id:4,name:"CAO",color:"#5B8DD9",color2:"#1A2E5A",active:true,logoUrl:null},
  {id:5,name:"Crouton",color:"#9B9B9B",color2:"#FFFFFF",active:true,logoUrl:null},
  {id:6,name:"DRAGIBUS",color:"#E84D9B",color2:"#FFFFFF",active:true,logoUrl:null},
  {id:7,name:"Expatrié",color:"#E8000E",color2:"#FFFFFF",active:false,logoUrl:null,dissolvedName:"Expatrié"},
  {id:8,name:"Fumistes",color:"#FF6B00",color2:"#FFFFFF",active:false,logoUrl:null},
  {id:9,name:"G.P.M.E",color:"#3CB54A",color2:"#FFFFFF",active:false,logoUrl:null,dissolvedName:"G.P.M.E"},
  {id:10,name:"GIRLZ GIRLZ",color:"#1A1A1A",color2:"#FFFFFF",active:true,logoUrl:null},
  {id:11,name:"JPEGCORP",color:"#D4C1A7",color2:"#113D15",active:true,logoUrl:null},
  {id:12,name:"L'EHPAD",color:"#8B1A2A",color2:"#FFFFFF",active:true,logoUrl:null},
  {id:13,name:"La Déchetterie",color:"#87CEEB",color2:"#FFFFFF",active:false,logoUrl:null,dissolvedName:"La Déchetterie"},
  {id:14,name:"Les Qui",color:"#FFFFFF",color2:"#F4B8C8",active:true,logoUrl:null,oldName:"La Déchetterie"},
  {id:15,name:"Les Vedettes",color:"#5900B8",color2:"#D6AC49",active:true,logoUrl:null},
  {id:22,name:"Ricard",color:"#F5FC00",color2:"#132FA8",active:false,logoUrl:null,dissolvedName:"Ricard"},
  {id:16,name:"New Ricard",color:"#132FA8",color2:"#F5FC00",active:true,logoUrl:null,oldName:"Ricard"},
  {id:17,name:"UNITED",color:"#E8000E",color2:"#FFFFFF",active:true,logoUrl:null,oldName:"Expatrié"},
  {id:19,name:"ILIAN",color:"#2DBD6E",color2:"#FFFFFF",active:true,logoUrl:null},
  {id:21,name:"RICARD OG",color:"#F5FC00",color2:"#132FA8",active:true,logoUrl:null},
];

const PLAYERS = [
  {id:1,uid:"quentin-lp",name:"Quentin LP",teamId:null,t24:3,t25:1,photoUrl:null},
  {id:2,uid:"ferdi",name:"Ferdi",teamId:null,t24:3,t25:1,t24cap:true,photoUrl:null},
  {id:3,uid:"yael",name:"Yael",teamId:null,t24:6,t25:1,photoUrl:null},
  {id:4,uid:"emma-s",name:"Emma S",teamId:10,t25:1,t26:10,photoUrl:null},
  {id:5,uid:"lise-r",name:"Lise R",teamId:1,t25:1,t26:1,t26cap:true,photoUrl:null},
  {id:6,uid:"florent",name:"Florent",teamId:null,t25:1,photoUrl:null},
  {id:7,uid:"eline",name:"Eline",teamId:null,t24:9,t25:2,t25cap:true,photoUrl:null},
  {id:8,uid:"flavio",name:"Flavio",teamId:null,t24:9,t25:2,photoUrl:null},
  {id:9,uid:"yoni",name:"Yoni",teamId:null,t24:9,t25:2,photoUrl:null},
  {id:10,uid:"nejma",name:"Nejma",teamId:null,t24:9,t25:2,photoUrl:null},
  {id:11,uid:"johan-n",name:"Johan N",teamId:null,t25:2,photoUrl:null},
  {id:12,uid:"julia",name:"Julia",teamId:null,t25:2,photoUrl:null},
  {id:13,uid:"axel",name:"Axel",teamId:null,t25:2,photoUrl:null},
  {id:14,uid:"simon",name:"Simon",teamId:14,t24:3,t25:3,teo:14,t26:14,photoUrl:null},
  {id:15,uid:"tristan",name:"Tristan",teamId:null,t24:3,t25:3,photoUrl:null},
  {id:16,uid:"alvyn",name:"Alvyn",teamId:null,t24:13,t25:3,photoUrl:null},
  {id:17,uid:"este",name:"Esté",teamId:null,t25:3,teo:14,t25cap:true,photoUrl:null},
  {id:18,uid:"gabrielle",name:"Gabrielle",teamId:null,t25:3,teo:14,photoUrl:null},
  {id:19,uid:"clea",name:"Cléa",teamId:null,t25:3,photoUrl:null},
  {id:20,uid:"gaelle",name:"Gaelle",teamId:null,t25:3,photoUrl:null},
  {id:21,uid:"juju",name:"Juju",teamId:4,t24:8,t25:4,teo:4,t26:4,photoUrl:null},
  {id:22,uid:"maxime-m",name:"Maxime M",teamId:4,t24:9,t25:4,teo:4,t26:4,t24cap:true,t25cap:true,teocap:true,t26cap:true,photoUrl:null},
  {id:23,uid:"joel",name:"Joel",teamId:null,t25:4,photoUrl:null},
  {id:24,uid:"emma-f",name:"Emma F",teamId:null,t25:4,photoUrl:null},
  {id:25,uid:"mathilde",name:"Mathilde",teamId:5,t25:4,t26:5,photoUrl:null},
  {id:26,uid:"pauline-f",name:"Pauline F",teamId:null,t25:4,photoUrl:null},
  {id:27,uid:"rico",name:"Rico",teamId:4,t25:4,t26:4,photoUrl:null},
  {id:28,uid:"sasha",name:"Sasha",teamId:4,t25:4,t26:4,photoUrl:null},
  {id:29,uid:"leandre",name:"Léandre",teamId:5,t24:5,t25:5,teo:5,t26:5,photoUrl:null},
  {id:30,uid:"timo",name:"Timo",teamId:5,t24:5,t25:5,teo:5,t26:5,t24cap:true,t25cap:true,teocap:true,t26cap:true,photoUrl:null},
  {id:31,uid:"lucie",name:"Lucie",teamId:5,t24:5,t25:5,teo:5,t26:5,photoUrl:null},
  {id:32,uid:"ewen",name:"Ewen",teamId:5,t24:5,t25:5,t26:5,photoUrl:null},
  {id:33,uid:"hana",name:"Hana",teamId:null,t25:5,photoUrl:null},
  {id:34,uid:"theo",name:"Théo",teamId:null,t25:5,photoUrl:null},
  {id:35,uid:"nils-b",name:"Nils B",teamId:6,t24:6,t25:6,t26:6,t26cap:true,photoUrl:null},
  {id:36,uid:"florent-e",name:"Florent E",teamId:null,t24:6,t25:6,t24cap:true,t25cap:true,photoUrl:null},
  {id:37,uid:"jules",name:"Jules",teamId:6,t24:6,t25:6,t26:6,photoUrl:null},
  {id:38,uid:"chiara",name:"Chiara",teamId:10,t25:6,teo:10,t26:10,teocap:true,t26cap:true,photoUrl:null},
  {id:39,uid:"meline-c",name:"Méline C",teamId:10,t25:6,teo:10,t26:10,photoUrl:null},
  {id:40,uid:"lea-e",name:"Léa E",teamId:null,t25:6,photoUrl:null},
  {id:41,uid:"eddy",name:"Eddy",teamId:1,t25:6,t26:1,photoUrl:null},
  {id:42,uid:"romain-g",name:"Romain G",teamId:11,t24:11,t25:11,teo:11,t26:11,photoUrl:null},
  {id:43,uid:"emma-df",name:"Emma DF",teamId:11,t24:11,t25:11,teo:11,t26:11,photoUrl:null},
  {id:44,uid:"pauline-m",name:"Pauline M",teamId:11,t24:11,t25:11,teo:11,t26:11,t24cap:true,t25cap:true,teocap:true,t26cap:true,photoUrl:null},
  {id:45,uid:"louanne",name:"Louanne",teamId:null,t24:11,t25:11,photoUrl:null},
  {id:46,uid:"gabin-p",name:"Gabin P",teamId:null,t24:11,t25:11,photoUrl:null},
  {id:47,uid:"armand",name:"Armand",teamId:null,t25:11,photoUrl:null},
  {id:48,uid:"gabin-t",name:"Gabin T",teamId:null,t25:11,photoUrl:null},
  {id:49,uid:"jessim",name:"Jessim",teamId:12,t25:12,teo:12,t26:12,photoUrl:null},
  {id:50,uid:"yvan",name:"Yvan",teamId:12,t25:12,teo:12,t26:12,photoUrl:null},
  {id:51,uid:"marine",name:"Marine",teamId:12,t25:12,teo:12,t26:12,photoUrl:null},
  {id:52,uid:"nathan-d",name:"Nathan D",teamId:12,t25:12,teo:12,t26:12,t25cap:true,teocap:true,t26cap:true,photoUrl:null},
  {id:53,uid:"lehna",name:"Léhna",teamId:null,t25:12,photoUrl:null},
  {id:54,uid:"tom",name:"Tom",teamId:null,t25:12,photoUrl:null},
  {id:55,uid:"marlon",name:"Marlon",teamId:14,t24:13,t25:14,teo:14,t26:14,photoUrl:null},
  {id:56,uid:"quentin-h",name:"Quentin H",teamId:14,t24:13,t25:14,t26:14,t24cap:true,photoUrl:null},
  {id:57,uid:"quentin-l",name:"Quentin L",teamId:null,t24:13,t25:14,photoUrl:null},
  {id:58,uid:"eva",name:"Eva",teamId:null,t24:13,t25:14,photoUrl:null},
  {id:59,uid:"thisma",name:"Thisma",teamId:14,t25:14,teo:14,t26:14,t25cap:true,teocap:true,t26cap:true,photoUrl:null},
  {id:60,uid:"thomas",name:"Thomas",teamId:14,t25:14,teo:17,t26:14,photoUrl:null},
  {id:61,uid:"emma-g",name:"Emma G",teamId:14,t25:14,teo:14,t26:14,photoUrl:null},
  {id:62,uid:"lubin",name:"Lubin",teamId:null,t25:14,teo:17,photoUrl:null},
  {id:63,uid:"leo-m",name:"Léo M",teamId:15,t24:15,t25:15,teo:15,t26:15,t24cap:true,t25cap:true,teocap:true,t26cap:true,photoUrl:null},
  {id:64,uid:"enzo",name:"Enzo",teamId:15,t24:15,t25:15,teo:15,t26:15,photoUrl:null},
  {id:65,uid:"noah",name:"Noah",teamId:15,t24:15,t25:15,t26:15,photoUrl:null},
  {id:66,uid:"nils-l",name:"Nils L",teamId:15,t25:15,teo:15,t26:15,photoUrl:null},
  {id:69,uid:"nolan",name:"Nolan",teamId:16,t24:22,t25:22,teo:22,t26:16,t25cap:true,teocap:true,t26cap:true,photoUrl:null},
  {id:70,uid:"quentin-g",name:"Quentin G",teamId:16,t24:22,t25:22,t26:16,photoUrl:null},
  {id:71,uid:"laura",name:"Laura",teamId:null,t24:22,t25:22,photoUrl:null},
  {id:72,uid:"johan-d",name:"Johan D",teamId:16,t25:22,teo:22,t26:16,photoUrl:null},
  {id:73,uid:"lenny",name:"Lenny",teamId:null,t25:22,photoUrl:null},
  {id:74,uid:"kilyann",name:"Kilyann",teamId:null,t25:22,photoUrl:null},
  {id:75,uid:"orianne",name:"Orianne",teamId:null,t25:22,photoUrl:null},
  {id:76,uid:"marie",name:"Marie",teamId:17,t24:7,t25:17,teo:17,t26:17,photoUrl:null},
  {id:77,uid:"salome",name:"Salomé",teamId:null,t24:7,t25:17,teo:17,t24cap:true,t25cap:true,teocap:true,t26cap:true,photoUrl:null},
  {id:78,uid:"shoutoh",name:"Shoutoh",teamId:17,t24:7,t25:17,teo:17,t26:17,photoUrl:null},
  {id:80,uid:"solal",name:"Solal",teamId:17,t25:17,t26:17,photoUrl:null},
  {id:81,uid:"nathan-v",name:"Nathan V",teamId:null,t25:17,photoUrl:null},
  {id:82,uid:"etienne",name:"Etienne",teamId:17,t25:17,t26:17,photoUrl:null},
  {id:83,uid:"noa-m",name:"Noa M",teamId:null,t25:17,photoUrl:null},
  {id:84,uid:"candice",name:"Candice",teamId:null,t24:3,photoUrl:null},
  {id:85,uid:"lola",name:"Lola",teamId:null,t24:3,photoUrl:null},
  {id:86,uid:"rachel",name:"Rachel",teamId:5,t24:5,t26:5,photoUrl:null},
  {id:87,uid:"hugo",name:"Hugo",teamId:null,t24:5,photoUrl:null},
  {id:88,uid:"leane",name:"Léane",teamId:null,t24:5,photoUrl:null},
  {id:89,uid:"joris",name:"Joris",teamId:null,t24:6,photoUrl:null},
  {id:90,uid:"kam",name:"Kam",teamId:null,t24:6,photoUrl:null},
  {id:91,uid:"benj",name:"BenJ",teamId:11,t24:7,t26:11,photoUrl:null},
  {id:92,uid:"lise-b",name:"Lise B",teamId:null,t24:7,photoUrl:null},
  {id:93,uid:"antho",name:"Antho",teamId:null,t24:7,photoUrl:null},
  {id:95,uid:"loan-b",name:"Loan B",teamId:null,t24:8,photoUrl:null},
  {id:96,uid:"catia",name:"Catia",teamId:null,t24:8,photoUrl:null},
  {id:97,uid:"lou",name:"Lou",teamId:null,t24:8,photoUrl:null},
  {id:98,uid:"maxime-r",name:"Maxime R",teamId:null,t24:8,photoUrl:null},
  {id:99,uid:"laurine",name:"Laurine",teamId:null,t24:8,photoUrl:null},
  {id:100,uid:"fred",name:"Fred",teamId:null,t24:9,photoUrl:null},
  {id:101,uid:"meline-b",name:"Méline B",teamId:null,t24:9,photoUrl:null},
  {id:102,uid:"gab",name:"Gab",teamId:null,t24:11,photoUrl:null},
  {id:103,uid:"fanny",name:"Fanny",teamId:null,t24:13,photoUrl:null},
  {id:104,uid:"romane",name:"Romane",teamId:null,t24:15,teo:22,photoUrl:null},
  {id:105,uid:"tanguy",name:"Tanguy",teamId:null,t24:15,photoUrl:null},
  {id:106,uid:"lucie-cf",name:"Lucie CF",teamId:null,t24:15,photoUrl:null},
  {id:107,uid:"aylin",name:"Aylin",teamId:null,t24:15,photoUrl:null},
  {id:108,uid:"noa",name:"Noa",teamId:21,t24:22,t26:21,photoUrl:null},
  {id:109,uid:"bastien",name:"Bastien",teamId:21,t24:22,t26:21,t24cap:true,t26cap:true,photoUrl:null},
  {id:110,uid:"angelina",name:"Angelina",teamId:null,t24:22,photoUrl:null},
  {id:111,uid:"roman",name:"Roman",teamId:21,t24:22,t26:21,photoUrl:null},
  {id:112,uid:"chloe-p",name:"Chloé P",teamId:null,teo:12,photoUrl:null},
  {id:113,uid:"yoan",name:"Yoan",teamId:null,teo:12,photoUrl:null},
  {id:114,uid:"teo",name:"Teo",teamId:null,teo:11,photoUrl:null},
  {id:115,uid:"leni",name:"Leni",teamId:10,teo:10,t26:10,photoUrl:null},
  {id:116,uid:"louis",name:"Louis",teamId:null,teo:17,photoUrl:null},
  {id:117,uid:"ilian",name:"Ilian",teamId:19,teo:5,t26:19,t26cap:true,photoUrl:null},
  {id:118,uid:"ylegao",name:"Ylegao",teamId:null,teo:15,photoUrl:null},
  {id:119,uid:"lukas",name:"Lukas",teamId:null,teo:11,photoUrl:null},
  {id:120,uid:"juline",name:"Juline",teamId:10,teo:10,t26:10,photoUrl:null},
  {id:121,uid:"emmy",name:"Emmy",teamId:5,teo:5,t26:5,photoUrl:null},
  {id:122,uid:"erwan",name:"Erwan",teamId:null,teo:11,photoUrl:null},
  {id:123,uid:"laura-d",name:"Laura D",teamId:null,teo:4,photoUrl:null},
  {id:124,uid:"julie",name:"Julie",teamId:15,teo:15,t26:15,photoUrl:null},
  {id:125,uid:"florentin",name:"Florentin",teamId:6,teo:10,t26:6,photoUrl:null},
  {id:126,uid:"chloe",name:"Chloé",teamId:null,teo:4,photoUrl:null},
  {id:127,uid:"ludivine",name:"Ludivine",teamId:null,teo:11,photoUrl:null},
  {id:128,uid:"nathan-c",name:"Nathan C",teamId:10,teo:10,t26:10,photoUrl:null},
  {id:129,uid:"candice-r",name:"Candice R",teamId:null,teo:22,photoUrl:null},
  {id:130,uid:"anais",name:"Anais",teamId:null,teo:22,photoUrl:null},
  {id:131,uid:"emeline",name:"Emeline",teamId:null,teo:4,photoUrl:null},
  {id:132,uid:"jeremy",name:"Jeremy",teamId:null,teo:4,photoUrl:null},
  {id:133,uid:"alexis",name:"Alexis",teamId:null,teo:4,photoUrl:null},
  {id:134,uid:"max",name:"Max",teamId:10,teo:10,t26:10,photoUrl:null},
  {id:135,uid:"clement",name:"Clément",teamId:null,teo:5,photoUrl:null},
  {id:136,uid:"romain-c",name:"Romain C",teamId:null,teo:4,photoUrl:null},
  {id:138,uid:"lorenzo",name:"Lorenzo",teamId:6,t26:6,photoUrl:null},
  {id:139,uid:"ylhan",name:"Ylhan",teamId:null,photoUrl:null},
  {id:140,uid:"kyks",name:"Kyks",teamId:5,t26:5,photoUrl:null},
  {id:141,uid:"mathis-p",name:"Mathis P",teamId:1,t26:1,photoUrl:null},
  {id:142,uid:"juliette",name:"Juliette",teamId:1,t26:1,photoUrl:null},
  {id:143,uid:"matteo",name:"Mattéo",teamId:21,t26:21,photoUrl:null},
  {id:144,uid:"hugo-m",name:"Hugo M",teamId:17,t24:7,t26:17,photoUrl:null},
  {id:145,uid:"macha",name:"Macha",teamId:null,t24:11,photoUrl:null},
  {id:146,uid:"julia-p",name:"Julia P",teamId:1,t26:1,photoUrl:null},
  {id:147,uid:"theo-b",name:"Théo B",teamId:1,t26:1,photoUrl:null},
  {id:148,uid:"matteo-r",name:"Matteo R",teamId:null,photoUrl:null},
  {id:150,uid:"mathis-f",name:"Mathis F",teamId:null,photoUrl:null},
  {id:152,uid:"baptiste-bes",name:"Baptiste Bes",teamId:null,photoUrl:null},
  {id:153,uid:"baptiste-ber",name:"Baptiste Ber",teamId:null,photoUrl:null},
  {id:154,uid:"tom-g",name:"Tom G",teamId:null,photoUrl:null},
  {id:94,uid:"zoe-p",name:"Zoé P",teamId:null,t24:7,photoUrl:null},
  {id:79,uid:"melyne",name:"Mélyne",teamId:14,t25:17,teo:17,t26:14,photoUrl:null},
  {id:68,uid:"lea",name:"Léa",teamId:null,t25:15,photoUrl:null},
  {id:67,uid:"lou-ann",name:"Lou-Ann",teamId:15,t25:15,teo:15,t26:15,photoUrl:null},
];

const TRANSFERS = [
  {playerId:1,fromTeamId:3,toTeamId:1,date:"2025"},
  {playerId:2,fromTeamId:3,toTeamId:1,date:"2025"},
  {playerId:3,fromTeamId:6,toTeamId:1,date:"2025"},
  {playerId:7,fromTeamId:9,toTeamId:2,date:"2025"},
  {playerId:8,fromTeamId:9,toTeamId:2,date:"2025"},
  {playerId:9,fromTeamId:9,toTeamId:2,date:"2025"},
  {playerId:10,fromTeamId:9,toTeamId:2,date:"2025"},
  {playerId:14,fromTeamId:3,toTeamId:14,date:"2026"},
  {playerId:16,fromTeamId:13,toTeamId:3,date:"2025"},
  {playerId:17,fromTeamId:3,toTeamId:14,date:"2026"},
  {playerId:18,fromTeamId:3,toTeamId:14,date:"2026"},
  {playerId:21,fromTeamId:8,toTeamId:4,date:"2025"},
  {playerId:22,fromTeamId:9,toTeamId:4,date:"2025"},
  {playerId:38,fromTeamId:6,toTeamId:10,date:"2026"},
  {playerId:39,fromTeamId:6,toTeamId:10,date:"2026"},
  {playerId:55,fromTeamId:13,toTeamId:14,date:"2025"},
  {playerId:56,fromTeamId:13,toTeamId:14,date:"2025"},
  {playerId:57,fromTeamId:13,toTeamId:14,date:"2025"},
  {playerId:58,fromTeamId:13,toTeamId:14,date:"2025"},
  {playerId:60,fromTeamId:14,toTeamId:17,date:"2026"},
  {playerId:62,fromTeamId:14,toTeamId:17,date:"2026"},
  {playerId:76,fromTeamId:7,toTeamId:17,date:"2025"},
  {playerId:77,fromTeamId:7,toTeamId:17,date:"2025"},
  {playerId:78,fromTeamId:7,toTeamId:17,date:"2025"},
  {playerId:1,fromTeamId:1,toTeamId:0,date:"2026"},
  {playerId:2,fromTeamId:1,toTeamId:0,date:"2026"},
  {playerId:3,fromTeamId:1,toTeamId:0,date:"2026"},
  {playerId:4,fromTeamId:1,toTeamId:0,date:"2026"},
  {playerId:5,fromTeamId:1,toTeamId:0,date:"2026"},
  {playerId:6,fromTeamId:1,toTeamId:0,date:"2026"},
  {playerId:7,fromTeamId:2,toTeamId:0,date:"2026"},
  {playerId:8,fromTeamId:2,toTeamId:0,date:"2026"},
  {playerId:9,fromTeamId:2,toTeamId:0,date:"2026"},
  {playerId:10,fromTeamId:2,toTeamId:0,date:"2026"},
  {playerId:11,fromTeamId:2,toTeamId:0,date:"2026"},
  {playerId:12,fromTeamId:2,toTeamId:0,date:"2026"},
  {playerId:13,fromTeamId:2,toTeamId:0,date:"2026"},
  {playerId:15,fromTeamId:3,toTeamId:0,date:"2026"},
  {playerId:16,fromTeamId:3,toTeamId:0,date:"2026"},
  {playerId:19,fromTeamId:3,toTeamId:0,date:"2026"},
  {playerId:20,fromTeamId:3,toTeamId:0,date:"2026"},
  {playerId:23,fromTeamId:4,toTeamId:0,date:"2026"},
  {playerId:24,fromTeamId:4,toTeamId:0,date:"2026"},
  {playerId:25,fromTeamId:4,toTeamId:0,date:"2026"},
  {playerId:26,fromTeamId:4,toTeamId:0,date:"2026"},
  {playerId:27,fromTeamId:4,toTeamId:0,date:"2026"},
  {playerId:28,fromTeamId:4,toTeamId:0,date:"2026"},
  {playerId:32,fromTeamId:5,toTeamId:0,date:"2026"},
  {playerId:33,fromTeamId:5,toTeamId:0,date:"2026"},
  {playerId:34,fromTeamId:5,toTeamId:0,date:"2026"},
  {playerId:35,fromTeamId:6,toTeamId:0,date:"2026"},
  {playerId:36,fromTeamId:6,toTeamId:0,date:"2026"},
  {playerId:37,fromTeamId:6,toTeamId:0,date:"2026"},
  {playerId:40,fromTeamId:6,toTeamId:0,date:"2026"},
  {playerId:41,fromTeamId:6,toTeamId:0,date:"2026"},
  {playerId:45,fromTeamId:11,toTeamId:0,date:"2026"},
  {playerId:46,fromTeamId:11,toTeamId:0,date:"2026"},
  {playerId:47,fromTeamId:11,toTeamId:0,date:"2026"},
  {playerId:48,fromTeamId:11,toTeamId:0,date:"2026"},
  {playerId:53,fromTeamId:12,toTeamId:0,date:"2026"},
  {playerId:54,fromTeamId:12,toTeamId:0,date:"2026"},
  {playerId:56,fromTeamId:14,toTeamId:0,date:"2026"},
  {playerId:57,fromTeamId:14,toTeamId:0,date:"2026"},
  {playerId:58,fromTeamId:14,toTeamId:0,date:"2026"},
  {playerId:65,fromTeamId:15,toTeamId:0,date:"2026"},
  {playerId:68,fromTeamId:15,toTeamId:0,date:"2026"},
  {playerId:70,fromTeamId:22,toTeamId:0,date:"2026"},
  {playerId:71,fromTeamId:22,toTeamId:0,date:"2026"},
  {playerId:73,fromTeamId:22,toTeamId:0,date:"2026"},
  {playerId:74,fromTeamId:22,toTeamId:0,date:"2026"},
  {playerId:75,fromTeamId:22,toTeamId:0,date:"2026"},
  {playerId:80,fromTeamId:17,toTeamId:0,date:"2026"},
  {playerId:81,fromTeamId:17,toTeamId:0,date:"2026"},
  {playerId:82,fromTeamId:17,toTeamId:0,date:"2026"},
  {playerId:83,fromTeamId:17,toTeamId:0,date:"2026"},
  {playerId:84,fromTeamId:3,toTeamId:0,date:"2025"},
  {playerId:85,fromTeamId:3,toTeamId:0,date:"2025"},
  {playerId:86,fromTeamId:5,toTeamId:0,date:"2025"},
  {playerId:87,fromTeamId:5,toTeamId:0,date:"2025"},
  {playerId:88,fromTeamId:5,toTeamId:0,date:"2025"},
  {playerId:89,fromTeamId:6,toTeamId:0,date:"2025"},
  {playerId:90,fromTeamId:6,toTeamId:0,date:"2025"},
  {playerId:91,fromTeamId:7,toTeamId:0,date:"2025"},
  {playerId:92,fromTeamId:7,toTeamId:0,date:"2025"},
  {playerId:93,fromTeamId:7,toTeamId:0,date:"2025"},
  {playerId:94,fromTeamId:7,toTeamId:0,date:"2025"},
  {playerId:95,fromTeamId:8,toTeamId:0,date:"2025"},
  {playerId:96,fromTeamId:8,toTeamId:0,date:"2025"},
  {playerId:97,fromTeamId:8,toTeamId:0,date:"2025"},
  {playerId:98,fromTeamId:8,toTeamId:0,date:"2025"},
  {playerId:99,fromTeamId:8,toTeamId:0,date:"2025"},
  {playerId:100,fromTeamId:9,toTeamId:0,date:"2025"},
  {playerId:101,fromTeamId:9,toTeamId:0,date:"2025"},
  {playerId:102,fromTeamId:11,toTeamId:0,date:"2025"},
  {playerId:103,fromTeamId:13,toTeamId:0,date:"2025"},
  {playerId:105,fromTeamId:15,toTeamId:0,date:"2025"},
  {playerId:106,fromTeamId:15,toTeamId:0,date:"2025"},
  {playerId:107,fromTeamId:15,toTeamId:0,date:"2025"},
  {playerId:108,fromTeamId:22,toTeamId:0,date:"2025"},
  {playerId:109,fromTeamId:22,toTeamId:0,date:"2025"},
  {playerId:110,fromTeamId:22,toTeamId:0,date:"2025"},
  {playerId:111,fromTeamId:22,toTeamId:0,date:"2025"},
];

const EVENTS = [
  {id:1,name:"Olympiades Été",edition:"2024",date:"Juin 2024",type:"olympiades",typeLabel:"Olympiades Physiques",participants:67,winner:13,
   description:"La première édition des Olympiades. 10 équipes s'affrontent sous un soleil de plomb.",
   vlogUrl:"",epreuves:[
     {id:101,name:"Ballon Prisonnier",type:"team",results:[{teamId:7,pos:1,pts:25,playerIds:[77,78,91,92,93,144]},{teamId:13,pos:2,pts:20,playerIds:[16,56,57,58,103]},{teamId:6,pos:3,pts:16,playerIds:[3,35,36,37,89,90]},{teamId:22,pos:4,pts:13,playerIds:[69,70,71,108,109,111]},{teamId:5,pos:5,pts:11,playerIds:[29,30,32,86,87,88]},{teamId:15,pos:6,pts:9,playerIds:[63,64,65,104,105,106]},{teamId:11,pos:7,pts:7,playerIds:[42,43,44,45,46,102]},{teamId:3,pos:8,pts:5,playerIds:[1,2,14,15,84,85]},{teamId:8,pos:9,pts:3,playerIds:[21,95,96,98,99]},{teamId:9,pos:10,pts:1,playerIds:[8,9,10,22,100,101]}]},
     {id:102,name:"Fléchettes",type:"team",results:[{teamId:9,pos:1,pts:25,playerIds:[7]},{teamId:13,pos:2,pts:20,playerIds:[103]},{teamId:11,pos:3,pts:16,playerIds:[42]},{teamId:3,pos:4,pts:13,playerIds:[2]},{teamId:5,pos:5,pts:11,playerIds:[30]},{teamId:22,pos:6,pts:9,playerIds:[71]},{teamId:8,pos:7,pts:7,playerIds:[96]},{teamId:15,pos:8,pts:5,playerIds:[104]},{teamId:7,pos:9,pts:3,playerIds:[94]},{teamId:6,pos:10,pts:1,playerIds:[90]}]},
     {id:103,name:"Basket",type:"team",results:[{teamId:22,pos:1,pts:25,playerIds:[108]},{teamId:3,pos:2,pts:20,playerIds:[15]},{teamId:15,pos:3,pts:16,playerIds:[105]},{teamId:9,pos:4,pts:13,playerIds:[101]},{teamId:13,pos:5,pts:11,playerIds:[55]},{teamId:11,pos:6,pts:9,playerIds:[45]},{teamId:7,pos:7,pts:7,playerIds:[92]},{teamId:6,pos:8,pts:5,playerIds:[37]},{teamId:8,pos:9,pts:3,playerIds:[97]},{teamId:5,pos:10,pts:1,playerIds:[31]}]},
     {id:104,name:"Culture G",type:"team",results:[{teamId:8,pos:1,pts:25,playerIds:[95]},{teamId:7,pos:2,pts:20,playerIds:[76]},{teamId:6,pos:3,pts:16,playerIds:[3]},{teamId:9,pos:4,pts:13,playerIds:[10]},{teamId:13,pos:5,pts:11,playerIds:[58]},{teamId:3,pos:6,pts:9,playerIds:[85]},{teamId:15,pos:7,pts:7,playerIds:[106]},{teamId:22,pos:8,pts:5,playerIds:[110]},{teamId:11,pos:9,pts:3,playerIds:[43]},{teamId:5,pos:10,pts:1,playerIds:[86]}]},
     {id:105,name:"Foot",type:"team",results:[{teamId:13,pos:1,pts:25,playerIds:[16,56,57]},{teamId:6,pos:2,pts:20,playerIds:[35,36,89]},{teamId:9,pos:3,pts:16,playerIds:[8,9,22]},{teamId:15,pos:4,pts:13,playerIds:[63,64,65]},{teamId:7,pos:5,pts:11,playerIds:[78,91,93]},{teamId:5,pos:6,pts:9,playerIds:[29,32,87]},{teamId:8,pos:7,pts:7,playerIds:[21,98,99]},{teamId:3,pos:8,pts:5,playerIds:[1,14,84]},{teamId:22,pos:9,pts:3,playerIds:[69,70,111]},{teamId:11,pos:10,pts:1,playerIds:[44,46,102]}]},
     {id:106,name:"Pétanque",type:"team",results:[{teamId:22,pos:1,pts:25,playerIds:[108,109]},{teamId:5,pos:2,pts:20,playerIds:[86,87]},{teamId:13,pos:3,pts:16,playerIds:[57,58]},{teamId:9,pos:4,pts:13,playerIds:[7,9]},{teamId:3,pos:5,pts:11,playerIds:[2,84]},{teamId:11,pos:6,pts:9,playerIds:[44,45]},{teamId:7,pos:7,pts:7,playerIds:[78,93]},{teamId:15,pos:8,pts:5,playerIds:[63,105]},{teamId:8,pos:9,pts:3,playerIds:[21,99]},{teamId:6,pos:10,pts:1,playerIds:[3,90]}]},
     {id:107,name:"WII Sport",type:"team",results:[{teamId:9,pos:1,pts:25,playerIds:[8,22]},{teamId:13,pos:2,pts:20,playerIds:[56,103]},{teamId:3,pos:3,pts:16,playerIds:[14,85]},{teamId:6,pos:4,pts:13,playerIds:[35,36]},{teamId:7,pos:5,pts:11,playerIds:[76,77]},{teamId:15,pos:6,pts:9,playerIds:[104,107]},{teamId:8,pos:7,pts:7,playerIds:[96,97]},{teamId:5,pos:8,pts:5,playerIds:[29,88]},{teamId:11,pos:9,pts:3,playerIds:[42,43]},{teamId:22,pos:10,pts:1,playerIds:[69,110]}]},
     {id:108,name:"Ping Pong",type:"team",results:[{teamId:3,pos:1,pts:25,playerIds:[1,15]},{teamId:13,pos:2,pts:20,playerIds:[16,55]},{teamId:7,pos:3,pts:16,playerIds:[92,144]},{teamId:6,pos:4,pts:13,playerIds:[37,89]},{teamId:11,pos:5,pts:11,playerIds:[46,102]},{teamId:15,pos:6,pts:9,playerIds:[64,106]},{teamId:22,pos:7,pts:7,playerIds:[70,111]},{teamId:5,pos:8,pts:5,playerIds:[31,32]},{teamId:9,pos:9,pts:3,playerIds:[10,101]},{teamId:8,pos:10,pts:1,playerIds:[95,98]}]},
     {id:109,name:"Marathon F",type:"team",results:[{teamId:22,pos:1,pts:25,playerIds:[110]},{teamId:5,pos:2,pts:20,playerIds:[86]},{teamId:7,pos:3,pts:16,playerIds:[94]},{teamId:13,pos:4,pts:13,playerIds:[103]},{teamId:9,pos:5,pts:11,playerIds:[100]},{teamId:11,pos:6,pts:9,playerIds:[145]},{teamId:6,pos:7,pts:7,playerIds:[3]},{teamId:3,pos:8,pts:5,playerIds:[85]},{teamId:8,pos:9,pts:3,playerIds:[]},{teamId:15,pos:10,pts:1,playerIds:[]}]},
     {id:110,name:"Marathon H",type:"team",results:[{teamId:5,pos:1,pts:25,playerIds:[30]},{teamId:6,pos:2,pts:20,playerIds:[35]},{teamId:22,pos:3,pts:16,playerIds:[111]},{teamId:13,pos:4,pts:13,playerIds:[16]},{teamId:3,pos:5,pts:11,playerIds:[14]},{teamId:7,pos:6,pts:9,playerIds:[144]},{teamId:15,pos:7,pts:7,playerIds:[105]},{teamId:11,pos:8,pts:5,playerIds:[46]},{teamId:8,pos:9,pts:3,playerIds:[21]},{teamId:9,pos:10,pts:1,playerIds:[22]}]},
     {id:111,name:"Tir à la corde",type:"team",results:[{teamId:5,pos:1,pts:25,playerIds:[29,30,31,86]},{teamId:7,pos:2,pts:20,playerIds:[77,91,93,94]},{teamId:22,pos:3,pts:16,playerIds:[71,108,109,110]},{teamId:3,pos:4,pts:13,playerIds:[2,15,84,85]},{teamId:9,pos:5,pts:11,playerIds:[9,10,22,100]},{teamId:6,pos:6,pts:9,playerIds:[3,37,89,90]},{teamId:13,pos:7,pts:7,playerIds:[56,57,58,103]},{teamId:11,pos:8,pts:5,playerIds:[44,46,102,145]},{teamId:8,pos:9,pts:3,playerIds:[]},{teamId:15,pos:10,pts:1,playerIds:[]}]}
   ]},
  {id:2,name:"Olympiades Été",edition:"2025",date:"Juin 2025",type:"olympiades",typeLabel:"Olympiades Physiques",participants:83,winner:17,
   description:"La deuxième édition — 12 équipes, 16 épreuves. UNITED s'impose.",
   vlogUrl:"",
   epreuves:[
     {id:201,name:"Ballon-Prisonnier",type:"team",results:[{teamId:5,pos:1,pts:25,playerIds:[29,30,31,32,33,34]},{teamId:17,pos:2,pts:22,playerIds:[77,78,79,80,81,83]},{teamId:4,pos:3,pts:19,playerIds:[21,22,23,24,25,27]},{teamId:2,pos:4,pts:19,playerIds:[8,9,10,11,12,13]},{teamId:12,pos:5,pts:13,playerIds:[49,50,51,52,53,54]},{teamId:3,pos:6,pts:10,playerIds:[15,16,17,18,19,20]},{teamId:14,pos:7,pts:8,playerIds:[56,57,59,60,61,62]},{teamId:6,pos:8,pts:8,playerIds:[35,36,37,38,39,41]},{teamId:22,pos:9,pts:4,playerIds:[69,71,72,73,74,75]},{teamId:15,pos:10,pts:3,playerIds:[63,64,65,66,67,68]},{teamId:11,pos:11,pts:2,playerIds:[42,43,44,45,47,48]},{teamId:1,pos:12,pts:2,playerIds:[1,2,3,4,5,6]}]},
     {id:202,name:"Football",type:"team",results:[{teamId:14,pos:1,pts:25,playerIds:[55,56,59]},{teamId:12,pos:2,pts:22,playerIds:[49,50,52]},{teamId:17,pos:3,pts:19,playerIds:[78,80,82]},{teamId:3,pos:4,pts:19,playerIds:[15,16,17]},{teamId:22,pos:5,pts:13,playerIds:[69,70,73]},{teamId:6,pos:6,pts:13,playerIds:[35,36,41]},{teamId:2,pos:7,pts:13,playerIds:[8,9,13]},{teamId:15,pos:8,pts:4,playerIds:[63,64,66]},{teamId:11,pos:9,pts:4,playerIds:[42,43,47]},{teamId:5,pos:10,pts:4,playerIds:[29,32,34]},{teamId:4,pos:11,pts:4,playerIds:[22,27,28]},{teamId:1,pos:12,pts:4,playerIds:[1,2,6]}]},
     {id:203,name:"Pétanque",type:"team",results:[{teamId:4,pos:1,pts:25,playerIds:[21,26]},{teamId:2,pos:2,pts:22,playerIds:[7,11]},{teamId:17,pos:3,pts:19,playerIds:[77,81]},{teamId:11,pos:4,pts:16,playerIds:[44,46]},{teamId:12,pos:5,pts:13,playerIds:[53,54]},{teamId:22,pos:6,pts:10,playerIds:[72,75]},{teamId:1,pos:7,pts:8,playerIds:[3,5]},{teamId:14,pos:8,pts:6,playerIds:[57,58]},{teamId:5,pos:9,pts:4,playerIds:[30,33]},{teamId:15,pos:10,pts:3,playerIds:[67,68]},{teamId:3,pos:11,pts:2,playerIds:[19,20]},{teamId:6,pos:12,pts:1,playerIds:[37,38]}]},
     {id:204,name:"Culture G",type:"team",results:[{teamId:2,pos:1,pts:25,playerIds:[10]},{teamId:17,pos:2,pts:22,playerIds:[76]},{teamId:15,pos:3,pts:19,playerIds:[65]},{teamId:4,pos:4,pts:16,playerIds:[23]},{teamId:22,pos:5,pts:13,playerIds:[74]},{teamId:11,pos:6,pts:10,playerIds:[48]},{teamId:12,pos:7,pts:8,playerIds:[51]},{teamId:5,pos:8,pts:6,playerIds:[31]},{teamId:14,pos:9,pts:4,playerIds:[61]},{teamId:1,pos:10,pts:3,playerIds:[4]},{teamId:6,pos:11,pts:2,playerIds:[40]},{teamId:3,pos:12,pts:1,playerIds:[18]}]},
     {id:205,name:"Marathon H",type:"team",results:[{teamId:2,pos:1,pts:25,playerIds:[8]},{teamId:17,pos:2,pts:22,playerIds:[81]},{teamId:5,pos:3,pts:19,playerIds:[30]},{teamId:15,pos:4,pts:16,playerIds:[64]},{teamId:12,pos:5,pts:13,playerIds:[54]},{teamId:3,pos:6,pts:10,playerIds:[16]},{teamId:14,pos:7,pts:8,playerIds:[57]},{teamId:11,pos:8,pts:6,playerIds:[48]},{teamId:4,pos:9,pts:4,playerIds:[23]},{teamId:1,pos:10,pts:3,playerIds:[2]},{teamId:22,pos:11,pts:1,playerIds:[69]}]},
     {id:206,name:"Marathon F",type:"team",results:[{teamId:12,pos:1,pts:25,playerIds:[53]},{teamId:5,pos:2,pts:22,playerIds:[33]},{teamId:11,pos:3,pts:19,playerIds:[43]},{teamId:22,pos:4,pts:16,playerIds:[71]},{teamId:15,pos:5,pts:13,playerIds:[67]},{teamId:17,pos:6,pts:10,playerIds:[77]},{teamId:4,pos:7,pts:8,playerIds:[26]},{teamId:3,pos:8,pts:6,playerIds:[20]},{teamId:1,pos:9,pts:4,playerIds:[5]},{teamId:2,pos:10,pts:3,playerIds:[7]},{teamId:6,pos:11,pts:2,playerIds:[38]},{teamId:14,pos:12,pts:1,playerIds:[58]}]},
     {id:207,name:"Mario Kart",type:"team",results:[{teamId:12,pos:1,pts:25,playerIds:[49]},{teamId:1,pos:2,pts:22,playerIds:[2]},{teamId:15,pos:3,pts:19,playerIds:[64]},{teamId:11,pos:4,pts:16,playerIds:[42]},{teamId:17,pos:5,pts:13,playerIds:[82]},{teamId:14,pos:6,pts:10,playerIds:[61]},{teamId:22,pos:7,pts:6,playerIds:[70]},{teamId:6,pos:8,pts:6,playerIds:[39]},{teamId:5,pos:9,pts:6,playerIds:[32]},{teamId:4,pos:10,pts:6,playerIds:[28]},{teamId:3,pos:11,pts:6,playerIds:[14]},{teamId:2,pos:12,pts:6,playerIds:[13]}]},
     {id:208,name:"Molky",type:"team",results:[{teamId:17,pos:1,pts:25,playerIds:[79]},{teamId:11,pos:2,pts:22,playerIds:[47]},{teamId:2,pos:3,pts:19,playerIds:[11]},{teamId:14,pos:4,pts:16,playerIds:[56]},{teamId:22,pos:5,pts:13,playerIds:[73]},{teamId:3,pos:6,pts:10,playerIds:[18]},{teamId:6,pos:7,pts:8,playerIds:[35]},{teamId:15,pos:8,pts:6,playerIds:[67]},{teamId:4,pos:9,pts:4,playerIds:[24]},{teamId:1,pos:10,pts:3,playerIds:[4]},{teamId:5,pos:11,pts:2,playerIds:[31]},{teamId:12,pos:12,pts:1,playerIds:[52]}]},
     {id:209,name:"Ping Pong",type:"team",results:[{teamId:14,pos:1,pts:25,playerIds:[55,60]},{teamId:6,pos:2,pts:22,playerIds:[36,37]},{teamId:4,pos:3,pts:19,playerIds:[21,22]},{teamId:5,pos:4,pts:16,playerIds:[32,34]},{teamId:11,pos:5,pts:13,playerIds:[44,46]},{teamId:3,pos:6,pts:13,playerIds:[15,20]},{teamId:2,pos:7,pts:13,playerIds:[9,12]},{teamId:1,pos:8,pts:13,playerIds:[1,6]},{teamId:17,pos:9,pts:4,playerIds:[78,83]},{teamId:22,pos:10,pts:4,playerIds:[69,74]},{teamId:15,pos:11,pts:4,playerIds:[63,65]},{teamId:12,pos:12,pts:4,playerIds:[50,54]}]},
     {id:210,name:"Puzzle & Run",type:"team",results:[{teamId:1,pos:1,pts:25,playerIds:[3,5]},{teamId:6,pos:2,pts:22,playerIds:[38,40]},{teamId:15,pos:3,pts:19,playerIds:[66,68]},{teamId:14,pos:4,pts:16,playerIds:[59,62]},{teamId:17,pos:5,pts:13,playerIds:[76,77]},{teamId:3,pos:6,pts:10,playerIds:[17,19]},{teamId:11,pos:7,pts:8,playerIds:[43,45]},{teamId:5,pos:8,pts:6,playerIds:[29,30,33]},{teamId:4,pos:9,pts:4,playerIds:[26,27]},{teamId:12,pos:10,pts:3,playerIds:[51,53]},{teamId:2,pos:11,pts:2,playerIds:[7,10]},{teamId:22,pos:12,pts:1,playerIds:[72,75]}]},
     {id:211,name:"Basket",type:"team",results:[{teamId:17,pos:1,pts:25,playerIds:[81]},{teamId:5,pos:2,pts:22,playerIds:[29]},{teamId:3,pos:3,pts:19,playerIds:[15]},{teamId:22,pos:4,pts:16,playerIds:[72]},{teamId:11,pos:5,pts:13,playerIds:[48]},{teamId:12,pos:6,pts:10,playerIds:[53]},{teamId:14,pos:7,pts:8,playerIds:[55]},{teamId:6,pos:8,pts:6,playerIds:[36]},{teamId:2,pos:9,pts:4,playerIds:[12]},{teamId:4,pos:10,pts:3,playerIds:[22]},{teamId:1,pos:11,pts:2,playerIds:[6]},{teamId:15,pos:12,pts:1,playerIds:[68]}]},
     {id:212,name:"Jungle Speed",type:"team",results:[{teamId:4,pos:1,pts:25,playerIds:[23]},{teamId:11,pos:2,pts:22,playerIds:[44]},{teamId:17,pos:3,pts:19,playerIds:[79]},{teamId:2,pos:4,pts:16,playerIds:[10]},{teamId:12,pos:5,pts:13,playerIds:[52]},{teamId:14,pos:6,pts:10,playerIds:[59]},{teamId:1,pos:7,pts:8,playerIds:[4]},{teamId:15,pos:8,pts:6,playerIds:[66]},{teamId:22,pos:9,pts:4,playerIds:[70]},{teamId:6,pos:10,pts:3,playerIds:[38]},{teamId:5,pos:11,pts:2,playerIds:[31]},{teamId:3,pos:12,pts:1,playerIds:[16]}]},
     {id:213,name:"Clash Royale",type:"team",results:[{teamId:12,pos:1,pts:25,playerIds:[49,50]},{teamId:15,pos:2,pts:22,playerIds:[63,65]},{teamId:5,pos:3,pts:19,playerIds:[29,32]},{teamId:14,pos:4,pts:16,playerIds:[60,62]},{teamId:11,pos:5,pts:13,playerIds:[46,47]},{teamId:1,pos:6,pts:10,playerIds:[1,2]},{teamId:22,pos:7,pts:8,playerIds:[73,74]},{teamId:17,pos:8,pts:6,playerIds:[78,82]},{teamId:2,pos:9,pts:4,playerIds:[9,13]},{teamId:4,pos:10,pts:3,playerIds:[21,28]},{teamId:6,pos:11,pts:2,playerIds:[35,37]},{teamId:3,pos:12,pts:1,playerIds:[14,17]}]},
     {id:214,name:"Memory",type:"team",results:[{teamId:17,pos:1,pts:25,playerIds:[76,80]},{teamId:6,pos:2,pts:22,playerIds:[39,40]},{teamId:12,pos:3,pts:19,playerIds:[51,54]},{teamId:5,pos:4,pts:16,playerIds:[31,33]},{teamId:11,pos:5,pts:13,playerIds:[43,45]},{teamId:1,pos:6,pts:10,playerIds:[3,5]},{teamId:14,pos:7,pts:8,playerIds:[57,58]},{teamId:3,pos:8,pts:6,playerIds:[18,19]},{teamId:22,pos:9,pts:4,playerIds:[69,71]},{teamId:2,pos:10,pts:3,playerIds:[8,11]},{teamId:15,pos:11,pts:2,playerIds:[64,67]},{teamId:4,pos:12,pts:1,playerIds:[25,26]}]},
     {id:215,name:"Tir à la Corde",type:"team",results:[{teamId:5,pos:1,pts:25,playerIds:[29,30,31,33]},{teamId:14,pos:2,pts:22,playerIds:[58,59,60,61]},{teamId:3,pos:3,pts:19,playerIds:[15,17,19,20]},{teamId:2,pos:4,pts:19,playerIds:[9,10,11,12]},{teamId:17,pos:5,pts:10,playerIds:[77,79,81,83]},{teamId:22,pos:6,pts:10,playerIds:[70,71,74,75]},{teamId:15,pos:7,pts:10,playerIds:[65,66,67,68]},{teamId:12,pos:8,pts:10,playerIds:[50,51,52,53]},{teamId:11,pos:9,pts:10,playerIds:[43,44,46,48]},{teamId:6,pos:10,pts:10,playerIds:[35,37,40]},{teamId:4,pos:11,pts:10,playerIds:[22,24,25,28]},{teamId:1,pos:12,pts:10,playerIds:[1,3,5,6]}]},
     {id:216,name:"Course Relais",type:"team",results:[{teamId:12,pos:1,pts:25,playerIds:[49,51,53,54]},{teamId:3,pos:2,pts:22,playerIds:[16,17,18,19]},{teamId:2,pos:3,pts:19,playerIds:[7,8,12,13]},{teamId:17,pos:4,pts:16,playerIds:[76,78,79,80]},{teamId:11,pos:5,pts:13,playerIds:[42,43,45,47]},{teamId:4,pos:6,pts:10,playerIds:[21,23,24,25]},{teamId:22,pos:7,pts:6,playerIds:[69,71,73,75]},{teamId:15,pos:8,pts:6,playerIds:[63,64,67,68]},{teamId:14,pos:9,pts:6,playerIds:[55,56,58,61]},{teamId:6,pos:10,pts:6,playerIds:[35,36,40]},{teamId:5,pos:11,pts:6,playerIds:[30,31,32,33]},{teamId:1,pos:12,pts:6,playerIds:[1,2,3,5]}]}
   ]},
  {id:3,name:"Squid Game",edition:"Hiver 2025",date:"Décembre 2025",type:"squidgame",typeLabel:"Squid Game",participants:60,description:"60 joueurs en individuel. Élimination directe.",
   vlogUrl:"",winnerPlayer:117,epreuves:[
     {id:301,name:"Mingle",type:"squid",rounds:[
       {l:"Tour 1",e:[78,72,148]},
       {l:"Tour 2",e:[71,43]},
       {l:"Tour 3",e:[80,99]},
       {l:"Tour 4",e:[52,50,56]},
       {l:"Tour 5",e:[3,59,61]}
     ]},
     {id:302,name:"Match par équipe",type:"squid",rounds:[
       {l:"Équipe 1",e:[69,109,42,60,26]},
       {l:"Équipe 2",e:[79,22,17,18,150]}
     ]},
     {id:303,name:"Les Lettres",type:"squid_letters",rounds:[
       {l:"Léa donne sa place → Pauline M revient",e:[68]},
       {l:"Julie éliminée sur le champ",e:[124]},
       {l:"Baptiste Bes élimine Léandre",e:[29]},
       {l:"Jessim → rien",e:[]},
       {l:"Lou-Ann → rien",e:[]}
     ]},
     {id:304,name:"Awalé",type:"squid",rounds:[
       {l:"Éliminés",e:[76,120,30,27,15,10,86,153]}
     ]},
     {id:305,name:"Tic Tac Boom",type:"squid",rounds:[
       {l:"Partie 1",e:[2,39]},
       {l:"Partie 2",e:[37,66]}
     ]},
     {id:306,name:"Shi Fu Mi",type:"squid",rounds:[
       {l:"Éliminés",e:[138,63,154,121,28,25,65,64,94]}
     ]},
     {id:307,name:"Dés",type:"squid",rounds:[
       {l:"Éliminés",e:[38,77]}
     ]},
     {id:308,name:"Fléchettes",type:"squid",rounds:[
       {l:"Éliminés",e:[67,44,49,152]}
     ]},
     {id:309,name:"Beer Pong",type:"squid",rounds:[
       {l:"Demi-finale",e:[91,125]},
       {l:"Finale",e:[140]},
       {l:"🏆 Vainqueur",e:[],w:117}
     ]}
   ]},
  {id:4,name:"Olympiades Jeux Vidéo",edition:"2026",date:"Février 2026",type:"jv",typeLabel:"Jeux Vidéo",participants:58,winner:12,
   description:"Première édition gaming — 9 équipes, 19 épreuves. L'EHPAD règne sur les manettes.",
   vlogUrl:"",
   epreuves:[
     {id:401,name:"WII Tennis",type:"team",results:[{teamId:15,pos:1,pts:20,playerIds:[63,118]},{teamId:12,pos:2,pts:16,playerIds:[51,112]},{teamId:14,pos:3,pts:13,playerIds:[14,18]},{teamId:11,pos:4,pts:10,playerIds:[44,119]},{teamId:17,pos:5,pts:8,playerIds:[77,79]},{teamId:22,pos:6,pts:6,playerIds:[104,129]},{teamId:4,pos:7,pts:4,playerIds:[126,131]},{teamId:5,pos:8,pts:2,playerIds:[30,135]},{teamId:10,pos:9,pts:1,playerIds:[38,134]}]},
     {id:402,name:"Smash",type:"team",results:[{teamId:12,pos:1,pts:20,playerIds:[49]},{teamId:11,pos:2,pts:16,playerIds:[114]},{teamId:10,pos:3,pts:13,playerIds:[115]},{teamId:15,pos:4,pts:10,playerIds:[64]},{teamId:14,pos:5,pts:8,playerIds:[55]},{teamId:17,pos:6,pts:6,playerIds:[116]},{teamId:4,pos:7,pts:4,playerIds:[133]},{teamId:5,pos:8,pts:2,playerIds:[31]}]},
     {id:403,name:"FIFA",type:"team",results:[{teamId:14,pos:1,pts:20,playerIds:[17]},{teamId:12,pos:2,pts:16,playerIds:[50]},{teamId:5,pos:3,pts:8,playerIds:[29]},{teamId:10,pos:4,pts:6,playerIds:[125]},{teamId:17,pos:5,pts:4,playerIds:[78]},{teamId:4,pos:6,pts:2,playerIds:[136]},{teamId:22,pos:7,pts:1,playerIds:[72]},{teamId:11,pos:8,pts:1,playerIds:[42]}]},
     {id:404,name:"Speedrun",type:"team",results:[{teamId:4,pos:1,pts:20,playerIds:[22]},{teamId:15,pos:2,pts:16,playerIds:[66]},{teamId:17,pos:3,pts:13,playerIds:[60]},{teamId:12,pos:4,pts:10,playerIds:[52]},{teamId:22,pos:5,pts:8,playerIds:[69]},{teamId:10,pos:6,pts:6,playerIds:[128]},{teamId:11,pos:7,pts:4,playerIds:[127]},{teamId:5,pos:8,pts:1,playerIds:[121]}]},
     {id:405,name:"Golf-it 1",type:"team",results:[{teamId:14,pos:1,pts:16,playerIds:[61]},{teamId:17,pos:2,pts:13,playerIds:[76]},{teamId:15,pos:3,pts:13,playerIds:[67]},{teamId:22,pos:4,pts:6,playerIds:[130]}]},
     {id:406,name:"WII Bowling",type:"team",results:[{teamId:14,pos:1,pts:20,playerIds:[59]},{teamId:10,pos:2,pts:16,playerIds:[120]},{teamId:4,pos:3,pts:13,playerIds:[123]},{teamId:22,pos:4,pts:10,playerIds:[104]},{teamId:17,pos:5,pts:8,playerIds:[60]},{teamId:11,pos:6,pts:6,playerIds:[43]},{teamId:12,pos:7,pts:4,playerIds:[51]},{teamId:5,pos:8,pts:2,playerIds:[135]},{teamId:15,pos:9,pts:1,playerIds:[67]}]},
     {id:407,name:"MarioKart",type:"team",results:[{teamId:12,pos:1,pts:20,playerIds:[49]},{teamId:15,pos:2,pts:16,playerIds:[64]},{teamId:14,pos:3,pts:13,playerIds:[61]},{teamId:17,pos:4,pts:10,playerIds:[116]},{teamId:4,pos:5,pts:8,playerIds:[132]},{teamId:5,pos:6,pts:6,playerIds:[121]},{teamId:11,pos:7,pts:4,playerIds:[127]},{teamId:22,pos:8,pts:2,playerIds:[130]},{teamId:10,pos:9,pts:1,playerIds:[134]}]},
     {id:408,name:"Karaoké",type:"team",results:[{teamId:17,pos:1,pts:16,playerIds:[76,78]},{teamId:12,pos:2,pts:16,playerIds:[112,113]},{teamId:10,pos:3,pts:16,playerIds:[38,115]},{teamId:22,pos:4,pts:10,playerIds:[69,129]},{teamId:11,pos:5,pts:10,playerIds:[44,122]},{teamId:5,pos:6,pts:10,playerIds:[31,117]},{teamId:15,pos:7,pts:6,playerIds:[66,124]},{teamId:14,pos:8,pts:6,playerIds:[14,18]},{teamId:4,pos:9,pts:6,playerIds:[22,126]}]},
     {id:409,name:"Clash Royal",type:"team",results:[{teamId:12,pos:1,pts:20,playerIds:[50]},{teamId:15,pos:2,pts:16,playerIds:[63]},{teamId:11,pos:3,pts:13,playerIds:[42]},{teamId:17,pos:4,pts:10,playerIds:[62]},{teamId:5,pos:5,pts:10,playerIds:[29]},{teamId:14,pos:6,pts:6,playerIds:[17]},{teamId:10,pos:7,pts:4,playerIds:[128]},{teamId:22,pos:8,pts:2,playerIds:[72]},{teamId:4,pos:9,pts:2,playerIds:[133]}]},
     {id:410,name:"Golf-it 1 2",type:"team",results:[{teamId:12,pos:1,pts:16,playerIds:[52]},{teamId:10,pos:2,pts:13,playerIds:[39]},{teamId:5,pos:3,pts:10,playerIds:[30]},{teamId:4,pos:4,pts:6,playerIds:[21]},{teamId:11,pos:5,pts:4,playerIds:[114]}]},
     {id:411,name:"WII Boxe",type:"team",results:[{teamId:12,pos:1,pts:20,playerIds:[49]},{teamId:4,pos:2,pts:16,playerIds:[136]},{teamId:15,pos:3,pts:13,playerIds:[118]},{teamId:22,pos:4,pts:10,playerIds:[72]},{teamId:10,pos:5,pts:8,playerIds:[120]},{teamId:17,pos:6,pts:6,playerIds:[62]},{teamId:11,pos:7,pts:4,playerIds:[122]},{teamId:14,pos:8,pts:2,playerIds:[18]},{teamId:5,pos:9,pts:1,playerIds:[135]}]},
     {id:412,name:"Just Dance F",type:"team",results:[{teamId:5,pos:1,pts:20,playerIds:[121]},{teamId:11,pos:2,pts:16,playerIds:[43]},{teamId:10,pos:3,pts:13,playerIds:[38]},{teamId:12,pos:4,pts:10,playerIds:[112]},{teamId:17,pos:5,pts:8,playerIds:[76]},{teamId:4,pos:6,pts:6,playerIds:[123]},{teamId:15,pos:7,pts:4,playerIds:[124]},{teamId:22,pos:8,pts:2,playerIds:[129]},{teamId:14,pos:9,pts:1,playerIds:[61]}]},
     {id:413,name:"Minecraft",type:"team",results:[{teamId:11,pos:1,pts:20,playerIds:[114]},{teamId:17,pos:2,pts:16,playerIds:[78]},{teamId:12,pos:3,pts:13,playerIds:[113]},{teamId:15,pos:4,pts:10,playerIds:[66]},{teamId:5,pos:5,pts:8,playerIds:[117]},{teamId:14,pos:6,pts:6,playerIds:[55]},{teamId:10,pos:7,pts:4,playerIds:[128]},{teamId:4,pos:8,pts:2,playerIds:[132]}]},
     {id:414,name:"Stumble Guys",type:"team",results:[{teamId:11,pos:1,pts:20,playerIds:[42,119]},{teamId:5,pos:2,pts:15,playerIds:[29,30]},{teamId:17,pos:3,pts:10,playerIds:[60,79]},{teamId:22,pos:4,pts:10,playerIds:[69,130]},{teamId:15,pos:5,pts:10,playerIds:[63,67]},{teamId:14,pos:6,pts:10,playerIds:[14,59]},{teamId:12,pos:7,pts:10,playerIds:[50,51]},{teamId:10,pos:8,pts:10,playerIds:[125,134]},{teamId:4,pos:9,pts:10,playerIds:[21,126]}]},
     {id:415,name:"Golf-it 2",type:"team",results:[{teamId:17,pos:1,pts:16,playerIds:[116]},{teamId:15,pos:2,pts:13,playerIds:[64]},{teamId:14,pos:3,pts:10,playerIds:[17]},{teamId:22,pos:4,pts:6,playerIds:[104]}]},
     {id:416,name:"Rocket League",type:"team",results:[{teamId:5,pos:1,pts:20,playerIds:[117]},{teamId:22,pos:2,pts:16,playerIds:[69]},{teamId:12,pos:3,pts:13,playerIds:[52]},{teamId:14,pos:4,pts:10,playerIds:[55]},{teamId:10,pos:5,pts:8,playerIds:[128]},{teamId:4,pos:6,pts:6,playerIds:[133]},{teamId:17,pos:7,pts:4,playerIds:[78]},{teamId:15,pos:8,pts:2,playerIds:[118]},{teamId:11,pos:9,pts:1,playerIds:[119]}]},
     {id:417,name:"Overcooked",type:"team",results:[{teamId:12,pos:1,pts:20,playerIds:[49,51]},{teamId:17,pos:2,pts:16,playerIds:[77,116]},{teamId:15,pos:3,pts:13,playerIds:[66,124]},{teamId:14,pos:4,pts:10,playerIds:[14,59]},{teamId:11,pos:5,pts:10,playerIds:[42,43]},{teamId:5,pos:6,pts:10,playerIds:[30,135]},{teamId:22,pos:7,pts:4,playerIds:[129,130]},{teamId:10,pos:8,pts:4,playerIds:[39,120]},{teamId:4,pos:9,pts:4,playerIds:[132,136]}]},
     {id:418,name:"Just Dance H",type:"team",results:[{teamId:5,pos:1,pts:20,playerIds:[29]},{teamId:12,pos:2,pts:16,playerIds:[50]},{teamId:11,pos:3,pts:13,playerIds:[122]},{teamId:15,pos:4,pts:10,playerIds:[64]},{teamId:14,pos:5,pts:8,playerIds:[17]},{teamId:10,pos:6,pts:6,playerIds:[125]},{teamId:17,pos:7,pts:4,playerIds:[62]},{teamId:22,pos:8,pts:2,playerIds:[72]},{teamId:4,pos:9,pts:1,playerIds:[21]}]},
     {id:419,name:"Golf-it 2 2",type:"team",results:[{teamId:5,pos:1,pts:16,playerIds:[31]},{teamId:12,pos:2,pts:13,playerIds:[113]},{teamId:11,pos:3,pts:10,playerIds:[127]},{teamId:4,pos:4,pts:6,playerIds:[131]},{teamId:10,pos:5,pts:4,playerIds:[38]}]}
   ]},
];

const RATINGS = [
  {p:1,e:1,r:1.4098},{p:1,e:2,r:1.1605},{p:2,e:1,r:1.3293},{p:2,e:2,r:1.1758},{p:3,e:1,r:1.2952},{p:3,e:2,r:1.2828},{p:4,e:2,r:1.0},{p:5,e:2,r:1.2517},
  {p:6,e:2,r:1.0967},{p:7,e:1,r:1.583},{p:7,e:2,r:1.3136},{p:8,e:1,r:1.4225},{p:8,e:2,r:1.5184},{p:9,e:1,r:1.2842},{p:9,e:2,r:1.4217},{p:10,e:1,r:1.1353},
  {p:10,e:2,r:1.536},{p:11,e:2,r:1.5448},{p:12,e:2,r:1.4745},{p:13,e:2,r:1.3602},{p:14,e:1,r:1.3067},{p:14,e:2,r:0.9817},{p:14,e:4,r:1.4336},{p:15,e:1,r:1.5187},
  {p:15,e:2,r:1.5272},{p:16,e:1,r:1.6991},{p:16,e:2,r:1.369},{p:17,e:2,r:1.4356},{p:17,e:4,r:1.501},{p:18,e:2,r:1.2548},{p:18,e:4,r:1.265},{p:19,e:2,r:1.3439},
  {p:20,e:2,r:1.2636},{p:21,e:1,r:1.0902},{p:21,e:2,r:1.492},{p:21,e:4,r:1.1983},{p:22,e:1,r:1.3143},{p:22,e:2,r:1.3075},{p:22,e:4,r:1.5132},{p:23,e:2,r:1.4745},
  {p:24,e:2,r:1.2822},{p:25,e:2,r:1.2508},{p:26,e:2,r:1.2299},{p:27,e:2,r:1.197},{p:28,e:2,r:1.0732},{p:29,e:1,r:1.4736},{p:29,e:2,r:1.5884},{p:29,e:4,r:1.6222},
  {p:30,e:1,r:1.6315},{p:30,e:2,r:1.4662},{p:30,e:4,r:1.4067},{p:31,e:1,r:1.3253},{p:31,e:2,r:1.3673},{p:31,e:4,r:1.3817},{p:32,e:1,r:1.2408},{p:32,e:2,r:1.3974},
  {p:33,e:2,r:1.517},{p:34,e:2,r:1.4334},{p:35,e:1,r:1.6315},{p:35,e:2,r:1.1758},{p:36,e:1,r:1.562},{p:36,e:2,r:1.3075},{p:37,e:1,r:1.3293},{p:37,e:2,r:1.2021},
  {p:38,e:2,r:1.1406},{p:38,e:4,r:1.3663},{p:39,e:2,r:1.3152},{p:39,e:4,r:1.3088},{p:40,e:2,r:1.369},{p:41,e:2,r:1.2375},{p:42,e:1,r:1.1986},{p:42,e:2,r:1.1986},
  {p:42,e:4,r:1.501},{p:43,e:1,r:1.0127},{p:43,e:2,r:1.2789},{p:43,e:4,r:1.4483},{p:44,e:1,r:1.1579},{p:44,e:2,r:1.3778},{p:44,e:4,r:1.3769},{p:45,e:1,r:1.1817},
  {p:45,e:2,r:1.209},{p:46,e:1,r:1.181},{p:46,e:2,r:1.3763},{p:47,e:2,r:1.2987},{p:48,e:2,r:1.1845},{p:49,e:2,r:1.7908},{p:49,e:4,r:1.9858},{p:50,e:2,r:1.4745},
  {p:50,e:4,r:1.7434},{p:51,e:2,r:1.4127},{p:51,e:4,r:1.5818},{p:52,e:2,r:1.3427},{p:52,e:4,r:1.565},{p:53,e:2,r:1.483},{p:54,e:2,r:1.4815},{p:55,e:1,r:1.447},
  {p:55,e:2,r:1.5017},{p:55,e:4,r:1.315},{p:56,e:1,r:1.6766},{p:56,e:2,r:1.4076},{p:57,e:1,r:1.6315},{p:57,e:2,r:1.1463},{p:58,e:1,r:1.4736},{p:58,e:2,r:1.2021},
  {p:59,e:2,r:1.536},{p:59,e:4,r:1.5817},{p:60,e:2,r:1.5749},{p:60,e:4,r:1.4317},{p:61,e:2,r:1.2636},{p:61,e:4,r:1.415},{p:62,e:2,r:1.3677},{p:62,e:4,r:1.2483},
  {p:63,e:1,r:1.2113},{p:63,e:2,r:1.1669},{p:63,e:4,r:1.6817},{p:64,e:1,r:1.2662},{p:64,e:2,r:1.1987},{p:64,e:4,r:1.5683},{p:65,e:1,r:1.2721},{p:65,e:2,r:1.3339},
  {p:66,e:2,r:1.1933},{p:66,e:4,r:1.5144},{p:67,e:2,r:1.102},{p:67,e:4,r:1.315},{p:68,e:2,r:1.1376},{p:69,e:1,r:1.0972},{p:69,e:2,r:1.0611},{p:69,e:4,r:1.501},
  {p:70,e:1,r:1.1563},{p:70,e:2,r:1.1777},{p:71,e:1,r:1.3676},{p:71,e:2,r:1.1757},{p:72,e:2,r:1.1568},{p:72,e:4,r:1.1104},{p:73,e:2,r:1.2109},{p:74,e:2,r:1.1669},
  {p:75,e:2,r:1.0967},{p:76,e:1,r:1.447},{p:76,e:2,r:1.6271},{p:76,e:4,r:1.5317},{p:77,e:1,r:1.6211},{p:77,e:2,r:1.4745},{p:77,e:4,r:1.4677},{p:78,e:1,r:1.4352},
  {p:78,e:2,r:1.413},{p:78,e:4,r:1.4471},{p:79,e:2,r:1.6326},{p:79,e:4,r:1.3315},{p:80,e:2,r:1.6898},{p:81,e:2,r:1.6853},{p:82,e:2,r:1.3414},{p:83,e:2,r:1.3152},
  {p:84,e:1,r:1.3067},{p:85,e:1,r:1.2476},{p:86,e:1,r:1.5429},{p:87,e:1,r:1.4225},{p:88,e:1,r:1.2721},{p:89,e:1,r:1.4962},{p:90,e:1,r:1.1488},{p:91,e:1,r:1.6211},
  {p:92,e:1,r:1.5366},{p:93,e:1,r:1.5322},{p:94,e:1,r:1.3803},{p:95,e:1,r:1.2662},{p:96,e:1,r:1.1268},{p:97,e:1,r:1.1166},{p:98,e:1,r:1.0718},{p:99,e:1,r:1.0718},
  {p:100,e:1,r:1.1563},{p:101,e:1,r:1.0718},{p:102,e:1,r:1.1804},{p:103,e:1,r:1.6095},{p:104,e:1,r:1.1817},{p:104,e:4,r:1.2817},{p:105,e:1,r:1.2255},{p:106,e:1,r:1.1817},
  {p:107,e:1,r:1.0583},{p:108,e:1,r:1.654},{p:109,e:1,r:1.5915},{p:110,e:1,r:1.3744},{p:111,e:1,r:1.2616},{p:112,e:4,r:1.615},{p:113,e:4,r:1.615},{p:114,e:4,r:1.5817},
  {p:115,e:4,r:1.5813},{p:116,e:4,r:1.5548},{p:117,e:4,r:1.5483},{p:118,e:4,r:1.4983},{p:119,e:4,r:1.4317},{p:120,e:4,r:1.3817},{p:121,e:4,r:1.365},{p:122,e:4,r:1.365},
  {p:123,e:4,r:1.3542},{p:124,e:4,r:1.2983},{p:125,e:4,r:1.2817},{p:126,e:4,r:1.2483},{p:127,e:4,r:1.215},{p:128,e:4,r:1.2047},{p:129,e:4,r:1.2047},{p:130,e:4,r:1.2047},
  {p:131,e:4,r:1.1499},{p:132,e:4,r:1.1483},{p:133,e:4,r:1.115},{p:134,e:4,r:1.115},{p:135,e:4,r:1.1104},{p:136,e:4,r:1.2817},
  {p:78,e:3,r:1.1},
  {p:72,e:3,r:1.1},
  {p:148,e:3,r:1.1},
  {p:71,e:3,r:1.14},
  {p:43,e:3,r:1.14},
  {p:80,e:3,r:1.17},
  {p:99,e:3,r:1.17},
  {p:52,e:3,r:1.2},
  {p:50,e:3,r:1.2},
  {p:56,e:3,r:1.2},
  {p:3,e:3,r:1.24},
  {p:59,e:3,r:1.24},
  {p:61,e:3,r:1.24},
  {p:69,e:3,r:1.29},
  {p:109,e:3,r:1.29},
  {p:42,e:3,r:1.29},
  {p:60,e:3,r:1.29},
  {p:26,e:3,r:1.29},
  {p:79,e:3,r:1.34},
  {p:22,e:3,r:1.34},
  {p:17,e:3,r:1.34},
  {p:18,e:3,r:1.34},
  {p:150,e:3,r:1.34},
  {p:68,e:3,r:1.39},
  {p:124,e:3,r:1.39},
  {p:29,e:3,r:1.39},
  {p:76,e:3,r:1.44},
  {p:120,e:3,r:1.44},
  {p:30,e:3,r:1.44},
  {p:27,e:3,r:1.44},
  {p:15,e:3,r:1.5},
  {p:10,e:3,r:1.5},
  {p:86,e:3,r:1.5},
  {p:153,e:3,r:1.5},
  {p:2,e:3,r:1.57},
  {p:39,e:3,r:1.57},
  {p:37,e:3,r:1.62},
  {p:66,e:3,r:1.62},
  {p:138,e:3,r:1.67},
  {p:63,e:3,r:1.67},
  {p:154,e:3,r:1.67},
  {p:121,e:3,r:1.67},
  {p:28,e:3,r:1.72},
  {p:25,e:3,r:1.72},
  {p:65,e:3,r:1.72},
  {p:64,e:3,r:1.72},
  {p:94,e:3,r:1.72},
  {p:38,e:3,r:1.78},
  {p:77,e:3,r:1.78},
  {p:67,e:3,r:1.84},
  {p:44,e:3,r:1.84},
  {p:49,e:3,r:1.84},
  {p:152,e:3,r:1.84},
  {p:91,e:3,r:1.91},
  {p:125,e:3,r:1.91},
  {p:140,e:3,r:1.96},
  {p:117,e:3,r:1.99}
];

const TEAM_RATINGS = [
  // À remplir manuellement — ratings équipes par édition
];

const MEDALS = ["🥇","🥈","🥉"];
const TEAM_EVENTS = EVENTS.filter(e=>e.type!=="squidgame");
// Team rating: rank-based, scale-independent, always 1-2
// For each epreuve: score = (nTeams - rank) / (nTeams - 1) → 1.0 = 1st, 0.0 = last
// Includes old team ids (rebrands), consistency bonus +2% per extra edition
function getTeamEventRating(teamIds, ev){
  const ids=Array.isArray(teamIds)?teamIds:[teamIds];
  if(!ev.epreuves||ev.epreuves.length===0)return null;
  const scores=[];
  (ev.epreuves||[]).forEach(ep=>{
    const results=ep.results||[];
    if(results.length<2)return;
    const r=results.find(r=>ids.includes(r.teamId));
    if(!r)return;
    const nTeams=results.length;
    scores.push((nTeams-r.pos)/(nTeams-1));
  });
  if(scores.length===0)return null;
  return 1+scores.reduce((s,v)=>s+v,0)/scores.length;
}
function getTeamAllIds(teamId){
  // Include old dissolved team ids (rebrands)
  const oldTeam=TEAMS.find(t=>t.dissolvedName&&TEAMS.find(t2=>t2.id===teamId&&t2.oldName===t.dissolvedName));
  return oldTeam?[teamId,oldTeam.id]:[teamId];
}
function getTeamAvgRating(teamId, eids=null){
  const ids=getTeamAllIds(teamId);
  const evs=TEAM_EVENTS.filter(ev=>(!eids||eids.includes(ev.id))&&(ev.epreuves||[]).length>0);
  const ratings=evs.map(ev=>getTeamEventRating(ids,ev)).filter(Boolean);
  if(ratings.length===0)return null;
  const base=ratings.reduce((s,r)=>s+r,0)/ratings.length;
  // Consistency bonus: +2% per extra edition participated (capped at +6%)
  const bonus=Math.min(0.06,0.02*(ratings.length-1));
  return base*(1+bonus);
}
function getPlayerPodiums(pid,eids=null){
  const pods=[];
  EVENTS.forEach(ev=>{
    if(eids&&!eids.includes(ev.id))return;
    (ev.epreuves||[]).forEach(ep=>{
      (ep.results||[]).forEach(r=>{
        if((r.playerIds||[]).includes(pid))pods.push({pos:r.pos,eid:ev.id});
      });
    });
  });
  return pods;
}
function getPlayerMedals(pid,eids=null){
  const pods=getPlayerPodiums(pid,eids);
  const gold=pods.filter(p=>p.pos===1).length;
  const silver=pods.filter(p=>p.pos===2).length;
  const bronze=pods.filter(p=>p.pos===3).length;
  return{gold,silver,bronze,total:gold+silver+bronze};
}
function getPlayerEpreuveCount(pid,eids=null){
  let count=0;
  EVENTS.forEach(ev=>{
    if(eids&&!eids.includes(ev.id))return;
    (ev.epreuves||[]).forEach(ep=>{
      if((ep.results||[]).some(r=>(r.playerIds||[]).includes(pid)))count++;
    });
  });
  return count;
}
function getPodiumPct(pid,eids=null){
  const total=getPlayerEpreuveCount(pid,eids);
  if(!total)return 0;
  const m=getPlayerMedals(pid,eids);
  return Math.round(((m.gold+m.silver+m.bronze)/total)*100);
}

// ─── HELPERS ─────────────────────────────────────────
function getTeam(id){ return TEAMS.find(t=>t.id===id); }
function getPlayer(id){ return PLAYERS.find(p=>p.id===id); }
function getEvent(id){ return EVENTS.find(e=>e.id===id); }
function getETC(type){ return type==="olympiades"?"#E8B84B":type==="jv"?"#818cf8":"#e84d4d"; }
function getEventRanking(ev){
  const pts={};
  (ev.epreuves||[]).forEach(ep=>(ep.results||[]).forEach(r=>{pts[r.teamId]=(pts[r.teamId]||0)+r.pts;}));
  return Object.entries(pts).map(([tid,p])=>({teamId:Number(tid),pts:p})).sort((a,b)=>b.pts-a.pts);
}
function getAvgRating(pid,eids=null){
  const rs=RATINGS.filter(r=>r.p===pid&&(!eids||eids.includes(r.e)));
  return rs.length?rs.reduce((s,r)=>s+r.r,0)/rs.length:null;
}

function getTeamPts(tid,ev){
  return(ev.epreuves||[]).reduce((s,ep)=>{const r=(ep.results||[]).find(r=>r.teamId===tid);return s+(r?r.pts:0);},0);
}
function isActivePlayer(p){ return !!(p.t25||p.teo||p.t26); }
function getCurrentTeam(p){ return getTeam(p.t26||p.teo||p.t25||null); }
function getTeamAtEvent(p,evId){
  if(evId===1) return getTeam(p.t24||null);
  if(evId===2) return getTeam(p.t25||null);
  if(evId===3) return getTeam(p.t25||p.t24||null);
  if(evId===4) return getTeam(p.teo||null);
  return getCurrentTeam(p);
}

// ─── SMALL COMPONENTS ────────────────────────────────
function Badge({children,color}){
  return(
    <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",background:color+"22",color,border:`1px solid ${color}44`}}>{children}</span>
  );
}
function RatingBar({value}){
  const pct=Math.round(((value-1)/1)*100);
  const color=value>=1.8?"#E8B84B":value>=1.6?"#34d399":value>=1.4?"#60a5fa":"#6b7280";
  return(
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{flex:1,height:3,background:"#1e1e30",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:2}}/>
      </div>
      <span style={{fontSize:13,fontWeight:600,color,minWidth:34}}>{value.toFixed(2)}</span>
    </div>
  );
}
function BackBtn({label="Retour",onClick}){
  return(
    <button onClick={onClick} style={{background:"none",border:"none",cursor:"pointer",color:"#60607a",fontSize:12,display:"flex",alignItems:"center",gap:5,marginBottom:16,fontFamily:"'Outfit',sans-serif"}} onMouseEnter={e=>e.currentTarget.style.color="#eeeef5"} onMouseLeave={e=>e.currentTarget.style.color="#60607a"}>← {label}</button>
  );
}
function ColorDot({teamId,size=8}){
  const t=getTeam(teamId);
  if(!t)return null;
  return <span style={{width:size,height:size,borderRadius:"50%",background:t.color,display:"inline-block",flexShrink:0}}/>;
}

// ─── NAVBAR ──────────────────────────────────────────
function NavBar({page,setPage}){
  const m=useIsMobile();
  const items=[
    {id:"home",l:"Accueil",ic:"🏠"},
    {id:"events",l:"Événements",ic:"📅"},
    {id:"rankings",l:"Classements",ic:"🏆"},
    {id:"teams",l:"Équipes",ic:"⚡"},
    {id:"admin",l:"Data",ic:"📊"},
  ];
  const map={home:"home",events:"events",eventDetail:"events",rankings:"rankings",playerDetail:"rankings",teams:"teams",teamDetail:"teams",admin:"admin"};
  if(m){
    return(
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"#0d0d1c",borderTop:"1px solid #1e1e30",display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {items.map(({id,l,ic})=>{
          const a=map[page]===id;
          return(
            <button key={id} onClick={()=>setPage(id)} style={{flex:1,background:"none",border:"none",cursor:"pointer",padding:"10px 4px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,color:a?"#E8B84B":"#60607a",fontFamily:"'Outfit',sans-serif"}}>
              <span style={{fontSize:18}}>{ic}</span>
              <span style={{fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</span>
            </button>
          );
        })}
      </nav>
    );
  }
  return(
    <nav style={{background:"#0d0d1c",borderBottom:"1px solid #1e1e30",padding:"0 32px",display:"flex",alignItems:"center",gap:0,position:"sticky",top:0,zIndex:100}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#E8B84B",marginRight:32,letterSpacing:"0.05em",padding:"14px 0"}}>UTOPIA</div>
      {items.map(({id,l})=>{
        const a=map[page]===id;
        return(
          <button key={id} onClick={()=>setPage(id)} style={{background:"none",border:"none",cursor:"pointer",padding:"16px 14px",fontSize:13,fontWeight:500,fontFamily:"'Outfit',sans-serif",color:a?"#E8B84B":"#60607a",borderBottom:a?"2px solid #E8B84B":"2px solid transparent",transition:"all .15s"}} onMouseEnter={e=>{if(!a)e.currentTarget.style.color="#cccce0";}} onMouseLeave={e=>{if(!a)e.currentTarget.style.color="#60607a";}}>{l}</button>
        );
      })}
    </nav>
  );
}

// ─── COUNTDOWN ───────────────────────────────────────
function Countdown(){
  function calc(){
    const t=new Date("2026-06-14T10:00:00")-new Date();
    if(t<=0)return{d:0,h:0,mn:0,s:0};
    return{d:Math.floor(t/86400000),h:Math.floor((t%86400000)/3600000),mn:Math.floor((t%3600000)/60000),s:Math.floor((t%60000)/1000)};
  }
  const [diff,setDiff]=useState(calc());
  useEffect(()=>{const iv=setInterval(()=>setDiff(calc()),1000);return()=>clearInterval(iv);},[]);
  return(
    <div style={{display:"flex",gap:12,marginTop:16}}>
      {[{v:diff.d,l:"Jours"},{v:diff.h,l:"Heures"},{v:diff.mn,l:"Min"},{v:diff.s,l:"Sec"}].map(({v,l})=>(
        <div key={l} style={{textAlign:"center",background:"#13131f",borderRadius:8,padding:"10px 14px",minWidth:60}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:"#E8B84B",lineHeight:1}}>{String(v).padStart(2,"0")}</div>
          <div style={{fontSize:9,color:"#60607a",textTransform:"uppercase",letterSpacing:"0.08em",marginTop:3}}>{l}</div>
        </div>
      ))}
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────
function HomePage({nav}){
  const m=useIsMobile();
  const ac="#E8B84B";
  const G={background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:12,padding:m?14:20};

  // Top 5 ratings all time
  const top5Players=PLAYERS
    .map(p=>{const c=RATINGS.filter(r=>r.p===p.id).length;if(c<2)return null;const avg=getAvgRating(p.id);if(!avg)return null;return{player:p,team:getCurrentTeam(p),avg};})
    .filter(Boolean).sort((a,b)=>b.avg-a.avg).slice(0,5);

  const top5Teams=TEAMS.filter(t=>t.active)
    .map(t=>{const avg=getTeamAvgRating(t.id);if(!avg)return null;return{team:t,avg};})
    .filter(Boolean).sort((a,b)=>b.avg-a.avg).slice(0,5);

  // Joueur & équipe du jour (seed = day of year)
  const dayIdx=Math.floor(Date.now()/86400000);
  const jdd=top5Players.length?top5Players[dayIdx%Math.min(top5Players.length,10)]:null;
  const activeTeams=TEAMS.filter(t=>t.active);
  const edd=activeTeams[dayIdx%activeTeams.length];

  // Dernier événement
  const lastEv=TEAM_EVENTS[TEAM_EVENTS.length-1];
  const lastRank=lastEv?getEventRanking(lastEv):[];
  const lastRatings=lastEv?RATINGS.filter(r=>r.e===lastEv.id).sort((a,b)=>b.r-a.r).slice(0,3):[];
  const lastAc=lastEv?getETC(lastEv.type):"#E8B84B";

  return(
    <div style={{padding:m?"14px 14px 76px":"40px 32px",maxWidth:1100,margin:"0 auto"}} className="fade">
      <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?42:64,letterSpacing:"0.04em",lineHeight:1,marginBottom:4}}>UTOPIA <span style={{color:"#E8B84B"}}>EVENTS</span></h1>
      <p style={{color:"#60607a",fontSize:m?12:14,marginBottom:m?18:28}}>{EVENTS.length} éditions · {PLAYERS.filter(isActivePlayer).length} joueurs actifs · {TEAMS.filter(t=>t.active).length} équipes</p>

      {/* Countdown + Prochain */}
      <div style={{...G,marginBottom:m?12:18}}>
        <div style={{fontSize:10,color:"#60607a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>⏳ Prochain — 14 Juin 2026 · Olympiades Été</div>
        <Countdown/>
      </div>

      {/* Top 5 ratings côte à côte */}
      <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:m?12:18,marginBottom:m?12:18}}>
        {/* Top 5 joueurs */}
        <div style={{...G}}>
          <div style={{fontSize:10,color:"#60607a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>🏆 Top 5 joueurs — All time</div>
          {top5Players.map((r,i)=>(
            <div key={r.player.id} onClick={()=>nav("playerDetail",{playerId:r.player.id})} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<4?"1px solid #1e1e30":"none",cursor:"pointer",transition:"padding-left .12s"}} onMouseEnter={e=>e.currentTarget.style.paddingLeft="5px"} onMouseLeave={e=>e.currentTarget.style.paddingLeft="0"}>
              <span style={{color:i<3?"#E8B84B":"#60607a",fontFamily:"'Bebas Neue',sans-serif",fontSize:16,width:18}}>{i+1}</span>
              <ColorDot teamId={r.player.teamId} size={7}/>
              <span style={{flex:1,fontWeight:500,fontSize:13}}>{r.player.name}</span>
              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:r.avg>=1.8?"#E8B84B":r.avg>=1.6?"#34d399":"#60a5fa"}}>{r.avg.toFixed(2)}</span>
            </div>
          ))}
        </div>
        {/* Top 5 équipes */}
        <div style={{...G}}>
          <div style={{fontSize:10,color:"#60607a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>🏆 Top 5 équipes — All time</div>
          {top5Teams.length===0?(
            <div style={{color:"#404058",fontSize:12,paddingTop:8}}>Ratings équipes non encore renseignés.</div>
          ):top5Teams.map((r,i)=>(
            <div key={r.team.id} onClick={()=>nav("teamDetail",{teamId:r.team.id})} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<4?"1px solid #1e1e30":"none",cursor:"pointer",transition:"padding-left .12s"}} onMouseEnter={e=>e.currentTarget.style.paddingLeft="5px"} onMouseLeave={e=>e.currentTarget.style.paddingLeft="0"}>
              <span style={{color:i<3?"#E8B84B":"#60607a",fontFamily:"'Bebas Neue',sans-serif",fontSize:16,width:18}}>{i+1}</span>
              <div style={{width:8,height:8,borderRadius:"50%",background:r.team.color}}/>
              <span style={{flex:1,fontWeight:500,fontSize:13}}>{r.team.name}</span>
              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:r.avg>=1.8?"#E8B84B":r.avg>=1.6?"#34d399":"#60a5fa"}}>{r.avg.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Joueur du jour + Équipe du jour */}
      <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:m?12:18,marginBottom:m?12:18}}>
        {jdd&&(()=>{
          const jc=jdd.team?.color||"#E8B84B";
          const jMedals=getPlayerMedals(jdd.player.id);
          const jEpCount=getPlayerEpreuveCount(jdd.player.id);
          const jPct=jEpCount>0?Math.round(((jMedals.gold+jMedals.silver+jMedals.bronze)/jEpCount)*100):0;
          const jEditions=RATINGS.filter(r=>r.p===jdd.player.id).length;
          const jAllRank=PLAYERS.filter(p=>p.teamId).sort((a,b)=>(getAvgRating(b.id)||0)-(getAvgRating(a.id)||0)).findIndex(p=>p.id===jdd.player.id)+1;
          return(
            <div style={{...G,cursor:"pointer",background:`linear-gradient(135deg,${jc}18,#0d0d1c)`,border:`1px solid ${jc}44`}} onClick={()=>nav("playerDetail",{playerId:jdd.player.id})}>
              <div style={{fontSize:10,color:"#60607a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>⚡ Joueur du jour</div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div style={{width:50,height:50,borderRadius:"50%",background:jc+"22",border:`3px solid ${jc}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:jc,flexShrink:0}}>{jdd.player.name.charAt(0)}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?24:30,lineHeight:1}}>{jdd.player.name}</div>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:jdd.team?.color||"#404058"}}/>
                    <span style={{fontSize:11,color:jdd.team?.color||"#60607a"}}>{jdd.team?.name||"Libre"}</span>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?32:38,color:"#E8B84B",lineHeight:1}}>{jdd.avg.toFixed(2)}</div>
                  <div style={{fontSize:9,color:"#60607a"}}>Rang #{jAllRank}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                <div style={{background:"#13131f",borderRadius:7,padding:"7px 9px",textAlign:"center"}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#E8B84B"}}>{jMedals.gold}🥇</div>
                  <div style={{fontSize:9,color:"#60607a",marginTop:1}}>Or</div>
                </div>
                <div style={{background:"#13131f",borderRadius:7,padding:"7px 9px",textAlign:"center"}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:jPct>=50?"#E8B84B":jPct>=33?"#34d399":"#60a5fa"}}>{jPct}%</div>
                  <div style={{fontSize:9,color:"#60607a",marginTop:1}}>% Podium</div>
                </div>
                <div style={{background:"#13131f",borderRadius:7,padding:"7px 9px",textAlign:"center"}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:jc}}>{jEditions}</div>
                  <div style={{fontSize:9,color:"#60607a",marginTop:1}}>Éditions</div>
                </div>
              </div>
            </div>
          );
        })()}
        {edd&&(()=>{
          const ec=edd.color;
          const eddAvg=getTeamAvgRating(edd.id);
          const eddRank=TEAMS.filter(t=>t.active).sort((a,b)=>(getTeamAvgRating(b.id)||0)-(getTeamAvgRating(a.id)||0)).findIndex(t=>t.id===edd.id)+1;
          const eddEvs=TEAM_EVENTS.filter(ev=>(ev.epreuves||[]).length>0&&getTeamEventRating(getTeamAllIds(edd.id),ev)!=null);
          const lastEddEv=eddEvs[eddEvs.length-1];
          const lastEddRank=lastEddEv?getEventRanking(lastEddEv):[];
          const lastEddPos=lastEddRank.findIndex(r=>getTeamAllIds(edd.id).includes(r.teamId))+1;
          const cap=PLAYERS.find(p=>p.t26===edd.id&&p.t26cap);
          const roster=PLAYERS.filter(p=>p.t26===edd.id);
          return(
            <div style={{...G,cursor:"pointer",background:`linear-gradient(135deg,${ec}18,#0d0d1c)`,border:`1px solid ${ec}44`}} onClick={()=>nav("teamDetail",{teamId:edd.id})}>
              <div style={{fontSize:10,color:"#60607a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>⚡ Équipe du jour</div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div style={{width:50,height:50,borderRadius:"50%",background:ec+"22",border:`3px solid ${ec}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:ec,flexShrink:0}}>{edd.name.charAt(0)}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?22:28,lineHeight:1,background:`linear-gradient(90deg,${ec} 40%,${edd.color2||ec})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{edd.name}</div>
                  {cap&&<div style={{fontSize:11,color:"#E8B84B",marginTop:3}}>© {cap.name}</div>}
                </div>
                <div style={{textAlign:"right"}}>
                  {eddAvg&&<><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?32:38,color:eddAvg>=1.8?"#E8B84B":eddAvg>=1.6?"#34d399":"#60a5fa",lineHeight:1}}>{eddAvg.toFixed(2)}</div><div style={{fontSize:9,color:"#60607a"}}>Rang #{eddRank}</div></>}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
                <div style={{background:"#13131f",borderRadius:7,padding:"7px 9px",textAlign:"center"}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:ec}}>{roster.length}</div>
                  <div style={{fontSize:9,color:"#60607a",marginTop:1}}>Joueurs</div>
                </div>
                <div style={{background:"#13131f",borderRadius:7,padding:"7px 9px",textAlign:"center"}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:ec}}>{eddEvs.length}</div>
                  <div style={{fontSize:9,color:"#60607a",marginTop:1}}>Éditions</div>
                </div>
                <div style={{background:"#13131f",borderRadius:7,padding:"7px 9px",textAlign:"center"}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:lastEddPos===1?"#E8B84B":lastEddPos<=3?"#34d399":ec}}>{lastEddPos>0?MEDALS[lastEddPos-1]||lastEddPos+"e":"—"}</div>
                  <div style={{fontSize:9,color:"#60607a",marginTop:1}}>Dernier résultat</div>
                </div>
              </div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {roster.slice(0,6).map(p=>(
                  <span key={p.id} style={{background:ec+"18",border:`1px solid ${p.t26cap?"#E8B84B":ec}33`,borderRadius:5,padding:"2px 7px",fontSize:10,color:p.t26cap?"#E8B84B":ec}}>{p.name}</span>
                ))}
                {roster.length>6&&<span style={{fontSize:10,color:"#404058",padding:"2px 4px"}}>+{roster.length-6}</span>}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Dernier événement — pleine largeur */}
      {lastEv&&(
        <div style={{...G,border:`1px solid ${lastAc}33`,marginBottom:m?12:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <Badge color={lastAc}>{lastEv.typeLabel}</Badge>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?22:28,marginTop:4}}>{lastEv.name} <span style={{color:lastAc}}>{lastEv.edition}</span></div>
            </div>
            <button onClick={()=>nav("eventDetail",{eventId:lastEv.id})} style={{background:lastAc,color:"#080810",border:"none",borderRadius:8,padding:"7px 14px",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer"}}>Voir →</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:m?10:16}}>
            {/* Top 3 joueurs ratings */}
            <div>
              <div style={{fontSize:10,color:"#60607a",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Top ratings joueurs</div>
              {lastRatings.map((r,i)=>{
                const p=getPlayer(r.p);
                const ct=p?getTeamAtEvent(p,lastEv?.id):null;
                return(
                  <div key={r.p} onClick={()=>nav("playerDetail",{playerId:r.p})} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 0",borderBottom:i<2?"1px solid #1e1e30":"none",cursor:"pointer"}}>
                    <span style={{fontSize:16}}>{MEDALS[i]}</span>
                    <ColorDot teamId={ct?.id} size={6}/>
                    <span style={{flex:1,fontSize:13,fontWeight:500}}>{p?.name}</span>
                    <span style={{fontSize:13,fontWeight:700,color:r.r>=1.8?"#E8B84B":r.r>=1.6?"#34d399":"#60a5fa"}}>{r.r.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            {/* Top 3 équipes points */}
            <div>
              <div style={{fontSize:10,color:"#60607a",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Top équipes points</div>
              {lastRank.slice(0,3).map((r,i)=>{
                const t=getTeam(r.teamId);
                if(!t)return null;
                return(
                  <div key={r.teamId} onClick={()=>nav("teamDetail",{teamId:r.teamId})} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 0",borderBottom:i<2?"1px solid #1e1e30":"none",cursor:"pointer"}}>
                    <span style={{fontSize:16}}>{MEDALS[i]}</span>
                    <div style={{width:3,height:20,background:t.color,borderRadius:2}}/>
                    <span style={{flex:1,fontSize:13,fontWeight:500}}>{t.name}</span>
                    <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:lastAc}}>{r.pts}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tous les événements */}
      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,color:"#60607a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>📅 Toutes les éditions</div>
        <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":`repeat(${EVENTS.length},1fr)`,gap:m?8:12}}>
          {EVENTS.map(ev=>{
            const evAc=getETC(ev.type);
            const wt=ev.winner?getTeam(ev.winner):null;
            return(
              <div key={ev.id} onClick={()=>nav("eventDetail",{eventId:ev.id})} style={{background:"#0d0d1c",border:`1px solid ${evAc}33`,borderRadius:10,padding:"12px 14px",cursor:"pointer",transition:"transform .2s,border-color .2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor=evAc+"77";}} onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.borderColor=evAc+"33";}}>
                <div style={{height:3,background:evAc,borderRadius:2,marginBottom:8}}/>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?18:20,lineHeight:1}}>{ev.name}</div>
                <div style={{color:evAc,fontFamily:"'Bebas Neue',sans-serif",fontSize:14}}>{ev.edition}</div>
                {wt&&<div style={{display:"flex",alignItems:"center",gap:4,marginTop:6}}><span style={{fontSize:12}}>🏆</span><span style={{fontSize:11,color:wt.color,fontWeight:600}}>{wt.dissolvedName||wt.name}</span></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventsPage({nav}){
  const m=useIsMobile();
  return(
    <div style={{padding:m?"14px 14px 76px":"40px 32px",maxWidth:1100,margin:"0 auto"}} className="fade">
      <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?36:52,letterSpacing:"0.05em",marginBottom:m?16:28}}>TOUS LES <span style={{color:"#E8B84B"}}>ÉVÉNEMENTS</span></h1>
      <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:m?12:18}}>
        {EVENTS.map(ev=>{
          const ranking=getEventRanking(ev);
          const ac=getETC(ev.type);
          const wP=ev.winnerPlayer?getPlayer(ev.winnerPlayer):null;
          return(
            <div key={ev.id} onClick={()=>nav("eventDetail",{eventId:ev.id})} style={{background:"#0d0d1c",border:`1px solid ${ac}33`,borderRadius:12,overflow:"hidden",cursor:"pointer",transition:"transform .2s,border-color .2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor=ac+"77";}} onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.borderColor=ac+"33";}}>
              <div style={{height:4,background:`linear-gradient(90deg,${ac},${ac}44)`}}/>
              <div style={{padding:m?14:22}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div><Badge color={ac}>{ev.typeLabel}</Badge><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?28:34,marginTop:8,lineHeight:1}}>{ev.name}</div><div style={{color:ac,fontFamily:"'Bebas Neue',sans-serif",fontSize:18}}>{ev.edition}</div></div>
                  <div style={{textAlign:"right",color:"#60607a",fontSize:11,lineHeight:1.8}}><div>{ev.date}</div><div>{ev.participants} p.</div></div>
                </div>
                <p style={{color:"#60607a",fontSize:12,lineHeight:1.6,marginBottom:14}}>{ev.description}</p>
                {ev.type!=="squidgame"?(
                  <div style={{display:"flex",gap:6}}>
                    {ranking.slice(0,3).map((r,i)=>{
                      const t=getTeam(r.teamId);
                      if(!t) return null;
                      return(
                        <div key={r.teamId} style={{flex:1,background:"#13131f",borderRadius:8,padding:"7px 10px",display:"flex",alignItems:"center",gap:5}}>
                          <span style={{fontSize:13}}>{MEDALS[i]}</span>
                          <div style={{width:3,height:16,background:t.color,borderRadius:2}}/>
                          <div>
                            <div style={{fontSize:11,fontWeight:600}}>{t.name}</div>
                            <div style={{fontSize:10,color:"#60607a"}}>{r.pts} pts</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ):wP&&(
                  <div style={{background:"#13131f",borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",gap:7}}>
                    <span>👑</span>
                    <div><div style={{fontSize:12,fontWeight:600}}>{wP.name}</div><div style={{fontSize:10,color:"#60607a"}}>Vainqueur</div></div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── EPREUVE CARD ────────────────────────────────────
function EpreuveCard({ep,ac,nav}){
  const [open,setOpen]=useState(false);
  const top3=(ep.results||[]).slice(0,3);
  return(
    <div style={{background:"#0d0d1c",border:`1px solid ${open?ac+"55":"#1e1e30"}`,borderRadius:10,overflow:"hidden",transition:"border-color .2s"}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:8,padding:"11px 14px",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#13131f"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <span style={{fontWeight:600,fontSize:13,flex:1}}>{ep.name}</span>
        {!open&&top3.map((r,i)=>{
          const t=getTeam(r.teamId);
          return(
            <div key={r.teamId} style={{display:"flex",alignItems:"center",gap:3}}>
              <span style={{fontSize:11}}>{MEDALS[i]}</span>
              {t&&<div style={{width:6,height:6,borderRadius:"50%",background:t.color}}/>}
            </div>
          );
        })}
        <span style={{fontSize:10,color:"#404058",transition:"transform .2s",display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
      </div>
      {open&&(
        <div style={{borderTop:"1px solid #1e1e30",paddingBottom:10}}>
          {(ep.results||[]).map((r,i)=>{
            const t=getTeam(r.teamId);
            const pids=r.playerIds||[];
            const isTop=i<3;
            const rowBg=i===0?"#1c1708":i%2===0?"#0d0d1c":"#0a0a14";
            return(
              <div key={r.teamId} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 14px",background:rowBg,borderBottom:"1px solid #1a1a28"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,minWidth:120,flexShrink:0}}>
                  <span style={{fontSize:14,width:20,textAlign:"center"}}>{i<3?MEDALS[i]:<span style={{fontSize:11,color:"#60607a"}}>{i+1}</span>}</span>
                  {t&&<div style={{width:3,height:28,background:t.color,borderRadius:2}}/>}
                  {t&&<span onClick={()=>nav("teamDetail",{teamId:r.teamId})} style={{fontWeight:600,fontSize:12,cursor:"pointer",color:isTop?t.color:"#eeeef5"}} onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"} onMouseLeave={e=>e.currentTarget.style.textDecoration="none"}>{t.dissolvedName||t.name}</span>}
                </div>
                <div style={{flex:1,display:"flex",flexWrap:"wrap",gap:4}}>
                  {pids.map(pid=>{
                    const p=getPlayer(pid);
                    return(
                      <span key={pid} onClick={()=>nav("playerDetail",{playerId:pid})} style={{background:"#13131f",border:`1px solid ${t?.color||"#888"}33`,borderRadius:5,padding:"2px 7px",fontSize:11,cursor:"pointer",color:"#cccce0"}} onMouseEnter={e=>{e.currentTarget.style.color=t?.color||"#fff";}} onMouseLeave={e=>{e.currentTarget.style.color="#cccce0";}}>
                        {p?.name||"?"}
                      </span>
                    );
                  })}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:isTop?ac:"#60607a",lineHeight:1}}>{r.pts}</div>
                  <div style={{fontSize:9,color:"#404058"}}>pts</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── RANK ROW ─────────────────────────────────────────
function RankRow({t,i,r,ac,ev,nav}){
  const [open,setOpen]=useState(false);
  // Players who participated in this event for this team
  const roster=PLAYERS.filter(p=>{
    const teamKey=['t24','t25','teo'].find(k=>p[k]===t.id);
    if(!teamKey)return false;
    // Check if player appears in any epreuve playerIds for this event
    return(ev.epreuves||[]).some(ep=>(ep.results||[]).some(res=>res.teamId===t.id&&(res.playerIds||[]).includes(p.id)));
  });
  return(
    <div style={{marginBottom:6}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:i===0?"#1c1708":"#0d0d1c",border:i===0?`1px solid #E8B84B44`:`1px solid ${open?t.color+"44":"#1e1e30"}`,borderRadius:open?"8px 8px 0 0":8,cursor:"pointer",transition:"border-color .15s"}}>
        <span style={{width:20,textAlign:"center",fontSize:13}}>{MEDALS[i]||`${i+1}`}</span>
        <div style={{width:3,height:20,background:t.color,borderRadius:2}}/>
        <span style={{flex:1,fontWeight:500,fontSize:13}}>{t.name}</span>
        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:ac,marginRight:6}}>{r.pts}</span>
        <span style={{fontSize:10,color:"#404058",transition:"transform .2s",display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
      </div>
      {open&&(
        <div style={{background:"#13131f",border:`1px solid ${t.color}44`,borderTop:"none",borderRadius:"0 0 8px 8px",padding:"10px 12px",display:"flex",flexWrap:"wrap",gap:6}}>
          {roster.length===0?(
            <span style={{fontSize:11,color:"#404058"}}>Roster non disponible pour cette édition.</span>
          ):roster.map(p=>(
            <span key={p.id} onClick={e=>{e.stopPropagation();nav("playerDetail",{playerId:p.id});}} style={{background:t.color+"18",border:`1px solid ${t.color}44`,borderRadius:6,padding:"3px 9px",fontSize:11,color:"#eeeef5",cursor:"pointer",transition:"background .12s"}} onMouseEnter={e=>e.currentTarget.style.background=t.color+"33"} onMouseLeave={e=>e.currentTarget.style.background=t.color+"18"}>
              {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SQUID GAME DETAIL ───────────────────────────────
function SquidGameDetailPage({ev,nav}){
  const m=useIsMobile();
  const ac="#E84D9B";
  const winner=ev.winnerPlayer?getPlayer(ev.winnerPlayer):null;
  const sqRatings=RATINGS.filter(r=>r.e===ev.id).sort((a,b)=>b.r-a.r);
  const totalP=sqRatings.length;

  return(
    <div style={{padding:m?"14px 14px 76px":"40px 32px",maxWidth:1200,margin:"0 auto"}} className="fade">
      <BackBtn label="Événements" onClick={()=>nav("events")}/>
      <div style={{height:4,background:`linear-gradient(90deg,${ac},${ac}44)`,borderRadius:2,marginBottom:18}}/>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:22}}>
        <div>
          <Badge color={ac}>Squid Game</Badge>
          <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?36:52,lineHeight:1,marginTop:8}}>
            {ev.name} <span style={{color:ac}}>{ev.edition}</span>
          </h1>
          <p style={{color:"#60607a",marginTop:6,fontSize:13}}>{ev.description}</p>
        </div>
        <div style={{textAlign:"right",color:"#60607a",fontSize:12,lineHeight:2}}>
          <div>{ev.date}</div>
          <div>{totalP} participants</div>
        </div>
      </div>

      {/* Winner banner */}
      {winner&&(
        <div style={{background:"linear-gradient(135deg,#1c1708,#13131f)",border:"1px solid #E8B84B55",borderRadius:12,padding:"14px 20px",marginBottom:22,display:"flex",alignItems:"center",gap:14,cursor:"pointer"}} onClick={()=>nav("playerDetail",{playerId:winner.id})}>
          <span style={{fontSize:32}}>👑</span>
          <div>
            <div style={{fontSize:10,color:"#E8B84B",textTransform:"uppercase",letterSpacing:"0.1em"}}>Vainqueur</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,lineHeight:1}}>{winner.name}</div>
          </div>
          <div style={{marginLeft:"auto",fontFamily:"'Bebas Neue',sans-serif",fontSize:36,color:"#E8B84B"}}>1.99</div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1.2fr 0.8fr",gap:m?14:20,alignItems:"start"}}>
        {/* Left: jeux */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#60607a",marginBottom:4}}>LES JEUX</div>
          {(ev.epreuves||[]).map((ep,idx)=>{
            const isLetters=ep.type==="squid_letters";
            const allElim=(ep.rounds||[]).flatMap(r=>r.e||[]);
            return(
              <div key={ep.id} style={{background:isLetters?"#0e0a0d":"#0d0d1c",border:`1px solid ${isLetters?"#E8B84B33":"#1e1e30"}`,borderRadius:10,padding:"12px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:allElim.length>0||(ep.rounds||[]).some(r=>r.w)?8:0}}>
                  {!isLetters&&<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:ac,minWidth:18}}>{idx+1}</div>}
                  {isLetters&&<span style={{fontSize:14}}>✉️</span>}
                  <div style={{fontWeight:600,fontSize:13,flex:1}}>{ep.name}</div>
                  {!isLetters&&<div style={{fontSize:11,color:"#60607a"}}>{allElim.length} éliminé{allElim.length>1?"s":""}</div>}
                </div>
                {(ep.rounds||[]).map((round,ri)=>{
                  if(round.w){
                    const wp=getPlayer(round.w);
                    return(<div key={ri} style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                      <span style={{fontSize:14}}>🏆</span>
                      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:"#E8B84B",cursor:"pointer"}} onClick={()=>nav("playerDetail",{playerId:round.w})}>{wp?.name}</span>
                    </div>);
                  }
                  if(round.e.length===0&&isLetters){
                    return(<div key={ri} style={{padding:"4px 0",borderTop:ri>0?"1px solid #1a1a28":"none",fontSize:11,color:"#404058"}}>• {round.l}</div>);
                  }
                  if(round.e.length===0)return null;
                  return(
                    <div key={ri} style={{padding:"5px 0",borderTop:ri>0?"1px solid #1a1a28":"none"}}>
                      <div style={{fontSize:10,color:isLetters?"#E8B84B66":"#60607a",marginBottom:4}}>• {round.l}</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {round.e.map(pid=>{
                          const p=getPlayer(pid);
                          return(<span key={pid} onClick={()=>nav("playerDetail",{playerId:pid})} style={{background:"#1a0a0a",border:"1px solid #ef444433",borderRadius:5,padding:"2px 7px",fontSize:11,color:"#ef4444",cursor:"pointer"}}>✕ {p?.name||"?"}</span>);
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Right: classement */}
        <div style={{position:m?"static":"sticky",top:20}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#60607a",marginBottom:8}}>CLASSEMENT FINAL</div>
          <div style={{background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:12,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"32px 1fr 55px",gap:6,padding:"8px 12px",background:"#13131f",borderBottom:"1px solid #1e1e30",fontSize:10,color:"#60607a",textTransform:"uppercase",letterSpacing:"0.07em"}}>
              <span>#</span><span>Joueur</span><span style={{textAlign:"right"}}>Rating</span>
            </div>
            {sqRatings.map((r,i)=>{
              const p=getPlayer(r.p);
              const ct=p?getCurrentTeam(p):null;
              const c=r.r>=1.9?"#E8B84B":r.r>=1.8?"#f59e0b":r.r>=1.7?"#34d399":r.r>=1.5?"#60a5fa":"#60607a";
              return(
                <div key={r.p} onClick={()=>nav("playerDetail",{playerId:r.p})} style={{display:"grid",gridTemplateColumns:"32px 1fr 55px",gap:6,padding:"7px 12px",alignItems:"center",borderBottom:i<sqRatings.length-1?"1px solid #1e1e30":"none",cursor:"pointer",transition:"background .12s"}} onMouseEnter={e=>e.currentTarget.style.background="#13131f"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:i===0?"#E8B84B":i<3?"#60607a":"#2a2a40"}}>{i+1}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:500}}>{p?.name||"?"}</div>
                    {ct&&<div style={{fontSize:9,color:ct.color,marginTop:1}}>{ct.name}</div>}
                  </div>
                  <span style={{textAlign:"right",fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:c}}>{r.r.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── EVENT DETAIL ────────────────────────────────────
function EventDetailPage({eventId,nav}){
  const m=useIsMobile();
  const ev=getEvent(eventId);
  if(!ev) return null;
  if(ev.type==="squidgame") return <SquidGameDetailPage ev={ev} nav={nav}/>;
  const ac=getETC(ev.type);
  const isSquid=ev.type==="squidgame";
  const ranking=!isSquid?getEventRanking(ev):[];
  const evRatings=RATINGS.filter(r=>r.e===ev.id).sort((a,b)=>b.r-a.r);
  return(
    <div style={{padding:m?"14px 14px 76px":"40px 32px",maxWidth:1100,margin:"0 auto"}} className="fade">
      <BackBtn label="Événements" onClick={()=>nav("events")}/>
      <div style={{height:4,background:`linear-gradient(90deg,${ac},${ac}44)`,borderRadius:2,marginBottom:18}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:20}}>
        <div>
          <Badge color={ac}>{ev.typeLabel}</Badge>
          <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?38:54,lineHeight:1,marginTop:8}}>{ev.name} <span style={{color:ac}}>{ev.edition}</span></h1>
          <p style={{color:"#60607a",marginTop:6,fontSize:13}}>{ev.description}</p>
        </div>
        <div style={{textAlign:"right",color:"#60607a",fontSize:12,lineHeight:2}}>
          <div>{ev.date}</div>
          <div>{ev.participants} participants</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:m?12:18}}>
        <div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#60607a",marginBottom:14}}>CLASSEMENT FINAL</div>
          {ranking.map((r,i)=>{
            const t=getTeam(r.teamId);
            if(!t)return null;
            return(<RankRow key={r.teamId} t={t} i={i} r={r} ac={ac} ev={ev} nav={nav}/>);
          })}
        </div>
        <div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#60607a",marginBottom:14}}>RÉSULTATS PAR ÉPREUVE</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {(ev.epreuves||[]).map(ep=>(
              <EpreuveCard key={ep.id} ep={ep} ac={ac} nav={nav}/>
            ))}
          </div>
        </div>
      </div>
      <div style={{background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:12,padding:16,marginTop:m?12:18}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#60607a",marginBottom:14}}>RATINGS JOUEURS</div>
        {evRatings.map((r,i)=>{
          const p=getPlayer(r.p);
          const ct=p?getTeamAtEvent(p,ev.id):null;
          return(
            <div key={r.p} style={{display:"grid",gridTemplateColumns:"22px 1fr 80px 46px",alignItems:"center",gap:6,padding:"7px 0",borderBottom:i<evRatings.length-1?"1px solid #1e1e30":"none",cursor:"pointer"}} onClick={()=>nav("playerDetail",{playerId:r.p})}>
              <span style={{fontSize:11,color:i<3?"#E8B84B":"#60607a",fontWeight:600}}>{i+1}</span>
              <div>
                <div style={{fontSize:12,fontWeight:600}}>{p?.name}</div>
                {ct&&<div style={{display:"flex",alignItems:"center",gap:4,marginTop:1}}><div style={{width:5,height:5,borderRadius:"50%",background:ct.color}}/><span style={{fontSize:10,color:ct.color}}>{ct.name}</span></div>}
              </div>
              <div style={{fontSize:10,color:"#60607a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}></div>
              <span style={{fontSize:13,fontWeight:700,color:r.r>=1.8?"#E8B84B":r.r>=1.6?"#34d399":"#60a5fa",textAlign:"right"}}>{r.r.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── RANKINGS ────────────────────────────────────────
function RankingsPage({nav}){
  const m=useIsMobile();
  const [mode,setMode]=useState("individual");
  const [filter,setFilter]=useState("all");
  const [submode,setSubmode]=useState("ratings");
  const [search,setSearch]=useState("");
  const [minP,setMinP]=useState(1);

  const isSquidFilter=filter==="squidgame";
  // filtEids = events used to compute avg rating + medals
  const filtEids=filter==="all"?[1,2,3,4]:filter==="olympiades"?[1,2]:filter==="jv"?[4]:[3];
  // visibleEvs = columns shown in the ratings table
  // Chronological order: O2024(1), O2025(2), SG Hiver 2025(3), eO2026(4)
  const visibleEvs=filter==="all"
    ?[1,2,3,4].map(id=>EVENTS.find(e=>e.id===id)).filter(Boolean)
    :filter==="olympiades"?[1,2].map(id=>EVENTS.find(e=>e.id===id)).filter(Boolean)
    :filter==="jv"?[EVENTS.find(e=>e.id===4)].filter(Boolean)
    :[EVENTS.find(e=>e.id===3)].filter(Boolean);

  // Precompute all player data (never in JSX)
  const allPlayerData=PLAYERS.map(p=>{
    const c=RATINGS.filter(r=>r.p===p.id&&filtEids.includes(r.e)).length;
    if(c<(isSquidFilter?1:minP))return null;
    const avg=getAvgRating(p.id,filtEids);
    if(!avg)return null;
    const medals=isSquidFilter?{gold:0,silver:0,bronze:0}:getPlayerMedals(p.id,filtEids);
    const epCount=isSquidFilter?0:getPlayerEpreuveCount(p.id,filtEids);
    const pct=epCount>0?Math.round(((medals.gold+medals.silver+medals.bronze)/epCount)*100):0;
    return{player:p,team:getCurrentTeam(p),avg,medals,epCount,pct};
  }).filter(Boolean);

  // Sort by submode, then assign rank
  const sorted=[...allPlayerData].sort((a,b)=>{
    if(submode==="medals") return b.medals.gold!==a.medals.gold?b.medals.gold-a.medals.gold:b.medals.silver!==a.medals.silver?b.medals.silver-a.medals.silver:b.medals.bronze-a.medals.bronze;
    if(submode==="podpct") return b.pct!==a.pct?b.pct-a.pct:b.medals.gold+b.medals.silver+b.medals.bronze-(a.medals.gold+a.medals.silver+a.medals.bronze);
    return b.avg-a.avg;
  });
  const allPlayerRanks=sorted.map((r,i)=>({...r,rank:i+1}));

  const q=search.toLowerCase().trim();
  const playerRanks=q?allPlayerRanks.filter(r=>r.player.name.toLowerCase().startsWith(q)):allPlayerRanks;

  // Include all teams (active + inactive rebrand sources), exclude pure dissolved ones
  const allRankTeams=TEAMS.filter(t=>!t.dissolvedName||t.active);
  const teamRanks=allRankTeams
    .map(t=>{
      const ids=getTeamAllIds(t.id);
      const evCount=TEAM_EVENTS.filter(ev=>filtEids.includes(ev.id)&&(ev.epreuves||[]).length>0&&getTeamEventRating(ids,ev)!=null).length;
      if(evCount<minP)return null;
      const avg=getTeamAvgRating(t.id,filtEids);if(!avg)return null;
      return{team:t,avg,inactive:!t.active};
    })
    .filter(Boolean).sort((a,b)=>b.avg-a.avg);
  const teamEvShow=TEAM_EVENTS.filter(e=>filtEids.includes(e.id));

  const indivFilters=[{id:"all",l:"Tous"},{id:"olympiades",l:"Olympiades"},{id:"jv",l:"Jeux Vidéo"},{id:"squidgame",l:"🦑 Squid Game"}];
  const teamFilters=[{id:"all",l:"Tous"},{id:"olympiades",l:"Olympiades"},{id:"jv",l:"Jeux Vidéo"}];
  const filters=mode==="individual"?indivFilters:teamFilters;

  // Column template for individual table
  const colDesktop=isSquidFilter
    ?"44px 1fr 120px 70px"
    :submode==="ratings"
    ?(`44px 1fr 120px `+visibleEvs.map(()=>"60px").join(" ")+" 70px")
    :submode==="medals"
    ?"44px 1fr 120px 55px 55px 55px 55px"
    :"44px 1fr 120px 70px 70px 70px";
  const colMobile="28px 1fr 80px";

  return(
    <div style={{padding:m?"14px 14px 76px":"40px 32px",maxWidth:1200,margin:"0 auto"}} className="fade">
      <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?36:52,letterSpacing:"0.05em",marginBottom:16}}>CLASSEMENTS</h1>

      {/* Mode */}
      <div style={{display:"flex",gap:0,marginBottom:10,background:"#13131f",borderRadius:8,padding:4,width:"fit-content",border:"1px solid #1e1e30"}}>
        {[{id:"individual",l:"👤 Individuel"},{id:"team",l:"🏆 Équipes"}].map(mo=>(
          <button key={mo.id} onClick={()=>{setMode(mo.id);setFilter("all");setSearch("");setMinP(1);}} style={{padding:m?"7px 14px":"8px 20px",borderRadius:6,cursor:"pointer",background:mode===mo.id?"#E8B84B":"transparent",color:mode===mo.id?"#080810":"#60607a",border:"none",fontFamily:"'Outfit',sans-serif",fontSize:m?12:13,fontWeight:600}}>{mo.l}</button>
        ))}
      </div>

      {/* Edition filters */}
      <div style={{display:"flex",gap:7,marginBottom:8,flexWrap:"wrap"}}>
        {filters.map(f=>(
          <button key={f.id} onClick={()=>{setFilter(f.id);setSearch("");setMinP(1);}} style={{padding:m?"6px 12px":"8px 16px",borderRadius:8,cursor:"pointer",background:filter===f.id?"#E8B84B":"#13131f",color:filter===f.id?"#080810":"#60607a",border:filter===f.id?"none":"1px solid #1e1e30",fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:500}}>{f.l}</button>
        ))}
      </div>

      {/* Submode — individual only, not for squid */}
      {mode==="individual"&&!isSquidFilter&&(
        <div style={{display:"flex",gap:7,marginBottom:10,flexWrap:"wrap"}}>
          {[{id:"ratings",l:"⭐ Ratings"},{id:"medals",l:"🏅 Médailles"},{id:"podpct",l:"📊 % Podium"}].map(sm=>(
            <button key={sm.id} onClick={()=>setSubmode(sm.id)} style={{padding:m?"5px 10px":"7px 14px",borderRadius:8,cursor:"pointer",background:submode===sm.id?"#E8B84B":"#13131f",color:submode===sm.id?"#080810":"#60607a",border:submode===sm.id?"none":"1px solid #1e1e30",fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:600}}>{sm.l}</button>
          ))}
        </div>
      )}

      {/* Search */}
      {/* Min participations filter */}
      {filtEids.length>1&&(
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <span style={{fontSize:11,color:"#60607a"}}>Min. participations :</span>
        {Array.from({length:filtEids.length},(_,i)=>i+1).map(n=>(
          <button key={n} onClick={()=>setMinP(n)} style={{padding:"4px 10px",borderRadius:7,cursor:"pointer",background:minP===n?"#E8B84B":"#13131f",color:minP===n?"#080810":"#60607a",border:minP===n?"none":"1px solid #1e1e30",fontFamily:"'Outfit',sans-serif",fontSize:11,fontWeight:600}}>{n}</button>
        ))}
      </div>)}
      {mode==="individual"&&(
        <div style={{position:"relative",marginBottom:12,maxWidth:300}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#404058",pointerEvents:"none"}}>🔍</span>
          <input type="text" placeholder="Rechercher un joueur..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",background:"#13131f",border:"1px solid #1e1e30",borderRadius:8,padding:"8px 30px",color:"#eeeef5",fontFamily:"'Outfit',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#60607a",cursor:"pointer",fontSize:18,padding:0,lineHeight:1}}>×</button>}
        </div>
      )}


      {search&&<div style={{fontSize:11,color:"#60607a",marginBottom:14}}>{playerRanks.length} résultat{playerRanks.length!==1?"s":""} pour <span style={{color:"#E8B84B"}}>"{search}"</span></div>}
      {!(filter==="all"||filter==="olympiades")&&!search&&<div style={{marginBottom:14}}/>}

      {mode==="individual"?(
        <>
          {/* Podium desktop */}
          {!m&&!search&&allPlayerRanks.length>=3&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1.15fr 1fr",gap:14,marginBottom:22}}>
              {[allPlayerRanks[1],allPlayerRanks[0],allPlayerRanks[2]].map((r,idx)=>{
                if(!r)return(<div key={idx}/>);
                const pos=[2,1,3][idx];
                return(
                  <div key={r.player.id} onClick={()=>nav("playerDetail",{playerId:r.player.id})} style={{background:pos===1?"linear-gradient(135deg,#1c1708,#13131f)":"#13131f",border:pos===1?"1px solid #E8B84B55":"1px solid #1e1e30",borderRadius:12,padding:20,cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                      <span style={{fontSize:26}}>{MEDALS[pos-1]}</span>
                      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:pos===1?"#E8B84B":"#60607a"}}>
                        {submode==="ratings"?r.avg.toFixed(2):submode==="medals"?"":r.pct+"%"}
                      </span>
                    </div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22}}>{r.player.name}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                      <ColorDot teamId={r.team?.id} size={7}/>
                      <span style={{color:"#60607a",fontSize:12}}>{r.team?.name||"Libre"}</span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* Table */}
          {playerRanks.length===0?(
            <div style={{color:"#60607a",fontSize:13,padding:20,textAlign:"center"}}>Aucun résultat pour "{search}".</div>
          ):(
            <div style={{background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:12,overflowX:"auto"}}>
              {/* Header */}
              <div style={{display:"grid",gridTemplateColumns:m?colMobile:colDesktop,gap:6,padding:"9px 14px",background:"#13131f",borderBottom:"1px solid #1e1e30",fontSize:10,color:"#60607a",textTransform:"uppercase",letterSpacing:"0.07em",minWidth:m?0:400}}>
                <span>#</span><span>Joueur</span>
                {m?<span style={{textAlign:"right"}}>{submode==="ratings"?"Moy.":submode==="medals"?"Or":"%"}</span>:<>
                  <span>Équipe</span>
                  {submode==="ratings"&&!isSquidFilter&&visibleEvs.map(e=>{
                  const lbl=e.id===1?"O 24'":e.id===2?"O 25'":e.id===3?"SG 25'":"eO 26'";
                  return(<span key={e.id} style={{textAlign:"center"}}>{lbl}</span>);
                })}
                  {submode==="medals"&&<><span style={{textAlign:"center"}}>🥇</span><span style={{textAlign:"center"}}>🥈</span><span style={{textAlign:"center"}}>🥉</span><span style={{textAlign:"center"}}>Total</span></>}
                  {submode==="podpct"&&<><span style={{textAlign:"center"}}>Épr.</span><span style={{textAlign:"center"}}>Pods.</span><span style={{textAlign:"center"}}>%</span></>}
                  <span style={{textAlign:"right"}}>{isSquidFilter?"Rating":submode==="ratings"?"Moy.":""}</span>
                </>}
              </div>
              {/* Rows */}
              {playerRanks.map((r,i)=>(
                <div key={r.player.id} onClick={()=>nav("playerDetail",{playerId:r.player.id})} style={{display:"grid",gridTemplateColumns:m?colMobile:colDesktop,gap:6,padding:"9px 14px",alignItems:"center",borderBottom:i<playerRanks.length-1?"1px solid #1e1e30":"none",cursor:"pointer",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background="#13131f"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <span style={{color:r.rank<=3?"#E8B84B":"#60607a",fontWeight:700,fontSize:13}}>{r.rank}</span>
                  <div style={{display:"flex",flexDirection:"column",gap:1}}>
                    <span style={{fontWeight:500,fontSize:13}}>{r.player.name}</span>
                    {m&&<span style={{fontSize:10,color:r.team?.color||"#404058"}}>{r.team?.name||"Libre"}</span>}
                  </div>
                  {m?(
                    <span style={{textAlign:"right",fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#E8B84B"}}>
                      {submode==="ratings"?r.avg.toFixed(2):submode==="medals"?r.medals.gold+"🥇":r.pct+"%"}
                    </span>
                  ):<>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <ColorDot teamId={r.team?.id} size={6}/>
                      <span style={{color:"#60607a",fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.team?.name||"Libre"}</span>
                    </div>
                    {submode==="ratings"&&!isSquidFilter&&visibleEvs.map(ev=>{const ro=RATINGS.find(rt=>rt.p===r.player.id&&rt.e===ev.id);const v=ro?.r;const c=!v?"#404058":v>=1.8?"#E8B84B":v>=1.6?"#34d399":"#60a5fa";return(<span key={ev.id} style={{textAlign:"center",fontWeight:600,fontSize:12,color:c}}>{v?v.toFixed(2):"—"}</span>);})}
                    {submode==="medals"&&<>
                      <span style={{textAlign:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#E8B84B"}}>{r.medals.gold}</span>
                      <span style={{textAlign:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#aaaaaa"}}>{r.medals.silver}</span>
                      <span style={{textAlign:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#c87533"}}>{r.medals.bronze}</span>
                      <span style={{textAlign:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#eeeef5"}}>{r.medals.gold+r.medals.silver+r.medals.bronze}</span>
                    </>}
                    {submode==="podpct"&&<>
                      <span style={{textAlign:"center",fontSize:12,color:"#60607a"}}>{r.epCount}</span>
                      <span style={{textAlign:"center",fontSize:12,color:"#60607a"}}>{r.medals.gold+r.medals.silver+r.medals.bronze}</span>
                      <span style={{textAlign:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:r.pct>=50?"#E8B84B":r.pct>=33?"#34d399":"#60a5fa"}}>{r.pct}%</span>
                    </>}
                    {(submode==="ratings"||isSquidFilter)&&<span style={{textAlign:"right",fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:r.avg>=1.9?"#E8B84B":r.avg>=1.7?"#34d399":"#60a5fa"}}>
                      {r.avg.toFixed(2)}
                    </span>}
                  </>}
                </div>
              ))}
            </div>
          )}
        </>
      ):(
        <>
          {!m&&teamRanks.length>=3&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1.15fr 1fr",gap:14,marginBottom:22}}>
              {[teamRanks[1],teamRanks[0],teamRanks[2]].map((r,idx)=>{
                if(!r||!r.team)return(<div key={idx}/>);
                const pos=[2,1,3][idx];
                return(
                  <div key={r.team.id} onClick={()=>nav("teamDetail",{teamId:r.team.id})} style={{background:pos===1?"linear-gradient(135deg,#1c1708,#13131f)":"#13131f",border:pos===1?"1px solid #E8B84B55":`1px solid ${r.team.color}33`,borderRadius:12,padding:20,cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                      <span style={{fontSize:26}}>{MEDALS[pos-1]}</span>
                      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:34,color:r.team.color}}>{r.avg.toFixed(2)}</span>
                    </div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22}}>{r.team.name}</div>
                  </div>
                );
              })}
            </div>
          )}
          {teamRanks.length===0&&<p style={{color:"#60607a",fontSize:13}}>Aucun rating équipe disponible.</p>}
          {teamRanks.length>0&&(
            <div style={{background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:12,overflowX:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:m?"28px 1fr 72px":`44px 1fr ${teamEvShow.map(()=>"76px").join(" ")} 72px`,gap:6,padding:"9px 14px",background:"#13131f",borderBottom:"1px solid #1e1e30",fontSize:10,color:"#60607a",textTransform:"uppercase",minWidth:m?0:400}}>
                <span>#</span><span>Équipe</span>
                {m?<span style={{textAlign:"right"}}>Moy.</span>:<>{teamEvShow.map(e=>(<span key={e.id} style={{textAlign:"center"}}>{e.edition}</span>))}<span style={{textAlign:"right"}}>Moy.</span></>}
              </div>
              {teamRanks.map((r,i)=>{
                if(!r||!r.team)return null;
                return(
                  <div key={r.team.id} onClick={()=>nav("teamDetail",{teamId:r.team.id})} style={{display:"grid",gridTemplateColumns:m?"28px 1fr 72px":`44px 1fr ${teamEvShow.map(()=>"76px").join(" ")} 72px`,gap:6,padding:"9px 14px",alignItems:"center",borderBottom:i<teamRanks.length-1?"1px solid #1e1e30":"none",cursor:"pointer",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background="#13131f"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{color:i<3?"#E8B84B":"#60607a",fontWeight:700,fontSize:13}}>{i+1}</span>
                    <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                      <div style={{width:3,height:24,background:r.team.color,borderRadius:2}}/>
                      <span style={{fontWeight:500,fontSize:13,color:r.inactive?"#60607a":"#eeeef5"}}>{r.team.name}</span>
                      {r.inactive&&<Badge color="#404058">Inactive</Badge>}
                    </div>
                    {m?<span style={{textAlign:"right",fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:r.team.color}}>{r.avg.toFixed(2)}</span>:<>
                      {teamEvShow.map(ev=>{const v=getTeamEventRating(getTeamAllIds(r.team.id),ev);const c=!v?"#404058":v>=1.8?"#E8B84B":v>=1.6?"#34d399":"#60a5fa";return(<span key={ev.id} style={{textAlign:"center",fontWeight:600,fontSize:12,color:c}}>{v?v.toFixed(2):"—"}</span>);})}
                      <span style={{textAlign:"right",fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:r.team.color}}>{r.avg.toFixed(2)}</span>
                    </>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── TEAMS PAGE ──────────────────────────────────────
function TeamsPage({nav}){
  const m=useIsMobile();
  const active=TEAMS.filter(t=>t.active);
  const former=TEAMS.filter(t=>!t.active&&!t.dissolvedName);
  return(
    <div style={{padding:m?"14px 14px 76px":"40px 32px",maxWidth:1100,margin:"0 auto"}} className="fade">
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:m?16:28}}>
        <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?36:52,letterSpacing:"0.05em"}}>LES <span style={{color:"#E8B84B"}}>ÉQUIPES</span></h1>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?18:24,color:"#60607a"}}>
          <span style={{color:"#E8B84B"}}>{active.length}</span>
          <span style={{color:"#2a2a40"}}>/16</span>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(3,1fr)",gap:m?10:14,marginBottom:m?18:28}}>
        {active.map(team=>{
          const players=PLAYERS.filter(p=>p.t26===team.id||(!p.t26&&p.teamId===team.id)).sort((a,b)=>{const ac=a.t26cap?1:0,bc=b.t26cap?1:0;if(bc!==ac)return bc-ac;return(getAvgRating(b.id)||0)-(getAvgRating(a.id)||0);});
          const avg=getTeamAvgRating(team.id);
          return(
            <div key={team.id} onClick={()=>nav("teamDetail",{teamId:team.id})} style={{background:"#0d0d1c",border:`1px solid ${team.color}33`,borderRadius:12,overflow:"hidden",cursor:"pointer",transition:"transform .2s,border-color .2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor=team.color+"77";}} onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.borderColor=team.color+"33";}}>
              <div style={{height:3,background:`linear-gradient(90deg,${team.color} 50%,${team.color2||team.color})`}}/>
              <div style={{padding:m?12:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?16:18,color:team.color}}>{team.name}</div>
                  {avg&&<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?16:18,color:"#60607a"}}>{avg.toFixed(2)}</div>}
                </div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {players.map(p=>(
                    <div key={p.id} onClick={e=>{e.stopPropagation();nav("playerDetail",{playerId:p.id});}} style={{background:team.color+"22",border:`1px solid ${p.t26cap?"#E8B84B":team.color}33`,borderRadius:4,padding:"2px 6px",fontSize:10,color:p.t26cap?"#E8B84B":(parseInt(team.color.slice(1),16)<0x404040?team.color2||"#FFFFFF":team.color),cursor:"pointer"}}>{p.name}</div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {former.length>0&&(
        <>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{flex:1,height:1,background:"#1e1e30"}}/>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:"#60607a",whiteSpace:"nowrap"}}>ANCIENNES ÉQUIPES</span>
            <div style={{flex:1,height:1,background:"#1e1e30"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:m?10:14}}>
            {former.map(team=>{
              const lastEv=TEAM_EVENTS.slice().reverse().find(ev=>getEventRanking(ev).some(r=>r.teamId===team.id));
              const lastRank=lastEv?getEventRanking(lastEv):[];
              const lastPos=lastRank.findIndex(r=>r.teamId===team.id)+1;
              const lastPts=lastRank.find(r=>r.teamId===team.id)?.pts||0;
              return(
                <div key={team.id} onClick={()=>nav("teamDetail",{teamId:team.id})} style={{background:"#0d0d1c",border:`1px solid ${team.color}22`,borderRadius:12,padding:16,opacity:.85,cursor:"pointer",transition:"opacity .2s,border-color .2s"}} onMouseEnter={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.borderColor=team.color+"55";}} onMouseLeave={e=>{e.currentTarget.style.opacity=".85";e.currentTarget.style.borderColor=team.color+"22";}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:lastEv?8:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:team.color}}/>
                      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#80807a"}}>{team.name}</span>
                    </div>
                    <Badge color="#404058">Inactive</Badge>
                  </div>
                  {lastEv&&(
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <Badge color={getETC(lastEv.type)}>{lastEv.edition}</Badge>
                      <span style={{fontSize:12,color:"#60607a"}}>{lastEv.name}</span>
                      <span style={{marginLeft:"auto",fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:lastPos===1?"#E8B84B":lastPos<=3?"#34d399":"#60607a"}}>{MEDALS[lastPos-1]||lastPos+"e"}</span>
                      <span style={{fontSize:11,color:"#404058"}}>{lastPts} pts</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── HISTORIC ROSTERS ────────────────────────────────
function HistoricRosters({teamId,allTeamIds,c1,nav}){
  const [sel,setSel]=useState(null);
  const editions=[
    {key:"t24",evId:1,label:"O2024",tids:allTeamIds,capKey:"t24cap"},
    {key:"t25",evId:2,label:"O2025",tids:[teamId],capKey:"t25cap"},
    {key:"teo",evId:4,label:"eO2026",tids:[teamId],capKey:"teocap"},
  ].filter(ed=>PLAYERS.some(p=>ed.tids.some(tid=>p[ed.key]===tid)));
  if(editions.length===0)return null;
  const active=sel?editions.find(e=>e.label===sel):null;
  const roster=active?PLAYERS
    .filter(p=>active.tids.some(tid=>p[active.key]===tid))
    .sort((a,b)=>{
      const ac=a[active.capKey]?1:0,bc=b[active.capKey]?1:0;
      if(bc!==ac)return bc-ac;
      const ra=RATINGS.find(r=>r.p===a.id&&r.e===active.evId)?.r||0;
      const rb=RATINGS.find(r=>r.p===b.id&&r.e===active.evId)?.r||0;
      return rb-ra;
    }):[];
  return(
    <div style={{background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:12,padding:18}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:active?14:0,flexWrap:"wrap"}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#60607a",marginRight:4}}>ROSTERS HISTORIQUES</div>
        {editions.map(ed=>(
          <button key={ed.label} onClick={()=>setSel(sel===ed.label?null:ed.label)} style={{padding:"5px 12px",borderRadius:7,cursor:"pointer",background:sel===ed.label?c1:"#13131f",color:sel===ed.label?"#080810":"#60607a",border:sel===ed.label?"none":"1px solid #1e1e30",fontFamily:"'Outfit',sans-serif",fontSize:11,fontWeight:600}}>{ed.label}</button>
        ))}
        {active&&<span style={{fontSize:11,color:"#404058",marginLeft:"auto"}}>{roster.length} joueurs</span>}
      </div>
      {active&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
          {roster.map(p=>{
            const rating=RATINGS.find(r=>r.p===p.id&&r.e===active.evId)?.r;
            return(
              <div key={p.id} onClick={()=>nav("playerDetail",{playerId:p.id})} style={{background:"#13131f",borderRadius:8,padding:"9px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:9,transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background="#1e1e30"} onMouseLeave={e=>e.currentTarget.style.background="#13131f"}>
                <div style={{width:30,height:30,borderRadius:"50%",background:(p[active.capKey]?"#E8B84B22":c1+"22"),border:`2px solid ${p[active.capKey]?"#E8B84B":c1}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:p[active.capKey]?"#E8B84B":c1,flexShrink:0}}>{p.name.charAt(0)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:500,fontSize:12}}>{p.name}</div>
                  {rating&&<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:rating>=1.8?"#E8B84B":rating>=1.6?"#34d399":"#60a5fa",lineHeight:1.2}}>{rating.toFixed(2)}</div>}
                
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── RANKING CHART ───────────────────────────────────
function RankingChart({teamId,allTeamIds,color,color2}){
  const c2=color2||color;
  const ids=allTeamIds||[teamId];
  const data=TEAM_EVENTS.map(ev=>{
    const rank=getEventRanking(ev);
    for(const tid of ids){
      const pos=rank.findIndex(r=>r.teamId===tid)+1;
      if(pos>0)return{label:ev.edition,pos,total:rank.length};
    }
    return null;
  }).filter(Boolean);
  if(data.length===0)return null;
  const W=500,H=160,pL=28,pR=16,pT=24,pB=48;
  const cW=W-pL-pR,cH=H-pT-pB,nEv=data.length;
  const pts=data.map((d,i)=>({x:pL+(nEv>1?(i/(nEv-1)):0.5)*cW,y:pT+(((d.pos-1)/Math.max(d.total-1,1))*cH)}));
  const line="M "+pts.map(p=>`${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ");
  const gid=`g${teamId}`;
  return(
    <div style={{background:"#13131f",borderRadius:10,padding:"12px 14px"}}>
      <div style={{fontSize:10,color:"#60607a",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Évolution du classement</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={color}/><stop offset="60%" stopColor={color}/><stop offset="100%" stopColor={c2}/></linearGradient></defs>
        {[1,3,5,8].map(pos=>{const y=pT+(((pos-1)/7)*cH);return(<g key={pos}><line x1={pL} y1={y} x2={W-pR} y2={y} stroke="#1e1e30" strokeWidth="0.5"/><text x={pL-4} y={y} textAnchor="end" fill="#404058" fontSize="9" dominantBaseline="central">{pos}</text></g>);})}
        <path d={`${line} L ${pts[pts.length-1].x.toFixed(1)} ${(pT+cH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(pT+cH).toFixed(1)} Z`} fill={`url(#${gid})`} fillOpacity="0.1"/>
        <path d={line} fill="none" stroke={`url(#${gid})`} strokeWidth="2.5" strokeLinejoin="round"/>
        {pts.map((p,i)=>{const isTop=data[i].pos===1;return(
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill={isTop?"#E8B84B":color} stroke="#080810" strokeWidth="2"/>
            <text x={p.x} y={p.y-11} textAnchor="middle" fill={isTop?"#E8B84B":c2} fontSize="10" fontWeight="600">{data[i].pos}e/{data[i].total}</text>
            <text x={p.x} y={pT+cH+16} textAnchor="middle" fill="#60607a" fontSize="9">{data[i].label}</text>
          </g>
        );})}
      </svg>
    </div>
  );
}

// ─── TEAM DETAIL ─────────────────────────────────────
function TeamDetailPage({teamId,nav}){
  const m=useIsMobile();
  const team=getTeam(teamId);
  const redirectTeamId=team?.dissolvedName?TEAMS.find(t=>t.oldName===team.dissolvedName)?.id:null;
  useEffect(()=>{if(redirectTeamId) nav("teamDetail",{teamId:redirectTeamId});},[redirectTeamId]);
  if(!team||redirectTeamId) return null;
  const c1=team.color,c2=team.color2||team.color;
  const players=PLAYERS.filter(p=>p.t26===teamId||(!p.t26&&p.teamId===teamId)).sort((a,b)=>(getAvgRating(b.id)||0)-(getAvgRating(a.id)||0));
  const playersO26=[...players].sort((a,b)=>{const ac=a.t26cap?1:0,bc=b.t26cap?1:0;if(bc!==ac)return bc-ac;return (getAvgRating(b.id)||0)-(getAvgRating(a.id)||0);});
  const avgR=getTeamAvgRating(teamId);
  const oldTeam=team.oldName?TEAMS.find(t=>t.dissolvedName===team.oldName):null;
  const allTeamIds=[teamId,...(oldTeam?[oldTeam.id]:[])];
  const evResults=TEAM_EVENTS.map(ev=>{
    const rank=getEventRanking(ev);
    for(const tid of allTeamIds){
      const pos=rank.findIndex(r=>r.teamId===tid)+1;
      if(pos>0){
        const pts=rank.find(r=>r.teamId===tid)?.pts||0;
        const tr=TEAM_RATINGS.find(r=>r.t===tid&&r.e===ev.id);
        const underName=tid!==teamId?getTeam(tid):null;
        return{ev,pos,pts,rating:tr?.r,underName};
      }
    }
    return null;
  }).filter(Boolean);
  const wins=evResults.filter(r=>r.pos===1).length;
  const avgPos=evResults.length?(evResults.reduce((s,r)=>s+r.pos,0)/evResults.length).toFixed(1):"—";
  const allRank=TEAMS.filter(t=>t.active).sort((a,b)=>(getTeamAvgRating(b.id)||0)-(getTeamAvgRating(a.id)||0)).findIndex(t=>t.id===teamId)+1;
  const transfersOut=TRANSFERS.filter(t=>t.fromTeamId===teamId);
  const transfersIn=TRANSFERS.filter(t=>t.toTeamId===teamId&&t.fromTeamId!==0);
  return(
    <div style={{padding:m?"14px 14px 76px":"40px 32px",maxWidth:1100,margin:"0 auto"}} className="fade">
      <BackBtn label="Équipes" onClick={()=>nav("teams")}/>
      {oldTeam&&(
        <div style={{background:"#0d0d1c",border:`1px solid ${oldTeam.color}44`,borderRadius:12,padding:"12px 18px",marginBottom:14,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{width:10,height:10,borderRadius:"50%",background:oldTeam.color,display:"inline-block"}}/>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:"#60607a"}}>{oldTeam.dissolvedName}</span>
            <span style={{color:"#404058",fontSize:14}}>→</span>
            <span style={{width:10,height:10,borderRadius:"50%",background:c1,display:"inline-block"}}/>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:c1}}>{team.name}</span>
          </div>
          <span style={{fontSize:11,color:"#60607a"}}>Rebrand — même équipe, palmarès fusionné.</span>
        </div>
      )}
      <div style={{background:`linear-gradient(135deg,${c1}18,#0d0d1c)`,border:`1px solid ${c1}44`,borderRadius:14,padding:m?16:26,marginBottom:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div>
            <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?38:52,background:`linear-gradient(90deg,${c1} 40%,${c2} 100%)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{team.name}</h1>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{v:avgR?avgR.toFixed(2):"—",l:"Rating"},{v:wins+"🏆",l:"Titres"},{v:`#${allRank}`,l:"Rang"},{v:avgPos,l:"Pos. moy."}].map(s=>(
              <div key={s.l} style={{background:"#0d0d1c",borderRadius:8,padding:"9px 14px",textAlign:"center"}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?22:28,background:`linear-gradient(90deg,${c1} 30%,${c2} 100%)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{s.v}</div>
                <div style={{fontSize:9,color:"#60607a",textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Roster actuel — pleine largeur */}
      <div style={{background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:12,padding:18,marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#60607a"}}>ROSTER ACTUEL — O2026</div>
          <span style={{fontSize:11,color:"#404058"}}>{playersO26.length} joueurs</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
          {playersO26.map(p=>{
            const avg=getAvgRating(p.id);
            return(
              <div key={p.id} onClick={()=>nav("playerDetail",{playerId:p.id})} style={{background:"#13131f",borderRadius:8,padding:"9px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:9,transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background="#1e1e30"} onMouseLeave={e=>e.currentTarget.style.background="#13131f"}>
                <div style={{width:30,height:30,borderRadius:"50%",background:(p.t26cap?"#E8B84B":""+c1)+"22",border:`2px solid ${p.t26cap?"#E8B84B":c1}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:p.t26cap?"#E8B84B":c1,flexShrink:0}}>{p.name.charAt(0)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:500,fontSize:12}}>{p.name}</div>
                  {avg?<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:avg>=1.8?"#E8B84B":avg>=1.6?"#34d399":"#60a5fa",lineHeight:1.2}}>{avg.toFixed(2)}</div>:<div style={{fontSize:10,color:"#404058"}}>nouveau</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Graphique + Performances côte à côte */}
      <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:m?12:18,marginBottom:18}}>
        <RankingChart teamId={teamId} allTeamIds={allTeamIds} color={c1} color2={c2}/>
        <div style={{background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:12,padding:18}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#60607a",marginBottom:14}}>PERFORMANCES</div>
          {evResults.length===0&&<p style={{color:"#60607a",fontSize:12}}>Aucune performance.</p>}
          {evResults.map(({ev,pos,pts,rating,underName},i)=>(
            <div key={ev.id} style={{padding:"9px 0",borderBottom:i<evResults.length-1?"1px solid #1e1e30":"none",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>nav("eventDetail",{eventId:ev.id})}>
              <Badge color={getETC(ev.type)}>{ev.edition}</Badge>
              <div style={{flex:1}}>
                <div style={{fontWeight:500,fontSize:13}}>{ev.name}</div>
                <div style={{fontSize:11,color:"#60607a"}}>
                  {MEDALS[pos-1]||`${pos}e`} · {pts} pts
                  {underName&&<span style={{color:underName.color}}> · sous {underName.dissolvedName}</span>}
                </div>
              </div>
              {rating&&<div style={{textAlign:"right"}}><div style={{fontSize:9,color:"#60607a",marginBottom:1}}>Rating</div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:rating>=1.8?"#E8B84B":rating>=1.6?"#34d399":"#60a5fa"}}>{rating.toFixed(2)}</div></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Rosters historiques */}
      <HistoricRosters teamId={teamId} allTeamIds={allTeamIds} c1={c1} nav={nav}/>
    </div>
  );
}
// ─── PODIUM DETAIL ───────────────────────────────────
function PodiumDetail({podiums,nav}){
  const [open,setOpen]=useState(false);
  return(
    <div>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"#13131f",border:"1px solid #1e1e30",borderRadius:8,padding:"7px 12px",cursor:"pointer",color:"#60607a",fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"space-between"}} onMouseEnter={e=>e.currentTarget.style.background="#1e1e30"} onMouseLeave={e=>e.currentTarget.style.background="#13131f"}>
        <span>{podiums.length} épreuve{podiums.length>1?"s":""} — voir le détail</span>
        <span style={{transition:"transform .2s",display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
      </button>
      {open&&(
        <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:4}}>
          {podiums.map((item,i)=>{
            const t=getTeam(item.teamId);
            const ac=getETC(item.ev.type);
            const medalColor=item.pos===1?"#E8B84B":item.pos===2?"#aaaaaa":"#c87533";
            return(
              <div key={i} onClick={()=>nav("eventDetail",{eventId:item.ev.id})} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"#13131f",borderRadius:8,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#1e1e30"} onMouseLeave={e=>e.currentTarget.style.background="#13131f"}>
                <span style={{fontSize:17,flexShrink:0}}>{MEDALS[item.pos-1]||item.pos+"e"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.ep.name}</div>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2,flexWrap:"wrap"}}>
                    <Badge color={ac}>{item.ev.edition}</Badge>
                    {t&&(<><ColorDot teamId={t.id} size={5}/><span style={{fontSize:10,color:t.color}}>{t.dissolvedName||t.name}</span></>)}
                  </div>
                </div>
                {item.isSq?<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:"#E84D9B",flexShrink:0}}>🦑 SG</div>:<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:medalColor,flexShrink:0}}>{item.pts} pts</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PLAYER DETAIL ────────────────────────────────────
function PlayerDetailPage({playerId,nav}){
  const m=useIsMobile();
  const player=getPlayer(playerId);
  if(!player) return null;
  const team=getTeam(player.teamId);
  const ratings=RATINGS.filter(r=>r.p===playerId).sort((a,b)=>a.e-b.e);
  const avg=getAvgRating(playerId);
  const podiums=[];
  EVENTS.forEach(ev=>{
    if(ev.type==="squidgame"){
      // Squid Game: use ratings order for position
      const sqRatings=RATINGS.filter(r=>r.e===ev.id).sort((a,b)=>b.r-a.r);
      const sqPos=sqRatings.findIndex(r=>r.p===playerId)+1;
      if(sqPos>0&&sqPos<=3){
        // Find which epreuve mentions this player in rounds
        const sqEp=(ev.epreuves||[]).find(ep=>(ep.rounds||[]).some(r=>(r.e||[]).includes(playerId)||(r.w===playerId)));
        podiums.push({ev,ep:sqEp||{id:300,name:"Squid Game"},teamId:null,pos:sqPos,pts:null,isSq:true});
      }
    } else {
      (ev.epreuves||[]).forEach(ep=>{
        (ep.results||[]).forEach(r=>{
          if((r.playerIds||[]).includes(playerId)){
            podiums.push({ev,ep,teamId:r.teamId,pos:r.pos,pts:r.pts});
          }
        });
      });
    }
  });
  const allRank=PLAYERS.filter(p=>p.teamId).sort((a,b)=>(getAvgRating(b.id)||0)-(getAvgRating(a.id)||0)).findIndex(p=>p.id===playerId)+1;
  // Precompute stats (no inline heavy computation in JSX)
  const myGold=podiums.filter(p=>p.pos===1).length;
  const myPodTotal=podiums.filter(p=>p.pos<=3).length;
  const myEpCount=getPlayerEpreuveCount(playerId);
  const myPct=myEpCount>0?Math.round((myPodTotal/myEpCount)*100):0;
  // Medal rank: sort all active players by gold→silver→bronze
  const medalRank=(()=>{
    const eligible=PLAYERS.filter(p=>p.teamId);
    return eligible.map(p=>{
      const pods=getPlayerMedals(p.id);
      return{id:p.id,g:pods.gold,s:pods.silver,b:pods.bronze};
    }).sort((a,b)=>b.g!==a.g?b.g-a.g:b.s!==a.s?b.s-a.s:b.b-a.b)
      .findIndex(p=>p.id===playerId)+1;
  })();
  // Podpct rank
  const podPctRank=(()=>{
    const eligible=PLAYERS.filter(p=>getPlayerEpreuveCount(p.id)>0);
    return eligible.map(p=>{
      const ep=getPlayerEpreuveCount(p.id);
      const pods=getPlayerMedals(p.id);
      return{id:p.id,pct:ep>0?Math.round(((pods.gold+pods.silver+pods.bronze)/ep)*100):0};
    }).sort((a,b)=>b.pct-a.pct)
      .findIndex(p=>p.id===playerId)+1;
  })();
  // Editions rank: how many players have exactly ≥ same nb of editions
  const edTotal=PLAYERS.filter(p=>RATINGS.filter(r=>r.p===p.id).length>=ratings.length).length;
  const edPct=PLAYERS.filter(p=>RATINGS.filter(r=>r.p===p.id).length>0).length;
  const edRankPct=edPct>0?Math.round((edTotal/edPct)*100):0;
  const transfers=TRANSFERS.filter(t=>t.playerId===playerId);
  const tc=team?.color||"#60607a";
  return(
    <div style={{padding:m?"14px 14px 76px":"40px 32px",maxWidth:900,margin:"0 auto"}} className="fade">
      <BackBtn onClick={()=>nav("rankings")}/>
      <div style={{background:`linear-gradient(135deg,${tc}18,#0d0d1c)`,border:`1px solid ${tc}44`,borderRadius:14,padding:m?16:26,marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <div style={{width:m?56:70,height:m?56:70,borderRadius:"50%",background:`linear-gradient(135deg,${tc}33,${tc}11)`,border:`3px solid ${tc}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:m?24:30,color:tc,flexShrink:0}}>{player.name.charAt(0)}</div>
          <div style={{flex:1}}>
            <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?32:44,lineHeight:1}}>{player.name}</h1>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4,flexWrap:"wrap"}}>
              {team&&(<><ColorDot teamId={team.id} size={8}/><span style={{color:tc,fontWeight:600,fontSize:13}}>{team.dissolvedName||team.name}</span></>)}
              {avg&&<span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#E8B84B",marginLeft:8}}>{avg.toFixed(2)}</span>}
            </div>
          </div>
        </div>
        {transfers.length>0&&(
          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${tc}22`,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",fontSize:11,color:"#60607a"}}>
            <span>Carrière :</span>
            {transfers.map(t=>{
              const f=getTeam(t.fromTeamId),to=getTeam(t.toTeamId);
              return(
                <span key={t.date+"-"+t.fromTeamId} style={{display:"flex",alignItems:"center",gap:3}}>
                  <ColorDot teamId={f?.id} size={6}/>
                  <span>{f?.dissolvedName||f?.name}</span>
                  <span style={{color:"#404058"}}>→</span>
                  <ColorDot teamId={to?.id} size={6}/>
                  <span style={{color:to?.color}}>{to?.dissolvedName||to?.name}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
      {/* Tableau parcours */}
      <div style={{background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:12,padding:m?12:18,marginBottom:m?12:18,overflowX:"auto"}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#60607a",marginBottom:12}}>PARCOURS</div>
        <div style={{display:"flex",gap:8,minWidth:"fit-content"}}>
          {[{label:"O2024",key:"t24",evId:1,type:"olympiades"},{label:"O2025",key:"t25",evId:2,type:"olympiades"}].map(({label,key,evId,type})=>{
            const teamId2=player[key];
            const t=getTeam(teamId2);
            const rating=evId?RATINGS.find(r=>r.p===playerId&&r.e===evId):null;
            const participated=!!teamId2;
            // Team rank in this event
            const ev=evId?getEvent(evId):null;
            const evRank=ev&&t?(()=>{const rk=getEventRanking(ev);const pos=rk.findIndex(r=>r.teamId===teamId2)+1;return pos>0?pos:null;})():null;
            const nTeams=ev?getEventRanking(ev).length:0;
            return(
              <div key={label} onClick={()=>t&&nav("teamDetail",{teamId:t.id})} style={{flex:"1 1 80px",minWidth:80,background:"#13131f",borderRadius:10,padding:"10px 10px",textAlign:"center",border:participated?`1px solid ${t?.color}44`:"1px solid #1e1e30",cursor:t?"pointer":"default"}}>
                <div style={{fontSize:10,color:getETC(type),fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>{label}</div>
                {participated&&t?(
                  <>
                    <div style={{width:28,height:28,borderRadius:"50%",background:t.color+"22",border:`2px solid ${t.color}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 6px",fontSize:12}}>{(t.dissolvedName||t.name).charAt(0)}</div>
                    <div style={{fontSize:11,fontWeight:600,color:t.color,lineHeight:1.2}}>{t.dissolvedName||t.name}</div>
                    {rating&&<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:rating.r>=1.8?"#E8B84B":rating.r>=1.6?"#34d399":"#60a5fa",marginTop:4}}>{rating.r.toFixed(2)}</div>}
                    {evRank&&<div style={{fontSize:10,color:"#60607a",marginTop:3}}>{MEDALS[evRank-1]||evRank+"e"}/{nTeams}</div>}
                  </>
                ):(<div style={{color:"#2a2a40",fontSize:12,marginTop:8}}>—</div>)}
              </div>
            );
          })}
          {/* Squid Game card */}
          {(()=>{
            const sqRating=RATINGS.find(r=>r.p===playerId&&r.e===3);
            if(!sqRating)return null;
            const sqRatings=RATINGS.filter(r=>r.e===3).sort((a,b)=>b.r-a.r);
            const sqPos=sqRatings.findIndex(r=>r.p===playerId)+1;
            const sqTotal=sqRatings.length;
            return(
              <div style={{flex:"1 1 80px",minWidth:80,background:"#13131f",borderRadius:10,padding:"10px 10px",textAlign:"center",border:"1px solid #E84D9B44"}}>
                <div style={{fontSize:10,color:"#E84D9B",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>SG 25'</div>
                <div style={{fontSize:22,marginBottom:4}}>{sqPos===1?"👑":sqPos<=3?MEDALS[sqPos-1]:"💀"}</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:sqRating.r>=1.9?"#E8B84B":sqRating.r>=1.7?"#34d399":"#E84D9B"}}>{sqRating.r.toFixed(2)}</div>
                <div style={{fontSize:10,color:"#60607a",marginTop:3}}>{sqPos}e/{sqTotal}</div>
              </div>
            );
          })()}
          {/* eO2026 + O2026 */}
          {[{label:"eO2026",key:"teo",evId:4,type:"jv"},{label:"O2026",key:"t26",evId:null,type:"olympiades"}].map(({label,key,evId,type})=>{
            const teamId2=player[key];
            const t=getTeam(teamId2);
            const rating=evId?RATINGS.find(r=>r.p===playerId&&r.e===evId):null;
            const participated=!!teamId2;
            const ev=evId?getEvent(evId):null;
            const evRank=ev&&t?(()=>{const rk=getEventRanking(ev);const pos=rk.findIndex(r=>r.teamId===teamId2)+1;return pos>0?pos:null;})():null;
            const nTeams=ev?getEventRanking(ev).length:0;
            return(
              <div key={label} onClick={()=>t&&nav("teamDetail",{teamId:t.id})} style={{flex:"1 1 80px",minWidth:80,background:"#13131f",borderRadius:10,padding:"10px 10px",textAlign:"center",border:participated?`1px solid ${t?.color}44`:"1px solid #1e1e30",cursor:t?"pointer":"default"}}>
                <div style={{fontSize:10,color:getETC(type),fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>{label}</div>
                {participated&&t?(
                  <>
                    <div style={{width:28,height:28,borderRadius:"50%",background:t.color+"22",border:`2px solid ${t.color}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 6px",fontSize:12}}>{(t.dissolvedName||t.name).charAt(0)}</div>
                    <div style={{fontSize:11,fontWeight:600,color:t.color,lineHeight:1.2}}>{t.dissolvedName||t.name}</div>
                    {rating&&<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:rating.r>=1.8?"#E8B84B":rating.r>=1.6?"#34d399":"#60a5fa",marginTop:4}}>{rating.r.toFixed(2)}</div>}
                    {evRank&&<div style={{fontSize:10,color:"#60607a",marginTop:3}}>{MEDALS[evRank-1]||evRank+"e"}/{nTeams}</div>}
                  </>
                ):(<div style={{color:"#2a2a40",fontSize:12,marginTop:8}}>—</div>)}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:m?12:18}}>
        <div style={{background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:12,padding:18}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#60607a",marginBottom:14}}>PODIUMS INDIVIDUELS</div>
          {podiums.length===0?(
            <p style={{color:"#60607a",fontSize:12,marginBottom:16}}>Aucune épreuve individuelle enregistrée.</p>
          ):(
            <>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                {[{pos:1,icon:"🥇",color:"#E8B84B",label:"Or"},{pos:2,icon:"🥈",color:"#aaaaaa",label:"Argent"},{pos:3,icon:"🥉",color:"#c87533",label:"Bronze"}].map(({pos,icon,color,label})=>{
                  const count=podiums.filter(p=>p.pos===pos).length;
                  return(
                    <div key={pos} style={{flex:1,background:"#13131f",borderRadius:8,padding:"10px 8px",textAlign:"center",border:`1px solid ${color}33`}}>
                      <div style={{fontSize:20,marginBottom:3}}>{icon}</div>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color,lineHeight:1}}>{count}</div>
                      <div style={{fontSize:9,color:"#60607a",textTransform:"uppercase",letterSpacing:"0.05em",marginTop:2}}>{label}</div>
                    </div>
                  );
                })}
              </div>
              <PodiumDetail podiums={podiums} nav={nav}/>
            </>
          )}
          <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid #1e1e30"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:"#60607a",marginBottom:10}}>STATS CARRIÈRE</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div style={{background:"#13131f",borderRadius:8,padding:"9px 11px"}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:tc,lineHeight:1}}>{ratings.length}</div>
                <div style={{fontSize:10,color:"#60607a",marginTop:2}}>Éditions</div>
                <div style={{fontSize:9,color:"#404058",marginTop:1}}>Top {edRankPct}% en présence</div>
              </div>
              <div style={{background:"#13131f",borderRadius:8,padding:"9px 11px"}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:"#E8B84B",lineHeight:1}}>{myGold}🥇</div>
                <div style={{fontSize:10,color:"#60607a",marginTop:2}}>Médailles d'or</div>
                <div style={{fontSize:9,color:"#404058",marginTop:1}}>{medalRank>0?"#"+medalRank+" tableau médailles":"—"}</div>
              </div>
              <div style={{background:"#13131f",borderRadius:8,padding:"9px 11px"}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:myPct>=50?"#E8B84B":myPct>=33?"#34d399":tc,lineHeight:1}}>{myPct}%</div>
                <div style={{fontSize:10,color:"#60607a",marginTop:2}}>% Podium</div>
                <div style={{fontSize:9,color:"#404058",marginTop:1}}>{podPctRank>0?"#"+podPctRank+" · "+myEpCount+" épr. · "+myPodTotal+" pods":"—"}</div>
              </div>
              <div style={{background:"#13131f",borderRadius:8,padding:"9px 11px"}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:tc,lineHeight:1}}>{allRank>0?"#"+allRank:"—"}</div>
                <div style={{fontSize:10,color:"#60607a",marginTop:2}}>Rang rating</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DATA PAGE ───────────────────────────────────────
function DataPage(){
  const m=useIsMobile();
  const PIN="2606";
  const [unlocked,setUnlocked]=useState(()=>sessionStorage.getItem("utopia_pin")==="ok");
  const [input,setInput]=useState("");
  const [err,setErr]=useState(false);
  const [tab,setTab]=useState("players");
  const [data,setData]=useState({players:[],teams:[]});
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState(null);
  // Forms
  const [newPlayer,setNewPlayer]=useState({name:"",uid:"",team_id:""});
  const [newTeam,setNewTeam]=useState({name:"",color:"#E8B84B",color2:"#FFFFFF",active:true});
  const [editPlayer,setEditPlayer]=useState(null);

  useEffect(()=>{if(unlocked)loadData();},[unlocked]);

  async function loadData(){
    setLoading(true);
    try{
      const [players,teams]=await Promise.all([
        sbFetch("players","?select=id,name,uid,team_id,t26&order=name"),
        sbFetch("teams","?select=id,name,color,active&order=name")
      ]);
      setData({players,teams});
    }catch(e){setMsg({type:"error",text:e.message});}
    setLoading(false);
  }

  function tryPin(){
    if(input===PIN){setUnlocked(true);sessionStorage.setItem("utopia_pin","ok");setErr(false);}
    else{setErr(true);setInput("");}
  }

  async function createPlayer(){
    if(!newPlayer.name.trim()){setMsg({type:"error",text:"Prénom requis"});return;}
    setSaving(true);
    try{
      const uid=newPlayer.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");
      const maxId=Math.max(...data.players.map(p=>p.id),0);
      await sbInsert("players",{id:maxId+1,uid:newPlayer.uid||uid,name:newPlayer.name,team_id:newPlayer.team_id||null,t26:newPlayer.team_id||null});
      setMsg({type:"success",text:`${newPlayer.name} ajouté !`});
      setNewPlayer({name:"",uid:"",team_id:""});
      await loadData();
    }catch(e){setMsg({type:"error",text:e.message});}
    setSaving(false);
  }

  async function updatePlayer(player){
    setSaving(true);
    try{
      await sbUpdate("players",{id:player.id},{name:player.name,team_id:player.team_id||null,t26:player.team_id||null});
      setMsg({type:"success",text:"Joueur mis à jour"});
      setEditPlayer(null);
      await loadData();
    }catch(e){setMsg({type:"error",text:e.message});}
    setSaving(false);
  }

  async function createTeam(){
    if(!newTeam.name.trim()){setMsg({type:"error",text:"Nom requis"});return;}
    setSaving(true);
    try{
      const maxId=Math.max(...data.teams.map(t=>t.id),0);
      await sbInsert("teams",{id:maxId+1,...newTeam});
      setMsg({type:"success",text:`${newTeam.name} créée !`});
      setNewTeam({name:"",color:"#E8B84B",color2:"#FFFFFF",active:true});
      await loadData();
    }catch(e){setMsg({type:"error",text:e.message});}
    setSaving(false);
  }

  if(!unlocked) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"80vh"}}>
      <div style={{background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:16,padding:"40px 48px",textAlign:"center",maxWidth:340,width:"100%"}}>
        <div style={{fontSize:32,marginBottom:12}}>🔒</div>
        <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,marginBottom:6}}>ACCÈS ADMIN</h2>
        <p style={{color:"#60607a",fontSize:12,marginBottom:24}}>Zone protégée.</p>
        <input type="password" maxLength={4} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&tryPin()} placeholder="• • • •" autoFocus
          style={{width:"100%",background:"#13131f",border:`1px solid ${err?"#ef4444":"#1e1e30"}`,borderRadius:10,padding:"12px 16px",color:"#eeeef5",fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:"0.3em",textAlign:"center",outline:"none",marginBottom:8,boxSizing:"border-box"}}/>
        {err&&<p style={{color:"#ef4444",fontSize:12,marginBottom:8}}>Code incorrect.</p>}
        <button onClick={tryPin} style={{width:"100%",background:"#E8B84B",color:"#080810",border:"none",borderRadius:10,padding:"12px",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",marginTop:8}}>Entrer</button>
      </div>
    </div>
  );

  const G={background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:12,padding:18};
  const INPUT={background:"#13131f",border:"1px solid #1e1e30",borderRadius:8,padding:"8px 12px",color:"#eeeef5",fontFamily:"'Outfit',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"};
  const BTN=(color="#E8B84B")=>({background:color,color:color==="#E8B84B"?"#080810":"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer"});

  return(
    <div style={{padding:m?"14px 14px 76px":"40px 32px",maxWidth:1000,margin:"0 auto"}} className="fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:20}}>
        <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:m?36:50}}>ADMIN <span style={{color:"#E8B84B"}}>PANEL</span></h1>
        <button onClick={()=>{sessionStorage.removeItem("utopia_pin");setUnlocked(false);}} style={{background:"none",border:"none",color:"#404058",fontSize:12,cursor:"pointer"}}>🔒 Verrouiller</button>
      </div>

      {msg&&<div style={{marginBottom:16,padding:"10px 14px",background:msg.type==="error"?"#1a0a0a":"#0a1a0a",border:`1px solid ${msg.type==="error"?"#ef444433":"#34d39933"}`,borderRadius:8,fontSize:12,color:msg.type==="error"?"#ef4444":"#34d399",display:"flex",justifyContent:"space-between"}}>
        <span>{msg.text}</span><button onClick={()=>setMsg(null)} style={{background:"none",border:"none",color:"#60607a",cursor:"pointer"}}>×</button>
      </div>}

      {/* Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:20,background:"#13131f",borderRadius:8,padding:4,width:"fit-content",border:"1px solid #1e1e30"}}>
        {[{id:"players",l:"👤 Joueurs"},{id:"teams",l:"🏆 Équipes"},{id:"stats",l:"📊 Stats"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 18px",borderRadius:6,cursor:"pointer",background:tab===t.id?"#E8B84B":"transparent",color:tab===t.id?"#080810":"#60607a",border:"none",fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:600}}>{t.l}</button>
        ))}
      </div>

      {loading&&<div style={{color:"#60607a",textAlign:"center",padding:40}}>Chargement depuis Supabase...</div>}

      {/* PLAYERS TAB */}
      {tab==="players"&&!loading&&(
        <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:18}}>
          {/* Add player */}
          <div style={{...G}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#60607a",marginBottom:14}}>AJOUTER UN JOUEUR</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <input placeholder="Prénom *" value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer,name:e.target.value})} style={{...INPUT,width:"100%"}}/>
              <select value={newPlayer.team_id} onChange={e=>setNewPlayer({...newPlayer,team_id:e.target.value})} style={{...INPUT,width:"100%"}}>
                <option value="">-- Équipe actuelle --</option>
                {data.teams.filter(t=>t.active).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={createPlayer} disabled={saving} style={BTN()}>{saving?"...":"Ajouter"}</button>
            </div>
          </div>

          {/* Players list */}
          <div style={{...G,maxHeight:500,overflowY:"auto"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#60607a",marginBottom:14}}>JOUEURS ({data.players.length})</div>
            {data.players.map(p=>{
              const isEdit=editPlayer?.id===p.id;
              const t=data.teams.find(t=>t.id===p.team_id);
              return(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid #1e1e30"}}>
                  {isEdit?(
                    <>
                      <input value={editPlayer.name} onChange={e=>setEditPlayer({...editPlayer,name:e.target.value})} style={{...INPUT,flex:1,padding:"4px 8px",fontSize:11}}/>
                      <select value={editPlayer.team_id||""} onChange={e=>setEditPlayer({...editPlayer,team_id:e.target.value||null})} style={{...INPUT,fontSize:11,padding:"4px 8px"}}>
                        <option value="">Libre</option>
                        {data.teams.filter(t=>t.active).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <button onClick={()=>updatePlayer(editPlayer)} style={{...BTN(),padding:"4px 8px",fontSize:10}}>✓</button>
                      <button onClick={()=>setEditPlayer(null)} style={{...BTN("#404058"),padding:"4px 8px",fontSize:10}}>✗</button>
                    </>
                  ):(
                    <>
                      <span style={{fontSize:12,flex:1}}>{p.name}</span>
                      {t&&<span style={{fontSize:10,color:t.color,flexShrink:0}}>{t.name}</span>}
                      <button onClick={()=>setEditPlayer({...p})} style={{background:"none",border:"1px solid #1e1e30",borderRadius:4,color:"#60607a",cursor:"pointer",padding:"2px 6px",fontSize:10}}>✎</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TEAMS TAB */}
      {tab==="teams"&&!loading&&(
        <div style={{display:"grid",gridTemplateColumns:m?"1fr":"1fr 1fr",gap:18}}>
          <div style={{...G}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#60607a",marginBottom:14}}>CRÉER UNE ÉQUIPE</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <input placeholder="Nom *" value={newTeam.name} onChange={e=>setNewTeam({...newTeam,name:e.target.value})} style={{...INPUT,width:"100%"}}/>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <label style={{fontSize:11,color:"#60607a",flexShrink:0}}>Couleur 1</label>
                <input type="color" value={newTeam.color} onChange={e=>setNewTeam({...newTeam,color:e.target.value})} style={{width:40,height:32,border:"none",background:"none",cursor:"pointer"}}/>
                <label style={{fontSize:11,color:"#60607a",flexShrink:0}}>Couleur 2</label>
                <input type="color" value={newTeam.color2} onChange={e=>setNewTeam({...newTeam,color2:e.target.value})} style={{width:40,height:32,border:"none",background:"none",cursor:"pointer"}}/>
              </div>
              <button onClick={createTeam} disabled={saving} style={BTN()}>{saving?"...":"Créer l'équipe"}</button>
            </div>
          </div>

          <div style={{...G,maxHeight:500,overflowY:"auto"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#60607a",marginBottom:14}}>ÉQUIPES ({data.teams.length})</div>
            {data.teams.map(t=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid #1e1e30"}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:t.color,flexShrink:0}}/>
                <span style={{fontSize:12,flex:1,color:t.active?"#eeeef5":"#60607a"}}>{t.name}</span>
                {!t.active&&<span style={{fontSize:9,color:"#404058",background:"#1e1e30",borderRadius:4,padding:"1px 5px"}}>Inactive</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STATS TAB */}
      {tab==="stats"&&!loading&&(
        <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"repeat(3,1fr)",gap:10}}>
          {[
            {label:"Équipes",count:TEAMS.length,color:"#E8B84B"},
            {label:"Joueurs",count:PLAYERS.length,color:"#34d399"},
            {label:"Événements",count:EVENTS.length,color:"#818cf8"},
            {label:"Épreuves",count:EVENTS.reduce((s,e)=>s+(e.epreuves?.length||0),0),color:"#f472b6"},
            {label:"Ratings",count:RATINGS.length,color:"#fb923c"},
            {label:"En BDD",count:data.players.length,color:"#60a5fa"},
          ].map(({label,count,color})=>(
            <div key={label} style={{background:"#0d0d1c",border:`1px solid ${color}33`,borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:"#60607a",fontSize:12}}>{label}</span>
              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color}}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── APP ─────────────────────────────────────────────
export default function App(){
  const [page,setPage]=useState("home");
  const [sub,setSub]=useState({});
  useEffect(()=>{const l=document.createElement("link");l.href=FONT_URL;l.rel="stylesheet";document.head.appendChild(l);},[]);
  function nav(p,s={}){setPage(p);setSub(s);try{window.scrollTo(0,0);}catch(e){}}
  return(
    <div style={{minHeight:"100vh",background:"#080810",color:"#eeeef5",fontFamily:"'Outfit',sans-serif"}}>
      <style>{css}</style>
      <NavBar page={page} setPage={p=>nav(p)}/>
      <div key={page+JSON.stringify(sub)} className="fade">
        {page==="home"         &&<HomePage nav={nav}/>}
        {page==="events"       &&<EventsPage nav={nav}/>}
        {page==="eventDetail"  &&<EventDetailPage eventId={sub.eventId} nav={nav}/>}
        {page==="rankings"     &&<RankingsPage nav={nav}/>}
        {page==="playerDetail" &&<PlayerDetailPage playerId={sub.playerId} nav={nav}/>}
        {page==="teams"        &&<TeamsPage nav={nav}/>}
        {page==="teamDetail"   &&<TeamDetailPage teamId={sub.teamId} nav={nav}/>}
        {page==="admin"        &&<DataPage/>}
      </div>
    </div>
  );
}
