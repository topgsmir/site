import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { it } from "node:test";
import ts from "typescript";

const intentionalExceptions = new Set([
  "auth.controller.ts:AuthController.logout",
  "comments.controller.ts:CommentsController.create",
  "comments.controller.ts:CommentsController.createBlog",
  "content-ai.controller.ts:ContentAiController.generate",
  "order.controller.ts:OrderController.markOrdersSeen"
]);

function controllerFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) return controllerFiles(location);
    return entry.name.endsWith("controller.ts") ? [location] : [];
  });
}

it("keeps mutation controllers covered by rate limits unless explicitly cheap or delegated", () => {
  const sourceRoot = path.resolve(process.cwd(), "src");
  const uncovered: string[] = [];

  for (const file of controllerFiles(sourceRoot)) {
    const source = readFileSync(file, "utf8");
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const declaration of sourceFile.statements.filter(ts.isClassDeclaration)) {
      for (const method of declaration.members.filter(ts.isMethodDeclaration)) {
        const decorators = ts.getDecorators(method) ?? [];
        const hasMutationDecorator = decorators.some((decorator) => {
          if (!ts.isCallExpression(decorator.expression)) return false;
          return ["Post", "Put", "Patch", "Delete"].includes(decorator.expression.expression.getText(sourceFile));
        });
        if (!hasMutationDecorator || method.getText(sourceFile).includes(".consume")) continue;
        const key = `${path.basename(file)}:${declaration.name?.text ?? "Anonymous"}.${method.name.getText(sourceFile)}`;
        if (!intentionalExceptions.has(key)) uncovered.push(key);
      }
    }
  }

  assert.deepEqual(uncovered, [], `mutation routes without an explicit rate limit: ${uncovered.join(", ")}`);
});
