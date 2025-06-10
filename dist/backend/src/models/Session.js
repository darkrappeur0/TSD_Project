"use strict";
// backend/src/models/Session.ts (Updated)
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = void 0;
const mongoose_1 = __importStar(require("mongoose")); // Add Types for ObjectId
// Define the Schema for StoryInSession subdocument
const VoteSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    username: { type: String, required: true },
    value: { type: String, required: true },
}, { _id: false }); // Do not create _id for individual votes if not needed, or remove if you need it
const StoryInSessionSchema = new mongoose_1.Schema({
    storyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Story', required: true },
    title: { type: String, required: true },
    description: { type: String },
    tasks: [{ type: String }],
    votes: [VoteSchema], // Array of VoteSchema subdocuments
    revealed: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    order: { type: Number, required: true, default: 0 },
});
const SessionMemberSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
}, { _id: false }); // Don't create _id for members unless you need to reference them individually
const SessionSchema = new mongoose_1.Schema({
    sessionId: { type: String, required: true, unique: true },
    owner: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    ownerUsername: { type: String, required: true },
    members: [SessionMemberSchema], // Array of SessionMember subdocuments
    stories: [StoryInSessionSchema], // <--- Array of StoryInSessionSchema subdocuments
    currentStoryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Story', default: null, nullable: true }, // Referencing actual Story ID
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
SessionSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
const Session = mongoose_1.default.model('Session', SessionSchema);
exports.Session = Session;
//# sourceMappingURL=Session.js.map