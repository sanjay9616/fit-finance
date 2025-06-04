"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors();
    const PORT = process.env.PORT || 5000;
    await app.listen(PORT, '0.0.0.0');
    console.log(`🚀 Server running on: http://localhost:${PORT}`);
}
bootstrap();
//# sourceMappingURL=main.js.map