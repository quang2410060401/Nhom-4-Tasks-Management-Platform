import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, default: null })
  passwordHash!: string | null;

  @Prop({ type: String, trim: true })
  googleId?: string;

  @Prop({ type: String, default: null })
  avatar!: string | null;

  @Prop({ default: false })
  isEmailVerified!: boolean;

  @Prop({ type: String, default: null })
  emailVerificationToken!: string | null;

  @Prop({ type: Date, default: null })
  emailVerificationExpiresAt!: Date | null;

  @Prop({ type: String, default: null })
  lastEmailVerificationToken!: string | null;

  @Prop({ type: Date, default: null })
  lastEmailVerifiedAt!: Date | null;

  @Prop({ type: String, default: null })
  passwordResetToken!: string | null;

  @Prop({ type: Date, default: null })
  passwordResetExpiresAt!: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
// `googleId` chỉ áp dụng cho tài khoản đăng nhập Google.
// Local accounts không nên lưu field này để tránh duplicate `null`.
UserSchema.index(
  { googleId: 1 },
  {
    unique: true,
    partialFilterExpression: { googleId: { $type: 'string' } },
  },
);
