import { Rcon } from "rcon-client";

let rcon = null;

export async function connectMinecraft() {

if (rcon) {
return true;
}

try {

rcon = await Rcon.connect({
host: "127.0.0.1",
port: 25575,
password: "123456"
});

console.log("RCON conectado");

return true;

} catch (error) {

console.error("Error RCON:", error);

return false;

}

}

export async function sendCommand(cmd) {

if (!rcon) {
throw new Error("No conectado a RCON");
}

const response = await rcon.send(cmd);

return response;

}