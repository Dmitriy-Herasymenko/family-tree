import { app } from './app';
import { pool, configured } from './db';
const port=Number(process.env.PORT || 3001);
const server=app.listen(port,'127.0.0.1',()=>console.log(`API: http://localhost:${port} (${configured?'database configured':'demo mode'})`));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close(()=>{void pool.end().then(()=>process.exit(0));});});
