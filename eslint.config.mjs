import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Especificación §3: el dominio y las reglas reciben `ahora` inyectado; nunca leen el reloj.
  {
    files: ["src/dominio/**/*.ts", "src/reglas/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: "Prohibido Date.now() en dominio/reglas: usar `ahora` inyectado (especificación §3).",
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Prohibido new Date() sin argumentos en dominio/reglas: usar `ahora` inyectado (especificación §3).",
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts", ".claude/**"]),
]);

export default eslintConfig;
