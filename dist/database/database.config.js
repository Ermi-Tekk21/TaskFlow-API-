"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseConfig = void 0;
const getDatabaseConfig = (configService) => {
    return {
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_DATABASE', 'taskflow_db'),
        autoLoadEntities: true,
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
    };
};
exports.getDatabaseConfig = getDatabaseConfig;
//# sourceMappingURL=database.config.js.map