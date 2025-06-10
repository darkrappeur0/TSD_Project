// backend/src/models/User.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

// Fixed: Made _id required to match Document interface
export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  passwordHash: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

UserSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const User = mongoose.model<IUser>('User', UserSchema);

export { User };