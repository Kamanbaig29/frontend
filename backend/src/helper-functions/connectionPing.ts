// /**
//  * Attach ONLY ping-pong handler to a WebSocket connection.
//  * Client should send: { type: "PING", pingSent: <timestamp> }
//  * Server replies:     { type: "PONG", pingSent: <timestamp> }
//  * 
//  * Yeh function sirf latency ke liye hai, dusre messages ignore karega.
//  */
// export function attachConnectionPing(ws: import('ws').WebSocket) {
//   ws.on('message', (message: string) => {
//     try {
//       const data = JSON.parse(message);

//       // Sirf ping-pong handle karo, baaki ignore
//       if (data.type === "PING" && typeof data.pingSent === "number") {
//         ws.send(JSON.stringify({ type: "PONG", pingSent: data.pingSent }));
//       }
//     } catch {
//       // Ignore parse errors
//     }
//   });
// }