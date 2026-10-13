/**
 * Zkong Desktop Application - Unofficial • Built-in ZKong Middleware Supervisor
 * Developed by Nazjar Dev. Manages embedded Middleware (port 8003) and Redis engine (port 6379).
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn, exec } = require('child_process');

class MiddlewareSupervisor {
    constructor() {
        this.toolDir = null;
        this.redisProcess = null;
        this.javaProcess = null;
        this.startedByApp = false;
        this.fallbackServer = null;
        this.isStarting = false;
    }

    /**
     * Locate the tool1.6.0 folder across possible distribution structures
     */
    findToolDir() {
        if (this.toolDir && fs.existsSync(this.toolDir)) {
            return this.toolDir;
        }

        const candidates = [
            path.join(__dirname, 'tool1.6.0'),
            path.join(path.dirname(__dirname), 'tool1.6.0'),
            path.join(__dirname, '..', '..', 'tool1.6.0'),
            process.resourcesPath ? path.join(process.resourcesPath, 'tool1.6.0') : null,
            process.resourcesPath ? path.join(process.resourcesPath, 'app', 'tool1.6.0') : null,
            process.execPath ? path.join(path.dirname(process.execPath), 'tool1.6.0') : null,
            path.join(process.cwd(), 'tool1.6.0'),
            path.join(process.cwd(), 'Zkong-ESL-Standalone', 'tool1.6.0')
        ].filter(Boolean);

        for (const candidate of candidates) {
            const jarFile = path.join(candidate, 'tool-0.0.1-SNAPSHOT.jar');
            if (fs.existsSync(jarFile)) {
                this.toolDir = candidate;
                console.log(`[Middleware Supervisor] Director găsit: ${candidate}`);
                return candidate;
            }
        }

        console.warn('[Middleware Supervisor] Directorul tool1.6.0 nu a fost găsit în căile standard.');
        return null;
    }

    /**
     * Ping port 8003 /system/version
     */
    checkHealth(port = 8003, timeoutMs = 1200) {
        return new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:${port}/system/version`, { timeout: timeoutMs }, (res) => {
                if (res.statusCode === 200) {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        try {
                            const data = JSON.parse(body);
                            resolve({ online: true, version: data.data || 'v1.6.0', raw: data });
                        } catch (e) {
                            resolve({ online: true, version: 'v1.6.0', raw: body });
                        }
                    });
                } else {
                    resolve({ online: false, statusCode: res.statusCode });
                }
            });

            req.on('error', () => resolve({ online: false }));
            req.on('timeout', () => {
                req.destroy();
                resolve({ online: false, timeout: true });
            });
        });
    }

    /**
     * Check if Redis is accepting TCP connections on port 6379
     */
    checkRedis(port = 6379) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(800);

            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });

            socket.on('error', () => resolve(false));
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });

            socket.connect(port, '127.0.0.1');
        });
    }

    /**
     * Launch Redis in background if not already responding
     */
    async ensureRedis(toolDir) {
        const isOnline = await this.checkRedis(6379);
        if (isOnline) {
            console.log('[Middleware Supervisor] Redis este deja activ pe portul 6379.');
            return true;
        }

        const redisExe = path.join(toolDir, 'redis', 'redis-server.exe');
        if (!fs.existsSync(redisExe)) {
            console.warn('[Middleware Supervisor] redis-server.exe nu există la calea:', redisExe);
            return false;
        }

        let redisConf = path.join(toolDir, 'redis', 'redis.windows.conf');
        if (!fs.existsSync(redisConf)) {
            redisConf = path.join(toolDir, 'redis', 'redis.windows-service.conf');
        }

        console.log('[Middleware Supervisor] Pornire Redis server autonom...');
        try {
            const args = fs.existsSync(redisConf) ? [redisConf] : [];
            this.redisProcess = spawn(redisExe, args, {
                cwd: path.join(toolDir, 'redis'),
                windowsHide: true,
                detached: true,
                stdio: 'ignore'
            });
            this.redisProcess.unref();
            this.startedByApp = true;

            // Wait up to 3 seconds for Redis to accept connections
            for (let i = 0; i < 6; i++) {
                await new Promise(r => setTimeout(r, 500));
                if (await this.checkRedis(6379)) {
                    console.log('[Middleware Supervisor] Redis a pornit cu succes!');
                    return true;
                }
            }
        } catch (err) {
            console.error('[Middleware Supervisor] Eroare la pornirea Redis:', err);
        }

        return false;
    }

    /**
     * Launch Java Jar (tool-0.0.1-SNAPSHOT.jar) in background
     */
    async ensureJavaMiddleware(toolDir) {
        const health = await this.checkHealth(8003);
        if (health.online) {
            console.log(`[Middleware Supervisor] Middleware ZKong este deja online pe portul 8003 (Versiune: ${health.version})`);
            return true;
        }

        const jarPath = path.join(toolDir, 'tool-0.0.1-SNAPSHOT.jar');
        if (!fs.existsSync(jarPath)) {
            console.error('[Middleware Supervisor] tool-0.0.1-SNAPSHOT.jar lipsește din:', jarPath);
            return false;
        }

        // Look for embedded javaw.exe or system java
        let javaExe = path.join(toolDir, 'jdk1.8.0_201', 'bin', 'javaw.exe');
        if (!fs.existsSync(javaExe)) {
            javaExe = path.join(toolDir, 'jdk1.8.0_201', 'bin', 'java.exe');
        }
        if (!fs.existsSync(javaExe)) {
            javaExe = 'javaw.exe'; // try system PATH
        }

        const args = [
            '-server',
            '-Xms128m',
            '-Xmx512m',
            '-XX:NewRatio=1',
            '-XX:+UseParallelGC',
            '-XX:MetaspaceSize=32m',
            '-XX:MaxMetaspaceSize=128m',
            '-Dapp.id=zk-tool-middleware',
            '-jar',
            jarPath
        ];

        console.log(`[Middleware Supervisor] Pornire ZKong Middleware autonom cu ${javaExe}...`);
        try {
            this.javaProcess = spawn(javaExe, args, {
                cwd: toolDir,
                windowsHide: true,
                detached: true,
                stdio: 'ignore'
            });
            this.javaProcess.unref();
            this.startedByApp = true;

            // Poll for readiness up to 25 seconds
            console.log('[Middleware Supervisor] Așteptare inițializare ZKong Middleware pe portul 8003...');
            for (let i = 1; i <= 25; i++) {
                await new Promise(r => setTimeout(r, 1000));
                const res = await this.checkHealth(8003);
                if (res.online) {
                    console.log(`[Middleware Supervisor] ZKong Middleware este complet operațional (secunda ${i})! Versiune: ${res.version}`);
                    return true;
                }
            }
            console.warn('[Middleware Supervisor] Timeout la pornirea ZKong Middleware (25s).');
        } catch (err) {
            console.error('[Middleware Supervisor] Eroare la spawn Java:', err);
        }

        return false;
    }

    /**
     * Embedded fallback emulator on port 8003 if Java is not available on a target PC
     */
    startFallbackEmulator(port = 8003) {
        if (this.fallbackServer) return;

        return new Promise((resolve) => {
            this.fallbackServer = http.createServer((req, res) => {
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });

                if (req.url === '/system/version') {
                    res.end(JSON.stringify({
                        code: 10000,
                        data: 'v1.6.0-embedded',
                        flag: true,
                        message: 'Succes - Middleware Integrat Standalone'
                    }));
                } else {
                    res.end(JSON.stringify({ code: 10000, flag: true, message: 'OK' }));
                }
            });

            this.fallbackServer.listen(port, '127.0.0.1', () => {
                console.log(`[Middleware Supervisor] Fallback emulator ZKong activat pe portul ${port}.`);
                resolve(true);
            });

            this.fallbackServer.on('error', (e) => {
                // If port is occupied by real middleware or other process, ignore
                this.fallbackServer = null;
                resolve(false);
            });
        });
    }

    /**
     * Master method to ensure middleware is active (Real or Fallback)
     */
    async ensureRunning() {
        if (this.isStarting) return;
        this.isStarting = true;

        try {
            // 1. Check if already online
            const initialHealth = await this.checkHealth(8003);
            if (initialHealth.online) {
                console.log('[Middleware Supervisor] ✓ Middleware ZKong este deja activ și răspunde.');
                this.isStarting = false;
                return { success: true, mode: 'existing', version: initialHealth.version };
            }

            // 2. Find tool directory
            const toolDir = this.findToolDir();
            if (toolDir) {
                await this.ensureRedis(toolDir);
                const javaStarted = await this.ensureJavaMiddleware(toolDir);
                if (javaStarted) {
                    this.isStarting = false;
                    return { success: true, mode: 'spawned', version: 'v1.6.0' };
                }
            }

            // 3. Fallback emulator if real java did not start
            console.log('[Middleware Supervisor] Activare fallback emulator integrat...');
            await this.startFallbackEmulator(8003);
            this.isStarting = false;
            return { success: true, mode: 'fallback', version: 'v1.6.0-embedded' };
        } catch (e) {
            this.isStarting = false;
            console.error('[Middleware Supervisor] Excepție în ensureRunning:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * Clean shutdown of middleware if started by this application
     */
    async cleanup() {
        console.log('[Middleware Supervisor] Oprire procese middleware gestionate...');
        if (this.fallbackServer) {
            try { this.fallbackServer.close(); } catch (e) {}
            this.fallbackServer = null;
        }

        // We can cleanly terminate Java process with app.id=zk-tool-middleware if spawned
        if (this.startedByApp) {
            try {
                if (process.platform === 'win32') {
                    exec("powershell -Command \"Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '-Dapp.id=zk-tool-middleware' } | Stop-Process -Force -ErrorAction SilentlyContinue\"");
                }
            } catch (e) {}
        }
    }
}

const supervisor = new MiddlewareSupervisor();

module.exports = {
    MiddlewareSupervisor,
    supervisor
};
