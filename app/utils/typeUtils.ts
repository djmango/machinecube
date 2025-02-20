import { type } from 'typescript';

export function typeToString<T>(): string {
  const sourceFile = type.createSourceFile(
    'temp.ts',
    '',
    type.ScriptTarget.Latest,
    true
  );

  const printer = type.createPrinter({ newLine: type.NewLineKind.LineFeed });
  const typeChecker = type.createProgram(['temp.ts'], {}).getTypeChecker();

  const typeNode = typeChecker.getTypeFromTypeNode(
    type.createTypeReferenceNode(type.createIdentifier('T'), undefined)
  );

  return printer.printNode(
    type.EmitHint.Type,
    typeChecker.typeToTypeNode(typeNode, undefined, undefined),
    sourceFile
  );
} 
