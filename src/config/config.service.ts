import { readFileSync, existsSync } from "fs";
import { parse } from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

export class ConfigService {
    private readonly envConfig: { [key: string]: string };

    constructor() {
        const isDev: boolean = process.env.NODE_ENV !== "production";

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);

        if (isDev) {
            const envFilePath = __dirname + "/../../.env";
            const existsPath = existsSync(envFilePath);

            if (!existsPath) {
                console.log(".env no encontrado");
                process.exit(0);
            }

            this.envConfig = parse(readFileSync(envFilePath));
        } else {
            this.envConfig = {};
        }

        // Las variables ya presentes en process.env tienen prioridad sobre el
        // contenido del archivo .env (común en Docker/CI/produccion).
        for (const [key, value] of Object.entries(process.env)) {
            if (value !== undefined) {
                this.envConfig[key] = value;
            }
        }
    }

    get(key: string): string {
        return this.envConfig[key];
    }

    getOrThrow(key: string): string {
        const value = this.get(key);

        if (!value) {
            throw new Error(`ConfigService: falta la variable de entorno "${key}"`);
        }

        return value;
    }
}