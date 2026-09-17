const { networkInterfaces } = require('os');
const fs = require('fs');
const path = require('path');

const nets = networkInterfaces();
let ip = 'localhost';
for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    if (net.family === 'IPv4' && !net.internal) {
      ip = net.address;
      break;
    }
  }
  if (ip !== 'localhost') break;
}

const apiPath = path.join(__dirname, 'app_prototype', 'src', 'services', 'api.ts');
let content = fs.readFileSync(apiPath, 'utf8');
content = content.replace(/return 'http:\/\/localhost:8000';/g, `return 'http://${ip}:8000';`);
fs.writeFileSync(apiPath, content);
console.log('IP updated to', ip);
