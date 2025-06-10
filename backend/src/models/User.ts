// backend/src/models/User.ts

import mongoose, { Schema, Document } from 'mongoose';

// This line already exports IUser.
export interface IUser extends Document {
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

// Remove 'IUser' from this export list because it's already exported above.
export { User }; // <-- CORRECTED LINE