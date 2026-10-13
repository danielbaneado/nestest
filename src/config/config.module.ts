import { Module, DynamicModule } from '@nestjs/common';
import { ConfigService } from './config.service.js';

@Module({
    providers: [ConfigService],
    exports: [ConfigService]
})
export class ConfigModule {
    static forRoot(options: { isGlobal: boolean } = { isGlobal: false }): DynamicModule {
        return {
            module: ConfigModule,
            providers: [ConfigService],
            exports: [ConfigService],
            global: options.isGlobal,
        };
    }
}