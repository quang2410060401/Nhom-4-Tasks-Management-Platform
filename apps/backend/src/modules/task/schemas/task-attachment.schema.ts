import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskAttachmentDocument = HydratedDocument<TaskAttachment>;

@Schema({ collection: 'task_attachments', timestamps: true })
export class TaskAttachment {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Task', index: true })
  taskId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Group', index: true })
  groupId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  uploadedBy!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 255 })
  originalName!: string;

  @Prop({ required: true, trim: true })
  storedName!: string;

  @Prop({ required: true, trim: true })
  relativePath!: string;

  @Prop({ required: true, trim: true })
  mimeType!: string;

  @Prop({ required: true, min: 1 })
  size!: number;
}

export const TaskAttachmentSchema =
  SchemaFactory.createForClass(TaskAttachment);

TaskAttachmentSchema.index({ taskId: 1, createdAt: -1 });
