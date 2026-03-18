import { Rcon } from "rcon-client";

async function main() {

try {

const rcon = await Rcon.connect({
host: "127.0.0.1",
port: 25575,
password: "123456"
});

console.log("✅ CONECTADO A MINECRAFT");

const res = await rcon.send("say RCON conectado correctamente");

console.log("Respuesta:", res);

await rcon.end();

} catch (err) {

console.log("❌ ERROR CONECTANDO:");
console.error(err);

}

}

main();