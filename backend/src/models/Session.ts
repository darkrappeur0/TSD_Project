// backend/src/models/Session.ts (Updated)

import mongoose, { Schema, Document, Types } from 'mongoose'; // Add Types for ObjectId

// Interfaces for nested documents
export interface IVote {
    userId: Types.ObjectId;
    username: string;
    value: string; // Could be '?', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', 'coffee'
}

export interface IStoryInSession {
    _id?: Types.ObjectId;
    storyId: Types.ObjectId; // Reference to the actual Story document
    title: string;
    description?: string;
    tasks?: string[];
    votes: IVote[];
    revealed: boolean;
    active: boolean;
    order: number; // For custom ordering of stories in the session
    // Mongoose automatically adds _id to subdocuments, so no need to explicitly add it here.
}

export interface ISessionMember {
    userId: Types.ObjectId;
    username: string;
}

// Define the Schema for StoryInSession subdocument
const VoteSchema: Schema = new Schema<IVote>({ // Define schema for votes
    userId: { type: Schema.Types.ObjectId, required: true },
    username: { type: String, required: true },
    value: { type: String, required: true },
}, { _id: false }); // Do not create _id for individual votes if not needed, or remove if you need it

const StoryInSessionSchema: Schema = new Schema<IStoryInSession>({
    storyId: { type: Schema.Types.ObjectId, ref: 'Story', required: true },
    title: { type: String, required: true },
    description: { type: String },
    tasks: [{ type: String }],
    votes: [VoteSchema], // Array of VoteSchema subdocuments
    revealed: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    order: { type: Number, required: true, default: 0 },
});

export interface ISession extends Document {
    sessionId: string; // User-friendly ID for joining
    owner: Types.ObjectId; // Reference to the User who created the session
    ownerUsername: string;
    members: ISessionMember[]; // Array of session members
    stories: Types.DocumentArray<IStoryInSession>; // <--- Use DocumentArray for Mongoose subdocument arrays
    currentStoryId: Types.ObjectId | null; // ID of the currently active story from the 'stories' array
    createdAt: Date;
    updatedAt: Date;
}

const SessionMemberSchema: Schema = new Schema<ISessionMember>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
}, { _id: false }); // Don't create _id for members unless you need to reference them individually

const SessionSchema: Schema = new Schema<ISession>({
    sessionId: { type: String, required: true, unique: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ownerUsername: { type: String, required: true },
    members: [SessionMemberSchema], // Array of SessionMember subdocuments
    stories: [StoryInSessionSchema], // <--- Array of StoryInSessionSchema subdocuments
    currentStoryId: { type: Schema.Types.ObjectId, ref: 'Story', default: null, nullable: true }, // Referencing actual Story ID
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

SessionSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

const Session = mongoose.model<ISession>('Session', SessionSchema);

export { Session }; // Export the Session model