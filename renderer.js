const { Rcon } = require("rcon-client");
const { WebcastPushConnection } = require("tiktok-live-connector");
const fs = require("fs");
  function saveLikes(total){
    fs.writeFileSync("likes.json", JSON.stringify({likes: total}));
}

const logBox = document.getElementById("log");
const rulesList = document.getElementById("rules");
const likeCounter = document.getElementById("likeCounter");
const rankingBox = document.getElementById("giftRanking");

let rcon = null;
let tiktok = null;

let totalLikes = 0;
let totalShares = 0;

let lastUser = "viewer";

let rules = [];

let wavesActive = true;

let editingIndex = null;

let triggeredMilestones = {};
let lastEveryTrigger = {};

let giftRanking = {};

let likeBuffer = 0;

let maxCommandsPerSecond = 120;
let commandsThisSecond = 0;

/* =====================
COMMAND QUEUE SYSTEM
===================== */

let commandQueue = [];
let processingQueue = false;

async function executeCommand(cmd,user){

    if(!rcon){
        log("⚠️ Minecraft no conectado");
        return;
    }

    let commands = cmd.split(/\n|;/).map(c=>c.trim()).filter(Boolean);

    commands = commands.map(c => c.replace("{user}",user));

    if(commandsThisSecond > maxCommandsPerSecond){

    log("⚠️ Demasiadas entidades - límite alcanzado");

    return;

}

    commandQueue.push(...commands);

    processQueue();
}

async function processQueue(){

    if(processingQueue) return;

    processingQueue = true;

    const batchSize = 20; // cuantos comandos mandar al mismo tiempo

    while(commandQueue.length > 0){

        const batch = commandQueue.splice(0,batchSize);

        try{

            await Promise.all(
                batch.map(cmd => rcon.send(cmd))
            );

            batch.forEach(cmd => log("⚡ "+cmd));

        }catch(err){

            log("❌ Error comando "+err.message);

        }

    }

    processingQueue = false;

}

/* =====================
CARGAR REGLAS
===================== */

if (fs.existsSync("rules.json")) {
    try {
        rules = JSON.parse(fs.readFileSync("rules.json"));
    } catch (e) {
        console.log("Error cargando reglas");
    }
}

/* =====================
LOG
===================== */

function log(text){
    const line=document.createElement("div");
    line.innerText=text;
    logBox.appendChild(line);
    logBox.scrollTop=logBox.scrollHeight;
    console.log(text);
}

/* =====================
GUARDAR REGLAS
===================== */

function saveRules(){
    fs.writeFileSync("rules.json",JSON.stringify(rules,null,2));
}

/* =====================
RANKING DONADORES
===================== */

function updateRanking(){

    if(!rankingBox)return;

    rankingBox.innerHTML="";

    const sorted=Object.entries(giftRanking)
        .sort((a,b)=>b[1]-a[1])
        .slice(0,10);

    sorted.forEach(([user,count])=>{
        const li=document.createElement("li");
        li.innerText=`${user} — ${count} gifts`;
        rankingBox.appendChild(li);
    });
}

/* =====================
REFRESCAR LISTA
===================== */

function refreshRules(){

    rulesList.innerHTML="";

    rules.forEach((r,index)=>{

        const li=document.createElement("li");

        li.innerHTML=`

        <input type="checkbox" class="toggleRule" data-index="${index}" ${r.enabled !== false ? "checked" : ""}>

        <b>${r.event}</b> → ${r.amount}
        <br>
        <code>${r.command}</code>
        <br>

        <button class="testRule" data-index="${index}">▶ Probar</button>
        <button class="editRule" data-index="${index}">✏ Editar</button>
        <button class="deleteRule" data-index="${index}">❌ Eliminar</button>
        `;

        rulesList.appendChild(li);

    });

    document.querySelectorAll(".toggleRule").forEach(btn=>{
        btn.onchange=()=>{
            const index=btn.getAttribute("data-index");
            rules[index].enabled = btn.checked;
            saveRules();
        };
    });

    document.querySelectorAll(".deleteRule").forEach(btn=>{
        btn.onclick=()=>{
            const index=btn.getAttribute("data-index");
            rules.splice(index,1);
            saveRules();
            refreshRules();
        };
    });

    document.querySelectorAll(".testRule").forEach(btn=>{
        btn.onclick=()=>{
            const index=btn.getAttribute("data-index");
            executeCommand(rules[index].command,"testUser");
        };
    });

    document.querySelectorAll(".editRule").forEach(btn=>{
        btn.onclick=()=>{
            const index=btn.getAttribute("data-index");

            document.getElementById("event").value=rules[index].event;
            document.getElementById("amount").value=rules[index].amount;
            document.getElementById("command").value=rules[index].command;

            editingIndex=index;
        };
    });

}

refreshRules();

/* =====================
MINECRAFT
===================== */

document.getElementById("connectMC").addEventListener("click",async()=>{

    try{

        rcon=await Rcon.connect({
            host:"127.0.0.1",
            port:25575,
            password:"123456"
        });

        log("✅ Minecraft conectado");

    }catch(err){

        log("❌ Error Minecraft "+err.message);

    }

});

/* =====================
TIKTOK
===================== */

document.getElementById("connectTT").addEventListener("click",async()=>{

    const username=document.getElementById("ttuser").value;

    if(!username){
        log("⚠️ Escribe un usuario");
        return;
    }

    tiktok=new WebcastPushConnection(username);

    tiktok.connect()
    .then(()=>{
        log("✅ TikTok conectado");
    })
    .catch(err=>{
        log("❌ Error TikTok "+err.message);
    });

/* =====================
LIKES
===================== */

tiktok.on("like",(data)=>{

    const likes = Number(data.likeCount) || 1;

    likeBuffer += likes;

    lastUser = data.uniqueId; // ← GUARDAR EL USER REAL

});

/* PROCESAR BUFFER */

setInterval(()=>{

    if(likeBuffer <= 0) return;

    totalLikes += likeBuffer;

    log(`❤️ Likes +${likeBuffer} (total: ${totalLikes})`);

    saveLikes(totalLikes); // ← ESTA LINEA NUEVA

    if(likeCounter){
        likeCounter.innerText = totalLikes;
    }

    checkRules("likes", totalLikes, lastUser);
    checkRules("likeevery", totalLikes, lastUser);
    checkRules("likecount", totalLikes, lastUser);
    likeBuffer = 0;

},200);

/* =====================
GIFTS
===================== */

tiktok.on("gift",(data)=>{

    const user=data.uniqueId;
    const gift=data.giftName;
    const amount=data.repeatCount||1;

    log(`🎁 ${user} envió ${gift} x${amount}`);

    giftRanking[user]=(giftRanking[user]||0)+amount;

    updateRanking();

    checkRules("gift",gift,user);
    checkRules("giftcombo",amount,user);

});

/* =====================
SHARES
===================== */

tiktok.on("social",(data)=>{

    if(data.displayType && data.displayType.includes("share")){

        const user = data.uniqueId;

        totalShares += 1;

        log(`🔁 ${user} compartió (total: ${totalShares})`);

        if(document.getElementById("shareCounter")){
            document.getElementById("shareCounter").innerText = totalShares;
        }

        checkRules("share",1,user);
        checkRules("sharecount",totalShares,user);

    }

});

});

/* =====================
CHECK RULES
===================== */

function checkRules(event,value,user){

    // Eventos que SIEMPRE funcionan
    const alwaysActive = ["gift","giftcombo","likecount","share","sharecount"];

    if(!alwaysActive.includes(event)){
        if(!wavesActive) return;
    }

    for(const r of rules){

        if(r.enabled === false) continue;

        if(r.event!==event) continue;

        const key=r.event+"_"+r.amount;

        const amount = Number(r.amount);

        if(!amount && event!=="gift") continue;

        if(event==="likeevery"){

            const current = Math.floor(value / amount);
            const last = lastEveryTrigger[key] || 0;

            if(current <= last) continue;

            for(let i = last + 1; i <= current; i++){
                executeCommand(r.command,user);
            }

            lastEveryTrigger[key] = current;
        }

        else if(event==="likecount" || event==="sharecount"){

            if(value>=amount){

                if(triggeredMilestones[key]) continue;

                triggeredMilestones[key]=true;

                executeCommand(r.command,user);
            }

        }

        else if(event==="gift"){

            if(String(value).toLowerCase()===String(r.amount).toLowerCase()){

                executeCommand(r.command,user);

            }

        }

        else{

            const count = Math.floor(value / amount);
            const last = lastEveryTrigger[key] || 0;

            if(count <= last) continue;

            for(let i = last + 1; i <= count; i++){
                executeCommand(r.command,user);
            }

            lastEveryTrigger[key] = count;
        }

    }

}

/* =====================
GUARDAR REGLA
===================== */

document.getElementById("saveRule").addEventListener("click",()=>{

    const event=document.getElementById("event").value;
    const amount=document.getElementById("amount").value;
    const command=document.getElementById("command").value;

    if(!event||!amount||!command){

        log("⚠️ Completa los campos");
        return;

    }

    if(editingIndex!==null){

        rules[editingIndex]={event,amount,command,enabled:true};
        editingIndex=null;

    }else{

        rules.push({event,amount,command,enabled:true});

    }

    saveRules();
    refreshRules();

});

/* =====================
SPAWN RAPIDO
===================== */

document.getElementById("spawnZombie")?.addEventListener("click",()=>{
executeCommand("execute at @p run summon zombie ~20 ~ ~","panel");
});

document.getElementById("spawnCreeper")?.addEventListener("click",()=>{
executeCommand("execute at @p run summon creeper ~20 ~ ~","panel");
});

document.getElementById("spawnSkeleton")?.addEventListener("click",()=>{
executeCommand("execute at @p run summon skeleton ~20 ~ ~","panel");
});

/* =====================
CONTROL OLEADAS
===================== */

document.getElementById("startWave")?.addEventListener("click",()=>{

    wavesActive = true;

    log("🌙 Oleada iniciada");

});

document.getElementById("stopWave")?.addEventListener("click",()=>{

    wavesActive = false;

    log("☀ Oleada pausada");

});