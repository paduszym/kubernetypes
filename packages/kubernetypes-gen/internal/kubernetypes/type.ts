/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Mateusz Paduszyński
 */
import { z } from 'zod';

export type Type =
  | StringType
  | NumberType
  | BooleanType
  | StringLiteralType
  | ObjectLiteralType
  | ArrayType
  | ReferenceType
  | IntersectionType
  | UnionType
  | NonNullType
  | InterfaceType
  | FunctionType
  | UnknownType;
export const Type: z.ZodType<Type> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    StringType,
    NumberType,
    BooleanType,
    StringLiteralType,
    ObjectLiteralType,
    ArrayType,
    ReferenceType,
    IntersectionType,
    UnionType,
    NonNullType,
    InterfaceType,
    FunctionType,
    UnknownType,
  ]),
);

export type StringType = z.infer<typeof StringType>;
export const StringType = z.object({
  kind: z.literal('string'),
});

export type NumberType = z.infer<typeof NumberType>;
export const NumberType = z.object({
  kind: z.literal('number'),
});

export type BooleanType = z.infer<typeof BooleanType>;
export const BooleanType = z.object({
  kind: z.literal('boolean'),
});

export type StringLiteralType = z.infer<typeof StringLiteralType>;
export const StringLiteralType = z.object({
  kind: z.literal('string-literal'),
  raw: z.string(),
});

export type ObjectLiteralType = {
  kind: 'object-literal';
  props?: ObjectProperty[];
  indexSignature?: IndexSignature;
};
export const ObjectLiteralType = z.object({
  kind: z.literal('object-literal'),
  props: z.array(z.lazy(() => ObjectProperty)).optional(),
  indexSignature: z.lazy(() => IndexSignature).optional(),
});

export type ObjectProperty = z.infer<typeof ObjectProperty>;
export const ObjectProperty = z.object({
  name: z.string(),
  description: z.string().optional(),
  optional: z.boolean(),
  type: Type,
});

export type IndexSignature = z.infer<typeof IndexSignature>;
export const IndexSignature = z.object({
  key: Type,
  val: Type,
});

export type ArrayType = {
  kind: 'array';
  element: Type;
};
export const ArrayType = z.object({
  kind: z.literal('array'),
  element: Type,
});

export type ReferenceType = {
  kind: 'reference';
  namespace?: string;
  name: string;
  params?: Type[];
};
export const ReferenceType = z.object({
  kind: z.literal('reference'),
  namespace: z.string().optional(),
  name: z.string(),
  params: z.array(Type).optional(),
});

export type IntersectionType = {
  kind: 'intersection';
  elements: Type[];
};
export const IntersectionType = z.object({
  kind: z.literal('intersection'),
  elements: z.array(Type),
});

export type UnionType = {
  kind: 'union';
  elements: Type[];
};
export const UnionType = z.object({
  kind: z.literal('union'),
  elements: z.array(Type),
});

export type NonNullType = z.infer<typeof NonNullType>;
export const NonNullType = z.object({
  kind: z.literal('non-null'),
});

export type InterfaceType = z.infer<typeof InterfaceType>;
export const InterfaceType = z.object({
  kind: z.literal('interface'),
  methods: z.array(z.lazy(() => InterfaceMethod)).optional(),
});

export const InterfaceMethod = z.object({
  name: z.string(),
  embedded: z.boolean(),
});

export type FunctionType = z.infer<typeof FunctionType>;
export const FunctionType = z.object({
  kind: z.literal('function'),
});

export type UnknownType = z.infer<typeof UnknownType>;
export const UnknownType = z.object({
  kind: z.literal('unknown'),
});
