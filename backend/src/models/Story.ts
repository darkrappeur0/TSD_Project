import mongoose, { Schema, Document } from 'mongoose';

interface IStory extends Document {
    title: string;
    description: string;
    tasks: string[];
}

const StorySchema: Schema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    tasks: [{ type: String }]
});

export default mongoose.model<IStory>('Story', StorySchema);
