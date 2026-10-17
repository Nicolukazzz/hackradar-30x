import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Carpetas cuya lógica debe ser determinista. tests/arquitectura/reloj.test.ts usa la misma lista.
export const CARPETAS_SIN_RELOJ = ["dominio", "reglas", "aprobaciones", "registro", "evaluacion"];
const MENSAJE_RELOJ = "Prohibido leer el reloj aquí (Date.now() / new Date()): usar `ahora` inyectado (especificación §3).";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Especificación §3 y §5 (invariante 4): la lógica de decisión recibe `ahora` inyectado y nunca lee el reloj.
  {
    files: [`src/{${CARPETAS_SIN_RELOJ.join(",")}}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "MemberExpression[object.name='Date'][property.name='now']", message: MENSAJE_RELOJ },
        { selector: "MemberExpression[object.name='Date'][property.value='now']", message: MENSAJE_RELOJ },
        { selector: "MemberExpression[object.property.name='Date'][property.name='now']", message: MENSAJE_RELOJ },
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: MENSAJE_RELOJ },
        { selector: "NewExpression[callee.property.name='Date'][arguments.length=0]", message: MENSAJE_RELOJ },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts", ".claude/**", ".venv/**", "data/**"]),
]);

export default eslintConfig;
