import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type TaskCommentDocument = HydratedDocument<TaskComment>;

@Schema({ collection: 'task_comments', timestamps: true })
export class TaskComment {
  @Prop({
    required: true,
    type: SchemaTypes.ObjectId,
    ref: 'Task',
    index: true,
  })
  taskId!: Types.ObjectId;

  @Prop({
    required: true,
    type: SchemaTypes.ObjectId,
    ref: 'Group',
    index: true,
  })
  groupId!: Types.ObjectId;

  @Prop({
    required: true,
    type: SchemaTypes.ObjectId,
    ref: 'User',
    index: true,
  })
  authorId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  content!: string;
}

export const TaskCommentSchema = SchemaFactory.createForClass(TaskComment);

TaskCommentSchema.index({ taskId: 1, createdAt: 1 });
