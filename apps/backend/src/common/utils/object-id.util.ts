import { Types, isValidObjectId } from 'mongoose';

type ObjectIdLikeValue =
  | { toString(): string }
  | string
  | null
  | undefined;

export function toObjectId(id: ObjectIdLikeValue): Types.ObjectId {
  const normalized = typeof id === 'string' ? id : id?.toString() ?? '';
  const ObjectIdCtor = Types.ObjectId as unknown as new (
    value?: string,
  ) => Types.ObjectId;

  return new ObjectIdCtor(normalized);
}

export function isObjectIdValid(id: string | null | undefined): boolean {
  return typeof id === 'string' && isValidObjectId(id);
}

export function objectIdsEqual(
  left: ObjectIdLikeValue,
  right: ObjectIdLikeValue,
): boolean {
  if (!left || !right) {
    return false;
  }

  return left.toString() === right.toString();
}
