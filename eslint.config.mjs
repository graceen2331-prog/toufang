import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "storage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // 客户端代码禁止 import 服务端模块（server-only 兜底，这里提前在 lint 报错）
    files: ["src/components/**", "src/features/**", "src/lib/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/*", "@/generated/*"],
              message: "客户端代码不允许引入服务端模块，请通过 /api/v1 接口访问。",
            },
          ],
        },
      ],
    },
  },
  {
    // 业务 service 层禁止直接使用裸 prisma client，必须经 repository（租户注入）。
    // auth/audit 是跨租户基础设施模块，豁免；类型导入放行。
    files: ["src/server/modules/**/*.service.ts"],
    ignores: ["src/server/modules/auth/**", "src/server/modules/audit/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/db/client", "@/generated/*"],
              message: "service 层禁止直接访问 prisma，请通过同模块 repository。",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
