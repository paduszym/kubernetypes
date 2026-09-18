/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Mateusz Paduszyński
 */
import ts from 'typescript';
import { z } from 'zod';

import { Declaration } from './declaration';
import type { IndexSignature, Type } from './type';

export type Bundle = z.infer<typeof Bundle>;
export const Bundle = z.object({
  file: z.string(),
  imports: z.array(z.lazy(() => BundleImport)).optional(),
  declarations: z.array(Declaration).optional(),
});

export const BundleImport = z.object({
  as: z.string(),
  from: z.string(),
});

export function bundleRender(bundle: Bundle) {
  const imports = (bundle.imports ?? []).map(({ from, as }) =>
    ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        undefined,
        undefined,
        ts.factory.createNamespaceImport(ts.factory.createIdentifier(as)),
      ),
      ts.factory.createStringLiteral(from, true),
    ),
  );

  const declarations = (bundle.declarations ?? []).map(({ name, description, exported, typeParameters, type }) => {
    const node = ts.factory.createTypeAliasDeclaration(
      exported ? [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)] : undefined,
      ts.factory.createIdentifier(name),
      typeParameters?.map((typeParam) =>
        ts.factory.createTypeParameterDeclaration(
          undefined,
          typeParam.name,
          typeParam.constraint ? createTypeNode(typeParam.constraint) : undefined,
          typeParam.default ? createTypeNode(typeParam.default) : undefined,
        ),
      ),
      createTypeNode(type),
    );

    if (description !== undefined) {
      ts.addSyntheticLeadingComment(
        node,
        ts.SyntaxKind.MultiLineCommentTrivia,
        descriptionToComment(description),
        true,
      );
    }

    return node;
  });

  const file = ts.factory.createSourceFile(
    [...imports, ...declarations],
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );

  return printer.printFile(file);
}

const printer = ts.createPrinter();

function createTypeNode(type: Type): ts.TypeNode {
  if (type.kind === 'string') {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
  }
  if (type.kind === 'number') {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
  }
  if (type.kind === 'boolean') {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
  }
  if (type.kind === 'string-literal') {
    const value = JSON.parse(type.raw) as string;
    return ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(value, true));
  }
  if (type.kind === 'object-literal') {
    const members: ts.TypeElement[] = (type.props ?? []).map(({ name, description, optional, type: propType }) => {
      const node = ts.factory.createPropertySignature(
        undefined,
        ts.factory.createStringLiteral(name, true),
        optional ? ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
        createTypeNode(propType),
      );

      if (description !== undefined) {
        ts.addSyntheticLeadingComment(
          node,
          ts.SyntaxKind.MultiLineCommentTrivia,
          descriptionToComment(description),
          true,
        );
      }

      return node;
    });
    if (type.indexSignature !== undefined) {
      members.push(createIndexSignature(type.indexSignature));
    }
    if (members.length === 0) {
      members.push(createIndexSignature({ key: { kind: 'string' }, val: { kind: 'unknown' } }));
    }
    return ts.factory.createTypeLiteralNode(members);
  }
  if (type.kind === 'array') {
    return ts.factory.createArrayTypeNode(createTypeNode(type.element));
  }
  if (type.kind === 'reference') {
    return ts.factory.createTypeReferenceNode(
      type.namespace !== undefined ? `${type.namespace}.${type.name}` : type.name,
      type.params?.map(createTypeNode),
    );
  }
  if (type.kind === 'intersection') {
    return ts.factory.createIntersectionTypeNode(type.elements.map(createTypeNode));
  }
  if (type.kind === 'union') {
    return ts.factory.createUnionTypeNode(type.elements.map(createTypeNode));
  }
  if (type.kind === 'non-null') {
    return ts.factory.createTypeLiteralNode([]);
  }
  if (type.kind === 'interface') {
    const members: ts.TypeElement[] = (type.methods ?? []).map(({ name, embedded }) =>
      embedded
        ? ts.factory.createPropertySignature(
            undefined,
            ts.factory.createStringLiteral(name, true),
            undefined,
            ts.factory.createTypeLiteralNode([
              createIndexSignature({ key: { kind: 'string' }, val: { kind: 'function' } }),
            ]),
          )
        : ts.factory.createMethodSignature(
            undefined,
            ts.factory.createStringLiteral(name, true),
            undefined,
            undefined,
            [createSpreadArgsDeclaration()],
            ts.factory.createToken(ts.SyntaxKind.UnknownKeyword),
          ),
    );
    if (members.length === 0) {
      members.push(createIndexSignature({ key: { kind: 'string' }, val: { kind: 'unknown' } }));
    }
    return ts.factory.createTypeLiteralNode(members);
  }
  if (type.kind === 'function') {
    return ts.factory.createFunctionTypeNode(
      undefined,
      [createSpreadArgsDeclaration()],
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
    );
  }
  return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
}

function createIndexSignature(indexSignature: IndexSignature) {
  return ts.factory.createIndexSignature(
    undefined,
    [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        ts.factory.createIdentifier('key'),
        undefined,
        createTypeNode(indexSignature.key),
      ),
    ],
    createTypeNode(indexSignature.val),
  );
}

function createSpreadArgsDeclaration() {
  return ts.factory.createParameterDeclaration(
    undefined,
    ts.factory.createToken(ts.SyntaxKind.DotDotDotToken),
    ts.factory.createIdentifier('args'),
    undefined,
    ts.factory.createArrayTypeNode(ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)),
  );
}

function descriptionToComment(description: string) {
  description = description
    .replace(/^deprecated[:.] /im, '@deprecated ')
    .replace(/deprecated: /i, '\n@deprecated ')
    .replace(/\. this field is deprecated/i, '.\n@deprecated This field is deprecated');

  return (
    '* \n' +
    description
      .replaceAll('*/', '* /')
      .split('\n')
      .map((line) => ` * ${line}`)
      .join('\n') +
    '\n '
  );
}
