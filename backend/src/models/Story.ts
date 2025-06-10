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

const Story = mongoose.model<IStory>('Story', StorySchema);

export { Story, IStory }; // <--- This line is the key! It's a NAMED export.