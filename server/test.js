const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req,res)=>{
  res.end('Hello World!');
}).listen(PORT, ()=>console.log('Test server running on port', PORT));